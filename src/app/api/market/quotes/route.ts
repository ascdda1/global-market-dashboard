import { NextResponse } from 'next/server';
import type { ApiQuote, MarketSession } from '../../../market-data';

type AlpacaSnapshot = {
  latestTrade?: { p?: number; t?: string };
  latestQuote?: { bp?: number; ap?: number; t?: string };
  minuteBar?: { c?: number; t?: string };
  dailyBar?: { c?: number; t?: string };
  prevDailyBar?: { c?: number };
};

const symbolPattern = /^[A-Z][A-Z0-9.-]{0,9}$/;
const maxSymbols = 60;

function marketSession(now = new Date()): MarketSession {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  if (read('weekday') === 'Sat' || read('weekday') === 'Sun') return 'closed';
  const minutes = Number(read('hour')) * 60 + Number(read('minute'));
  if (minutes >= 20 * 60 || minutes < 4 * 60) return 'overnight';
  if (minutes < 9 * 60 + 30) return 'pre';
  if (minutes < 16 * 60) return 'regular';
  return 'after';
}

function snapshotPrice(snapshot: AlpacaSnapshot) {
  const bid = snapshot.latestQuote?.bp;
  const ask = snapshot.latestQuote?.ap;
  const midpoint = typeof bid === 'number' && typeof ask === 'number' && bid > 0 && ask > 0 ? (bid + ask) / 2 : undefined;
  return [snapshot.latestTrade?.p, midpoint, snapshot.minuteBar?.c, snapshot.dailyBar?.c].find((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
}

function snapshotTime(snapshot: AlpacaSnapshot) {
  const value = snapshot.latestTrade?.t ?? snapshot.latestQuote?.t ?? snapshot.minuteBar?.t ?? snapshot.dailyBar?.t;
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
}

async function alpacaBatch(symbols: string[], apiKey: string, secret: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const url = new URL('https://data.alpaca.markets/v2/stocks/snapshots');
    url.search = new URLSearchParams({ symbols: symbols.join(','), feed: 'iex' }).toString();
    return await fetch(url, { cache: 'no-store', signal: controller.signal, headers: { 'APCA-API-KEY-ID': apiKey, 'APCA-API-SECRET-KEY': secret } });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('symbols')?.split(',') ?? [];
  const symbols = [...new Set(raw.map((symbol) => symbol.trim().toUpperCase()).filter((symbol) => symbolPattern.test(symbol)))].slice(0, maxSymbols);
  if (!symbols.length) return NextResponse.json({ quotes: {}, missing: [], fetchedAt: Date.now() });
  const apiKey = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_API_SECRET_KEY;
  if (!apiKey || !secret) return NextResponse.json({ error: 'Alpaca Market Data is not configured.' }, { status: 503 });

  try {
    const upstream = await alpacaBatch(symbols, apiKey, secret);
    if (!upstream.ok) return NextResponse.json({ error: 'Live quote batch is temporarily unavailable.' }, { status: 502 });
    const payload = await upstream.json() as Record<string, AlpacaSnapshot> & { snapshots?: Record<string, AlpacaSnapshot> };
    const snapshots = payload.snapshots ?? payload;
    const session = marketSession();
    const quotes: Record<string, ApiQuote> = {};
    for (const symbol of symbols) {
      const snapshot = snapshots[symbol];
      const value = snapshot && snapshotPrice(snapshot);
      const previousClose = snapshot?.prevDailyBar?.c;
      if (!snapshot || !value || typeof previousClose !== 'number' || !Number.isFinite(previousClose) || previousClose <= 0) continue;
      const change = value - previousClose;
      quotes[symbol] = { value, previousClose, change, percent: (change / previousClose) * 100, updatedAt: snapshotTime(snapshot), source: 'Alpaca IEX', status: 'real', session };
    }
    return NextResponse.json({ quotes, missing: symbols.filter((symbol) => !quotes[symbol]), fetchedAt: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Live quote batch is temporarily unavailable.' }, { status: 502 });
  }
}

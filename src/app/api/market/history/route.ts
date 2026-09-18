import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

type Range = '1Y' | '3Y' | '5Y' | '10Y';
type Bar = { time: number; open: number; high: number; low: number; close: number };
type CacheEntry = { expiresAt: number; bars: Bar[]; provider: string };

const cache = new Map<string, CacheEntry>();
const ttlMs = 60_000;
const persistentHistoryTtlSeconds = 21_600;
const symbolPattern = /^[A-Z^][A-Z0-9.^/=-]{0,14}$/;
const fredOverviewSeries: Record<string, string> = {
  US10Y: 'DGS10',
  VIX: 'VIXCLS',
};
const tencentOverviewSeries: Record<string, string> = {
  CSI300: 'sh000300',
};
const yahooOverviewSeries = new Set(['^GSPC', '^IXIC', '^DJI', 'GC=F', 'CL=F']);
function normalizeBars(input: Bar[]) { const unique = new Map<number, Bar>(); for (const bar of input) if ([bar.time, bar.open, bar.high, bar.low, bar.close].every(Number.isFinite) && bar.time > 0 && bar.close > 0) unique.set(bar.time, bar); return [...unique.values()].sort((left, right) => left.time - right.time); }

function rangeConfig(range: Range) {
  const now = Date.now();
  const years = range === '1Y' ? 1 : range === '3Y' ? 3 : range === '5Y' ? 5 : 10;
  const start = new Date(now); start.setUTCFullYear(start.getUTCFullYear() - years);
  return { timeframe: '1Day', start };
}

async function timedFetch(url: URL, headers: HeadersInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try { return await fetch(url, { cache: 'no-store', headers, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

// EastMoney (push2his.eastmoney.com) is mainland-China-hosted, so it loads far faster there than
// Alpaca (US-hosted), and its fqt=1 parameter returns forward (split + dividend) adjusted prices
// directly — sidestepping a class of bug Alpaca itself has shipped before (its community forum has a
// documented case of a *missing* NVDA split in Alpaca's own corporate-actions database making
// `adjustment=all` silently return unadjusted data for that exact stock). We resolve each ticker's
// market prefix once (105 = NASDAQ, 106 = NYSE, 107 = US ETF/other — EastMoney doesn't expose a single
// prefix-free lookup, so we probe) and cache the answer for the life of the server process. Alpaca
// stays wired up underneath as a silent fallback only for a symbol EastMoney can't resolve at all.
const eastmoneySecidCache = new Map<string, string | null>();
const eastmoneyMarketPrefixes = [105, 106, 107];

async function resolveEastmoneySecid(symbol: string): Promise<string | null> {
  if (eastmoneySecidCache.has(symbol)) return eastmoneySecidCache.get(symbol) ?? null;
  for (const prefix of eastmoneyMarketPrefixes) {
    const secid = `${prefix}.${symbol}`;
    try {
      const url = new URL('https://push2his.eastmoney.com/api/qt/stock/kline/get');
      url.search = new URLSearchParams({ secid, fields1: 'f1,f2,f3,f4,f5,f6', fields2: 'f51,f52,f53,f54,f55,f56', klt: '101', fqt: '1', lmt: '5' }).toString();
      const response = await timedFetch(url, {});
      if (!response.ok) continue;
      const payload = (await response.json()) as { data?: { klines?: string[] } | null };
      if (payload.data?.klines?.length) { eastmoneySecidCache.set(symbol, secid); return secid; }
    } catch { /* try the next market prefix */ }
  }
  eastmoneySecidCache.set(symbol, null);
  return null;
}

async function fetchEastmoneyHistory(symbol: string, range: Range): Promise<Bar[]> {
  const secid = await resolveEastmoneySecid(symbol);
  if (!secid) throw new Error(`EastMoney has no listing for ${symbol}`);
  const config = rangeConfig(range);
  const beg = config.start.toISOString().slice(0, 10).replace(/-/g, '');
  const end = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const url = new URL('https://push2his.eastmoney.com/api/qt/stock/kline/get');
  url.search = new URLSearchParams({ secid, fields1: 'f1,f2,f3,f4,f5,f6', fields2: 'f51,f52,f53,f54,f55,f56', klt: '101', fqt: '1', beg, end, lmt: '3000' }).toString();
  const response = await timedFetch(url, {});
  if (!response.ok) throw new Error(`EastMoney responded with ${response.status}`);
  const payload = (await response.json()) as { data?: { klines?: string[] } | null };
  const rows = payload.data?.klines ?? [];
  // Each row is "date,open,close,high,low,volume" (comma-separated, per fields2 order f51..f56).
  return rows.flatMap((row) => {
    const [dateStr, openStr, closeStr, highStr, lowStr] = row.split(',');
    if (!dateStr) return [];
    const time = Math.floor(Date.parse(`${dateStr}T00:00:00Z`) / 1000);
    const open = Number(openStr); const close = Number(closeStr); const high = Number(highStr); const low = Number(lowStr);
    return [Number.isFinite(open) && Number.isFinite(close) && Number.isFinite(high) && Number.isFinite(low) ? { time, open, high, low, close } : []].flat();
  });
}

// FRED (Federal Reserve Economic Data, St. Louis Fed) publishes the official daily 10-year Treasury
// constant-maturity yield as a public CSV — no API key or auth required. There's no equity/ETF ticker
// that tracks a yield the way SPY tracks the S&P 500, so EastMoney/Alpaca don't apply here; FRED is the
// primary-source government data itself. The value is already a plain percent (e.g. 4.25), so we reuse
// it as open/high/low/close — the chart only plots the close.
async function fetchFredHistory(seriesId: string, range: Range): Promise<Bar[]> {
  const config = rangeConfig(range);
  const cosd = config.start.toISOString().slice(0, 10);
  const url = new URL('https://fred.stlouisfed.org/graph/fredgraph.csv');
  url.search = new URLSearchParams({ id: seriesId, cosd }).toString();
  const response = await timedFetch(url, { 'User-Agent': 'Mozilla/5.0 (personal-market-dashboard)' });
  if (!response.ok) throw new Error(`FRED responded with ${response.status}`);
  const rows = (await response.text()).trim().split('\n').slice(1);
  return rows.flatMap((row) => {
    const [dateStr, valueStr] = row.split(',');
    const value = Number(valueStr);
    const time = dateStr ? Math.floor(Date.parse(`${dateStr}T00:00:00Z`) / 1000) : Number.NaN;
    return Number.isFinite(value) && value > 0 && Number.isFinite(time) ? [{ time, open: value, high: value, low: value, close: value }] : [];
  });
}

async function fetchYahooHistory(symbol: string, range: Range): Promise<Bar[]> {
  const config = rangeConfig(range);
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.search = new URLSearchParams({
    period1: String(Math.floor(config.start.getTime() / 1000)),
    period2: String(Math.floor(Date.now() / 1000)),
    interval: '1d',
    events: 'history',
    includeAdjustedClose: 'true',
  }).toString();
  const response = await timedFetch(url, { 'User-Agent': 'Mozilla/5.0 (personal-market-dashboard)' });
  if (!response.ok) throw new Error(`Yahoo Finance responded with ${response.status}`);
  const payload = await response.json() as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null> }>;
        };
      }>;
    };
  };
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp ?? [];
  return normalizeBars(timestamps.flatMap((time, index) => {
    const close = quote?.close?.[index];
    if (typeof close !== 'number' || !Number.isFinite(close) || close <= 0) return [];
    const openValue = quote?.open?.[index];
    const highValue = quote?.high?.[index];
    const lowValue = quote?.low?.[index];
    const open = typeof openValue === 'number' && Number.isFinite(openValue) ? openValue : close;
    const high = typeof highValue === 'number' && Number.isFinite(highValue) ? highValue : close;
    const low = typeof lowValue === 'number' && Number.isFinite(lowValue) ? lowValue : close;
    return [{ time, open, high, low, close }];
  }));
}

async function fetchTencentIndexHistory(code: string, range: Range): Promise<Bar[]> {
  const start = rangeConfig(range).start;
  const startDate = start.toISOString().slice(0, 10);
  let endDate = new Date().toISOString().slice(0, 10);
  const bars: Bar[] = [];
  for (let page = 0; page < 7; page += 1) {
    const url = new URL('https://web.ifzq.gtimg.cn/appstock/app/kline/kline');
    url.search = new URLSearchParams({ param: `${code},day,${startDate},${endDate},640` }).toString();
    const response = await timedFetch(url, { 'User-Agent': 'Mozilla/5.0 (personal-market-dashboard)' });
    if (!response.ok) throw new Error(`Tencent historical responded with ${response.status}`);
    const payload = await response.json() as { data?: Record<string, { day?: string[][] }> };
    const rows = Object.values(payload.data ?? {}).find((value) => Array.isArray(value.day))?.day ?? [];
    if (!rows.length) break;
    bars.push(...rows.flatMap((row) => {
      const [dateStr, openStr, closeStr, highStr, lowStr] = row;
      const time = dateStr ? Math.floor(Date.parse(`${dateStr}T00:00:00Z`) / 1000) : Number.NaN;
      const open = Number(openStr); const close = Number(closeStr); const high = Number(highStr); const low = Number(lowStr);
      return [time, open, close, high, low].every(Number.isFinite) && close > 0 ? [{ time, open, high, low, close }] : [];
    }));
    const earliest = rows[0]?.[0];
    if (!earliest || earliest <= startDate) break;
    const previousDay = new Date(`${earliest}T00:00:00Z`);
    previousDay.setUTCDate(previousDay.getUTCDate() - 1);
    endDate = previousDay.toISOString().slice(0, 10);
  }
  return normalizeBars(bars).filter((bar) => bar.time >= Math.floor(start.getTime() / 1000));
}

const getCachedEastmoneyHistory = unstable_cache(
  async (symbol: string, range: Range) => normalizeBars(await fetchEastmoneyHistory(symbol, range)),
  ['market-history-eastmoney-v1'],
  { revalidate: persistentHistoryTtlSeconds },
);

const getCachedFredHistory = unstable_cache(
  async (seriesId: string, range: Range) => normalizeBars(await fetchFredHistory(seriesId, range)),
  ['market-history-fred-v1'],
  { revalidate: persistentHistoryTtlSeconds },
);

const getCachedTencentIndexHistory = unstable_cache(
  async (code: string, range: Range) => fetchTencentIndexHistory(code, range),
  ['market-history-tencent-index-v1'],
  { revalidate: persistentHistoryTtlSeconds },
);

const getCachedYahooHistory = unstable_cache(
  async (symbol: string, range: Range) => fetchYahooHistory(symbol, range),
  ['market-history-yahoo-v1'],
  { revalidate: persistentHistoryTtlSeconds },
);

const getCachedAlpacaHistory = unstable_cache(
  async (rawSymbol: string, providerSymbol: string, range: Range) => {
    const apiKey = process.env.ALPACA_API_KEY_ID;
    const secret = process.env.ALPACA_API_SECRET_KEY;
    if (!apiKey || !secret) throw new Error('Alpaca history is not configured');
    const isCrypto = rawSymbol === 'BTC' || rawSymbol === 'ETH';
    const config = rangeConfig(range);
    const alpacaSymbol = isCrypto ? `${rawSymbol}/USD` : providerSymbol;
    const bars: Bar[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 5; page += 1) {
      const url = new URL(isCrypto ? 'https://data.alpaca.markets/v1beta3/crypto/us/bars' : 'https://data.alpaca.markets/v2/stocks/bars');
      url.search = new URLSearchParams({ symbols: alpacaSymbol, timeframe: '1Day', start: config.start.toISOString(), end: new Date().toISOString(), limit: '1000', ...(pageToken ? { page_token: pageToken } : {}), ...(isCrypto ? {} : { feed: 'iex', adjustment: 'all' }) }).toString();
      const response = await timedFetch(url, { 'APCA-API-KEY-ID': apiKey, 'APCA-API-SECRET-KEY': secret });
      if (!response.ok) throw new Error(`Alpaca historical responded with ${response.status}`);
      const payload = await response.json() as { bars?: Record<string, Array<{ t?: string; o?: number; h?: number; l?: number; c?: number }>>; next_page_token?: string | null };
      bars.push(...(payload.bars?.[alpacaSymbol] ?? []).flatMap((bar) => bar.t && [bar.o, bar.h, bar.l, bar.c].every(Number.isFinite) ? [{ time: Math.floor(Date.parse(bar.t) / 1000), open: bar.o!, high: bar.h!, low: bar.l!, close: bar.c! }] : []));
      pageToken = payload.next_page_token ?? undefined;
      if (!pageToken) break;
    }
    const normalized = normalizeBars(bars);
    if (!normalized.length) throw new Error('Alpaca returned no historical bars');
    return normalized;
  },
  ['market-history-alpaca-v1'],
  { revalidate: persistentHistoryTtlSeconds },
);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawSymbol = (params.get('symbol') ?? '').toUpperCase();
  const range = (['1Y', '3Y', '5Y', '10Y'].includes(params.get('range') ?? '') ? params.get('range') : '10Y') as Range;
  if (!symbolPattern.test(rawSymbol)) return NextResponse.json({ bars: [], status: 'unavailable', provider: 'EastMoney' }, { status: 400 });
  const fredSeries = fredOverviewSeries[rawSymbol];
  if (fredSeries) {
    const cacheKey = `fred:${fredSeries}:${range}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return NextResponse.json({ bars: cached.bars, status: 'cache', provider: cached.provider, liveCompatible: true });
    try {
      const normalized = await getCachedFredHistory(fredSeries, range);
      if (normalized.length) {
        cache.set(cacheKey, { bars: normalized, expiresAt: Date.now() + ttlMs, provider: 'FRED' });
        return NextResponse.json({ bars: normalized, status: 'real', provider: 'FRED', timeframe: '1Day', liveCompatible: true });
      }
    } catch {
      // US10Y gets a market-yield fallback below; other FRED series continue to unavailable.
    }
    if (rawSymbol === 'US10Y') {
      try {
        const normalized = await getCachedYahooHistory('^TNX', range);
        if (normalized.length) {
          return NextResponse.json({ bars: normalized, status: 'real', provider: 'Yahoo Finance ^TNX', timeframe: '1Day', liveCompatible: false });
        }
      } catch {
        // Keep the official-data failure visible instead of fabricating a flat line.
      }
    }
    return NextResponse.json({ bars: cached?.bars ?? [], status: cached ? 'cache' : 'unavailable', provider: cached?.provider ?? 'FRED', liveCompatible: true });
  }

  const tencentSeries = tencentOverviewSeries[rawSymbol];
  if (tencentSeries) {
    const cacheKey = `tencent:${tencentSeries}:${range}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return NextResponse.json({ bars: cached.bars, status: 'cache', provider: cached.provider, liveCompatible: true });
    try {
      const normalized = await getCachedTencentIndexHistory(tencentSeries, range);
      if (normalized.length) {
        cache.set(cacheKey, { bars: normalized, expiresAt: Date.now() + ttlMs, provider: 'Tencent Finance' });
        return NextResponse.json({ bars: normalized, status: 'real', provider: 'Tencent Finance', timeframe: '1Day', liveCompatible: true });
      }
    } catch {
      // Never substitute a proxy with a different price scale.
    }
    return NextResponse.json({ bars: cached?.bars ?? [], status: cached ? 'cache' : 'unavailable', provider: cached?.provider ?? 'Tencent Finance', liveCompatible: true });
  }

  if (yahooOverviewSeries.has(rawSymbol)) {
    const cacheKey = `yahoo:${rawSymbol}:${range}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return NextResponse.json({ bars: cached.bars, status: 'cache', provider: cached.provider, liveCompatible: true });
    try {
      const normalized = await getCachedYahooHistory(rawSymbol, range);
      if (normalized.length) {
        cache.set(cacheKey, { bars: normalized, expiresAt: Date.now() + ttlMs, provider: 'Yahoo Finance' });
        return NextResponse.json({ bars: normalized, status: 'real', provider: 'Yahoo Finance', timeframe: '1Day', liveCompatible: true });
      }
    } catch {
      // Gold/oil stay unavailable rather than falling back to a different spot-market series.
    }
    return NextResponse.json({ bars: cached?.bars ?? [], status: cached ? 'cache' : 'unavailable', provider: cached?.provider ?? 'Yahoo Finance', liveCompatible: true });
  }

  const isCrypto = rawSymbol === 'BTC' || rawSymbol === 'ETH';
  const providerSymbol = rawSymbol;
  const cacheKey = `${providerSymbol}:${range}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return NextResponse.json({ bars: cached.bars, status: 'cache', provider: cached.provider, liveCompatible: true });

  if (!isCrypto) {
    try {
      const normalized = await getCachedEastmoneyHistory(providerSymbol, range);
      if (normalized.length) {
        cache.set(cacheKey, { bars: normalized, expiresAt: Date.now() + ttlMs, provider: 'EastMoney' });
        return NextResponse.json({ bars: normalized, status: 'real', provider: 'EastMoney', timeframe: '1Day', liveCompatible: true });
      }
    } catch {
      // fall through to the Alpaca fallback below
    }
  }

  try {
    const normalized = await getCachedAlpacaHistory(rawSymbol, providerSymbol, range);
    cache.set(cacheKey, { bars: normalized, expiresAt: Date.now() + ttlMs, provider: 'Alpaca' });
    return NextResponse.json({ bars: normalized, status: 'real', provider: 'Alpaca', timeframe: '1Day', liveCompatible: true });
  } catch {
    return NextResponse.json({ bars: cached?.bars ?? [], status: cached ? 'cache' : 'unavailable', provider: cached?.provider ?? 'Alpaca', liveCompatible: true });
  }
}

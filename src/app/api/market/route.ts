import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';
import type { MacroQuote, MarketDataStatus, MarketSession, TreasuryQuote } from '../../market-data';
import { recordProviderFailure, safeConfigurationMessage, safeErrorMessage, sanitizeProviderError } from '../safe-error';

type Quote = {
  symbol: string;
  value: number;
  change: number;
  percent: number;
  updatedAt: number;
  source: string;
  dataDate?: string;
  previousClose?: number;
  status?: MarketDataStatus;
  session?: MarketSession;
};

type AlpacaSnapshot = {
  latestTrade?: { p?: number; t?: string };
  latestQuote?: { bp?: number; ap?: number; t?: string };
  minuteBar?: { c?: number; t?: string };
  dailyBar?: { c?: number; t?: string };
  prevDailyBar?: { c?: number; t?: string };
};

type AlpacaSnapshotsResponse = Record<string, AlpacaSnapshot> & { snapshots?: Record<string, AlpacaSnapshot> };

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        regularMarketTime?: number;
      };
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    } | null>;
  };
};

type FinnhubResponse = {
  c?: number;
  d?: number;
  dp?: number;
  t?: number;
};

type CoinbaseStatsResponse = {
  open?: string;
  last?: string;
};

type HistoryRange = '1D' | '1W' | '1M' | 'YTD';
type HistoryTask = { symbol: string; provider: 'yahoo' | 'coinbase' };

type BlsResponse = {
  status?: string;
  message?: string[];
  Results?: {
    series?: Array<{
      seriesID?: string;
      data?: Array<{ year?: string; period?: string; periodName?: string; value?: string }>;
    }>;
  };
};

type BeaRow = { LineDescription?: string; TimePeriod?: string; DataValue?: string };

type BeaResponse = {
  BEAAPI?: {
    Results?: {
      Data?: BeaRow[];
    };
  };
};

const fallbackQuotes: Record<string, Quote> = {
  '^DJI': { symbol: '^DJI', value: 38627.99, change: 184.12, percent: 0.48, updatedAt: 0, source: '\u6a21\u62df\u6570\u636e' },
  '^GSPC': { symbol: '^GSPC', value: 5432.26, change: 32.41, percent: 0.6, updatedAt: 0, source: '模拟数据' },
  '^IXIC': { symbol: '^IXIC', value: 17608.44, change: 141.85, percent: 0.81, updatedAt: 0, source: '模拟数据' },
  'GC=F': { symbol: 'GC=F', value: 2342.8, change: -8.4, percent: -0.36, updatedAt: 0, source: '模拟数据' },
  'CL=F': { symbol: 'CL=F', value: 78.65, change: 1.12, percent: 1.44, updatedAt: 0, source: '模拟数据' },
  NVDA: { symbol: 'NVDA', value: 131.88, change: 3.74, percent: 2.92, updatedAt: 0, source: '模拟数据', status: 'fallback', session: 'closed', previousClose: 128.14 },
  MU: { symbol: 'MU', value: 146.96, change: -2.18, percent: -1.46, updatedAt: 0, source: '模拟数据' },
  TSLA: { symbol: 'TSLA', value: 177.48, change: 4.63, percent: 2.68, updatedAt: 0, source: '模拟数据' },
  AAPL: { symbol: 'AAPL', value: 207.15, change: 0.92, percent: 0.45, updatedAt: 0, source: '模拟数据' },
  QQQM: { symbol: 'QQQM', value: 210.24, change: 1.31, percent: 0.63, updatedAt: 0, source: '模拟数据', status: 'fallback', session: 'closed', previousClose: 208.93 },
  SPYM: { symbol: 'SPYM', value: 67.42, change: 0.28, percent: 0.42, updatedAt: 0, source: '模拟数据', status: 'fallback', session: 'closed', previousClose: 67.14 },
  DIA: { symbol: 'DIA', value: 427.16, change: 1.89, percent: 0.44, updatedAt: 0, source: '模拟数据', status: 'fallback', session: 'closed', previousClose: 425.27 },
  SMH: { symbol: 'SMH', value: 248.77, change: 2.14, percent: 0.87, updatedAt: 0, source: '模拟数据', status: 'fallback', session: 'closed', previousClose: 246.63 },
  VGT: { symbol: 'VGT', value: 682.15, change: 3.94, percent: 0.58, updatedAt: 0, source: '模拟数据', status: 'fallback', session: 'closed', previousClose: 678.21 },
  AVGO: { symbol: 'AVGO', value: 186.68, change: 2.52, percent: 1.37, updatedAt: 0, source: '模拟数据', status: 'fallback', session: 'closed', previousClose: 184.16 },
};

const yahooSymbols = ['^GSPC', '^IXIC', '^DJI', 'GC=F', 'CL=F'];
const alpacaSymbols = ['QQQM', 'SPYM', 'DIA', 'SMH', 'VGT', 'AVGO', 'NVDA'] as const;
const defaultFinnhubSymbols = ['NVDA', 'MU', 'TSLA', 'AAPL'];
const maxFinnhubSymbols = 30;
const symbolPattern = /^[A-Z][A-Z0-9.-]{0,9}$/;
const treasurySymbols = ['US2Y', 'US10Y', 'US30Y'] as const;
const treasuryFields: Record<typeof treasurySymbols[number], string> = { US2Y: 'BC_2YEAR', US10Y: 'BC_10YEAR', US30Y: 'BC_30YEAR' };
const cryptoSymbols = ['bitcoin', 'ethereum'] as const;
type ServerCacheEntry<T> = { expiresAt: number; values: T };

const quoteCache = new Map<string, ServerCacheEntry<Quote>>();
const alpacaQuoteCache = new Map<string, ServerCacheEntry<Record<string, Quote>>>();
const treasuryCache = new Map<string, ServerCacheEntry<Record<string, TreasuryQuote>>>();
const cryptoCache = new Map<string, ServerCacheEntry<Record<string, Quote>>>();
const historyCache = new Map<string, ServerCacheEntry<number[]>>();
const historyCacheTtlMs = 60_000;
const maxHistoryPoints = 72;
const marketQuoteCacheTtlMs = 45_000;
const alpacaQuoteCacheTtlMs = 8_000;
const treasuryCacheTtlMs = 10 * 60_000;
const cryptoCacheTtlMs = 45_000;
const macroCache = new Map<string, ServerCacheEntry<Record<string, MacroQuote>>>();
const macroCacheTtlMs = 45 * 60_000;
const marketRequestTimeoutMs = 4_000;
const officialDataTimeoutMs = 7_000;
const historyRequestTimeoutMs = 5_000;

const fallbackMacro: Record<string, MacroQuote> = {
  cpi: { value: 320.25, change: 0.3, referencePeriod: '模拟数据', source: '模拟数据', updatedAt: 0, unit: 'index' },
  coreCpi: { value: 330.1, change: 0.3, referencePeriod: '模拟数据', source: '模拟数据', updatedAt: 0, unit: 'index' },
  pce: { value: 126.8, change: 0.2, referencePeriod: '模拟数据', source: '模拟数据', updatedAt: 0, unit: 'index' },
  corePce: { value: 124.9, change: 0.2, referencePeriod: '模拟数据', source: '模拟数据', updatedAt: 0, unit: 'index' },
  nonfarmPayrolls: { value: 159_000, change: 118, referencePeriod: '模拟数据', source: '模拟数据', updatedAt: 0, unit: 'thousands' },
  unemploymentRate: { value: 4.1, change: 0, referencePeriod: '模拟数据', source: '模拟数据', updatedAt: 0, unit: 'percent' },
  gdp: { value: 30_100, change: 140, referencePeriod: '模拟数据', source: '模拟数据', updatedAt: 0, unit: 'billions' },
  effectiveFedFundsRate: { value: 4.33, change: 0.01, referencePeriod: '模拟数据', source: '模拟数据', updatedAt: 0, unit: 'percent' },
};

function getFallbackQuote(symbol: string): Quote {
  const knownQuote = fallbackQuotes[symbol];
  if (knownQuote) return knownQuote;

  const seed = [...symbol].reduce((total, character) => total + character.charCodeAt(0), 0);
  const value = 50 + (seed % 950);
  const change = ((seed % 401) - 200) / 100;
  return { symbol, value, change, percent: (change / value) * 100, updatedAt: 0, source: '模拟数据', status: 'fallback' };
}

function newYorkSession(now = new Date()): MarketSession {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const readPart = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const weekday = readPart('weekday');
  if (weekday === 'Sat' || weekday === 'Sun') return 'closed';
  const minutes = Number(readPart('hour')) * 60 + Number(readPart('minute'));
  if (minutes >= 20 * 60 || minutes < 4 * 60) return 'overnight';
  if (minutes < 9 * 60 + 30) return 'pre';
  if (minutes < 16 * 60) return 'regular';
  if (minutes < 20 * 60) return 'after';
  return 'closed';
}

function quoteTimestamp(snapshot: AlpacaSnapshot) {
  const timestamp = snapshot.latestTrade?.t ?? snapshot.latestQuote?.t ?? snapshot.minuteBar?.t ?? snapshot.dailyBar?.t;
  const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function snapshotPrice(snapshot: AlpacaSnapshot) {
  const bid = snapshot.latestQuote?.bp;
  const ask = snapshot.latestQuote?.ap;
  const midpoint = typeof bid === 'number' && typeof ask === 'number' && bid > 0 && ask > 0 ? (bid + ask) / 2 : undefined;
  return [snapshot.latestTrade?.p, midpoint, snapshot.minuteBar?.c, snapshot.dailyBar?.c].find((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
}

function markAlpacaCached(quotes: Record<string, Quote>) {
  return Object.fromEntries(Object.entries(quotes).map(([symbol, quote]) => [symbol, { ...quote, status: 'cache' as const }]));
}

async function fetchAlpacaSnapshots(apiKey: string, secret: string): Promise<Record<string, Quote>> {
  const session = newYorkSession();
  const cacheKey = `alpaca:${session}`;
  const cached = alpacaQuoteCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return markAlpacaCached(cached.values);

  try {
    const feed = session === 'overnight' ? 'overnight' : 'iex';
    const url = new URL('https://data.alpaca.markets/v2/stocks/snapshots');
    url.search = new URLSearchParams({ symbols: alpacaSymbols.join(','), feed }).toString();
    const response = await fetchWithTimeout(url, {
      cache: 'no-store',
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': secret,
      },
    }, marketRequestTimeoutMs);
    if (!response.ok) throw new Error(`Alpaca responded with ${response.status}`);

    const payload = (await response.json()) as AlpacaSnapshotsResponse;
    const snapshots = payload.snapshots ?? payload;
    const quotes: Record<string, Quote> = {};
    for (const symbol of alpacaSymbols) {
      const snapshot = snapshots[symbol];
      const value = snapshot && snapshotPrice(snapshot);
      const previousClose = snapshot?.prevDailyBar?.c;
      if (!snapshot || !value || typeof previousClose !== 'number' || !Number.isFinite(previousClose) || previousClose <= 0) continue;
      const change = value - previousClose;
      quotes[symbol] = {
        symbol,
        value,
        previousClose,
        change,
        percent: (change / previousClose) * 100,
        updatedAt: quoteTimestamp(snapshot),
        source: feed === 'overnight' ? 'Alpaca Overnight' : 'Alpaca IEX',
        status: 'real',
        session,
      };
    }
    if (!Object.keys(quotes).length) throw new Error('Alpaca returned no usable snapshot data');
    alpacaQuoteCache.set(cacheKey, { values: quotes, expiresAt: Date.now() + alpacaQuoteCacheTtlMs });
    return quotes;
  } catch (error) {
    if (cached) return markAlpacaCached(cached.values);
    throw error;
  }
}

const fallbackTreasuryQuotes: Record<string, TreasuryQuote> = {
  US2Y: { value: 4.1, change: 0.01, percent: 0, source: '模拟数据', updatedAt: 0, dataDate: '' },
  US10Y: { value: 4.25, change: -0.02, percent: 0, source: '模拟数据', updatedAt: 0, dataDate: '' },
  US30Y: { value: 4.48, change: -0.01, percent: 0, source: '模拟数据', updatedAt: 0, dataDate: '' },
};

const fallbackCryptoQuotes: Record<string, Quote> = {
  bitcoin: { symbol: 'BTC', value: 65000, change: 420, percent: 0.65, updatedAt: 0, source: '模拟数据' },
  ethereum: { symbol: 'ETH', value: 3200, change: -18, percent: -0.56, updatedAt: 0, source: '模拟数据' },
};

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`Request timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function withServerCache<T>(cache: Map<string, ServerCacheEntry<T>>, key: string, ttlMs: number, fetcher: () => Promise<T>) {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.values;
  try {
    const values = await fetcher();
    cache.set(key, { values, expiresAt: Date.now() + ttlMs });
    return values;
  } catch (error) {
    if (cached) return cached.values;
    throw error;
  }
}

async function fetchYahooQuote(symbol: string): Promise<Quote> {
  return withServerCache(quoteCache, `yahoo:${symbol}`, marketQuoteCacheTtlMs, async () => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`;
    const response = await fetchWithTimeout(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (personal-market-dashboard)' },
    }, marketRequestTimeoutMs);
    if (!response.ok) throw new Error(`Yahoo Finance responded with ${response.status}`);

    const data = (await response.json()) as YahooChartResponse;
    const meta = data.chart?.result?.[0]?.meta;
    const value = meta?.regularMarketPrice;
    const previous = meta?.chartPreviousClose ?? meta?.previousClose;
    if (typeof value !== 'number' || typeof previous !== 'number' || previous === 0) {
      throw new Error('Yahoo Finance returned incomplete quote data');
    }

    return {
      symbol,
      value,
      change: value - previous,
      percent: ((value - previous) / previous) * 100,
      previousClose: previous,
      updatedAt: (meta?.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000,
      source: 'Yahoo Finance',
    };
  });
}

async function fetchFinnhubQuote(symbol: string, apiKey: string): Promise<Quote> {
  return withServerCache(quoteCache, `finnhub:${symbol}`, marketQuoteCacheTtlMs, async () => {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${encodeURIComponent(apiKey)}`;
    const response = await fetchWithTimeout(url, { cache: 'no-store' }, marketRequestTimeoutMs);
    if (!response.ok) throw new Error(`Finnhub responded with ${response.status}`);

    const data = (await response.json()) as FinnhubResponse;
    if (typeof data.c !== 'number' || typeof data.d !== 'number' || typeof data.dp !== 'number' || data.c === 0) {
      throw new Error('Finnhub returned incomplete quote data');
    }

    const previousClose = data.c - data.d;
    return {
      symbol,
      value: data.c,
      change: data.d,
      percent: data.dp,
      previousClose: previousClose > 0 ? previousClose : undefined,
      updatedAt: (data.t ?? Math.floor(Date.now() / 1000)) * 1000,
      source: 'Finnhub',
    };
  });
}

async function fetchTreasuryQuotes(): Promise<Record<string, TreasuryQuote>> {
  return withServerCache(treasuryCache, 'treasury:daily-yield-curve', treasuryCacheTtlMs, async () => {
  const year = new Date().getUTCFullYear();
  const parser = new XMLParser({ removeNSPrefix: true, isArray: (name) => name === 'entry' });
  const responses = await Promise.all([year, year - 1].map((item) => fetchWithTimeout(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${item}`, { cache: 'no-store' }, officialDataTimeoutMs)));
  if (responses.some((response) => !response.ok)) throw new Error('US Treasury request failed');
  const rows = (await Promise.all(responses.map((response) => response.text()))).flatMap((xml) => {
    const parsed = parser.parse(xml) as { feed?: { entry?: Array<{ content?: { properties?: Record<string, unknown> } }> } };
    return (parsed.feed?.entry ?? []).map((entry) => entry.content?.properties ?? {});
  }).map((properties) => ({
    date: typeof properties.NEW_DATE === 'string' ? properties.NEW_DATE.slice(0, 10) : '',
    values: Object.fromEntries(treasurySymbols.map((symbol) => [symbol, Number(properties[treasuryFields[symbol]])])),
  })).filter((row) => row.date && treasurySymbols.every((symbol) => Number.isFinite(row.values[symbol]))).sort((left, right) => right.date.localeCompare(left.date));
  if (rows.length < 2) throw new Error('US Treasury returned insufficient trading days');
  const [latest, previous] = rows;
  return Object.fromEntries(treasurySymbols.map((symbol) => [symbol, {
    value: latest.values[symbol],
    change: latest.values[symbol] - previous.values[symbol],
    percent: 0,
    source: 'US Treasury',
    updatedAt: Date.parse(`${latest.date}T00:00:00Z`),
    dataDate: latest.date,
  }]));
  });
}

async function fetchCryptoQuotes(): Promise<Record<string, Quote>> {
  return withServerCache(cryptoCache, 'coinbase:stats', cryptoCacheTtlMs, async () => {
  const quotes = await Promise.all(cryptoSymbols.map(async (symbol) => {
    const productId = symbol === 'bitcoin' ? 'BTC-USD' : 'ETH-USD';
    const response = await fetchWithTimeout(`https://api.exchange.coinbase.com/products/${productId}/stats`, { cache: 'no-store' }, marketRequestTimeoutMs);
    if (!response.ok) throw new Error(`Coinbase responded with ${response.status}`);

    const data = (await response.json()) as CoinbaseStatsResponse;
    const value = Number(data.last);
    const open = Number(data.open);
    if (!Number.isFinite(value) || !Number.isFinite(open) || value <= 0 || open <= 0) {
      throw new Error('Coinbase returned incomplete data');
    }

    const change = value - open;
    return [symbol, {
      symbol: symbol === 'bitcoin' ? 'BTC' : 'ETH',
      value,
      change,
      percent: (change / open) * 100,
      updatedAt: Date.now(),
      source: 'Coinbase',
    }] as const;
  }));

  return Object.fromEntries(quotes);
  });
}

function toNumber(value: string | undefined) {
  if (!value) return Number.NaN;
  return Number(value.replace(/[$,%\s,]/g, ''));
}

function withMacroCache(key: string, fetchMacro: () => Promise<Record<string, MacroQuote>>) {
  return withServerCache(macroCache, key, macroCacheTtlMs, fetchMacro);
}

function makeMacroQuote(values: Array<{ value: number; referencePeriod: string }>, source: string, unit: MacroQuote['unit']) {
  if (values.length < 2) throw new Error('Insufficient macro observations');
  const [latest, previous] = values;
  return { value: latest.value, change: latest.value - previous.value, referencePeriod: latest.referencePeriod, source, updatedAt: Date.now(), unit };
}

async function fetchBlsMacro(apiKey: string) {
  return withMacroCache('bls', async () => {
    const seriesDefinitions = [
      { id: 'CUSR0000SA0', key: 'cpi', unit: 'index' as const },
      { id: 'CUSR0000SA0L1E', key: 'coreCpi', unit: 'index' as const },
      { id: 'CES0000000001', key: 'nonfarmPayrolls', unit: 'thousands' as const },
      { id: 'LNS14000000', key: 'unemploymentRate', unit: 'percent' as const },
    ];
    const response = await fetchWithTimeout('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'global-market-dashboard/1.0',
      },
      body: JSON.stringify({ seriesid: seriesDefinitions.map((series) => series.id), registrationkey: apiKey }),
    }, officialDataTimeoutMs);
    if (!response.ok) throw new Error(`BLS responded with ${response.status}`);
    const data = (await response.json()) as BlsResponse;
    if (data.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS request failed: ${(data.message ?? [data.status ?? 'unknown error']).join('; ')}`);
    const result: Record<string, MacroQuote> = {};
    for (const definition of seriesDefinitions) {
      const series = data.Results?.series?.find((item) => item.seriesID === definition.id);
      const values = (series?.data ?? []).filter((item) => /^M(0[1-9]|1[0-2])$/.test(item.period ?? '')).map((item) => ({
        value: toNumber(item.value),
        referencePeriod: `${item.periodName ?? item.period} ${item.year ?? ''}`.trim(),
        sortKey: `${item.year ?? ''}${item.period ?? ''}`,
      })).filter((item) => Number.isFinite(item.value)).sort((left, right) => right.sortKey.localeCompare(left.sortKey));
      result[definition.key] = makeMacroQuote(values, 'BLS', definition.unit);
    }
    return result;
  });
}

function beaValues(rows: BeaRow[] | undefined, matches: (description: string) => boolean) {
  const matchingRows = (rows ?? []).filter((row) => matches(row.LineDescription?.trim() ?? ''));
  return matchingRows.map((row) => ({
    value: toNumber(row.DataValue),
    referencePeriod: row.TimePeriod ?? '',
  })).filter((row) => Number.isFinite(row.value) && row.referencePeriod).sort((left, right) => right.referencePeriod.localeCompare(left.referencePeriod));
}

async function fetchBeaTable(apiKey: string, tableName: string, frequency: 'M' | 'Q') {
  const url = new URL('https://apps.bea.gov/api/data');
  url.search = new URLSearchParams({ UserID: apiKey, method: 'GetData', datasetname: 'NIPA', TableName: tableName, Frequency: frequency, Year: 'X', ResultFormat: 'JSON' }).toString();
  const response = await fetchWithTimeout(url, { cache: 'no-store' }, officialDataTimeoutMs);
  if (!response.ok) throw new Error(`BEA responded with ${response.status}`);
  const data = (await response.json()) as BeaResponse;
  const rows = data.BEAAPI?.Results?.Data;
  if (!rows?.length) throw new Error('BEA returned no data');
  return rows;
}

async function fetchBeaPceMacro(apiKey: string) {
  return withMacroCache('bea-pce', async () => {
    const rows = await fetchBeaTable(apiKey, 'T20804', 'M');
    return {
      pce: makeMacroQuote(beaValues(rows, (description) => /^Personal consumption expenditures(?: \(PCE\))?$/i.test(description)), 'BEA', 'index'),
      corePce: makeMacroQuote(beaValues(rows, (description) => /(excluding|less) food and energy/i.test(description)), 'BEA', 'index'),
    };
  });
}

async function fetchBeaGdpMacro(apiKey: string) {
  return withMacroCache('bea-gdp', async () => {
    const rows = await fetchBeaTable(apiKey, 'T10105', 'Q');
    return {
      gdp: makeMacroQuote(beaValues(rows, (description) => /^Gross domestic product$/i.test(description)), 'BEA', 'billions'),
    };
  });
}

async function fetchEffectiveFedFundsRate() {
  return withMacroCache('h15-effective-fed-funds', async () => {
    const url = 'https://www.federalreserve.gov/datadownload/Output.aspx?rel=H15&series=RIFSPFF_N.D&lastobs=&from=&to=&filetype=csv&label=include&layout=seriescolumn&type=package';
    const response = await fetchWithTimeout(url, { cache: 'no-store' }, officialDataTimeoutMs);
    if (!response.ok) throw new Error(`Federal Reserve Board responded with ${response.status}`);
    const observations = (await response.text()).split(/\r?\n/).map((line) => line.replace(/"/g, '').split(',')).filter((cells) => /^\d{4}-\d{2}-\d{2}$/.test(cells[0] ?? '')).map((cells) => ({ value: toNumber(cells.at(-1)), referencePeriod: cells[0] })).filter((item) => Number.isFinite(item.value)).sort((left, right) => right.referencePeriod.localeCompare(left.referencePeriod));
    return { effectiveFedFundsRate: makeMacroQuote(observations, 'Federal Reserve Board H.15', 'percent') };
  });
}

async function fetchMacroData(blsApiKey?: string, beaApiKey?: string) {
  const macro: Record<string, MacroQuote> = { ...fallbackMacro };
  const errors: string[] = [];
  const requests: Array<Promise<void>> = [];
  if (blsApiKey) {
    requests.push(fetchBlsMacro(blsApiKey).then((values) => { Object.assign(macro, values); }).catch((error: unknown) => {
      recordProviderFailure('BLS', error);
      errors.push(safeErrorMessage('BLS'));
    }));
  } else {
    errors.push(safeConfigurationMessage('BLS'));
  }
  if (beaApiKey) {
    requests.push(fetchBeaPceMacro(beaApiKey).then((values) => { Object.assign(macro, values); }).catch((error: unknown) => {
      recordProviderFailure('BEA PCE', error);
      errors.push(safeErrorMessage('BEA PCE'));
    }));
    requests.push(fetchBeaGdpMacro(beaApiKey).then((values) => { Object.assign(macro, values); }).catch((error: unknown) => {
      recordProviderFailure('BEA GDP', error);
      errors.push(safeErrorMessage('BEA GDP'));
    }));
  } else {
    errors.push(safeConfigurationMessage('BEA'));
  }
  requests.push(fetchEffectiveFedFundsRate().then((values) => { Object.assign(macro, values); }).catch((error: unknown) => {
    recordProviderFailure('Federal Reserve Board H.15', error);
    errors.push(safeErrorMessage('Federal Reserve Board H.15'));
  }));
  await Promise.all(requests);
  return { macro, errors };
}

function getHistoryRequest(range: HistoryRange) {
  const now = Math.floor(Date.now() / 1000);
  if (range === '1D') return { yahooRange: '1d', yahooInterval: '5m', coinbaseGranularity: 300, from: now - 86_400 };
  if (range === '1W') return { yahooRange: '5d', yahooInterval: '30m', coinbaseGranularity: 3600, from: now - 7 * 86_400 };
  if (range === '1M') return { yahooRange: '1mo', yahooInterval: '1d', coinbaseGranularity: 21_600, from: now - 31 * 86_400 };
  return { yahooRange: 'ytd', yahooInterval: '1d', coinbaseGranularity: 86_400, from: Math.floor(Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000) };
}

function sampleHistory(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  if (valid.length <= maxHistoryPoints) return valid;
  const step = (valid.length - 1) / (maxHistoryPoints - 1);
  return Array.from({ length: maxHistoryPoints }, (_, index) => valid[Math.round(index * step)]);
}

async function withHistoryCache(key: string, fetchHistory: () => Promise<number[]>) {
  return withServerCache(historyCache, key, historyCacheTtlMs, async () => {
    const values = await fetchHistory();
    if (values.length < 2) throw new Error('Insufficient historical data');
    return values;
  });
}

async function fetchYahooHistory(symbol: string, range: HistoryRange) {
  const request = getHistoryRequest(range);
  return withHistoryCache(`yahoo:${symbol}:${range}`, async () => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${request.yahooRange}&interval=${request.yahooInterval}`;
    const response = await fetchWithTimeout(url, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0 (personal-market-dashboard)' } }, historyRequestTimeoutMs);
    if (!response.ok) throw new Error(`Yahoo Finance responded with ${response.status}`);
    const data = (await response.json()) as YahooChartResponse;
    return sampleHistory(data.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []);
  });
}

async function fetchCoinbaseHistory(symbol: 'bitcoin' | 'ethereum', range: HistoryRange) {
  const request = getHistoryRequest(range);
  const productId = symbol === 'bitcoin' ? 'BTC-USD' : 'ETH-USD';
  return withHistoryCache(`coinbase:${symbol}:${range}`, async () => {
    const end = Math.floor(Date.now() / 1000);
    const candles: Array<[number, number, number, number, number, number]> = [];
    const maxCandlesPerRequest = 299;
    for (let start = request.from; start < end; start += maxCandlesPerRequest * request.coinbaseGranularity) {
      const chunkEnd = Math.min(end, start + maxCandlesPerRequest * request.coinbaseGranularity);
      const url = `https://api.exchange.coinbase.com/products/${productId}/candles?granularity=${request.coinbaseGranularity}&start=${new Date(start * 1000).toISOString()}&end=${new Date(chunkEnd * 1000).toISOString()}`;
      const response = await fetchWithTimeout(url, { cache: 'no-store' }, historyRequestTimeoutMs);
      if (!response.ok) throw new Error(`Coinbase responded with ${response.status}`);
      const chunk = (await response.json()) as Array<[number, number, number, number, number, number]>;
      candles.push(...chunk);
    }
    return sampleHistory(candles.sort((left, right) => left[0] - right[0]).map((candle) => candle[4]));
  });
}

async function fetchHistories(tasks: HistoryTask[], range: HistoryRange) {
  const history: Record<string, number[]> = {};
  let nextTask = 0;
  const failures: Array<{ symbol: string; provider: HistoryTask['provider']; category: string; status?: number }> = [];
  const workers = Array.from({ length: Math.min(4, tasks.length) }, async () => {
    while (nextTask < tasks.length) {
      const task = tasks[nextTask++];
      try {
        if (task.provider === 'yahoo') {
          history[task.symbol] = await fetchYahooHistory(task.symbol, range);
        } else {
          history[task.symbol] = await fetchCoinbaseHistory(task.symbol as 'bitcoin' | 'ethereum', range);
        }
      } catch (error) {
        const details = sanitizeProviderError(error);
        failures.push({ symbol: task.symbol, provider: task.provider, category: details.category, ...(details.status ? { status: details.status } : {}) });
        recordProviderFailure(task.provider === 'yahoo' ? 'Yahoo Finance historical' : 'Coinbase historical', error, { symbol: task.symbol });
      }
    }
  });
  await Promise.all(workers);
  return { history, failures };
}

export async function GET(request: Request) {
  const quotes: Record<string, Quote> = {};
  let treasury: Record<string, TreasuryQuote> = {};
  let crypto: Record<string, Quote> = {};
  const errors: string[] = [];
  const searchParams = new URL(request.url).searchParams;
  const requestedRange = searchParams.get('range');
  const range: HistoryRange = requestedRange === '1W' || requestedRange === '1M' || requestedRange === 'YTD' ? requestedRange : '1D';
  const requestedSymbols = searchParams.get('symbols')?.split(',') ?? defaultFinnhubSymbols;
  const watchlistSymbols = [...new Set(requestedSymbols.map((symbol) => symbol.trim().toUpperCase()).filter((symbol) => symbolPattern.test(symbol)))].slice(0, maxFinnhubSymbols);
  const equitySymbols = [...new Set([...alpacaSymbols, ...watchlistSymbols])];

  const finnhubKey = process.env.FINNHUB_API_KEY;
  const alpacaKey = process.env.ALPACA_API_KEY_ID;
  const alpacaSecret = process.env.ALPACA_API_SECRET_KEY;
  let macroResult = { macro: { ...fallbackMacro }, errors: [] as string[] };

  const yahooTask = Promise.all(yahooSymbols.map(async (symbol) => {
    try {
      quotes[symbol] = await fetchYahooQuote(symbol);
    } catch (error) {
      quotes[symbol] = getFallbackQuote(symbol);
      recordProviderFailure('Yahoo Finance', error, { symbol });
      errors.push(safeErrorMessage('Yahoo Finance'));
    }
  }));

  const equityTask = (async () => {
    if (alpacaKey && alpacaSecret) {
      try {
        Object.assign(quotes, await fetchAlpacaSnapshots(alpacaKey, alpacaSecret));
      } catch (error) {
        recordProviderFailure('Alpaca', error);
        errors.push(safeErrorMessage('Alpaca market'));
      }
    } else {
      errors.push(safeConfigurationMessage('Alpaca'));
    }

    const remainingAfterAlpaca = equitySymbols.filter((symbol) => !quotes[symbol]);
    if (remainingAfterAlpaca.length && finnhubKey) {
      await Promise.all(remainingAfterAlpaca.map(async (symbol) => {
        try {
          const quote = await fetchFinnhubQuote(symbol, finnhubKey);
          quotes[symbol] = { ...quote, status: 'fallback', session: newYorkSession() };
        } catch (error) {
          recordProviderFailure('Finnhub', error, { symbol });
        }
      }));
    } else if (remainingAfterAlpaca.length) {
      errors.push(safeConfigurationMessage('Finnhub'));
    }

    const remainingAfterFinnhub = equitySymbols.filter((symbol) => !quotes[symbol]);
    if (remainingAfterFinnhub.length) {
      await Promise.all(remainingAfterFinnhub.map(async (symbol) => {
        try {
          const quote = await fetchYahooQuote(symbol);
          quotes[symbol] = { ...quote, status: 'fallback', session: newYorkSession() };
        } catch (error) {
          recordProviderFailure('Yahoo Finance', error, { symbol });
          quotes[symbol] = getFallbackQuote(symbol);
        }
      }));
      if (remainingAfterFinnhub.some((symbol) => !quotes[symbol]?.updatedAt)) errors.push(safeErrorMessage('Equity market'));
    }
  })();

  const treasuryTask = fetchTreasuryQuotes()
    .then((values) => { treasury = values; })
    .catch((error) => {
      treasury = fallbackTreasuryQuotes;
      recordProviderFailure('US Treasury', error);
      errors.push(safeErrorMessage('US Treasury'));
    });

  const cryptoTask = fetchCryptoQuotes()
    .then((values) => { crypto = values; })
    .catch((error) => {
      crypto = fallbackCryptoQuotes;
      recordProviderFailure('Coinbase', error);
      errors.push(safeErrorMessage('Coinbase BTC ETH'));
    });

  const macroTask = fetchMacroData(process.env.BLS_API_KEY, process.env.BEA_API_KEY)
    .then((result) => { macroResult = result; })
    .catch((error) => {
      recordProviderFailure('Macro', error);
      errors.push(safeErrorMessage('Macro'));
    });

  await Promise.all([yahooTask, equityTask, treasuryTask, cryptoTask, macroTask]);

  const historyTasks: HistoryTask[] = [
    ...[...new Set([...yahooSymbols, ...equitySymbols])].map((symbol) => ({ symbol, provider: 'yahoo' as const })),
    ...cryptoSymbols.filter((symbol) => crypto[symbol]?.source === 'Coinbase').map((symbol) => ({ symbol, provider: 'coinbase' as const })),
  ];
  const { history, failures: historyFailures } = await fetchHistories(historyTasks, range);
  if (historyFailures.length > 0) errors.push('Some historical data is unavailable; preserving the fallback chart');
  errors.push(...macroResult.errors);
  const updatedValues = [...Object.values(quotes), ...Object.values(treasury), ...Object.values(crypto)].map((quote) => quote.updatedAt).filter(Boolean);
  return NextResponse.json({
    quotes,
    treasury,
    crypto,
    history,
    macro: macroResult.macro,
    errors,
    fetchedAt: updatedValues.length ? Math.max(...updatedValues) : Date.now(),
  });
}

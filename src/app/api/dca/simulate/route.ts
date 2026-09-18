import { NextResponse } from 'next/server';
import type { DcaCurvePoint, DcaPurchase, DcaSimulationResponse, DcaSimulationResult } from '../../../dca/simulation';

type AlpacaBar = { t?: string; c?: number };
type DailyBar = { date: string; time: number; close: number };
type CacheEntry = { expiresAt: number; bars: DailyBar[] };
type AssetRequest = { symbol: string; type: 'Stock' | 'ETF' };
type BenchmarkId = 'sp500' | 'nasdaq' | 'hang-seng' | 'csi300';
type UnavailableResult = NonNullable<DcaSimulationResponse['unavailable']>[number];

const historyCache = new Map<string, CacheEntry>();
const historyCacheTtlMs = 30 * 60_000;
const tickerPattern = /^[A-Z][A-Z0-9.-]{0,9}$/;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const benchmarks: Record<BenchmarkId, { symbol: string; name: string; providerSymbol?: string }> = {
  sp500: { symbol: 'SPX', name: 'S&P 500' },
  nasdaq: { symbol: 'IXIC', name: 'Nasdaq Composite' },
  'hang-seng': { symbol: 'HSI', name: 'Hang Seng Index', providerSymbol: 'hkHSI' },
  csi300: { symbol: 'CSI300', name: 'CSI 300', providerSymbol: 'sh000300' },
};

function response(body: DcaSimulationResponse, status = 200) {
  return NextResponse.json(body, { status });
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function utcDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function addDays(value: string, days: number) {
  const date = utcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function firstMonday(month: string) {
  const first = utcDate(`${month}-01`);
  const offset = (8 - first.getUTCDay()) % 7;
  first.setUTCDate(first.getUTCDate() + offset);
  return isoDate(first);
}

function mondayOnOrBefore(value: string) {
  const date = utcDate(value);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return isoDate(date);
}

function normalizeBars(input: AlpacaBar[]) {
  const unique = new Map<string, DailyBar>();
  for (const bar of input) {
    if (!bar.t || typeof bar.c !== 'number' || !Number.isFinite(bar.c) || bar.c <= 0) continue;
    const time = Date.parse(bar.t);
    if (!Number.isFinite(time)) continue;
    const date = isoDate(new Date(time));
    unique.set(date, { date, time, close: bar.c });
  }
  return [...unique.values()].sort((left, right) => left.time - right.time);
}

async function fetchWithTimeout(url: URL, headers: HeadersInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    return await fetch(url, { cache: 'no-store', headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAlpacaDailyBars(symbol: string, startDate: string, endDate: string, apiKey: string, secret: string) {
  const cacheKey = `${symbol}:${startDate}:${endDate}`;
  const cached = historyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.bars;

  const collected: AlpacaBar[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 8; page += 1) {
    const url = new URL('https://data.alpaca.markets/v2/stocks/bars');
    url.search = new URLSearchParams({
      symbols: symbol,
      timeframe: '1Day',
      start: `${startDate}T00:00:00Z`,
      end: `${endDate}T23:59:59Z`,
      limit: '10000',
      feed: 'iex',
      adjustment: 'split',
      sort: 'asc',
      ...(pageToken ? { page_token: pageToken } : {}),
    }).toString();
    const upstream = await fetchWithTimeout(url, {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': secret,
    });
    if (!upstream.ok) throw new Error(`Alpaca historical request failed with status ${upstream.status}`);
    const payload = await upstream.json() as { bars?: Record<string, AlpacaBar[]>; next_page_token?: string | null };
    collected.push(...(payload.bars?.[symbol] ?? []));
    pageToken = payload.next_page_token ?? undefined;
    if (!pageToken) break;
  }

  const bars = normalizeBars(collected);
  if (!bars.length) throw new Error('Alpaca returned no daily history for this ticker');
  historyCache.set(cacheKey, { bars, expiresAt: Date.now() + historyCacheTtlMs });
  return bars;
}

async function fetchTencentBenchmark(providerSymbol: string, startDate: string, endDate: string) {
  const cacheKey = `benchmark:${providerSymbol}:${startDate}:${endDate}`;
  const cached = historyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.bars;
  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  const collected: DailyBar[] = [];
  // Tencent caps a response near one trading year. Annual windows stay below that limit and are
  // deliberately sequential, so one benchmark never creates a burst of upstream requests.
  for (let year = startYear; year <= endYear; year += 1) {
    const from = year === startYear ? startDate : `${year}-01-01`;
    const to = year === endYear ? endDate : `${year}-12-31`;
    const url = new URL('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get');
    url.search = new URLSearchParams({ param: `${providerSymbol},day,${from},${to},320,qfq` }).toString();
    const upstream = await fetchWithTimeout(url, {});
    if (!upstream.ok) throw new Error(`Tencent benchmark request failed with status ${upstream.status}`);
    const payload = await upstream.json() as { data?: Record<string, { day?: string[][]; qfqday?: string[][] }> };
    const rows = payload.data?.[providerSymbol]?.day ?? payload.data?.[providerSymbol]?.qfqday ?? [];
    for (const row of rows) {
      const date = row[0]; const close = Number(row[2]);
      const time = date ? Date.parse(`${date}T00:00:00Z`) : Number.NaN;
      if (date && Number.isFinite(time) && Number.isFinite(close) && close > 0) collected.push({ date, time, close });
    }
  }
  const unique = new Map(collected.map((bar) => [bar.date, bar]));
  const bars = [...unique.values()].sort((left, right) => left.time - right.time);
  if (!bars.length) throw new Error('Tencent returned no benchmark history');
  historyCache.set(cacheKey, { bars, expiresAt: Date.now() + historyCacheTtlMs });
  return bars;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

// Maximum drawdown uses a contribution-adjusted unitized index. Each deposit buys new fund units at
// the current unit NAV, so external cash flows cannot create gains or drawdowns. Daily market moves
// change the index; contributions only change the number of units. This is equivalent to a daily
// time-weighted return series for this single-asset DCA portfolio.
function simulate(symbol: string, name: string, type: DcaSimulationResult['type'], startMonth: string, weeklyInvestment: number, bars: DailyBar[], source: DcaSimulationResult['source'], priceBasis: string): DcaSimulationResult {
  const requestedStart = `${startMonth}-01`;
  const requestedMonday = firstMonday(startMonth);
  const endDate = isoDate(new Date());
  const eligibleBars = bars.filter((bar) => bar.date >= requestedStart && bar.date <= endDate);
  if (!eligibleBars.length) throw new Error('Insufficient historical data for the selected period');

  const purchases: DcaPurchase[] = [];
  const curve: DcaCurvePoint[] = [];
  let totalInvested = 0;
  let totalShares = 0;
  // Skip contributions before listing/provider coverage, but once the simulation is live retain
  // every weekly schedule. If an exchange is closed for an entire week, queued contributions execute
  // together on the next real trading day instead of silently disappearing.
  let scheduledDate = eligibleBars[0].date > requestedMonday ? mondayOnOrBefore(eligibleBars[0].date) : requestedMonday;
  let unitIndex = 100;
  let peakUnitIndex = 100;
  let maximumDrawdown = 0;
  let previousClose: number | null = null;

  for (const bar of eligibleBars) {
    // Price moves before the first contribution do not belong to the simulated portfolio.
    if (totalShares > 0 && previousClose !== null) unitIndex *= bar.close / previousClose;

    while (scheduledDate <= bar.date) {
      const shares = weeklyInvestment / bar.close;
      purchases.push({ scheduledDate, executionDate: bar.date, price: bar.close, amount: weeklyInvestment, shares });
      totalInvested += weeklyInvestment;
      totalShares += shares;
      scheduledDate = addDays(scheduledDate, 7);
    }

    if (totalShares > 0) {
      peakUnitIndex = Math.max(peakUnitIndex, unitIndex);
      maximumDrawdown = Math.min(maximumDrawdown, unitIndex / peakUnitIndex - 1);
      curve.push({ date: bar.date, portfolioValue: totalShares * bar.close, totalInvested, normalizedValue: unitIndex });
    }
    previousClose = bar.close;
  }

  if (!purchases.length || !curve.length) throw new Error('Insufficient historical data to execute a weekly purchase');
  const latest = eligibleBars.at(-1)!;
  const currentValue = totalShares * latest.close;
  const totalProfit = currentValue - totalInvested;
  const actualStartDate = purchases[0].executionDate;

  return {
    symbol,
    name,
    type,
    requestedStartMonth: startMonth,
    actualStartDate,
    endDate,
    historicalStartDate: eligibleBars[0].date,
    valuationDate: latest.date,
    weeklyInvestment,
    totalInvested,
    currentValue,
    totalProfit,
    totalReturnPercent: totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0,
    maximumDrawdownPercent: maximumDrawdown * 100,
    totalPurchases: purchases.length,
    totalShares,
    averageCost: totalShares > 0 ? totalInvested / totalShares : 0,
    latestPrice: latest.close,
    source,
    priceBasis,
    historyLimited: eligibleBars[0].date > requestedMonday,
    curve,
    purchases,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { symbol?: unknown; assets?: unknown; benchmarks?: unknown; startMonth?: unknown; weeklyInvestment?: unknown };
    const legacySymbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : '';
    const requestedAssets = Array.isArray(body.assets) ? body.assets : legacySymbol ? [{ symbol: legacySymbol, type: 'Stock' }] : [];
    const assets: AssetRequest[] = requestedAssets.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const candidate = item as { symbol?: unknown; type?: unknown };
      const symbol = typeof candidate.symbol === 'string' ? candidate.symbol.trim().toUpperCase() : '';
      const type = candidate.type === 'ETF' ? 'ETF' : candidate.type === 'Stock' ? 'Stock' : null;
      return tickerPattern.test(symbol) && type ? [{ symbol, type } satisfies AssetRequest] : [];
    }).filter((item, index, list) => list.findIndex((candidate) => candidate.symbol === item.symbol) === index).slice(0, 10);
    const benchmarkIds = (Array.isArray(body.benchmarks) ? body.benchmarks : []).filter((item): item is BenchmarkId => typeof item === 'string' && item in benchmarks).slice(0, 4);
    const startMonth = typeof body.startMonth === 'string' ? body.startMonth : '';
    const weeklyInvestment = typeof body.weeklyInvestment === 'number' ? body.weeklyInvestment : Number(body.weeklyInvestment);
    const currentMonth = isoDate(new Date()).slice(0, 7);
    if (!assets.length && !benchmarkIds.length) return response({ result: null, error: 'Select at least one supported asset or benchmark.' }, 400);
    if (!monthPattern.test(startMonth) || startMonth > currentMonth) return response({ result: null, error: 'Select a valid start month that is not in the future.' }, 400);
    if (!Number.isFinite(weeklyInvestment) || weeklyInvestment <= 0 || weeklyInvestment > 1_000_000) return response({ result: null, error: 'Weekly investment must be a positive amount.' }, 400);

    const apiKey = process.env.ALPACA_API_KEY_ID;
    const secret = process.env.ALPACA_API_SECRET_KEY;
    if (assets.length && (!apiKey || !secret)) return response({ result: null, error: 'Alpaca Market Data is not configured.' }, 503);

    const endDate = isoDate(new Date());
    const tasks: Array<{ key: string; run: () => Promise<DcaSimulationResult>; unavailable?: UnavailableResult }> = [
      ...assets.map((asset) => ({
        key: asset.symbol,
        run: async () => simulate(asset.symbol, asset.symbol, asset.type, startMonth, weeklyInvestment, await fetchAlpacaDailyBars(asset.symbol, `${startMonth}-01`, endDate, apiKey!, secret!), 'Alpaca Market Data', 'Split-adjusted daily close; dividends excluded'),
      })),
      ...benchmarkIds.map((id) => {
        const benchmark = benchmarks[id];
        if (!benchmark.providerSymbol) return { key: benchmark.symbol, unavailable: { symbol: benchmark.symbol, name: benchmark.name, type: 'Benchmark' as const, reason: 'Reliable real index history is unavailable; no ETF proxy was used.' }, run: async () => { throw new Error('unavailable'); } };
        return {
          key: benchmark.symbol,
          run: async () => simulate(benchmark.symbol, benchmark.name, 'Benchmark', startMonth, weeklyInvestment, await fetchTencentBenchmark(benchmark.providerSymbol!, `${startMonth}-01`, endDate), 'Tencent Finance', 'Official index daily close; benchmark simulation only'),
        };
      }),
    ];
    const availableTasks = tasks.filter((task) => !task.unavailable);
    const unavailable: UnavailableResult[] = tasks.flatMap((task) => task.unavailable ? [task.unavailable] : []);
    const completed = await mapWithConcurrency(availableTasks, 4, async (task) => {
      try { return { result: await task.run() }; }
      catch { return { unavailable: { symbol: task.key, name: task.key, type: assets.some((asset) => asset.symbol === task.key) ? assets.find((asset) => asset.symbol === task.key)!.type : 'Benchmark' as const, reason: 'Real historical data is unavailable for the selected period.' } }; }
    });
    const results = completed.flatMap((item) => item.result ? [item.result] : []);
    unavailable.push(...completed.flatMap((item) => item.unavailable ? [item.unavailable] : []));
    return response({ result: results[0] ?? null, results, unavailable });
  } catch (error) {
    const message = error instanceof Error && /Insufficient historical data|Alpaca returned no daily history/.test(error.message)
      ? 'Insufficient historical data for this simulation.'
      : 'Real historical data is temporarily unavailable. No simulation was generated.';
    console.warn('DCA simulation failed', { category: error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'upstream' });
    return response({ result: null, error: message }, 200);
  }
}

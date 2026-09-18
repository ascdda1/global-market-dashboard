import { NextResponse } from 'next/server';

type Frequency = 'weekly' | 'biweekly' | 'monthly';
type PlanRequest = {
  id: string;
  symbol: string;
  startDate: string;
  amount: number;
  frequency: Frequency;
};
type AlpacaBar = { t?: string; c?: number };
type DailyBar = { date: string; time: number; close: number };
type Execution = {
  planId: string;
  symbol: string;
  scheduledDate: string;
  executionDate: string;
  amount: number;
  price: number;
  shares: number;
};
type PlanSummary = {
  planId: string;
  symbol: string;
  executedCount: number;
  invested: number;
  nextScheduledDate: string;
  nextState: 'future' | 'waiting-close' | 'scheduled';
  lastExecutionDate?: string;
};
type CacheEntry = { expiresAt: number; bars: DailyBar[] };

const tickerPattern = /^[A-Z][A-Z0-9.-]{0,9}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const cache = new Map<string, CacheEntry>();
const cacheTtlMs = 15 * 60_000;
const maxPlans = 30;
const maxExecutionsPerPlan = 2000;

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

function addMonthFromAnchor(value: string, anchorDay: number) {
  const current = utcDate(value);
  const year = current.getUTCFullYear();
  const month = current.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return isoDate(new Date(Date.UTC(year, month, Math.min(anchorDay, lastDay))));
}

function nextScheduleDate(value: string, frequency: Frequency, anchorDay: number) {
  if (frequency === 'weekly') return addDays(value, 7);
  if (frequency === 'biweekly') return addDays(value, 14);
  return addMonthFromAnchor(value, anchorDay);
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

async function fetchDailyBars(symbol: string, startDate: string, endDate: string, apiKey: string, secret: string) {
  const cacheKey = `${symbol}:${startDate}:${endDate}`;
  const cached = cache.get(cacheKey);
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

    const response = await fetchWithTimeout(url, {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': secret,
    });
    if (!response.ok) throw new Error(`Alpaca historical request failed with status ${response.status}`);
    const payload = await response.json() as { bars?: Record<string, AlpacaBar[]>; next_page_token?: string | null };
    collected.push(...(payload.bars?.[symbol] ?? []));
    pageToken = payload.next_page_token ?? undefined;
    if (!pageToken) break;
  }

  const bars = normalizeBars(collected);
  cache.set(cacheKey, { bars, expiresAt: Date.now() + cacheTtlMs });
  return bars;
}

function scheduleDates(plan: PlanRequest, throughDate: string) {
  const dates: string[] = [];
  const anchorDay = Number(plan.startDate.slice(8, 10));
  let current = plan.startDate;
  let guard = 0;
  while (current <= throughDate && guard < maxExecutionsPerPlan) {
    dates.push(current);
    current = nextScheduleDate(current, plan.frequency, anchorDay);
    guard += 1;
  }
  return { dates, nextDate: current };
}

function settlePlan(plan: PlanRequest, bars: DailyBar[], today: string) {
  const { dates, nextDate: futureNextDate } = scheduleDates(plan, today);
  const executions: Execution[] = [];
  let barIndex = 0;
  let firstUnsettled: string | null = null;

  for (const scheduledDate of dates) {
    while (barIndex < bars.length && bars[barIndex].date < scheduledDate) barIndex += 1;
    const bar = bars[barIndex];
    if (!bar || bar.date > today) {
      firstUnsettled = scheduledDate;
      break;
    }
    const shares = plan.amount / bar.close;
    executions.push({
      planId: plan.id,
      symbol: plan.symbol,
      scheduledDate,
      executionDate: bar.date,
      amount: plan.amount,
      price: bar.close,
      shares,
    });
  }

  const nextScheduledDate = firstUnsettled ?? futureNextDate;
  const nextState: PlanSummary['nextState'] =
    nextScheduledDate > today ? 'future' :
    nextScheduledDate === today ? 'waiting-close' :
    'scheduled';

  return {
    executions,
    summary: {
      planId: plan.id,
      symbol: plan.symbol,
      executedCount: executions.length,
      invested: executions.reduce((sum, execution) => sum + execution.amount, 0),
      nextScheduledDate,
      nextState,
      lastExecutionDate: executions.at(-1)?.executionDate,
    } satisfies PlanSummary,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { plans?: unknown };
    const rawPlans = Array.isArray(body.plans) ? body.plans : [];
    const today = isoDate(new Date());

    const plans: PlanRequest[] = rawPlans.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const candidate = item as Partial<PlanRequest>;
      const id = typeof candidate.id === 'string' ? candidate.id.slice(0, 80) : '';
      const symbol = typeof candidate.symbol === 'string' ? candidate.symbol.trim().toUpperCase() : '';
      const startDate = typeof candidate.startDate === 'string' ? candidate.startDate : '';
      const amount = Number(candidate.amount);
      const frequency = candidate.frequency;
      if (!id || !tickerPattern.test(symbol) || !datePattern.test(startDate)) return [];
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return [];
      if (frequency !== 'weekly' && frequency !== 'biweekly' && frequency !== 'monthly') return [];
      if (startDate < '2000-01-01') return [];
      return [{ id, symbol, startDate, amount, frequency } satisfies PlanRequest];
    }).slice(0, maxPlans);

    if (!plans.length) {
      return NextResponse.json({ executions: [], plans: [], asOf: today, source: 'Alpaca Market Data' });
    }

    const apiKey = process.env.ALPACA_API_KEY_ID;
    const secret = process.env.ALPACA_API_SECRET_KEY;
    if (!apiKey || !secret) {
      return NextResponse.json({ error: 'Alpaca Market Data is not configured.' }, { status: 503 });
    }

    const grouped = new Map<string, PlanRequest[]>();
    for (const plan of plans) {
      grouped.set(plan.symbol, [...(grouped.get(plan.symbol) ?? []), plan]);
    }

    const allExecutions: Execution[] = [];
    const summaries: PlanSummary[] = [];

    await Promise.all([...grouped.entries()].map(async ([symbol, symbolPlans]) => {
      const earliest = symbolPlans.map((plan) => plan.startDate).sort()[0];
      const needsHistory = earliest <= today;
      const bars = needsHistory ? await fetchDailyBars(symbol, earliest, today, apiKey, secret) : [];
      for (const plan of symbolPlans) {
        const settled = settlePlan(plan, bars, today);
        allExecutions.push(...settled.executions);
        summaries.push(settled.summary);
      }
    }));

    allExecutions.sort((left, right) =>
      left.executionDate.localeCompare(right.executionDate) ||
      left.symbol.localeCompare(right.symbol)
    );

    return NextResponse.json({
      executions: allExecutions,
      plans: summaries,
      asOf: today,
      source: 'Alpaca Market Data',
      priceBasis: 'Actual split-adjusted daily close; weekend/holiday schedules execute on the next available trading-day close.',
    });
  } catch {
    return NextResponse.json(
      { error: 'Scheduled purchases could not be reconciled with real market closes.' },
      { status: 502 },
    );
  }
}

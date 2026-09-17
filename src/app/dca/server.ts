import type { ApiQuote } from '../market-data';

type InitialRow = { symbol: string; initial_shares: string | number; initial_average_cost: string | number; initial_cost: string | number };
type PlanRow = { symbol: string; weekly_amount: string | number; frequency: 'weekly'; weekday: number; start_date: string; enabled: boolean };
type TransactionRow = { id: string; scheduled_date: string; execution_date: string; symbol: string; amount: string | number; close_price: string | number; shares_added: string | number; price_source: string; created_at: string };
export type DcaPosition = { symbol: string; initialShares: number; totalShares: number; averageCost: number; totalInvested: number; weeklyAmount: number };
export type DcaTransaction = { id: string; scheduledDate: string; executionDate: string; symbol: string; amount: number; closePrice: number; sharesAdded: number; totalShares: number; averageCost: number; priceSource: string; createdAt: string };
export type DcaResponse = { configured: boolean; positions: DcaPosition[]; transactions: DcaTransaction[]; weeklyTotal: number; nextDcaDate: string | null; error?: string };

const tableUrl = (table: string, query = '') => `${process.env.SUPABASE_URL?.replace(/\/$/, '')}/rest/v1/${table}${query}`;
function configured() { return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY); }
function number(value: string | number) { return typeof value === 'number' ? value : Number(value); }
function headers(prefer?: string) { return { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) }; }

async function supabase<T>(table: string, init: RequestInit = {}, query = ''): Promise<T> {
  const response = await fetch(tableUrl(table, query), { ...init, cache: 'no-store', headers: { ...headers(), ...init.headers } });
  if (!response.ok) throw new Error(`Supabase responded with ${response.status}`);
  return response.json() as Promise<T>;
}

function easternDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function toDate(date: string) { return new Date(`${date}T00:00:00Z`); }
function dateString(date: Date) { return date.toISOString().slice(0, 10); }
function addDays(date: string, days: number) { const result = toDate(date); result.setUTCDate(result.getUTCDate() + days); return dateString(result); }
function nextScheduledDate(plans: PlanRow[], today: string) { const starts = plans.filter((plan) => plan.enabled).map((plan) => plan.start_date).sort(); if (!starts.length) return null; let candidate = starts[0]; while (candidate <= today) candidate = addDays(candidate, 7); return candidate; }

function calculatePositions(initial: InitialRow[], plans: PlanRow[], transactions: TransactionRow[]) {
  const planBySymbol = new Map(plans.map((plan) => [plan.symbol, plan]));
  const ordered = [...transactions].sort((left, right) => `${left.execution_date}${left.created_at}`.localeCompare(`${right.execution_date}${right.created_at}`));
  const state = new Map(initial.map((row) => [row.symbol, { shares: number(row.initial_shares), cost: number(row.initial_cost) }]));
  const transactionView = ordered.map((row) => {
    const position = state.get(row.symbol);
    if (!position) throw new Error('DCA transaction references an unknown symbol');
    position.shares += number(row.shares_added); position.cost += number(row.amount);
    return { id: row.id, scheduledDate: row.scheduled_date, executionDate: row.execution_date, symbol: row.symbol, amount: number(row.amount), closePrice: number(row.close_price), sharesAdded: number(row.shares_added), totalShares: position.shares, averageCost: position.cost / position.shares, priceSource: row.price_source, createdAt: row.created_at } satisfies DcaTransaction;
  });
  const positions = initial.map((row) => { const result = state.get(row.symbol)!; return { symbol: row.symbol, initialShares: number(row.initial_shares), totalShares: result.shares, averageCost: result.cost / result.shares, totalInvested: result.cost, weeklyAmount: number(planBySymbol.get(row.symbol)?.weekly_amount ?? 0) } satisfies DcaPosition; });
  return { positions, transactionView };
}

export async function getDcaData(): Promise<DcaResponse> {
  if (!configured()) return { configured: false, positions: [], transactions: [], weeklyTotal: 0, nextDcaDate: null, error: 'DCA simulation database is not configured.' };
  const [initial, plans, transactions] = await Promise.all([
    supabase<InitialRow[]>('dca_positions_initial', {}, '?select=symbol,initial_shares,initial_average_cost,initial_cost&order=symbol'),
    supabase<PlanRow[]>('dca_plan', {}, '?select=symbol,weekly_amount,frequency,weekday,start_date,enabled&order=symbol'),
    supabase<TransactionRow[]>('dca_transactions', {}, '?select=id,scheduled_date,execution_date,symbol,amount,close_price,shares_added,price_source,created_at&order=execution_date.asc,created_at.asc'),
  ]);
  const calculated = calculatePositions(initial, plans, transactions);
  return { configured: true, positions: calculated.positions, transactions: [...calculated.transactionView].reverse(), weeklyTotal: plans.filter((plan) => plan.enabled).reduce((sum, plan) => sum + number(plan.weekly_amount), 0), nextDcaDate: nextScheduledDate(plans, easternDate()) };
}

type YahooDailyResponse = { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> | null } };
async function officialClose(symbol: string, scheduledDate: string, today: string) {
  const period1 = Math.floor(toDate(scheduledDate).getTime() / 1000); const period2 = Math.floor(toDate(addDays(scheduledDate, 14)).getTime() / 1000);
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d`, { cache: 'no-store', headers: { 'User-Agent': 'global-market-dashboard/1.0' } });
  if (!response.ok) throw new Error(`Yahoo Finance responded with ${response.status}`);
  const payload = await response.json() as YahooDailyResponse; const result = payload.chart?.result?.[0]; const closes = result?.indicators?.quote?.[0]?.close ?? [];
  for (let index = 0; index < (result?.timestamp?.length ?? 0); index += 1) {
    const close = closes[index]; const date = easternDate(new Date((result?.timestamp?.[index] ?? 0) * 1000));
    if (date >= scheduledDate && date <= today && typeof close === 'number' && Number.isFinite(close) && close > 0) return { close, executionDate: date };
  }
  return null;
}

function dueDates(startDate: string, today: string) { const dates: string[] = []; for (let candidate = startDate; candidate <= today; candidate = addDays(candidate, 7)) dates.push(candidate); return dates; }
export async function runDcaSimulation() {
  if (!configured()) throw new Error('DCA simulation database is not configured');
  const today = easternDate();
  const [plans, existing] = await Promise.all([supabase<PlanRow[]>('dca_plan', {}, '?select=symbol,weekly_amount,frequency,weekday,start_date,enabled'), supabase<TransactionRow[]>('dca_transactions', {}, '?select=id,scheduled_date,execution_date,symbol,amount,close_price,shares_added,price_source,created_at')]);
  const known = new Set(existing.map((transaction) => `${transaction.symbol}:${transaction.scheduled_date}`)); const created: Array<{ symbol: string; scheduledDate: string; executionDate: string }> = []; const pending: Array<{ symbol: string; scheduledDate: string }> = [];
  for (const plan of plans.filter((item) => item.enabled)) for (const scheduledDate of dueDates(plan.start_date, today)) {
    if (known.has(`${plan.symbol}:${scheduledDate}`)) continue;
    const close = await officialClose(plan.symbol, scheduledDate, today).catch(() => null);
    if (!close) { pending.push({ symbol: plan.symbol, scheduledDate }); continue; }
    const sharesAdded = Number((number(plan.weekly_amount) / close.close).toFixed(6));
    const inserted = await fetch(tableUrl('dca_transactions', '?on_conflict=symbol,scheduled_date'), { method: 'POST', cache: 'no-store', headers: headers('resolution=ignore-duplicates,return=representation'), body: JSON.stringify({ scheduled_date: scheduledDate, execution_date: close.executionDate, symbol: plan.symbol, amount: number(plan.weekly_amount), close_price: close.close, shares_added: sharesAdded, price_source: 'Yahoo Finance daily official close' }) });
    if (!inserted.ok) throw new Error(`Supabase transaction insert failed with ${inserted.status}`);
    const rows = await inserted.json() as TransactionRow[];
    if (rows.length) created.push({ symbol: plan.symbol, scheduledDate, executionDate: close.executionDate });
  }
  return { created, pending };
}

export function calculateDcaMarketSummary(positions: DcaPosition[], quotes: Record<string, ApiQuote>) {
  return positions.reduce((summary, position) => { const quote = quotes[position.symbol]; const marketValue = quote ? quote.value * position.totalShares : 0; summary.totalInvested += position.totalInvested; summary.portfolioValue += marketValue; return summary; }, { totalInvested: 0, portfolioValue: 0 });
}

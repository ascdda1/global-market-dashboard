import { NextResponse } from 'next/server';

type NavPoint = { date: string; value: number };
type PeriodKey = 'ytd' | 'y1' | 'y3' | 'y5';

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
}

function parseHistory(raw: string): NavPoint[] {
  const rows = [...raw.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const points: NavPoint[] = [];
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => stripTags(m[1]));
    if (cells.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(cells[0])) continue;
    const unit = Number(cells[1]);
    const cumulative = Number(cells[2]);
    const value = Number.isFinite(cumulative) && cumulative > 0 ? cumulative : unit;
    if (Number.isFinite(value) && value > 0) points.push({ date: cells[0], value });
  }
  return points.sort((a,b)=>a.date.localeCompare(b.date));
}

function targetDate(period: PeriodKey, latest: Date) {
  const d = new Date(latest);
  if (period === 'ytd') return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  d.setUTCFullYear(d.getUTCFullYear() - (period === 'y1' ? 1 : period === 'y3' ? 3 : 5));
  return d;
}

function slicePeriod(points: NavPoint[], period: PeriodKey) {
  if (!points.length) return [];
  const latest = new Date(points[points.length - 1].date + 'T00:00:00Z');
  const target = targetDate(period, latest);
  const targetText = target.toISOString().slice(0,10);
  const start = points.findIndex(p => p.date >= targetText);
  return points.slice(start < 0 ? 0 : start);
}

function sample(points: NavPoint[], maxPoints = 34) {
  if (points.length <= maxPoints) return points;
  const out: NavPoint[] = [];
  for (let i=0;i<maxPoints;i++) {
    const idx = Math.round(i * (points.length - 1) / (maxPoints - 1));
    out.push(points[idx]);
  }
  return out;
}

function periodResult(points: NavPoint[], period: PeriodKey) {
  const sliced = slicePeriod(points, period);
  if (sliced.length < 2) return { returnPct: null as number | null, series: [] as NavPoint[] };
  const first = sliced[0].value;
  const last = sliced[sliced.length - 1].value;
  const returnPct = first > 0 ? ((last / first) - 1) * 100 : null;
  return { returnPct, series: sample(sliced) };
}

async function fetchFund(code: string) {
  const now = new Date();
  const start = new Date(now);
  start.setUTCFullYear(start.getUTCFullYear() - 5);
  start.setUTCDate(start.getUTCDate() - 14);
  const sdate = start.toISOString().slice(0,10);
  const edate = now.toISOString().slice(0,10);
  const url = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${encodeURIComponent(code)}&page=1&per=2000&sdate=${sdate}&edate=${edate}`;
  const response = await fetch(url, {
    headers: { Referer: `https://fundf10.eastmoney.com/jjjz_${code}.html`, 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 21600 },
  });
  if (!response.ok) throw new Error(`history ${response.status}`);
  const points = parseHistory(await response.text());
  const latest = points.at(-1)?.date ?? null;
  return {
    code,
    latest,
    ytd: periodResult(points, 'ytd'),
    y1: periodResult(points, 'y1'),
    y3: periodResult(points, 'y3'),
    y5: periodResult(points, 'y5'),
  };
}

async function mapLimit<T,R>(items: T[], limit: number, fn: (item:T)=>Promise<R>) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
  return results;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const codes = [...new Set((searchParams.get('codes') ?? '').split(',').map(v=>v.trim()).filter(v=>/^\d{6}$/.test(v)))].slice(0,60);
  if (!codes.length) return NextResponse.json({ funds: [] });

  const funds = await mapLimit(codes, 8, async code => {
    try { return await fetchFund(code); }
    catch { return { code, latest:null, ytd:{returnPct:null,series:[]}, y1:{returnPct:null,series:[]}, y3:{returnPct:null,series:[]}, y5:{returnPct:null,series:[]} }; }
  });
  return NextResponse.json({ funds, source: 'Eastmoney / 天天基金', generatedAt: new Date().toISOString() });
}

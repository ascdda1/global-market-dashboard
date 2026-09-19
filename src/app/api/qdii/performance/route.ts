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

function parsePingzhongdata(raw: string): NavPoint[] {
  const ac = raw.match(/var\s+Data_ACWorthTrend\s*=\s*(\[[\s\S]*?\]);/);
  if (ac) {
    try {
      const rows = JSON.parse(ac[1]) as [number, number][];
      const points = rows
        .filter(row => Array.isArray(row) && Number.isFinite(row[0]) && Number.isFinite(row[1]) && row[1] > 0)
        .map(row => ({ date: new Date(row[0]).toISOString().slice(0,10), value: Number(row[1]) }));
      if (points.length > 1) return points.sort((a,b)=>a.date.localeCompare(b.date));
    } catch {}
  }

  const nw = raw.match(/var\s+Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);
  if (nw) {
    try {
      const rows = JSON.parse(nw[1]) as {x:number;y:number}[];
      const points = rows
        .filter(row => Number.isFinite(row?.x) && Number.isFinite(row?.y) && row.y > 0)
        .map(row => ({ date: new Date(row.x).toISOString().slice(0,10), value: Number(row.y) }));
      if (points.length > 1) return points.sort((a,b)=>a.date.localeCompare(b.date));
    } catch {}
  }
  return [];
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

  // Strict-period rule: if the fund did not exist at the beginning of the
  // requested window, the metric is not applicable. Never substitute a
  // shorter "since inception" period for YTD/1Y/3Y/5Y.
  if (points[0].date > targetText) return [];

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

type RiskStats = {
  maxDrawdownPct: number|null;
  recoveryDays: number|null;
  recoveryStatus: 'recovered'|'unrecovered'|'not_applicable';
  sharpe: number|null;
};

function threeYearRisk(points: NavPoint[]): RiskStats {
  const sliced = slicePeriod(points, 'y3');
  if (sliced.length < 2) return { maxDrawdownPct:null, recoveryDays:null, recoveryStatus:'not_applicable', sharpe:null };

  let peakValue = sliced[0].value;
  let peakIndex = 0;
  let maxDrawdown = 0;
  let troughIndex = 0;
  let drawdownPeakIndex = 0;

  for (let i=1;i<sliced.length;i++) {
    const value = sliced[i].value;
    if (value > peakValue) {
      peakValue = value;
      peakIndex = i;
    }
    const drawdown = value / peakValue - 1;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
      troughIndex = i;
      drawdownPeakIndex = peakIndex;
    }
  }

  let recoveryIndex = -1;
  const recoveryLevel = sliced[drawdownPeakIndex]?.value ?? sliced[0].value;
  for (let i=troughIndex+1;i<sliced.length;i++) {
    if (sliced[i].value >= recoveryLevel) {
      recoveryIndex = i;
      break;
    }
  }

  const dayDiff = (a:string,b:string) => Math.max(0, Math.round((new Date(b+'T00:00:00Z').getTime()-new Date(a+'T00:00:00Z').getTime())/86400000));
  const recoveryDays = recoveryIndex >= 0
    ? dayDiff(sliced[troughIndex].date, sliced[recoveryIndex].date)
    : dayDiff(sliced[troughIndex].date, sliced[sliced.length-1].date);

  const returns:number[] = [];
  for (let i=1;i<sliced.length;i++) {
    const prev=sliced[i-1].value, cur=sliced[i].value;
    if (prev > 0 && cur > 0) returns.push(cur/prev-1);
  }
  let sharpe:number|null = null;
  if (returns.length > 30) {
    const mean = returns.reduce((a,b)=>a+b,0)/returns.length;
    const variance = returns.reduce((a,b)=>a+(b-mean)**2,0)/(returns.length-1);
    const sd = Math.sqrt(variance);
    if (sd > 0) sharpe = mean / sd * Math.sqrt(252);
  }

  return {
    maxDrawdownPct: maxDrawdown * 100,
    recoveryDays,
    recoveryStatus: recoveryIndex >= 0 ? 'recovered' : 'unrecovered',
    sharpe,
  };
}

function periodResult(points: NavPoint[], period: PeriodKey) {
  const sliced = slicePeriod(points, period);
  if (sliced.length < 2) return { returnPct: null as number | null, series: [] as NavPoint[] };
  const first = sliced[0].value;
  const last = sliced[sliced.length - 1].value;
  const returnPct = first > 0 ? ((last / first) - 1) * 100 : null;
  return { returnPct, series: sample(sliced) };
}

type StageReturns = { ytd:number|null; y1:number|null; y3:number|null; y5:number|null };

async function fetchStageReturns(code: string): Promise<StageReturns> {
  const params = new URLSearchParams({
    pageIndex: '1',
    pageSize: '200',
    plat: 'Android',
    appType: 'ttjj',
    product: 'EFund',
    Version: '1',
    deviceid: '1234567890',
    Fcode: code,
  });
  const response = await fetch(`https://fundmobapi.eastmoney.com/FundMNewApi/FundMNPeriodIncrease?${params.toString()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: `https://fund.eastmoney.com/${code}.html` },
    next: { revalidate: 21600 },
  });
  if (!response.ok) throw new Error(`stage returns ${response.status}`);
  const json = await response.json() as { Datas?: { title?:string; syl?:string|number|null }[] };
  const map = Object.fromEntries((json.Datas ?? []).map(row => [row.title, row.syl]));
  const toNumber = (value: string|number|null|undefined) => {
    if (value == null || value === '' || value === '--') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  return {
    ytd: toNumber(map.JN),
    y1: toNumber(map['1N']),
    y3: toNumber(map['3N']),
    y5: toNumber(map['5N']),
  };
}

async function fetchScale(code: string) {
  const response = await fetch(`https://fundf10.eastmoney.com/jbgk_${code}.html`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 86400 },
  });
  if (!response.ok) return { scale: null as string|null, scaleDate: null as string|null };
  const text = stripTags(await response.text()).replace(/\s+/g, ' ');
  const match = text.match(/净资产规模\s*[:：]?\s*([0-9.]+亿元)（截止至[:：]?\s*(\d{4}年\d{2}月\d{2}日)）/);
  if (!match) return { scale: null as string|null, scaleDate: null as string|null };
  return { scale: match[1], scaleDate: match[2].replace(/年|月/g,'-').replace('日','') };
}

async function fetchFund(code: string) {
  const now = new Date();
  const start = new Date(now);
  start.setUTCFullYear(start.getUTCFullYear() - 5);
  start.setUTCDate(start.getUTCDate() - 14);
  const sdate = start.toISOString().slice(0,10);
  const edate = now.toISOString().slice(0,10);

  const primaryUrl = `https://fund.eastmoney.com/pingzhongdata/${encodeURIComponent(code)}.js?v=${Date.now()}`;
  const fallbackUrl = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${encodeURIComponent(code)}&page=1&per=2000&sdate=${sdate}&edate=${edate}`;

  const [primary, scaleInfo, stageReturns] = await Promise.all([
    fetch(primaryUrl, {
      headers: { Referer: `https://fund.eastmoney.com/${code}.html`, 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 21600 },
    }).catch(()=>null),
    fetchScale(code),
    fetchStageReturns(code).catch(()=>({ ytd:null, y1:null, y3:null, y5:null })),
  ]);

  let points: NavPoint[] = [];
  if (primary?.ok) points = parsePingzhongdata(await primary.text());

  if (points.length < 2) {
    const fallback = await fetch(fallbackUrl, {
      headers: { Referer: `https://fundf10.eastmoney.com/jjjz_${code}.html`, 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 21600 },
    }).catch(()=>null);
    if (fallback?.ok) points = parseHistory(await fallback.text());
  }

  if (points.length < 2) throw new Error('No usable NAV history');
  const cutoff = sdate;
  points = points.filter(point => point.date >= cutoff);
  const latest = points.at(-1)?.date ?? null;
  const risk3y = threeYearRisk(points);
  return {
    code,
    latest,
    scale: scaleInfo.scale,
    scaleDate: scaleInfo.scaleDate,
    ytd: { returnPct: stageReturns.ytd, series: [] },
    y1: { returnPct: stageReturns.y1, series: [] },
    y3: { returnPct: stageReturns.y3, series: [] },
    y5: { returnPct: stageReturns.y5, series: [] },
    risk3y,
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
    catch { return { code, latest:null, scale:null, scaleDate:null, ytd:{returnPct:null,series:[]}, y1:{returnPct:null,series:[]}, y3:{returnPct:null,series:[]}, y5:{returnPct:null,series:[]}, risk3y:{maxDrawdownPct:null,recoveryDays:null,recoveryStatus:'not_applicable',sharpe:null} }; }
  });
  return NextResponse.json({ funds, source: 'Eastmoney / 天天基金阶段涨幅接口', generatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } });
}

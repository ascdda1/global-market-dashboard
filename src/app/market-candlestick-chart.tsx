'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AreaSeries, ColorType, CrosshairMode, createChart, type ISeriesApi, type LineData, type UTCTimestamp } from 'lightweight-charts';

export type LongRange = '1Y' | '3Y' | '5Y' | '10Y';
type Bar = { time: number; open: number; high: number; low: number; close: number };
type HistoryPayload = { bars?: Bar[]; status?: 'real' | 'cache' | 'unavailable'; provider?: string; liveCompatible?: boolean };
const years: Record<LongRange, number> = { '1Y': 1, '3Y': 3, '5Y': 5, '10Y': 10 };
const historyResponses = new Map<string, HistoryPayload>();
const historyRequests = new Map<string, Promise<HistoryPayload>>();

function historyKey(symbol: string, range: LongRange) { return `${symbol}:${range}`; }

function loadHistory(symbol: string, range: LongRange) {
  const key = historyKey(symbol, range);
  const cached = historyResponses.get(key);
  if (cached) return Promise.resolve(cached);
  const existing = historyRequests.get(key);
  if (existing) return existing;
  const request = fetch(`/api/market/history?symbol=${encodeURIComponent(symbol)}&range=${range}`)
    .then((response) => response.ok ? response.json() as Promise<HistoryPayload> : Promise.reject(new Error('History request failed')))
    .then((data) => {
      if (data.status !== 'unavailable' && (data.bars?.length ?? 0) > 1) historyResponses.set(key, data);
      return data;
    })
    .finally(() => historyRequests.delete(key));
  historyRequests.set(key, request);
  return request;
}

export async function preloadMarketHistories(symbols: string[], range: LongRange, concurrency = 12) {
  const queue = [...new Set(symbols)].filter(Boolean);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < queue.length) {
      const symbol = queue[nextIndex++];
      try {
        await loadHistory(symbol, range);
      } catch {
        // Individual charts can retry unavailable histories later.
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => worker()));
}

function startFor(range: LongRange) { const date = new Date(); date.setUTCFullYear(date.getUTCFullYear() - years[range]); return Math.floor(date.getTime() / 1000); }
function normalizeBars(input: Bar[]) {
  const unique = new Map<number, Bar>();
  for (const bar of input) {
    if (![bar.time, bar.open, bar.high, bar.low, bar.close].every(Number.isFinite) || bar.time <= 0 || bar.close <= 0) continue;
    unique.set(bar.time, bar);
  }
  return [...unique.values()].sort((left, right) => left.time - right.time);
}

export default function MarketTrendChart({ symbol, range, onRange, livePrice, liveUpdatedAt, deepHistoryReady = false }: { symbol: string; range: LongRange; onRange: (range: LongRange) => void; livePrice?: number; liveUpdatedAt?: number; deepHistoryReady?: boolean }) {
  const isTreasuryYield = symbol === 'US10Y';
  const host = useRef<HTMLDivElement>(null); const seriesRef = useRef<ISeriesApi<'Area'> | null>(null); const [visible, setVisible] = useState(false); const [bars, setBars] = useState<Bar[]>([]); const [status, setStatus] = useState<'loading' | 'real' | 'cache' | 'unavailable'>('loading'); const [liveCompatible, setLiveCompatible] = useState(true); const [hover, setHover] = useState<{ time: number; value: number } | null>(null);
  useEffect(() => { const node = host.current; if (!node) return; const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { rootMargin: '160px' }); observer.observe(node); return () => observer.disconnect(); }, []);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const requestedRange: LongRange = deepHistoryReady || range !== '1Y' ? '10Y' : '1Y';
    setStatus('loading');
    loadHistory(symbol, requestedRange).then((data) => {
      if (cancelled) return;
      const normalized = normalizeBars(data.bars ?? []);
      const closes = normalized.map((bar) => bar.close);
      const min = closes.length ? Math.min(...closes) : 0;
      const max = closes.length ? Math.max(...closes) : 0;
      const meaningfulVariation = normalized.length > 1 && min > 0 && (max - min) / min > 0.0001;
      setBars(meaningfulVariation ? normalized : []);
      setLiveCompatible(data.liveCompatible !== false);
      setStatus(meaningfulVariation ? data.status ?? 'unavailable' : 'unavailable');
    }).catch(() => {
      if (!cancelled) { setBars([]); setLiveCompatible(false); setStatus('unavailable'); }
    });
    return () => { cancelled = true; };
  }, [deepHistoryReady, range, symbol, visible]);
  const displayBars = useMemo(() => {
    if (!liveCompatible || !bars.length || typeof livePrice !== 'number' || !Number.isFinite(livePrice) || livePrice <= 0) return bars;
    const next = bars.map((bar) => ({ ...bar }));
    const last = next.at(-1)!;
    const quoteDate = new Date(liveUpdatedAt ?? Date.now()).toISOString().slice(0, 10);
    const lastDate = new Date(last.time * 1000).toISOString().slice(0, 10);
    if (quoteDate < lastDate) return next;
    const quoteTime = Date.parse(`${quoteDate}T00:00:00Z`);
    const lastTime = Date.parse(`${lastDate}T00:00:00Z`);
    const scaleRatio = livePrice / last.close;
    if (quoteTime - lastTime > 10 * 86_400_000 || scaleRatio < 0.5 || scaleRatio > 2) return next;
    if (quoteDate === lastDate) {
      next[next.length - 1] = { ...last, close: livePrice, high: Math.max(last.high, livePrice), low: Math.min(last.low, livePrice) };
    } else {
      next.push({ time: Math.floor(Date.parse(`${quoteDate}T00:00:00Z`) / 1000), open: last.close, high: Math.max(last.close, livePrice), low: Math.min(last.close, livePrice), close: livePrice });
    }
    return next;
  }, [bars, liveCompatible, livePrice, liveUpdatedAt]);
  const analyses = useMemo(() => Object.fromEntries((Object.keys(years) as LongRange[]).map((item) => { const target = startFor(item); const subset = displayBars.filter((bar) => bar.time >= target); const first = subset[0]; const last = subset.at(-1); const gapDays = first ? (first.time - target) / 86_400 : Number.POSITIVE_INFINITY; const enough = !!first && !!last && subset.length > 1 && gapDays >= 0 && gapDays <= 14; const value = enough ? isTreasuryYield ? (last!.close - first!.close) * 100 : (last!.close / first!.close - 1) * 100 : null; return [item, { subset, target, gapDays, enough, value }]; })) as Record<LongRange, { subset: Bar[]; target: number; gapDays: number; enough: boolean; value: number | null }>, [displayBars, isTreasuryYield]);
  const returns = useMemo(() => Object.fromEntries((Object.keys(years) as LongRange[]).map((item) => [item, analyses[item].value])) as Record<LongRange, number | null>, [analyses]);
  const historicalShown = useMemo(() => bars.filter((bar) => bar.time >= startFor(range)), [bars, range]);
  const shown = useMemo(() => displayBars.filter((bar) => bar.time >= startFor(range)), [displayBars, range]);
  useEffect(() => { if (process.env.NODE_ENV !== 'development') return; const analysis = analyses[range]; console.debug('[market-history]', { ticker: symbol, selectedRange: range, totalBars: displayBars.length, firstBarDate: displayBars[0] ? new Date(displayBars[0].time * 1000).toISOString().slice(0, 10) : null, lastBarDate: displayBars.at(-1) ? new Date(displayBars.at(-1)!.time * 1000).toISOString().slice(0, 10) : null, targetStartDate: new Date(analysis.target * 1000).toISOString().slice(0, 10), rangeFirstDate: analysis.subset[0] ? new Date(analysis.subset[0].time * 1000).toISOString().slice(0, 10) : null, historyGapDays: Number.isFinite(analysis.gapDays) ? Number(analysis.gapDays.toFixed(2)) : null, hasEnoughHistory: analysis.enough }); }, [analyses, displayBars, range, symbol]);
  useEffect(() => { const node = host.current; if (!node || !historicalShown.length) return; const chart = createChart(node, { width: node.clientWidth, height: 190, handleScroll: false, handleScale: false, layout: { background: { type: ColorType.Solid, color: '#1b2026' }, textColor: '#8a94a3', attributionLogo: false }, grid: { vertLines: { color: '#252c35' }, horzLines: { color: '#252c35' } }, crosshair: { mode: CrosshairMode.Normal }, rightPriceScale: { borderColor: '#313a46' }, timeScale: { borderColor: '#313a46', timeVisible: false, fixLeftEdge: true, fixRightEdge: true } }); const positive = historicalShown.at(-1)!.close >= historicalShown[0].close; const series = chart.addSeries(AreaSeries, { lineColor: positive ? '#22c55e' : '#ef4444', topColor: positive ? '#22c55e35' : '#ef444435', bottomColor: '#1b202600', lineWidth: 2 }); series.setData(historicalShown.map((bar) => ({ time: bar.time as UTCTimestamp, value: bar.close })) as LineData[]); seriesRef.current = series; chart.timeScale().fitContent(); chart.subscribeCrosshairMove((param) => { const point = param.seriesData.get(series) as LineData | undefined; setHover(point ? { time: Number(point.time), value: point.value } : null); }); const observer = new ResizeObserver(() => { chart.applyOptions({ width: node.clientWidth }); chart.timeScale().fitContent(); }); observer.observe(node); return () => { seriesRef.current = null; observer.disconnect(); chart.remove(); }; }, [historicalShown]);
  useEffect(() => { const series = seriesRef.current; const historicalLast = historicalShown.at(-1); const currentLast = shown.at(-1); if (!series || !historicalLast || !currentLast) return; if (currentLast.time !== historicalLast.time || currentLast.close !== historicalLast.close) series.update({ time: currentLast.time as UTCTimestamp, value: currentLast.close }); }, [historicalShown, shown]);
  const first = shown[0], last = shown.at(-1); const insufficient = returns[range] === null;
  return <div className="professional-chart"><div className="long-range-tabs">{(Object.keys(years) as LongRange[]).map((item) => <button className={range === item ? 'selected' : ''} key={item} onClick={() => onRange(item)} type="button"><b>{item}</b><small>{returns[item] === null ? 'N/A' : isTreasuryYield ? `${returns[item]! >= 0 ? '+' : ''}${returns[item]!.toFixed(0)} bp` : `${returns[item]! >= 0 ? '+' : ''}${returns[item]!.toFixed(2)}%`}</small></button>)}</div><div className="chart-ohlc">{hover ? `${new Date(hover.time * 1000).toLocaleDateString()} · ${hover.value.toFixed(2)}` : status === 'loading' ? '正在加载长期走势… / Loading history…' : status === 'unavailable' || !bars.length ? '历史走势暂不可用 / Historical data unavailable' : insufficient ? 'Insufficient history / 历史数据不足' : first && last ? `${new Date(first.time * 1000).toLocaleDateString()} — ${new Date(last.time * 1000).toLocaleDateString()}` : '历史走势暂不可用 / Historical data unavailable'}</div><div className="chart-host" ref={host} /></div>;
}

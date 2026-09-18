'use client';

import { ColorType, CrosshairMode, createChart, LineSeries, LineStyle, type LineData, type UTCTimestamp } from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DcaSimulationResult } from './simulation';

export type ComparisonView = 'normalized' | 'value';
const palette = ['#22c55e', '#60a5fa', '#f59e0b', '#a78bfa', '#f472b6', '#2dd4bf', '#fb7185', '#38bdf8', '#a3e635', '#f97316'];
const benchmarkColors: Record<string, string> = { SPX: '#d1d5db', IXIC: '#93c5fd', HSI: '#fbbf24', CSI300: '#f87171' };

function colorFor(result: DcaSimulationResult) {
  if (result.type === 'Benchmark') return benchmarkColors[result.symbol] ?? '#94a3b8';
  let hash = 0;
  for (const character of result.symbol) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

export default function DcaChart({ results, view, visible, onToggle }: { results: DcaSimulationResult[]; view: ComparisonView; visible: Set<string>; onToggle: (symbol: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const active = useMemo(() => results.filter((result) => visible.has(result.symbol)), [results, visible]);

  useEffect(() => {
    const node = host.current;
    if (!node || active.length === 0) return;
    const chart = createChart(node, { width: node.clientWidth, height: 360, handleScroll: false, handleScale: false, layout: { background: { type: ColorType.Solid, color: '#1b2026' }, textColor: '#9ca6b5', attributionLogo: false }, grid: { vertLines: { color: '#252c35' }, horzLines: { color: '#252c35' } }, crosshair: { mode: CrosshairMode.Normal }, rightPriceScale: { borderColor: '#313a46' }, timeScale: { borderColor: '#313a46', fixLeftEdge: true, fixRightEdge: true, timeVisible: false } });
    for (const result of active) {
      const series = chart.addSeries(LineSeries, { color: colorFor(result), lineWidth: result.type === 'Benchmark' ? 1 : 2, lineStyle: result.type === 'Benchmark' ? LineStyle.Dashed : LineStyle.Solid, priceLineVisible: false, lastValueVisible: false });
      series.setData(result.curve.map((point) => ({ time: Math.floor(Date.parse(`${point.date}T00:00:00Z`) / 1000) as UTCTimestamp, value: view === 'normalized' ? point.normalizedValue : point.portfolioValue })) as LineData[]);
    }
    chart.timeScale().fitContent();
    chart.subscribeCrosshairMove((parameter) => setHoverDate(parameter.time ? new Date(Number(parameter.time) * 1000).toISOString().slice(0, 10) : null));
    const observer = new ResizeObserver(() => { chart.applyOptions({ width: node.clientWidth }); chart.timeScale().fitContent(); });
    observer.observe(node);
    return () => { observer.disconnect(); chart.remove(); };
  }, [active, view]);

  return <div className="dca-chart-shell"><div className="dca-chart-readout"><span>{hoverDate ?? (view === 'normalized' ? '所有曲线从 100 开始 · All series start at 100' : '每个标的独立定投 · Independent weekly investment per asset')}</span></div><div className="dca-chart-host" ref={host}>{active.length === 0 && <div className="dca-chart-empty">请至少选择一条可用曲线<br /><small>Select at least one available series.</small></div>}</div><div className="dca-chart-legend">{results.map((result) => <button className={visible.has(result.symbol) ? 'active' : ''} key={result.symbol} onClick={() => onToggle(result.symbol)} type="button"><i style={{ background: colorFor(result) }} /><span>{result.symbol}</span><small>{result.type}</small></button>)}</div></div>;
}

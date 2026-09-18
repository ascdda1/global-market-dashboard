'use client';

import { useEffect, useMemo, useState } from 'react';
import { assetLabels, dcaLabels } from '../bilingual-labels';
import DcaChart, { type ComparisonView } from './dca-chart';
import type { DcaSimulationResponse, DcaSimulationResult } from './simulation';
import './dca.css';
import LegalDisclaimer from '../legal-disclaimer';

type AssetChoice = { symbol: string; type: 'Stock' | 'ETF' };
type BenchmarkId = 'sp500' | 'nasdaq' | 'hang-seng' | 'csi300';
type Unavailable = NonNullable<DcaSimulationResponse['unavailable']>[number];
type SortKey = 'totalReturnPercent' | 'currentValue' | 'totalProfit' | 'maximumDrawdownPercent' | 'symbol';

const stockKey = 'longview-stocks-v4';
const etfKey = 'longview-etfs-v4';
const defaultStocks = ['NVDA', 'TSLA', 'AMZN', 'AVGO', 'MU', 'PDD', 'AAPL', 'MSFT', 'META', 'GOOGL', 'COST', 'NFLX', 'RDDT', 'BRK.B', 'AMD', 'INTC', 'TSM', 'MRVL'];
const defaultEtfs = ['QQQM', 'SPYM', 'DIA', 'SMH', 'VGT', 'SOXX', 'SPMO', 'RSP', 'SCHD', 'AVUV', 'XLK', 'XLV', 'VT', 'HACK', 'VXUS', 'VYMI', 'IGV', 'FMTM'];
const benchmarkOptions: Array<{ id: BenchmarkId; symbol: string; en: string; zh: string }> = [
  { id: 'sp500', symbol: 'SPX', en: 'S&P 500', zh: '标普500指数' },
  { id: 'nasdaq', symbol: 'IXIC', en: 'Nasdaq Composite', zh: '纳斯达克综合指数' },
  { id: 'hang-seng', symbol: 'HSI', en: 'Hang Seng Index', zh: '恒生指数' },
  { id: 'csi300', symbol: 'CSI300', en: 'CSI 300', zh: '沪深300指数' },
];
const quickAmounts = [50, 100, 200, 500, 1000];
const currentMonth = new Date().toISOString().slice(0, 7);
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const number = (value: number, digits = 4) => value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const percent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

function readSymbols(key: string, fallback: string[]) { try { const stored = JSON.parse(window.localStorage.getItem(key) ?? 'null'); return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string') : fallback; } catch { return fallback; } }
function Bilingual({ en, zh }: { en: string; zh: string }) { return <span className="dca-bilingual"><span>{zh}</span><small>{en}</small></span>; }
function Metric({ en, zh, value, tone, detail }: { en: string; zh: string; value: string; tone?: 'up' | 'down'; detail?: string }) { return <article><Bilingual en={en} zh={zh} /><strong className={tone}>{value}</strong>{detail && <small>{detail}</small>}</article>; }
function TypeLabel({ type }: { type: 'Stock' | 'ETF' | 'Benchmark' }) { return <span className="dca-type-label"><b>{type === 'Stock' ? '股票' : type === 'ETF' ? 'ETF' : '市场基准'}</b><small>{type}</small></span>; }

export default function DcaSimulationPage() {
  const [supported, setSupported] = useState<AssetChoice[]>([]);
  const [selected, setSelected] = useState<AssetChoice[]>([]);
  const [assetInput, setAssetInput] = useState('');
  const [benchmarkIds, setBenchmarkIds] = useState<BenchmarkId[]>(benchmarkOptions.map((item) => item.id));
  const [startMonth, setStartMonth] = useState('2019-08');
  const [weeklyInvestment, setWeeklyInvestment] = useState(200);
  const [results, setResults] = useState<DcaSimulationResult[]>([]);
  const [unavailable, setUnavailable] = useState<Unavailable[]>([]);
  const [detailSymbol, setDetailSymbol] = useState('');
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ComparisonView>('normalized');
  const [sortKey, setSortKey] = useState<SortKey>('totalReturnPercent');
  const [descending, setDescending] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stocks = readSymbols(stockKey, defaultStocks).map((symbol) => ({ symbol, type: 'Stock' as const }));
    const etfs = readSymbols(etfKey, defaultEtfs).map((symbol) => ({ symbol, type: 'ETF' as const }));
    const choices = [...stocks, ...etfs].filter((item, index, list) => list.findIndex((candidate) => candidate.symbol === item.symbol) === index);
    setSupported(choices);
    const defaults = ['SPYM', 'QQQM'].flatMap((symbol) => choices.find((item) => item.symbol === symbol) ?? []);
    setSelected(defaults.length ? defaults : choices.slice(0, 2));
  }, []);

  function addAsset() {
    const ticker = assetInput.trim().toUpperCase();
    const choice = supported.find((item) => item.symbol === ticker);
    if (!choice) return setError('Choose a ticker from My Stocks or My ETFs. / 请选择自选股票或 ETF。');
    if (selected.some((item) => item.symbol === ticker)) return setError(`${ticker} is already selected.`);
    if (selected.length >= 10) return setError('Up to 10 user assets are supported. / 最多选择 10 个用户标的。');
    setSelected([...selected, choice]); setAssetInput(''); setError('');
  }

  async function runComparison(event: React.FormEvent) {
    event.preventDefault();
    if (!selected.length && !benchmarkIds.length) return setError('Select at least one asset or benchmark.');
    setLoading(true); setError(''); setResults([]); setUnavailable([]);
    try {
      const response = await fetch('/api/dca/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assets: selected, benchmarks: benchmarkIds, startMonth, weeklyInvestment }) });
      const payload = await response.json() as DcaSimulationResponse;
      if (payload.error && !payload.results?.length) throw new Error(payload.error);
      const nextResults = payload.results ?? [];
      setResults(nextResults); setUnavailable(payload.unavailable ?? []);
      setDetailSymbol(nextResults[0]?.symbol ?? '');
      setVisible(new Set(nextResults.filter((result) => result.type !== 'Benchmark' || result.symbol === 'SPX' || result.symbol === 'IXIC').map((result) => result.symbol)));
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Comparison failed'); }
    finally { setLoading(false); }
  }

  const sortedResults = useMemo(() => [...results].sort((left, right) => { const a = left[sortKey]; const b = right[sortKey]; const order = typeof a === 'string' && typeof b === 'string' ? a.localeCompare(b) : Number(a) - Number(b); return descending ? -order : order; }), [descending, results, sortKey]);
  const detail = results.find((result) => result.symbol === detailSymbol) ?? results[0];

  return <main className="dca-page">
    <header className="dca-header"><a href="/" className="dca-back">← 返回市场看板<span>Dashboard</span></a><div><h1>{dcaLabels.title.zh}</h1><p>{dcaLabels.title.en}</p></div><span className="simulation-mode"><b>多标的长期对比</b><small>Comparison Mode</small></span></header>
    <form className="dca-comparison-form" onSubmit={runComparison}>
      <div className="dca-parameters"><label><Bilingual {...dcaLabels.startMonth} /><input max={currentMonth} min="2000-01" onChange={(event) => setStartMonth(event.target.value)} required type="month" value={startMonth} /></label><label><Bilingual {...dcaLabels.weeklyInvestment} /><div className="dca-amount-input"><span>$</span><input min="0.01" onChange={(event) => setWeeklyInvestment(Number(event.target.value))} required step="0.01" type="number" value={weeklyInvestment} /></div><div className="dca-quick-amounts">{quickAmounts.map((amount) => <button className={weeklyInvestment === amount ? 'selected' : ''} key={amount} onClick={() => setWeeklyInvestment(amount)} type="button">${amount}</button>)}</div></label></div>
      <section className="dca-selection-block"><div className="dca-selection-heading"><Bilingual {...dcaLabels.selectedAssets} /><span>{selected.length}/10</span></div><div className="dca-add-asset"><input list="dca-symbols" onChange={(event) => setAssetInput(event.target.value.toUpperCase())} placeholder="搜索 Ticker / Search ticker" value={assetInput} /><datalist id="dca-symbols">{supported.filter((item) => !selected.some((selectedItem) => selectedItem.symbol === item.symbol)).map((item) => <option key={item.symbol} value={item.symbol}>{assetLabels[item.symbol]?.zh ?? item.symbol}</option>)}</datalist><button onClick={addAsset} type="button"><b>添加</b><small>Add</small></button></div><div className="dca-asset-chips">{selected.map((item) => <span key={item.symbol}><b>{item.symbol}</b><small>{item.type === 'Stock' ? '股票' : 'ETF'}</small><button aria-label={`Remove ${item.symbol}`} onClick={() => setSelected(selected.filter((candidate) => candidate.symbol !== item.symbol))} type="button">×</button></span>)}</div></section>
      <section className="dca-selection-block"><div className="dca-selection-heading"><Bilingual {...dcaLabels.benchmarks} /><small>基准模拟 · 不代表可执行交易<br />Benchmark simulation · Not directly tradable</small></div><div className="dca-benchmark-toggles">{benchmarkOptions.map((item) => <label key={item.id}><input checked={benchmarkIds.includes(item.id)} onChange={() => setBenchmarkIds(benchmarkIds.includes(item.id) ? benchmarkIds.filter((id) => id !== item.id) : [...benchmarkIds, item.id])} type="checkbox" /><span><b>{item.zh}</b><small>{item.en}</small></span></label>)}</div></section>
      <button className="dca-run" disabled={loading} type="submit"><b>{loading ? '计算中…' : '开始对比'}</b><small>{loading ? 'Running comparison…' : 'Run Comparison'}</small></button>
    </form>
    <section className="dca-assumptions"><b>相同独立策略<small>Same Independent Strategy</small></b><span>每个标的每周独立投入 {money(weeklyInvestment)}，不会在多个标的之间平分。</span><span>周一或当周下一交易日收盘价 · 支持碎股 · 不计手续费、税费与股息再投资。</span></section>
    {error && <div className="dca-error">{error}</div>}
    {(results.length > 0 || unavailable.length > 0) && <>
      <section className="dca-comparison-heading"><Bilingual {...dcaLabels.comparisonTable} /><div><select aria-label="Sort comparison" onChange={(event) => setSortKey(event.target.value as SortKey)} value={sortKey}><option value="totalReturnPercent">累计收益率</option><option value="currentValue">当前总市值</option><option value="totalProfit">累计盈利</option><option value="maximumDrawdownPercent">最大回撤</option><option value="symbol">Ticker</option></select><button onClick={() => setDescending(!descending)} type="button">{descending ? '↓ 降序' : '↑ 升序'}</button></div></section>
      <div className="dca-comparison-table-wrap"><table className="dca-comparison-table"><thead><tr><th><Bilingual en="Asset" zh="标的" /></th><th><Bilingual en="Name" zh="名称" /></th><th><Bilingual en="Type" zh="类型" /></th><th><Bilingual {...dcaLabels.totalInvested} /></th><th><Bilingual {...dcaLabels.currentValue} /></th><th><Bilingual {...dcaLabels.totalProfit} /></th><th><Bilingual {...dcaLabels.totalReturn} /></th><th><Bilingual {...dcaLabels.maximumDrawdown} /></th><th><Bilingual {...dcaLabels.totalPurchases} /></th><th><Bilingual {...dcaLabels.averageCost} /></th><th><Bilingual en="Actual Start" zh="实际开始日期" /></th></tr></thead><tbody>{sortedResults.map((item) => <tr className={detail?.symbol === item.symbol ? 'selected' : ''} key={item.symbol} onClick={() => setDetailSymbol(item.symbol)}><td><b>{item.symbol}</b></td><td><b>{assetLabels[item.symbol]?.zh ?? item.name}</b><small>{assetLabels[item.symbol]?.en ?? item.name}</small></td><td><TypeLabel type={item.type} /></td><td>{money(item.totalInvested)}</td><td>{money(item.currentValue)}</td><td className={item.totalProfit >= 0 ? 'up' : 'down'}>{money(item.totalProfit)}</td><td className={item.totalReturnPercent >= 0 ? 'up' : 'down'}>{percent(item.totalReturnPercent)}</td><td className="down">{percent(item.maximumDrawdownPercent)}</td><td>{item.totalPurchases}</td><td>{money(item.averageCost)}</td><td>{item.actualStartDate}{item.historyLimited && <small>历史较晚</small>}</td></tr>)}{unavailable.map((item) => <tr className="unavailable" key={item.symbol}><td><b>{item.symbol}</b></td><td>{assetLabels[item.symbol]?.zh ?? item.name}<small>{assetLabels[item.symbol]?.en ?? item.name}</small></td><td><TypeLabel type={item.type} /></td><td colSpan={8}>不可用 · Unavailable — {item.reason}</td></tr>)}</tbody></table></div>
      {results.length > 0 && <section className="dca-panel dca-growth-panel"><div className="dca-panel-heading"><Bilingual {...dcaLabels.performanceComparison} /><div className="dca-view-toggle"><button className={view === 'normalized' ? 'active' : ''} onClick={() => setView('normalized')} type="button"><b>{dcaLabels.normalized.zh}</b><small>{dcaLabels.normalized.en}</small></button><button className={view === 'value' ? 'active' : ''} onClick={() => setView('value')} type="button"><b>{dcaLabels.portfolioValue.zh}</b><small>{dcaLabels.portfolioValue.en}</small></button></div></div><DcaChart results={results} view={view} visible={visible} onToggle={(ticker) => setVisible((current) => { const next = new Set(current); if (next.has(ticker)) next.delete(ticker); else next.add(ticker); return next; })} /><p className="dca-drawdown-note">标准化表现与最大回撤使用同一现金流调整单位净值，所有曲线从 100 开始，新增投入不会抬高表现。<br /><small>Normalized Performance uses the same contribution-adjusted unit NAV as Maximum Drawdown. Every series begins at 100.</small></p></section>}
      {detail && <section className="dca-detail"><div className="dca-result-heading"><div><span>{detail.symbol}</span><Bilingual en={detail.name === detail.symbol ? assetLabels[detail.symbol]?.en ?? detail.symbol : detail.name} zh={assetLabels[detail.symbol]?.zh ?? (detail.type === 'Benchmark' ? '市场基准' : '股票 / ETF')} /></div><p>实际开始日期<b>{detail.actualStartDate}</b><small>Actual Start Date</small></p><p>估值日期<b>{detail.valuationDate}</b><small>Valuation Date</small></p></div>{detail.historyLimited && <div className="dca-history-warning">历史数据晚于所选开始月份，实际覆盖从 <b>{detail.historicalStartDate}</b> 开始。<small>Historical data begins later than the selected start date; no synthetic prices are used.</small></div>}<div className="dca-summary-grid"><Metric {...dcaLabels.totalInvested} value={money(detail.totalInvested)} /><Metric {...dcaLabels.currentValue} value={money(detail.currentValue)} /><Metric {...dcaLabels.totalProfit} value={money(detail.totalProfit)} tone={detail.totalProfit >= 0 ? 'up' : 'down'} /><Metric {...dcaLabels.totalReturn} value={percent(detail.totalReturnPercent)} tone={detail.totalReturnPercent >= 0 ? 'up' : 'down'} /><Metric {...dcaLabels.maximumDrawdown} value={percent(detail.maximumDrawdownPercent)} tone="down" detail="Contribution-adjusted TWR" /><Metric {...dcaLabels.totalPurchases} value={String(detail.totalPurchases)} /><Metric {...dcaLabels.totalShares} value={number(detail.totalShares, 6)} /><Metric {...dcaLabels.averageCost} value={money(detail.averageCost)} /><Metric {...dcaLabels.source} value={detail.source} detail={detail.priceBasis} /></div></section>}
    </>}
    <LegalDisclaimer />
  </main>;
}

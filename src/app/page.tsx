'use client';

import { useEffect, useState } from 'react';
import { ApiQuote, MacroQuote, MarketApiResponse, MarketItem, createStockItem, marketItems } from './market-data';
import EconomicCalendar from './economic-calendar';
import MarketInformation from './market-information';
import './market-status.css';

const defaultWatchlist = ['NVDA', 'MU', 'TSLA', 'AAPL'];
const watchlistStorageKey = 'marketflow-watchlist';
const maxWatchlistSize = 30;
const symbolPattern = /^[A-Z][A-Z0-9.-]{0,9}$/;

const fallbackValues: Record<string, ApiQuote> = {
  '^GSPC': { value: 5432.26, change: 32.41, percent: 0.6, source: '模拟数据', updatedAt: 0 },
  '^IXIC': { value: 17608.44, change: 141.85, percent: 0.81, source: '模拟数据', updatedAt: 0 },
  'GC=F': { value: 2342.8, change: -8.4, percent: -0.36, source: '模拟数据', updatedAt: 0 },
  'CL=F': { value: 78.65, change: 1.12, percent: 1.44, source: '模拟数据', updatedAt: 0 },
  NVDA: { value: 131.88, change: 3.74, percent: 2.92, source: '模拟数据', updatedAt: 0 },
  MU: { value: 146.96, change: -2.18, percent: -1.46, source: '模拟数据', updatedAt: 0 },
  TSLA: { value: 177.48, change: 4.63, percent: 2.68, source: '模拟数据', updatedAt: 0 },
  AAPL: { value: 207.15, change: 0.92, percent: 0.45, source: '模拟数据', updatedAt: 0 },
};

const treasuryDefinitions = [
  { symbol: 'US2Y', name: 'US 2Y', category: '美国国债 · 2 年', spark: 'M2 34 C18 29 28 36 39 27 S59 29 71 22 S99 25 120 12' },
  { symbol: 'US10Y', name: 'US 10Y', category: '美国国债 · 10 年', spark: 'M2 30 C18 36 28 25 40 29 S60 21 72 26 S98 19 120 14' },
  { symbol: 'US30Y', name: 'US 30Y', category: '美国国债 · 30 年', spark: 'M2 38 C18 31 29 35 42 25 S60 28 73 19 S99 22 120 10' },
];

const cryptoDefinitions = [
  { symbol: 'bitcoin', name: 'BTC', category: '加密资产 · Bitcoin', spark: 'M2 40 C15 34 25 38 36 27 S53 31 64 20 S96 27 120 8' },
  { symbol: 'ethereum', name: 'ETH', category: '加密资产 · Ethereum', spark: 'M2 35 C18 27 25 37 37 25 S56 28 68 19 S99 25 120 12' },
];

const macroDefinitions: Array<{ key: string; name: string; subtitle: string }> = [
  { key: 'cpi', name: 'CPI', subtitle: 'CONSUMER PRICE INDEX' },
  { key: 'coreCpi', name: 'Core CPI', subtitle: 'EX FOOD & ENERGY' },
  { key: 'pce', name: 'PCE', subtitle: 'PCE PRICE INDEX' },
  { key: 'corePce', name: 'Core PCE', subtitle: 'EX FOOD & ENERGY' },
  { key: 'nonfarmPayrolls', name: 'Nonfarm Payrolls', subtitle: 'TOTAL NONFARM · K' },
  { key: 'unemploymentRate', name: 'Unemployment Rate', subtitle: 'UNEMPLOYMENT · %' },
  { key: 'gdp', name: 'GDP', subtitle: 'NOMINAL · SAAR · $BN' },
  { key: 'effectiveFedFundsRate', name: 'Effective Fed Funds', subtitle: 'H.15 EFFECTIVE RATE · %' },
];

const fallbackMacroValues: Record<string, MacroQuote> = {
  cpi: { value: 320.25, change: 0.3, referencePeriod: '模拟数据', source: '模拟数据', updatedAt: 0, unit: 'index' },
  coreCpi: { value: 330.1, change: 0.3, referencePeriod: '模拟数据', source: '模拟数据', updatedAt: 0, unit: 'index' },
  pce: { value: 126.8, change: 0.2, referencePeriod: '模拟数据', source: '模拟数据', updatedAt: 0, unit: 'index' },
  corePce: { value: 124.9, change: 0.2, referencePeriod: '模拟数据', source: '模拟数据', updatedAt: 0, unit: 'index' },
  nonfarmPayrolls: { value: 159_000, change: 118, referencePeriod: '模拟数据', source: '模拟数据', updatedAt: 0, unit: 'thousands' },
  unemploymentRate: { value: 4.1, change: 0, referencePeriod: '模拟数据', source: '模拟数据', updatedAt: 0, unit: 'percent' },
  gdp: { value: 30_100, change: 140, referencePeriod: '模拟数据', source: '模拟数据', updatedAt: 0, unit: 'billions' },
  effectiveFedFundsRate: { value: 4.33, change: 0.01, referencePeriod: '模拟数据', source: '模拟数据', updatedAt: 0, unit: 'percent' },
};

function formatNumber(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSigned(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatTime(timestamp: number) {
  if (!timestamp) return '等待真实数据';
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(timestamp);
}

function getFallbackQuote(symbol: string): ApiQuote {
  const knownQuote = fallbackValues[symbol];
  if (knownQuote) return knownQuote;
  const seed = [...symbol].reduce((total, character) => total + character.charCodeAt(0), 0);
  const value = 50 + (seed % 950);
  const change = ((seed % 401) - 200) / 100;
  return { value, change, percent: (change / value) * 100, source: '模拟数据', updatedAt: 0 };
}

function buildItems(quotes: Record<string, ApiQuote>, stockSymbols: string[], history: Record<string, number[]> = {}): MarketItem[] {
  return [...marketItems, ...stockSymbols.map(createStockItem)].map((item) => {
    const quote = quotes[item.symbol] ?? getFallbackQuote(item.symbol);
    return { ...item, history: history[item.symbol], value: formatNumber(quote.value), change: formatSigned(quote.change), percent: formatPercent(quote.percent), positive: quote.change >= 0, source: quote.source, updatedAt: quote.updatedAt, dataDate: quote.dataDate };
  });
}

function buildAssetItems(quotes: Record<string, ApiQuote>, definitions: Array<{ symbol: string; name: string; category: string; spark: string }>, yieldMode = false, history: Record<string, number[]> = {}): MarketItem[] {
  return definitions.map((definition) => {
    const quote = quotes[definition.symbol] ?? { value: 0, change: 0, percent: 0, source: '模拟数据', updatedAt: 0 };
    return { ...definition, history: history[definition.symbol], value: `${formatNumber(quote.value)}${yieldMode ? '%' : ''}`, change: formatSigned(quote.change), percent: yieldMode ? '日变化' : formatPercent(quote.percent), positive: quote.change >= 0, source: quote.source, updatedAt: quote.updatedAt, dataDate: quote.dataDate };
  });
}

function buildHistoryPath(values: number[]) {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const spread = high - low || 1;
  return values.map((value, index) => {
    const x = 2 + (index / (values.length - 1)) * 118;
    const y = 43 - ((value - low) / spread) * 38;
    return `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function formatMacroValue(quote: MacroQuote) {
  if (quote.unit === 'percent') return `${quote.value.toFixed(2)}%`;
  if (quote.unit === 'thousands') return `${Math.round(quote.value).toLocaleString('en-US')}K`;
  if (quote.unit === 'billions') return `$${Math.round(quote.value).toLocaleString('en-US')}B`;
  return formatNumber(quote.value);
}

function formatMacroChange(quote: MacroQuote) {
  if (quote.unit === 'percent') return `${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)}pp`;
  if (quote.unit === 'thousands') return `${quote.change >= 0 ? '+' : ''}${Math.round(quote.change).toLocaleString('en-US')}K`;
  if (quote.unit === 'billions') return `${quote.change >= 0 ? '+' : ''}$${Math.round(quote.change).toLocaleString('en-US')}B`;
  return formatSigned(quote.change);
}

function Sparkline({ path, positive, values }: { path: string; positive: boolean; values?: number[] }) {
  const historyPath = values && values.length > 1 ? buildHistoryPath(values) : path;
  return <svg className="sparkline" viewBox="0 0 122 48" aria-hidden="true" preserveAspectRatio="none"><path d={historyPath} fill="none" stroke={positive ? '#45d49a' : '#ff6b7d'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function MarketCard({ item, onRemove }: { item: MarketItem; onRemove?: () => void }) {
  return <article className="market-card"><div className="card-topline"><div className="symbol-box">{item.symbol.replace(/\W/g, '').slice(0, 2)}</div><div><h3>{item.name}</h3><p>{item.category}</p></div><button className="watch-button" aria-label={onRemove ? `删除 ${item.symbol}` : `关注 ${item.name}`} onClick={onRemove} type="button">{onRemove ? '×' : '☆'}</button></div><div className="card-middle"><div><strong>{item.value}</strong><div className={`change ${item.positive ? 'up' : 'down'}`}><span>{item.positive ? '↗' : '↘'}</span> {item.change} <em>{item.percent}</em></div></div><Sparkline path={item.spark} positive={item.positive} values={item.history} /></div><div className="card-footer"><span>{item.source}</span><span>·</span><span>{item.dataDate ?? formatTime(item.updatedAt)}</span></div></article>;
}

function MacroCard({ definition, quote }: { definition: { key: string; name: string; subtitle: string }; quote: MacroQuote }) {
  const positive = quote.change >= 0;
  return <article className="market-card macro-card"><div className="card-topline"><div className="symbol-box">{definition.name.slice(0, 2).toUpperCase()}</div><div><h3>{definition.name}</h3><p>{definition.subtitle}</p></div></div><div className="card-middle"><div><strong>{formatMacroValue(quote)}</strong><div className={`change ${positive ? 'up' : 'down'}`}><span>{positive ? '↗' : '↘'}</span> {formatMacroChange(quote)} <em>较上一期</em></div></div></div><div className="card-footer"><span>{quote.source}</span><span>·</span><span>{quote.referencePeriod}</span>{quote.releaseDate && <><span>·</span><span>{quote.releaseDate}</span></>}</div></article>;
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="section-heading"><div><h2>{title}</h2><span>{subtitle}</span></div></div>;
}

export default function Home() {
  const [range, setRange] = useState('1D');
  const [watchlist, setWatchlist] = useState(defaultWatchlist);
  const [watchlistReady, setWatchlistReady] = useState(false);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [items, setItems] = useState(() => buildItems(fallbackValues, defaultWatchlist));
  const [treasuryItems, setTreasuryItems] = useState<MarketItem[]>(() => buildAssetItems({}, treasuryDefinitions, true));
  const [cryptoItems, setCryptoItems] = useState<MarketItem[]>(() => buildAssetItems({}, cryptoDefinitions));
  const [macro, setMacro] = useState<Record<string, MacroQuote>>(fallbackMacroValues);
  const [errors, setErrors] = useState<string[]>(['正在获取真实行情']);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('等待更新');

  async function refresh(symbols = watchlist, rangeForRequest = range) {
    setLoading(true);
    try {
      const response = await fetch(`/api/market?symbols=${encodeURIComponent(symbols.join(','))}&range=${rangeForRequest}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('行情服务暂时不可用');
      const data = (await response.json()) as MarketApiResponse;
      setItems(buildItems(data.quotes, symbols, data.history));
      setTreasuryItems(buildAssetItems(data.treasury, treasuryDefinitions, true));
      setCryptoItems(buildAssetItems(data.crypto, cryptoDefinitions, false, data.history));
      setMacro(data.macro);
      setErrors(data.errors);
      setLastUpdated(`最后更新时间 ${formatTime(data.fetchedAt)}`);
    } catch {
      setItems(buildItems(fallbackValues, symbols));
      setTreasuryItems(buildAssetItems({}, treasuryDefinitions, true));
      setCryptoItems(buildAssetItems({}, cryptoDefinitions));
      setMacro(fallbackMacroValues);
      setErrors(['行情服务暂时无法连接，当前显示模拟数据']);
      setLastUpdated('更新失败，已保留模拟数据');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let savedSymbols = defaultWatchlist;
    try {
      const stored = window.localStorage.getItem(watchlistStorageKey);
      const parsed = stored ? JSON.parse(stored) : null;
      if (Array.isArray(parsed)) savedSymbols = [...new Set(parsed.filter((symbol): symbol is string => typeof symbol === 'string' && symbolPattern.test(symbol.toUpperCase())).map((symbol) => symbol.toUpperCase()))].slice(0, maxWatchlistSize);
    } catch {
      savedSymbols = defaultWatchlist;
    }
    setWatchlist(savedSymbols);
    setWatchlistReady(true);
    void refresh(savedSymbols);
  }, []);

  useEffect(() => {
    if (watchlistReady) window.localStorage.setItem(watchlistStorageKey, JSON.stringify(watchlist));
  }, [watchlist, watchlistReady]);

  function addToWatchlist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const symbol = searchSymbol.trim().toUpperCase();
    if (!symbolPattern.test(symbol)) return setErrors(['请输入有效的美股代码，例如 MSFT 或 AMZN']);
    if (watchlist.includes(symbol)) return setErrors([`${symbol} 已在我的自选中`]);
    if (watchlist.length >= maxWatchlistSize) return setErrors([`我的自选最多添加 ${maxWatchlistSize} 个股票`]);
    const nextWatchlist = [...watchlist, symbol];
    setWatchlist(nextWatchlist);
    setSearchSymbol('');
    void refresh(nextWatchlist);
  }

  function removeFromWatchlist(symbol: string) {
    const nextWatchlist = watchlist.filter((item) => item !== symbol);
    setWatchlist(nextWatchlist);
    void refresh(nextWatchlist);
  }

  const indices = items.slice(0, 4);
  const stocks = items.slice(4);
  const liveCount = items.filter((item) => item.source !== '模拟数据').length;
  const risingCount = items.filter((item) => item.positive).length;

  function selectRange(nextRange: string) {
    setRange(nextRange);
    void refresh(watchlist, nextRange);
  }

  return <main className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><span /></div><div><strong>MARKET<span>FLOW</span></strong><small>全球市场终端</small></div></div><nav><p className="nav-label">工作台</p><a className="nav-item active" href="#overview"><span className="nav-icon">◈</span><span className="nav-text">市场总览</span></a><a className="nav-item" href="#stocks"><span className="nav-icon">⌁</span><span className="nav-text">我的自选</span></a><p className="nav-label second">市场分类</p><a className="nav-item" href="#indices"><span className="dot blue" /><span className="nav-text">全球指数</span> <b>04</b></a><a className="nav-item" href="#treasury"><span className="dot gold" /><span className="nav-text">美国国债</span> <b>03</b></a><a className="nav-item" href="#crypto"><span className="dot green" /><span className="nav-text">加密资产</span> <b>02</b></a><a className="nav-item" href="#stocks"><span className="dot green" /><span className="nav-text">我的自选</span> <b>{watchlist.length.toString().padStart(2, '0')}</b></a></nav><div className="sidebar-bottom"><div className="status-dot" />{liveCount ? '部分真实行情' : '模拟数据模式'} <button type="button" aria-label="设置">⚙</button></div></aside><section className="content" id="overview"><header className="topbar"><div className="breadcrumb">工作台 <span>/</span> <strong>市场总览</strong></div><div className="top-actions"><div className="search">⌕ <span>搜索市场...</span><kbd>⌘ K</kbd></div><button className="icon-button" type="button" aria-label="通知">♧<i /></button><div className="avatar">JD</div></div></header><div className="page-heading"><div><div className="eyebrow"><span className="live-dot" />MARKET OVERVIEW</div><h1>全球市场总览</h1><p>掌握全球主要市场动态，洞察每一个重要机会。</p></div><div className="heading-actions"><span className="data-note"><span className="pulse" />数据可能存在延迟</span><button className="refresh" type="button" onClick={() => void refresh()} disabled={loading}>↻ <span>{loading ? '正在刷新...' : lastUpdated}</span></button></div></div>{errors.length > 0 && <div className="market-alert"><span>!</span><div>{errors.slice(0, 2).map((error) => <p key={error}>{error}</p>)}</div></div>}<div className="stats-strip"><div><span>市场情绪</span><strong className="mood">{risingCount >= 4 ? '偏向乐观' : '偏向谨慎'} <i>{risingCount >= 4 ? '↗' : '↘'}</i></strong></div><div><span>上涨 / 下跌</span><strong>{risingCount} <small>/</small> {items.length - risingCount}</strong></div><div><span>真实行情</span><strong>{liveCount.toString().padStart(2, '0')} <small>/ {items.length} 个标的</small></strong></div><div><span>关注列表</span><strong>{watchlist.length.toString().padStart(2, '0')} <small>个标的</small></strong></div></div><div className="section-heading" id="indices"><div><h2>主要市场</h2><span>Major Markets</span></div><div className="range-tabs">{['1D', '1W', '1M', 'YTD'].map((item) => <button className={range === item ? 'selected' : ''} key={item} onClick={() => selectRange(item)} type="button">{item}</button>)}</div></div><div className="market-grid">{indices.map((item) => <MarketCard item={item} key={item.symbol} />)}</div><div id="treasury"><SectionHeading title="美国国债收益率" subtitle="US TREASURY · DAILY PAR YIELD" /><div className="market-grid">{treasuryItems.map((item) => <MarketCard item={item} key={item.symbol} />)}</div></div><div id="macro"><SectionHeading title="宏观经济" subtitle="MACRO · OFFICIAL DATA" /><div className="market-grid macro-grid">{macroDefinitions.map((definition) => <MacroCard definition={definition} quote={macro[definition.key] ?? fallbackMacroValues[definition.key]} key={definition.key} />)}</div></div><div id="crypto"><SectionHeading title="加密资产" subtitle="CRYPTO · USD" /><div className="market-grid">{cryptoItems.map((item) => <MarketCard item={item} key={item.symbol} />)}</div></div><div className="section-heading stocks-heading" id="stocks"><div><h2>我的自选</h2><span>MY WATCHLIST · {watchlist.length}/{maxWatchlistSize}</span></div><form className="watchlist-tools" onSubmit={addToWatchlist}><input aria-label="股票代码" maxLength={10} onChange={(event) => setSearchSymbol(event.target.value)} placeholder="输入美股代码" value={searchSymbol} /><button type="submit">添加</button></form></div><div className="market-grid">{stocks.map((item) => <MarketCard item={item} key={item.symbol} onRemove={() => removeFromWatchlist(item.symbol)} />)}</div><EconomicCalendar /><MarketInformation /><footer><span>© 2024 MarketFlow</span><span>数据来源：Finnhub / Yahoo Finance / US Treasury / Coinbase · 数据可能存在延迟</span><span>{lastUpdated}</span></footer></section></main>;
}

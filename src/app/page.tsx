'use client';

import { useEffect, useState } from 'react';
import { ApiQuote, MacroQuote, MarketApiResponse, MarketItem, createStockItem, marketItems } from './market-data';
import { assetLabels, macroLabels, moduleLabels } from './bilingual-labels';
import EconomicCalendar from './economic-calendar';
import MarketInformation from './market-information';
import './market-status.css';

const defaultWatchlist = ['NVDA', 'MU', 'TSLA', 'AAPL'];
const watchlistStorageKey = 'marketflow-watchlist';
const maxWatchlistSize = 30;
const symbolPattern = /^[A-Z][A-Z0-9.-]{0,9}$/;
const historyRanges = ['1D', '1W', '1M', 'YTD'];

const fallbackValues: Record<string, ApiQuote> = {
  '^DJI': { value: 38627.99, change: 184.12, percent: 0.48, source: 'Fallback / Mock', updatedAt: 0 },
  '^GSPC': { value: 5432.26, change: 32.41, percent: 0.6, source: 'Fallback / Mock', updatedAt: 0 },
  '^IXIC': { value: 17608.44, change: 141.85, percent: 0.81, source: 'Fallback / Mock', updatedAt: 0 },
  'GC=F': { value: 2342.8, change: -8.4, percent: -0.36, source: 'Fallback / Mock', updatedAt: 0 },
  'CL=F': { value: 78.65, change: 1.12, percent: 1.44, source: 'Fallback / Mock', updatedAt: 0 },
  NVDA: { value: 131.88, change: 3.74, percent: 2.92, source: 'Fallback / Mock', updatedAt: 0 },
  MU: { value: 146.96, change: -2.18, percent: -1.46, source: 'Fallback / Mock', updatedAt: 0 },
  TSLA: { value: 177.48, change: 4.63, percent: 2.68, source: 'Fallback / Mock', updatedAt: 0 },
  AAPL: { value: 207.15, change: 0.92, percent: 0.45, source: 'Fallback / Mock', updatedAt: 0 },
};

const treasuryDefinitions = [
  { symbol: 'US2Y', name: 'US 2Y', category: 'US Treasury · 2 Year', spark: 'M2 34 C18 29 28 36 39 27 S59 29 71 22 S99 25 120 12' },
  { symbol: 'US10Y', name: 'US 10Y', category: 'US Treasury · 10 Year', spark: 'M2 30 C18 36 28 25 40 29 S60 21 72 26 S98 19 120 14' },
  { symbol: 'US30Y', name: 'US 30Y', category: 'US Treasury · 30 Year', spark: 'M2 38 C18 31 29 35 42 25 S60 28 73 19 S99 22 120 10' },
];

const cryptoDefinitions = [
  { symbol: 'bitcoin', name: 'BTC', category: 'Crypto · Bitcoin', spark: 'M2 40 C15 34 25 38 36 27 S53 31 64 20 S96 27 120 8' },
  { symbol: 'ethereum', name: 'ETH', category: 'Crypto · Ethereum', spark: 'M2 35 C18 27 25 37 37 25 S56 28 68 19 S99 25 120 12' },
];

const macroDefinitions = [
  { key: 'cpi', name: 'CPI', subtitle: 'CONSUMER PRICE INDEX' },
  { key: 'coreCpi', name: 'Core CPI', subtitle: 'EX FOOD & ENERGY' },
  { key: 'pce', name: 'PCE', subtitle: 'PCE PRICE INDEX' },
  { key: 'corePce', name: 'Core PCE', subtitle: 'EX FOOD & ENERGY' },
  { key: 'nonfarmPayrolls', name: 'Nonfarm Payrolls', subtitle: 'TOTAL NONFARM · K' },
  { key: 'unemploymentRate', name: 'Unemployment Rate', subtitle: 'UNEMPLOYMENT · %' },
  { key: 'gdp', name: 'GDP', subtitle: 'NOMINAL · SAAR · $BN' },
  { key: 'effectiveFedFundsRate', name: 'Effective Fed Funds', subtitle: 'H.15 EFFECTIVE RATE · %' },
];

const summaryMacroKeys = ['cpi', 'coreCpi', 'unemploymentRate', 'gdp', 'effectiveFedFundsRate'];

const fallbackMacroValues: Record<string, MacroQuote> = {
  cpi: { value: 320.25, change: 0.3, referencePeriod: 'Fallback / Mock', source: 'Fallback / Mock', updatedAt: 0, unit: 'index' },
  coreCpi: { value: 330.1, change: 0.3, referencePeriod: 'Fallback / Mock', source: 'Fallback / Mock', updatedAt: 0, unit: 'index' },
  pce: { value: 126.8, change: 0.2, referencePeriod: 'Fallback / Mock', source: 'Fallback / Mock', updatedAt: 0, unit: 'index' },
  corePce: { value: 124.9, change: 0.2, referencePeriod: 'Fallback / Mock', source: 'Fallback / Mock', updatedAt: 0, unit: 'index' },
  nonfarmPayrolls: { value: 159_000, change: 118, referencePeriod: 'Fallback / Mock', source: 'Fallback / Mock', updatedAt: 0, unit: 'thousands' },
  unemploymentRate: { value: 4.1, change: 0, referencePeriod: 'Fallback / Mock', source: 'Fallback / Mock', updatedAt: 0, unit: 'percent' },
  gdp: { value: 30_100, change: 140, referencePeriod: 'Fallback / Mock', source: 'Fallback / Mock', updatedAt: 0, unit: 'billions' },
  effectiveFedFundsRate: { value: 4.33, change: 0.01, referencePeriod: 'Fallback / Mock', source: 'Fallback / Mock', updatedAt: 0, unit: 'percent' },
};

function formatNumber(value: number) { return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatSigned(value: number) { return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`; }
function formatPercent(value: number) { return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`; }
function formatTime(timestamp: number) { return timestamp ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(timestamp) : 'Awaiting live data'; }

function getFallbackQuote(symbol: string): ApiQuote {
  const knownQuote = fallbackValues[symbol];
  if (knownQuote) return knownQuote;
  const seed = [...symbol].reduce((total, character) => total + character.charCodeAt(0), 0);
  const value = 50 + (seed % 950);
  const change = ((seed % 401) - 200) / 100;
  return { value, change, percent: (change / value) * 100, source: 'Fallback / Mock', updatedAt: 0 };
}

function buildItems(quotes: Record<string, ApiQuote>, stockSymbols: string[], history: Record<string, number[]> = {}): MarketItem[] {
  return [...marketItems, ...stockSymbols.map(createStockItem)].map((item) => {
    const quote = quotes[item.symbol] ?? getFallbackQuote(item.symbol);
    return { ...item, history: history[item.symbol], value: formatNumber(quote.value), change: formatSigned(quote.change), percent: formatPercent(quote.percent), positive: quote.change >= 0, source: quote.source, updatedAt: quote.updatedAt, dataDate: quote.dataDate };
  });
}

function buildAssetItems(quotes: Record<string, ApiQuote>, definitions: Array<{ symbol: string; name: string; category: string; spark: string }>, yieldMode = false, history: Record<string, number[]> = {}): MarketItem[] {
  return definitions.map((definition) => {
    const quote = quotes[definition.symbol] ?? { value: 0, change: 0, percent: 0, source: 'Fallback / Mock', updatedAt: 0 };
    return { ...definition, history: history[definition.symbol], value: `${formatNumber(quote.value)}${yieldMode ? '%' : ''}`, change: formatSigned(quote.change), percent: yieldMode ? '1D Change' : formatPercent(quote.percent), positive: quote.change >= 0, source: quote.source, updatedAt: quote.updatedAt, dataDate: quote.dataDate };
  });
}

function buildHistoryPath(values: number[]) {
  const low = Math.min(...values); const high = Math.max(...values); const spread = high - low || 1;
  return values.map((value, index) => { const x = 2 + (index / (values.length - 1)) * 118; const y = 43 - ((value - low) / spread) * 38; return `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`; }).join(' ');
}

function formatMacroValue(quote: MacroQuote) {
  if (quote.unit === 'percent') return `${quote.value.toFixed(2)}%`;
  if (quote.unit === 'thousands') return `${Math.round(quote.value).toLocaleString('en-US')}K`;
  if (quote.unit === 'billions') return `$${Math.round(quote.value).toLocaleString('en-US')}B`;
  return formatNumber(quote.value);
}

function isFallback(source: string, updatedAt: number) { return !updatedAt || /fallback|mock|模拟/i.test(source); }
function statusFor(source: string, updatedAt: number) { if (isFallback(source, updatedAt)) return { label: 'Fallback', tone: 'fallback' }; if (/cache/i.test(source)) return { label: 'Cached', tone: 'cached' }; return { label: 'Real', tone: 'real' }; }

function Sparkline({ path, positive, values }: { path: string; positive: boolean; values?: number[] }) {
  const historyPath = values && values.length > 1 ? buildHistoryPath(values) : path;
  return <svg className="sparkline" viewBox="0 0 122 48" aria-hidden="true" preserveAspectRatio="none"><path d={`${historyPath} L120 48 L2 48 Z`} className="sparkline-area" /><path d={historyPath} fill="none" stroke={positive ? 'var(--positive)' : 'var(--negative)'} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ChartAxis({ item }: { item: MarketItem }) {
  const values = item.history?.length ? item.history : [];
  if (!values.length) return null;
  const low = Math.min(...values); const high = Math.max(...values); const midpoint = (high + low) / 2; const digits = high < 10 ? 2 : high < 100 ? 1 : 0;
  return <div className="chart-axis" aria-hidden="true"><span>{high.toFixed(digits)}</span><span>{midpoint.toFixed(digits)}</span><span>{low.toFixed(digits)}</span></div>;
}

type MarketCardProps = { item: MarketItem; onRemove?: () => void; ticker?: string; primary?: boolean; range?: string; onRangeChange?: (range: string) => void; displayName?: string; };

function MarketCard({ item, onRemove, ticker, primary = false, range, onRangeChange, displayName }: MarketCardProps) {
  const label = assetLabels[item.symbol]; const title = displayName ?? label?.en ?? item.name;
  const state = statusFor(item.source, item.updatedAt);
  return <article className={`market-card${primary ? ' primary-market-card' : ''}`}><div className="card-topline"><div className="symbol-box">{item.symbol.replace(/\W/g, '').slice(0, 2)}</div><div className="card-label"><h3>{title}</h3><p>{label?.zh ?? item.category}</p></div>{ticker && <span className="ticker-badge">{ticker}</span>}{onRemove && <button className="watch-button" aria-label={`Remove ${item.symbol}`} onClick={onRemove} type="button">×</button>}</div><div className="card-quote"><strong>{item.value}</strong><div className={`change ${item.positive ? 'up' : 'down'}`}><span>{item.positive ? '↗' : '↘'}</span> {item.change} <em>{item.percent}</em></div></div><div className="card-chart"><Sparkline path={item.spark} positive={item.positive} values={item.history} />{primary && <ChartAxis item={item} />}</div>{primary && range && onRangeChange ? <><span className={`card-data-state ${state.tone}`}><i />{state.tone === 'fallback' ? 'FALLBACK / MOCK' : item.source}</span><div className="card-range-tabs">{historyRanges.map((itemRange) => <button className={range === itemRange ? 'selected' : ''} key={itemRange} onClick={() => onRangeChange(itemRange)} type="button">{itemRange}</button>)}</div></> : <div className="card-footer"><span>{item.source}</span><span>·</span><span>{item.dataDate ?? formatTime(item.updatedAt)}</span></div>}</article>;
}

function PanelHeading({ icon, title, href }: { icon: string; title: string; href?: string }) { return <div className="panel-heading"><div><span className="panel-icon" aria-hidden="true">{icon}</span><h2>{title}</h2></div>{href && <a className="view-more" href={href}>View More <span>→</span></a>}</div>; }

function MacroTable({ macro }: { macro: Record<string, MacroQuote> }) {
  return <div className="terminal-table macro-summary-table"><div className="table-row table-head"><span>Indicator</span><span>Latest</span><span>Data Source</span><span>Status</span></div>{summaryMacroKeys.map((key) => { const quote = macro[key] ?? fallbackMacroValues[key]; const label = macroLabels[key]; const status = statusFor(quote.source, quote.updatedAt); return <div className="table-row" key={key}><span>{key === 'gdp' ? 'GDP' : key === 'unemploymentRate' ? 'Unemployment' : label?.en ?? key}</span><strong>{formatMacroValue(quote)}</strong><small>{quote.source}</small><span className={`status-badge ${status.tone}`}><i />{status.label}</span></div>; })}</div>;
}

function DashboardHeader({ sidebarOpen, onSidebarToggle }: { sidebarOpen: boolean; onSidebarToggle: () => void }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  const date = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
  return <header className="dashboard-header"><button aria-expanded={sidebarOpen} aria-label="Open navigation" className="mobile-nav-toggle" onClick={onSidebarToggle} type="button">☰</button><div className="header-title"><h1>Global Market Dashboard</h1><p>全球市场看板</p></div><div className="header-actions"><div className="date-time"><span>{date}</span><strong>{time}</strong><small>(UTC+8)</small></div><div className="header-search" role="search"><span aria-hidden="true">⌕</span><span>Search symbols, news, or people...</span></div><p className="header-statement">Markets move the world.<br />We help you see it clearly.</p></div></header>;
}

export default function Home() {
  const [range, setRange] = useState('1D'); const [watchlist, setWatchlist] = useState(defaultWatchlist); const [watchlistReady, setWatchlistReady] = useState(false); const [searchSymbol, setSearchSymbol] = useState('');
  const [items, setItems] = useState(() => buildItems(fallbackValues, defaultWatchlist)); const [treasuryItems, setTreasuryItems] = useState<MarketItem[]>(() => buildAssetItems({}, treasuryDefinitions, true)); const [cryptoItems, setCryptoItems] = useState<MarketItem[]>(() => buildAssetItems({}, cryptoDefinitions)); const [macro, setMacro] = useState<Record<string, MacroQuote>>(fallbackMacroValues);
  const [errors, setErrors] = useState<string[]>(['Loading market data']); const [loading, setLoading] = useState(false); const [lastUpdated, setLastUpdated] = useState('Awaiting update'); const [sidebarOpen, setSidebarOpen] = useState(false);

  async function refresh(symbols = watchlist, rangeForRequest = range) {
    setLoading(true);
    try { const response = await fetch(`/api/market?symbols=${encodeURIComponent(symbols.join(','))}&range=${rangeForRequest}`, { cache: 'no-store' }); if (!response.ok) throw new Error('Market service unavailable'); const data = (await response.json()) as MarketApiResponse; setItems(buildItems(data.quotes, symbols, data.history)); setTreasuryItems(buildAssetItems(data.treasury, treasuryDefinitions, true)); setCryptoItems(buildAssetItems(data.crypto, cryptoDefinitions, false, data.history)); setMacro(data.macro); setErrors(data.errors); setLastUpdated(formatTime(data.fetchedAt)); }
    catch { setItems(buildItems(fallbackValues, symbols)); setTreasuryItems(buildAssetItems({}, treasuryDefinitions, true)); setCryptoItems(buildAssetItems({}, cryptoDefinitions)); setMacro(fallbackMacroValues); setErrors(['Market service unavailable. Structured fallback data is displayed.']); setLastUpdated('Fallback data retained'); }
    finally { setLoading(false); }
  }

  useEffect(() => { let savedSymbols = defaultWatchlist; try { const stored = window.localStorage.getItem(watchlistStorageKey); const parsed = stored ? JSON.parse(stored) : null; if (Array.isArray(parsed)) savedSymbols = [...new Set(parsed.filter((symbol): symbol is string => typeof symbol === 'string' && symbolPattern.test(symbol.toUpperCase())).map((symbol) => symbol.toUpperCase()))].slice(0, maxWatchlistSize); } catch { savedSymbols = defaultWatchlist; } setWatchlist(savedSymbols); setWatchlistReady(true); void refresh(savedSymbols); }, []);
  useEffect(() => { if (watchlistReady) window.localStorage.setItem(watchlistStorageKey, JSON.stringify(watchlist)); }, [watchlist, watchlistReady]);

  function addToWatchlist(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const symbol = searchSymbol.trim().toUpperCase(); if (!symbolPattern.test(symbol)) return setErrors(['Enter a valid US equity symbol, such as MSFT or AMZN.']); if (watchlist.includes(symbol)) return setErrors([`${symbol} is already in the watchlist.`]); if (watchlist.length >= maxWatchlistSize) return setErrors([`The watchlist supports up to ${maxWatchlistSize} symbols.`]); const nextWatchlist = [...watchlist, symbol]; setWatchlist(nextWatchlist); setSearchSymbol(''); void refresh(nextWatchlist); }
  function removeFromWatchlist(symbol: string) { const nextWatchlist = watchlist.filter((item) => item !== symbol); setWatchlist(nextWatchlist); void refresh(nextWatchlist); }
  function selectRange(nextRange: string) { setRange(nextRange); void refresh(watchlist, nextRange); }

  const overviewItems = items.slice(0, marketItems.length); const stocks = items.slice(marketItems.length); const itemFor = (symbol: string) => overviewItems.find((item) => item.symbol === symbol); const treasuryFor = (symbol: string) => treasuryItems.find((item) => item.symbol === symbol); const cryptoFor = (symbol: string) => cryptoItems.find((item) => item.symbol === symbol);
  const primaryMarkets = [{ item: itemFor('^GSPC'), ticker: 'SPX' }, { item: itemFor('^IXIC'), ticker: 'IXIC', name: 'Nasdaq' }, { item: treasuryFor('US10Y'), ticker: 'US10Y', name: 'US 10Y' }, { item: cryptoFor('bitcoin'), ticker: 'BTCUSD', name: 'BTC / USD' }, { item: itemFor('GC=F'), ticker: 'XAUUSD' }].filter((entry): entry is { item: MarketItem; ticker: string; name?: string } => Boolean(entry.item));
  const additionalMarkets = overviewItems.filter((item) => !['^GSPC', '^IXIC', 'GC=F'].includes(item.symbol)); const additionalMacro = macroDefinitions.filter((definition) => !summaryMacroKeys.includes(definition.key)); const liveCount = overviewItems.filter((item) => item.updatedAt > 0).length;

  return <main className="app-shell"><aside className={`sidebar${sidebarOpen ? ' mobile-open' : ''}`}><div className="brand"><div className="brand-mark" aria-hidden="true">◉</div><div><strong>Global Market</strong><small>Insight for a connected world</small></div></div><nav><a className="nav-item active" href="#overview" onClick={() => setSidebarOpen(false)}><span className="nav-icon">▦</span><span className="nav-text">Dashboard</span></a><a className="nav-item" href="#markets" onClick={() => setSidebarOpen(false)}><span className="nav-icon">⌁</span><span className="nav-text">Markets</span></a><a className="nav-item" href="#macro" onClick={() => setSidebarOpen(false)}><span className="nav-icon">▤</span><span className="nav-text">Macro</span></a><a className="nav-item" href="#calendar" onClick={() => setSidebarOpen(false)}><span className="nav-icon">▧</span><span className="nav-text">Calendar</span></a><a className="nav-item" href="#news" onClick={() => setSidebarOpen(false)}><span className="nav-icon">▤</span><span className="nav-text">News</span></a><a className="nav-item" href="#people" onClick={() => setSidebarOpen(false)}><span className="nav-icon">♙</span><span className="nav-text">Key People</span></a><a className="nav-item" href="#settings" onClick={() => setSidebarOpen(false)}><span className="nav-icon">⚙</span><span className="nav-text">Settings</span></a></nav><div className="sidebar-bottom"><p>Better information<br />for a brighter tomorrow.</p><span className="sidebar-data-status"><i className={liveCount ? 'live' : ''} />{liveCount ? 'Live data available' : 'Fallback mode'}</span></div></aside>{sidebarOpen && <button aria-label="Close navigation" className="mobile-sidebar-scrim" onClick={() => setSidebarOpen(false)} type="button" />}<section className="content" id="overview"><DashboardHeader sidebarOpen={sidebarOpen} onSidebarToggle={() => setSidebarOpen((open) => !open)} />{errors.length > 0 && <div className="market-alert"><span>!</span><p>{loading ? 'Loading market data…' : errors[0]}</p><button className="refresh" type="button" onClick={() => void refresh()} disabled={loading}>{loading ? 'Refreshing…' : `Updated ${lastUpdated}`}</button></div>}<section className="primary-markets" id="markets"><div className="section-kicker"><span>◈</span> GLOBAL MARKET OVERVIEW <small>全球市场总览</small></div><div className="primary-market-grid">{primaryMarkets.map(({ item, ticker, name }) => <MarketCard displayName={name} item={item} key={item.symbol} onRangeChange={selectRange} primary range={range} ticker={ticker} />)}</div></section><section className="dashboard-summary-grid"><article className="terminal-panel treasury-summary" id="treasury"><PanelHeading href="#treasury-details" icon="▰" title="Treasury Yields" /><div className="terminal-table"><div className="table-row table-head"><span>Maturity</span><span>Yield</span><span>1D Change</span></div>{treasuryItems.map((item) => <div className="table-row" key={item.symbol}><span>{item.name.replace('US ', '')}</span><strong>{item.value}</strong><span className={`change ${item.positive ? 'up' : 'down'}`}>{item.change}</span></div>)}</div></article><article className="terminal-panel crypto-summary" id="crypto"><PanelHeading href="#crypto-details" icon="₿" title="Crypto" /><div className="terminal-table"><div className="table-row table-head"><span>Symbol</span><span>Price (USD)</span><span>1D Change</span></div>{cryptoItems.map((item) => <div className="table-row" key={item.symbol}><span className="coin-name"><i>{item.symbol === 'bitcoin' ? '₿' : 'Ξ'}</i>{item.name}</span><strong>{item.value}</strong><span className={`change ${item.positive ? 'up' : 'down'}`}>{item.percent}</span></div>)}</div></article><article className="terminal-panel macro-summary" id="macro"><PanelHeading href="#macro-details" icon="▥" title="Macro Indicators" /><MacroTable macro={macro} /></article></section><section className="dashboard-information-grid"><EconomicCalendar compact /><MarketInformation compact /></section><section className="additional-data" id="markets-details"><div className="compact-section-heading"><div><h2>Additional Markets</h2><p>扩展市场数据</p></div><span>ALL MARKET DATA REMAINS AVAILABLE</span></div><div className="market-grid additional-market-grid">{additionalMarkets.map((item) => <MarketCard item={item} key={item.symbol} ticker={item.symbol === '^DJI' ? 'DJI' : 'WTI'} />)}</div><div className="compact-section-heading" id="macro-details"><div><h2>Additional US Macro</h2><p>更多美国宏观经济指标</p></div><span>OFFICIAL / FALLBACK STATUS PRESERVED</span></div><div className="market-grid macro-detail-grid">{additionalMacro.map((definition) => { const quote = macro[definition.key] ?? fallbackMacroValues[definition.key]; const label = macroLabels[definition.key]; return <article className="macro-detail-card" key={definition.key}><span>{label?.en ?? definition.name}</span><small>{label?.zh ?? definition.subtitle}</small><strong>{formatMacroValue(quote)}</strong><div><em className={quote.change >= 0 ? 'up' : 'down'}>{quote.change >= 0 ? '↗' : '↘'} {quote.change >= 0 ? '+' : ''}{quote.change}</em><span>{quote.source}</span></div></article>; })}</div></section><section className="watchlist-section" id="stocks"><div className="compact-section-heading"><div><h2>{moduleLabels.watchlist.en}</h2><p>{moduleLabels.watchlist.zh}</p></div><form className="watchlist-tools" onSubmit={addToWatchlist}><input aria-label="Stock symbol" maxLength={10} onChange={(event) => setSearchSymbol(event.target.value)} placeholder="Add US symbol" value={searchSymbol} /><button type="submit">Add</button></form></div><div className="market-grid watchlist-grid">{stocks.map((item) => <MarketCard item={item} key={item.symbol} onRemove={() => removeFromWatchlist(item.symbol)} ticker={item.symbol} />)}</div></section><footer><span>© 2024 Global Market Dashboard</span><span>Yahoo Finance · Finnhub · US Treasury · Coinbase · BLS · BEA · Federal Reserve</span><span id="settings">v1.0.0</span></footer></section></main>;
}

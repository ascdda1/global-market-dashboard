'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { moduleLabels, assetLabels, type BilingualLabel } from './bilingual-labels';
import type { ApiQuote } from './market-data';
import MarketTrendChart, { preloadMarketHistories, type LongRange } from './market-candlestick-chart';
import AssetLogo from './asset-logo';
import type { AssetLogoKind } from './asset-logos';
import BrandLogo from './brand-logo';
import LegalDisclaimer from './legal-disclaimer';
import { ETF_COOKIE, STOCK_COOKIE } from './watchlist-config';

type Range = LongRange;
const maxSymbols = 30;
// Versioned storage keys let a new curated default layout replace the previous saved defaults once.
const stockKey = 'longview-stocks-v4';
const etfKey = 'longview-etfs-v4';
const liveQuoteCacheKey = 'marketflow-live-quotes-v1';
const overview = [
  { symbol: '^IXIC', en: 'Nasdaq Composite', zh: '纳斯达克综合指数' },
  { symbol: '^DJI', en: 'Dow Jones Industrial Average', zh: '道琼斯工业平均指数' },
  { symbol: '^GSPC', en: 'S&P 500', zh: '标普500指数' },
  { symbol: 'CSI300', en: 'CSI 300', zh: '沪深300指数' },
  { symbol: '^N225', en: 'Nikkei 225', zh: '日经225指数' },
  { symbol: '^STOXX', en: 'STOXX Europe 600', zh: '欧洲STOXX 600指数' },
  { symbol: 'GC=F', en: 'Gold', zh: '黄金' },
  { symbol: 'BTC', en: 'Bitcoin', zh: '比特币' },
  { symbol: 'US10Y', en: 'US 10-Year Treasury Yield', zh: '美国10年期国债收益率' },
  { symbol: 'CL=F', en: 'WTI Crude Oil', zh: 'WTI原油' },
];
const tickerPattern = /^[A-Z][A-Z0-9.-]{0,9}$/;

function Bilingual({ label }: { label: BilingualLabel }) { return <span className="bilingual-text"><span>{label.zh}</span><small>{label.en}</small></span>; }
function isUsableQuote(quote: ApiQuote | undefined): quote is ApiQuote { return !!quote && quote.updatedAt > 0 && !/fallback|mock|模拟/i.test(quote.source); }
function writeWatchlistCookie(name: string, symbols: string[]) { document.cookie = `${name}=${encodeURIComponent(symbols.join(','))}; Path=/; Max-Age=31536000; SameSite=Lax`; }

function MarketCard({ symbol, quote, label, range, onRange, onRemove, logoKind = 'overview', flash, deepHistoryReady = false }: { symbol: string; quote?: ApiQuote; label?: BilingualLabel; range: Range; onRange: (range: Range) => void; onRemove?: () => void; logoKind?: AssetLogoKind; flash?: 'up' | 'down'; deepHistoryReady?: boolean }) {
  const isTreasuryYield = symbol === 'US10Y';
  const real = quote?.status === 'real' || (!!quote?.updatedAt && !/fallback|mock|模拟/i.test(quote.source));
  const unavailable = !quote;
  const value = quote
    ? isTreasuryYield
      ? `${quote.value.toFixed(2)}%`
      : quote.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : 'Unavailable';
  const change = quote
    ? isTreasuryYield
      ? `${quote.change >= 0 ? '+' : ''}${(quote.change * 100).toFixed(0)} bp`
      : `${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)}`
    : '—';
  const secondaryChange = quote
    ? isTreasuryYield
      ? '较上一交易日'
      : `${quote.percent >= 0 ? '+' : ''}${quote.percent.toFixed(2)}%`
    : '—';
  const resolved = label ?? assetLabels[symbol] ?? { en: symbol, zh: '美股／ETF' };
  const statusText = isTreasuryYield && real ? '官方日频' : real ? 'Real' : unavailable ? 'Unavailable' : 'Fallback';
  const sourceText = quote?.source ?? (isTreasuryYield ? 'US Treasury unavailable' : 'Alpaca unavailable');
  const timeText = isTreasuryYield
    ? quote?.dataDate ?? '—'
    : quote?.updatedAt
      ? new Date(quote.updatedAt).toLocaleTimeString('en-GB')
      : '—';

  return <article className={`market-card trading-card${flash ? ` quote-flash-${flash}` : ''}`}><div className="card-topline"><div className="card-title-group"><AssetLogo ticker={symbol} kind={logoKind} /><div className="card-label"><h3>{resolved.zh}</h3><p>{resolved.en}</p></div></div><div className="card-right"><div className="card-badges-row"><span className="ticker-badge">{symbol}</span>{onRemove && <button className="watch-button" aria-label={`Remove ${symbol}`} onClick={onRemove} type="button">×</button>}</div><div className="card-quote"><strong>{value}</strong><div className={`change ${(quote?.change ?? 0) >= 0 ? 'up' : 'down'}`}>{change} <em>{secondaryChange}</em></div></div></div></div><div className="quote-meta"><span className={`source-badge ${real ? 'real' : unavailable ? 'unavailable' : 'fallback'}`}>{statusText}</span><span>{sourceText}</span><span>{timeText}</span></div><MarketTrendChart symbol={symbol} range={range} onRange={onRange} livePrice={quote?.value} liveUpdatedAt={quote?.updatedAt} deepHistoryReady={deepHistoryReady} /></article>;
}

function WatchSection({ id, title, symbols, input, setInput, add, remove, quotes, range, onRange, logoKind, flashes, deepHistoryReady }: { id: string; title: BilingualLabel; symbols: string[]; input: string; setInput: (value: string) => void; add: (event: React.FormEvent) => void; remove: (symbol: string) => void; quotes: Record<string, ApiQuote>; range: Range; onRange: (range: Range) => void; logoKind: Exclude<AssetLogoKind, 'overview'>; flashes: Record<string, 'up' | 'down'>; deepHistoryReady: boolean }) {
  return <section className="watchlist-section" id={id}><div className="compact-section-heading"><Bilingual label={title} /><span>{symbols.length}/{maxSymbols}</span><form className="watchlist-tools" onSubmit={add}><input aria-label={`Add ${title.en}`} maxLength={10} onChange={(event) => setInput(event.target.value)} placeholder="Add ticker" value={input} /><button type="submit">Add</button></form></div><div className="market-grid watchlist-grid">{symbols.map((symbol) => <MarketCard key={symbol} symbol={symbol} quote={quotes[symbol]} range={range} onRange={onRange} onRemove={() => remove(symbol)} logoKind={logoKind} flash={flashes[symbol]} deepHistoryReady={deepHistoryReady} />)}</div></section>;
}

export type InitialDashboardData = { stocks: string[]; etfs: string[]; quotes: Record<string, ApiQuote>; fetchedAt: number | null };

export default function DashboardClient({ initialData }: { initialData: InitialDashboardData }) {
  const [stocks, setStocks] = useState(initialData.stocks); const [etfs, setEtfs] = useState(initialData.etfs); const [stockInput, setStockInput] = useState(''); const [etfInput, setEtfInput] = useState(''); const [quotes, setQuotes] = useState<Record<string, ApiQuote>>(initialData.quotes); const [range, setRange] = useState<Range>('1Y'); const [sidebarOpen, setSidebarOpen] = useState(false); const [liveState, setLiveState] = useState<'connecting' | 'live' | 'reconnecting'>(initialData.fetchedAt ? 'live' : 'connecting'); const [lastUpdated, setLastUpdated] = useState<number | null>(initialData.fetchedAt); const [flashes, setFlashes] = useState<Record<string, 'up' | 'down'>>({}); const [historyReady, setHistoryReady] = useState(false); const [deepHistoryReady, setDeepHistoryReady] = useState(false); const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null); const quotesRef = useRef<Record<string, ApiQuote>>(initialData.quotes);
  const liveSymbols = useMemo(() => [...new Set([...stocks, ...etfs])].slice(0, 60), [stocks, etfs]);
  const liveSymbolsKey = liveSymbols.join(',');
  const initialHistorySymbols = useRef([...new Set([...overview.map((item) => item.symbol), ...initialData.stocks, ...initialData.etfs])].slice(0, 68));
  useEffect(() => { localStorage.setItem(stockKey, JSON.stringify(stocks)); writeWatchlistCookie(STOCK_COOKIE, stocks); }, [stocks]);
  useEffect(() => { localStorage.setItem(etfKey, JSON.stringify(etfs)); writeWatchlistCookie(ETF_COOKIE, etfs); }, [etfs]);
  useEffect(() => { quotesRef.current = quotes; }, [quotes]);
  useEffect(() => {
    let cancelled = false;
    let deepTimer: number | null = null;
    const revealTimeout = window.setTimeout(() => { if (!cancelled) setHistoryReady(true); }, 8_000);

    void preloadMarketHistories(initialHistorySymbols.current, '1Y', 12).finally(() => {
      if (cancelled) return;
      window.clearTimeout(revealTimeout);
      setHistoryReady(true);

      deepTimer = window.setTimeout(() => {
        void preloadMarketHistories(initialHistorySymbols.current, '10Y', 6).finally(() => {
          if (!cancelled) setDeepHistoryReady(true);
        });
      }, 250);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(revealTimeout);
      if (deepTimer !== null) window.clearTimeout(deepTimer);
    };
  }, []);
  useEffect(() => { try { const cached = JSON.parse(sessionStorage.getItem(liveQuoteCacheKey) ?? 'null') as { quotes?: Record<string, ApiQuote>; updatedAt?: number } | null; if (cached?.quotes && !initialData.fetchedAt) setQuotes((current) => ({ ...cached.quotes, ...current })); if (cached?.updatedAt && !initialData.fetchedAt) setLastUpdated(cached.updatedAt); } catch { /* Ignore corrupt browser cache. */ } }, [initialData.fetchedAt]);
  useEffect(() => {
    if (!liveSymbolsKey) return;
    let disposed = false;
    let inFlight = false;
    let activeController: AbortController | null = null;
    const poll = async () => {
      if (disposed || inFlight) return;
      inFlight = true;
      activeController = new AbortController();
      try {
        const [liveResponse, overviewResponse] = await Promise.all([
          fetch(`/api/market/quotes?symbols=${encodeURIComponent(liveSymbolsKey)}`, { cache: 'no-store', signal: activeController.signal }),
          fetch('/api/market?overviewOnly=1', { cache: 'no-store', signal: activeController.signal }),
        ]);
        if (!liveResponse.ok || !overviewResponse.ok) throw new Error('Live market refresh failed');
        const liveData = await liveResponse.json() as { quotes: Record<string, ApiQuote>; fetchedAt: number };
        const overviewData = await overviewResponse.json() as {
          quotes?: Record<string, ApiQuote>;
          treasury?: Record<string, ApiQuote>;
          crypto?: Record<string, ApiQuote>;
          fetchedAt?: number;
        };
        if (disposed) return;
        const overviewQuotes: Record<string, ApiQuote> = Object.fromEntries(
          Object.entries(overviewData.quotes ?? {}).filter(([, quote]) => isUsableQuote(quote)),
        );
        if (isUsableQuote(overviewData.crypto?.bitcoin)) overviewQuotes.BTC = overviewData.crypto.bitcoin;
        if (isUsableQuote(overviewData.treasury?.US10Y)) overviewQuotes.US10Y = overviewData.treasury.US10Y;
        const nextQuotes = { ...overviewQuotes, ...liveData.quotes };
        const changed: Record<string, 'up' | 'down'> = {};
        for (const [symbol, quote] of Object.entries(nextQuotes)) {
          const previous = quotesRef.current[symbol]?.value;
          if (typeof previous === 'number' && quote.value !== previous) changed[symbol] = quote.value > previous ? 'up' : 'down';
        }
        setQuotes((current) => ({ ...current, ...nextQuotes }));
        if (Object.keys(changed).length) {
          setFlashes(changed);
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setFlashes({}), 650);
        }
        const updatedAt = Date.now();
        setLiveState('live');
        setLastUpdated(updatedAt);
        sessionStorage.setItem(liveQuoteCacheKey, JSON.stringify({ quotes: nextQuotes, updatedAt }));
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === 'AbortError')) setLiveState('reconnecting');
      } finally {
        inFlight = false;
      }
    };
    setLiveState((current) => current === 'live' ? current : 'connecting');
    const interval = window.setInterval(() => void poll(), 3_000);
    return () => { disposed = true; window.clearInterval(interval); activeController?.abort(); };
  }, [liveSymbolsKey]);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
  if (!historyReady) {
    return <main className="dashboard-bootstrap"><div className="dashboard-bootstrap-card"><BrandLogo /><strong>Longview Terminal</strong><span>正在准备市场数据与长期走势</span><small>Loading market data and long-term charts…</small><i /></div></main>;
  }

  const add = (kind: 'stock' | 'etf') => (event: React.FormEvent) => { event.preventDefault(); const value = (kind === 'stock' ? stockInput : etfInput).trim().toUpperCase(); const list = kind === 'stock' ? stocks : etfs; if (!tickerPattern.test(value) || list.includes(value) || list.length >= maxSymbols) return; if (kind === 'stock') { setStocks([...list, value]); setStockInput(''); } else { setEtfs([...list, value]); setEtfInput(''); } };
  const nav: Array<[string, string, BilingualLabel]> = [['#overview', '▦', moduleLabels.overview], ['#stocks', '⌁', moduleLabels.stocks], ['#etfs', '▤', moduleLabels.etfs], ['/dca', '◫', moduleLabels.dcaSimulation]];
  return <main className="app-shell"><aside className={`sidebar${sidebarOpen ? ' mobile-open' : ''}`}><div className="brand"><div className="brand-mark"><BrandLogo /></div><div><strong>全球市场</strong><small>Global Market<br />长期主义，<br />少即是多。</small></div></div><nav>{nav.map(([href, icon, label]) => <a className={`nav-item${href === '#overview' ? ' active' : ''}`} href={href} key={href} onClick={() => setSidebarOpen(false)}><span className="nav-icon">{icon}</span><Bilingual label={label} /></a>)}</nav></aside>{sidebarOpen && <button aria-label="Close navigation" className="mobile-sidebar-scrim" onClick={() => setSidebarOpen(false)} type="button" />}<section className="content"><section className="primary-markets" id="overview"><div className="section-kicker"><button className="mobile-nav-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} type="button">☰</button><span>◈</span> <Bilingual label={moduleLabels.marketOverview} /><div className={`live-quote-status ${liveState}`}><span className="live-dot" /><span><b>{liveState === 'reconnecting' ? '连接中' : '实时行情'}</b><small>{liveState === 'reconnecting' ? 'Reconnecting' : 'Live · 3s'}</small></span><time><b>最后更新</b><small>{lastUpdated ? new Date(lastUpdated).toLocaleTimeString('en-GB') : '—'}</small></time></div></div><div className="primary-market-grid">{overview.map((item) => <MarketCard key={item.symbol} symbol={item.symbol} quote={quotes[item.symbol]} label={item} range={range} onRange={setRange} deepHistoryReady={deepHistoryReady} />)}</div></section><WatchSection id="stocks" title={{ en: 'My Stocks', zh: '我的股票' }} symbols={stocks} input={stockInput} setInput={setStockInput} add={add('stock')} remove={(symbol) => setStocks(stocks.filter((item) => item !== symbol))} quotes={quotes} range={range} onRange={setRange} logoKind="stock" flashes={flashes} deepHistoryReady={deepHistoryReady} /><WatchSection id="etfs" title={{ en: 'My ETFs', zh: '我的 ETF' }} symbols={etfs} input={etfInput} setInput={setEtfInput} add={add('etf')} remove={(symbol) => setEtfs(etfs.filter((item) => item !== symbol))} quotes={quotes} range={range} onRange={setRange} logoKind="etf" flashes={flashes} deepHistoryReady={deepHistoryReady} /><LegalDisclaimer /></section></main>;
}

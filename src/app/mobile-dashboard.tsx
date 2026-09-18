'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { assetLabels, type BilingualLabel } from './bilingual-labels';
import type { ApiQuote } from './market-data';
import MarketTrendChart, { type LongRange } from './market-candlestick-chart';
import AssetLogo from './asset-logo';
import type { AssetLogoKind } from './asset-logos';
import BrandLogo from './brand-logo';

export type MobileAssetSelection = {
  symbol: string;
  label: BilingualLabel;
  kind: AssetLogoKind;
};

function formatValue(symbol: string, quote?: ApiQuote) {
  if (!quote) return '—';
  if (symbol === 'US10Y') return `${quote.value.toFixed(2)}%`;
  return quote.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(symbol: string, quote?: ApiQuote) {
  if (!quote) return '—';
  if (symbol === 'US10Y') return `${quote.change >= 0 ? '+' : ''}${(quote.change * 100).toFixed(0)} bp`;
  return `${quote.percent >= 0 ? '+' : ''}${quote.percent.toFixed(2)}%`;
}

function quoteTone(quote?: ApiQuote) {
  return (quote?.change ?? 0) >= 0 ? 'up' : 'down';
}

export function MobileTerminalHeader({ liveState, lastUpdated }: { liveState: 'connecting' | 'live' | 'reconnecting'; lastUpdated: number | null }) {
  return (
    <header className="mobile-terminal-header">
      <div className="mobile-terminal-brand">
        <span className="mobile-terminal-logo"><BrandLogo /></span>
        <span><b>Longview Terminal</b><small>全球市场</small></span>
      </div>
      <div className={`mobile-terminal-live ${liveState}`}>
        <i />
        <span><b>{liveState === 'live' ? '实时' : '连接中'}</b><small>{lastUpdated ? new Date(lastUpdated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</small></span>
      </div>
    </header>
  );
}

export function MobileOverviewCard({ item, quote, onSelect }: { item: BilingualLabel & { symbol: string }; quote?: ApiQuote; onSelect: (selection: MobileAssetSelection) => void }) {
  return (
    <button className="mobile-overview-card" onClick={() => onSelect({ symbol: item.symbol, label: item, kind: 'overview' })} type="button">
      <div className="mobile-overview-title">
        <AssetLogo ticker={item.symbol} kind="overview" />
        <span><b>{item.zh}</b><small>{item.en}</small></span>
      </div>
      <strong>{formatValue(item.symbol, quote)}</strong>
      <span className={`mobile-overview-change ${quoteTone(quote)}`}>{formatChange(item.symbol, quote)}</span>
    </button>
  );
}

export function MobileWatchSection({
  id,
  title,
  symbols,
  input,
  setInput,
  add,
  remove,
  quotes,
  logoKind,
  onSelect,
}: {
  id: string;
  title: BilingualLabel;
  symbols: string[];
  input: string;
  setInput: (value: string) => void;
  add: (event: FormEvent) => void;
  remove: (symbol: string) => void;
  quotes: Record<string, ApiQuote>;
  logoKind: Exclude<AssetLogoKind, 'overview'>;
  onSelect: (selection: MobileAssetSelection) => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="mobile-watch-section" id={id}>
      <div className="mobile-watch-heading">
        <span><b>{title.zh}</b><small>{title.en}</small></span>
        <div><em>{symbols.length}/30</em><button aria-label={`Add ${title.en}`} onClick={() => setAdding((value) => !value)} type="button">{adding ? '×' : '+'}</button></div>
      </div>

      {adding && (
        <form className="mobile-add-ticker" onSubmit={(event) => { add(event); setAdding(false); }}>
          <input autoFocus aria-label={`Add ${title.en}`} maxLength={10} onChange={(event) => setInput(event.target.value)} placeholder="输入 Ticker / Add ticker" value={input} />
          <button type="submit">添加 <small>Add</small></button>
        </form>
      )}

      <div className="mobile-asset-list">
        {symbols.map((symbol) => {
          const label = assetLabels[symbol] ?? { zh: logoKind === 'stock' ? '美股' : 'ETF', en: symbol };
          const quote = quotes[symbol];
          return (
            <div className="mobile-asset-row" key={symbol}>
              <button className="mobile-asset-main" onClick={() => onSelect({ symbol, label, kind: logoKind })} type="button">
                <AssetLogo ticker={symbol} kind={logoKind} />
                <span className="mobile-asset-name"><b>{label.zh}</b><small>{label.en}</small></span>
                <span className="mobile-asset-quote"><b>{formatValue(symbol, quote)}</b><small className={quoteTone(quote)}>{formatChange(symbol, quote)}</small></span>
                <span className="mobile-row-chevron">›</span>
              </button>
              <button className="mobile-row-remove" aria-label={`Remove ${symbol}`} onClick={() => remove(symbol)} type="button">×</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function MobileAssetSheet({ selection, quote, onClose }: { selection: MobileAssetSelection; quote?: ApiQuote; onClose: () => void }) {
  const [range, setRange] = useState<LongRange>('1Y');

  useEffect(() => {
    setRange('1Y');
  }, [selection.symbol]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const isTreasury = selection.symbol === 'US10Y';
  const source = quote?.source ?? 'Data unavailable';
  const time = isTreasury ? quote?.dataDate ?? '—' : quote?.updatedAt ? new Date(quote.updatedAt).toLocaleTimeString('en-GB') : '—';

  return (
    <div className="mobile-asset-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section aria-label={`${selection.symbol} details`} className="mobile-asset-sheet" role="dialog" aria-modal="true">
        <div className="mobile-sheet-handle" />
        <header className="mobile-sheet-header">
          <div className="mobile-sheet-identity">
            <AssetLogo ticker={selection.symbol} kind={selection.kind} />
            <span><b>{selection.label.zh}</b><small>{selection.label.en} · {selection.symbol}</small></span>
          </div>
          <button aria-label="Close details" onClick={onClose} type="button">×</button>
        </header>

        <div className="mobile-sheet-quote">
          <strong>{formatValue(selection.symbol, quote)}</strong>
          <span className={quoteTone(quote)}>{formatChange(selection.symbol, quote)}</span>
        </div>

        <MarketTrendChart
          symbol={selection.symbol}
          range={range}
          onRange={setRange}
          livePrice={quote?.value}
          liveUpdatedAt={quote?.updatedAt}
        />

        <div className="mobile-sheet-meta">
          <span><b>数据源</b><small>Source</small><em>{source}</em></span>
          <span><b>更新时间</b><small>Updated</small><em>{time}</em></span>
        </div>
      </section>
    </div>
  );
}

export function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <a href="#overview"><b>◈</b><span>总览<small>Overview</small></span></a>
      <a href="#stocks"><b>⌁</b><span>股票<small>Stocks</small></span></a>
      <a href="#etfs"><b>▤</b><span>ETF<small>ETFs</small></span></a>
      <a href="/dca"><b>◫</b><span>定投<small>DCA</small></span></a>
    </nav>
  );
}

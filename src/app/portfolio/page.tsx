'use client';

import { useEffect, useState } from 'react';
import LegalDisclaimer from '../legal-disclaimer';
import PortfolioSimulator from '../dca/portfolio-simulator';
import '../dca/dca.css';
import '../dca/portfolio-simulator.css';

type AssetChoice = { symbol: string; type: 'Stock' | 'ETF' };

const stockKey = 'longview-stocks-v4';
const etfKey = 'longview-etfs-v4';
const defaultStocks = ['NVDA', 'TSLA', 'AMZN', 'AVGO', 'MU', 'PDD', 'AAPL', 'MSFT', 'META', 'GOOGL', 'COST', 'NFLX', 'RDDT', 'BRK.B', 'AMD', 'INTC', 'TSM', 'MRVL'];
const defaultEtfs = ['QQQM', 'SPYM', 'DIA', 'SMH', 'VGT', 'SOXX', 'SPMO', 'RSP', 'SCHD', 'AVUV', 'XLK', 'XLV', 'VT', 'HACK', 'VXUS', 'VYMI', 'IGV', 'FMTM'];

function readSymbols(key: string, fallback: string[]) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    return Array.isArray(stored)
      ? stored.filter((item): item is string => typeof item === 'string')
      : fallback;
  } catch {
    return fallback;
  }
}

export default function PortfolioPage() {
  const [supported, setSupported] = useState<AssetChoice[]>([]);

  useEffect(() => {
    const stocks = readSymbols(stockKey, defaultStocks).map((symbol) => ({ symbol, type: 'Stock' as const }));
    const etfs = readSymbols(etfKey, defaultEtfs).map((symbol) => ({ symbol, type: 'ETF' as const }));
    setSupported(
      [...stocks, ...etfs].filter(
        (item, index, list) => list.findIndex((candidate) => candidate.symbol === item.symbol) === index,
      ),
    );
  }, []);

  return (
    <main className="dca-page">
      <header className="dca-header">
        <a href="/" className="dca-back">← 返回市场看板<span>Dashboard</span></a>
        <div>
          <h1>持仓模拟</h1>
          <p>Portfolio Simulator</p>
        </div>
        <span className="simulation-mode"><b>实时账户模拟</b><small>Live Portfolio Mode</small></span>
      </header>

      <PortfolioSimulator supported={supported} />
      <LegalDisclaimer />
    </main>
  );
}

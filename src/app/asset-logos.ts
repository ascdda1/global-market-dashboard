export type AssetLogoKind = 'stock' | 'etf' | 'overview';

// Only add entries after the ticker-to-brand relationship and the local asset have been
// manually verified. Unknown symbols intentionally fall back to a plain ticker badge.
export const stockLogoPaths: Readonly<Record<string, string>> = {
  AAPL: '/logos/stocks/AAPL.svg',
  AVGO: '/logos/stocks/AVGO.svg',
  GOOGL: '/logos/stocks/GOOGL.svg',
  META: '/logos/stocks/META.svg',
  NFLX: '/logos/stocks/NFLX.svg',
  NVDA: '/logos/stocks/NVDA.svg',
  RDDT: '/logos/stocks/RDDT.svg',
  TSLA: '/logos/stocks/TSLA.svg',
};

// ETF artwork is deliberately empty until an ETF or issuer mark has been manually verified and
// saved under public/logos/etfs. Never infer an ETF logo from its holdings or its ticker name.
export const etfLogoPaths: Readonly<Record<string, string>> = {};

export function getAssetLogoPath(ticker: string, kind: AssetLogoKind) {
  if (kind === 'stock') return stockLogoPaths[ticker];
  if (kind === 'etf') return etfLogoPaths[ticker];
  return undefined;
}

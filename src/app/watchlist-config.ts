export const MAX_WATCHLIST_SYMBOLS = 30;
export const STOCK_COOKIE = 'marketflow_stocks';
export const ETF_COOKIE = 'marketflow_etfs';

export const DEFAULT_STOCKS = ['NVDA', 'MU', 'TSLA', 'AAPL', 'AVGO', 'MSFT', 'META', 'AMZN', 'GOOGL', 'COST', 'WMT', 'PDD', 'NFLX', 'RDDT', 'BRK.B'];
export const DEFAULT_ETFS = ['QQQM', 'SPYM', 'DIA', 'SMH', 'VGT', 'SOXX', 'SCHD', 'RSP', 'SPMO', 'AVUV'];

const tickerPattern = /^[A-Z][A-Z0-9.-]{0,9}$/;

export function parseWatchlistCookie(value: string | undefined, fallback: string[]) {
  if (!value) return fallback;
  try {
    const parsed = decodeURIComponent(value).split(',').map((symbol) => symbol.trim().toUpperCase());
    const symbols = [...new Set(parsed.filter((symbol) => tickerPattern.test(symbol)))].slice(0, MAX_WATCHLIST_SYMBOLS);
    return symbols.length ? symbols : fallback;
  } catch {
    return fallback;
  }
}

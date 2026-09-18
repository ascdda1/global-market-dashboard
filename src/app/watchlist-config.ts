export const MAX_WATCHLIST_SYMBOLS = 30;
export const STOCK_COOKIE = 'longview_stocks_v2';
export const ETF_COOKIE = 'longview_etfs_v2';

export const DEFAULT_STOCKS = ['NVDA', 'TSLA', 'AMZN', 'AVGO', 'MU', 'PDD', 'AAPL', 'MSFT', 'META', 'GOOGL', 'COST', 'NFLX', 'RDDT', 'BRK.B', 'AMD', 'INTC', 'TSM', 'MRVL'];
export const DEFAULT_ETFS = ['QQQM', 'SPYM', 'DIA', 'SMH', 'VGT', 'SOXX', 'SPMO', 'RSP', 'SCHD', 'AVUV', 'XLK', 'XLV', 'VT', 'HACK', 'VXUS', 'VYMI', 'IGV', 'FMTM'];

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

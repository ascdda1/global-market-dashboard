import { cookies } from 'next/headers';
import DashboardClient, { type InitialDashboardData } from './dashboard-client';
import type { ApiQuote, MarketApiResponse } from './market-data';
import { GET as getMarket } from './api/market/route';
import { GET as getLiveQuotes } from './api/market/quotes/route';
import { DEFAULT_ETFS, DEFAULT_STOCKS, ETF_COOKIE, parseWatchlistCookie, STOCK_COOKIE } from './watchlist-config';

type LiveQuoteResponse = { quotes?: Record<string, ApiQuote>; fetchedAt?: number };

async function readJson<T>(response: Response) {
  if (!response.ok) return null;
  return response.json() as Promise<T>;
}

function realQuote(quote: ApiQuote | undefined) {
  return quote && quote.updatedAt > 0 && !/fallback|mock|模拟/i.test(quote.source) ? quote : undefined;
}

export default async function Page() {
  const cookieStore = await cookies();
  const stocks = parseWatchlistCookie(cookieStore.get(STOCK_COOKIE)?.value, DEFAULT_STOCKS);
  const etfs = parseWatchlistCookie(cookieStore.get(ETF_COOKIE)?.value, DEFAULT_ETFS);
  const symbols = [...new Set([...stocks, ...etfs])].slice(0, 60);

  const [marketResult, quoteResult] = await Promise.allSettled([
    getMarket(new Request('http://dashboard.internal/api/market?overviewOnly=1')).then((response) => readJson<MarketApiResponse>(response)),
    getLiveQuotes(new Request(`http://dashboard.internal/api/market/quotes?symbols=${encodeURIComponent(symbols.join(','))}`)).then((response) => readJson<LiveQuoteResponse>(response)),
  ]);
  const market = marketResult.status === 'fulfilled' ? marketResult.value : null;
  const live = quoteResult.status === 'fulfilled' ? quoteResult.value : null;
  const overviewQuotes = Object.fromEntries(Object.entries(market?.quotes ?? {}).filter(([, quote]) => realQuote(quote)));
  const bitcoin = realQuote(market?.crypto.bitcoin);
  const treasury = realQuote(market?.treasury.US10Y);
  const quotes: Record<string, ApiQuote> = { ...overviewQuotes, ...(bitcoin ? { BTC: bitcoin } : {}), ...(treasury ? { US10Y: treasury } : {}), ...(live?.quotes ?? {}) };
  const initialData: InitialDashboardData = { stocks, etfs, quotes, fetchedAt: live?.fetchedAt ?? market?.fetchedAt ?? null };
  return <DashboardClient initialData={initialData} />;
}

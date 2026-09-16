import type { KeyPeopleResponse, KeyPersonUpdate, MarketNewsItem, MarketNewsResponse } from './market-data';

export interface NewsProvider {
  getNews(): Promise<MarketNewsResponse>;
}

export interface KeyPeopleProvider {
  getUpdates(): Promise<KeyPeopleResponse>;
}

const mockUrl = 'https://example.com/';

function mockPublishedAt(minutesAgo: number) {
  return Date.now() - minutesAgo * 60_000;
}

export class FallbackNewsProvider implements NewsProvider {
  async getNews(): Promise<MarketNewsResponse> {
    const items: MarketNewsItem[] = [
      { id: 'mock-markets-1', title: 'Mock: Global equity market session overview', summary: 'Structured placeholder for a future verified market-news provider.', source: 'Fallback / mock feed', publishedAt: mockPublishedAt(18), category: 'Markets', url: mockUrl, relatedSymbols: ['^GSPC', '^IXIC'] },
      { id: 'mock-macro-1', title: 'Mock: Upcoming macro data release coverage', summary: 'Placeholder headline; no real-time release or market interpretation is provided.', source: 'Fallback / mock feed', publishedAt: mockPublishedAt(42), category: 'Macro', url: mockUrl },
      { id: 'mock-tech-1', title: 'Mock: Technology sector information placeholder', summary: 'Structured item reserved for a future licensed technology-news source.', source: 'Fallback / mock feed', publishedAt: mockPublishedAt(75), category: 'AI & Tech', url: mockUrl, relatedSymbols: ['NVDA', 'MSFT'] },
      { id: 'mock-semis-1', title: 'Mock: Semiconductor industry update placeholder', summary: 'No external article content is included in this fallback feed.', source: 'Fallback / mock feed', publishedAt: mockPublishedAt(105), category: 'Semiconductors', url: mockUrl, relatedSymbols: ['NVDA', 'MU'] },
      { id: 'mock-crypto-1', title: 'Mock: Digital asset market information placeholder', summary: 'Reserved for a future verified crypto-market news provider.', source: 'Fallback / mock feed', publishedAt: mockPublishedAt(144), category: 'Crypto', url: mockUrl, relatedSymbols: ['BTC', 'ETH'] },
      { id: 'mock-china-1', title: 'Mock: China market and policy information placeholder', summary: 'Structured placeholder only; it does not represent a current report.', source: 'Fallback / mock feed', publishedAt: mockPublishedAt(180), category: 'China', url: mockUrl },
    ];
    return { items, source: 'Fallback / mock feed', isFallback: true, lastUpdated: Date.now(), errors: ['实时 Market News provider 尚未配置，当前显示 fallback/mock 数据'] };
  }
}

export class FallbackKeyPeopleProvider implements KeyPeopleProvider {
  async getUpdates(): Promise<KeyPeopleResponse> {
    const items: KeyPersonUpdate[] = [
      { id: 'mock-powell', person: 'Jerome Powell', role: 'Central bank official', category: 'Central Banks', headline: 'Mock: Public central-bank communication placeholder', summary: 'Reserved for verified public communications from an official source.', source: 'Fallback / mock feed', publishedAt: mockPublishedAt(32), url: mockUrl, topics: ['monetary policy'] },
      { id: 'mock-huang', person: 'Jensen Huang', role: 'Technology executive', category: 'Technology', headline: 'Mock: Public technology-industry communication placeholder', summary: 'No real-world statement or article is represented by this fallback item.', source: 'Fallback / mock feed', publishedAt: mockPublishedAt(66), url: mockUrl, relatedSymbols: ['NVDA'], topics: ['semiconductors'] },
      { id: 'mock-musk', person: 'Elon Musk', role: 'Technology executive', category: 'Technology', headline: 'Mock: Public technology communication placeholder', summary: 'Reserved for a future licensed or official public-information provider.', source: 'Fallback / mock feed', publishedAt: mockPublishedAt(97), url: mockUrl, relatedSymbols: ['TSLA'], topics: ['technology'] },
      { id: 'mock-altman', person: 'Sam Altman', role: 'Technology executive', category: 'Technology', headline: 'Mock: Public AI-industry communication placeholder', summary: 'Structured fallback item only; no live update is implied.', source: 'Fallback / mock feed', publishedAt: mockPublishedAt(129), url: mockUrl, topics: ['AI & Tech'] },
      { id: 'mock-cz', person: 'CZ', role: 'Crypto executive', category: 'Crypto', headline: 'Mock: Public digital-assets communication placeholder', summary: 'Reserved for a future verified public-information source.', source: 'Fallback / mock feed', publishedAt: mockPublishedAt(168), url: mockUrl, relatedSymbols: ['BTC', 'ETH'], topics: ['crypto'] },
      { id: 'mock-trump', person: 'Donald Trump', role: 'Policy figure', category: 'Politics / Policy', headline: 'Mock: Market-relevant public policy information placeholder', summary: 'Fallback item only; it contains no political evaluation, forecast, or unverified claim.', source: 'Fallback / mock feed', publishedAt: mockPublishedAt(205), url: mockUrl, topics: ['policy'] },
    ];
    return { items, source: 'Fallback / mock feed', isFallback: true, lastUpdated: Date.now(), errors: ['实时 Key People provider 尚未配置，当前显示 fallback/mock 数据'] };
  }
}

const newsProvider: NewsProvider = new FallbackNewsProvider();
const keyPeopleProvider: KeyPeopleProvider = new FallbackKeyPeopleProvider();

export function getMarketNews() {
  return newsProvider.getNews();
}

export function getKeyPeopleUpdates() {
  return keyPeopleProvider.getUpdates();
}

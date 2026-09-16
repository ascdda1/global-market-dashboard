export type MarketItem = {
  symbol: string;
  name: string;
  category: string;
  value: string;
  change: string;
  percent: string;
  positive: boolean;
  spark: string;
  history?: number[];
  source: string;
  updatedAt: number;
  dataDate?: string;
};

export type ApiQuote = {
  value: number;
  change: number;
  percent: number;
  source: string;
  updatedAt: number;
  dataDate?: string;
};

export type TreasuryQuote = ApiQuote & {
  dataDate: string;
};

export type MacroUnit = 'index' | 'thousands' | 'percent' | 'billions';

export type MacroQuote = {
  value: number;
  change: number;
  referencePeriod: string;
  source: string;
  updatedAt: number;
  unit: MacroUnit;
  releaseDate?: string;
};

export type CalendarRegion = 'US' | 'Europe' | 'China' | 'Japan' | 'UK';
export type CalendarImportance = 'high' | 'medium' | 'low';
export type CalendarStatus = 'upcoming' | 'released';

export type EconomicCalendarEvent = {
  id: string;
  region: CalendarRegion;
  event: string;
  date: string;
  time: string;
  importance: CalendarImportance;
  previous: string | null;
  forecast: string | null;
  actual: string | null;
  status: CalendarStatus;
  source: string;
};

export type EconomicCalendarResponse = {
  events: EconomicCalendarEvent[];
  source: string;
  isFallback: boolean;
  lastUpdated: number;
  errors: string[];
};

export type NewsCategory = 'Markets' | 'Macro' | 'AI & Tech' | 'Semiconductors' | 'Crypto' | 'China';

export type MarketNewsItem = {
  id: string;
  title: string;
  summary?: string;
  source: string;
  publishedAt: number;
  category: NewsCategory;
  url: string;
  relatedSymbols?: string[];
};

export type KeyPeopleCategory = 'Central Banks' | 'Technology' | 'Crypto' | 'Politics / Policy';

export type KeyPersonUpdate = {
  id: string;
  person: string;
  role: string;
  category: KeyPeopleCategory;
  headline: string;
  summary?: string;
  source: string;
  publishedAt: number;
  url: string;
  relatedSymbols?: string[];
  topics?: string[];
};

export type MarketNewsResponse = {
  items: MarketNewsItem[];
  source: string;
  isFallback: boolean;
  lastUpdated: number;
  errors: string[];
};

export type KeyPeopleResponse = {
  items: KeyPersonUpdate[];
  source: string;
  isFallback: boolean;
  lastUpdated: number;
  errors: string[];
};

export type MarketApiResponse = {
  quotes: Record<string, ApiQuote>;
  treasury: Record<string, TreasuryQuote>;
  crypto: Record<string, ApiQuote>;
  history: Record<string, number[]>;
  macro: Record<string, MacroQuote>;
  errors: string[];
  fetchedAt: number;
};

export const marketItems: Omit<MarketItem, 'value' | 'change' | 'percent' | 'positive' | 'source' | 'updatedAt'>[] = [
  { symbol: '^DJI', name: '\u9053\u743c\u65af\u5de5\u4e1a\u5e73\u5747\u6307\u6570', category: '\u6307\u6570 \u00b7 \u7f8e\u56fd', spark: 'M2 35 C13 30 23 33 35 23 S48 26 60 17 S74 21 86 13 S103 16 120 5' },
  { symbol: '^GSPC', name: '标普 500', category: '指数 · 美国', spark: 'M2 42 C16 36 20 38 30 32 S46 38 58 27 S76 31 88 18 S106 24 120 10' },
  { symbol: '^IXIC', name: '纳斯达克', category: '指数 · 美国', spark: 'M2 37 C14 40 24 26 34 31 S48 23 58 28 S72 11 84 19 S104 14 120 5' },
  { symbol: 'GC=F', name: '黄金', category: '大宗商品 · 期货', spark: 'M2 12 C16 19 23 15 34 25 S48 20 58 31 S77 27 89 38 S106 34 120 43' },
  { symbol: 'CL=F', name: '原油', category: '大宗商品 · 期货', spark: 'M2 41 C14 35 24 40 34 29 S50 35 60 25 S76 30 88 20 S102 22 120 7' },
];

export function createStockItem(symbol: string): Omit<MarketItem, 'value' | 'change' | 'percent' | 'positive' | 'source' | 'updatedAt'> {
  return {
    symbol,
    name: symbol,
    category: '股票 · 美股',
    spark: 'M2 40 C16 34 22 39 33 28 S48 32 59 24 S75 29 87 17 S104 21 120 8',
  };
}

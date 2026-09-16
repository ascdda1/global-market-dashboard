export type BilingualLabel = {
  en: string;
  zh: string;
};

export const moduleLabels = {
  marketOverview: { en: 'Market Overview', zh: '市场概览' },
  majorMarkets: { en: 'Major Markets', zh: '主要市场' },
  usTreasury: { en: 'US Treasury', zh: '美国国债' },
  crypto: { en: 'Crypto', zh: '加密资产' },
  watchlist: { en: 'My Watchlist', zh: '我的自选' },
  macro: { en: 'US Macro', zh: '美国宏观经济' },
  economicCalendar: { en: 'Economic Calendar', zh: '经济日历' },
  marketNews: { en: 'Market News', zh: '市场新闻' },
  keyPeople: { en: 'Key People', zh: '重要人物' },
  marketInformation: { en: 'Market Information', zh: '市场资讯' },
} satisfies Record<string, BilingualLabel>;

export const assetLabels: Record<string, BilingualLabel> = {
  '^DJI': { en: 'Dow Jones Industrial Average (DJIA)', zh: '\u9053\u743c\u65af\u5de5\u4e1a\u5e73\u5747\u6307\u6570' },
  '^GSPC': { en: 'S&P 500', zh: '标普500指数' },
  '^IXIC': { en: 'Nasdaq Composite', zh: '纳斯达克综合指数' },
  'GC=F': { en: 'Gold', zh: '黄金' },
  'CL=F': { en: 'WTI Crude Oil', zh: 'WTI原油' },
  US2Y: { en: 'US Treasury 2Y', zh: '美国2年期国债收益率' },
  US10Y: { en: 'US Treasury 10Y', zh: '美国10年期国债收益率' },
  US30Y: { en: 'US Treasury 30Y', zh: '美国30年期国债收益率' },
  bitcoin: { en: 'Bitcoin (BTC)', zh: '比特币' },
  ethereum: { en: 'Ethereum (ETH)', zh: '以太坊' },
};

export const macroLabels: Record<string, BilingualLabel> = {
  cpi: { en: 'Consumer Price Index (CPI)', zh: '消费者价格指数' },
  coreCpi: { en: 'Core CPI', zh: '核心消费者价格指数' },
  pce: { en: 'PCE Price Index', zh: '个人消费支出价格指数' },
  corePce: { en: 'Core PCE Price Index', zh: '核心个人消费支出价格指数' },
  nonfarmPayrolls: { en: 'Nonfarm Payrolls', zh: '非农就业人数' },
  unemploymentRate: { en: 'Unemployment Rate', zh: '失业率' },
  gdp: { en: 'Gross Domestic Product (GDP)', zh: '国内生产总值' },
  effectiveFedFundsRate: { en: 'Effective Federal Funds Rate', zh: '有效联邦基金利率' },
};

const calendarEventLabels: Record<string, BilingualLabel> = {
  'Core CPI (MoM)': { en: 'Core CPI (MoM)', zh: '核心消费者价格指数（月率）' },
  'Eurozone CPI (YoY)': { en: 'Eurozone CPI (YoY)', zh: '欧元区消费者价格指数（年率）' },
  'PBOC Loan Prime Rate (1Y)': { en: 'PBOC Loan Prime Rate (1Y)', zh: '中国贷款市场报价利率（1年期）' },
  'Fed Chair Speech': { en: 'Fed Chair Speech', zh: '美联储主席讲话' },
  'CPI (YoY)': { en: 'CPI (YoY)', zh: '消费者价格指数（年率）' },
  'Retail Sales (MoM)': { en: 'Retail Sales (MoM)', zh: '零售销售（月率）' },
  'ECB Interest Rate Decision': { en: 'ECB Interest Rate Decision', zh: '欧洲央行利率决议' },
  'ECB President Press Conference': { en: 'ECB President Press Conference', zh: '欧洲央行行长新闻发布会' },
  'Japan CPI (YoY)': { en: 'Japan CPI (YoY)', zh: '日本消费者价格指数（年率）' },
  'UK CPI (YoY)': { en: 'UK CPI (YoY)', zh: '英国消费者价格指数（年率）' },
  'UK GDP (MoM)': { en: 'UK GDP (MoM)', zh: '英国国内生产总值（月率）' },
  'BOJ Interest Rate Decision': { en: 'BOJ Interest Rate Decision', zh: '日本央行利率决议' },
  'BOJ Governor Press Conference': { en: 'BOJ Governor Press Conference', zh: '日本央行行长新闻发布会' },
  'PPI (MoM)': { en: 'PPI (MoM)', zh: '生产者价格指数（月率）' },
  'FOMC Interest Rate Decision': { en: 'FOMC Interest Rate Decision', zh: '美联储利率决议' },
  'FOMC Press Conference': { en: 'FOMC Press Conference', zh: '美联储新闻发布会' },
  'PCE Price Index (MoM)': { en: 'PCE Price Index (MoM)', zh: '个人消费支出价格指数（月率）' },
  'Core PCE Price Index (MoM)': { en: 'Core PCE Price Index (MoM)', zh: '核心个人消费支出价格指数（月率）' },
  'China CPI (YoY)': { en: 'China CPI (YoY)', zh: '中国消费者价格指数（年率）' },
  'China PPI (YoY)': { en: 'China PPI (YoY)', zh: '中国生产者价格指数（年率）' },
  'Nonfarm Payrolls': { en: 'Nonfarm Payrolls', zh: '非农就业人数' },
  'Unemployment Rate': { en: 'Unemployment Rate', zh: '失业率' },
  'GDP (Annualized QoQ)': { en: 'GDP (Annualized QoQ)', zh: '国内生产总值（年化季率）' },
  'ISM Manufacturing PMI': { en: 'ISM Manufacturing PMI', zh: 'ISM制造业PMI' },
  'ISM Services PMI': { en: 'ISM Services PMI', zh: 'ISM服务业PMI' },
  'Eurozone GDP (QoQ)': { en: 'Eurozone GDP (QoQ)', zh: '欧元区国内生产总值（季率）' },
  'Eurozone Composite PMI': { en: 'Eurozone Composite PMI', zh: '欧元区综合PMI' },
  'China GDP (YoY)': { en: 'China GDP (YoY)', zh: '中国国内生产总值（年率）' },
  'China Manufacturing PMI': { en: 'China Manufacturing PMI', zh: '中国制造业PMI' },
  'BOE Interest Rate Decision': { en: 'BOE Interest Rate Decision', zh: '英国央行利率决议' },
};

export function getCalendarEventLabel(event: string): BilingualLabel {
  return calendarEventLabels[event] ?? { en: event, zh: '经济事件' };
}

const keyPeopleRoleLabels: Record<string, BilingualLabel> = {
  'Jerome Powell': { en: 'Fed Chair', zh: '美联储主席' },
  'Jensen Huang': { en: 'NVIDIA CEO', zh: '英伟达CEO' },
  'Elon Musk': { en: 'Tesla CEO', zh: '特斯拉CEO' },
  'Sam Altman': { en: 'OpenAI CEO', zh: 'OpenAI首席执行官' },
  CZ: { en: 'Crypto Executive', zh: '加密行业高管' },
  'Donald Trump': { en: 'Policy Figure', zh: '政策人物' },
};

export function getKeyPersonRoleLabel(person: string, fallbackRole: string): BilingualLabel {
  return keyPeopleRoleLabels[person] ?? { en: fallbackRole, zh: '市场相关人物' };
}

export type DcaCurvePoint = {
  date: string;
  portfolioValue: number;
  totalInvested: number;
  normalizedValue: number;
};

export type DcaPurchase = {
  scheduledDate: string;
  executionDate: string;
  price: number;
  amount: number;
  shares: number;
};

export type DcaSimulationResult = {
  symbol: string;
  name: string;
  type: 'Stock' | 'ETF' | 'Benchmark';
  requestedStartMonth: string;
  actualStartDate: string;
  endDate: string;
  historicalStartDate: string;
  valuationDate: string;
  weeklyInvestment: number;
  totalInvested: number;
  currentValue: number;
  totalProfit: number;
  totalReturnPercent: number;
  maximumDrawdownPercent: number;
  totalPurchases: number;
  totalShares: number;
  averageCost: number;
  latestPrice: number;
  source: 'Alpaca Market Data' | 'Tencent Finance';
  priceBasis: string;
  historyLimited: boolean;
  curve: DcaCurvePoint[];
  purchases: DcaPurchase[];
};

export type DcaSimulationResponse = {
  result: DcaSimulationResult | null;
  results?: DcaSimulationResult[];
  unavailable?: Array<{ symbol: string; name: string; type: 'Stock' | 'ETF' | 'Benchmark'; reason: string }>;
  error?: string;
};

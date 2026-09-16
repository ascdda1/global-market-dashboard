import type { EconomicCalendarEvent, EconomicCalendarResponse } from './market-data';

export interface EconomicCalendarProvider {
  getEvents(): Promise<EconomicCalendarResponse>;
}

function toDate(offset: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function createMockEvent(
  id: string,
  region: EconomicCalendarEvent['region'],
  event: string,
  offset: number,
  time: string,
  importance: EconomicCalendarEvent['importance'],
  previous: string | null,
  forecast: string | null,
  actual: string | null,
): EconomicCalendarEvent {
  return {
    id,
    region,
    event,
    date: toDate(offset),
    time,
    importance,
    previous,
    forecast,
    actual,
    status: actual === null ? 'upcoming' : 'released',
    source: 'Fallback / mock calendar',
  };
}

export class FallbackEconomicCalendarProvider implements EconomicCalendarProvider {
  async getEvents(): Promise<EconomicCalendarResponse> {
    const events = [
      createMockEvent('us-core-cpi', 'US', 'Core CPI (MoM)', 0, '08:30', 'high', '0.3%', '0.3%', '0.4%'),
      createMockEvent('eu-cpi', 'Europe', 'Eurozone CPI (YoY)', 0, '11:00', 'high', '2.1%', '2.0%', null),
      createMockEvent('china-lpr', 'China', 'PBOC Loan Prime Rate (1Y)', 0, '09:15', 'high', '3.10%', '3.10%', null),
      createMockEvent('fed-chair', 'US', 'Fed Chair Speech', 0, '15:00', 'medium', null, null, null),
      createMockEvent('us-cpi', 'US', 'CPI (YoY)', 1, '08:30', 'high', '3.1%', '3.0%', null),
      createMockEvent('us-retail-sales', 'US', 'Retail Sales (MoM)', 1, '08:30', 'high', '0.2%', '0.4%', null),
      createMockEvent('ecb-decision', 'Europe', 'ECB Interest Rate Decision', 1, '14:15', 'high', '2.15%', '2.15%', null),
      createMockEvent('ecb-president', 'Europe', 'ECB President Press Conference', 1, '14:45', 'high', null, null, null),
      createMockEvent('japan-cpi', 'Japan', 'Japan CPI (YoY)', 1, '07:30', 'high', '2.7%', '2.8%', null),
      createMockEvent('uk-cpi', 'UK', 'UK CPI (YoY)', 2, '02:00', 'high', '3.4%', '3.3%', null),
      createMockEvent('uk-gdp', 'UK', 'UK GDP (MoM)', 2, '02:00', 'high', '0.1%', '0.2%', null),
      createMockEvent('boj-decision', 'Japan', 'BOJ Interest Rate Decision', 2, '03:00', 'high', '0.50%', '0.50%', null),
      createMockEvent('boj-governor', 'Japan', 'BOJ Governor Press Conference', 2, '06:30', 'medium', null, null, null),
      createMockEvent('us-ppi', 'US', 'PPI (MoM)', 2, '08:30', 'high', '0.1%', '0.2%', null),
      createMockEvent('us-fomc', 'US', 'FOMC Interest Rate Decision', 3, '14:00', 'high', '4.25%-4.50%', '4.25%-4.50%', null),
      createMockEvent('us-fomc-press', 'US', 'FOMC Press Conference', 3, '14:30', 'high', null, null, null),
      createMockEvent('us-pce', 'US', 'PCE Price Index (MoM)', 3, '08:30', 'high', '0.2%', '0.2%', null),
      createMockEvent('us-core-pce', 'US', 'Core PCE Price Index (MoM)', 3, '08:30', 'high', '0.3%', '0.3%', null),
      createMockEvent('china-cpi', 'China', 'China CPI (YoY)', 3, '09:30', 'high', '0.1%', '0.2%', null),
      createMockEvent('china-ppi', 'China', 'China PPI (YoY)', 3, '09:30', 'medium', '-2.8%', '-2.5%', null),
      createMockEvent('us-nfp', 'US', 'Nonfarm Payrolls', 4, '08:30', 'high', '140K', '155K', null),
      createMockEvent('us-unemployment', 'US', 'Unemployment Rate', 4, '08:30', 'high', '4.1%', '4.1%', null),
      createMockEvent('us-gdp', 'US', 'GDP (Annualized QoQ)', 4, '08:30', 'high', '2.3%', '2.5%', null),
      createMockEvent('us-ism-manufacturing', 'US', 'ISM Manufacturing PMI', 4, '10:00', 'high', '49.8', '50.2', null),
      createMockEvent('us-ism-services', 'US', 'ISM Services PMI', 4, '10:00', 'high', '52.1', '52.4', null),
      createMockEvent('eu-gdp', 'Europe', 'Eurozone GDP (QoQ)', 4, '05:00', 'high', '0.2%', '0.2%', null),
      createMockEvent('eu-pmi', 'Europe', 'Eurozone Composite PMI', 4, '04:00', 'medium', '50.5', '50.7', null),
      createMockEvent('china-gdp', 'China', 'China GDP (YoY)', 5, '10:00', 'high', '5.0%', '5.0%', null),
      createMockEvent('china-pmi', 'China', 'China Manufacturing PMI', 5, '09:30', 'high', '49.9', '50.2', null),
      createMockEvent('boe-decision', 'UK', 'BOE Interest Rate Decision', 5, '07:00', 'high', '4.25%', '4.25%', null),
    ];

    return {
      events,
      source: 'Fallback / mock calendar',
      isFallback: true,
      lastUpdated: Date.now(),
      errors: ['实时经济日历数据源尚未配置，当前显示结构化 fallback/mock 数据'],
    };
  }
}

const provider: EconomicCalendarProvider = new FallbackEconomicCalendarProvider();

export function getEconomicCalendar() {
  return provider.getEvents();
}

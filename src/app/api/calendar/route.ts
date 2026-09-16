import { NextResponse } from 'next/server';
import { getEconomicCalendar } from '../../economic-calendar-provider';

const cacheTtlMs = 5 * 60_000;
let cachedResponse: Awaited<ReturnType<typeof getEconomicCalendar>> | null = null;
let cacheExpiresAt = 0;

export async function GET() {
  try {
    if (!cachedResponse || cacheExpiresAt <= Date.now()) {
      cachedResponse = await getEconomicCalendar();
      cacheExpiresAt = Date.now() + cacheTtlMs;
    }
    return NextResponse.json(cachedResponse);
  } catch {
    return NextResponse.json({ events: [], source: 'Unavailable', isFallback: true, lastUpdated: Date.now(), errors: ['经济日历暂时无法加载'] }, { status: 200 });
  }
}

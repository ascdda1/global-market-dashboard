import { NextResponse } from 'next/server';
import { getEconomicCalendar } from '../../economic-calendar-provider';
import { safeErrorMessage, sanitizePublicErrors } from '../safe-error';

const cacheTtlMs = 5 * 60_000;
let cachedResponse: Awaited<ReturnType<typeof getEconomicCalendar>> | null = null;
let cacheExpiresAt = 0;

export async function GET() {
  try {
    if (!cachedResponse || cacheExpiresAt <= Date.now()) {
      cachedResponse = await getEconomicCalendar();
      cacheExpiresAt = Date.now() + cacheTtlMs;
    }
    return NextResponse.json({ ...cachedResponse, errors: sanitizePublicErrors('Economic Calendar', cachedResponse.errors) });
  } catch {
    return NextResponse.json({ events: [], source: 'Unavailable', isFallback: true, lastUpdated: Date.now(), errors: [safeErrorMessage('Economic Calendar')] }, { status: 200 });
  }
}

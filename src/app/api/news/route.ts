import { NextResponse } from 'next/server';
import { getMarketNews } from '../../information-providers';
import { safeErrorMessage, sanitizePublicErrors } from '../safe-error';

const cacheTtlMs = 5 * 60_000;
let cachedResponse: Awaited<ReturnType<typeof getMarketNews>> | null = null;
let cacheExpiresAt = 0;

export async function GET() {
  try {
    if (!cachedResponse || cacheExpiresAt <= Date.now()) {
      cachedResponse = await getMarketNews();
      cacheExpiresAt = Date.now() + cacheTtlMs;
    }
    return NextResponse.json({ ...cachedResponse, errors: sanitizePublicErrors('Market News', cachedResponse.errors) });
  } catch {
    return NextResponse.json({ items: [], source: 'Unavailable', isFallback: true, lastUpdated: Date.now(), errors: [safeErrorMessage('Market News')] });
  }
}

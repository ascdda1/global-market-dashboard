import { NextResponse } from 'next/server';
import { getKeyPeopleUpdates } from '../../information-providers';
import { safeErrorMessage, sanitizePublicErrors } from '../safe-error';

const cacheTtlMs = 5 * 60_000;
let cachedResponse: Awaited<ReturnType<typeof getKeyPeopleUpdates>> | null = null;
let cacheExpiresAt = 0;

export async function GET() {
  try {
    if (!cachedResponse || cacheExpiresAt <= Date.now()) {
      cachedResponse = await getKeyPeopleUpdates();
      cacheExpiresAt = Date.now() + cacheTtlMs;
    }
    return NextResponse.json({ ...cachedResponse, errors: sanitizePublicErrors('Key People', cachedResponse.errors) });
  } catch {
    return NextResponse.json({ items: [], source: 'Unavailable', isFallback: true, lastUpdated: Date.now(), errors: [safeErrorMessage('Key People')] });
  }
}

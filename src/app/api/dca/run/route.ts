import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runDcaSimulation } from '../../../dca/server';
import { safeErrorMessage } from '../../safe-error';

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret); const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await runDcaSimulation()) });
  } catch (error) {
    console.warn('DCA runner failed', { category: error instanceof Error && /\b[1-5]\d{2}\b/.test(error.message) ? 'http' : 'upstream' });
    return NextResponse.json({ ok: false, error: safeErrorMessage('DCA simulation runner') }, { status: 200 });
  }
}

import { NextResponse } from 'next/server';
import { getDcaData } from '../../dca/server';
import { safeErrorMessage } from '../safe-error';

export async function GET() {
  try {
    return NextResponse.json(await getDcaData());
  } catch (error) {
    console.warn('DCA read failed', { category: error instanceof Error && /\b[1-5]\d{2}\b/.test(error.message) ? 'http' : 'upstream' });
    return NextResponse.json({ configured: false, positions: [], transactions: [], weeklyTotal: 0, nextDcaDate: null, error: safeErrorMessage('DCA simulation database') }, { status: 200 });
  }
}

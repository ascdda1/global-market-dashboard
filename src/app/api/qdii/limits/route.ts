import { NextResponse } from 'next/server';
import { readQdiiLimits, upsertQdiiLimit } from '../../../qdii/server';

export async function GET() {
  try {
    return NextResponse.json({ limits: await readQdiiLimits() });
  } catch {
    return NextResponse.json({ limits: [], error: 'QDII limit store unavailable' }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const secret = process.env.QDII_ADMIN_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret) {
    return NextResponse.json({ error: 'Admin secret not configured' }, { status: 401 });
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as {
    fundCode?: string;
    shareClass?: string;
    distributorLimit?: string;
    directLimit?: string;
    updatedAt?: string;
  };

  if (!body.fundCode || !body.shareClass || !body.updatedAt) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const result = await upsertQdiiLimit({
      fundCode: body.fundCode.trim(),
      shareClass: body.shareClass.trim(),
      distributorLimit: body.distributorLimit?.trim() ?? '',
      directLimit: body.directLimit?.trim() ?? '',
      updatedAt: body.updatedAt,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Save failed';
    return NextResponse.json({ error: /Supabase is not configured/.test(message) ? 'Supabase server credentials not configured' : 'Database write failed' }, { status: 500 });
  }
}

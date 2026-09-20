import { NextResponse } from 'next/server';

type Holding = { code:string; name:string; weight:number|null };

function findFundStocks(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    const direct = value.filter((item): item is Record<string, unknown> =>
      !!item && typeof item === 'object' && ('GPJC' in item || 'GPDM' in item || 'JZBL' in item)
    );
    if (direct.length) return direct;
    for (const item of value) {
      const found = findFundStocks(item);
      if (found.length) return found;
    }
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.fundStocks)) return obj.fundStocks as Record<string, unknown>[];
    for (const child of Object.values(obj)) {
      const found = findFundStocks(child);
      if (found.length) return found;
    }
  }
  return [];
}

function text(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function numberOrNull(value: unknown) {
  const n = Number(String(value ?? '').replace('%','').trim());
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code')?.trim();
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error:'invalid code' }, { status:400 });
  }

  try {
    const params = new URLSearchParams({
      FCODE: code,
      appType: 'ttjj',
      deviceid: '3EA024C2-7F22-408B-95E4-383D38160FB3',
      plat: 'Iphone',
      product: 'EFund',
      serverVersion: '6.2.8',
      version: '6.2.8',
    });
    const response = await fetch(
      `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNInverstPosition?${params.toString()}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15',
          Referer: `https://fund.eastmoney.com/${code}.html`,
        },
        next: { revalidate: 21600 },
      }
    );
    if (!response.ok) throw new Error(`holdings ${response.status}`);
    const json = await response.json() as Record<string, unknown>;
    const rows = findFundStocks(json).slice(0,10);
    const holdings: Holding[] = rows.map(row => ({
      code: text(row.GPDM ?? row.SECURITYCODE ?? row.code),
      name: text(row.GPJC ?? row.SECURITYSHORTNAME ?? row.name) || '未命名持仓',
      weight: numberOrNull(row.JZBL ?? row.HOLDINGRATIO ?? row.weight),
    }));
    const disclosureDate = text(json.Expansion ?? json.expansion ?? json.DATE ?? json.date) || null;

    return NextResponse.json({
      code,
      disclosureDate,
      holdings,
      source: 'Eastmoney / 天天基金公开持仓',
    });
  } catch {
    return NextResponse.json({
      code,
      disclosureDate:null,
      holdings:[],
      source:'Eastmoney / 天天基金公开持仓',
      unavailable:true,
    });
  }
}

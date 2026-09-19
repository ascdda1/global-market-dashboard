type QdiiLimitRow = {
  fund_code: string;
  share_class: string;
  distributor_limit: string | null;
  direct_limit: string | null;
  updated_at: string;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key, legacyJwt: key.startsWith('eyJ') };
}

export async function readQdiiLimits(): Promise<QdiiLimitRow[]> {
  const c = config();
  if (!c) return [];
  const response = await fetch(
    `${c.url}/rest/v1/qdii_purchase_limits?select=fund_code,share_class,distributor_limit,direct_limit,updated_at&order=fund_code.asc`,
    { headers: c.legacyJwt ? { apikey: c.key, Authorization: `Bearer ${c.key}` } : { apikey: c.key }, cache: 'no-store' },
  );
  if (!response.ok) throw new Error(`QDII limit read failed: ${response.status}`);
  return response.json() as Promise<QdiiLimitRow[]>;
}

export async function upsertQdiiLimit(input: {
  fundCode: string;
  shareClass: string;
  distributorLimit: string;
  directLimit: string;
  updatedAt: string;
}) {
  const c = config();
  if (!c) throw new Error('Supabase is not configured');
  const response = await fetch(`${c.url}/rest/v1/qdii_purchase_limits?on_conflict=fund_code,share_class`, {
    method: 'POST',
    headers: {
      apikey: c.key,
      ...(c.legacyJwt ? { Authorization: `Bearer ${c.key}` } : {}),
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([{
      fund_code: input.fundCode,
      share_class: input.shareClass,
      distributor_limit: input.distributorLimit || null,
      direct_limit: input.directLimit || null,
      updated_at: input.updatedAt,
    }]),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`QDII limit update failed: ${response.status}`);
  return response.json();
}

create table if not exists public.qdii_purchase_limits (
  fund_code text not null,
  share_class text not null,
  distributor_limit text,
  direct_limit text,
  updated_at date not null default current_date,
  modified_at timestamptz not null default now(),
  primary key (fund_code, share_class)
);

alter table public.qdii_purchase_limits enable row level security;

comment on table public.qdii_purchase_limits is
  'Manual QDII purchase-limit overrides. Accessed server-side with the Supabase service role only.';

create table if not exists public.dca_positions_initial (
  symbol text primary key,
  initial_shares numeric(18, 6) not null check (initial_shares > 0),
  initial_average_cost numeric(18, 6) not null check (initial_average_cost > 0),
  initial_cost numeric(18, 6) generated always as (initial_shares * initial_average_cost) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.dca_plan (
  symbol text primary key references public.dca_positions_initial(symbol),
  weekly_amount numeric(18, 2) not null check (weekly_amount > 0),
  frequency text not null check (frequency = 'weekly'),
  weekday smallint not null check (weekday between 0 and 6),
  start_date date not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.dca_transactions (
  id uuid primary key default gen_random_uuid(),
  scheduled_date date not null,
  execution_date date not null,
  symbol text not null references public.dca_positions_initial(symbol),
  amount numeric(18, 2) not null check (amount > 0),
  close_price numeric(18, 6) not null check (close_price > 0),
  shares_added numeric(18, 6) not null check (shares_added > 0),
  price_source text not null,
  created_at timestamptz not null default now(),
  constraint dca_transactions_symbol_scheduled_date_key unique (symbol, scheduled_date)
);

insert into public.dca_positions_initial (symbol, initial_shares, initial_average_cost)
values
  ('QQQM', 25.637100, 280.350000),
  ('SPYM', 84.173000, 88.510000),
  ('SMH', 9.355800, 546.340000),
  ('VGT', 40.579800, 118.860000)
on conflict (symbol) do nothing;

insert into public.dca_plan (symbol, weekly_amount, frequency, weekday, start_date, enabled)
values
  ('QQQM', 200.00, 'weekly', 4, '2026-09-17', true),
  ('SPYM', 200.00, 'weekly', 4, '2026-09-17', true),
  ('SMH', 200.00, 'weekly', 4, '2026-09-17', true),
  ('VGT', 200.00, 'weekly', 4, '2026-09-17', true)
on conflict (symbol) do nothing;

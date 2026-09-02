-- Sequence for auto-numbered quotations: COT-2026-0001
create sequence if not exists public.quotation_number_seq start 1;

-- Quotations table
create table if not exists public.quotations (
  id                  uuid primary key default gen_random_uuid(),
  number              text unique not null default ('COT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.quotation_number_seq')::text, 4, '0')),
  client_id           uuid not null references public.clients(id) on delete restrict,
  status              text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'rejected')),
  includes            text,
  excludes            text,
  conditions          text,
  initial_payment_pct numeric(5,2) not null default 80,
  final_payment_pct   numeric(5,2) not null default 20,
  subtotal            numeric(14,2) not null default 0,
  total               numeric(14,2) not null default 0,
  created_by          uuid not null references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists quotations_client_id_idx on public.quotations (client_id);
create index if not exists quotations_status_idx on public.quotations (status);

-- Quotation items (partidas)
create table if not exists public.quotation_items (
  id            uuid primary key default gen_random_uuid(),
  quotation_id  uuid not null references public.quotations(id) on delete cascade,
  description   text not null,
  dimensions    text,
  quantity      numeric(12,2) not null default 1,
  unit_price    numeric(14,2) not null default 0,
  total         numeric(14,2) not null default 0,
  sort_order    integer not null default 0
);

create index if not exists quotation_items_quotation_id_idx on public.quotation_items (quotation_id);

-- Enable RLS
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;

-- Quotations policies
create policy "Authenticated users can view quotations"
  on public.quotations for select to authenticated using (true);

create policy "Authenticated users can create quotations"
  on public.quotations for insert to authenticated
  with check (auth.uid() = created_by);

create policy "Authenticated users can update quotations"
  on public.quotations for update to authenticated using (true);

-- Quotation items policies
create policy "Authenticated users can view quotation items"
  on public.quotation_items for select to authenticated using (true);

create policy "Authenticated users can insert quotation items"
  on public.quotation_items for insert to authenticated
  with check (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_id and q.created_by = auth.uid()
    )
  );

create policy "Authenticated users can update quotation items"
  on public.quotation_items for update to authenticated using (true);

-- Auto updated_at
create or replace trigger quotations_updated_at
  before update on public.quotations
  for each row execute procedure public.set_updated_at();

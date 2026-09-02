-- Create clients table
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references auth.users(id),
  name        text not null,
  email       text,
  phone       text,
  address     text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index for fast lookups by name
create index if not exists clients_name_idx on public.clients (name);

-- Enable Row Level Security
alter table public.clients enable row level security;

-- Authenticated users can see all clients
create policy "Authenticated users can view clients"
  on public.clients
  for select
  to authenticated
  using (true);

-- Authenticated users can create clients
create policy "Authenticated users can create clients"
  on public.clients
  for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Authenticated users can update any client
create policy "Authenticated users can update clients"
  on public.clients
  for update
  to authenticated
  using (true);

-- Auto-set updated_at
create or replace trigger clients_updated_at
  before update on public.clients
  for each row execute procedure public.set_updated_at();

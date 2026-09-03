-- Execute uma vez no SQL Editor para ativar a lista de clientes.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null unique,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;
drop policy if exists "Admin gerencia clientes" on public.customers;
create policy "Admin gerencia clientes" on public.customers
for all to authenticated using (true) with check (true);

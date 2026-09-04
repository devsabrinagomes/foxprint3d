-- Execute este arquivo no SQL Editor se você já executou supabase-setup.sql antes.

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(), customer text not null, contact text default '',
  description text not null, total numeric(10,2) not null default 0, discount numeric(10,2) not null default 0, paid numeric(10,2) not null default 0,
  payment_method text default 'Pix', status text not null default 'pendente', sale_date date not null default current_date,
  due_date date, notes text default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.sales enable row level security;
drop policy if exists "Admin gerencia vendas" on public.sales;
create policy "Admin gerencia vendas" on public.sales for all to authenticated using (true) with check (true);
alter table public.sales add column if not exists discount numeric(10,2) not null default 0;
alter table public.sales add column if not exists delivered boolean not null default false;
alter table public.sales add column if not exists delivered_at timestamptz;

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(), title text not null, stage text not null default 'ideias',
  priority text not null default 'normal', estimated_minutes integer default 0, due_date date, notes text default '',
  position integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.print_jobs enable row level security;
drop policy if exists "Admin gerencia fila" on public.print_jobs;
create policy "Admin gerencia fila" on public.print_jobs for all to authenticated using (true) with check (true);

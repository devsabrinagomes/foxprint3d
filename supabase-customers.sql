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

-- Importa os clientes das vendas feitas antes da criação desta tabela.
-- Contatos vazios são ignorados e contatos repetidos geram somente um cliente.
insert into public.customers (name, contact, marketing_consent)
select distinct on (normalized_contact)
  customer_name,
  normalized_contact,
  false
from (
  select
    trim(customer) as customer_name,
    lower(regexp_replace(trim(contact), '\s+', ' ', 'g')) as normalized_contact,
    sale_date,
    created_at
  from public.sales
  where nullif(trim(contact), '') is not null
    and nullif(trim(customer), '') is not null
) old_sales
order by normalized_contact, sale_date desc, created_at desc
on conflict (contact) do nothing;

-- Execute uma vez no SQL Editor para ativar descontos nas vendas existentes.
alter table public.sales
add column if not exists discount numeric(10,2) not null default 0;

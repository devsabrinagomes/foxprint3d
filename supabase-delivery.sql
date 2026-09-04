-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- Ele adiciona o controle de entrega às vendas já existentes.

alter table public.sales
  add column if not exists delivered boolean not null default false,
  add column if not exists delivered_at timestamptz;


create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10,2),
  category text not null default 'presentes',
  tag text not null default 'Sob encomenda',
  images text[] not null default '{}',
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
create policy "Produtos ativos são públicos" on public.products for select to anon using (active = true);
create policy "Admin lê todos os produtos" on public.products for select to authenticated using (true);
create policy "Admin cadastra produtos" on public.products for insert to authenticated with check (true);
create policy "Admin altera produtos" on public.products for update to authenticated using (true) with check (true);
create policy "Admin exclui produtos" on public.products for delete to authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "Fotos são públicas" on storage.objects for select to public using (bucket_id = 'products');
create policy "Admin envia fotos" on storage.objects for insert to authenticated with check (bucket_id = 'products');
create policy "Admin altera fotos" on storage.objects for update to authenticated using (bucket_id = 'products');
create policy "Admin exclui fotos" on storage.objects for delete to authenticated using (bucket_id = 'products');

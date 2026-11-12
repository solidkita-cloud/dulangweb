-- ==============================================================================
-- DULANG INDONESIA - SUPABASE SECURITY & RLS HARDENING v3.0
-- Jalankan di Supabase Dashboard -> SQL Editor -> New Query -> Run
-- Memperbaiki P0-01 s/d P0-09 tanpa memutus alur aplikasi pembeli/kasir:
--   1. Memindahkan sys_auth_meta keluar dari tabel publik menus ke sys_auth privat
--   2. Memfilter sys_% agar tidak bocor lewat Public read menus
--   3. Menutup SELECT massal pada customers, orders, dan qr_codes (hmac)
--   4. Menyediakan RPC SECURITY DEFINER non-PII untuk ?track=, ?scan=, dan store_config publik
-- ==============================================================================

-- 1. TABEL PRIVAT AUTH STAF (TERKUNCI TOTAL DARI ANON)
create table if not exists public.sys_auth (
  id text primary key default 'main',
  owner_hash text not null,
  cashier_hash text not null,
  kitchen_hash text not null,
  is_default_owner_pin boolean default true,
  updated_at timestamptz default now()
);

alter table public.sys_auth enable row level security;

-- Pastikan TIDAK ADA policy anon/authenticated untuk sys_auth (hanya service_role / Edge / Vercel API)
drop policy if exists "Public read auth" on public.sys_auth;
drop policy if exists "Service manage sys_auth" on public.sys_auth;
create policy "Service manage sys_auth" on public.sys_auth
  for all to service_role using (true) with check (true);

-- Migrasi otomatis hash lama jika sebelumnya tersimpan di menus.id = 'sys_auth_meta'
do $$
declare
  raw_desc text;
  meta_json jsonb;
begin
  select deskripsi into raw_desc from public.menus where id = 'sys_auth_meta' limit 1;
  if raw_desc is not null then
    meta_json := raw_desc::jsonb;
    insert into public.sys_auth (id, owner_hash, cashier_hash, kitchen_hash, is_default_owner_pin, updated_at)
    values (
      'main',
      coalesce(meta_json->>'ownerHash', 'pbkdf2_v1$d600a3c2317e10622a37525015903379$d91f0d2479d56afcf2501cd296bc9478b19c37db977fda3e4c1c1767b9bba6ca'),
      coalesce(meta_json->>'cashierHash', 'pbkdf2_v1$076eca1007f8cf5897e4bc0e2fa5ca32$9801b4e12cdef1b4656bbb0465578991bb5b7808612096b7b07da593a1479b45'),
      coalesce(meta_json->>'kitchenHash', 'pbkdf2_v1$f8fe87b6d51feedf69f053d3c17ea112$ea693caacdecb49149f65ed426a069d253133fbe8a35f711184f5c45aac0b518'),
      coalesce((meta_json->>'isDefaultOwnerPin')::boolean, true),
      now()
    )
    on conflict (id) do update set
      owner_hash = excluded.owner_hash,
      cashier_hash = excluded.cashier_hash,
      kitchen_hash = excluded.kitchen_hash,
      is_default_owner_pin = excluded.is_default_owner_pin,
      updated_at = excluded.updated_at;

    -- Hapus baris sys_auth_meta dari tabel publik menus setelah dipindah
    delete from public.menus where id = 'sys_auth_meta';
  end if;
exception when others then
  raise notice 'Catatan migrasi sys_auth_meta: %', sqlerrm;
end $$;

-- 2. TABEL SERVER AUDIT LOG APPEND-ONLY
create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_role text not null,
  action text not null,
  details text,
  severity text default 'INFO',
  created_at timestamptz default now()
);

alter table public.audit_logs enable row level security;
drop policy if exists "Service manage audit_logs" on public.audit_logs;
create policy "Service manage audit_logs" on public.audit_logs
  for all to service_role using (true) with check (true);

-- 3. PERKETAT RLS TABEL MENUS (BLOKIR BARIS INTERNAL sys_*)
alter table public.menus enable row level security;
drop policy if exists "Public read menus" on public.menus;
create policy "Public read menus" on public.menus
  for select to anon, authenticated using (id not like 'sys_%');

drop policy if exists "Admin manage menus" on public.menus;
create policy "Admin manage menus" on public.menus
  for all to service_role using (true) with check (true);

-- 4. PERKETAT RLS CUSTOMERS, QR_CODES, ORDERS & EXPENSES
alter table public.customers enable row level security;
drop policy if exists "Anon select customers" on public.customers;
drop policy if exists "Anon select own customer" on public.customers;
drop policy if exists "Anon register customer" on public.customers;
create policy "Anon register customer" on public.customers
  for insert to anon with check (true);
drop policy if exists "Admin full customers" on public.customers;
create policy "Admin full customers" on public.customers
  for all to service_role using (true) with check (true);

alter table public.qr_codes enable row level security;
drop policy if exists "Public read qr" on public.qr_codes;
drop policy if exists "Admin manage qr" on public.qr_codes;
create policy "Admin manage qr" on public.qr_codes
  for all to service_role using (true) with check (true);

alter table public.orders enable row level security;
drop policy if exists "Anon insert order" on public.orders;
create policy "Anon insert order" on public.orders
  for insert to anon with check (true);
drop policy if exists "Admin manage orders" on public.orders;
create policy "Admin manage orders" on public.orders
  for all to service_role using (true) with check (true);

alter table public.expenses enable row level security;
drop policy if exists "Admin manage expenses" on public.expenses;
create policy "Admin manage expenses" on public.expenses
  for all to service_role using (true) with check (true);

-- 5. RPC AMAN NON-PII UNTUK PENGUNJUNG PUBLIK (SECURITY DEFINER)

-- A. Store config publik tanpa kolom rekening bank, komisi ojol, target kasir, atau PIN
create or replace function public.get_public_store_config()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_desc text;
  cfg jsonb;
begin
  select deskripsi into raw_desc from public.menus where id = 'sys_store_config' limit 1;
  if raw_desc is null then
    return '{}'::jsonb;
  end if;
  cfg := raw_desc::jsonb;
  return cfg
    - 'ownerPin'
    - 'cashierPin'
    - 'kitchenPin'
    - 'bankBCA'
    - 'bankMandiri'
    - 'qrisNmid'
    - 'qrisImage'
    - 'qrisTeks'
    - 'gofoodCommissionPercent'
    - 'shopeefoodCommissionPercent'
    - 'grabfoodCommissionPercent'
    - 'cashierDailyTargetPortions'
    - 'cashierBonusPerPortion'
    - 'deletedMenuIds';
end;
$$;
revoke all on function public.get_public_store_config() from public;
grant execute on function public.get_public_store_config() to anon, authenticated;

-- B. Lacak pesanan (?track=) untuk 1 order ID saja, tanpa WA / alamat / kecamatan pelanggan
create or replace function public.get_public_order_track(p_order_id text)
returns table (
  id text,
  customer_name text,
  items jsonb,
  total_price int,
  delivery_method text,
  shipping_cost int,
  payment_method text,
  status text,
  channel text,
  kitchen_status text,
  cooking_started_at timestamptz,
  cooking_completed_at timestamptz,
  delivery_schedule text,
  delivery_slot text,
  created_at timestamptz,
  completed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    o.id,
    coalesce(nullif(split_part(trim(o.customer_name), ' ', 1), ''), 'Pelanggan') as customer_name,
    o.items,
    o.total_price,
    o.delivery_method,
    coalesce(o.shipping_cost, 0) as shipping_cost,
    o.payment_method,
    o.status,
    o.channel,
    coalesce(o.kitchen_status, 'antre') as kitchen_status,
    o.cooking_started_at,
    o.cooking_completed_at,
    o.delivery_schedule,
    o.delivery_slot,
    o.created_at,
    o.completed_at
  from public.orders o
  where upper(o.id) = upper(trim(p_order_id))
    and coalesce(o.status, '') <> 'dihapus'
  limit 1;
$$;
revoke all on function public.get_public_order_track(text) from public;
grant execute on function public.get_public_order_track(text) to anon, authenticated;

-- C. Lookup 1 pelanggan untuk Smart QR (?scan=) tanpa WA/alamat mentah dan tanpa SELECT *
create or replace function public.verify_and_lookup_qr(p_qr_id text)
returns table (
  id text,
  qr_code_id text,
  name text,
  area text,
  district text,
  city text,
  favorite_menu text,
  favorite_option text,
  total_orders int,
  status text,
  birth_day int,
  birth_month int,
  consent_at timestamptz,
  first_scan_at timestamptz,
  last_scan_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    c.qr_code_id,
    coalesce(nullif(split_part(trim(c.name), ' ', 1), ''), 'Pelanggan') as name,
    c.area,
    c.district,
    c.city,
    c.favorite_menu,
    c.favorite_option,
    c.total_orders,
    c.status,
    c.birth_day,
    c.birth_month,
    c.consent_at,
    c.first_scan_at,
    c.last_scan_at
  from public.customers c
  where upper(c.qr_code_id) = upper(trim(p_qr_id))
  limit 1;
$$;
revoke all on function public.verify_and_lookup_qr(text) from public;
grant execute on function public.verify_and_lookup_qr(text) to anon, authenticated;

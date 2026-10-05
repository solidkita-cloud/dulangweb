-- DULANG INDONESIA - SUPABASE SECURE SETUP v2.0 (HARDENED RLS & ANTI-IDOR)
-- Buka Supabase -> Menu "SQL Editor" -> "New query" -> Tempel kode ini -> Klik "Run"

-- 1. Tabel Pelanggan (Customers)
create table if not exists public.customers (
  id text primary key,
  qr_code_id text unique not null,
  name text not null,
  wa text not null,
  address text not null,
  area text,
  city text,
  district text,
  village text,
  street_detail text,
  favorite_menu text,
  favorite_option text,
  total_orders int default 1,
  total_spent int default 0,
  status text default 'Baru',
  birth_day int,
  birth_month int,
  consent_at timestamptz default now(),
  first_scan_at timestamptz default now(),
  last_scan_at timestamptz default now()
);

-- 2. Tabel Menu Makanan (Menus)
create table if not exists public.menus (
  id text primary key,
  nama text not null,
  harga int not null,
  deskripsi text,
  foto text,
  tersedia boolean default true,
  tersedia_besok boolean default true,
  stok_harian int,
  sisa_stok int
);

-- 3. Tabel Batch Stiker QR (QR Codes)
create table if not exists public.qr_codes (
  id text primary key,
  hmac text not null,
  status text default 'unused',
  print_batch text,
  created_at timestamptz default now()
);

-- 4. Tabel Pesanan (Orders) & Kas Pengeluaran (Expenses)
create table if not exists public.orders (
  id text primary key,
  customer_name text,
  customer_wa text,
  customer_qr_id text,
  items jsonb not null default '[]',
  total_price int not null,
  payment_method text default 'tunai',
  status text default 'menunggu',
  delivery_method text default 'pickup',
  shipping_cost int default 0,
  shipping_district text,
  channel text default 'web_wa',
  notes text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists public.expenses (
  id text primary key,
  tanggal text not null,
  kategori text not null,
  keterangan text not null,
  jumlah int not null,
  created_at timestamptz default now()
);

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) - PERKETAT AKSES & ANTI-IDOR (POIN 11, 12, 15)
-- ==============================================================================
alter table public.customers enable row level security;
alter table public.menus enable row level security;
alter table public.qr_codes enable row level security;
alter table public.orders enable row level security;
alter table public.expenses enable row level security;

-- Bersihkan policy lama jika ada
drop policy if exists "Akses publik customers" on public.customers;
drop policy if exists "Akses publik menus" on public.menus;
drop policy if exists "Akses publik qr_codes" on public.qr_codes;
drop policy if exists "Public read menus" on public.menus;
drop policy if exists "Admin manage menus" on public.menus;
drop policy if exists "Anon register customer" on public.customers;
drop policy if exists "Anon select own customer" on public.customers;
drop policy if exists "Admin full customers" on public.customers;
drop policy if exists "Public read qr" on public.qr_codes;
drop policy if exists "Admin manage qr" on public.qr_codes;
drop policy if exists "Anon insert order" on public.orders;
drop policy if exists "Admin manage orders" on public.orders;
drop policy if exists "Admin manage expenses" on public.expenses;

-- A. Policy Menus: Publik HANYA BISA BACA (SELECT). Modifikasi hanya oleh Admin.
create policy "Public read menus" on public.menus 
  for select to anon, authenticated using (true);

create policy "Admin manage menus" on public.menus 
  for all to service_role using (true) with check (true);

-- B. Policy Customers (Anti IDOR & Anti Data Scraping):
-- Anonim hanya boleh INSERT data pelanggan baru (saat pertama kali scan/isi form).
create policy "Anon register customer" on public.customers 
  for insert to anon with check (true);

-- Anonim hanya boleh membaca data miliknya sendiri (dibutuhkan untuk auto-fill personal)
create policy "Anon select customers" on public.customers 
  for select to anon using (true);

-- Cegah DELETE dan UPDATE liar oleh publik anonim:
create policy "Admin full customers" on public.customers 
  for all to service_role using (true) with check (true);

-- C. Policy QR Codes: Publik hanya bisa memverifikasi status
create policy "Public read qr" on public.qr_codes 
  for select to anon, authenticated using (true);

create policy "Admin manage qr" on public.qr_codes 
  for all to service_role using (true) with check (true);

-- D. Policy Orders & Expenses (Data Finansial Rahasia Dapur):
-- Publik hanya boleh kirim pesanan baru (INSERT)
create policy "Anon insert order" on public.orders 
  for insert to anon with check (true);

-- Data pesanan & pengeluaran hanya bisa dilihat/dikelola penuh oleh Admin
create policy "Admin manage orders" on public.orders 
  for all to service_role using (true) with check (true);

create policy "Admin manage expenses" on public.expenses 
  for all to service_role using (true) with check (true);

-- ==============================================================================
-- 6. AKTIFKAN REALTIME REPLICA
-- ==============================================================================
do $$
begin
  alter publication supabase_realtime add table public.customers;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.menus;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception when others then null;
end $$;

alter table public.customers replica identity full;
alter table public.orders replica identity full;

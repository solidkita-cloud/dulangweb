-- DULANG INDONESIA - SUPABASE SCHEMA v1.1 - ANTI-HALU LOCKED
-- Source of truth = Supabase, localStorage = cache only
-- Run in Supabase SQL editor

-- Enable extensions
create extension if not exists "pgcrypto";
create extension if not exists "pgsodium";

-- 1. qr_codes
create table qr_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (char_length(code)=8),
  hmac_signature text not null check (char_length(hmac_signature)=16),
  status text not null default 'UNUSED' check (status in ('UNUSED','ASSIGNED','ACTIVE','REVOKED','EXPIRED')),
  print_batch text,
  created_at timestamptz default now(),
  assigned_at timestamptz,
  revoked_at timestamptz,
  version int default 1
);
create index idx_qr_codes_code on qr_codes(code);
create index idx_qr_codes_status on qr_codes(status);

-- 2. customers (PII encrypted)
create table customers (
  id uuid primary key default gen_random_uuid(),
  qr_code_id uuid references qr_codes(id) unique,
  name text not null,
  wa_encrypted text not null,
  address_encrypted text not null,
  area text check (area in ('Waru','Gedangan','Buduran','Sidoarjo Kota','Taman','Candi','Wonoayu','Krian','Lainnya')),
  favorite_menu text,
  total_orders int default 0 check (total_orders >=0),
  consent_at timestamptz not null,
  consent_version text default 'v1.0',
  first_scan_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  sync_status text default 'SYNCED' check (sync_status in ('PENDING','SYNCING','SYNCED','FAILED','CONFLICT')),
  device_id text,
  last_synced_at timestamptz
);

-- 3. menus
create table menus (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  harga int not null check (harga >0),
  deskripsi text,
  foto_url text,
  tersedia boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  version int default 1
);

-- 4. scans
create table scans (
  id uuid primary key default gen_random_uuid(),
  qr_code_id uuid references qr_codes(id),
  customer_id uuid references customers(id),
  scanned_at timestamptz default now(),
  ip_hash text,
  action text check (action in ('VIEW','CLAIM','REORDER')),
  user_agent_hash text
);

-- 5. orders
create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) not null,
  qr_code_id uuid references qr_codes(id) not null,
  status text not null default 'CREATED' check (status in ('CREATED','SENT_TO_WA','CONFIRMED','COMPLETED','CANCELLED')),
  total_amount int not null check (total_amount >=0),
  created_at timestamptz default now(),
  confirmed_at timestamptz,
  completed_at timestamptz,
  wa_message_id text,
  mutation_id text unique
);

-- 6. order_items
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  menu_id uuid references menus(id),
  qty int not null check (qty >0 and qty <100),
  price_snapshot int not null,
  subtotal int not null
);

-- 7. store_config
create table store_config (
  id text primary key default 'main',
  hero_image_url text,
  jam_buka_text text default '10.00 - 19.30 (kalo habis ya tutup duluan)',
  schedules jsonb default '[{"label":"Subuh","time":"03.00 - 05.00","desc":"Bangun & siapin adonan"}]',
  owner_pin_hash text not null,
  updated_at timestamptz default now()
);

-- 8. owner_sessions
create table owner_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id text default 'owner',
  token_hash text not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  revoked boolean default false
);

-- 9. audit_logs
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text,
  action text,
  entity text,
  entity_id uuid,
  timestamp timestamptz default now(),
  ip_hash text
);

-- 10. view loyalty
create or replace view v_customer_loyalty as
select c.*, case when total_orders >=5 then 'Sultan Dulang' when total_orders >=2 then 'Setia' else 'Baru' end as loyalty_tier from customers c;

-- RLS
alter table qr_codes enable row level security;
alter table customers enable row level security;
alter table menus enable row level security;
alter table scans enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

create policy "anon read menus" on menus for select to anon using (true);
create policy "anon insert scans" on scans for insert to anon with check (true);
create policy "owner all qr" on qr_codes for all to authenticated using (true);
create policy "owner all customers" on customers for all to authenticated using (true);

-- Seed config (hash of dulang2020 must be replaced with real bcrypt in prod)
insert into store_config (id, owner_pin_hash) values ('main', '$2a$10$examplehashofdulang2020mustbereplaced') on conflict (id) do nothing;

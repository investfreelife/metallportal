-- =============================================
-- МЕТАЛЛПОРТАЛ — Database Schema
-- Run this in the Supabase SQL Editor
-- =============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- =============================================
-- ENUMS
-- =============================================

create type user_role as enum ('buyer', 'supplier', 'admin');
create type request_type as enum ('price_request', 'custom_order', 'smeta_upload', 'callback');
create type request_status as enum ('new', 'in_progress', 'quoted', 'completed', 'cancelled');

-- =============================================
-- USERS
-- =============================================

create table users (
  id          uuid primary key default uuid_generate_v4(),
  email       text unique not null,
  full_name   text,
  phone       text,
  company_name text,
  inn         text,
  role        user_role not null default 'buyer',
  is_verified boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_users_email on users (email);
create index idx_users_role on users (role);

-- =============================================
-- CATEGORIES  (self-referencing for subcategories)
-- =============================================

create table categories (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text unique not null,
  description text,
  icon        text,
  image_url   text,
  parent_id   uuid references categories (id) on delete set null,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index idx_categories_slug on categories (slug);
create index idx_categories_parent on categories (parent_id);

-- =============================================
-- SUPPLIERS
-- =============================================

create table suppliers (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references users (id) on delete cascade,
  company_name   text not null,
  inn            text not null,
  kpp            text,
  ogrn           text,
  legal_address  text,
  contact_person text,
  contact_phone  text,
  contact_email  text,
  description    text,
  logo_url       text,
  is_verified    boolean not null default false,
  rating         numeric(3,2) not null default 0.00,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index idx_suppliers_user on suppliers (user_id);
create index idx_suppliers_inn on suppliers (inn);

-- =============================================
-- PRODUCTS
-- =============================================

create table products (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  slug            text unique not null,
  description     text,
  category_id     uuid not null references categories (id) on delete restrict,
  supplier_id     uuid not null references suppliers (id) on delete cascade,
  gost            text,
  material        text,
  dimensions      text,
  weight_per_unit numeric(12,4),
  unit            text not null default 'т',
  image_url       text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_products_slug on products (slug);
create index idx_products_category on products (category_id);
create index idx_products_supplier on products (supplier_id);
create index idx_products_name on products using gin (to_tsvector('russian', name));

-- =============================================
-- PRICE_ITEMS  (pricing per product per supplier)
-- =============================================

create table price_items (
  id              uuid primary key default uuid_generate_v4(),
  product_id      uuid not null references products (id) on delete cascade,
  supplier_id     uuid not null references suppliers (id) on delete cascade,
  base_price      numeric(14,2) not null,
  discount_price  numeric(14,2),
  min_quantity    numeric(12,2) not null default 1,
  currency        text not null default 'RUB',
  in_stock        boolean not null default true,
  stock_quantity  numeric(12,2),
  delivery_days   int,
  valid_from      timestamptz not null default now(),
  valid_until     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_price_items_product on price_items (product_id);
create index idx_price_items_supplier on price_items (supplier_id);
create index idx_price_items_stock on price_items (in_stock) where in_stock = true;

-- =============================================
-- REQUESTS  (price requests, custom orders, smeta uploads)
-- =============================================

create table requests (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid references users (id) on delete set null,
  type           request_type not null,
  status         request_status not null default 'new',
  message        text,
  contact_name   text,
  contact_phone  text,
  contact_email  text,
  file_url       text,
  metadata       jsonb,
  assigned_to    uuid references users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_requests_user on requests (user_id);
create index idx_requests_status on requests (status);
create index idx_requests_type on requests (type);

-- =============================================
-- AUTO-UPDATE updated_at TRIGGER
-- =============================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at
  before update on users for each row execute function update_updated_at();

create trigger trg_suppliers_updated_at
  before update on suppliers for each row execute function update_updated_at();

create trigger trg_products_updated_at
  before update on products for each row execute function update_updated_at();

create trigger trg_price_items_updated_at
  before update on price_items for each row execute function update_updated_at();

create trigger trg_requests_updated_at
  before update on requests for each row execute function update_updated_at();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

alter table users enable row level security;
alter table categories enable row level security;
alter table suppliers enable row level security;
alter table products enable row level security;
alter table price_items enable row level security;
alter table requests enable row level security;

-- Public read access to categories, products, price_items
create policy "Categories are viewable by everyone"
  on categories for select using (is_active = true);

create policy "Products are viewable by everyone"
  on products for select using (is_active = true);

create policy "Price items are viewable by everyone"
  on price_items for select using (true);

create policy "Suppliers are viewable by everyone"
  on suppliers for select using (true);

-- Users can read/update their own row
create policy "Users can view own profile"
  on users for select using (auth.uid() = id);

create policy "Users can update own profile"
  on users for update using (auth.uid() = id);

-- Suppliers can manage their own products
create policy "Suppliers can insert own products"
  on products for insert with check (
    supplier_id in (select s.id from suppliers s where s.user_id = auth.uid())
  );

create policy "Suppliers can update own products"
  on products for update using (
    supplier_id in (select s.id from suppliers s where s.user_id = auth.uid())
  );

-- Suppliers can manage their own prices
create policy "Suppliers can insert own prices"
  on price_items for insert with check (
    supplier_id in (select s.id from suppliers s where s.user_id = auth.uid())
  );

create policy "Suppliers can update own prices"
  on price_items for update using (
    supplier_id in (select s.id from suppliers s where s.user_id = auth.uid())
  );

-- Anyone can create a request; users can view their own
create policy "Anyone can create requests"
  on requests for insert with check (true);

create policy "Users can view own requests"
  on requests for select using (auth.uid() = user_id);

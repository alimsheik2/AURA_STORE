-- Migration: complete_marketplace_features
-- Wishlists, coupons, disputes, store followers, reviews, dynamic attributes.

create extension if not exists pgcrypto;

-- 1. Wishlists Table & RLS
create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);
alter table public.wishlists enable row level security;

drop policy if exists "Users manage their own wishlist" on public.wishlists;
create policy "Users manage their own wishlist" on public.wishlists
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2. Coupons Table & RLS
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  min_spend numeric(10,2) not null default 0,
  shop_id uuid references public.shops(id) on delete cascade,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.coupons enable row level security;

drop policy if exists "Anyone can read active coupons" on public.coupons;
create policy "Anyone can read active coupons" on public.coupons
  for select using (active = true or public.is_admin() or shop_id in (select id from public.shops where owner_id = auth.uid()));

drop policy if exists "Admins and Vendors can manage coupons" on public.coupons;
create policy "Admins and Vendors can manage coupons" on public.coupons
  for all to authenticated
  using (public.is_admin() or shop_id in (select id from public.shops where owner_id = auth.uid()))
  with check (public.is_admin() or shop_id in (select id from public.shops where owner_id = auth.uid()));

insert into public.coupons(code, discount_type, discount_value, min_spend, active)
values
  ('WELCOME10', 'percentage', 10.00, 20.00, true),
  ('AURA5', 'fixed', 5.00, 30.00, true)
on conflict (code) do nothing;

-- 3. Disputes Table & RLS
create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete set null,
  reason text not null,
  evidence_url text,
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved_refund', 'resolved_rejected', 'closed')),
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.disputes enable row level security;

drop policy if exists "Users and Admins view disputes" on public.disputes;
create policy "Users and Admins view disputes" on public.disputes
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or shop_id in (select id from public.shops where owner_id = auth.uid()));

drop policy if exists "Users create disputes" on public.disputes;
create policy "Users create disputes" on public.disputes
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Admins update disputes" on public.disputes;
create policy "Admins update disputes" on public.disputes
  for update to authenticated
  using (public.is_admin() or shop_id in (select id from public.shops where owner_id = auth.uid()));

-- 4. Store Followers Table & RLS
create table if not exists public.store_followers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, shop_id)
);
alter table public.store_followers enable row level security;

drop policy if exists "Users manage followed stores" on public.store_followers;
create policy "Users manage followed stores" on public.store_followers
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Anyone views store follower counts" on public.store_followers;
create policy "Anyone views store follower counts" on public.store_followers
  for select using (true);

-- 5. Reviews Table & RLS
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text not null,
  verified_purchase boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.product_reviews enable row level security;

drop policy if exists "Anyone views reviews" on public.product_reviews;
create policy "Anyone views reviews" on public.product_reviews
  for select using (true);

drop policy if exists "Authenticated users post reviews" on public.product_reviews;
create policy "Authenticated users post reviews" on public.product_reviews
  for insert to authenticated
  with check (user_id = auth.uid());

-- 6. Dynamic Attributes System
create table if not exists public.product_attribute_values (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  attribute_name text not null,
  attribute_value text not null,
  created_at timestamptz not null default now()
);
alter table public.product_attribute_values enable row level security;

drop policy if exists "Anyone views attribute values" on public.product_attribute_values;
create policy "Anyone views attribute values" on public.product_attribute_values
  for select using (true);

drop policy if exists "Vendors manage product attributes" on public.product_attribute_values;
create policy "Vendors manage product attributes" on public.product_attribute_values
  for all to authenticated
  using (public.is_admin() or product_id in (select p.id from public.products p join public.shops s on s.id=p.shop_id where s.owner_id=auth.uid()));

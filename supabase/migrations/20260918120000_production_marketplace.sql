-- Production hardening migration for the multi-vendor marketplace.
-- Run AFTER the existing marketplace schema migration.

create extension if not exists pgcrypto;

-- -------------------------
-- ENUMS / core tables
-- -------------------------
do $$ begin
  create type public.account_status as enum ('active','pending','suspended','rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.kyc_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_method as enum ('stripe','paypal','cod');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.payment_status as enum ('pending','authorized','paid','failed','refunded','partially_refunded');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.wallet_entry_type as enum ('sale','commission','refund','withdrawal','adjustment','hold','release');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists status public.account_status not null default 'active',
  add column if not exists country_code text,
  add column if not exists last_login_at timestamptz;

alter table public.products
  add column if not exists weight_grams integer not null default 0 check (weight_grams >= 0),
  add column if not exists translations jsonb not null default '{}'::jsonb,
  add column if not exists currency text not null default 'USD',
  add column if not exists published_at timestamptz;

alter table public.categories
  add column if not exists translations jsonb not null default '{}'::jsonb;

create table if not exists public.vendor_kyc (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  legal_name text not null default '',
  phone text not null default '',
  country_code text not null default '',
  document_path text not null,
  document_type text not null default 'identity',
  status public.kyc_status not null default 'pending',
  rejection_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.vendor_commissions (
  vendor_id uuid primary key references public.profiles(id) on delete cascade,
  commission_rate numeric(5,2) not null check (commission_rate >= 0 and commission_rate <= 100),
  effective_from timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  region_code text,
  rate numeric(7,4) not null check (rate >= 0 and rate <= 100),
  name text not null default 'VAT',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_tax_rates_country on public.tax_rates(country_code, region_code, active);

create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  origin_country text not null,
  destination_country text not null,
  min_weight_grams integer not null default 0,
  max_weight_grams integer,
  base_amount numeric(12,2) not null default 0 check (base_amount >= 0),
  per_kg_amount numeric(12,2) not null default 0 check (per_kg_amount >= 0),
  currency text not null default 'USD',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_shipping_rates_route on public.shipping_rates(origin_country,destination_country,active);

create table if not exists public.exchange_rates (
  base_currency text not null,
  quote_currency text not null,
  rate numeric(20,10) not null check (rate > 0),
  updated_at timestamptz not null default now(),
  primary key (base_currency, quote_currency)
);

-- -------------------------
-- Payments, wallet and immutable ledger
-- -------------------------
alter table public.orders
  add column if not exists subtotal numeric(14,2) not null default 0,
  add column if not exists shipping_total numeric(14,2) not null default 0,
  add column if not exists tax_total numeric(14,2) not null default 0,
  add column if not exists currency text not null default 'USD',
  add column if not exists payment_status public.payment_status not null default 'pending',
  add column if not exists payment_provider text,
  add column if not exists provider_payment_id text,
  add column if not exists tracking_number text,
  add column if not exists destination_country text,
  add column if not exists total_weight_grams integer not null default 0;

create table if not exists public.vendor_wallets (
  vendor_id uuid primary key references public.profiles(id) on delete cascade,
  available_balance numeric(18,2) not null default 0,
  pending_balance numeric(18,2) not null default 0,
  currency text not null default 'USD',
  updated_at timestamptz not null default now(),
  check (available_balance >= 0), check (pending_balance >= 0)
);

create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.profiles(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  type public.wallet_entry_type not null,
  amount numeric(18,2) not null,
  currency text not null default 'USD',
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_wallet_ledger_vendor on public.wallet_ledger(vendor_id, created_at desc);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null default 'USD',
  payout_method text not null,
  payout_details jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected','cancelled')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- -------------------------
-- Orders: server-owned totals and immutable snapshots
-- -------------------------
alter table public.order_items
  add column if not exists unit_price numeric(14,2),
  add column if not exists commission_rate numeric(5,2),
  add column if not exists platform_fee numeric(14,2),
  add column if not exists vendor_payout numeric(14,2),
  add column if not exists tax_amount numeric(14,2) not null default 0,
  add column if not exists weight_grams integer not null default 0,
  add column if not exists currency text not null default 'USD';

-- Prevent clients from creating/modifying financial records directly.
revoke insert, update, delete on public.orders from authenticated, anon;
revoke insert, update, delete on public.order_items from authenticated, anon;
revoke insert, update, delete on public.wallet_ledger from authenticated, anon;
revoke insert, update, delete on public.vendor_wallets from authenticated, anon;
revoke insert, update, delete on public.withdrawal_requests from anon;

-- -------------------------
-- Disputes / refunds / chat
-- -------------------------
create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete restrict,
  requester_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','processed','cancelled')),
  provider_ref text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  vendor_id uuid references public.profiles(id) on delete restrict,
  reason text not null,
  status text not null default 'open' check (status in ('open','under_review','resolved','closed')),
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  message text not null check (length(message) between 1 and 5000),
  created_at timestamptz not null default now()
);

-- -------------------------
-- Sessions / security / audit / rate limiting
-- -------------------------
create table if not exists public.active_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  auth_session_id uuid,
  ip_address inet,
  user_agent text,
  device_label text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_active_sessions_user on public.active_sessions(user_id, revoked_at, last_seen_at desc);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  ip_address inet,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id, created_at desc);

create table if not exists public.rate_limits (
  bucket text primary key,
  hits integer not null default 0,
  window_started_at timestamptz not null default now()
);

-- Atomic rate limiter: 3 attempts / minute.
create or replace function public.consume_rate_limit(p_bucket text, p_limit integer default 3, p_window_seconds integer default 60)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_hits integer; v_start timestamptz;
begin
  insert into public.rate_limits(bucket,hits,window_started_at) values(p_bucket,1,now())
  on conflict(bucket) do update set
    hits = case when now() - rate_limits.window_started_at >= make_interval(secs => p_window_seconds) then 1 else rate_limits.hits + 1 end,
    window_started_at = case when now() - rate_limits.window_started_at >= make_interval(secs => p_window_seconds) then now() else rate_limits.window_started_at end;
  select hits, window_started_at into v_hits,v_start from public.rate_limits where bucket=p_bucket;
  return v_hits <= p_limit;
end;
$$;
revoke all on function public.consume_rate_limit(text,integer,integer) from public,anon,authenticated;

-- -------------------------
-- RBAC custom access-token hook
-- -------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare claims jsonb; r text; s text;
begin
  select role::text, status::text into r,s from public.profiles where id=(event->>'user_id')::uuid;
  claims := event->'claims';
  claims := jsonb_set(claims,'{user_role}',to_jsonb(coalesce(r,'customer')),true);
  claims := jsonb_set(claims,'{account_status}',to_jsonb(coalesce(s,'active')),true);
  event := jsonb_set(event,'{claims}',claims);
  return event;
end;
$$;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from anon,authenticated,public;

-- -------------------------
-- Secure helper functions
-- -------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((auth.jwt()->>'user_role')='admin',false);
$$;
create or replace function public.is_vendor()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((auth.jwt()->>'user_role')='vendor',false);
$$;

-- Vendors may only mutate products in their own shop, and only while approved.
-- Replace the old policies that did not check vendor/KYC status.

drop policy if exists "products_insert_vendor" on public.products;
create policy "products_insert_vendor_approved" on public.products for insert to authenticated
with check (
  public.is_vendor() and exists(select 1 from public.shops s join public.vendor_kyc k on k.user_id=s.owner_id where s.id=products.shop_id and s.owner_id=auth.uid() and s.status='approved' and k.status='approved')
);

drop policy if exists "products_update_vendor" on public.products;
create policy "products_update_vendor_own" on public.products for update to authenticated
using (public.is_vendor() and exists(select 1 from public.shops s where s.id=products.shop_id and s.owner_id=auth.uid()))
with check (public.is_vendor() and exists(select 1 from public.shops s where s.id=products.shop_id and s.owner_id=auth.uid()));

-- Product publication requires price and at least one image. Enforced server-side in trigger.
create or replace function public.validate_product_publication()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='active' then
    if new.price <= 0 then raise exception 'Product price must be greater than zero'; end if;
    if not exists(select 1 from public.product_images i where i.product_id=new.id) then
      raise exception 'At least one product image is required before publication';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_validate_product_publication on public.products;
create constraint trigger trg_validate_product_publication
after insert or update on public.products
for each row execute function public.validate_product_publication();

-- -------------------------
-- KYC private storage bucket + policies
-- -------------------------
insert into storage.buckets(id,name,public) values('vendor-kyc','vendor-kyc',false)
on conflict(id) do update set public=false;

drop policy if exists "vendor_kyc_admin_read" on storage.objects;
create policy "vendor_kyc_admin_read" on storage.objects for select to authenticated
using (bucket_id='vendor-kyc' and public.is_admin());
drop policy if exists "vendor_kyc_vendor_upload" on storage.objects;
create policy "vendor_kyc_vendor_upload" on storage.objects for insert to authenticated
with check (bucket_id='vendor-kyc' and (storage.foldername(name))[1]=auth.uid()::text and public.is_vendor());

-- -------------------------
-- RLS
-- -------------------------
alter table public.vendor_kyc enable row level security;
alter table public.vendor_commissions enable row level security;
alter table public.tax_rates enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.vendor_wallets enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.refund_requests enable row level security;
alter table public.disputes enable row level security;
alter table public.dispute_messages enable row level security;
alter table public.active_sessions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;

create policy "kyc_vendor_insert" on public.vendor_kyc for insert to authenticated with check (user_id=auth.uid() and public.is_vendor());
create policy "kyc_vendor_self" on public.vendor_kyc for select to authenticated using (user_id=auth.uid() or public.is_admin());
create policy "kyc_admin_update" on public.vendor_kyc for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "commission_admin_all" on public.vendor_commissions for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "commission_vendor_read" on public.vendor_commissions for select to authenticated using(vendor_id=auth.uid());
create policy "tax_public_read" on public.tax_rates for select to anon,authenticated using(active=true);
create policy "tax_admin_write" on public.tax_rates for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "shipping_public_read" on public.shipping_rates for select to anon,authenticated using(active=true);
create policy "shipping_admin_write" on public.shipping_rates for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "fx_public_read" on public.exchange_rates for select to anon,authenticated using(true);
create policy "fx_admin_write" on public.exchange_rates for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "wallet_vendor_read" on public.vendor_wallets for select to authenticated using(vendor_id=auth.uid() or public.is_admin());
create policy "ledger_vendor_read" on public.wallet_ledger for select to authenticated using(vendor_id=auth.uid() or public.is_admin());
create policy "withdrawal_vendor" on public.withdrawal_requests for select to authenticated using(vendor_id=auth.uid() or public.is_admin());
create policy "withdrawal_vendor_insert" on public.withdrawal_requests for insert to authenticated with check(vendor_id=auth.uid() and public.is_vendor());
create policy "withdrawal_admin_update" on public.withdrawal_requests for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "refund_participant_read" on public.refund_requests for select to authenticated using(requester_id=auth.uid() or public.is_admin() or exists(select 1 from public.order_items oi join public.shops s on s.id=oi.shop_id where oi.id=refund_requests.order_item_id and s.owner_id=auth.uid()));
create policy "refund_customer_insert" on public.refund_requests for insert to authenticated with check(requester_id=auth.uid());
create policy "refund_admin_update" on public.refund_requests for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "dispute_participant" on public.disputes for select to authenticated using(opened_by=auth.uid() or vendor_id=auth.uid() or public.is_admin());
create policy "dispute_customer_insert" on public.disputes for insert to authenticated with check(opened_by=auth.uid());
create policy "dispute_admin_update" on public.disputes for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "dispute_message_participant" on public.dispute_messages for select to authenticated using(exists(select 1 from public.disputes d where d.id=dispute_messages.dispute_id and (d.opened_by=auth.uid() or d.vendor_id=auth.uid() or public.is_admin())));
create policy "dispute_message_insert" on public.dispute_messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.disputes d where d.id=dispute_messages.dispute_id and (d.opened_by=auth.uid() or d.vendor_id=auth.uid() or public.is_admin())));
create policy "sessions_self" on public.active_sessions for select to authenticated using(user_id=auth.uid());
create policy "sessions_revoke_self" on public.active_sessions for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "audit_admin_read" on public.audit_logs for select to authenticated using(public.is_admin());

-- Financial order status changes belong to backend/admin, not customers/vendors.
drop policy if exists "orders_update_own_admin" on public.orders;
create policy "orders_update_admin_only" on public.orders for update to authenticated using(public.is_admin()) with check(public.is_admin());

-- Revoke direct table access to sensitive KYC and finance internals from API roles.
revoke all on public.vendor_kyc, public.wallet_ledger, public.rate_limits from anon;

-- Indexes
create index if not exists idx_orders_payment on public.orders(payment_status,created_at desc);
create index if not exists idx_orders_tracking on public.orders(tracking_number) where tracking_number is not null;
create index if not exists idx_disputes_order on public.disputes(order_id);
create index if not exists idx_refunds_order on public.refund_requests(order_id);

-- Seed default USD if empty. Admin can replace rates before production.
insert into public.exchange_rates(base_currency,quote_currency,rate)
values ('USD','USD',1)
on conflict(base_currency,quote_currency) do nothing;

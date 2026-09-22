-- Migration: implementation_plan_hardening
-- Hardening storage, commission, shipping, refund, wallet, and order tracking.

create extension if not exists pgcrypto;

-- 1. KYC Storage Bucket & RLS
insert into storage.buckets (id, name, public)
values ('kyc_documents', 'kyc_documents', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload their own KYC documents" on storage.objects;
create policy "Users can upload their own KYC documents" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('kyc_documents', 'vendor-kyc') and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users and Admins can view KYC documents" on storage.objects;
create policy "Users and Admins can view KYC documents" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('kyc_documents', 'vendor-kyc') and
    ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- 2. Commission Rates Table & Initial Seed (Default 10%)
create table if not exists public.commission_rates (
  id uuid primary key default gen_random_uuid(),
  rate numeric(5,2) not null check (rate >= 0 and rate <= 100),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
alter table public.commission_rates enable row level security;

drop policy if exists "Anyone authenticated can view active commission rates" on public.commission_rates;
create policy "Anyone authenticated can view active commission rates" on public.commission_rates
  for select to authenticated using (active = true or public.is_admin());

drop policy if exists "Admins can manage commission rates" on public.commission_rates;
create policy "Admins can manage commission rates" on public.commission_rates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.commission_rates (rate, description, active)
select 10.00, 'Default Platform Commission Rate (10%)', true
where not exists (select 1 from public.commission_rates);

-- 3. Shipping Methods Table & Seed (Standard $5, Express $15)
create table if not exists public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  price numeric(12,2) not null check (price >= 0),
  estimated_days text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.shipping_methods enable row level security;

drop policy if exists "Anyone can view active shipping methods" on public.shipping_methods;
create policy "Anyone can view active shipping methods" on public.shipping_methods
  for select using (active = true or public.is_admin());

drop policy if exists "Admins can manage shipping methods" on public.shipping_methods;
create policy "Admins can manage shipping methods" on public.shipping_methods
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.shipping_methods (name, code, price, estimated_days, active)
values
  ('Standard Shipping', 'standard', 5.00, '3-5 business days', true),
  ('Express Shipping', 'express', 15.00, '1-2 business days', true)
on conflict (code) do update set price = excluded.price, estimated_days = excluded.estimated_days;

-- 4. Order Tracking & Refund Enhancements
alter table public.orders
  add column if not exists refund_status text not null default 'none',
  add column if not exists refund_amount numeric(14,2) not null default 0,
  add column if not exists refund_reason text,
  add column if not exists tracking_status text not null default 'pending',
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

-- 5. Wallet Ledger Immutability & Stored Procedure
alter table public.wallet_ledger enable row level security;

-- Prevent UPDATE and DELETE on wallet_ledger for authenticated users
drop policy if exists "No updates on wallet ledger" on public.wallet_ledger;
drop policy if exists "No deletes on wallet ledger" on public.wallet_ledger;
drop policy if exists "Vendors can view their wallet ledger" on public.wallet_ledger;
create policy "Vendors can view their wallet ledger" on public.wallet_ledger
  for select to authenticated
  using (vendor_id = auth.uid() or public.is_admin());

-- Stored procedure for adjusting vendor wallet balance safely
create or replace function public.adjust_wallet(
  p_vendor_id uuid,
  p_amount numeric(18,2),
  p_type public.wallet_entry_type,
  p_order_id uuid default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_balance numeric(18,2);
  v_new_balance numeric(18,2);
  v_ledger_id uuid;
begin
  -- Lock the vendor wallet row
  select available_balance into v_current_balance
  from public.vendor_wallets
  where vendor_id = p_vendor_id
  for update;

  if not found then
    insert into public.vendor_wallets(vendor_id, available_balance, currency)
    values (p_vendor_id, 0, 'USD');
    v_current_balance := 0;
  end if;

  v_new_balance := v_current_balance + p_amount;
  if v_new_balance < 0 then
    raise exception 'Insufficient wallet balance for this operation';
  end if;

  -- Insert ledger entry with idempotency check
  insert into public.wallet_ledger(vendor_id, order_id, type, amount, idempotency_key, metadata)
  values (p_vendor_id, p_order_id, p_type, p_amount, p_idempotency_key, coalesce(p_metadata, '{}'::jsonb))
  on conflict (idempotency_key) do nothing
  returning id into v_ledger_id;

  -- Update wallet balance if entry was inserted or no idempotency key provided
  if p_idempotency_key is null or v_ledger_id is not null then
    update public.vendor_wallets
    set available_balance = v_new_balance,
        updated_at = now()
    where vendor_id = p_vendor_id;
  end if;

  return true;
end; $$;

revoke execute on function public.adjust_wallet(uuid, numeric, public.wallet_entry_type, uuid, text, jsonb) from public, anon;
grant execute on function public.adjust_wallet(uuid, numeric, public.wallet_entry_type, uuid, text, jsonb) to authenticated, service_role;

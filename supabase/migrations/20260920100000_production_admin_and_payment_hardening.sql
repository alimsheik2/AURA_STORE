-- Aura Store: final admin-first RLS and payment integrity hardening.
create extension if not exists pgcrypto;

-- Centralized admin predicate. SECURITY DEFINER avoids recursive RLS checks.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path=public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and coalesce(p.status, 'active') = 'active'
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Admin-first access for operational entities.
do $admin$ declare t text; begin
  foreach t in array array['profiles','shops','products','product_images','product_variations','categories','orders','order_items','withdrawal_requests','refund_requests','disputes','dispute_messages','vendor_kyc','vendor_commissions','tax_rates','shipping_rates','exchange_rates','vendor_wallets','wallet_ledger','platform_settings','notifications','audit_logs','active_sessions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists admin_full_access on public.%I', t);
    execute format('create policy admin_full_access on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $admin$;

-- The customer/vendor self-service profile policy remains, but admins are unrestricted.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
using (auth.uid() = id or public.is_admin())
with check (
  public.is_admin()
  or (auth.uid() = id
      and role = (select p.role from public.profiles p where p.id = auth.uid())
      and status = (select p.status from public.profiles p where p.id = auth.uid()))
);

-- Admins may also delete operational records. Financial source-of-truth tables stay
-- service-role-owned for normal clients, while the admin RLS policy governs admin access.
-- Re-granting is intentionally limited: clients still cannot bypass server-owned finance rules.
revoke insert, update, delete on public.orders from authenticated, anon;
revoke insert, update, delete on public.order_items from authenticated, anon;
revoke insert, update, delete on public.wallet_ledger from authenticated, anon;
revoke insert, update, delete on public.vendor_wallets from authenticated, anon;
revoke insert, update, delete on public.withdrawal_requests from anon;

-- Restore authenticated table privileges needed by the admin console; RLS still limits
-- these operations to rows allowed by the policies above. Server-owned inserts remain revoked.
grant select, update, delete on public.withdrawal_requests to authenticated;
grant select, update, delete on public.wallet_ledger to authenticated;
grant select, update, delete on public.vendor_wallets to authenticated;
grant select, update, delete on public.orders to authenticated;
grant select, update, delete on public.order_items to authenticated;
grant select, insert, update, delete on public.profiles, public.shops, public.products, public.product_images, public.product_variations, public.categories to authenticated;
grant select, insert, update, delete on public.refund_requests, public.disputes, public.dispute_messages to authenticated;
grant select, insert, update, delete on public.vendor_kyc, public.vendor_commissions, public.tax_rates, public.shipping_rates, public.exchange_rates to authenticated;
grant select, insert, update, delete on public.platform_settings, public.notifications, public.audit_logs, public.active_sessions to authenticated;

-- Verify an already-created order before opening a payment session. This validates the
-- immutable order snapshot, arithmetic, currency and non-negative inventory state.
create or replace function public.verify_order_payment_ready(p_order_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  o record;
  calculated numeric(14,2);
  item_count integer;
  bad_count integer;
begin
  select * into o from public.orders where id=p_order_id and user_id=p_user_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.payment_status <> 'pending' then raise exception 'Order is not pending payment'; end if;
  if o.payment_method not in ('stripe','paypal') then raise exception 'Order is not an online payment'; end if;

  select count(*), coalesce(sum(round(coalesce(oi.unit_price, oi.price),2) * oi.quantity),0)
    into item_count, calculated
    from public.order_items oi where oi.order_id=p_order_id;
  if item_count = 0 then raise exception 'Order has no items'; end if;
  if calculated <= 0 then raise exception 'Invalid order pricing'; end if;
  if round(calculated + coalesce(o.tax_total,0) + coalesce(o.shipping_total,0),2) <> round(o.total,2)
    then raise exception 'Order total integrity check failed'; end if;

  select count(*) into bad_count
    from public.order_items oi
    left join public.products p on p.id=oi.product_id
    where oi.order_id=p_order_id
      and (oi.quantity < 1 or coalesce(oi.unit_price,oi.price) <= 0 or oi.vendor_payout < 0);
  if bad_count > 0 then raise exception 'Invalid order item'; end if;

  -- Inventory was reserved atomically during checkout; no negative stock may ever be paid.
  if exists(select 1 from public.products p join public.order_items oi on oi.product_id=p.id where oi.order_id=p_order_id and p.inventory_stock < 0)
     or exists(select 1 from public.product_variations v join public.order_items oi on oi.variation_id=v.id where oi.order_id=p_order_id and v.stock < 0)
  then raise exception 'Inventory integrity check failed'; end if;
  return true;
end; $$;
revoke all on function public.verify_order_payment_ready(uuid,uuid) from public,anon,authenticated;
grant execute on function public.verify_order_payment_ready(uuid,uuid) to service_role;

-- Ensure stock cannot be driven below zero by any future direct database operation.
create or replace function public.prevent_negative_inventory()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.inventory_stock < 0 then raise exception 'Inventory cannot be negative'; end if;
  return new;
end; $$;
drop trigger if exists trg_prevent_negative_inventory on public.products;
create trigger trg_prevent_negative_inventory before insert or update of inventory_stock on public.products for each row execute function public.prevent_negative_inventory();
create or replace function public.prevent_negative_variation_stock()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.stock < 0 then raise exception 'Variation inventory cannot be negative'; end if;
  return new;
end; $$;
drop trigger if exists trg_prevent_negative_variation_stock on public.product_variations;
create trigger trg_prevent_negative_variation_stock before insert or update of stock on public.product_variations for each row execute function public.prevent_negative_variation_stock();

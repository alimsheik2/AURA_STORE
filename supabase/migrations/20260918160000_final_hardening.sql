-- Final production hardening: inventory, idempotency, platform settings, notifications and stricter RBAC.
create extension if not exists pgcrypto;

alter table public.products
  add column if not exists inventory_stock integer not null default 0 check (inventory_stock >= 0);

alter table public.orders
  add column if not exists idempotency_key text;
create unique index if not exists orders_user_idempotency_key_uq
  on public.orders(user_id, idempotency_key) where idempotency_key is not null;

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
drop policy if exists platform_settings_public_read on public.platform_settings;
create policy platform_settings_public_read on public.platform_settings for select to anon, authenticated using (is_public=true);
drop policy if exists platform_settings_admin_all on public.platform_settings;
create policy platform_settings_admin_all on public.platform_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);
drop policy if exists notifications_self_read on public.notifications;
create policy notifications_self_read on public.notifications for select to authenticated using(user_id=auth.uid());
drop policy if exists notifications_self_update on public.notifications;
create policy notifications_self_update on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Never let a client promote itself to admin or mutate role/status fields.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
using (auth.uid()=id)
with check (auth.uid()=id and role=(select p.role from public.profiles p where p.id=auth.uid()) and status=(select p.status from public.profiles p where p.id=auth.uid()));

-- Remove earlier permissive vendor policies; the final policies below are the source of truth.
drop policy if exists products_insert_vendor on public.products;
drop policy if exists products_update_vendor on public.products;
drop policy if exists products_insert_vendor_approved on public.products;
drop policy if exists products_update_vendor_approved on public.products;

-- Vendor selling access requires an approved account and approved shop.
drop policy if exists products_insert_vendor_approved on public.products;
create policy products_insert_vendor_approved on public.products for insert to authenticated with check (
  exists(select 1 from public.profiles pr where pr.id=auth.uid() and pr.role='vendor' and pr.status='active')
  and exists(select 1 from public.shops s where s.id=products.shop_id and s.owner_id=auth.uid() and s.status='approved')
);
drop policy if exists products_update_vendor_approved on public.products;
create policy products_update_vendor_approved on public.products for update to authenticated
using (exists(select 1 from public.shops s join public.profiles pr on pr.id=s.owner_id where s.id=products.shop_id and s.owner_id=auth.uid() and s.status='approved' and pr.role='vendor' and pr.status='active'))
with check (exists(select 1 from public.shops s join public.profiles pr on pr.id=s.owner_id where s.id=products.shop_id and s.owner_id=auth.uid() and s.status='approved' and pr.role='vendor' and pr.status='active'));

-- Keep variation stock and base stock consistent for non-variation products.
create or replace function public.validate_product_publication()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.status='active' then
    if new.price <= 0 then raise exception 'Product price must be greater than zero'; end if;
    if not exists(select 1 from public.product_images pi where pi.product_id=new.id) then raise exception 'At least one product image is required before publishing'; end if;
    if not exists(select 1 from public.shops s where s.id=new.shop_id and s.status='approved') then raise exception 'Shop must be approved before publishing'; end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_validate_product_publication on public.products;
create trigger trg_validate_product_publication before insert or update of status,price,shop_id on public.products for each row execute function public.validate_product_publication();

-- Rebuild secure checkout with idempotency + non-variation inventory.
create or replace function public.secure_create_order(
  p_user_id uuid, p_items jsonb, p_payment_method text, p_destination_country text,
  p_customer_name text, p_customer_phone text, p_shipping_address text, p_city text,
  p_notes text default '', p_idempotency_key text default null
)
returns table(order_id uuid, subtotal numeric, tax numeric, shipping numeric, total numeric, currency text)
language plpgsql security definer set search_path=public
as $$
declare
  v_order_id uuid; v_subtotal numeric(14,2):=0; v_tax numeric(14,2):=0; v_shipping numeric(14,2):=0;
  v_weight integer:=0; v_rate numeric:=0; v_ship_base numeric:=0; v_ship_kg numeric:=0;
  x record; p record; v record; c record; img text; unit numeric(14,2); line numeric(14,2); comm numeric(5,2); fee numeric(14,2); payout numeric(14,2);
begin
  if p_user_id is null then raise exception 'Unauthorized'; end if;
  if p_payment_method not in ('cod','stripe','paypal') then raise exception 'Unsupported payment method'; end if;
  if length(trim(coalesce(p_destination_country,'')))<>2 then raise exception 'Invalid destination country'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Cart is empty'; end if;
  if p_idempotency_key is not null and length(trim(p_idempotency_key))>0 then
    select o.id into v_order_id from public.orders o where o.user_id=p_user_id and o.idempotency_key=p_idempotency_key limit 1;
    if found then return query select o.id,o.subtotal,o.tax_total,o.shipping_total,o.total,o.currency from public.orders o where o.id=v_order_id; return; end if;
  end if;
  for x in select * from jsonb_to_recordset(p_items) as q(product_id uuid,variation_id uuid,quantity integer) loop
    if x.quantity is null or x.quantity<1 or x.quantity>100 then raise exception 'Invalid quantity'; end if;
    select pr.* into p from public.products pr where pr.id=x.product_id and pr.status='active' for update;
    if not found then raise exception 'Product unavailable'; end if;
    unit:=p.price;
    if x.variation_id is not null then
      select pv.* into v from public.product_variations pv where pv.id=x.variation_id and pv.product_id=x.product_id for update;
      if not found or v.stock<x.quantity then raise exception 'Insufficient stock'; end if;
      unit:=unit+coalesce(v.price_adjustment,0);
    else
      if p.inventory_stock<x.quantity then raise exception 'Insufficient stock'; end if;
    end if;
    if unit<=0 then raise exception 'Invalid product price'; end if;
    line:=unit*x.quantity; v_subtotal:=v_subtotal+line; v_weight:=v_weight+coalesce(p.weight_grams,0)*x.quantity;
  end loop;
  select coalesce(max(tr.rate),0) into v_rate from public.tax_rates tr where tr.country_code=upper(p_destination_country) and tr.active=true;
  v_tax:=round(v_subtotal*v_rate/100,2);
  select coalesce(sr.base_amount,0),coalesce(sr.per_kg_amount,0) into v_ship_base,v_ship_kg from public.shipping_rates sr
    where sr.destination_country=upper(p_destination_country) and sr.active=true and sr.min_weight_grams<=v_weight and (sr.max_weight_grams is null or sr.max_weight_grams>=v_weight)
    order by sr.min_weight_grams desc limit 1;
  v_shipping:=round(coalesce(v_ship_base,0)+(v_weight/1000.0)*coalesce(v_ship_kg,0),2);
  insert into public.orders(user_id,status,subtotal,shipping_total,tax_total,total,currency,payment_method,payment_status,customer_name,customer_phone,shipping_address,city,notes,destination_country,total_weight_grams,idempotency_key)
  values(p_user_id,'pending',v_subtotal,v_shipping,v_tax,v_subtotal+v_tax+v_shipping,'USD',p_payment_method,case when p_payment_method='cod' then 'authorized' else 'pending' end,p_customer_name,p_customer_phone,p_shipping_address,p_city,p_notes,upper(p_destination_country),v_weight,nullif(trim(p_idempotency_key),''))
  returning id into v_order_id;
  for x in select * from jsonb_to_recordset(p_items) as q(product_id uuid,variation_id uuid,quantity integer) loop
    select pr.* into p from public.products pr where pr.id=x.product_id for update; unit:=p.price;
    if x.variation_id is not null then select pv.* into v from public.product_variations pv where pv.id=x.variation_id and pv.product_id=x.product_id for update; unit:=unit+coalesce(v.price_adjustment,0); update public.product_variations set stock=stock-x.quantity where id=x.variation_id; else update public.products set inventory_stock=inventory_stock-x.quantity where id=x.product_id; end if;
    line:=unit*x.quantity; select s.owner_id into c from public.shops s where s.id=p.shop_id;
    select vc.commission_rate into comm from public.vendor_commissions vc where vc.vendor_id=c.owner_id;
    if comm is null then select coalesce(cat.commission_rate,10) into comm from public.categories cat where cat.id=p.category_id; end if; comm:=coalesce(comm,10); fee:=round(line*comm/100,2); payout:=line-fee;
    select pi.url into img from public.product_images pi where pi.product_id=p.id order by pi.position asc limit 1;
    insert into public.order_items(order_id,product_id,variation_id,shop_id,product_name,variation_name,price,unit_price,quantity,product_image,commission_rate,platform_fee,vendor_payout,weight_grams,currency)
    values(v_order_id,p.id,x.variation_id,p.shop_id,p.name,'',unit,unit,x.quantity,coalesce(img,''),comm,fee,payout,coalesce(p.weight_grams,0)*x.quantity,'USD');
  end loop;
  insert into public.notifications(user_id,type,title,body,data) values(p_user_id,'order_created','Order placed','Your order has been created successfully.',jsonb_build_object('order_id',v_order_id));
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(p_user_id,'checkout.created','order',v_order_id::text,jsonb_build_object('total',v_subtotal+v_tax+v_shipping,'payment_method',p_payment_method));
  return query select v_order_id,v_subtotal,v_tax,v_shipping,v_subtotal+v_tax+v_shipping,'USD'::text;
exception when unique_violation then
  if p_idempotency_key is not null then return query select o.id,o.subtotal,o.tax_total,o.shipping_total,o.total,o.currency from public.orders o where o.user_id=p_user_id and o.idempotency_key=p_idempotency_key limit 1; else raise; end if;
end; $$;
revoke all on function public.secure_create_order(uuid,jsonb,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.secure_create_order(uuid,jsonb,text,text,text,text,text,text,text,text) to service_role;

insert into public.platform_settings(key,value,is_public) values
('marketplace',jsonb_build_object('default_commission_rate',10,'default_currency','USD','support_cod',true,'support_stripe',false,'support_paypal',false),true)
on conflict(key) do nothing;

-- Shop owners may edit presentation fields but cannot promote/suspend their own shop.
drop policy if exists shops_update_owner_admin on public.shops;
create policy shops_update_owner_admin on public.shops for update to authenticated
using (owner_id=auth.uid() or public.is_admin())
with check (public.is_admin() or (owner_id=auth.uid() and status=(select s.status from public.shops s where s.id=shops.id)));


create or replace function public.notify_order_status_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare title_text text; body_text text;
begin
  if new.status is distinct from old.status then
    title_text := case new.status
      when 'confirmed' then 'Order confirmed'
      when 'shipped' then 'Order shipped'
      when 'delivered' then 'Order delivered'
      when 'cancelled' then 'Order cancelled'
      else 'Order updated' end;
    body_text := case new.status
      when 'confirmed' then 'Your order has been confirmed.'
      when 'shipped' then 'Your order has been handed to shipping.'
      when 'delivered' then 'Your order has been delivered.'
      when 'cancelled' then 'Your order has been cancelled.'
      else 'Your order status has changed.' end;
    insert into public.notifications(user_id,type,title,body,data)
      values(new.user_id,'order_status',title_text,body_text,jsonb_build_object('order_id',new.id,'status',new.status,'tracking_number',new.tracking_number));
  end if;
  return new;
end; $$;
drop trigger if exists trg_order_status_notification on public.orders;
create trigger trg_order_status_notification after update of status on public.orders for each row execute function public.notify_order_status_change();

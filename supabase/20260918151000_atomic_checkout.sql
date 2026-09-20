-- Atomic, server-owned checkout transaction.
create or replace function public.secure_create_order(
  p_user_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_destination_country text,
  p_customer_name text,
  p_customer_phone text,
  p_shipping_address text,
  p_city text,
  p_notes text default ''
)
returns table(order_id uuid, subtotal numeric, tax numeric, shipping numeric, total numeric, currency text)
language plpgsql security definer set search_path=public
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_subtotal numeric(14,2) := 0;
  v_tax numeric(14,2) := 0;
  v_shipping numeric(14,2) := 0;
  v_weight integer := 0;
  v_rate numeric := 0;
  v_ship_base numeric := 0;
  v_ship_kg numeric := 0;
  x record; p record; v record; c record; img text;
  unit numeric(14,2); line numeric(14,2); comm numeric(5,2); fee numeric(14,2); payout numeric(14,2);
begin
  if p_user_id is null or p_user_id <> auth.uid() then raise exception 'Unauthorized'; end if;
  if p_payment_method not in ('cod','stripe','paypal') then raise exception 'Unsupported payment method'; end if;
  if length(trim(coalesce(p_destination_country,''))) <> 2 then raise exception 'Invalid destination country'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'Cart is empty'; end if;

  for x in select * from jsonb_to_recordset(p_items) as q(product_id uuid, variation_id uuid, quantity integer) loop
    if x.quantity is null or x.quantity < 1 or x.quantity > 100 then raise exception 'Invalid quantity'; end if;
    select pr.* into p from public.products pr where pr.id=x.product_id and pr.status='active' for update;
    if not found then raise exception 'Product unavailable'; end if;
    unit := p.price;
    if x.variation_id is not null then
      select pv.* into v from public.product_variations pv where pv.id=x.variation_id and pv.product_id=x.product_id for update;
      if not found or v.stock < x.quantity then raise exception 'Insufficient stock'; end if;
      unit := unit + coalesce(v.price_adjustment,0);
    end if;
    if unit <= 0 then raise exception 'Invalid product price'; end if;
    line := unit * x.quantity;
    v_subtotal := v_subtotal + line;
    v_weight := v_weight + coalesce(p.weight_grams,0) * x.quantity;
  end loop;

  select coalesce(max(tr.rate),0) into v_rate from public.tax_rates tr where tr.country_code=upper(p_destination_country) and tr.active=true;
  v_tax := round(v_subtotal * v_rate / 100, 2);

  select coalesce(sr.base_amount,0), coalesce(sr.per_kg_amount,0)
    into v_ship_base,v_ship_kg
    from public.shipping_rates sr
   where sr.destination_country=upper(p_destination_country) and sr.active=true
     and sr.min_weight_grams <= v_weight
     and (sr.max_weight_grams is null or sr.max_weight_grams >= v_weight)
   order by sr.min_weight_grams desc limit 1;
  v_shipping := round(v_ship_base + (v_weight/1000.0)*v_ship_kg, 2);

  insert into public.orders(user_id,status,subtotal,shipping_total,tax_total,total,currency,payment_method,payment_status,customer_name,customer_phone,shipping_address,city,notes,destination_country,total_weight_grams)
  values(p_user_id,'pending',v_subtotal,v_shipping,v_tax,v_subtotal+v_tax+v_shipping,'USD',p_payment_method,case when p_payment_method='cod' then 'authorized' else 'pending' end,p_customer_name,p_customer_phone,p_shipping_address,p_city,p_notes,upper(p_destination_country),v_weight)
  returning id into v_order_id;

  for x in select * from jsonb_to_recordset(p_items) as q(product_id uuid, variation_id uuid, quantity integer) loop
    select pr.* into p from public.products pr where pr.id=x.product_id for update;
    unit := p.price;
    if x.variation_id is not null then
      select pv.* into v from public.product_variations pv where pv.id=x.variation_id and pv.product_id=x.product_id for update;
      unit := unit + coalesce(v.price_adjustment,0);
      update public.product_variations set stock=stock-x.quantity where id=x.variation_id;
    end if;
    line := unit*x.quantity;
    select s.owner_id into c from public.shops s where s.id=p.shop_id;
    select vc.commission_rate into comm from public.vendor_commissions vc where vc.vendor_id=c.owner_id;
    if comm is null then select coalesce(cat.commission_rate,10) into comm from public.categories cat where cat.id=p.category_id; end if;
    comm := coalesce(comm,10);
    fee := round(line*comm/100,2); payout := line-fee;
    select pi.url into img from public.product_images pi where pi.product_id=p.id order by pi.position asc limit 1;
    insert into public.order_items(order_id,product_id,variation_id,shop_id,product_name,variation_name,price,unit_price,quantity,product_image,commission_rate,platform_fee,vendor_payout,weight_grams,currency)
    values(v_order_id,p.id,x.variation_id,p.shop_id,p.name,'',unit,unit,x.quantity,coalesce(img,''),comm,fee,payout,coalesce(p.weight_grams,0)*x.quantity,'USD');
  end loop;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(p_user_id,'checkout.created','order',v_order_id::text,jsonb_build_object('subtotal',v_subtotal,'tax',v_tax,'shipping',v_shipping,'total',v_subtotal+v_tax+v_shipping));

  return query select v_order_id,v_subtotal,v_tax,v_shipping,v_subtotal+v_tax+v_shipping,'USD'::text;
end;
$$;
revoke all on function public.secure_create_order(uuid,jsonb,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.secure_create_order(uuid,jsonb,text,text,text,text,text,text,text) to service_role;

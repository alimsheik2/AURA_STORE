-- Payment provider events, secure payment state transitions and payout ledger helpers.
create extension if not exists pgcrypto;

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  order_id uuid references public.orders(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);
alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;
create index if not exists idx_payment_events_order on public.payment_events(order_id, created_at desc);

create or replace function public.apply_verified_payment_event(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_provider_payment_id text,
  p_order_id uuid,
  p_new_status public.payment_status,
  p_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare v_event_id uuid;
begin
  if p_provider not in ('stripe','paypal') then raise exception 'Unsupported provider'; end if;
  if p_order_id is null then raise exception 'Order is required'; end if;

  insert into public.payment_events(provider,provider_event_id,event_type,order_id,payload,processed_at)
  values(p_provider,p_provider_event_id,p_event_type,p_order_id,coalesce(p_payload,'{}'::jsonb),now())
  on conflict(provider,provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then return false; end if;

  update public.orders
    set payment_provider=p_provider,
        provider_payment_id=coalesce(p_provider_payment_id,provider_payment_id),
        payment_status=p_new_status,
        status=case
          when p_new_status='paid' and status='pending' then 'confirmed'
          when p_new_status='failed' then 'cancelled'
          else status end
  where id=p_order_id;

  return true;
end; $$;
revoke all on function public.apply_verified_payment_event(text,text,text,text,uuid,public.payment_status,jsonb) from public,anon,authenticated;
grant execute on function public.apply_verified_payment_event(text,text,text,text,uuid,public.payment_status,jsonb) to service_role;

-- Ensure vendor wallets exist when an approved vendor starts selling.
create or replace function public.ensure_vendor_wallet()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.role='vendor' then
    insert into public.vendor_wallets(vendor_id,currency) values(new.id,coalesce((select value->>'default_currency' from public.platform_settings where key='marketplace'),'USD')) on conflict(vendor_id) do nothing;
  end if;
  return new;
end; $$;
drop trigger if exists trg_ensure_vendor_wallet on public.profiles;
create trigger trg_ensure_vendor_wallet after insert or update of role on public.profiles for each row execute function public.ensure_vendor_wallet();

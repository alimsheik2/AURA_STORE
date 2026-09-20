-- Final production auth hardening patch.
create extension if not exists pgcrypto;

-- Safe metadata-to-profile bootstrap: only customer/vendor are accepted from signup metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare requested_role text;
begin
  requested_role := case when NEW.raw_user_meta_data->>'role' = 'vendor' then 'vendor' else 'customer' end;
  insert into public.profiles (id, full_name, phone, role, status, country_code)
  values (NEW.id,
          coalesce(NEW.raw_user_meta_data->>'full_name',''),
          coalesce(NEW.raw_user_meta_data->>'phone',''),
          requested_role,
          case when requested_role='vendor' then 'pending'::public.account_status else 'active'::public.account_status end,
          upper(coalesce(NEW.raw_user_meta_data->>'country_code','')))
  on conflict (id) do update set
    full_name=excluded.full_name,
    phone=excluded.phone,
    role=excluded.role,
    status=excluded.status,
    country_code=excluded.country_code;
  return NEW;
end;
$$;

-- One-time email OTP challenges for password+OTP login and explicit signup verification.
create table if not exists public.auth_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null check (purpose in ('login','signup')),
  code_hash text not null,
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 10),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_auth_otp_email_purpose on public.auth_otp_challenges(lower(email),purpose,created_at desc);
alter table public.auth_otp_challenges enable row level security;
revoke all on public.auth_otp_challenges from anon, authenticated;

-- Keep role/status claims fresh whenever a new access token is minted.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare claims jsonb; r text; s text;
begin
  select role::text,status::text into r,s from public.profiles where id=(event->>'user_id')::uuid;
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

-- Vendors may submit their KYC only for their own account.
drop policy if exists "kyc_vendor_insert" on public.vendor_kyc;
create policy "kyc_vendor_insert" on public.vendor_kyc for insert to authenticated
with check (user_id=auth.uid() and public.is_vendor() and (select status from public.profiles where id=auth.uid())='pending');

-- Prevent a vendor from changing ownership/status of their own shop.
drop policy if exists "shops_update_vendor" on public.shops;
create policy "shops_update_vendor_own" on public.shops for update to authenticated
using (owner_id=auth.uid())
with check (owner_id=auth.uid() and status in ('pending','approved','suspended'));

-- No direct financial mutation by API clients.
revoke insert, update, delete on public.wallet_ledger from anon, authenticated;
revoke insert, update, delete on public.vendor_wallets from anon, authenticated;
revoke update, delete on public.orders from anon, authenticated;

-- Secure server-side OTP consumption. Only Edge Functions with service role can call it.
create or replace function public.consume_auth_otp(p_email text,purpose text,p_code_hash text)
returns boolean language plpgsql security definer set search_path=public as $$
declare ok boolean;
begin
  update public.auth_otp_challenges
  set attempts=attempts+1
  where id=(select id from public.auth_otp_challenges
            where lower(email)=lower(p_email) and auth_otp_challenges.purpose=consume_auth_otp.purpose
              and consumed_at is null and expires_at>now()
            order by created_at desc limit 1)
    and attempts < 10;
  update public.auth_otp_challenges
  set consumed_at=now()
  where id=(select id from public.auth_otp_challenges
            where lower(email)=lower(p_email) and auth_otp_challenges.purpose=consume_auth_otp.purpose
              and consumed_at is null and expires_at>now() and attempts < 10 and code_hash=p_code_hash
            order by created_at desc limit 1)
  returning true into ok;
  return coalesce(ok,false);
end;
$$;
revoke all on function public.consume_auth_otp(text,text,text) from public,anon,authenticated;

-- Runtime fixes for the production-ready build.
-- Run after 20260920100000_production_admin_and_payment_hardening.sql.

-- The OTP Edge Function uses these RPCs with the service-role client. The
-- previous migrations revoked PUBLIC execute but did not grant service_role.
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
grant execute on function public.consume_auth_otp(text, text, text) to service_role;

-- Avoid recursive RLS evaluation when a user updates their own profile/shop.
create or replace function public.current_profile_role()
returns text
language sql
security definer
stable
set search_path=public
as $$
  select role::text from public.profiles where id=auth.uid();
$$;

create or replace function public.current_profile_status()
returns text
language sql
security definer
stable
set search_path=public
as $$
  select status::text from public.profiles where id=auth.uid();
$$;

grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.current_profile_status() to authenticated;

create or replace function public.current_shop_status(p_shop_id uuid)
returns text
language sql
security definer
stable
set search_path=public
as $$
  select status::text from public.shops where id=p_shop_id;
$$;

grant execute on function public.current_shop_status(uuid) to authenticated;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
using (auth.uid() = id or public.is_admin())
with check (
  public.is_admin()
  or (
    auth.uid() = id
    and role::text = public.current_profile_role()
    and status::text = public.current_profile_status()
  )
);

drop policy if exists shops_update_owner_admin on public.shops;
create policy shops_update_owner_admin on public.shops for update to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (
    owner_id = auth.uid()
    and status::text = public.current_shop_status(id)
  )
);

-- Enforce the OTP attempt limit on the same row that is being consumed.
create or replace function public.consume_auth_otp(p_email text, purpose text, p_code_hash text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  ok boolean;
begin
  update public.auth_otp_challenges
  set attempts = attempts + 1
  where id = (
    select id from public.auth_otp_challenges
    where lower(email) = lower(p_email)
      and auth_otp_challenges.purpose = consume_auth_otp.purpose
      and consumed_at is null
      and expires_at > now()
    order by created_at desc
    limit 1
  )
  and attempts < 10;

  update public.auth_otp_challenges
  set consumed_at = now()
  where id = (
    select id from public.auth_otp_challenges
    where lower(email) = lower(p_email)
      and auth_otp_challenges.purpose = consume_auth_otp.purpose
      and consumed_at is null
      and expires_at > now()
      and attempts < 10
      and code_hash = p_code_hash
    order by created_at desc
    limit 1
  )
  returning true into ok;

  return coalesce(ok, false);
end;
$$;

revoke all on function public.consume_auth_otp(text, text, text) from public, anon, authenticated;
grant execute on function public.consume_auth_otp(text, text, text) to service_role;

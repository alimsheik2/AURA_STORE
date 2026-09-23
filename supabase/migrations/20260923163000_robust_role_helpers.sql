-- Migration: robust_role_helpers
-- Ensures is_admin() and is_vendor() resolve cleanly whether custom_access_token_hook
-- is active or not, checking JWT custom claim, user_metadata, app_metadata, and profiles table.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(
    (auth.jwt()->>'user_role') = 'admin'
    or (auth.jwt()->'user_metadata'->>'role') = 'admin'
    or (auth.jwt()->'app_metadata'->>'role') = 'admin'
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'),
    false
  );
$$;

create or replace function public.is_vendor()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(
    (auth.jwt()->>'user_role') = 'vendor'
    or (auth.jwt()->'user_metadata'->>'role') = 'vendor'
    or (auth.jwt()->'app_metadata'->>'role') = 'vendor'
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'vendor'),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon, service_role;

revoke all on function public.is_vendor() from public;
grant execute on function public.is_vendor() to authenticated, anon, service_role;

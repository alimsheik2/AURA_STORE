-- Security hardening: protect profile privilege fields and financial wallet mutation.
-- Apply only after reviewing the current database state and testing in staging.

create or replace function public.prevent_self_privilege_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only an administrator may change account roles';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Only an administrator may change account status';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_privilege_fields on public.profiles;
create trigger protect_profile_privilege_fields
before update on public.profiles
for each row execute function public.prevent_self_privilege_changes();

-- Wallet balances must be changed through trusted server-side code only.
revoke execute on function public.adjust_wallet(uuid, numeric, public.wallet_entry_type, uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.adjust_wallet(uuid, numeric, public.wallet_entry_type, uuid, text, jsonb)
to service_role;

create or replace function public.update_own_profile(
  p_full_name text,
  p_phone text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_name text := trim(p_full_name);
  normalized_phone text := nullif(trim(p_phone), '');
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if normalized_name is null or char_length(normalized_name) < 2 or char_length(normalized_name) > 100 then
    raise exception 'Invalid full name';
  end if;

  if normalized_phone is not null and normalized_phone !~ '^[0-9+() -]{8,20}$' then
    raise exception 'Invalid phone number';
  end if;

  update public.profiles
  set
    full_name = normalized_name,
    phone = normalized_phone,
    updated_at = now()
  where id = current_user_id
    and status = 'ACTIVO';

  if not found then
    raise exception 'Active profile not found';
  end if;
end;
$$;

revoke all on function public.update_own_profile(text, text) from public, anon;
grant execute on function public.update_own_profile(text, text) to authenticated;

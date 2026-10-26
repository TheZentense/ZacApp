begin;

-- A coordinator may inspect staff in the same department, never the
-- municipality-wide directory. Keep the existing self-read policy intact.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and cmd in ('SELECT', 'ALL')
      and policyname not in ('profiles read own profile', 'administrators read profiles')
  ) then
    raise exception 'Review unexpected profiles SELECT policy before narrowing access';
  end if;
end;
$$;

drop policy if exists "administrators read profiles" on public.profiles;
create policy "administrators read profiles"
on public.profiles for select to authenticated
using (
  (select private.current_user_is_active())
  and (
    (select private.current_user_role()) in ('administrador', 'supervisor')
    or (
      (select private.current_user_role()) = 'coordinador'
      and department_id is not null
      and department_id = (select private.current_department_id())
      and role in ('operador', 'coordinador', 'mantenimiento', 'comunicacion')
    )
  )
);

-- App users share PostgreSQL's authenticated role. Row policies cannot mask
-- a single column. Explicit grants avoid exposing future columns by default.
revoke select on public.incidents from public, anon, authenticated;
revoke select (reporter_name, reporter_email) on public.incidents from public, anon, authenticated;
grant select (
  id, citizen_id, category_id, code, title, description,
  address_reference, latitude, longitude, status, priority,
  assigned_department_id, assigned_to, created_at, updated_at,
  submission_kind
) on public.incidents to authenticated;

-- Only an active administrator may request a reporter's contact snapshot.
-- This function is deliberately separate from the incident list response.
create or replace function public.get_incident_reporter_contact(p_incident_id uuid)
returns table (reporter_name text, reporter_email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'ACTIVO'
      and p.role = 'administrador'
  ) then
    raise exception 'Reporter contact access denied';
  end if;

  return query
  select i.reporter_name, i.reporter_email
  from public.incidents i
  where i.id = p_incident_id;
end;
$$;

revoke all on function public.get_incident_reporter_contact(uuid) from public, anon, authenticated;
grant execute on function public.get_incident_reporter_contact(uuid) to authenticated;

commit;

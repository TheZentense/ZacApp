create or replace function private.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and status = 'ACTIVO'
  );
$$;

create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid())
    and status = 'ACTIVO';
$$;

create or replace function private.current_department_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select department_id
  from public.profiles
  where id = (select auth.uid())
    and status = 'ACTIVO';
$$;

revoke all on function private.current_user_is_active() from public, anon;
revoke all on function private.current_user_role() from public, anon;
revoke all on function private.current_department_id() from public, anon;
grant execute on function private.current_user_is_active() to authenticated;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.current_department_id() to authenticated;

drop policy if exists "departments readable by authenticated users" on public.departments;
create policy "departments readable by authenticated users"
on public.departments for select to authenticated
using (active = true and (select private.current_user_is_active()));

drop policy if exists "categories readable by authenticated users" on public.categories;
create policy "categories readable by authenticated users"
on public.categories for select to authenticated
using (active = true and (select private.current_user_is_active()));

drop policy if exists "citizens read own incidents" on public.incidents;
create policy "citizens read own incidents"
on public.incidents for select to authenticated
using (
  citizen_id = (select auth.uid())
  and (select private.current_user_is_active())
);

drop policy if exists "citizens create own incidents" on public.incidents;
create policy "citizens create own incidents"
on public.incidents for insert to authenticated
with check (
  citizen_id = (select auth.uid())
  and (select private.current_user_is_active())
  and status = 'REGISTRADO'
  and assigned_department_id is null
  and assigned_to is null
);

drop policy if exists "incident history follows incident visibility" on public.incident_history;
create policy "incident history follows incident visibility"
on public.incident_history for select to authenticated
using (
  (select private.current_user_is_active())
  and exists (
    select 1 from public.incidents i
    where i.id = incident_id
  )
);

drop policy if exists "evidence follows incident visibility" on public.incident_evidence;
create policy "evidence follows incident visibility"
on public.incident_evidence for select to authenticated
using (
  (select private.current_user_is_active())
  and exists (
    select 1 from public.incidents i
    where i.id = incident_id
  )
);

drop policy if exists "users add evidence to visible incidents" on public.incident_evidence;
create policy "users add evidence to visible incidents"
on public.incident_evidence for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and (select private.current_user_is_active())
  and exists (
    select 1 from public.incidents i
    where i.id = incident_id
  )
);

drop policy if exists "users upload incident evidence" on storage.objects;
create policy "users upload incident evidence"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'incidente-evidencia'
  and (select private.current_user_is_active())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "users read own incident evidence" on storage.objects;
create policy "users read own incident evidence"
on storage.objects for select to authenticated
using (
  bucket_id = 'incidente-evidencia'
  and (select private.current_user_is_active())
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.current_user_role()) <> 'ciudadano'
  )
);

drop policy if exists "users delete own incident evidence" on storage.objects;
create policy "users delete own incident evidence"
on storage.objects for delete to authenticated
using (
  bucket_id = 'incidente-evidencia'
  and (select private.current_user_is_active())
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

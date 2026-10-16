-- Reconciles the schema currently running on the VPS with the contract used by
-- ZacApp. This migration is intentionally idempotent so it can be reviewed and
-- tested before it is applied to the self-hosted Supabase instance.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'profile_status' and typnamespace = 'public'::regnamespace) then
    create type public.profile_status as enum ('ACTIVO', 'INACTIVO');
  end if;

  if not exists (select 1 from pg_type where typname = 'incident_priority' and typnamespace = 'public'::regnamespace) then
    create type public.incident_priority as enum ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');
  end if;

  if not exists (select 1 from pg_type where typname = 'assignment_status' and typnamespace = 'public'::regnamespace) then
    create type public.assignment_status as enum ('PENDIENTE', 'EN_PROCESO', 'ATENDIDO', 'CANCELADO');
  end if;
end $$;

alter table public.departments add column if not exists code text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists status public.profile_status not null default 'ACTIVO';
alter table public.profiles add column if not exists department_id bigint references public.departments(id);
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.categories add column if not exists department_id bigint references public.departments(id);

update public.departments
set code = case
  when lower(name) like '%agua%' then 'AGUA'
  when lower(name) like '%eemza%' or lower(name) like '%energ%' or lower(name) like '%alumbr%' then 'EEMZA'
  when lower(name) like '%dren%' then 'DRENAJES'
  when lower(name) like '%desech%' or lower(name) like '%limpieza%' then 'DESECHOS'
  when lower(name) like '%área%' then 'INFRAESTRUCTURA_AREAS'
  when lower(name) like '%infra%' or lower(name) like '%calle%' then 'INFRAESTRUCTURA'
  else 'DEP_' || id::text
end
where code is null or trim(code) = '';

create unique index if not exists departments_code_key on public.departments(code);
alter table public.departments alter column code set not null;

insert into public.departments (name, code)
values
  ('Agua potable', 'AGUA'),
  ('EEMZA', 'EEMZA'),
  ('Drenajes', 'DRENAJES'),
  ('Desechos sólidos', 'DESECHOS'),
  ('Infraestructura', 'INFRAESTRUCTURA')
on conflict (code) do update set active = true;

-- Preserve the old Areas department record for traceability without exposing
-- a duplicate operational destination. Its categories belong to Infrastructure.
update public.departments
set active = false
where code = 'INFRAESTRUCTURA_AREAS';

update public.categories c
set department_id = d.id
from public.departments d
where c.department_id is null
  and d.code = case
    when lower(c.name) like '%agua%' then 'AGUA'
    when lower(c.name) like '%alumbr%' or lower(c.name) like '%energ%' then 'EEMZA'
    when lower(c.name) like '%dren%' then 'DRENAJES'
    when lower(c.name) like '%limpieza%' or lower(c.name) like '%desech%' then 'DESECHOS'
    when lower(c.name) like '%calle%' or lower(c.name) like '%bache%' or lower(c.name) like '%área%' then 'INFRAESTRUCTURA'
  end;

-- Preserve every existing numeric priority while moving to the domain values
-- expected by the app: 1=BAJA, 2=MEDIA, 3=ALTA, 4=URGENTE.
do $$
declare
  priority_type text;
begin
  select t.typname
  into priority_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  where n.nspname = 'public'
    and c.relname = 'incidents'
    and a.attname = 'priority'
    and not a.attisdropped;

  if priority_type is null then
    alter table public.incidents add column priority public.incident_priority not null default 'MEDIA';
  elsif priority_type <> 'incident_priority' then
    alter table public.incidents alter column priority drop default;
    alter table public.incidents drop constraint if exists incidents_priority_check;
    alter table public.incidents
      alter column priority type public.incident_priority
      using (
        case priority::text
          when '1' then 'BAJA'
          when '2' then 'MEDIA'
          when '3' then 'ALTA'
          when '4' then 'URGENTE'
          when 'BAJA' then 'BAJA'
          when 'MEDIA' then 'MEDIA'
          when 'ALTA' then 'ALTA'
          when 'URGENTE' then 'URGENTE'
          else 'MEDIA'
        end
      )::public.incident_priority;
  end if;
end $$;

alter table public.incidents alter column priority set default 'MEDIA';
alter table public.incidents alter column priority set not null;
alter table public.incidents add column if not exists assigned_department_id bigint references public.departments(id);
alter table public.incidents add column if not exists assigned_to uuid references public.profiles(id);

create table if not exists public.assignments (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  department_id bigint not null references public.departments(id),
  assigned_to uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  status public.assignment_status not null default 'PENDIENTE',
  notes text
);

alter table public.incident_evidence add column if not exists file_url text;
alter table public.incident_evidence add column if not exists file_type text;
alter table public.incident_evidence add column if not exists storage_path text;
alter table public.incident_evidence add column if not exists mime_type text;

update public.incident_evidence
set
  storage_path = coalesce(storage_path, file_url),
  file_url = coalesce(file_url, storage_path),
  mime_type = coalesce(mime_type, file_type),
  file_type = coalesce(file_type, mime_type)
where storage_path is null
   or file_url is null
   or mime_type is null
   or file_type is null;

create unique index if not exists idx_incident_evidence_storage_path
  on public.incident_evidence(storage_path)
  where storage_path is not null;
create index if not exists idx_categories_department_id on public.categories(department_id);
create index if not exists idx_incidents_assigned_department_id on public.incidents(assigned_department_id);
create index if not exists idx_incidents_assigned_to on public.incidents(assigned_to);
create index if not exists idx_assignments_incident_id on public.assignments(incident_id);
create index if not exists idx_assignments_department_id on public.assignments(department_id);
create index if not exists idx_assignments_assigned_to on public.assignments(assigned_to);

create or replace function private.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and status = 'ACTIVO'
  );
$$;

create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles
  where id = (select auth.uid()) and status = 'ACTIVO';
$$;

create or replace function private.current_department_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select department_id from public.profiles
  where id = (select auth.uid()) and status = 'ACTIVO';
$$;

revoke all on function private.current_user_is_active() from public, anon;
revoke all on function private.current_user_role() from public, anon;
revoke all on function private.current_department_id() from public, anon;
grant execute on function private.current_user_is_active() to authenticated;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.current_department_id() to authenticated;

create or replace function public.update_own_profile(p_full_name text, p_phone text default null)
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
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if normalized_name is null or char_length(normalized_name) < 2 or char_length(normalized_name) > 100 then
    raise exception 'Invalid full name';
  end if;
  if normalized_phone is not null and normalized_phone !~ '^[0-9+() -]{8,20}$' then
    raise exception 'Invalid phone number';
  end if;

  update public.profiles
  set full_name = normalized_name, phone = normalized_phone, updated_at = now()
  where id = current_user_id and status = 'ACTIVO';

  if not found then raise exception 'Active profile not found'; end if;
end;
$$;

revoke all on function public.update_own_profile(text, text) from public, anon;
grant execute on function public.update_own_profile(text, text) to authenticated;

create or replace function private.transition_incident(
  p_incident_id uuid,
  p_previous_status public.incident_status,
  p_new_status public.incident_status,
  p_note text default null,
  p_department_id bigint default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role public.user_role;
  actor_department_id bigint;
  incident_row record;
  incident_department_id bigint;
  normalized_note text := nullif(trim(p_note), '');
  changed_at timestamptz;
  transition_allowed boolean := false;
begin
  select role, department_id into actor_role, actor_department_id
  from public.profiles
  where id = actor_id and status = 'ACTIVO';

  if actor_id is null or actor_role is null then raise exception 'Active authentication required'; end if;

  select i.id, i.status, i.assigned_department_id, c.department_id as category_department_id
  into incident_row
  from public.incidents i
  join public.categories c on c.id = i.category_id
  where i.id = p_incident_id
  for update of i;

  if not found then raise exception 'Incident not found'; end if;
  if incident_row.status <> p_previous_status then raise exception 'Incident status changed'; end if;

  incident_department_id := coalesce(incident_row.assigned_department_id, incident_row.category_department_id);
  if actor_role not in ('administrador', 'supervisor') and not (
    actor_role in ('coordinador', 'operador', 'mantenimiento')
    and actor_department_id = incident_department_id
  ) then raise exception 'Incident access denied'; end if;

  if actor_role = 'mantenimiento' then
    transition_allowed :=
      (p_previous_status = 'ASIGNADO' and p_new_status = 'EN_ATENCION') or
      (p_previous_status = 'EN_ATENCION' and p_new_status = 'POR_VERIFICAR');
  else
    transition_allowed :=
      (p_previous_status = 'REGISTRADO' and p_new_status in ('EN_REVISION', 'RECHAZADO')) or
      (p_previous_status = 'EN_REVISION' and p_new_status in ('VALIDADO', 'RECHAZADO')) or
      (p_previous_status = 'VALIDADO' and p_new_status in ('ASIGNADO', 'RECHAZADO')) or
      (p_previous_status = 'ASIGNADO' and p_new_status = 'EN_ATENCION') or
      (p_previous_status = 'EN_ATENCION' and p_new_status = 'POR_VERIFICAR') or
      (p_previous_status = 'POR_VERIFICAR' and p_new_status in ('CERRADO', 'EN_ATENCION')) or
      (p_previous_status = 'RECHAZADO' and p_new_status = 'EN_REVISION');
  end if;

  if not transition_allowed then raise exception 'Transition not allowed'; end if;
  if p_new_status = 'ASIGNADO' and p_department_id is null then raise exception 'Department required for assignment'; end if;
  if p_new_status in ('RECHAZADO', 'POR_VERIFICAR', 'CERRADO') and normalized_note is null then
    raise exception 'Transition note required';
  end if;

  update public.incidents
  set status = p_new_status,
      assigned_department_id = case when p_new_status = 'ASIGNADO' then p_department_id else assigned_department_id end
  where id = p_incident_id
  returning updated_at into changed_at;

  insert into public.incident_history (incident_id, changed_by, previous_status, new_status, note)
  values (p_incident_id, actor_id, p_previous_status, p_new_status, normalized_note);

  return changed_at;
end;
$$;

create or replace function public.transition_incident(
  p_incident_id uuid,
  p_previous_status public.incident_status,
  p_new_status public.incident_status,
  p_note text default null,
  p_department_id bigint default null
)
returns timestamptz
language sql
security invoker
set search_path = ''
as $$
  select private.transition_incident(p_incident_id, p_previous_status, p_new_status, p_note, p_department_id);
$$;

revoke all on function private.transition_incident(uuid, public.incident_status, public.incident_status, text, bigint) from public, anon;
revoke all on function public.transition_incident(uuid, public.incident_status, public.incident_status, text, bigint) from public, anon;
grant execute on function private.transition_incident(uuid, public.incident_status, public.incident_status, text, bigint) to authenticated;
grant execute on function public.transition_incident(uuid, public.incident_status, public.incident_status, text, bigint) to authenticated;

alter table public.departments enable row level security;
alter table public.incident_evidence enable row level security;
alter table public.assignments enable row level security;

grant select on public.categories, public.departments to authenticated;
grant select, insert on public.incident_history, public.incident_evidence to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert on public.incidents to authenticated;
revoke update on public.incidents from authenticated;
grant update (priority, assigned_department_id, assigned_to) on public.incidents to authenticated;

drop policy if exists "categories are publicly readable" on public.categories;
drop policy if exists "profiles update own basic data" on public.profiles;
drop policy if exists "admins read all profiles" on public.profiles;
drop policy if exists "admins update incidents" on public.incidents;
drop policy if exists "staff update permitted incidents" on public.incidents;
drop policy if exists "citizens read own evidence" on public.incident_evidence;
drop policy if exists "citizens add own evidence" on public.incident_evidence;
drop policy if exists "admins read all evidence" on public.incident_evidence;
drop policy if exists "maintenance read department evidence" on public.incident_evidence;

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
using (citizen_id = (select auth.uid()) and (select private.current_user_is_active()));

drop policy if exists "staff read permitted incidents" on public.incidents;
create policy "staff read permitted incidents"
on public.incidents for select to authenticated
using (
  (select private.current_user_role()) in ('administrador', 'supervisor') or
  (
    (select private.current_user_role()) in ('coordinador', 'operador', 'comunicacion', 'mantenimiento') and
    coalesce(assigned_department_id, (select c.department_id from public.categories c where c.id = category_id)) =
      (select private.current_department_id())
  )
);

drop policy if exists "citizens create own incidents" on public.incidents;
create policy "citizens create own incidents"
on public.incidents for insert to authenticated
with check (
  citizen_id = (select auth.uid()) and
  (select private.current_user_is_active()) and
  status = 'REGISTRADO' and assigned_department_id is null and assigned_to is null
);

drop policy if exists "administrators update incident management" on public.incidents;
create policy "administrators update incident management"
on public.incidents for update to authenticated
using ((select private.current_user_role()) in ('administrador', 'supervisor'))
with check ((select private.current_user_role()) in ('administrador', 'supervisor'));

drop policy if exists "incident history follows incident visibility" on public.incident_history;
create policy "incident history follows incident visibility"
on public.incident_history for select to authenticated
using (
  (select private.current_user_is_active()) and
  exists (select 1 from public.incidents i where i.id = incident_id)
);

drop policy if exists "evidence follows incident visibility" on public.incident_evidence;
create policy "evidence follows incident visibility"
on public.incident_evidence for select to authenticated
using (
  (select private.current_user_is_active()) and
  exists (select 1 from public.incidents i where i.id = incident_id)
);

drop policy if exists "users add evidence to visible incidents" on public.incident_evidence;
create policy "users add evidence to visible incidents"
on public.incident_evidence for insert to authenticated
with check (
  uploaded_by = (select auth.uid()) and
  (select private.current_user_is_active()) and
  exists (select 1 from public.incidents i where i.id = incident_id)
);

drop policy if exists "administrators update categories" on public.categories;
create policy "administrators update categories"
on public.categories for update to authenticated
using ((select private.current_user_role()) = 'administrador')
with check ((select private.current_user_role()) = 'administrador');

drop policy if exists "administrators update departments" on public.departments;
create policy "administrators update departments"
on public.departments for update to authenticated
using ((select private.current_user_role()) = 'administrador')
with check ((select private.current_user_role()) = 'administrador');

drop policy if exists "administrators update profiles" on public.profiles;
create policy "administrators update profiles"
on public.profiles for update to authenticated
using ((select private.current_user_role()) = 'administrador')
with check ((select private.current_user_role()) = 'administrador' and role <> 'administrador');

insert into storage.buckets (id, name, public)
values ('incidente-evidencia', 'incidente-evidencia', false)
on conflict (id) do nothing;

drop policy if exists "users upload incident evidence" on storage.objects;
create policy "users upload incident evidence"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'incidente-evidencia' and
  (select private.current_user_is_active()) and
  (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "users read own incident evidence" on storage.objects;
create policy "users read own incident evidence"
on storage.objects for select to authenticated
using (
  bucket_id = 'incidente-evidencia' and
  (select private.current_user_is_active()) and
  ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.current_user_role()) <> 'ciudadano')
);

drop policy if exists "users delete own incident evidence" on storage.objects;
create policy "users delete own incident evidence"
on storage.objects for delete to authenticated
using (
  bucket_id = 'incidente-evidencia' and
  (select private.current_user_is_active()) and
  (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;

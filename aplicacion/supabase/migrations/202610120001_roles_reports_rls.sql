create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.departments (
  id bigint generated always as identity primary key,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists department_id bigint references public.departments(id),
  add column if not exists updated_at timestamptz not null default now();

alter table public.incidents
  add column if not exists assigned_department_id bigint references public.departments(id),
  add column if not exists assigned_to uuid references public.profiles(id),
  add column if not exists priority smallint not null default 2 check (priority between 1 and 4);

create table if not exists public.incident_evidence (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null unique,
  mime_type text,
  created_at timestamptz not null default now()
);

create sequence if not exists public.incident_code_seq;

create or replace function private.set_incident_code()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.code is null or trim(new.code) = '' then
    new.code := 'ZAC-' || extract(year from now())::int || '-' || lpad(nextval('public.incident_code_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists incidents_set_code on public.incidents;
create trigger incidents_set_code
before insert on public.incidents
for each row execute function private.set_incident_code();

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists incidents_set_updated_at on public.incidents;
create trigger incidents_set_updated_at
before update on public.incidents
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    'ciudadano'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (id, full_name, role)
select
  id,
  coalesce(nullif(trim(raw_user_meta_data ->> 'full_name'), ''), split_part(email, '@', 1)),
  'ciudadano'
from auth.users
on conflict (id) do nothing;

create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function private.current_department_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select department_id from public.profiles where id = auth.uid();
$$;

revoke all on function private.current_user_role() from public, anon;
revoke all on function private.current_department_id() from public, anon;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.current_department_id() to authenticated;

revoke all on function public.current_user_role() from public, anon;
revoke all on function public.current_user_department_id() from public, anon;

alter table public.departments enable row level security;
alter table public.incident_evidence enable row level security;

grant select on public.categories, public.departments to authenticated;
grant select, insert, update on public.incidents to authenticated;
grant select, insert on public.incident_history, public.incident_evidence to authenticated;
grant select, update on public.profiles to authenticated;

drop policy if exists "profiles read own profile" on public.profiles;
create policy "profiles read own profile"
on public.profiles for select to authenticated
using (id = auth.uid());

drop policy if exists "administrators read profiles" on public.profiles;
create policy "administrators read profiles"
on public.profiles for select to authenticated
using (private.current_user_role() in ('administrador', 'supervisor', 'coordinador'));

drop policy if exists "profiles update own basic data" on public.profiles;
create policy "profiles update own basic data"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = private.current_user_role());

drop policy if exists "administrators update profiles" on public.profiles;
create policy "administrators update profiles"
on public.profiles for update to authenticated
using (private.current_user_role() = 'administrador')
with check (private.current_user_role() = 'administrador');

drop policy if exists "departments readable by authenticated users" on public.departments;
create policy "departments readable by authenticated users"
on public.departments for select to authenticated
using (active = true);

drop policy if exists "categories are publicly readable" on public.categories;
create policy "categories readable by authenticated users"
on public.categories for select to authenticated
using (active = true);

drop policy if exists "citizens read own incidents" on public.incidents;
drop policy if exists "citizens create own incidents" on public.incidents;
drop policy if exists "admins read all incidents" on public.incidents;
drop policy if exists "admins update incidents" on public.incidents;
drop policy if exists "maintenance read department incidents" on public.incidents;

create policy "citizens read own incidents"
on public.incidents for select to authenticated
using (citizen_id = auth.uid());

create policy "staff read permitted incidents"
on public.incidents for select to authenticated
using (
  private.current_user_role() in ('administrador', 'supervisor')
  or (
    private.current_user_role() in ('coordinador', 'operador', 'comunicacion', 'mantenimiento')
    and coalesce(
      assigned_department_id,
      (select c.department_id from public.categories c where c.id = category_id)
    ) = private.current_department_id()
  )
);

create policy "citizens create own incidents"
on public.incidents for insert to authenticated
with check (
  citizen_id = auth.uid()
  and status = 'REGISTRADO'
  and assigned_department_id is null
  and assigned_to is null
);

create policy "staff update permitted incidents"
on public.incidents for update to authenticated
using (
  private.current_user_role() in ('administrador', 'supervisor')
  or (
    private.current_user_role() in ('coordinador', 'operador', 'mantenimiento')
    and coalesce(
      assigned_department_id,
      (select c.department_id from public.categories c where c.id = category_id)
    ) = private.current_department_id()
  )
)
with check (
  private.current_user_role() in ('administrador', 'supervisor')
  or (
    private.current_user_role() in ('coordinador', 'operador', 'mantenimiento')
    and coalesce(
      assigned_department_id,
      (select c.department_id from public.categories c where c.id = category_id)
    ) = private.current_department_id()
  )
);

create policy "incident history follows incident visibility"
on public.incident_history for select to authenticated
using (
  exists (
    select 1 from public.incidents i
    where i.id = incident_id
  )
);

create policy "staff creates incident history"
on public.incident_history for insert to authenticated
with check (
  changed_by = auth.uid()
  and private.current_user_role() in ('administrador', 'supervisor', 'coordinador', 'operador', 'mantenimiento')
);

create policy "evidence follows incident visibility"
on public.incident_evidence for select to authenticated
using (
  exists (
    select 1 from public.incidents i
    where i.id = incident_id
  )
);

create policy "users add evidence to visible incidents"
on public.incident_evidence for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.incidents i
    where i.id = incident_id
  )
);

drop policy if exists "citizens read own evidence" on public.incident_evidence;
drop policy if exists "citizens add own evidence" on public.incident_evidence;
drop policy if exists "admins read all evidence" on public.incident_evidence;
drop policy if exists "maintenance read department evidence" on public.incident_evidence;

drop policy if exists "admins read all profiles" on public.profiles;
drop policy if exists "admins manage departments" on public.departments;

insert into storage.buckets (id, name, public)
values ('incidente-evidencia', 'incidente-evidencia', false)
on conflict (id) do nothing;

drop policy if exists "users upload incident evidence" on storage.objects;
create policy "users upload incident evidence"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'incidente-evidencia'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users read own incident evidence" on storage.objects;
create policy "users read own incident evidence"
on storage.objects for select to authenticated
using (
  bucket_id = 'incidente-evidencia'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or private.current_user_role() <> 'ciudadano'
  )
);

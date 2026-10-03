do $$
begin
  if not exists (select 1 from pg_type where typname = 'profile_status') then
    create type public.profile_status as enum ('ACTIVO', 'INACTIVO');
  end if;

  if not exists (select 1 from pg_type where typname = 'incident_priority') then
    create type public.incident_priority as enum ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');
  end if;

  if not exists (select 1 from pg_type where typname = 'assignment_status') then
    create type public.assignment_status as enum ('PENDIENTE', 'EN_PROCESO', 'ATENDIDO', 'CANCELADO');
  end if;
end $$;

create table if not exists public.departments (
  id bigint generated always as identity primary key,
  name text not null unique,
  code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.departments (name, code) values
  ('Agua', 'AGUA'),
  ('EEMZA', 'EEMZA'),
  ('Drenajes', 'DRENAJES'),
  ('Desechos', 'DESECHOS'),
  ('Infraestructura', 'INFRAESTRUCTURA')
on conflict (code) do update set
  name = excluded.name,
  active = true;

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists status public.profile_status not null default 'ACTIVO';
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists department_id bigint references public.departments(id);

alter table public.categories add column if not exists department_id bigint references public.departments(id);

insert into public.categories (name) values
  ('Drenajes'),
  ('Desechos sólidos'),
  ('Calles')
on conflict (name) do nothing;

update public.categories
set department_id = case
  when name in ('Agua potable') then (select id from public.departments where code = 'AGUA')
  when name in ('Alumbrado público', 'Energía eléctrica') then (select id from public.departments where code = 'EEMZA')
  when name in ('Drenajes') then (select id from public.departments where code = 'DRENAJES')
  when name in ('Limpieza', 'Desechos sólidos') then (select id from public.departments where code = 'DESECHOS')
  when name in ('Calles y baches', 'Calles', 'Áreas públicas') then (select id from public.departments where code = 'INFRAESTRUCTURA')
  else department_id
end
where department_id is null;

alter table public.categories alter column department_id set not null;

alter table public.incidents add column if not exists priority public.incident_priority not null default 'MEDIA';

comment on column public.incidents.citizen_id is 'Frontend equivalent: user/citizen that created the report.';
comment on column public.incidents.address_reference is 'Frontend equivalent: location.';
comment on column public.incidents.priority is 'Frontend equivalent: priority.';

create table if not exists public.incident_evidence (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  file_url text not null,
  file_type text not null,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  department_id bigint not null references public.departments(id),
  assigned_to uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  status public.assignment_status not null default 'PENDIENTE',
  notes text
);

create index if not exists idx_categories_department_id on public.categories(department_id);
create index if not exists idx_incidents_category_id on public.incidents(category_id);
create index if not exists idx_incident_evidence_incident_id on public.incident_evidence(incident_id);
create index if not exists idx_assignments_incident_id on public.assignments(incident_id);
create index if not exists idx_assignments_department_id on public.assignments(department_id);
create index if not exists idx_assignments_assigned_to on public.assignments(assigned_to);
create index if not exists idx_incident_history_incident_id on public.incident_history(incident_id);

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_department_id()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select department_id from public.profiles where id = auth.uid()
$$;

alter table public.departments enable row level security;
alter table public.incident_evidence enable row level security;
alter table public.assignments enable row level security;

create policy "departments are readable" on public.departments
  for select using (active = true);

create policy "profiles read own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "admins read all profiles" on public.profiles
  for select using (public.current_user_role() = 'administrador');

create policy "admins manage departments" on public.departments
  for all using (public.current_user_role() = 'administrador')
  with check (public.current_user_role() = 'administrador');

create policy "admins read all incidents" on public.incidents
  for select using (public.current_user_role() = 'administrador');

create policy "admins update incidents" on public.incidents
  for update using (public.current_user_role() = 'administrador')
  with check (public.current_user_role() = 'administrador');

create policy "maintenance read department incidents" on public.incidents
  for select using (
    public.current_user_role() = 'mantenimiento'
    and exists (
      select 1
      from public.categories c
      where c.id = incidents.category_id
        and c.department_id = public.current_user_department_id()
    )
  );

create policy "citizens read own evidence" on public.incident_evidence
  for select using (
    exists (
      select 1 from public.incidents i
      where i.id = incident_evidence.incident_id
        and i.citizen_id = auth.uid()
    )
  );

create policy "citizens add own evidence" on public.incident_evidence
  for insert with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.incidents i
      where i.id = incident_evidence.incident_id
        and i.citizen_id = auth.uid()
    )
  );

create policy "admins read all evidence" on public.incident_evidence
  for select using (public.current_user_role() = 'administrador');

create policy "maintenance read department evidence" on public.incident_evidence
  for select using (
    public.current_user_role() = 'mantenimiento'
    and exists (
      select 1
      from public.incidents i
      join public.categories c on c.id = i.category_id
      where i.id = incident_evidence.incident_id
        and c.department_id = public.current_user_department_id()
    )
  );

create policy "admins manage assignments" on public.assignments
  for all using (public.current_user_role() = 'administrador')
  with check (public.current_user_role() = 'administrador');

create policy "maintenance read own department assignments" on public.assignments
  for select using (
    public.current_user_role() = 'mantenimiento'
    and department_id = public.current_user_department_id()
  );

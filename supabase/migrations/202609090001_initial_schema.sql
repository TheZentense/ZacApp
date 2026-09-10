create type public.user_role as enum ('ciudadano','operador','coordinador','mantenimiento','supervisor','administrador','comunicacion');
create type public.incident_status as enum ('REGISTRADO','EN_REVISION','VALIDADO','ASIGNADO','EN_ATENCION','POR_VERIFICAR','CERRADO','RECHAZADO');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'ciudadano',
  municipality text,
  created_at timestamptz not null default now()
);

create table public.categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  active boolean not null default true
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles(id),
  category_id bigint not null references public.categories(id),
  code text not null unique,
  title text not null,
  description text not null,
  address_reference text not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  status public.incident_status not null default 'REGISTRADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.incident_history (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  changed_by uuid not null references public.profiles(id),
  previous_status public.incident_status,
  new_status public.incident_status not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_history enable row level security;

create policy "categories are publicly readable" on public.categories for select using (active = true);
create policy "citizens read own incidents" on public.incidents for select using (auth.uid() = citizen_id);
create policy "citizens create own incidents" on public.incidents for insert with check (auth.uid() = citizen_id);

insert into public.categories (name) values ('Alumbrado público'), ('Agua potable'), ('Limpieza'), ('Calles y baches'), ('Áreas públicas');

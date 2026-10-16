begin;

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

alter table public.incidents
  add column if not exists reporter_name text,
  add column if not exists reporter_email text;

alter table public.incident_evidence
  add column if not exists evidence_kind text not null default 'OTRA';

alter table public.incident_evidence
  drop constraint if exists incident_evidence_kind_check;

alter table public.incident_evidence
  add constraint incident_evidence_kind_check
  check (evidence_kind in ('INICIAL', 'AVANCE', 'FINAL', 'OTRA'));

alter table public.incident_evidence
  drop constraint if exists incident_evidence_required_provenance_check;

-- Historical records can be reviewed later; every new evidence row must always
-- identify its uploader, object path and real MIME type.
alter table public.incident_evidence
  add constraint incident_evidence_required_provenance_check
  check (
    uploaded_by is not null
    and nullif(trim(storage_path), '') is not null
    and mime_type = 'image/jpeg'
  ) not valid;

create unique index if not exists incident_evidence_one_initial_per_incident
  on public.incident_evidence (incident_id)
  where evidence_kind = 'INICIAL';

comment on column public.incidents.reporter_name is
  'Immutable display-name snapshot of the citizen that submitted the report.';
comment on column public.incidents.reporter_email is
  'Immutable email snapshot used for report provenance; never included in object paths.';
comment on column public.incident_evidence.evidence_kind is
  'Business classification of the evidence: INICIAL, AVANCE, FINAL or OTRA.';

alter table public.incidents
  add column if not exists location_point extensions.geography(point, 4326)
  generated always as (
    case
      when latitude is null or longitude is null then null
      else extensions.st_setsrid(
        extensions.st_makepoint(longitude::double precision, latitude::double precision),
        4326
      )::extensions.geography
    end
  ) stored;

create index if not exists incidents_location_point_gix
  on public.incidents using gist (location_point);

alter table public.incidents
  drop constraint if exists incidents_required_identity_gps_check;

-- NOT VALID preserves historical rows that were created before GPS and identity
-- snapshots existed, while enforcing the requirements for every new report.
alter table public.incidents
  add constraint incidents_required_identity_gps_check
  check (
    nullif(trim(reporter_name), '') is not null
    and nullif(trim(reporter_email), '') is not null
    and latitude between -90 and 90
    and longitude between -180 and 180
  ) not valid;

update storage.buckets
set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg']::text[]
where id = 'incidente-evidencia';

create or replace function private.create_incident_with_evidence(
  p_incident_id uuid,
  p_category_id bigint,
  p_description text,
  p_address_reference text,
  p_latitude double precision,
  p_longitude double precision,
  p_storage_path text,
  p_mime_type text
)
returns table (id uuid, code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_name text;
  current_email text;
  category_department_code text;
  expected_storage_path text;
  clean_description text := trim(p_description);
  clean_reference text := trim(p_address_reference);
  created_incident public.incidents%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select nullif(trim(p.full_name), ''), nullif(trim(u.email), '')
  into current_name, current_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = current_user_id
    and p.status = 'ACTIVO'
    and p.role = 'ciudadano';

  if current_name is null or current_email is null then
    raise exception 'Verified citizen identity required';
  end if;

  if clean_description is null or char_length(clean_description) < 10 or char_length(clean_description) > 500 then
    raise exception 'Invalid description';
  end if;

  if clean_reference is null or char_length(clean_reference) < 3 or char_length(clean_reference) > 250 then
    raise exception 'Invalid address reference';
  end if;

  if p_latitude is null or p_latitude < -90 or p_latitude > 90
    or p_longitude is null or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Valid GPS coordinates required';
  end if;

  select upper(regexp_replace(trim(d.code), '[^A-Za-z0-9_-]', '-', 'g'))
  into category_department_code
  from public.categories c
  join public.departments d on d.id = c.department_id
  where c.id = p_category_id
    and c.active = true
    and d.active = true;

  if category_department_code is null then
    raise exception 'Active category and department required';
  end if;

  expected_storage_path := format(
    'reportes/%s/categoria-%s/%s/%s/%s/ciudadano-%s/evidencia-inicial.jpg',
    category_department_code,
    p_category_id,
    to_char(timezone('America/Guatemala', now()), 'YYYY'),
    to_char(timezone('America/Guatemala', now()), 'MM'),
    p_incident_id,
    current_user_id
  );

  if p_incident_id is null
    or p_mime_type <> 'image/jpeg'
    or p_storage_path <> expected_storage_path then
    raise exception 'Valid JPEG evidence required';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'incidente-evidencia'
      and o.name = p_storage_path
      and o.owner_id = current_user_id::text
  ) then
    raise exception 'Uploaded evidence not found';
  end if;

  insert into public.incidents (
    id,
    citizen_id,
    category_id,
    title,
    description,
    address_reference,
    latitude,
    longitude,
    reporter_name,
    reporter_email
  ) values (
    p_incident_id,
    current_user_id,
    p_category_id,
    left(clean_description, 80),
    clean_description,
    clean_reference,
    p_latitude,
    p_longitude,
    current_name,
    current_email
  )
  returning * into created_incident;

  insert into public.incident_evidence (
    incident_id,
    uploaded_by,
    storage_path,
    mime_type,
    file_url,
    file_type,
    evidence_kind
  ) values (
    created_incident.id,
    current_user_id,
    p_storage_path,
    p_mime_type,
    p_storage_path,
    p_mime_type,
    'INICIAL'
  );

  return query select created_incident.id, created_incident.code;
end;
$$;

create or replace function public.create_incident_with_evidence(
  p_incident_id uuid,
  p_category_id bigint,
  p_description text,
  p_address_reference text,
  p_latitude double precision,
  p_longitude double precision,
  p_storage_path text,
  p_mime_type text
)
returns table (id uuid, code text)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.create_incident_with_evidence(
    p_incident_id,
    p_category_id,
    p_description,
    p_address_reference,
    p_latitude,
    p_longitude,
    p_storage_path,
    p_mime_type
  );
$$;

revoke all on function private.create_incident_with_evidence(uuid, bigint, text, text, double precision, double precision, text, text) from public, anon;
revoke all on function public.create_incident_with_evidence(uuid, bigint, text, text, double precision, double precision, text, text) from public, anon;
grant execute on function private.create_incident_with_evidence(uuid, bigint, text, text, double precision, double precision, text, text) to authenticated;
grant execute on function public.create_incident_with_evidence(uuid, bigint, text, text, double precision, double precision, text, text) to authenticated;

-- The bucket remains private. Files are grouped by business sector and report,
-- while immutable user IDs provide provenance without leaking names or emails.
drop policy if exists "users upload incident evidence" on storage.objects;
create policy "users upload incident evidence"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'incidente-evidencia'
  and (select private.current_user_is_active())
  and (storage.foldername(name))[1] = 'reportes'
  and name ~ '^reportes/[A-Z0-9_-]+/categoria-[0-9]+/[0-9]{4}/[0-9]{2}/[0-9a-f-]{36}/(ciudadano|personal)-[0-9a-f-]{36}/[A-Za-z0-9._-]+[.]jpg$'
  and (
    (
      (select private.current_user_role()) = 'ciudadano'
      and (storage.foldername(name))[7] = 'ciudadano-' || (select auth.uid())::text
    )
    or (
      (select private.current_user_role()) <> 'ciudadano'
      and (storage.foldername(name))[7] = 'personal-' || (select auth.uid())::text
    )
  )
);

drop policy if exists "users read own incident evidence" on storage.objects;
create policy "users read own incident evidence"
on storage.objects for select to authenticated
using (
  bucket_id = 'incidente-evidencia'
  and (select private.current_user_is_active())
  and (
    (storage.foldername(name))[7] in (
      'ciudadano-' || (select auth.uid())::text,
      'personal-' || (select auth.uid())::text
    )
    or (select private.current_user_role()) <> 'ciudadano'
  )
);

drop policy if exists "users delete own incident evidence" on storage.objects;
create policy "users delete own incident evidence"
on storage.objects for delete to authenticated
using (
  bucket_id = 'incidente-evidencia'
  and (select private.current_user_is_active())
  and (storage.foldername(name))[7] in (
    'ciudadano-' || (select auth.uid())::text,
    'personal-' || (select auth.uid())::text
  )
);

commit;

begin;

alter table public.incidents
  drop constraint if exists incidents_required_identity_gps_check;

alter table public.incidents
  add constraint incidents_required_identity_gps_check
  check (
    latitude between -90 and 90
    and longitude between -180 and 180
    and (
      submission_kind = 'INVITADO'
      or (
        nullif(trim(reporter_name), '') is not null
        and nullif(trim(reporter_email), '') is not null
      )
    )
  ) not valid;

comment on column public.incidents.reporter_name is
  'Immutable display-name snapshot for registered citizens; null for anonymous reports.';
comment on column public.incidents.reporter_email is
  'Immutable email snapshot for registered citizens; null for anonymous reports.';

create or replace function private.create_incident_with_evidence(
  p_incident_id uuid,
  p_category_id bigint,
  p_description text,
  p_address_reference text,
  p_latitude double precision,
  p_longitude double precision,
  p_storage_paths text[],
  p_mime_type text,
  p_reporter_name text default null,
  p_reporter_email text default null
)
returns table (id uuid, code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  is_guest boolean := coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false);
  current_name text;
  current_email text;
  category_department_code text;
  expected_storage_path text;
  clean_description text := trim(p_description);
  clean_reference text := trim(p_address_reference);
  evidence_count integer := coalesce(cardinality(p_storage_paths), 0);
  evidence_index integer;
  created_incident public.incidents%rowtype;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(current_user_id::text, 0));

  select nullif(trim(p.full_name), ''), nullif(trim(u.email), '')
  into current_name, current_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = current_user_id and p.status = 'ACTIVO' and p.role = 'ciudadano';

  if current_name is null then raise exception 'Active citizen identity required'; end if;

  if is_guest then
    current_name := null;
    current_email := null;
    if evidence_count > 3 then raise exception 'Guest evidence limit exceeded'; end if;
    if exists (
      select 1 from public.incidents
      where citizen_id = current_user_id
        and created_at > now() - interval '15 minutes'
    ) then raise exception 'Guest submission cooldown active'; end if;
    if (
      select count(*) from public.incidents
      where citizen_id = current_user_id
        and created_at > now() - interval '24 hours'
    ) >= 5 then raise exception 'Guest daily report limit reached'; end if;
  elsif current_email is null then
    raise exception 'Verified citizen identity required';
  end if;

  if clean_description is null or char_length(clean_description) < 10 or char_length(clean_description) > 500 then raise exception 'Invalid description'; end if;
  if clean_reference is null or char_length(clean_reference) < 3 or char_length(clean_reference) > 250 then raise exception 'Invalid address reference'; end if;
  if p_latitude is null or p_latitude < -90 or p_latitude > 90 or p_longitude is null or p_longitude < -180 or p_longitude > 180 then raise exception 'Valid GPS coordinates required'; end if;
  if p_incident_id is null or p_mime_type <> 'image/jpeg' or evidence_count < 1 or evidence_count > 5 then raise exception 'Between one and five JPEG evidence files are required'; end if;

  select upper(regexp_replace(trim(d.code), '[^A-Za-z0-9_-]', '-', 'g'))
  into category_department_code
  from public.categories c
  join public.departments d on d.id = c.department_id
  where c.id = p_category_id and c.active = true and d.active = true;

  if category_department_code is null then raise exception 'Active category and department required'; end if;

  for evidence_index in 1..evidence_count loop
    expected_storage_path := format(
      'reportes/%s/categoria-%s/%s/%s/%s/%s-%s/%s',
      category_department_code,
      p_category_id,
      to_char(timezone('America/Guatemala', now()), 'YYYY'),
      to_char(timezone('America/Guatemala', now()), 'MM'),
      p_incident_id,
      case when is_guest then 'invitado' else 'ciudadano' end,
      current_user_id,
      case when evidence_index = 1 then 'evidencia-inicial.jpg' else format('evidencia-adicional-%s.jpg', lpad(evidence_index::text, 2, '0')) end
    );
    if p_storage_paths[evidence_index] <> expected_storage_path then raise exception 'Invalid evidence path at position %', evidence_index; end if;
  end loop;

  if (
    select count(*)
    from storage.objects o
    where o.bucket_id = 'incidente-evidencia'
      and o.name = any(p_storage_paths)
      and o.owner_id = current_user_id::text
  ) <> evidence_count then raise exception 'One or more uploaded evidence files were not found'; end if;

  insert into public.incidents (
    id, citizen_id, category_id, title, description, address_reference,
    latitude, longitude, reporter_name, reporter_email, submission_kind
  ) values (
    p_incident_id, current_user_id, p_category_id, left(clean_description, 80),
    clean_description, clean_reference, p_latitude, p_longitude,
    current_name, current_email, case when is_guest then 'INVITADO' else 'REGISTRADO' end
  ) returning * into created_incident;

  insert into public.incident_evidence (
    incident_id, uploaded_by, storage_path, mime_type, file_url, file_type, evidence_kind
  )
  select created_incident.id, current_user_id, evidence_path, p_mime_type,
    evidence_path, p_mime_type, case when position = 1 then 'INICIAL' else 'ADICIONAL' end
  from unnest(p_storage_paths) with ordinality as evidence(evidence_path, position);

  return query select created_incident.id, created_incident.code;
end;
$$;

revoke all on function private.create_incident_with_evidence(uuid, bigint, text, text, double precision, double precision, text[], text, text, text) from public, anon;
grant execute on function private.create_incident_with_evidence(uuid, bigint, text, text, double precision, double precision, text[], text, text, text) to authenticated;

commit;

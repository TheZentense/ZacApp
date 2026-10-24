begin;

-- Remove optional defaults from the guest-aware public signature. PostgREST
-- can then distinguish an eight-argument legacy call from a ten-argument call.
drop function public.create_incident_with_evidence(uuid, bigint, text, text, double precision, double precision, text[], text, text, text);

create or replace function public.create_incident_with_evidence(
  p_incident_id uuid,
  p_category_id bigint,
  p_description text,
  p_address_reference text,
  p_latitude double precision,
  p_longitude double precision,
  p_storage_paths text[],
  p_mime_type text,
  p_reporter_name text,
  p_reporter_email text
)
returns table (id uuid, code text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_incident_with_evidence(
    p_incident_id, p_category_id, p_description, p_address_reference,
    p_latitude, p_longitude, p_storage_paths, p_mime_type,
    p_reporter_name, p_reporter_email
  );
$$;

revoke all on function public.create_incident_with_evidence(uuid, bigint, text, text, double precision, double precision, text[], text, text, text) from public, anon;
grant execute on function public.create_incident_with_evidence(uuid, bigint, text, text, double precision, double precision, text[], text, text, text) to authenticated;

-- Keep the previous RPC signature available while the published clients move
-- to the guest-aware signature. Anonymous identities cannot use this wrapper
-- because the protected implementation requires guest contact information.
create or replace function public.create_incident_with_evidence(
  p_incident_id uuid,
  p_category_id bigint,
  p_description text,
  p_address_reference text,
  p_latitude double precision,
  p_longitude double precision,
  p_storage_paths text[],
  p_mime_type text
)
returns table (id uuid, code text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.create_incident_with_evidence(
    p_incident_id, p_category_id, p_description, p_address_reference,
    p_latitude, p_longitude, p_storage_paths, p_mime_type, null, null
  );
$$;

revoke all on function public.create_incident_with_evidence(uuid, bigint, text, text, double precision, double precision, text[], text) from public, anon;
grant execute on function public.create_incident_with_evidence(uuid, bigint, text, text, double precision, double precision, text[], text) to authenticated;

commit;

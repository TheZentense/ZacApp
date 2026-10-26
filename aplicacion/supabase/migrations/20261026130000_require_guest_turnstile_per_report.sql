begin;

-- A validated Turnstile challenge authorizes exactly one incident UUID for one
-- anonymous Supabase identity. No report or evidence row is changed here.
create table if not exists private.guest_report_permits (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id),
  incident_id uuid not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  unique (account_id, incident_id)
);

alter table private.guest_report_permits enable row level security;
revoke all on private.guest_report_permits from public, anon, authenticated;

create index if not exists guest_report_permits_expiry_idx
  on private.guest_report_permits (expires_at);

-- Only the server-side Edge Function, using its service_role key after
-- Cloudflare Siteverify and Auth verification, can issue a permit.
create or replace function public.issue_guest_report_permit(
  p_account_id uuid,
  p_incident_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_account_id is null or p_incident_id is null then
    raise exception 'Account and incident required';
  end if;
  if not exists (
    select 1 from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = p_account_id and p.role = 'ciudadano' and p.status = 'ACTIVO'
  ) then
    raise exception 'Active citizen identity required';
  end if;

  insert into private.guest_report_permits (account_id, incident_id, expires_at)
  -- Siteverify has already consumed the short-lived token. Give a mobile
  -- connection enough time to upload up to three optimized JPEGs.
  values (p_account_id, p_incident_id, now() + interval '15 minutes')
  on conflict (account_id, incident_id) do update
    set expires_at = excluded.expires_at
    where guest_report_permits.consumed_at is null;

  if not found then raise exception 'Permit already consumed'; end if;
  return true;
end;
$$;

revoke all on function public.issue_guest_report_permit(uuid, uuid) from public, anon, authenticated;
grant execute on function public.issue_guest_report_permit(uuid, uuid) to service_role;

create or replace function private.require_guest_report_permit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if new.submission_kind <> 'INVITADO' then return new; end if;

  if caller_id is null
    or new.citizen_id is distinct from caller_id
    or coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) is not true then
    raise exception 'Anonymous identity required';
  end if;

  update private.guest_report_permits
    set consumed_at = now()
  where account_id = caller_id
    and incident_id = new.id
    and consumed_at is null
    and expires_at > now();

  if not found then raise exception 'Fresh Turnstile verification required'; end if;
  return new;
end;
$$;

revoke all on function private.require_guest_report_permit() from public, anon, authenticated;
drop trigger if exists incidents_require_guest_report_permit on public.incidents;
create trigger incidents_require_guest_report_permit
before insert on public.incidents
for each row execute function private.require_guest_report_permit();

commit;

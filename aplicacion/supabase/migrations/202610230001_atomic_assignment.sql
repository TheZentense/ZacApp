begin;

-- Assignment details are audit metadata. incidents remains the source of current ownership.
alter table public.incident_history
  add column if not exists assigned_department_id bigint references public.departments(id),
  add column if not exists assigned_to uuid references public.profiles(id),
  add column if not exists priority public.incident_priority;

create or replace function public.assign_incident(
  p_incident_id uuid,
  p_previous_status public.incident_status,
  p_department_id bigint,
  p_assigned_to uuid,
  p_priority public.incident_priority,
  p_note text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  incident_row record;
  normalized_note text := nullif(trim(p_note), '');
  changed_at timestamptz;
begin
  if actor_id is null then
    raise exception 'Assignment access denied';
  end if;

  perform 1 from public.profiles
  where id = actor_id and role = 'administrador' and status = 'ACTIVO'
  for share;
  if not found then
    raise exception 'Assignment access denied';
  end if;

  select status, assigned_department_id, assigned_to
    into incident_row
  from public.incidents
  where id = p_incident_id
  for update;

  if not found then raise exception 'Incident not found'; end if;
  if incident_row.status is distinct from p_previous_status then raise exception 'Incident status changed'; end if;
  if incident_row.status <> 'VALIDADO'
     or incident_row.assigned_department_id is not null
     or incident_row.assigned_to is not null then
    raise exception 'Incident is not available for assignment';
  end if;
  if normalized_note is null then raise exception 'Assignment note required'; end if;
  if length(normalized_note) > 300 then raise exception 'Assignment note too long'; end if;
  if p_priority is null then raise exception 'Priority required'; end if;
  perform 1 from public.departments
  where id = p_department_id and active = true
  for share;
  if not found then
    raise exception 'Active department required';
  end if;
  perform 1 from public.profiles
  where id = p_assigned_to
    and department_id = p_department_id
    and status = 'ACTIVO'
    and role in ('operador', 'mantenimiento')
  for share;
  if not found then
    raise exception 'Active assignee in the selected department required';
  end if;

  update public.incidents
  set assigned_department_id = p_department_id,
      assigned_to = p_assigned_to,
      priority = p_priority,
      status = 'ASIGNADO'
  where id = p_incident_id
  returning updated_at into changed_at;

  insert into public.incident_history (
    incident_id, changed_by, previous_status, new_status, note,
    assigned_department_id, assigned_to, priority
  ) values (
    p_incident_id, actor_id, p_previous_status, 'ASIGNADO', normalized_note,
    p_department_id, p_assigned_to, p_priority
  );

  return changed_at;
end;
$$;

-- The old transition RPC must not create an ASIGNADO row without its assignee.
-- Its existing private implementation remains responsible for all other transitions.
create or replace function public.transition_incident(
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
begin
  if p_new_status = 'ASIGNADO' then
    raise exception 'Use assign_incident for assignments';
  end if;
  return private.transition_incident(
    p_incident_id, p_previous_status, p_new_status, p_note, p_department_id
  );
end;
$$;

revoke all on function public.assign_incident(uuid, public.incident_status, bigint, uuid, public.incident_priority, text) from public, anon;
grant execute on function public.assign_incident(uuid, public.incident_status, bigint, uuid, public.incident_priority, text) to authenticated;
revoke all on function private.transition_incident(uuid, public.incident_status, public.incident_status, text, bigint) from authenticated;
revoke update on public.incidents from authenticated;
revoke update (priority, assigned_department_id, assigned_to) on public.incidents from authenticated;

commit;

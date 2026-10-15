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
  select role, department_id
  into actor_role, actor_department_id
  from public.profiles
  where id = actor_id
    and status = 'ACTIVO';

  if actor_id is null or actor_role is null then
    raise exception 'Active authentication required';
  end if;

  select
    i.id,
    i.status,
    i.assigned_department_id,
    c.department_id as category_department_id
  into incident_row
  from public.incidents i
  join public.categories c on c.id = i.category_id
  where i.id = p_incident_id
  for update of i;

  if not found then
    raise exception 'Incident not found';
  end if;

  if incident_row.status <> p_previous_status then
    raise exception 'Incident status changed';
  end if;

  incident_department_id := coalesce(incident_row.assigned_department_id, incident_row.category_department_id);

  if actor_role not in ('administrador', 'supervisor')
    and not (
      actor_role in ('coordinador', 'operador', 'mantenimiento')
      and actor_department_id = incident_department_id
    ) then
    raise exception 'Incident access denied';
  end if;

  if actor_role = 'mantenimiento' then
    transition_allowed :=
      (p_previous_status = 'ASIGNADO' and p_new_status = 'EN_ATENCION')
      or (p_previous_status = 'EN_ATENCION' and p_new_status = 'POR_VERIFICAR');
  elsif actor_role in ('administrador', 'supervisor', 'coordinador', 'operador') then
    transition_allowed :=
      (p_previous_status = 'REGISTRADO' and p_new_status in ('EN_REVISION', 'RECHAZADO'))
      or (p_previous_status = 'EN_REVISION' and p_new_status in ('VALIDADO', 'RECHAZADO'))
      or (p_previous_status = 'VALIDADO' and p_new_status in ('ASIGNADO', 'RECHAZADO'))
      or (p_previous_status = 'ASIGNADO' and p_new_status = 'EN_ATENCION')
      or (p_previous_status = 'EN_ATENCION' and p_new_status = 'POR_VERIFICAR')
      or (p_previous_status = 'POR_VERIFICAR' and p_new_status in ('CERRADO', 'EN_ATENCION'))
      or (p_previous_status = 'RECHAZADO' and p_new_status = 'EN_REVISION');
  end if;

  if not transition_allowed then
    raise exception 'Transition not allowed';
  end if;

  if p_new_status = 'ASIGNADO' and p_department_id is null then
    raise exception 'Department required for assignment';
  end if;

  if p_new_status in ('RECHAZADO', 'POR_VERIFICAR', 'CERRADO') and normalized_note is null then
    raise exception 'Transition note required';
  end if;

  update public.incidents
  set
    status = p_new_status,
    assigned_department_id = case
      when p_new_status = 'ASIGNADO' then p_department_id
      else assigned_department_id
    end
  where id = p_incident_id
  returning updated_at into changed_at;

  insert into public.incident_history (
    incident_id,
    changed_by,
    previous_status,
    new_status,
    note
  ) values (
    p_incident_id,
    actor_id,
    p_previous_status,
    p_new_status,
    normalized_note
  );

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
  select private.transition_incident(
    p_incident_id,
    p_previous_status,
    p_new_status,
    p_note,
    p_department_id
  );
$$;

revoke all on function private.transition_incident(uuid, public.incident_status, public.incident_status, text, bigint) from public, anon;
revoke all on function public.transition_incident(uuid, public.incident_status, public.incident_status, text, bigint) from public, anon;
grant execute on function private.transition_incident(uuid, public.incident_status, public.incident_status, text, bigint) to authenticated;
grant execute on function public.transition_incident(uuid, public.incident_status, public.incident_status, text, bigint) to authenticated;

revoke update on public.incidents from authenticated;
grant update (priority, assigned_department_id, assigned_to) on public.incidents to authenticated;
revoke insert on public.incident_history from authenticated;

drop policy if exists "staff update permitted incidents" on public.incidents;
create policy "administrators update incident management"
on public.incidents for update to authenticated
using ((select private.current_user_role()) in ('administrador', 'supervisor'))
with check ((select private.current_user_role()) in ('administrador', 'supervisor'));

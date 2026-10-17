begin;

create or replace function private.current_user_can_read_incident(p_incident_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.incidents i
    join public.profiles p on p.id = (select auth.uid())
    left join public.categories c on c.id = i.category_id
    where i.id = p_incident_id
      and p.status = 'ACTIVO'
      and (
        (p.role = 'ciudadano' and i.citizen_id = p.id)
        or p.role in ('administrador', 'supervisor')
        or (p.role = 'operador' and i.assigned_to = p.id)
        or (
          p.role in ('coordinador', 'comunicacion', 'mantenimiento')
          and coalesce(i.assigned_department_id, c.department_id) = p.department_id
        )
      )
  );
$$;

revoke all on function private.current_user_can_read_incident(uuid) from public, anon;
grant execute on function private.current_user_can_read_incident(uuid) to authenticated;

drop policy if exists "staff read permitted incidents" on public.incidents;
create policy "staff read permitted incidents"
on public.incidents for select to authenticated
using (
  (select private.current_user_is_active())
  and (
    (select private.current_user_role()) in ('administrador', 'supervisor')
    or (
      (select private.current_user_role()) = 'operador'
      and assigned_to = (select auth.uid())
    )
    or (
      (select private.current_user_role()) in ('coordinador', 'comunicacion', 'mantenimiento')
      and coalesce(
        assigned_department_id,
        (select c.department_id from public.categories c where c.id = category_id)
      ) = (select private.current_department_id())
    )
  )
);

drop policy if exists "incident history follows incident visibility" on public.incident_history;
create policy "incident history follows incident visibility"
on public.incident_history for select to authenticated
using (
  (select private.current_user_is_active())
  and (select private.current_user_can_read_incident(incident_id))
);

drop policy if exists "evidence follows incident visibility" on public.incident_evidence;
create policy "evidence follows incident visibility"
on public.incident_evidence for select to authenticated
using (
  (select private.current_user_is_active())
  and (select private.current_user_can_read_incident(incident_id))
);

drop policy if exists "users add evidence to visible incidents" on public.incident_evidence;
create policy "users add evidence to visible incidents"
on public.incident_evidence for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and (select private.current_user_is_active())
  and (select private.current_user_can_read_incident(incident_id))
);

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

  select i.id, i.status, i.assigned_department_id, i.assigned_to, c.department_id as category_department_id
  into incident_row
  from public.incidents i
  join public.categories c on c.id = i.category_id
  where i.id = p_incident_id
  for update of i;

  if not found then raise exception 'Incident not found'; end if;
  if incident_row.status <> p_previous_status then raise exception 'Incident status changed'; end if;

  incident_department_id := coalesce(incident_row.assigned_department_id, incident_row.category_department_id);

  if actor_role in ('administrador', 'supervisor') then
    null;
  elsif actor_role = 'operador' then
    if incident_row.assigned_to is distinct from actor_id then raise exception 'Incident access denied'; end if;
  elsif actor_role in ('coordinador', 'mantenimiento') then
    if actor_department_id is distinct from incident_department_id then raise exception 'Incident access denied'; end if;
  else
    raise exception 'Incident access denied';
  end if;

  if actor_role in ('mantenimiento', 'operador') then
    transition_allowed :=
      (p_previous_status = 'ASIGNADO' and p_new_status = 'EN_ATENCION')
      or (p_previous_status = 'EN_ATENCION' and p_new_status = 'POR_VERIFICAR');
  elsif actor_role in ('administrador', 'supervisor', 'coordinador') then
    transition_allowed :=
      (p_previous_status = 'REGISTRADO' and p_new_status in ('EN_REVISION', 'RECHAZADO'))
      or (p_previous_status = 'EN_REVISION' and p_new_status in ('VALIDADO', 'RECHAZADO'))
      or (p_previous_status = 'VALIDADO' and p_new_status in ('ASIGNADO', 'RECHAZADO'))
      or (p_previous_status = 'ASIGNADO' and p_new_status = 'EN_ATENCION')
      or (p_previous_status = 'EN_ATENCION' and p_new_status = 'POR_VERIFICAR')
      or (p_previous_status = 'POR_VERIFICAR' and p_new_status in ('CERRADO', 'EN_ATENCION'))
      or (p_previous_status = 'RECHAZADO' and p_new_status = 'EN_REVISION');
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

drop policy if exists "users read own incident evidence" on storage.objects;
drop policy if exists "users read permitted incident evidence" on storage.objects;
create policy "users read permitted incident evidence"
on storage.objects for select to authenticated
using (
  bucket_id = 'incidente-evidencia'
  and (select private.current_user_is_active())
  and exists (
    select 1
    from public.incident_evidence e
    where e.storage_path = name
      and (select private.current_user_can_read_incident(e.incident_id))
  )
);

commit;

-- Datos controlados para validar la separación de reportes por departamento.
-- Este archivo no es una migración y no se ejecuta automáticamente.
-- Requiere que qa.ciudadano@zacapp.gt exista como perfil ciudadano activo.

begin;

do $$
declare
  demo_citizen_id uuid;
  history_actor_id uuid;
  demo record;
  created_incident_id uuid;
begin
  select p.id
  into demo_citizen_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = 'qa.ciudadano@zacapp.gt'
    and p.role = 'ciudadano'
    and p.status = 'ACTIVO'
  limit 1;

  if demo_citizen_id is null then
    raise exception 'No existe el ciudadano de pruebas qa.ciudadano@zacapp.gt';
  end if;

  select coalesce(
    (
      select p.id
      from public.profiles p
      join auth.users u on u.id = p.id
      where lower(u.email) = 'qa.admin@zacapp.gt'
        and p.role = 'administrador'
        and p.status = 'ACTIVO'
      limit 1
    ),
    demo_citizen_id
  ) into history_actor_id;

  for demo in
    select *
    from (values
      ('PRUEBA DEPARTAMENTAL · AGUA', 'Agua potable', 'Fuga de agua reportada para validar la bandeja del departamento de Agua.', 'Sector de pruebas Agua, Zacapa', 'ALTA'::public.incident_priority, 14.972100::numeric, -89.530600::numeric),
      ('PRUEBA DEPARTAMENTAL · EEMZA', 'Alumbrado público', 'Luminaria sin servicio para validar la bandeja del departamento de EEMZA.', 'Sector de pruebas EEMZA, Zacapa', 'MEDIA'::public.incident_priority, 14.971800::numeric, -89.529900::numeric),
      ('PRUEBA DEPARTAMENTAL · DRENAJES', 'Drenajes', 'Drenaje obstruido para validar la bandeja del departamento de Drenajes.', 'Sector de pruebas Drenajes, Zacapa', 'URGENTE'::public.incident_priority, 14.971400::numeric, -89.529400::numeric),
      ('PRUEBA DEPARTAMENTAL · DESECHOS', 'Limpieza', 'Acumulación de residuos para validar la bandeja del departamento de Desechos.', 'Sector de pruebas Desechos, Zacapa', 'MEDIA'::public.incident_priority, 14.971000::numeric, -89.528900::numeric),
      ('PRUEBA DEPARTAMENTAL · INFRAESTRUCTURA', 'Calles y baches', 'Bache en la vía para validar la bandeja del departamento de Infraestructura.', 'Sector de pruebas Infraestructura, Zacapa', 'ALTA'::public.incident_priority, 14.970600::numeric, -89.528400::numeric)
    ) as seed(title, category_name, description, address_reference, priority, latitude, longitude)
  loop
    if not exists (select 1 from public.incidents i where i.title = demo.title) then
      insert into public.incidents (
        citizen_id,
        category_id,
        code,
        title,
        description,
        address_reference,
        latitude,
        longitude,
        reporter_name,
        reporter_email,
        priority,
        status,
        assigned_department_id
      )
      select
        demo_citizen_id,
        c.id,
        null,
        demo.title,
        demo.description,
        demo.address_reference,
        demo.latitude,
        demo.longitude,
        'QA Ciudadano',
        'qa.ciudadano@zacapp.gt',
        demo.priority,
        'ASIGNADO'::public.incident_status,
        c.department_id
      from public.categories c
      where c.name = demo.category_name
        and c.active = true
      returning id into created_incident_id;

      if created_incident_id is null then
        raise exception 'No existe una categoría activa para %', demo.category_name;
      end if;

      insert into public.incident_history (
        incident_id,
        changed_by,
        previous_status,
        new_status,
        note
      ) values
        (created_incident_id, history_actor_id, null, 'REGISTRADO', 'Caso departamental preparado para pruebas controladas.'),
        (created_incident_id, history_actor_id, 'REGISTRADO', 'EN_REVISION', 'Información revisada para la prueba departamental.'),
        (created_incident_id, history_actor_id, 'EN_REVISION', 'VALIDADO', 'Caso validado para comprobar los permisos del departamento.'),
        (created_incident_id, history_actor_id, 'VALIDADO', 'ASIGNADO', 'Caso canalizado al departamento correspondiente.');
    end if;
  end loop;
end;
$$;

commit;


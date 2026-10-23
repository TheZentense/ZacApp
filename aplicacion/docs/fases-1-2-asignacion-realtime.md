# Fases 1 y 2: asignación y Realtime

## Alcance local

- `202610230001_atomic_assignment.sql` crea `public.assign_incident`. Una sola transacción bloquea el reporte, comprueba que sigue `VALIDADO` y sin asignación, valida administrador, departamento y responsable activos, guarda prioridad/departamento/responsable/`ASIGNADO` en `incidents` y registra la observación, autor y responsable en `incident_history`.
- `transition_incident` conserva las demás transiciones, pero rechaza `ASIGNADO`. Se revocan las escrituras directas de asignación para `authenticated`.
- `202610230002_realtime_reports.sql` añade `incidents`, `incident_history` e `incident_evidence` a `supabase_realtime` si faltan. Realtime no aplica RLS a `DELETE`: la migración desactiva `DELETE` y `TRUNCATE` en la publicación solo si no hay otras tablas dependientes; en caso contrario falla sin aplicar cambios. No modifica RLS ni Storage.
- La app vuelve a consultar por REST después de cada aviso Realtime. La lista filtra por ciudadano, persona o departamento; la vista de seguimiento filtra historial y evidencia por reporte. Los datos mostrados siempre proceden de consultas sujetas a RLS.

Los reportes ya asignados en estados anteriores quedan intactos. La nueva RPC solo admite reportes `VALIDADO` sin responsable ni departamento. Los seis reportes históricos detectados requieren revisión individual en otra intervención.

## Pendiente de aprobación: respaldo y aplicación remota

Estos comandos están **preparados, no ejecutados**. Ejecutarlos solo tras autorización explícita para modificar PostgreSQL del VPS. No reinician Coolify ni cambian servicios. Usar la sesión SSH de root ya autenticada; no enviar contraseñas por chat.

1. En el VPS, crear y verificar el respaldo **antes** de aplicar cualquier SQL:

```bash
set -euo pipefail
DB=supabase-db-zkh1ndvdzgbhadhdf8xgvtxr
install -d -m 700 /root/zacapp-backups /root/zacapp-migrations
BASE=/root/zacapp-backups/zacapp-$(date -u +%Y%m%dT%H%M%S%N)-$$
umask 077
( set -C; docker exec "$DB" pg_dump -U postgres -d postgres -Fc > "$BASE.dump" )
( set -C; docker exec "$DB" pg_dumpall -U postgres --globals-only > "$BASE.globals.sql" )
test -s "$BASE.dump"
test -s "$BASE.globals.sql"
docker exec -i "$DB" pg_restore -l < "$BASE.dump" > "$BASE.list"
docker exec -i "$DB" pg_restore -f /dev/null < "$BASE.dump"
sha256sum "$BASE.dump" "$BASE.globals.sql" > "$BASE.sha256"
sha256sum -c "$BASE.sha256"
```

Guardar el valor de `BASE` y su checksum fuera del VPS antes de una intervención posterior. `pg_restore -f /dev/null` descomprime el archivo sin escribir en PostgreSQL; una restauración real de ensayo se haría en una base separada. El respaldo incluye la base `postgres` y los roles globales, **no** los objetos binarios de Storage/MinIO, los volúmenes de Coolify, la configuración de contenedores ni las variables de entorno. Si hay otras bases de usuario en el clúster, deben respaldarse también antes de afirmar que el clúster completo está cubierto. Los archivos `.globals.sql` pueden contener hashes de contraseñas: mantenerlos con permisos 0600 y no pegar su contenido en el chat.

2. Desde PowerShell local, después del respaldo, copiar únicamente las dos migraciones:

```powershell
scp -o KexAlgorithms=curve25519-sha256 .\aplicacion\supabase\migrations\202610230001_atomic_assignment.sql .\aplicacion\supabase\migrations\202610230002_realtime_reports.sql root@77.237.246.163:/root/zacapp-migrations/
```

3. En el VPS, aplicar en orden y detenerse ante cualquier error:

```bash
set -euo pipefail
DB=supabase-db-zkh1ndvdzgbhadhdf8xgvtxr
install -d -m 700 /root/zacapp-migrations
docker exec -i "$DB" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < /root/zacapp-migrations/202610230001_atomic_assignment.sql
docker exec -i "$DB" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < /root/zacapp-migrations/202610230002_realtime_reports.sql
docker exec "$DB" psql -X -U postgres -d postgres -Atc "select schemaname,tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('incidents','incident_history','incident_evidence') order by tablename"
```

Cada migración usa transacción. El primer archivo debe terminar correctamente antes de publicar tablas en Realtime. La app nueva se despliega **después** de aplicar y verificar ambas migraciones, con una autorización de despliegue independiente.

## Restauración de ensayo y recuperación

La recuperación empieza restaurando el archivo verificado en **otra base** del mismo PostgreSQL, sin tocar `postgres` ni los datos de producción:

```bash
DB=supabase-db-zkh1ndvdzgbhadhdf8xgvtxr
BASE=/root/zacapp-backups/REEMPLAZAR_CON_BASE_VERIFICADA
sha256sum -c "$BASE.sha256"
docker exec "$DB" createdb -U postgres zacapp_restore_check
docker exec -i "$DB" pg_restore -U postgres -d zacapp_restore_check --no-owner --no-acl --exit-on-error < "$BASE.dump"
docker exec "$DB" psql -X -U postgres -d zacapp_restore_check -Atc "select count(*) from public.incidents"
```

Usar un nombre nuevo si `zacapp_restore_check` ya existe. El cambio de la base de producción hacia la copia restaurada requiere un plan de corte y autorización específica; **no** ejecutar `pg_restore --clean` sobre `postgres` durante esta fase.

## Verificación funcional posterior al despliegue autorizado

1. Abrir sesiones simultáneas de administrador, operador y mantenimiento, más una sesión ciudadana autenticada existente.
2. Crear un reporte de prueba nuevo, revisar `REGISTRADO → EN_REVISION → VALIDADO` y asignarlo a una persona activa. Confirmar `ASIGNADO`, departamento, responsable y una sola fila de historial con observación.
3. Confirmar que solo el operador elegido y mantenimiento del departamento reciben el reporte, con fotografía firmada. Otro operador del mismo departamento no debe verlo.
4. Cambiar `ASIGNADO → EN_ATENCION → POR_VERIFICAR` desde el trabajador. Verificar cambios en administrador y seguimiento ciudadano sin recargar manualmente, y luego tras reconectar la red.
5. Revisar que consultas a historial, evidencia y URLs firmadas de un reporte ajeno sigan denegadas por RLS. Comprobar que los reportes históricos no cambiaron.

La fase 3 (ciudadano sin login visible), las mejoras de GPS/fotografías de fase 4 y el despliegue están fuera de esta implementación local.

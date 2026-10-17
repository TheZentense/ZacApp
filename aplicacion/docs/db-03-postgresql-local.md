# DB-03 - PostgreSQL local para desarrollo de ZacApp

Este recurso inicia un único PostgreSQL 16 local para experimentar con el esquema inicial de ZacApp y preparar futuras pruebas de una API propia. No inicia la aplicación Expo ni configura un backend HTTP.

La aplicación actual utiliza el cliente de `src/lib/supabase.ts` para comunicarse con Supabase. Este contenedor no sustituye Supabase Auth, Storage, PostGIS ni las políticas RLS desplegadas. No debe usarse como entorno equivalente a producción ni como prueba de los permisos actuales de ciudadanos, operadores o departamentos.

## Archivos y alcance del esquema

```text
aplicacion/
├── docker-compose.yml
├── database/local/init/00_supabase_local_compat.sql
├── docs/db-03-postgresql-local.md
├── src/lib/supabase.ts
└── supabase/migrations/
    ├── 202609090001_initial_schema.sql
    ├── 202610030001_extend_incident_schema.sql
    ├── ... otras migraciones posteriores ...
    └── 202610170003_restrict_citizen_incident_policies.sql
```

En un volumen nuevo, la imagen de PostgreSQL ejecuta solamente estos archivos, en este orden:

1. `00_supabase_local_compat.sql`, que crea `pgcrypto`, una tabla mínima `auth.users` y una función de compatibilidad `auth.uid()`.
2. `202609090001_initial_schema.sql`, montado como `10_initial_schema.sql`, que crea `profiles`, `categories`, `incidents` e `incident_history`, junto con las reglas y datos iniciales de esa migración.

Las migraciones posteriores sí existen en el repositorio. Este Compose no las monta ni las aplica. El esquema local inicial no incluye las funciones actuales de creación con múltiples fotografías, asignaciones personales, historial atómico o representación geográfica. Esas migraciones requieren revisar sus dependencias de Supabase antes de intentar reproducirlas en otro entorno.

**El SQL de compatibilidad es exclusivamente para desarrollo local. Nunca debe ejecutarse en el Supabase real.** Su `auth.uid()` devuelve siempre `NULL`: no verifica JWT, no inicia sesiones y no representa a un usuario autenticado. Ejecutarlo sobre Supabase reemplazaría una función real de autenticación. Consultar como usuario propietario de PostgreSQL tampoco demuestra que RLS aísle correctamente a los empleados.

## Requisitos

- Docker con el complemento `docker compose`; para iniciar el servicio, Docker Desktop o el motor Docker debe estar en ejecución.
- PowerShell para los ejemplos de esta guía.
- El puerto local elegido debe estar disponible.
- Node.js y npm se necesitan para la aplicación Expo, pero no para validar este archivo Compose.

No es necesario instalar un cliente PostgreSQL dentro del frontend.

## Configuración sin modificar archivos de entorno

Ejecutar desde la carpeta `aplicacion`. Definir valores exclusivos de desarrollo en la sesión actual de PowerShell:

```powershell
$env:POSTGRES_DB = Read-Host 'Nombre de la base de desarrollo local'
$env:POSTGRES_USER = Read-Host 'Usuario de PostgreSQL local'
$localPgPassword = Read-Host 'Nueva contraseña exclusiva de desarrollo local' -AsSecureString
$env:POSTGRES_PASSWORD = [System.Net.NetworkCredential]::new('', $localPgPassword).Password
Remove-Variable localPgPassword
$env:POSTGRES_PORT = '5432'
```

No se proporciona una contraseña de ejemplo ni se deben reutilizar credenciales reales. Compose rechaza la configuración si `POSTGRES_DB`, `POSTGRES_USER` o `POSTGRES_PASSWORD` están ausentes o vacías. `POSTGRES_PORT` es opcional y usa `5432` si no se define; puede cambiarse, por ejemplo, a `5433` si el puerto está ocupado.

Los valores duran en la sesión y se heredan por el proceso de Compose. Si se abre otra terminal, deben definirse de nuevo. No es necesario crear, sobrescribir ni modificar `.env`, `.env.local` o `.env.example`.

Los comandos siguientes usan `--env-file NUL`, el archivo nulo de Windows, para evitar la carga automática del `.env` del proyecto. En Linux o macOS, usar `/dev/null` en su lugar y definir las variables en la sesión del shell correspondiente.

`POSTGRES_PASSWORD` es configuración privada de desarrollo. Nunca debe convertirse en una variable `EXPO_PUBLIC_*`, copiarse al frontend, incluirse en documentación con su valor ni subirse a GitHub. Las variables públicas de Supabase que ya utiliza Expo siguen siendo independientes de este entorno.

## Validar sin iniciar contenedores

```powershell
docker compose --env-file NUL config --quiet
```

Este comando verifica la estructura y la interpolación de variables. No inicia contenedores, no ejecuta SQL y no necesita consultar una base de datos. Usar `--quiet` evita mostrar la configuración resuelta, que incluiría la contraseña.

## Iniciar manualmente el entorno local

Los comandos de esta sección son instrucciones para el desarrollador; no forman parte de la validación estática anterior.

```powershell
docker compose --env-file NUL up -d
```

El único servicio es `zacapp-postgres`, con contenedor `zacapp-postgres-local`, imagen `postgres:16-alpine` y volumen persistente `zacapp_postgres_data`. Los scripts de inicialización se montan en modo de solo lectura.

El puerto se publica exclusivamente en `127.0.0.1`, no en todas las interfaces de red. La conexión desde la misma computadora usa `127.0.0.1` y el puerto indicado en `POSTGRES_PORT`. Este contenedor no habilita acceso desde otros equipos de la red ni cambia la conexión de Expo a Supabase.

La inicialización se ejecuta solo cuando el volumen de datos está vacío. Cambiar las variables o los scripts no vuelve a ejecutar esa inicialización ni cambia automáticamente la contraseña almacenada en una base existente. No borrar el volumen para resolver una diferencia de configuración sin revisar primero sus datos.

## Comprobar el servicio local

```powershell
docker compose --env-file NUL ps
docker compose --env-file NUL exec zacapp-postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

El `healthcheck` del Compose consulta la disponibilidad usando el usuario y la base del contenedor. No comprueba funciones de Supabase, autenticación de usuarios de ZacApp ni aislamiento mediante RLS.

Para abrir una consola de la base local, únicamente cuando se necesite trabajar en ella:

```powershell
docker compose --env-file NUL exec zacapp-postgres sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

La conexión local utiliza las variables del contenedor. No introducir direcciones o credenciales del VPS en estos comandos.

## Detener conservando los datos

```powershell
docker compose --env-file NUL down
```

El volumen persistente se conserva. Esta guía no necesita eliminar archivos ni volúmenes.

Cuando ya no se necesiten las variables en esa terminal:

```powershell
Remove-Item Env:POSTGRES_PASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:POSTGRES_USER -ErrorAction SilentlyContinue
Remove-Item Env:POSTGRES_DB -ErrorAction SilentlyContinue
Remove-Item Env:POSTGRES_PORT -ErrorAction SilentlyContinue
```

## Relación con la aplicación actual

- **Expo:** continúa usando el SDK de Supabase; no se conecta directamente al puerto PostgreSQL ni recibe su contraseña.
- **Supabase Auth:** este Compose no proporciona su API, sesiones, verificación de usuarios ni gestión real de JWT.
- **Supabase Storage:** no se crea su servicio, bucket privado, objetos ni generación de URLs firmadas.
- **PostGIS:** no se instala ni se reproducen las columnas geográficas de las migraciones recientes.
- **RLS:** las reglas iniciales no representan el conjunto actualizado del repositorio ni prueban el estado desplegado. Las pruebas entre cuentas y departamentos requieren un entorno de pruebas apropiado de Supabase.

Para una futura API propia, la conexión a PostgreSQL deberá configurarse en ese backend con variables privadas. Este recurso no introduce esa API, no aplica migraciones remotas y no modifica Supabase, Coolify ni el VPS.

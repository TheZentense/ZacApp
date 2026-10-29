# Respaldos de ZacApp en el VPS

Este procedimiento cubre los dos conjuntos de datos que deben recuperarse juntos:

- PostgreSQL: usuarios, perfiles, reportes, estados, asignaciones y metadatos de evidencia.
- Storage/MinIO: fotografías asociadas a los reportes.

Un respaldo de PostgreSQL por sí solo no contiene las fotografías. La carpeta terminada incluye:

- `postgres.dump`: copia lógica en formato personalizado de PostgreSQL.
- `globals.sql`: roles globales; puede contener hashes y debe tratarse como información privada.
- `storage.tar.gz`: objetos binarios almacenados en MinIO.
- `postgres.contents` y `storage.contents`: inventarios usados durante la validación.
- `metadata.txt`: fecha y versiones de origen.
- `SHA256SUMS`: comprobaciones de integridad.

## Ejecución manual en el VPS

El script descubre exactamente un contenedor de PostgreSQL y uno de MinIO. Si encuentra cero o más de uno, se detiene sin producir un respaldo ambiguo.

```bash
ZACAPP_BACKUP_FORCE=1 /home/zacappadmin/bin/backup-zacapp-vps
```

Los respaldos terminados se guardan con permisos privados en:

```text
/home/zacappadmin/backups/zacapp/AAAAMMDDThhmmssZ
```

El VPS conserva siete días. Las carpetas incompletas nunca se consideran respaldos válidos.

## Copia y validación en Windows

Desde PowerShell:

```powershell
& '.\scripts\pull-vps-backup.ps1'
```

La ubicación predeterminada es `%USERPROFILE%\ZacApp-Backups`. El script no elimina respaldos locales automáticamente y verifica cada archivo mediante SHA-256 después de copiarlo.

## Programación recomendada

- VPS: cron lo invoca cada hora; el script solo genera la copia cuando en `America/Guatemala` son las 21 horas.
- Windows: copiar diariamente a las 21:15, mientras el equipo esté encendido.
- Mantener al menos una copia fuera del VPS.

## Restauración de ensayo

La restauración debe probarse en una base y un directorio separados. Nunca usar `--clean` contra la base `postgres` activa durante una prueba.

Ejemplo conceptual para la base:

```bash
docker exec SUPABASE_DB createdb -U supabase_admin zacapp_restore_check
docker exec -i SUPABASE_DB pg_restore -U supabase_admin -d zacapp_restore_check --no-owner --no-acl --exit-on-error < postgres.dump
```

Storage debe extraerse en un directorio temporal y compararse con `storage.contents`; no debe sobrescribirse `/data` durante una prueba.

La sustitución de datos de producción requiere una ventana de mantenimiento y autorización específica.

El rol `postgres` del contenedor no es superusuario y no puede recrear algunas funciones internas de Realtime. Para una restauración integral aislada debe utilizarse `supabase_admin` dentro del contenedor. Nunca se debe publicar ni extraer una contraseña de este rol.

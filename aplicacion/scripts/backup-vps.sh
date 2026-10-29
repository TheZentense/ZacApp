#!/usr/bin/env bash
set -euo pipefail

umask 077

backup_root="${ZACAPP_BACKUP_ROOT:-$HOME/backups/zacapp}"
retention_days="${ZACAPP_BACKUP_RETENTION_DAYS:-7}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

# The VPS uses a European timezone and its cron implementation cannot schedule
# per-user timezones. Hourly cron invokes this guard so 21:00 Guatemala remains
# correct across European daylight-saving changes. Manual runs use FORCE=1.
if [[ "${ZACAPP_BACKUP_FORCE:-0}" != '1' && "$(TZ=America/Guatemala date +%H)" != '21' ]]; then
  exit 0
fi

if ! [[ "$retention_days" =~ ^[0-9]+$ ]]; then
  echo "ZACAPP_BACKUP_RETENTION_DAYS debe ser un número entero." >&2
  exit 1
fi

mkdir -p -- "$backup_root"
chmod 700 "$backup_root"
workdir="$(mktemp -d "$backup_root/.incomplete-${timestamp}-XXXXXX")"
finaldir="$backup_root/$timestamp"

cleanup() {
  if [[ -d "$workdir" ]]; then
    rm -rf -- "$workdir"
  fi
}
trap cleanup EXIT

select_container() {
  local prefix="$1"
  local matches
  matches="$(docker ps --filter "name=^/${prefix}" --format '{{.Names}}')"
  if [[ -z "$matches" || "$(printf '%s\n' "$matches" | wc -l)" -ne 1 ]]; then
    echo "Se esperaba exactamente un contenedor activo con prefijo ${prefix}." >&2
    exit 1
  fi
  printf '%s' "$matches"
}

db_container="$(select_container 'supabase-db-')"
storage_container="$(select_container 'supabase-minio-')"

docker exec "$db_container" pg_isready -U postgres -d postgres >/dev/null
docker exec "$db_container" pg_dump -U postgres -d postgres -Fc > "$workdir/postgres.dump"
docker exec "$db_container" pg_dumpall -U postgres --globals-only > "$workdir/globals.sql"
storage_stage="$workdir/storage-data"
mkdir -p -- "$storage_stage"
docker cp "$storage_container:/data/." "$storage_stage"
tar -C "$storage_stage" -czf "$workdir/storage.tar.gz" .
rm -rf -- "$storage_stage"

docker exec -i "$db_container" pg_restore -l < "$workdir/postgres.dump" > "$workdir/postgres.contents"
docker exec -i "$db_container" pg_restore -f /dev/null < "$workdir/postgres.dump"
tar -tzf "$workdir/storage.tar.gz" > "$workdir/storage.contents"

{
  printf 'created_utc=%s\n' "$timestamp"
  printf 'database_container=%s\n' "$db_container"
  printf 'database_version=%s\n' "$(docker exec "$db_container" psql -U postgres -d postgres -Atqc 'show server_version')"
  printf 'storage_container=%s\n' "$storage_container"
  printf 'retention_days_vps=%s\n' "$retention_days"
} > "$workdir/metadata.txt"

(
  cd "$workdir"
  sha256sum postgres.dump globals.sql storage.tar.gz metadata.txt > SHA256SUMS
  sha256sum --check SHA256SUMS >/dev/null
)

chmod 600 "$workdir"/*
mv -- "$workdir" "$finaldir"
workdir=''

# Only completed timestamped backups are eligible for VPS retention cleanup.
find "$backup_root" -mindepth 1 -maxdepth 1 -type d -name '20??????T??????Z' -mtime "+$retention_days" -exec rm -rf -- {} +

printf 'Respaldo completado: %s\n' "$finaldir"

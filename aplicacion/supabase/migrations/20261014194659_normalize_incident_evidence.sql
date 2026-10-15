alter table public.incident_evidence
  add column if not exists file_url text,
  add column if not exists file_type text,
  add column if not exists storage_path text,
  add column if not exists mime_type text;

update public.incident_evidence
set
  storage_path = coalesce(storage_path, file_url),
  file_url = coalesce(file_url, storage_path),
  mime_type = coalesce(mime_type, file_type),
  file_type = coalesce(file_type, mime_type)
where storage_path is null
   or file_url is null
   or mime_type is null
   or file_type is null;

create unique index if not exists idx_incident_evidence_storage_path
  on public.incident_evidence(storage_path)
  where storage_path is not null;

grant select, insert on public.incident_evidence to authenticated;

drop policy if exists "users delete own incident evidence" on storage.objects;
create policy "users delete own incident evidence"
on storage.objects for delete to authenticated
using (
  bucket_id = 'incidente-evidencia'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

begin;

-- Existing evidence used the historical `{user-id}/{incident-id}/...` layout.
-- Keep it readable by its owner without allowing any new upload in that format.
drop policy if exists "users read own incident evidence" on storage.objects;
create policy "users read own incident evidence"
on storage.objects for select to authenticated
using (
  bucket_id = 'incidente-evidencia'
  and (select private.current_user_is_active())
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (storage.foldername(name))[7] in (
      'ciudadano-' || (select auth.uid())::text,
      'personal-' || (select auth.uid())::text
    )
    or (select private.current_user_role()) <> 'ciudadano'
  )
);

drop policy if exists "users delete own incident evidence" on storage.objects;
create policy "users delete own incident evidence"
on storage.objects for delete to authenticated
using (
  bucket_id = 'incidente-evidencia'
  and (select private.current_user_is_active())
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (storage.foldername(name))[7] in (
      'ciudadano-' || (select auth.uid())::text,
      'personal-' || (select auth.uid())::text
    )
  )
);

commit;

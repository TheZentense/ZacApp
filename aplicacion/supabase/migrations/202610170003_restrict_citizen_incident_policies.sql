begin;

-- Follow-up to 202610170002: do not rewrite a migration that may be deployed.
-- Permissive policies are ORed. Ownership alone must not let a former citizen
-- bypass the operator's assigned_to restriction or create new citizen reports.
drop policy if exists "citizens read own incidents" on public.incidents;
create policy "citizens read own incidents"
on public.incidents for select to authenticated
using (
  (select private.current_user_role()) = 'ciudadano'
  and (select private.current_user_is_active())
  and citizen_id = (select auth.uid())
);

drop policy if exists "citizens create own incidents" on public.incidents;
create policy "citizens create own incidents"
on public.incidents for insert to authenticated
with check (
  (select private.current_user_role()) = 'ciudadano'
  and (select private.current_user_is_active())
  and citizen_id = (select auth.uid())
  and status = 'REGISTRADO'
  and assigned_department_id is null
  and assigned_to is null
);

commit;

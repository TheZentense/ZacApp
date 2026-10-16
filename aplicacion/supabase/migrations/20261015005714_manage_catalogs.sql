grant select, update on public.categories, public.departments to authenticated;

drop policy if exists "administrators update categories" on public.categories;
create policy "administrators update categories"
on public.categories for update to authenticated
using (private.current_user_role() = 'administrador')
with check (private.current_user_role() = 'administrador');

drop policy if exists "administrators update departments" on public.departments;
create policy "administrators update departments"
on public.departments for update to authenticated
using (private.current_user_role() = 'administrador')
with check (private.current_user_role() = 'administrador');

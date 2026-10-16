drop policy if exists "profiles update own basic data" on public.profiles;

drop policy if exists "administrators update profiles" on public.profiles;
create policy "administrators update profiles"
on public.profiles for update to authenticated
using (private.current_user_role() = 'administrador')
with check (
  private.current_user_role() = 'administrador'
  and role <> 'administrador'
);

grant select, update on public.profiles to authenticated;

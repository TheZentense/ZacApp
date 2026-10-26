grant select (id, name, active) on public.categories to anon;

drop policy if exists "active categories readable before anonymous sign-in" on public.categories;
create policy "active categories readable before anonymous sign-in"
on public.categories
for select
to anon
using (active = true);

comment on policy "active categories readable before anonymous sign-in" on public.categories is
  'Allows the anonymous report form to list only active category identifiers and names before CAPTCHA-protected sign-in.';

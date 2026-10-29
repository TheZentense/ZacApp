begin;

-- Supabase historically granted broad default privileges on new public
-- tables. RLS protects row operations, but privileges such as TRUNCATE are not
-- governed by RLS. Start from no table privileges and grant only the API
-- surface used by ZacApp.
revoke all privileges on table public.assignments from anon, authenticated;
revoke all privileges on table public.categories from anon, authenticated;
revoke all privileges on table public.departments from anon, authenticated;
revoke all privileges on table public.incident_evidence from anon, authenticated;
revoke all privileges on table public.incident_history from anon, authenticated;
revoke all privileges on table public.incidents from anon, authenticated;
revoke all privileges on table public.profiles from anon, authenticated;

grant select (id, name, active) on table public.categories to anon;

grant select on table public.categories to authenticated;
grant update (department_id, active) on table public.categories to authenticated;

grant select on table public.departments to authenticated;
grant update (active) on table public.departments to authenticated;

grant select, insert on table public.incidents to authenticated;
grant update (priority, assigned_department_id, assigned_to) on table public.incidents to authenticated;

grant select on table public.incident_history to authenticated;
grant select, insert on table public.incident_evidence to authenticated;

grant select on table public.profiles to authenticated;
grant update (role, status, department_id) on table public.profiles to authenticated;

-- These trigger functions execute through their triggers. They are not client
-- RPC endpoints and do not need PostgreSQL's default PUBLIC execution grant.
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.set_incident_code() from public, anon, authenticated;

commit;

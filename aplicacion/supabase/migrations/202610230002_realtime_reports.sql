begin;

-- Realtime Postgres Changes checks the SELECT RLS policy for each subscriber.
-- Publish only the report tables consumed by ZacApp; never publish profiles or auth.
do $$
declare
  table_name text;
  publishes_insert boolean;
  publishes_update boolean;
  publishes_delete boolean;
  publishes_truncate boolean;
  all_tables boolean;
begin
  select pubinsert, pubupdate, pubdelete, pubtruncate, puballtables
    into publishes_insert, publishes_update, publishes_delete, publishes_truncate, all_tables
  from pg_publication where pubname = 'supabase_realtime';
  if not found then
    raise exception 'supabase_realtime publication is missing';
  end if;
  if all_tables then raise exception 'supabase_realtime already publishes all tables'; end if;

  -- Realtime does not apply SELECT RLS to DELETE events. Disable DELETE and
  -- TRUNCATE only when this publication has no unrelated tables to protect.
  if not publishes_insert or not publishes_update or publishes_delete or publishes_truncate then
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and (schemaname <> 'public' or tablename not in ('incidents', 'incident_history', 'incident_evidence'))
    ) then
      raise exception 'supabase_realtime has unrelated tables and publishes DELETE or TRUNCATE';
    end if;
    execute 'alter publication supabase_realtime set (publish = ''insert, update'')';
  end if;

  foreach table_name in array array['incidents', 'incident_history', 'incident_evidence'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

commit;

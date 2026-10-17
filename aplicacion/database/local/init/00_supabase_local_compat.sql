-- LOCAL DEVELOPMENT ONLY: bootstrap for the initial schema in docker-compose.yml.
-- This is not a Supabase emulator and does not reproduce the current application schema.
-- NEVER execute this file against real Supabase: it replaces auth.uid() with a stub.
create extension if not exists pgcrypto;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

-- Deliberately returns NULL; no JWT verification or authenticated identity is provided.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select null::uuid;
$$;

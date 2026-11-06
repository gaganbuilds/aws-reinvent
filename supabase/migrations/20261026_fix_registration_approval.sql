-- =====================================================================
-- Migration: 20261026_fix_registration_approval.sql
-- Project: AWS re:Invent Party Mysore
-- Objective: Fix error during approving registrations (review_application)
--
-- Root Cause:
--   When an application was approved ('accepted'), review_application called
--   generate_attendee_id(), which relied on `encode(gen_random_bytes(4), 'hex')`.
--   With SECURITY DEFINER functions enforcing `search_path = public, pg_temp`,
--   PostgreSQL could not locate `gen_random_bytes` (from pgcrypto in extensions),
--   raising "function gen_random_bytes(integer) does not exist" and aborting
--   the approval transaction.
--
-- Solution:
--   1. Update public.generate_attendee_id() to use PostgreSQL native
--      `gen_random_uuid()` (built into core pg_catalog since Postgres 13).
--      It produces 8 random uppercase hexadecimal characters without any
--      external extension or search_path dependency.
--   2. Update public.review_application(), public.generate_missing_pass(),
--      and public.backfill_attendee_passes() with `search_path = public, extensions, pg_temp`
--      and robust null/empty checks.
--   3. Re-grant execute permissions to authenticated staff.
-- =====================================================================

-- 0. Ensure schema columns, constraints, and tables exist on public.applications
alter table public.applications
  add column if not exists phone text,
  add column if not exists city text,
  add column if not exists year_of_study text,
  add column if not exists branch text,
  add column if not exists consent boolean default false,
  add column if not exists attendee_id text,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid references auth.users(id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'applications_attendee_id_key'
  ) then
    alter table public.applications add constraint applications_attendee_id_key unique (attendee_id);
  end if;
end $$;

create table if not exists public.application_decisions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  decision text not null,
  review_note text,
  decided_at timestamptz not null default now()
);

-- 1. Collision-resistant Attendee ID generator (Format: REIM-XXXXXXXX)
create or replace function public.generate_attendee_id()
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  new_id text;
  done boolean := false;
begin
  while not done loop
    -- Uses Postgres core native gen_random_uuid() to extract 8 uppercase hex characters
    -- Completely native to PG 13+ (no external extension or pgcrypto search_path dependencies)
    new_id := 'REIM-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
    done := not exists (select 1 from public.applications where attendee_id = new_id);
  end loop;
  return new_id;
end;
$$;

-- 2. Atomically updates status, generates persistent attendee pass on approval, and logs decision
create or replace function public.review_application(app_id uuid, new_status text, note text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_current_status text;
  v_current_attendee_id text;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Unauthorized: Staff permissions required';
  end if;
  if new_status not in ('accepted','rejected','pending') then
    raise exception 'bad status';
  end if;

  select status, attendee_id into v_current_status, v_current_attendee_id
  from public.applications
  where id = app_id;

  if not found then
    raise exception 'application not found';
  end if;

  -- Generate unique persistent attendee_id when approved if none exists yet
  if new_status = 'accepted' and (v_current_attendee_id is null or trim(v_current_attendee_id) = '') then
    v_current_attendee_id := public.generate_attendee_id();
  end if;

  update public.applications
  set status = new_status,
      attendee_id = v_current_attendee_id,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = app_id;

  insert into public.application_decisions (application_id, reviewer_id, decision, review_note)
  values (app_id, auth.uid(), new_status, note);
end;
$$;

-- 3. Staff pass recovery RPC
create or replace function public.generate_missing_pass(app_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_status text;
  v_attendee_id text;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Unauthorized: Staff permissions required';
  end if;

  select status, attendee_id into v_status, v_attendee_id
  from public.applications
  where id = app_id;

  if not found then
    raise exception 'application not found';
  end if;
  if v_status != 'accepted' then
    raise exception 'application is not accepted';
  end if;

  if v_attendee_id is null or trim(v_attendee_id) = '' then
    v_attendee_id := public.generate_attendee_id();
    update public.applications
    set attendee_id = v_attendee_id
    where id = app_id;
  end if;

  return v_attendee_id;
end;
$$;

-- 4. Batch backfill RPC for existing accepted applicants
create or replace function public.backfill_attendee_passes()
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_count integer := 0;
  r record;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Unauthorized: Staff permissions required';
  end if;

  for r in select id from public.applications where status = 'accepted' and (attendee_id is null or trim(attendee_id) = '') loop
    update public.applications
    set attendee_id = public.generate_attendee_id()
    where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- 5. Permissions
revoke execute on function public.generate_attendee_id() from public, anon;
grant execute on function public.generate_attendee_id() to authenticated;

revoke execute on function public.review_application(uuid, text, text) from public, anon;
grant execute on function public.review_application(uuid, text, text) to authenticated;

revoke execute on function public.generate_missing_pass(uuid) from public, anon;
grant execute on function public.generate_missing_pass(uuid) to authenticated;

revoke execute on function public.backfill_attendee_passes() from public, anon;
grant execute on function public.backfill_attendee_passes() to authenticated;

-- =====================================================================
-- Migration: 20261023_attendee_pass_system.sql
-- Project: AWS re:Invent Party Mysore
-- Objective: Add persistent unique Attendee Pass System, QR generation support,
--            backfill existing accepted applications, and ensure all staff RPCs exist.
-- =====================================================================

-- 1. Extend public.applications with attendee_id and form fields if missing
alter table public.applications
  add column if not exists phone text,
  add column if not exists city text,
  add column if not exists year_of_study text,
  add column if not exists branch text,
  add column if not exists consent boolean default false,
  add column if not exists attendee_id text;

-- 2. Enforce UNIQUE constraint on attendee_id
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'applications_attendee_id_key'
  ) then
    alter table public.applications add constraint applications_attendee_id_key unique (attendee_id);
  end if;
end $$;

-- 3. Collision-resistant human-readable Attendee ID generator (Format: REIM-XXXXXXXX)
create or replace function public.generate_attendee_id() returns text
language plpgsql as $$
declare
  new_id text;
  done boolean := false;
begin
  while not done loop
    new_id := 'REIM-' || upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 8));
    done := not exists (select 1 from public.applications where attendee_id = new_id);
  end loop;
  return new_id;
end;
$$;

-- 4. Staff check helper: Recognizes postgres/superuser (SQL Editor) + user_roles
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select current_user in ('postgres', 'supabase_admin')
      or exists (select 1 from public.user_roles where user_id = auth.uid());
$$;

-- 5. Role helper: Returns user role (or 'admin' if running in SQL editor)
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.user_roles where user_id = auth.uid() limit 1),
    case when current_user in ('postgres', 'supabase_admin') then 'admin' else null end
  );
$$;

create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff();
$$;

-- 6. Update review_application to create persistent Attendee ID on approval atomically
create or replace function public.review_application(app_id uuid, new_status text, note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_current_status text;
  v_current_attendee_id text;
begin
  if not public.is_staff() then raise exception 'not allowed'; end if;
  if new_status not in ('accepted','rejected','pending') then raise exception 'bad status'; end if;

  select status, attendee_id into v_current_status, v_current_attendee_id
  from public.applications
  where id = app_id;

  if not found then
    raise exception 'application not found';
  end if;

  -- When accepted, generate unique persistent attendee_id if none exists yet
  if new_status = 'accepted' and v_current_attendee_id is null then
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

-- 7. Staff RPC to recover/generate missing pass for a single accepted applicant
create or replace function public.generate_missing_pass(app_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_attendee_id text;
begin
  if not public.is_staff() then raise exception 'not allowed'; end if;

  select status, attendee_id into v_status, v_attendee_id
  from public.applications
  where id = app_id;

  if not found then raise exception 'application not found'; end if;
  if v_status != 'accepted' then raise exception 'application is not accepted'; end if;

  if v_attendee_id is null then
    v_attendee_id := public.generate_attendee_id();
    update public.applications
    set attendee_id = v_attendee_id
    where id = app_id;
  end if;

  return v_attendee_id;
end;
$$;

-- 8. Batch backfill RPC to generate passes for any existing accepted applicants
create or replace function public.backfill_attendee_passes()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count integer := 0;
  r record;
begin
  if not public.is_staff() then raise exception 'not allowed'; end if;

  for r in select id from public.applications where status = 'accepted' and attendee_id is null loop
    update public.applications
    set attendee_id = public.generate_attendee_id()
    where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- 9. Staff & Role Helper Functions (ensure compatibility)
create or replace function public.list_moderators()
returns table (user_id uuid, email text, added_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.user_id, u.email::text, r.created_at as added_at
  from public.user_roles r
  join auth.users u on u.id = r.user_id
  where r.role = 'moderator'
  order by r.created_at desc;
$$;

create or replace function public.add_moderator(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  target_user_id uuid;
begin
  if public.my_role() != 'admin' then raise exception 'not allowed'; end if;
  select id into target_user_id from auth.users where lower(email) = lower(trim(p_email));
  if target_user_id is null then
    raise exception 'User not found. They must sign in once first.';
  end if;
  insert into public.user_roles (user_id, role)
  values (target_user_id, 'moderator')
  on conflict (user_id) do update set role = 'moderator';
end;
$$;

create or replace function public.remove_moderator(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() != 'admin' then raise exception 'not allowed'; end if;
  delete from public.user_roles where user_id = p_user_id and role = 'moderator';
end;
$$;

-- 10. Grant Execution Permissions
grant execute on function public.is_staff() to authenticated, anon;
grant execute on function public.my_role() to authenticated;
grant execute on function public.is_moderator() to authenticated;
grant execute on function public.generate_attendee_id() to authenticated;
grant execute on function public.review_application(uuid, text, text) to authenticated;
grant execute on function public.generate_missing_pass(uuid) to authenticated;
grant execute on function public.backfill_attendee_passes() to authenticated;
grant execute on function public.list_moderators() to authenticated;
grant execute on function public.add_moderator(text) to authenticated;
grant execute on function public.remove_moderator(uuid) to authenticated;

-- 11. Automatic Backfill directly executable in SQL Editor
do $$
declare
  r record;
begin
  for r in select id from public.applications where status = 'accepted' and attendee_id is null loop
    update public.applications
    set attendee_id = public.generate_attendee_id()
    where id = r.id;
  end loop;
end $$;

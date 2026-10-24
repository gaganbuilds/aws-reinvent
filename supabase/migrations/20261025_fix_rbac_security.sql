-- =====================================================================
-- Migration: 20261025_fix_rbac_security.sql
-- Project: AWS re:Invent Party Mysore
-- Objective: Fix critical RBAC vulnerability by eliminating postgres/current_user
--            elevation in SECURITY DEFINER functions, securing public.user_roles,
--            applications, decisions, and scan event RLS policies, restricting
--            moderator management strictly to authenticated admins, and ensuring
--            all new registrations default to no staff role (regular user).
-- =====================================================================

-- 1. Correct role lookup: MUST lookup only explicitly assigned roles for auth.uid()
--    Eliminate current_user check and fallback to 'admin'
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role
  from public.user_roles
  where user_id = auth.uid()
  limit 1;
$$;

-- 2. Staff verification: Returns true ONLY if user has explicit 'admin' or 'moderator' role
--    Eliminate current_user in ('postgres', 'supabase_admin') check
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('admin', 'moderator')
  );
$$;

-- 3. Moderator check helper: Returns true if user has staff privileges
create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('admin', 'moderator')
  );
$$;

-- 4. Restrict list_moderators strictly to admins
create or replace function public.list_moderators()
returns table (user_id uuid, email text, added_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.my_role() != 'admin' then
    raise exception 'Unauthorized: Only admins can list moderators';
  end if;

  return query
  select r.user_id, u.email::text, r.created_at as added_at
  from public.user_roles r
  join auth.users u on u.id = r.user_id
  where r.role = 'moderator'
  order by r.created_at desc;
end;
$$;

-- 5. Restrict add_moderator: caller must be admin, target user must exist in auth.users,
--    and cannot demote or overwrite an existing admin
create or replace function public.add_moderator(p_email text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_user_id uuid;
  target_existing_role text;
  clean_email text;
begin
  if auth.uid() is null or public.my_role() != 'admin' then
    raise exception 'Unauthorized: Only admins can add moderators';
  end if;

  clean_email := lower(trim(coalesce(p_email, '')));
  if clean_email = '' then
    raise exception 'Email address cannot be empty';
  end if;

  select id into target_user_id
  from auth.users
  where lower(email) = clean_email
  limit 1;

  if target_user_id is null then
    raise exception 'User not found. They must sign in once first.';
  end if;

  select role into target_existing_role
  from public.user_roles
  where user_id = target_user_id;

  if target_existing_role = 'admin' then
    raise exception 'User is already an administrator.';
  end if;

  if target_existing_role = 'moderator' then
    return;
  end if;

  insert into public.user_roles (user_id, role)
  values (target_user_id, 'moderator')
  on conflict (user_id) do update
    set role = 'moderator'
    where public.user_roles.role != 'admin';
end;
$$;

-- 6. Restrict remove_moderator: caller must be admin, only deletes 'moderator' role
create or replace function public.remove_moderator(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.my_role() != 'admin' then
    raise exception 'Unauthorized: Only admins can remove moderators';
  end if;

  if p_user_id is null then
    raise exception 'Invalid user ID';
  end if;

  delete from public.user_roles
  where user_id = p_user_id
    and role = 'moderator';
end;
$$;

-- 7. Ensure review_application requires authenticated staff
create or replace function public.review_application(app_id uuid, new_status text, note text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
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

-- 8. Ensure generate_missing_pass requires authenticated staff
create or replace function public.generate_missing_pass(app_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
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

  if v_attendee_id is null then
    v_attendee_id := public.generate_attendee_id();
    update public.applications
    set attendee_id = v_attendee_id
    where id = app_id;
  end if;

  return v_attendee_id;
end;
$$;

-- 9. Ensure backfill_attendee_passes requires authenticated staff
create or replace function public.backfill_attendee_passes()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
  r record;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Unauthorized: Staff permissions required';
  end if;

  for r in select id from public.applications where status = 'accepted' and attendee_id is null loop
    update public.applications
    set attendee_id = public.generate_attendee_id()
    where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- 10. Ensure check_in_attendee requires authenticated staff
create or replace function public.check_in_attendee(p_qr_payload text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clean_payload text;
  v_candidate_id text;
  v_app record;
  v_checked_in_at timestamptz;
  v_checked_in_by uuid;
  v_staff_email text;
  v_payload_hash text;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Unauthorized: Staff permissions required';
  end if;

  v_clean_payload := trim(coalesce(p_qr_payload, ''));

  if v_clean_payload = '' then
    insert into public.attendee_scan_events (attendee_id, scanned_by, scan_result, failure_reason)
    values (null, auth.uid(), 'invalid_qr', 'Empty QR payload');

    return jsonb_build_object(
      'success', false,
      'result', 'invalid_qr',
      'message', 'INVALID QR CODE — CHECK-IN DENIED',
      'failure_reason', 'Empty QR code payload.'
    );
  end if;

  v_payload_hash := encode(sha256(v_clean_payload::bytea), 'hex');
  v_candidate_id := substring(v_clean_payload from '(REIM-[A-Za-z0-9]+)');
  
  if v_candidate_id is null then
    v_candidate_id := v_clean_payload;
  end if;

  select id, user_id, email, full_name, builder_id, college, status, attendee_id, checked_in_at, checked_in_by
  into v_app
  from public.applications
  where attendee_id = v_candidate_id or attendee_id = upper(v_candidate_id)
  for update;

  if not found then
    insert into public.attendee_scan_events (attendee_id, scanned_by, scan_result, failure_reason, raw_payload_hash)
    values (v_candidate_id, auth.uid(), 'invalid_qr', 'Unrecognized Attendee ID', v_payload_hash);

    return jsonb_build_object(
      'success', false,
      'result', 'invalid_qr',
      'message', 'INVALID QR CODE — CHECK-IN DENIED',
      'failure_reason', 'Attendee identifier "' || v_candidate_id || '" not found in registration database.'
    );
  end if;

  if v_app.status != 'accepted' then
    insert into public.attendee_scan_events (attendee_id, application_id, scanned_by, scan_result, failure_reason)
    values (v_app.attendee_id, v_app.id, auth.uid(), 'not_approved', 'Application status: ' || v_app.status);

    return jsonb_build_object(
      'success', false,
      'result', 'not_approved',
      'message', 'APPLICATION NOT APPROVED',
      'failure_reason', 'Applicant status is ' || v_app.status || '. Only confirmed/accepted attendees are eligible for entry.',
      'attendee', jsonb_build_object(
        'attendee_id', v_app.attendee_id,
        'full_name', v_app.full_name,
        'status', v_app.status
      )
    );
  end if;

  if v_app.checked_in_at is not null then
    select email::text into v_staff_email from auth.users where id = v_app.checked_in_by;

    insert into public.attendee_scan_events (attendee_id, application_id, scanned_by, scan_result, failure_reason)
    values (v_app.attendee_id, v_app.id, auth.uid(), 'duplicate', 'Already checked in at ' || v_app.checked_in_at);

    return jsonb_build_object(
      'success', false,
      'result', 'duplicate',
      'message', 'ALREADY CHECKED IN',
      'attendee', jsonb_build_object(
        'id', v_app.id,
        'attendee_id', v_app.attendee_id,
        'full_name', v_app.full_name,
        'email', v_app.email,
        'builder_id', v_app.builder_id,
        'college', v_app.college,
        'status', v_app.status,
        'checked_in_at', v_app.checked_in_at,
        'checked_in_by', v_app.checked_in_by,
        'checked_in_by_email', v_staff_email
      )
    );
  end if;

  update public.applications
  set checked_in_at = now(),
      checked_in_by = auth.uid()
  where id = v_app.id and checked_in_at is null
  returning checked_in_at, checked_in_by into v_checked_in_at, v_checked_in_by;

  if v_checked_in_at is null then
    select checked_in_at, checked_in_by into v_checked_in_at, v_checked_in_by
    from public.applications where id = v_app.id;

    select email::text into v_staff_email from auth.users where id = v_checked_in_by;

    insert into public.attendee_scan_events (attendee_id, application_id, scanned_by, scan_result, failure_reason)
    values (v_app.attendee_id, v_app.id, auth.uid(), 'duplicate', 'Concurrent check-in collision');

    return jsonb_build_object(
      'success', false,
      'result', 'duplicate',
      'message', 'ALREADY CHECKED IN',
      'attendee', jsonb_build_object(
        'id', v_app.id,
        'attendee_id', v_app.attendee_id,
        'full_name', v_app.full_name,
        'email', v_app.email,
        'builder_id', v_app.builder_id,
        'college', v_app.college,
        'status', v_app.status,
        'checked_in_at', v_checked_in_at,
        'checked_in_by', v_checked_in_by,
        'checked_in_by_email', v_staff_email
      )
    );
  end if;

  insert into public.attendee_scan_events (attendee_id, application_id, scanned_by, scan_result)
  values (v_app.attendee_id, v_app.id, auth.uid(), 'checked_in');

  select email::text into v_staff_email from auth.users where id = v_checked_in_by;

  return jsonb_build_object(
    'success', true,
    'result', 'checked_in',
    'message', 'CHECK-IN SUCCESSFUL',
    'attendee', jsonb_build_object(
      'id', v_app.id,
      'attendee_id', v_app.attendee_id,
      'full_name', v_app.full_name,
      'email', v_app.email,
      'builder_id', v_app.builder_id,
      'college', v_app.college,
      'status', v_app.status,
      'checked_in_at', v_checked_in_at,
      'checked_in_by', v_checked_in_by,
      'checked_in_by_email', v_staff_email
    )
  );
end;
$$;

-- 11. Ensure list_scan_events requires authenticated staff
create or replace function public.list_scan_events(p_limit int default 500)
returns table (
  event_id uuid,
  scanned_at timestamptz,
  scan_result text,
  failure_reason text,
  raw_payload_hash text,
  scanner_user_id uuid,
  scanner_email text,
  attendee_id text,
  applicant_id uuid,
  full_name text,
  email text,
  builder_id text,
  college text,
  application_status text,
  checked_in_at timestamptz,
  checked_in_by uuid,
  checked_in_by_email text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Unauthorized: Staff permissions required';
  end if;

  return query
  select
    e.id as event_id,
    e.scanned_at,
    e.scan_result,
    e.failure_reason,
    e.raw_payload_hash,
    e.scanned_by as scanner_user_id,
    u_scanner.email::text as scanner_email,
    coalesce(e.attendee_id, a.attendee_id) as attendee_id,
    a.id as applicant_id,
    a.full_name,
    a.email,
    a.builder_id,
    a.college,
    a.status as application_status,
    a.checked_in_at,
    a.checked_in_by,
    u_checkin.email::text as checked_in_by_email
  from public.attendee_scan_events e
  left join public.applications a on a.id = e.application_id or (e.attendee_id is not null and a.attendee_id = e.attendee_id)
  left join auth.users u_scanner on u_scanner.id = e.scanned_by
  left join auth.users u_checkin on u_checkin.id = a.checked_in_by
  order by e.scanned_at desc
  limit coalesce(p_limit, 500);
end;
$$;

-- 12. Ensure get_checkin_stats requires authenticated staff
create or replace function public.get_checkin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_total_registrations int;
  v_accepted_count int;
  v_unique_checked_in int;
  v_total_scans int;
  v_successful_scans int;
  v_duplicate_scans int;
  v_invalid_scans int;
  v_not_approved_scans int;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'Unauthorized: Staff permissions required';
  end if;

  select count(*) into v_total_registrations from public.applications;
  select count(*) into v_accepted_count from public.applications where status = 'accepted';
  select count(*) into v_unique_checked_in from public.applications where checked_in_at is not null;

  select count(*) into v_total_scans from public.attendee_scan_events;
  select count(*) into v_successful_scans from public.attendee_scan_events where scan_result = 'checked_in';
  select count(*) into v_duplicate_scans from public.attendee_scan_events where scan_result = 'duplicate';
  select count(*) into v_invalid_scans from public.attendee_scan_events where scan_result = 'invalid_qr';
  select count(*) into v_not_approved_scans from public.attendee_scan_events where scan_result = 'not_approved';

  return jsonb_build_object(
    'total_registrations', v_total_registrations,
    'accepted_count', v_accepted_count,
    'unique_checked_in', v_unique_checked_in,
    'total_scans', v_total_scans,
    'successful_scans', v_successful_scans,
    'duplicate_scans', v_duplicate_scans,
    'invalid_scans', v_invalid_scans,
    'not_approved_scans', v_not_approved_scans
  );
end;
$$;

-- 13. Strengthen RLS on public.user_roles
alter table public.user_roles enable row level security;

drop policy if exists "own role read" on public.user_roles;
drop policy if exists "anyone can insert" on public.user_roles;
drop policy if exists "anyone can update" on public.user_roles;
drop policy if exists "anyone can delete" on public.user_roles;
drop policy if exists "allow user insert" on public.user_roles;
drop policy if exists "user insert role" on public.user_roles;
drop policy if exists "staff read all roles" on public.user_roles;

-- Regular users can only read their own role assignment
create policy "own role read" on public.user_roles
  for select
  using (user_id = auth.uid());

-- Revoke all direct client modifications to user_roles
revoke insert, update, delete on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

-- 14. Strengthen RLS on public.applications
alter table public.applications enable row level security;

drop policy if exists "own application read" on public.applications;
create policy "own application read" on public.applications
  for select
  using (user_id = auth.uid());

drop policy if exists "staff read all" on public.applications;
create policy "staff read all" on public.applications
  for select
  using (public.is_staff());

drop policy if exists "own application insert" on public.applications;
create policy "own application insert" on public.applications
  for insert
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and public.applications_open()
    and attendee_id is null
    and checked_in_at is null
    and checked_in_by is null
    and reviewed_by is null
    and reviewed_at is null
  );

-- Revoke client direct updates & deletes on applications (only authorized RPCs can update)
revoke update, delete on public.applications from anon, authenticated;
grant select, insert on public.applications to authenticated;

-- 15. Strengthen RLS on public.application_decisions
alter table public.application_decisions enable row level security;

drop policy if exists "staff read decisions" on public.application_decisions;
create policy "staff read decisions" on public.application_decisions
  for select
  using (public.is_staff());

revoke insert, update, delete on public.application_decisions from anon, authenticated;
grant select on public.application_decisions to authenticated;

-- 16. Strengthen RLS on public.attendee_scan_events
alter table public.attendee_scan_events enable row level security;

drop policy if exists "staff read scan events" on public.attendee_scan_events;
create policy "staff read scan events" on public.attendee_scan_events
  for select
  using (public.is_staff());

drop policy if exists "staff insert scan events" on public.attendee_scan_events;
create policy "staff insert scan events" on public.attendee_scan_events
  for insert
  with check (public.is_staff());

revoke update, delete on public.attendee_scan_events from anon, authenticated;
grant select, insert on public.attendee_scan_events to authenticated;

-- 17. Explicit RPC Grants & Revocations
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

revoke execute on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

revoke execute on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

grant execute on function public.applications_open() to authenticated, anon;

revoke execute on function public.generate_attendee_id() from public, anon;
grant execute on function public.generate_attendee_id() to authenticated;

revoke execute on function public.get_whatsapp_link() from public, anon;
grant execute on function public.get_whatsapp_link() to authenticated;

revoke execute on function public.review_application(uuid, text, text) from public, anon;
grant execute on function public.review_application(uuid, text, text) to authenticated;

revoke execute on function public.generate_missing_pass(uuid) from public, anon;
grant execute on function public.generate_missing_pass(uuid) to authenticated;

revoke execute on function public.backfill_attendee_passes() from public, anon;
grant execute on function public.backfill_attendee_passes() to authenticated;

revoke execute on function public.list_moderators() from public, anon;
grant execute on function public.list_moderators() to authenticated;

revoke execute on function public.add_moderator(text) from public, anon;
grant execute on function public.add_moderator(text) to authenticated;

revoke execute on function public.remove_moderator(uuid) from public, anon;
grant execute on function public.remove_moderator(uuid) to authenticated;

revoke execute on function public.check_in_attendee(text) from public, anon;
grant execute on function public.check_in_attendee(text) to authenticated;

revoke execute on function public.list_scan_events(int) from public, anon;
grant execute on function public.list_scan_events(int) to authenticated;

revoke execute on function public.get_checkin_stats() from public, anon;
grant execute on function public.get_checkin_stats() to authenticated;

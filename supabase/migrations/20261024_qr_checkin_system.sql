-- =====================================================================
-- Migration: 20261024_qr_checkin_system.sql
-- Project: AWS re:Invent Party Mysore
-- Objective: Add check-in fields to applications, create attendee_scan_events
--            table, implement atomic concurrency-safe check-in RPC,
--            and scan record / stats retrieval functions.
-- =====================================================================

-- 1. Add check-in tracking columns to applications
alter table public.applications
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid references auth.users(id);

-- 2. Create attendee_scan_events table
create table if not exists public.attendee_scan_events (
  id uuid primary key default gen_random_uuid(),
  attendee_id text,
  application_id uuid references public.applications(id) on delete set null,
  scanned_by uuid references auth.users(id),
  scanned_at timestamptz not null default now(),
  scan_result text not null check (scan_result in ('checked_in', 'duplicate', 'invalid_qr', 'not_approved', 'error')),
  failure_reason text,
  raw_payload_hash text
);

-- 3. Indexes for fast filtering, aggregation, and lookups
create index if not exists idx_scan_events_attendee_id on public.attendee_scan_events(attendee_id);
create index if not exists idx_scan_events_application_id on public.attendee_scan_events(application_id);
create index if not exists idx_scan_events_scanned_at on public.attendee_scan_events(scanned_at desc);
create index if not exists idx_scan_events_scanned_by on public.attendee_scan_events(scanned_by);
create index if not exists idx_scan_events_result on public.attendee_scan_events(scan_result);
create index if not exists idx_applications_checked_in_at on public.applications(checked_in_at);
create index if not exists idx_applications_attendee_id on public.applications(attendee_id);

-- 4. Enable RLS
alter table public.attendee_scan_events enable row level security;

-- Policies for attendee_scan_events
drop policy if exists "staff read scan events" on public.attendee_scan_events;
create policy "staff read scan events" on public.attendee_scan_events
  for select using (public.is_staff());

drop policy if exists "staff insert scan events" on public.attendee_scan_events;
create policy "staff insert scan events" on public.attendee_scan_events
  for insert with check (public.is_staff());

-- 5. Atomic check-in RPC function
create or replace function public.check_in_attendee(p_qr_payload text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_clean_payload text;
  v_candidate_id text;
  v_app record;
  v_checked_in_at timestamptz;
  v_checked_in_by uuid;
  v_staff_email text;
  v_payload_hash text;
begin
  -- Ensure caller is authorized staff (admin or moderator)
  if not public.is_staff() then
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

  -- Compute safe one-way hash of raw payload (avoiding plain-text sensitive storage)
  v_payload_hash := encode(sha256(v_clean_payload::bytea), 'hex');

  -- Extract candidate attendee_id:
  -- 1. Try regex pattern REIM-XXXXXXXX first
  v_candidate_id := substring(v_clean_payload from '(REIM-[A-Za-z0-9]+)');
  
  -- 2. If no REIM- pattern, check if the payload directly matches attendee_id
  if v_candidate_id is null then
    v_candidate_id := v_clean_payload;
  end if;

  -- Lock row for concurrency safety
  select id, user_id, email, full_name, builder_id, college, status, attendee_id, checked_in_at, checked_in_by
  into v_app
  from public.applications
  where attendee_id = v_candidate_id or attendee_id = upper(v_candidate_id)
  for update;

  -- Case A: Identifier does not match any application
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

  -- Case B: Application is not approved (pending or rejected)
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

  -- Case C: Duplicate scan (already checked in)
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

  -- Case D: Valid attendee, first check-in -> Mark as checked in atomically
  update public.applications
  set checked_in_at = now(),
      checked_in_by = auth.uid()
  where id = v_app.id and checked_in_at is null
  returning checked_in_at, checked_in_by into v_checked_in_at, v_checked_in_by;

  -- Concurrency fallback: if another transaction updated checked_in_at simultaneously
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

  -- Record successful scan event
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

-- 6. Helper RPC to list scan records with joined applicant & staff information
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
) language sql stable security definer set search_path = public as $$
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
  where public.is_staff()
  order by e.scanned_at desc
  limit coalesce(p_limit, 500);
$$;

-- 7. Helper RPC to calculate live check-in statistics
create or replace function public.get_checkin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
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
  if not public.is_staff() then raise exception 'not allowed'; end if;

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

-- 8. Grant permissions to authenticated staff
grant execute on function public.check_in_attendee(text) to authenticated;
grant execute on function public.list_scan_events(int) to authenticated;
grant execute on function public.get_checkin_stats() to authenticated;

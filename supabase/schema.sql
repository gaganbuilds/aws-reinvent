-- Run this whole file once in Supabase: SQL Editor > New query > Run.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','moderator')),
  created_at timestamptz not null default now()
);

create table if not exists public.event_settings (
  id int primary key default 1 check (id = 1),     -- single row
  applications_open boolean not null default true,
  whatsapp_group_url text
);
insert into public.event_settings (id) values (1) on conflict do nothing;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  city text,
  college text,
  year_of_study text,
  branch text,
  builder_id text not null,
  consent boolean default false,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  attendee_id text unique,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id)
);

create table if not exists public.application_decisions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  decision text not null,
  review_note text,
  decided_at timestamptz not null default now()
);

-- Helpers -------------------------------------------------------------
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('admin', 'moderator')
  );
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select role
  from public.user_roles
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_moderator() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('admin', 'moderator')
  );
$$;

create or replace function public.applications_open() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select applications_open from public.event_settings where id = 1;
$$;

-- Collision-resistant human-readable Attendee ID generator (Format: REIM-XXXXXXXX)
create or replace function public.generate_attendee_id() returns text
language plpgsql set search_path = public, pg_temp as $$
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

-- WhatsApp link is returned ONLY to the user whose application is accepted.
create or replace function public.get_whatsapp_link() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select s.whatsapp_group_url
  from public.event_settings s
  where exists (select 1 from public.applications a where a.user_id = auth.uid() and a.status = 'accepted');
$$;

-- Atomically updates status, generates persistent attendee pass on approval, and logs decision
create or replace function public.review_application(app_id uuid, new_status text, note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
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

-- Staff pass recovery RPC
create or replace function public.generate_missing_pass(app_id uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
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

-- Batch backfill RPC for existing accepted applicants
create or replace function public.backfill_attendee_passes()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
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

-- Staff moderator management helpers
create or replace function public.list_moderators()
returns table (user_id uuid, email text, added_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
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

create or replace function public.add_moderator(p_email text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
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

create or replace function public.remove_moderator(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
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

-- Attendee Scan Events Table -------------------------------------------
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

create index if not exists idx_scan_events_attendee_id on public.attendee_scan_events(attendee_id);
create index if not exists idx_scan_events_application_id on public.attendee_scan_events(application_id);
create index if not exists idx_scan_events_scanned_at on public.attendee_scan_events(scanned_at desc);
create index if not exists idx_scan_events_scanned_by on public.attendee_scan_events(scanned_by);
create index if not exists idx_scan_events_result on public.attendee_scan_events(scan_result);
create index if not exists idx_applications_checked_in_at on public.applications(checked_in_at);
create index if not exists idx_applications_attendee_id on public.applications(attendee_id);

-- Row level security ----------------------------------------------------
alter table public.user_roles enable row level security;
alter table public.event_settings enable row level security;
alter table public.applications enable row level security;
alter table public.application_decisions enable row level security;
alter table public.attendee_scan_events enable row level security;

-- user_roles: users can only read their own role; no direct client writes permitted
create policy "own role read" on public.user_roles for select using (user_id = auth.uid());
revoke insert, update, delete on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

-- applications: read own, staff read all, insert pending only. No client updates or deletes.
create policy "own application read" on public.applications for select using (user_id = auth.uid());
create policy "staff read all" on public.applications for select using (public.is_staff());
create policy "own application insert" on public.applications for insert
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
revoke update, delete on public.applications from anon, authenticated;
grant select, insert on public.applications to authenticated;

-- application_decisions: only staff can read decisions
create policy "staff read decisions" on public.application_decisions for select using (public.is_staff());
revoke insert, update, delete on public.application_decisions from anon, authenticated;
grant select on public.application_decisions to authenticated;

-- attendee_scan_events: staff only
create policy "staff read scan events" on public.attendee_scan_events for select using (public.is_staff());
create policy "staff insert scan events" on public.attendee_scan_events for insert with check (public.is_staff());
revoke update, delete on public.attendee_scan_events from anon, authenticated;
grant select, insert on public.attendee_scan_events to authenticated;

-- Atomic check-in RPC function
create or replace function public.check_in_attendee(p_qr_payload text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
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
) language plpgsql stable security definer set search_path = public, pg_temp as $$
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

create or replace function public.get_checkin_stats()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
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

-- Permissions
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


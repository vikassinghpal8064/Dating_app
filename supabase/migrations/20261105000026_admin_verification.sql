-- 26 — Admin panel and verification system.

-- ============================================================================
-- 0. Add verification_status enum if not exists
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'verification_status') then
    create type public.verification_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- ============================================================================
-- 1. verification_requests table
-- ============================================================================
create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  pose_prompt text not null,
  status public.verification_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,

  constraint verification_requests_reason_length
    check (reason is null or char_length(reason) <= 500)
);

comment on table public.verification_requests is
  'Selfie verification requests. Users upload to their own folder; admins review.';

create index verification_requests_user_id_idx on public.verification_requests (user_id);
create index verification_requests_status_idx on public.verification_requests (status) where status = 'pending';

-- RLS
alter table public.verification_requests enable row level security;

-- Users can read their own requests
create policy verification_requests_select_own
  on public.verification_requests for select to authenticated
  using (user_id = auth.uid());

-- Users can insert their own requests
create policy verification_requests_insert_own
  on public.verification_requests for insert to authenticated
  with check (user_id = auth.uid());

-- Admins can read all
create policy verification_requests_select_admin
  on public.verification_requests for select to authenticated
  using (public.is_admin());

-- Admins can update (review)
create policy verification_requests_update_admin
  on public.verification_requests for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update on public.verification_requests to authenticated;

-- ============================================================================
-- 2. admin_audit_log table
-- ============================================================================
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  target_user_id uuid references public.profiles (id) on delete set null,
  details jsonb,
  created_at timestamptz not null default now()
);

comment on table public.admin_audit_log is
  'Audit log of all admin actions. Admins can read; nobody else can.';

create index admin_audit_log_admin_id_idx on public.admin_audit_log (admin_id);
create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);

-- RLS
alter table public.admin_audit_log enable row level security;

-- Admins can insert
create policy admin_audit_log_insert_admin
  on public.admin_audit_log for insert to authenticated
  with check (public.is_admin());

-- Admins can read
create policy admin_audit_log_select_admin
  on public.admin_audit_log for select to authenticated
  using (public.is_admin());

grant select, insert on public.admin_audit_log to authenticated;

-- ============================================================================
-- 3. Storage bucket upload policy for verification-selfies
-- ============================================================================
-- Users can upload only to their own folder
create policy verification_selfies_insert_own_folder
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification-selfies'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

-- ============================================================================
-- 4. Verification status enum (add to existing enums)
-- ============================================================================
-- Note: verification_status enum should already exist from migration 01
-- If not, create it:
-- create type public.verification_status as enum ('pending', 'approved', 'rejected');

-- ============================================================================
-- 5. Admin functions
-- ============================================================================

-- Helper function to write audit log
create or replace function public.write_admin_audit_log(
  p_action text,
  p_target_user_id uuid,
  p_details jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  insert into public.admin_audit_log (admin_id, action, target_user_id, details)
  values (auth.uid(), p_action, p_target_user_id, p_details);
end;
$$;

revoke all on function public.write_admin_audit_log(text, uuid, jsonb) from public;
grant execute on function public.write_admin_audit_log(text, uuid, jsonb) to authenticated;

-- Ban user
create or replace function public.admin_ban_user(p_user uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  update public.profiles
  set is_banned = true
  where id = p_user;

  perform public.write_admin_audit_log('ban_user', p_user, jsonb_build_object('reason', p_reason));
end;
$$;

revoke all on function public.admin_ban_user(uuid, text) from public;
revoke all on function public.admin_ban_user(uuid, text) from anon;
grant execute on function public.admin_ban_user(uuid, text) to authenticated;

-- Unban user
create or replace function public.admin_unban_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  update public.profiles
  set is_banned = false
  where id = p_user;

  perform public.write_admin_audit_log('unban_user', p_user, null);
end;
$$;

revoke all on function public.admin_unban_user(uuid) from public;
revoke all on function public.admin_unban_user(uuid) from anon;
grant execute on function public.admin_unban_user(uuid) to authenticated;

-- Set report status
create or replace function public.admin_set_report_status(p_report uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  update public.reports
  set status = p_status::public.report_status,
      updated_at = now()
  where id = p_report;

  perform public.write_admin_audit_log('set_report_status', null, jsonb_build_object('report_id', p_report, 'status', p_status));
end;
$$;

revoke all on function public.admin_set_report_status(uuid, text) from public;
revoke all on function public.admin_set_report_status(uuid, text) from anon;
grant execute on function public.admin_set_report_status(uuid, text) to authenticated;

-- Review photo
create or replace function public.admin_review_photo(p_photo uuid, p_approve boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  v_status := case when p_approve then 'approved' else 'rejected' end;

  update public.profile_photos
  set moderation_status = v_status::public.moderation_status
  where id = p_photo;

  perform public.write_admin_audit_log(
    'review_photo',
    null,
    jsonb_build_object('photo_id', p_photo, 'approved', p_approve, 'reason', p_reason)
  );
end;
$$;

revoke all on function public.admin_review_photo(uuid, boolean, text) from public;
revoke all on function public.admin_review_photo(uuid, boolean, text) from anon;
grant execute on function public.admin_review_photo(uuid, boolean, text) to authenticated;

-- Review verification
create or replace function public.admin_review_verification(p_request uuid, p_approve boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  select user_id into v_user_id from public.verification_requests where id = p_request;
  if not found then
    raise exception 'Verification request not found' using errcode = 'no_data_found';
  end if;

  v_status := case when p_approve then 'approved' else 'rejected' end;

  update public.verification_requests
  set status = v_status::public.verification_status,
      reviewed_by = auth.uid(),
      reason = p_reason,
      reviewed_at = now()
  where id = p_request;

  -- If approved, set is_verified on the profile
  if p_approve then
    update public.profiles
    set is_verified = true
    where id = v_user_id;
  end if;

  perform public.write_admin_audit_log(
    'review_verification',
    v_user_id,
    jsonb_build_object('request_id', p_request, 'approved', p_approve, 'reason', p_reason)
  );
end;
$$;

revoke all on function public.admin_review_verification(uuid, boolean, text) from public;
revoke all on function public.admin_review_verification(uuid, boolean, text) from anon;
grant execute on function public.admin_review_verification(uuid, boolean, text) to authenticated;

-- ============================================================================
-- 6. Admin queue functions (read data for admin panel)
-- ============================================================================

-- Get pending reports queue
create or replace function public.admin_get_reports_queue()
returns table (
  id uuid,
  reporter_id uuid,
  reported_id uuid,
  reason public.report_reason,
  details text,
  status public.report_status,
  created_at timestamptz,
  reported_profile jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    r.id,
    r.reporter_id,
    r.reported_id,
    r.reason,
    r.details,
    r.status,
    r.created_at,
    jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'age', extract(year from age(p.date_of_birth))::int,
      'photos', p.photos
    ) as reported_profile
  from public.reports r
  join public.profiles p on p.id = r.reported_id
  where r.status = 'open'
  order by r.created_at desc;
end;
$$;

revoke all on function public.admin_get_reports_queue() from public;
revoke all on function public.admin_get_reports_queue() from anon;
grant execute on function public.admin_get_reports_queue() to authenticated;

-- Get pending photos queue
create or replace function public.admin_get_photos_queue()
returns table (
  id uuid,
  user_id uuid,
  storage_path text,
  photo_position integer,
  moderation_status public.moderation_status,
  created_at timestamptz,
  user_profile jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    pp.id,
    pp.user_id,
    pp.storage_path,
    pp.position,
    pp.moderation_status,
    pp.created_at,
    jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'age', extract(year from age(p.date_of_birth))::int
    ) as user_profile
  from public.profile_photos pp
  join public.profiles p on p.id = pp.user_id
  where pp.moderation_status = 'pending'
  order by pp.created_at desc;
end;
$$;

revoke all on function public.admin_get_photos_queue() from public;
revoke all on function public.admin_get_photos_queue() from anon;
grant execute on function public.admin_get_photos_queue() to authenticated;

-- Get pending verification queue
create or replace function public.admin_get_verification_queue()
returns table (
  id uuid,
  user_id uuid,
  storage_path text,
  pose_prompt text,
  status public.verification_status,
  created_at timestamptz,
  user_profile jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    vr.id,
    vr.user_id,
    vr.storage_path,
    vr.pose_prompt,
    vr.status,
    vr.created_at,
    jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'age', extract(year from age(p.date_of_birth))::int,
      'is_verified', p.is_verified
    ) as user_profile
  from public.verification_requests vr
  join public.profiles p on p.id = vr.user_id
  where vr.status = 'pending'
  order by vr.created_at desc;
end;
$$;

revoke all on function public.admin_get_verification_queue() from public;
revoke all on function public.admin_get_verification_queue() from anon;
grant execute on function public.admin_get_verification_queue() to authenticated;

-- Search users (admin only)
create or replace function public.admin_search_users(p_query text)
returns table (
  id uuid,
  full_name text,
  email text,
  is_verified boolean,
  is_banned boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.email,
    p.is_verified,
    p.is_banned,
    p.created_at
  from public.profiles p
  where
    (p_query is null or p_query = '' or
     p.full_name ilike '%' || p_query || '%' or
     p.email ilike '%' || p_query || '%')
  order by p.created_at desc
  limit 50;
end;
$$;

revoke all on function public.admin_search_users(text) from public;
revoke all on function public.admin_search_users(text) from anon;
grant execute on function public.admin_search_users(text) to authenticated;

-- Get admin stats
create or replace function public.admin_get_stats()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stats jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'verified_users', (select count(*) from public.profiles where is_verified),
    'banned_users', (select count(*) from public.profiles where is_banned),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'pending_photos', (select count(*) from public.profile_photos where moderation_status = 'pending'),
    'pending_verifications', (select count(*) from public.verification_requests where status = 'pending'),
    'signups_last_14_days', (
      select jsonb_agg(row_to_json(t))
      from (
        select
          date_trunc('day', created_at)::date as date,
          count(*) as count
        from public.profiles
        where created_at >= now() - interval '14 days'
        group by date_trunc('day', created_at)::date
        order by date
      ) t
    ),
    'active_users_7_days', (
      select count(distinct user_id)
      from public.likes
      where created_at >= now() - interval '7 days'
    )
  ) into v_stats;

  return v_stats;
end;
$$;

revoke all on function public.admin_get_stats() from public;
revoke all on function public.admin_get_stats() from anon;
grant execute on function public.admin_get_stats() to authenticated;

comment on function public.admin_get_stats() is
  'Returns aggregate statistics for the admin dashboard. Admin-only.';

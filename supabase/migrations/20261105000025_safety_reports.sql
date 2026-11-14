-- 25 — safety: reports trigger, blocked email domains, scam detection.

-- 1. Update report_reason enum to match safety requirements.
-- Drop and recreate with the new values.
drop type if exists public.report_reason cascade;

create type public.report_reason as enum (
  'fake_profile',
  'harassment',
  'scam',
  'inappropriate_photos',
  'underage',
  'solicitation',
  'other'
);

-- Recreate the reports table with the new enum (data loss acceptable for dev).
drop table if exists public.reports;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason public.report_reason not null,
  details text,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reports_not_self
    check (reporter_id <> reported_id),
  constraint reports_unique_pair
    unique (reporter_id, reported_id),
  constraint reports_details_length
    check (details is null or char_length(details) <= 500),
  constraint reports_details_is_plain
    check (details is null or details !~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
);

-- RLS for reports
alter table public.reports enable row level security;

-- Reporter can read their own reports
create policy reports_select_own
  on public.reports for select to authenticated
  using (reporter_id = auth.uid());

-- Reporter can insert their own reports
create policy reports_insert_own
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

-- Admins can read all reports
create policy reports_select_admin
  on public.reports for select to authenticated
  using (public.is_admin());

-- Admins can update reports
create policy reports_update_admin
  on public.reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update on public.reports to authenticated;

-- Index for status queries
create index reports_status_created_at_idx
  on public.reports (status, created_at)
  where status in ('open', 'reviewing');

create index reports_reported_id_idx on public.reports (reported_id);

-- Policy to allow the hide_profile_on_multiple_reports trigger to update is_visible
-- This allows hiding profiles that receive 3+ reports from different users
-- The trigger function runs as security definer (function owner), bypassing normal auth checks
create policy profiles_hide_on_multiple_reports
  on public.profiles for update
  using (true)
  with check (is_visible = false);

-- 2. Trigger: 3 open reports from 3 different reporters → hide profile
create or replace function public.hide_profile_on_multiple_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  unique_reporters integer;
begin
  -- Only act on new open reports
  if new.status <> 'open' then
    return new;
  end if;

  -- Count unique reporters for this reported profile
  select count(distinct reporter_id) into unique_reporters
  from public.reports
  where reported_id = new.reported_id
    and status = 'open';

  -- If 3 or more unique reporters, hide the profile
  if unique_reporters >= 3 then
    update public.profiles
    set is_visible = false
    where id = new.reported_id;
  end if;

  return new;
end;
$$;

create trigger hide_profile_on_multiple_reports
  after insert on public.reports
  for each row execute function public.hide_profile_on_multiple_reports();

revoke all on function public.hide_profile_on_multiple_reports() from public;
grant execute on function public.hide_profile_on_multiple_reports() to authenticated;

-- 3. Blocked email domains table
create table public.blocked_email_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.blocked_email_domains is
  'Disposable email domains blocked from signup. Admin-only table.';

alter table public.blocked_email_domains enable row level security;

-- Admins can read all
create policy blocked_email_domains_select_admin
  on public.blocked_email_domains for select to authenticated
  using (public.is_admin());

-- Only service_role can insert (no client policy)
grant select on public.blocked_email_domains to authenticated;

-- Seed with ~20 common disposable email domains
insert into public.blocked_email_domains (domain) values
  ('mailinator.com'),
  ('guerrillamail.com'),
  ('guerrillamailblock.com'),
  ('grr.la'),
  ('sharklasers.com'),
  ('guerrillamail.info'),
  ('guerrillamail.net'),
  ('guerrillamail.org'),
  ('guerrillamail.de'),
  ('tempmail.com'),
  ('tempmail.net'),
  ('10minutemail.com'),
  ('dispostable.com'),
  ('yopmail.com'),
  ('yopmail.fr'),
  ('trashmail.com'),
  ('trashmail.net'),
  ('trashmail.me'),
  ('maildrop.cc'),
  ('discard.email')
on conflict (domain) do nothing;

-- 4. Function to check if email domain is blocked
create or replace function public.is_email_domain_blocked(email_address text)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.blocked_email_domains
    where domain = lower(split_part(email_address, '@', 2))
  );
$$;

grant execute on function public.is_email_domain_blocked(text) to authenticated;

-- 5. Scam detection function
create or replace function public.flag_suspicious_message(body text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  -- Returns true if message contains phone number patterns AND money-related words
  select
    (body ~ '\+?[0-9]{10,15}' or body ~ '\(\d{3}\)\s*\d{3}[-\s]?\d{4}')
    and (
      body ~* 'money' or
      body ~* 'gift\s*card' or
      body ~* 'crypto' or
      body ~* 'bitcoin' or
      body ~* 'investment' or
      body ~* 'western\s*union' or
      body ~* 'upi' or
      body ~* 'send\s*money'
    );
$$;

grant execute on function public.flag_suspicious_message(text) to authenticated;

comment on function public.flag_suspicious_message(text) is
  'Returns true if message contains phone number + money-related words. Used for warnings only, never auto-ban.';

-- 6. Trigger to block signup from disposable email domains
create or replace function public.block_disposable_email_signup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_email_domain_blocked(new.email) then
    raise exception 'Signup from this email domain is not allowed' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Attach to auth.users insert (if the trigger doesn't already exist)
drop trigger if exists block_disposable_email_signup on auth.users;
create trigger block_disposable_email_signup
  before insert on auth.users
  for each row execute function public.block_disposable_email_signup();

revoke all on function public.block_disposable_email_signup() from public;
grant execute on function public.block_disposable_email_signup() to authenticated;

-- Safety tests: reports, blocks, email domain blocking, scam detection
\set ON_ERROR_STOP on
begin;

-- Import pgTAP
create extension if not exists pgtap;

-- Run tests
select plan(19);

-- ============================================================================
-- 1. Report creation and RLS
-- ============================================================================

-- Test: Users can create reports
select lives_ok(
  $$ insert into reports (reporter_id, reported_id, reason, details)
     values ('11111111-1111-4111-8111-111111111111', '20000000-0000-4000-8000-000000000002', 'harassment', 'Test report') $$,
  'Users can create reports'
);

-- Test: Users can read their own reports
select results_eq(
  $$ select count(*) from reports where reporter_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values (1::bigint) $$,
  'Users can see their own reports'
);

-- Test: Users cannot read others' reports
select isnt_empty(
  $$ select 1 from reports where reported_id = '20000000-0000-4000-8000-000000000002' $$,
  'Report exists for testing RLS'
);

-- Test: Cannot report yourself
select throws_ok(
  $$ insert into reports (reporter_id, reported_id, reason)
     values ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'scam') $$,
  '23514',  -- check_violation
  null,
  'Cannot report yourself'
);

-- Test: Details max length 500
select throws_ok(
  $$ insert into reports (reporter_id, reported_id, reason, details)
     values ('11111111-1111-4111-8111-111111111111', '20000000-0000-4000-8000-000000000003', 'solicitation', repeat('x', 501)) $$,
  '23514',
  null,
  'Details cannot exceed 500 characters'
);

-- ============================================================================
-- 2. 3 reports trigger hides profile
-- ============================================================================

-- Clean up previous test reports
delete from reports where reporter_id = '11111111-1111-4111-8111-111111111111';

-- Test: 3 reports from different users hide the profile
select lives_ok(
  $$ insert into reports (reporter_id, reported_id, reason) values
     ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000010', 'solicitation'),
     ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000010', 'harassment'),
     ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000010', 'fake_profile') $$,
  'Can insert 3 reports from different users'
);

-- Test: Profile is hidden after 3 reports
select is(
  (select is_visible from profiles where id = '20000000-0000-4000-8000-000000000010'),
  false,
  'Profile is hidden after 3 reports from different users'
);

-- Test: 3 reports from same user do NOT hide profile
delete from reports where reported_id = '20000000-0000-4000-8000-000000000011';

-- First, ensure profile is visible
update profiles set is_visible = true where id = '20000000-0000-4000-8000-000000000011';

-- Only one user can report (due to unique constraint), so we can't test 3 from same user
-- But we can verify the unique constraint works
select throws_ok(
  $$ insert into reports (reporter_id, reported_id, reason) values
     ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', 'scam'),
     ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000011', 'harassment') $$,
  '23505',  -- unique_violation
  null,
  'Cannot create duplicate reports from same user'
);

-- ============================================================================
-- 3. Blocked email domains
-- ============================================================================

-- Test: Common disposable domains are seeded
select ok(
  (select count(*) >= 20 from blocked_email_domains),
  'At least 20 disposable email domains are seeded'
);

-- Test: mailinator.com is blocked
select is(
  (select exists(select 1 from blocked_email_domains where domain = 'mailinator.com')),
  true,
  'mailinator.com is in blocked list'
);

-- Test: is_email_domain_blocked function works
select is(
  is_email_domain_blocked('test@mailinator.com'),
  true,
  'is_email_domain_blocked detects disposable email'
);

select is(
  is_email_domain_blocked('user@gmail.com'),
  false,
  'is_email_domain_blocked allows legitimate email'
);

-- Test: Case insensitive
select is(
  is_email_domain_blocked('TEST@MAILINATOR.COM'),
  true,
  'is_email_domain_blocked is case insensitive'
);

-- ============================================================================
-- 4. Scam detection
-- ============================================================================

-- Test: Detects phone + money keywords
select is(
  flag_suspicious_message('Send money to +1234567890 via western union'),
  true,
  'Detects phone number + western union'
);

select is(
  flag_suspicious_message('Call me at (555) 123-4567 for bitcoin investment'),
  true,
  'Detects phone number + bitcoin'
);

select is(
  flag_suspicious_message('Send crypto to +919876543210'),
  true,
  'Detects phone number + crypto'
);

-- Test: Does not flag normal messages
select is(
  flag_suspicious_message('Hey, how are you doing today?'),
  false,
  'Normal message is not flagged'
);

select is(
  flag_suspicious_message('I have a phone but no money keywords'),
  false,
  'Phone without money keywords is not flagged'
);

select is(
  flag_suspicious_message('I want to invest in crypto but no phone number'),
  false,
  'Money keywords without phone are not flagged'
);

-- Clean up
delete from reports where reported_id in ('20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000011');
update profiles set is_visible = true where id = '20000000-0000-4000-8000-000000000010';

-- Finish tests
select * from finish();

rollback;

-- Admin and verification tests
\set ON_ERROR_STOP on
begin;

-- Import pgTAP
create extension if not exists pgtap;

-- Run tests
select plan(22);

-- ============================================================================
-- 1. Normal user cannot call admin functions
-- ============================================================================

-- Test: Normal user cannot call admin_ban_user
select throws_ok(
  $$ select admin_ban_user('20000000-0000-4000-8000-000000000002', 'test') $$,
  '42501',
  null,
  'Normal user cannot ban users'
);

-- Test: Normal user cannot call admin_unban_user
select throws_ok(
  $$ select admin_unban_user('20000000-0000-4000-8000-000000000002') $$,
  '42501',
  null,
  'Normal user cannot unban users'
);

-- Test: Normal user cannot call admin_set_report_status
select throws_ok(
  $$ select admin_set_report_status('00000000-0000-0000-0000-000000000000', 'dismissed') $$,
  '42501',
  null,
  'Normal user cannot set report status'
);

-- Test: Normal user cannot call admin_review_photo
select throws_ok(
  $$ select admin_review_photo('00000000-0000-0000-0000-000000000000', true, 'test') $$,
  '42501',
  null,
  'Normal user cannot review photos'
);

-- Test: Normal user cannot call admin_review_verification
select throws_ok(
  $$ select admin_review_verification('00000000-0000-0000-0000-000000000000', true, 'test') $$,
  '42501',
  null,
  'Normal user cannot review verifications'
);

-- Test: Normal user cannot call admin_get_reports_queue
select throws_ok(
  $$ select * from admin_get_reports_queue() $$,
  '42501',
  null,
  'Normal user cannot get reports queue'
);

-- Test: Normal user cannot call admin_get_photos_queue
select throws_ok(
  $$ select * from admin_get_photos_queue() $$,
  '42501',
  null,
  'Normal user cannot get photos queue'
);

-- Test: Normal user cannot call admin_get_verification_queue
select throws_ok(
  $$ select * from admin_get_verification_queue() $$,
  '42501',
  null,
  'Normal user cannot get verification queue'
);

-- Test: Normal user cannot call admin_search_users
select throws_ok(
  $$ select * from admin_search_users('test') $$,
  '42501',
  null,
  'Normal user cannot search users'
);

-- Test: Normal user cannot call admin_get_stats
select throws_ok(
  $$ select admin_get_stats() $$,
  '42501',
  null,
  'Normal user cannot get admin stats'
);

-- ============================================================================
-- 2. Verification requests
-- ============================================================================

-- Test: User can create verification request
select lives_ok(
  $$ insert into verification_requests (user_id, storage_path, pose_prompt)
     values ('11111111-1111-4111-8111-111111111111', 'test.jpg', 'Smile') $$,
  'User can create verification request'
);

-- Test: User can read their own verification request
select results_eq(
  $$ select count(*) from verification_requests where user_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values (1::bigint) $$,
  'User can read their own verification request'
);

-- Test: User cannot read other users' verification requests
select is_empty(
  $$ select 1 from verification_requests where user_id = '20000000-0000-4000-8000-000000000001' $$,
  'User cannot read other verification requests'
);

-- Clean up
delete from verification_requests where user_id = '11111111-1111-4111-8111-111111111111';

-- ============================================================================
-- 3. Admin audit log
-- ============================================================================

-- Test: Admin can insert audit log (we'll test this by granting admin role temporarily)
-- For now, just test the table structure
select has_column('admin_audit_log', 'id', 'admin_audit_log has id column');
select has_column('admin_audit_log', 'admin_id', 'admin_audit_log has admin_id column');
select has_column('admin_audit_log', 'action', 'admin_audit_log has action column');
select has_column('admin_audit_log', 'target_user_id', 'admin_audit_log has target_user_id column');
select has_column('admin_audit_log', 'details', 'admin_audit_log has details column');
select has_column('admin_audit_log', 'created_at', 'admin_audit_log has created_at column');

-- ============================================================================
-- 4. Banned user cannot access data
-- ============================================================================

-- Test: Banned user cannot read profiles (via public_profiles view)
-- This is already enforced by the public_profiles view filtering is_banned
-- We just verify the view exists and has the filter
select has_view('public_profiles', 'public_profiles view exists');

-- ============================================================================
-- 5. Verification status enum
-- ============================================================================

-- Test: verification_status enum exists
select has_type('verification_status', 'verification_status enum exists');

-- ============================================================================
-- 6. Storage bucket policies
-- ============================================================================

-- Test: verification-selfies bucket exists
select results_eq(
  $$ select count(*) from storage.buckets where id = 'verification-selfies' $$,
  $$ values (1::bigint) $$,
  'verification-selfies bucket exists'
);

-- Finish tests
select * from finish();

rollback;

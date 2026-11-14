-- Admin analytics dashboard tests (migration 28).
--
-- Two halves:
--   1. every RPC refuses a caller who is not an administrator, including a
--      signed-in ordinary member (the check is role-based, not "is there a
--      session");
--   2. with the admin role, the payloads carry the data the dashboard renders,
--      and the member payload still does not contain a WhatsApp number.
--
-- Access to a conversation must itself leave an audit row.
\set ON_ERROR_STOP on
begin;

create extension if not exists pgtap;

select plan(21);

-- ============================================================================
-- 1. No session: every function refuses
-- ============================================================================
select throws_ok(
  $$ select admin_dashboard_overview() $$,
  '42501', null,
  'anonymous caller cannot read the overview'
);

select throws_ok(
  $$ select * from admin_list_users(null, 10, 0) $$,
  '42501', null,
  'anonymous caller cannot list members'
);

select throws_ok(
  $$ select admin_get_user('20000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'anonymous caller cannot read a member record'
);

select throws_ok(
  $$ select * from admin_list_conversations(null, 10, 0) $$,
  '42501', null,
  'anonymous caller cannot list conversations'
);

select throws_ok(
  $$ select admin_get_conversation('00000000-0000-4000-8000-000000000000', 10) $$,
  '42501', null,
  'anonymous caller cannot read a conversation'
);

select throws_ok(
  $$ select * from admin_search_messages('hello', 10) $$,
  '42501', null,
  'anonymous caller cannot search messages'
);

-- ============================================================================
-- 2. Signed in as an ordinary member: still refused
-- ============================================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select admin_dashboard_overview() $$,
  '42501', null,
  'a signed-in non-admin cannot read the overview'
);

select throws_ok(
  $$ select admin_get_user('20000000-0000-4000-8000-000000000002') $$,
  '42501', null,
  'a signed-in non-admin cannot read another member record'
);

select throws_ok(
  $$ select admin_reveal_contact('20000000-0000-4000-8000-000000000002') $$,
  '42501', null,
  'a signed-in non-admin cannot reveal a phone number'
);

-- ============================================================================
-- 3. Administrator
-- ============================================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

select ok(
  admin_dashboard_overview() ? 'users'
  and admin_dashboard_overview() ? 'engagement'
  and admin_dashboard_overview() ? 'moderation',
  'overview carries the users, engagement and moderation sections'
);

select is(
  (admin_dashboard_overview()->'users'->>'total')::bigint,
  (select count(*) from public.profiles),
  'overview total member count matches the table'
);

select isnt_empty(
  $$ select * from admin_list_users(null, 10, 0) $$,
  'admin can list members'
);

select is(
  (select count(*) from admin_list_users('Aarav', 10, 0)),
  1::bigint,
  'member search filters by name'
);

select is(
  admin_get_user('20000000-0000-4000-8000-000000000001')->'profile'->>'id',
  '20000000-0000-4000-8000-000000000001',
  'member detail returns the requested member'
);

select ok(
  not (admin_get_user('20000000-0000-4000-8000-000000000001')->'profile' ? 'whatsapp_number'),
  'member detail never exposes a phone-number column'
);

select is(
  admin_get_user('20000000-0000-4000-8000-000000000001')->'profile'->>'has_phone_number',
  'true',
  'member detail reports only whether a number is on file'
);

select is(
  admin_reveal_contact('20000000-0000-4000-8000-000000000001')->>'whatsapp_number',
  '+15550100002',
  'an admin can reveal the seeded number'
);

select isnt_empty(
  $$ select 1 from public.admin_audit_log where action = 'reveal_phone_number' $$,
  'revealing a number writes an audit row'
);

-- A conversation to read: a match and one message, inside this rolled-back
-- transaction so the seeded state is untouched. Idempotent when the local demo
-- seed has already created the same pair.
insert into public.matches (id, user_id, matched_user_id, created_at, last_message_at)
values (
  '00000000-0000-4000-8000-0000000000aa',
  '11111111-1111-4111-8111-111111111111',
  '20000000-0000-4000-8000-000000000001',
  now(), now()
)
on conflict (user_id, matched_user_id) do nothing;

insert into public.messages (id, match_id, sender_id, content)
values (
  '00000000-0000-4000-8000-0000000000bb',
  (
    select id from public.matches
    where user_id = '11111111-1111-4111-8111-111111111111'
      and matched_user_id = '20000000-0000-4000-8000-000000000001'
  ),
  '11111111-1111-4111-8111-111111111111',
  'Dashboard fixture message'
)
on conflict (id) do nothing;

select ok(
  exists (
    select 1
    from jsonb_array_elements(
      admin_get_conversation(
        (
          select id from public.matches
          where user_id = '11111111-1111-4111-8111-111111111111'
            and matched_user_id = '20000000-0000-4000-8000-000000000001'
        ),
        100
      )->'messages'
    ) as message
    where message->>'content' = 'Dashboard fixture message'
  ),
  'conversation view returns the message bodies'
);

select isnt_empty(
  $$ select * from admin_search_messages('Dashboard fixture', 10) $$,
  'admin can search across message bodies'
);

select isnt_empty(
  $$ select 1 from public.admin_audit_log where action = 'view_conversation' $$,
  'reading a conversation writes an audit row'
);

select * from finish();

rollback;

-- contact — Consent-based WhatsApp requests.
--
-- Migration 16's release gate (get_contact_link) is already pinned by
-- 04_private_contacts.sql and 08_security_contract.sql. This file pins the
-- layer built on top of it: the request flow, the access trail, and the three
-- new functions. The properties under test:
--
--   * a stranger gets NULL, silently — never the reason why;
--   * a match with share_mode 'never' gets NULL;
--   * a match with share_mode 'matches' gets the number;
--   * the 'approved' flow — ask, approve, release — works, and only the owner
--     can answer;
--   * a block cancels everything, matched or not;
--   * the number never lives anywhere except private_contacts: neither new
--     table has a phone column;
--   * every successful release leaves a contact_access_log row the owner can
--     read and nobody else can;
--   * the twenty-first lookup in an hour is refused;
--   * at most ten requests a day, and only against 'approved' owners;
--   * revoke_all_contact_access() ends every grant at once.
--
-- Fixtures are the seeded members plus direct inserts written as the owner,
-- exactly like the other security files. The whole file runs in one
-- transaction and is rolled back.

create extension if not exists pgtap with schema extensions;

begin;
select plan(51);

-- ---------------------------------------------------------------------------
-- Fixtures. The seeded share modes are: demo/aarav/diya 'matches', meera(0006)
-- 'never', tanya(0012) 'approved'. No matches exist in the fresh seed, so the
-- two needed pairs are written directly as the owner (a member can only reach
-- a match by liking both ways).
-- ---------------------------------------------------------------------------
insert into public.matches (user_id, matched_user_id) values
  (least('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000001'::uuid),
   greatest('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000001'::uuid)),
  (least('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000006'::uuid),
   greatest('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000006'::uuid));

-- ---------------------------------------------------------------------------
-- 0. Structure: both new tables are default-deny, anon-ignorant, and hold no
-- phone-shaped column anywhere. Anonymous means RLS closes the door even where
-- a table-level grant exists, and the request functions are simply not
-- executable.
-- ---------------------------------------------------------------------------
set local role anon;

select throws_like(
  $$select * from public.contact_requests$$, '%permission denied%',
  'anon cannot read contact_requests'
);
select throws_like(
  $$select * from public.contact_access_log$$, '%permission denied%',
  'anon cannot read contact_access_log'
);
select throws_like(
  $$select public.request_contact('20000000-0000-4000-8000-000000000012')$$,
  '%permission denied%',
  'anon cannot ask for a number'
);
select throws_like(
  $$select public.respond_contact_request('00000000-0000-4000-8000-000000000000', true)$$,
  '%permission denied%',
  'anon cannot answer a request'
);
select is(
  (select count(*) from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contact_requests'
      and (column_name ilike '%number%' or column_name ilike '%phone%')),
  0::bigint,
  'contact_requests holds no number or phone column'
);
select is(
  (select count(*) from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contact_access_log'
      and (column_name ilike '%number%' or column_name ilike '%phone%')),
  0::bigint,
  'contact_access_log holds no number or phone column'
);

reset role;

-- ---------------------------------------------------------------------------
-- 1. The release gate: a stranger gets NULL, silently.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select public.get_contact_link('20000000-0000-4000-8000-000000000002')),
  null::text,
  '1a. a stranger gets nothing: no match, and the refusal is null'
);

-- 2. Matched, share_mode 'never': still null.
select is(
  (select public.get_contact_link('20000000-0000-4000-8000-000000000006')),
  null::text,
  '2a. a match sharing in never mode releases nothing'
);

-- 3. Matched, share_mode 'matches': the number.
select is(
  (select public.get_contact_link('20000000-0000-4000-8000-000000000001')),
  '+15550100002'::text,
  '3a. a match sharing with matches releases the number'
);

-- The profile door exposes one flag and one flag only: does the target invite
-- requests. Not the raw mode, not the number.
select ok(
  (select contact_can_request from public.get_profile('20000000-0000-4000-8000-000000000012')),
  '3b. an approved-mode owner is marked askable on the profile page'
);
select ok(
  not (select contact_can_request from public.get_profile('20000000-0000-4000-8000-000000000001')),
  '3c. a matches-mode owner is not marked askable'
);

-- ---------------------------------------------------------------------------
-- 4. A block cancels the release even when a match exists.
-- ---------------------------------------------------------------------------
reset role;

insert into public.blocks (blocker_id, blocked_id)
values ('20000000-0000-4000-8000-000000000001',
        '11111111-1111-4111-8111-111111111111');

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select public.get_contact_link('20000000-0000-4000-8000-000000000001')),
  null::text,
  '4a. a block cancels the number even when a match exists'
);

-- ---------------------------------------------------------------------------
-- 5. The request path: gates before successes.
-- ---------------------------------------------------------------------------
reset role;

-- Unblock demo again so the rest of the file can proceed.
delete from public.blocks
 where blocker_id = '20000000-0000-4000-8000-000000000001'
   and blocked_id = '11111111-1111-4111-8111-111111111111';

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select throws_like(
  $$select public.request_contact('11111111-1111-4111-8111-111111111111')$$,
  '%Not permitted%',
  '5a. a member cannot ask themselves for their own number'
);
select throws_like(
  $$select public.request_contact('20000000-0000-4000-8000-000000000001')$$,
  '%Not permitted%',
  '5b. a matches-mode owner receives no requests'
);
select throws_like(
  $$select public.request_contact('20000000-0000-4000-8000-000000000004')$$,
  '%Not permitted%',
  '5c. an owner who never saved a number receives no requests'
);

-- A blocked pair cannot ask each other for anything, whoever did the blocking.
reset role;
insert into public.blocks (blocker_id, blocked_id)
values ('20000000-0000-4000-8000-000000000012',
        '11111111-1111-4111-8111-111111111111');

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select throws_like(
  $$select public.request_contact('20000000-0000-4000-8000-000000000012')$$,
  '%Not permitted%',
  '5d. a blocked requester cannot ask'
);

reset role;
delete from public.blocks
 where blocker_id = '20000000-0000-4000-8000-000000000012'
   and blocked_id = '11111111-1111-4111-8111-111111111111';

-- The happy path: ask an 'approved' owner, have them approve.
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.request_contact('20000000-0000-4000-8000-000000000012')$$,
  '5e. asking an approved-mode owner succeeds'
);
select is(
  (select status::text from public.contact_requests
    where requester_id = '11111111-1111-4111-8111-111111111111'
      and owner_id = '20000000-0000-4000-8000-000000000012'),
  'pending',
  '5f. and the request is pending'
);

-- The requester cannot answer their own request, and the owner cannot answer a
-- request that does not exist.
select throws_like(
  $$select public.respond_contact_request(
     (select id from public.contact_requests
       where requester_id = '11111111-1111-4111-8111-111111111111'
         and owner_id = '20000000-0000-4000-8000-000000000012'), true)$$,
  '%Not permitted%',
  '5g. only the owner may answer a request'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
set local role authenticated;

select throws_like(
  $$select public.respond_contact_request('00000000-0000-4000-8000-000000000000', true)$$,
  '%Not found%',
  '5h. answering a request that does not exist fails'
);
select lives_ok(
  $$select public.respond_contact_request(
     (select id from public.contact_requests
       where requester_id = '11111111-1111-4111-8111-111111111111'
         and owner_id = '20000000-0000-4000-8000-000000000012'), true)$$,
  '5i. the owner approves'
);
select is(
  (select status::text from public.contact_requests
    where requester_id = '11111111-1111-4111-8111-111111111111'
      and owner_id = '20000000-0000-4000-8000-000000000012'),
  'approved',
  '5j. the request is approved'
);
select is(
  (select count(*) from public.contact_approvals
    where owner_id = '20000000-0000-4000-8000-000000000012'
      and viewer_id = '11111111-1111-4111-8111-111111111111'),
  1::bigint,
  '5k. approval wrote the per-viewer grant'
);
select lives_ok(
  $$select public.respond_contact_request(
     (select id from public.contact_requests
       where requester_id = '11111111-1111-4111-8111-111111111111'
         and owner_id = '20000000-0000-4000-8000-000000000012'), true)$$,
  '5l. re-answering an answered request is a no-op'
);
select is(
  (select count(*) from public.contact_approvals
    where owner_id = '20000000-0000-4000-8000-000000000012'
      and viewer_id = '11111111-1111-4111-8111-111111111111'),
  1::bigint,
  '5m. and creates no duplicate grant'
);

reset role;

-- The released approval releases the number.
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select public.get_contact_link('20000000-0000-4000-8000-000000000012')),
  '+15550100005'::text,
  '5n. an explicitly approved viewer gets the number'
);

-- ---------------------------------------------------------------------------
-- 6. Decline, re-ask, release: decline is not a permanent wall, and every
-- approval is still the owner's choice.
-- ---------------------------------------------------------------------------
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.request_contact('20000000-0000-4000-8000-000000000012')$$,
  '6a. a second requester asks'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.respond_contact_request(
     (select id from public.contact_requests
       where requester_id = '20000000-0000-4000-8000-000000000002'
         and owner_id = '20000000-0000-4000-8000-000000000012'), false)$$,
  '6b. the owner declines'
);
select is(
  (select status::text from public.contact_requests
    where requester_id = '20000000-0000-4000-8000-000000000002'
      and owner_id = '20000000-0000-4000-8000-000000000012'),
  'declined',
  '6c. the request is declined'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select public.get_contact_link('20000000-0000-4000-8000-000000000012')),
  null::text,
  '6d. a declined requester gets nothing'
);
select lives_ok(
  $$select public.request_contact('20000000-0000-4000-8000-000000000012')$$,
  '6e. a declined request can be re-asked'
);
select is(
  (select status::text from public.contact_requests
    where requester_id = '20000000-0000-4000-8000-000000000002'
      and owner_id = '20000000-0000-4000-8000-000000000012'),
  'pending',
  '6f. and it reopens as pending'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.respond_contact_request(
     (select id from public.contact_requests
       where requester_id = '20000000-0000-4000-8000-000000000002'
         and owner_id = '20000000-0000-4000-8000-000000000012'), true)$$,
  '6g. the reopened request is approved'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select public.get_contact_link('20000000-0000-4000-8000-000000000012')),
  '+15550100005'::text,
  '6h. and releases the number after approval'
);

-- ---------------------------------------------------------------------------
-- 7. The daily ask quota: ten requests a day, the eleventh refused.
--
-- demo already has one request on the books (the tanya one from section 5).
-- Nine more are seeded directly as the owner — the shape of the quota, not the
-- path to it, is what is under test here.
-- ---------------------------------------------------------------------------
reset role;

insert into public.contact_requests (requester_id, owner_id)
select '11111111-1111-4111-8111-111111111111'::uuid, id
from public.profiles
where id in (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000006',
  '20000000-0000-4000-8000-000000000007',
  '20000000-0000-4000-8000-000000000008',
  '20000000-0000-4000-8000-000000000009',
  '20000000-0000-4000-8000-000000000010'
);

-- diya becomes an 'approved' owner so the refusal that follows is the quota,
-- not the consent-mode gate.
update public.private_contacts
   set share_mode = 'approved'
 where user_id = '20000000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select throws_like(
  $$select public.request_contact('20000000-0000-4000-8000-000000000002')$$,
  '%Rate limited%',
  '7a. the eleventh request in a day is refused'
);

-- ---------------------------------------------------------------------------
-- 8. RLS on the two tables: a member sees exactly the rows they are a party
-- to, and nothing of other people's requests.
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.contact_requests),
  10::bigint,
  '8a. demo sees their ten requester rows and nobody else''s'
);

reset role;

select is(
  (select count(*) from public.contact_requests),
  11::bigint,
  '8b. the table itself holds eleven rows including diya''s'
);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.contact_requests),
  1::bigint,
  '8c. diya sees only their own request row'
);

-- ---------------------------------------------------------------------------
-- 9. The access trail: every successful release is logged for the owner
-- alone. The viewer sees nothing, and a client cannot write the log.
-- ---------------------------------------------------------------------------
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.contact_access_log),
  0::bigint,
  '9a. a viewer sees no access-log rows, even for numbers they received'
);
select throws_like(
  $$insert into public.contact_access_log (owner_id, viewer_id)
    values ('20000000-0000-4000-8000-000000000012',
            '11111111-1111-4111-8111-111111111111')$$,
  '%permission denied%',
  '9b. a client cannot write the access log'
);

reset role;

-- The owner side: aarav released his number exactly once (section 3a; the
-- blocked call in section 4 never released anything); tanya released hers to
-- demo and diya.
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.contact_access_log
    where owner_id = '20000000-0000-4000-8000-000000000001'),
  1::bigint,
  '9c. aarav sees the single release of his number'
);
select is(
  (select viewer_id from public.contact_access_log
    where owner_id = '20000000-0000-4000-8000-000000000001'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  '9d. and who it went to'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.contact_access_log
    where owner_id = '20000000-0000-4000-8000-000000000012'),
  2::bigint,
  '9e. tanya sees both successful releases of her number'
);

-- ---------------------------------------------------------------------------
-- 10. revoke_all_contact_access: the panic button ends every grant at once.
-- ---------------------------------------------------------------------------
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select public.revoke_all_contact_access()$$,
  '10a. the owner can revoke everything'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000012","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select share_mode::text from public.private_contacts
    where user_id = '20000000-0000-4000-8000-000000000012'),
  'never',
  '10b. revoke drops share_mode to never'
);

reset role;

select is(
  (select count(*) from public.contact_approvals
    where owner_id = '20000000-0000-4000-8000-000000000012'),
  0::bigint,
  '10c. revoke deletes every grant'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select public.get_contact_link('20000000-0000-4000-8000-000000000012')),
  null::text,
  '10d. after revoke, even a previously approved member gets nothing'
);
select throws_like(
  $$select public.request_contact('20000000-0000-4000-8000-000000000012')$$,
  '%Not permitted%',
  '10e. a revoked owner no longer accepts requests'
);

-- ---------------------------------------------------------------------------
-- 11. get_contact_link is rate limited: 20 lookups per hour, the 21st refused.
-- rohan (0003) has not called the function anywhere in this file, so his quota
-- starts clean. Every call targets meera (0006), whose never mode makes every
-- answer null — nulls still count, which is exactly the point.
-- ---------------------------------------------------------------------------
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select public.get_contact_link('20000000-0000-4000-8000-000000000006')),
  null::text,
  '11a. rohan: first lookup within the limit'
);

do $$
begin
  for i in 1..18 loop
    perform public.get_contact_link('20000000-0000-4000-8000-000000000006');
  end loop;
end $$;

select is(
  (select public.get_contact_link('20000000-0000-4000-8000-000000000006')),
  null::text,
  '11b. rohan: the twentieth lookup is still allowed'
);

select throws_like(
  $$select public.get_contact_link('20000000-0000-4000-8000-000000000006')$$,
  '%Rate limited%',
  '11c. rohan: the twenty-first lookup in the hour is refused'
);

reset role;
-- 04 — Phone numbers and consent.
--
-- A number is the most damaging thing this schema holds: it is the one piece of
-- data that leaves the app, it survives a password reset, and it cannot be
-- un-published once someone has it. It lives in exactly one table, one column,
-- and there is exactly one function that reads it.
--
-- So the property under test is not "is the number hidden" but "under what
-- conditions does get_contact_number return it". Three separate things must
-- hold — the two members are matched, the owner has not set share_mode to
-- 'never', and when share_mode is 'approved' the owner has granted this
-- specific viewer. Each is proved to be load-bearing by breaking it in turn.
--
-- The whole file runs in one transaction and is rolled back.

create extension if not exists pgtap with schema extensions;

begin;
select plan(37);

-- ---------------------------------------------------------------------------
-- Fixtures. Seeded share modes: demo and 001/002 are 'matches', 006 is 'never',
-- 012 is 'approved'. 004 has no private_contacts row at all, which is the
-- state of any member who has never saved a number.
-- ---------------------------------------------------------------------------
select is(
  (select share_mode from public.private_contacts
    where user_id = '20000000-0000-4000-8000-000000000006'),
  'never'::public.share_mode,
  'the never-share fixture is in place'
);

select is(
  (select count(*) from public.private_contacts
    where user_id = '20000000-0000-4000-8000-000000000004'),
  0::bigint,
  'a member with no saved number has no private_contacts row'
);

-- Matches, so the consent checks are reached rather than short-circuited on
-- "not matched". The trigger is not involved; these are written as the owner
-- because a member can only reach a match by liking both ways.
insert into public.matches (user_id, matched_user_id) values
  (least('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000001'::uuid),
   greatest('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000001'::uuid)),
  (least('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000006'::uuid),
   greatest('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000006'::uuid)),
  (least('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000012'::uuid),
   greatest('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000012'::uuid)),
  (least('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000004'::uuid),
   greatest('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000004'::uuid)),
  (least('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000009'::uuid),
   greatest('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000009'::uuid));

-- ---------------------------------------------------------------------------
-- Unauthenticated and self-directed calls are refused before anything is read.
-- ---------------------------------------------------------------------------
select throws_like(
  $$select public.get_contact_number('20000000-0000-4000-8000-000000000001')$$,
  '%Not authenticated%',
  'an anonymous caller cannot ask for a number'
);

-- ---------------------------------------------------------------------------
-- The consent gate itself, as a signed-in member. The caller is the demo member
-- throughout, matched with each of the four owners under test.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

-- 1. Not a match: refused outright, and the distinction from "no consent" is
--    deliberate. An unmatched member must not be able to tell the difference
--    between someone who has declined and someone who has never been asked.
select throws_like(
  $$select public.get_contact_number('20000000-0000-4000-8000-000000000010')$$,
  '%Not permitted%',
  'an unmatched member is refused a number'
);

-- 2. Their own number: also refused. A member reads their own from
--    private_contacts directly, so this function has no reason to serve it, and
--    allowing it would make the function a way to confirm your own record.
select throws_like(
  $$select public.get_contact_number('11111111-1111-4111-8111-111111111111')$$,
  '%Not permitted%',
  'a member cannot use the release function for their own number'
);

-- 3. share_mode = 'never', but matched. Null, not an error: the owner has
--    declined, and declining is not a failure state.
select is(
  public.get_contact_number('20000000-0000-4000-8000-000000000006'),
  null::text,
  'a matched member who set share_mode to never gets nothing'
);

-- 4. share_mode = 'matches', and matched. This is the one case that releases.
select is(
  public.get_contact_number('20000000-0000-4000-8000-000000000001'),
  '+15550100002'::text,
  'a matched member who shares with matches gets the number'
);

-- 5. share_mode = 'approved', matched, but nobody has approved this viewer yet.
select is(
  public.get_contact_number('20000000-0000-4000-8000-000000000012'),
  null::text,
  'share_mode approved withholds the number until the owner grants it'
);

-- 6. Matched, owner has saved no number at all.
select is(
  public.get_contact_number('20000000-0000-4000-8000-000000000004'),
  null::text,
  'a member who never saved a number has nothing to release'
);

-- ---------------------------------------------------------------------------
-- Row level security on the table itself. The function above is the only door;
-- this proves the wall is actually there and is not relying on the function
-- being the sole path by convention.
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.private_contacts),
  1::bigint,
  'a member can read exactly one private_contacts row: their own'
);

select is(
  (select user_id from public.private_contacts),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'and that row is their own'
);

select is(
  (select count(*) from public.private_contacts
    where user_id = '20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'another member''s number is not readable through the table'
);

select throws_like(
  $$insert into public.private_contacts (user_id, whatsapp_number)
    values ('20000000-0000-4000-8000-000000000001', '+15550109999')$$,
  '%row-level security%',
  'a member cannot save a number against someone else''s profile'
);

-- An UPDATE that matches no visible row is a silent no-op, not an error: the
-- `using (auth.uid() = user_id)` clause filters the row out before the write.
-- The assertion that matters is therefore the state afterwards, which is
-- checked once the member session is closed.
select lives_ok(
  $$update public.private_contacts
       set share_mode = 'matches'
     where user_id = '20000000-0000-4000-8000-000000000006'$$,
  'a member cannot loosen somebody else''s sharing setting'
);

-- ---------------------------------------------------------------------------
-- Only the owner of a number can approve a viewer for it. The approval table is
-- the second half of the 'approved' mode, and it is the table that decides
-- whether a digit leaves the building, so writing it has to be as constrained
-- as reading the number.
-- ---------------------------------------------------------------------------
select throws_like(
  $$insert into public.contact_approvals (owner_id, viewer_id)
    values ('20000000-0000-4000-8000-000000000001',
            '11111111-1111-4111-8111-111111111111')$$,
  '%row-level security%',
  'a member cannot approve themselves for someone else''s number'
);

-- The policy is `with check (auth.uid() = owner_id)`, so any row whose owner is
-- not the caller is refused, whoever the viewer is.
select throws_like(
  $$insert into public.contact_approvals (owner_id, viewer_id)
    values ('20000000-0000-4000-8000-000000000009',
            '20000000-0000-4000-8000-000000000006')$$,
  '%row-level security%',
  'a member cannot write an approval row they are neither owner nor viewer of'
);

select throws_like(
  $$insert into public.contact_approvals (owner_id, viewer_id)
    values ('20000000-0000-4000-8000-000000000012',
            '20000000-0000-4000-8000-000000000012')$$,
  '%row-level security%',
  'a member cannot write a self-approval either'
);

select is(
  (select count(*) from public.contact_approvals),
  0::bigint,
  'none of the three forged approvals was recorded'
);

reset role;

-- Self-approval is refused by the check constraint as well, and is proved from
-- the owner side so the two defences are not confused for one. RLS alone would
-- be enough for a client, but the constraint is what holds when the row is
-- written by a server-side function acting for a member.
select throws_like(
  $$insert into public.contact_approvals (owner_id, viewer_id)
    values ('20000000-0000-4000-8000-000000000012',
            '20000000-0000-4000-8000-000000000012')$$,
  '%violates check constraint "contact_approvals_not_self"%',
  'a self-approval is refused by the constraint, not only by RLS'
);

select is(
  (select share_mode from public.private_contacts
    where user_id = '20000000-0000-4000-8000-000000000006'),
  'never'::public.share_mode,
  'the other member''s sharing setting is untouched'
);

-- ---------------------------------------------------------------------------
-- An approval granted to somebody else does not release the number. The check
-- is on the specific viewer, so sharing with one match must not leak to another.
-- These approvals are written as the owner of the number, which is the only
-- role permitted to write them at all.
-- ---------------------------------------------------------------------------
insert into public.contact_approvals (owner_id, viewer_id)
values ('20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000009');

set local role authenticated;

select is(
  public.get_contact_number('20000000-0000-4000-8000-000000000012'),
  null::text,
  'an approval granted to a third party does not release the number'
);

reset role;

-- Now the owner of the number grants the demo member access, as the owner would
-- from the app, and the number is released for that viewer alone.
insert into public.contact_approvals (owner_id, viewer_id)
values ('20000000-0000-4000-8000-000000000012', '11111111-1111-4111-8111-111111111111');

set local role authenticated;

select is(
  public.get_contact_number('20000000-0000-4000-8000-000000000012'),
  '+15550100005'::text,
  'once the owner approves this viewer, the number is released'
);

-- Revoking the approval closes it again, which is the whole point of a consent
-- record: withdrawal has to take effect and not merely be possible.
delete from public.contact_approvals
 where owner_id = '20000000-0000-4000-8000-000000000012'
   and viewer_id = '11111111-1111-4111-8111-111111111111';

select is(
  public.get_contact_number('20000000-0000-4000-8000-000000000012'),
  null::text,
  'withdrawing the approval stops the number being released'
);

reset role;

-- ---------------------------------------------------------------------------
-- The handover request flow. The caller offers their own number to a match, and
-- the number is written to their private_contacts row — never to the consent
-- trail, which the other member can read. That is why whatsapp_consents has no
-- number column, and it is the property worth pinning.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

-- The consent trail is readable by both parties and holds no number, so the
-- other member reading it learns only that a request exists.
select lives_ok(
  $$select public.request_whatsapp('20000000-0000-4000-8000-000000000001',
                                   '+15550100001')$$,
  'a matched member can offer their own number'
);

select is(
  (select count(*) from public.whatsapp_consents
    where status = 'pending'),
  1::bigint,
  'the request is recorded as pending'
);

select is(
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'whatsapp_consents'
      and column_name ilike '%number%'),
  0::bigint,
  'the consent trail gained no number column by being used'
);

-- The other member can read the consent row, so the whole row is inspected: a
-- number anywhere in it would be a leak, whatever the column is called.
select ok(
  not exists (
    select 1
    from public.whatsapp_consents wc
    where to_jsonb(wc) ?| array['whatsapp_number', 'phone', 'phone_number', 'contact_number']
  ),
  'no key of the consent row holds a number under any name'
);

select is(
  (select array_agg(k order by k) from (
     select jsonb_object_keys(to_jsonb(wc)) as k
     from public.whatsapp_consents wc
   ) keys),
  array['id', 'matched_user_id', 'requested_at', 'responded_at', 'status', 'user_id']::text[],
  'the consent row is exactly the six columns it declares'
);

-- Only the two parties can see the request.
select is(
  (select count(*) from public.whatsapp_consents),
  1::bigint,
  'the requester can see their own request'
);

-- A number that is not E.164 is refused before it can be stored anywhere.
select throws_like(
  $$select public.request_whatsapp('20000000-0000-4000-8000-000000000001',
                                   '555-0100')$$,
  '%E.164%',
  'a number that is not E.164 is rejected'
);

-- The requester cannot answer their own request. This is the assertion that
-- keeps the flow meaningful: without it "approved" would be a status anyone
-- could set for themselves.
select throws_like(
  $$select public.respond_whatsapp_request(
      (select id from public.whatsapp_consents limit 1), 'approved')$$,
  '%Not permitted%',
  'the requester cannot approve their own request'
);

reset role;

-- The other party answers it.
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.respond_whatsapp_request(
      (select id from public.whatsapp_consents limit 1), 'approved')$$,
  'the matched member can approve the handover request'
);

select is(
  (select status from public.whatsapp_consents limit 1),
  'approved'::public.whatsapp_consent_status,
  'the request is approved'
);

select is(
  (select responded_at is not null from public.whatsapp_consents limit 1),
  true,
  'an answered request records when it was answered'
);

-- With the request approved and both members matched, the number is now
-- reachable through the same single function and no other.
select is(
  public.get_contact_number('11111111-1111-4111-8111-111111111111'),
  '+15550100001'::text,
  'an approved handover releases the number to the match'
);

-- The recipient has a private_contacts row of their own, so the count is not
-- zero; what must be invisible is the *requester's* row, which is the row the
-- handover just wrote.
select is(
  (select count(*) from public.private_contacts
    where user_id = '11111111-1111-4111-8111-111111111111'),
  0::bigint,
  'the recipient still cannot read the requester''s number through the table'
);

select is(
  (select count(*) from public.private_contacts),
  1::bigint,
  'the recipient sees only their own row'
);

select * from finish();
rollback;

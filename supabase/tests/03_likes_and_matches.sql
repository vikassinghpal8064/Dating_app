-- 03 — Likes, passes and matches.
--
-- The invariant under test is that a match can only come into existence one way:
-- two members liking each other, twice. A client must not be able to write a
-- match directly, and the mutual pair must resolve to exactly one row no matter
-- which of the two likes lands second or how many times it is replayed.
--
-- The whole file runs in one transaction and is rolled back, so the fixtures and
-- the matches created below never outlive it.

create extension if not exists pgtap with schema extensions;

begin;
select plan(21);

-- Two seeded members who are not yet matched. The seeded set contains no
-- matches, so this pair is certainly free.
select is(
  (select count(*) from public.matches
    where (user_id = '20000000-0000-4000-8000-000000000001'
           and matched_user_id = '20000000-0000-4000-8000-000000000002')
       or (user_id = '20000000-0000-4000-8000-000000000002'
           and matched_user_id = '20000000-0000-4000-8000-000000000001')),
  0::bigint,
  'the fixture pair starts out unmatched'
);

-- ---------------------------------------------------------------------------
-- Self-like. The database has to refuse it, because "liking yourself" is
-- otherwise the cheapest way to fabricate a match row with a known partner.
-- ---------------------------------------------------------------------------
select throws_like(
  $$insert into public.likes (liker_id, liked_id)
    values ('20000000-0000-4000-8000-000000000001',
            '20000000-0000-4000-8000-000000000001')$$,
  '%violates check constraint "likes_not_self"%',
  'a member cannot like themselves'
);

select throws_like(
  $$insert into public.passes (user_id, passed_id)
    values ('20000000-0000-4000-8000-000000000001',
            '20000000-0000-4000-8000-000000000001')$$,
  '%violates check constraint "passes_not_self"%',
  'a member cannot pass on themselves'
);

select throws_like(
  $$insert into public.blocks (blocker_id, blocked_id)
    values ('20000000-0000-4000-8000-000000000001',
            '20000000-0000-4000-8000-000000000001')$$,
  '%violates check constraint "blocks_not_self"%',
  'a member cannot block themselves'
);

select throws_like(
  $$insert into public.matches (user_id, matched_user_id)
    values ('20000000-0000-4000-8000-000000000001',
            '20000000-0000-4000-8000-000000000001')$$,
  '%violates check constraint "matches_not_self"%',
  'a match cannot pair a member with themselves'
);

-- A match row stored the wrong way round is refused outright, which is what
-- makes the unique constraint meaningful. Without it the same pair could be
-- stored twice under opposite orderings.
select throws_like(
  $$insert into public.matches (user_id, matched_user_id)
    values ('20000000-0000-4000-8000-000000000002',
            '20000000-0000-4000-8000-000000000001')$$,
  '%violates check constraint "matches_user_id_is_the_lower_uuid"%',
  'a match cannot be stored with the higher uuid first'
);

-- ---------------------------------------------------------------------------
-- One-sided like creates nothing. This is the assertion that makes the trigger
-- mean something: a like is not a match until it is reciprocated.
-- ---------------------------------------------------------------------------
insert into public.likes (liker_id, liked_id)
values ('20000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002');

select is(
  (select count(*) from public.matches),
  0::bigint,
  'a one-sided like creates no match'
);

-- ---------------------------------------------------------------------------
-- The reciprocal like completes the pair. The trigger writes the row.
-- ---------------------------------------------------------------------------
insert into public.likes (liker_id, liked_id)
values ('20000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000001');

select is(
  (select count(*) from public.matches),
  1::bigint,
  'a mutual like creates a match'
);

select is(
  (select count(*) from public.matches
    where user_id = least('20000000-0000-4000-8000-000000000001'::uuid,
                          '20000000-0000-4000-8000-000000000002'::uuid)
      and matched_user_id = greatest('20000000-0000-4000-8000-000000000001'::uuid,
                                     '20000000-0000-4000-8000-000000000002'::uuid)),
  1::bigint,
  'the match is stored smallest-uuid-first, whichever like landed second'
);

-- ---------------------------------------------------------------------------
-- Idempotence. The trigger inserts with ON CONFLICT DO NOTHING against
-- matches_unique_pair, so a replayed like cannot produce a second match. A
-- client retrying a request after a dropped response is the realistic case, and
-- also the one that would otherwise double-count a conversation.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$insert into public.likes (liker_id, liked_id)
    values ('20000000-0000-4000-8000-000000000001',
            '20000000-0000-4000-8000-000000000002')
    on conflict (liker_id, liked_id) do nothing$$,
  'replaying a like is not an error'
);

select is(
  (select count(*) from public.matches),
  1::bigint,
  'replaying a like still leaves exactly one match'
);

-- Removing and re-adding the like exercises the trigger a second time, which a
-- plain ON CONFLICT DO NOTHING replay does not: this time the insert really
-- does fire and has to lose the race against the existing match.
delete from public.likes
 where liker_id = '20000000-0000-4000-8000-000000000001'
   and liked_id = '20000000-0000-4000-8000-000000000002';

insert into public.likes (liker_id, liked_id)
values ('20000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002');

select is(
  (select count(*) from public.matches),
  1::bigint,
  'a re-liked pair still resolves to a single match'
);

-- ---------------------------------------------------------------------------
-- Exactly one match per pair, enforced by the database rather than by the
-- trigger's ON CONFLICT clause. A second pair is unaffected, so the constraint
-- is discriminating rather than merely refusing everything.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$insert into public.matches (user_id, matched_user_id)
    values ('20000000-0000-4000-8000-000000000003',
            '20000000-0000-4000-8000-000000000004')$$,
  'a different pair can still be matched'
);

select throws_like(
  $$insert into public.matches (user_id, matched_user_id)
    values ('20000000-0000-4000-8000-000000000001',
            '20000000-0000-4000-8000-000000000002')$$,
  '%violates unique constraint "matches_unique_pair"%',
  'a pair cannot be matched twice'
);

select is(
  (select count(*) from public.matches),
  2::bigint,
  'the schema holds both pairs and no duplicates'
);

-- ---------------------------------------------------------------------------
-- A client must not be able to manufacture a match. There is no INSERT, UPDATE
-- or DELETE policy and no grant on matches at all, so the only path in is the
-- trigger. These are run as a signed-in member rather than as the owner.
--
-- The reciprocal like the last assertion needs is written here, as the owner,
-- before the member session starts.
-- ---------------------------------------------------------------------------
insert into public.likes (liker_id, liked_id)
values ('20000000-0000-4000-8000-000000000003',
        '20000000-0000-4000-8000-000000000001');

select is(
  (select count(*) from public.matches),
  2::bigint,
  'a reciprocal like on its own still creates no match'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_like(
  $$insert into public.likes (liker_id, liked_id)
    values ('20000000-0000-4000-8000-000000000004',
            '20000000-0000-4000-8000-000000000001')$$,
  '%row-level security%',
  'a member cannot like on someone else''s behalf'
);

select throws_like(
  $$insert into public.matches (user_id, matched_user_id)
    values ('20000000-0000-4000-8000-000000000006',
            '20000000-0000-4000-8000-000000000007')$$,
  '%permission denied%',
  'a member cannot insert a match directly'
);

select is(
  (select count(*) from public.likes
    where liker_id = '20000000-0000-4000-8000-000000000004'
      and liked_id = '20000000-0000-4000-8000-000000000001'),
  0::bigint,
  'the forged like was not recorded'
);

select is(
  (select count(*) from public.matches
    where (user_id = '20000000-0000-4000-8000-000000000006'
           and matched_user_id = '20000000-0000-4000-8000-000000000007')
       or (user_id = '20000000-0000-4000-8000-000000000007'
           and matched_user_id = '20000000-0000-4000-8000-000000000006')),
  0::bigint,
  'the fabricated match was not created'
);

-- A member's own like does complete a match, proving the RLS denial above is
-- about the direct write and not about the trigger being blocked too. The
-- reciprocal like was written as the owner just before this session began,
-- because the policy is `liker_id = auth.uid()`: member 001 cannot write the
-- other half of the pair from here, and being able to would be exactly the
-- shape of a fabricated match.
insert into public.likes (liker_id, liked_id)
values ('20000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000003');

select is(
  (select count(*) from public.matches
    where (user_id = '20000000-0000-4000-8000-000000000001'
           and matched_user_id = '20000000-0000-4000-8000-000000000003')
       or (user_id = '20000000-0000-4000-8000-000000000003'
           and matched_user_id = '20000000-0000-4000-8000-000000000001')),
  1::bigint,
  'a member''s like does complete the match through the trigger'
);

reset role;

select * from finish();
rollback;

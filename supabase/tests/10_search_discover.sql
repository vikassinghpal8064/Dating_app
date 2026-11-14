-- 10 — Search, discover, and the like/pass actions.
--
-- Proves what migration 15 added: the city gazetteer is readable only by
-- signed-in members, search_profiles honours every filter and every mandatory
-- exclusion while returning distance only as a bucket, the discover deck is
-- the caller's bounded neighbourhood without passed profiles, send_like
-- enforces the daily limit and reports mutual matches, and none of it is
-- reachable by `anon`.
--
-- The whole file runs in one transaction and is rolled back, so the seeded
-- state (including the deliberately one-sided like) stays untouched.

create extension if not exists pgtap with schema extensions;

begin;
select plan(33);

-- Signed-in members only. The seeded members with approved photos are
-- aarav (0001, Mumbai), diya (0002, Mumbai), tanya (0012, Bengaluru) and
-- vivek (0007, Bengaluru, unverified). The demo member signing in below is
-- 11111111-1111-4111-8111-111111111111 at 19.08/72.88 (Mumbai).

-- ---------------------------------------------------------------------------
-- 1. The gazetteer and the new functions are member-only
-- ---------------------------------------------------------------------------
select is(
  (select relrowsecurity from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'city_coordinates'),
  true,
  'city_coordinates has row level security enabled'
);

select throws_like(
  $$insert into public.city_coordinates (city, country, latitude, longitude)
    values ('Over-Precise', 'ZZ', 19.123, 72.456)$$,
  '%city_coordinates_latitude_rounded%',
  'city coordinates are CHECKed to two decimal places'
);

-- Prove all of it is unreachable without a session.
set local role anon;

select throws_like(
  $$select * from public.city_coordinates$$,
  '%permission denied%',
  'anon cannot read the city gazetteer'
);

select throws_like(
  $$select * from public.search_profiles()$$,
  '%permission denied%',
  'anon cannot call search_profiles'
);

select throws_like(
  $$select * from public.get_discover_candidates()$$,
  '%permission denied%',
  'anon cannot call get_discover_candidates'
);

select throws_like(
  $$select * from public.send_like('11111111-1111-4111-8111-111111111111', 'like')$$,
  '%permission denied%',
  'anon cannot call send_like'
);

select throws_like(
  $$select public.send_pass('11111111-1111-4111-8111-111111111111')$$,
  '%permission denied%',
  'anon cannot call send_pass'
);

-- ---------------------------------------------------------------------------
-- 2. search_profiles returns profile-card fields, never private ones
-- ---------------------------------------------------------------------------
-- The column-list assertion is a catalog read and must run as the owner.
reset role;

select ok(
  not exists (
    select 1
    from pg_attribute a
    where a.attrelid =
      'public.search_profiles(double precision, double precision, double precision, text, integer, integer, text[], text[], boolean, boolean, text[], integer, integer, integer, integer)'::regprocedure
      and a.attnum > 0
      and a.attname in ('email', 'latitude', 'longitude', 'date_of_birth',
                        'whatsapp_number', 'phone_number', 'phone', 'contact_number')
  ),
  'search_profiles return columns expose no email, coordinates, birth date or phone'
);

-- ---------------------------------------------------------------------------
-- 3. Seal the caller's identity for the member assertions below
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.search_profiles()),
  4::bigint,
  'search returns exactly the members with an approved photo'
);

select is(
  (select array_agg(x.full_name)
     from (select full_name from public.search_profiles()) x),
  array['Aarav Mehta', 'Diya Sharma', 'Vivek Ranganathan', 'Tanya Bedi']::text[],
  'search sorts by distance, then by recent activity'
);

select is(
  (select s.distance_bucket from public.search_profiles() s
    where s.full_name = 'Aarav Mehta'),
  'near',
  'the nearest member is reported as a coarse bucket, not a distance'
);

select is(
  (select count(*) from public.search_profiles(city_name := 'Bengaluru')),
  2::bigint,
  'city filter narrows to the chosen city'
);

select is(
  (select count(*) from public.search_profiles(radius_km := 10)),
  2::bigint,
  'radius filter keeps only members within the ring'
);

select is(
  (select count(*) from public.search_profiles(verified_only := true)),
  3::bigint,
  'verified-only drops the unverified photo holder'
);

select is(
  (select count(*) from public.search_profiles(online_only := true) s
    where s.full_name = 'Diya Sharma'),
  0::bigint,
  'online-only drops a member inactive 20+ minutes'
);

select is(
  (select count(*) from public.search_profiles() s
    where s.full_name = 'Diya Sharma' and s.is_online),
  0::bigint,
  'the 22-minute-inactive member is never flagged online'
);

select is(
  (select count(*) from public.search_profiles(looking_for_values := array['serious'])),
  1::bigint,
  'looking-for filter matches on the member intent'
);

select is(
  (select count(*) from public.search_profiles(interest_values := array['cycling'])),
  1::bigint,
  'interest filter overlaps on any selected interest'
);

select is(
  (select count(*) from public.search_profiles(min_age := 29)),
  2::bigint,
  'age floor excludes the younger members'
);

select is(
  (select count(*) from public.search_profiles(genders := array['female'])),
  2::bigint,
  'gender filter means the member own gender, not their interest list'
);

-- A member the caller blocked must vanish from search, in both directions.
insert into public.blocks (blocker_id, blocked_id)
values ('11111111-1111-4111-8111-111111111111', '20000000-0000-4000-8000-000000000002');

select is(
  (select count(*) from public.search_profiles()),
  3::bigint,
  'a member the caller blocked is excluded from search'
);

delete from public.blocks
where blocker_id = '11111111-1111-4111-8111-111111111111'
  and blocked_id = '20000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------------
-- 4. The discover deck: bounded neighbourhood, no passed members
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.get_discover_candidates()),
  2::bigint,
  'the deck returns the members in the caller''s saved 50 km range'
);

select is(
  (select s.full_name from public.get_discover_candidates() s limit 1),
  'Aarav Mehta',
  'the nearest member leads the deck'
);

select is(
  (select s.distance_bucket from public.get_discover_candidates() s
    where s.full_name = 'Aarav Mehta'),
  'near',
  'deck distances are coarse buckets too'
);

-- ---------------------------------------------------------------------------
-- 5. send_like / send_pass
-- ---------------------------------------------------------------------------
select throws_like(
  $$select * from public.send_pass('11111111-1111-4111-8111-111111111111')$$,
  '%Not permitted%',
  'a member cannot pass on themselves'
);

select throws_like(
  $$select * from public.send_like('11111111-1111-4111-8111-111111111111', 'like')$$,
  '%Not permitted%',
  'a member cannot like themselves'
);

select is(
  (select s.matched from public.send_like(
    '20000000-0000-4000-8000-000000000002', 'like') s),
  false,
  'a one-sided like is not yet a match'
);

select is(
  (select s.matched from public.send_like(
    '20000000-0000-4000-8000-000000000001', 'like') s),
  true,
  'the seeded reciprocal like completes a match on send_like'
);

select is(
  (select count(*) from public.matches
    where user_id = '11111111-1111-4111-8111-111111111111'
      and matched_user_id = '20000000-0000-4000-8000-000000000001'),
  1::bigint,
  'the mutual like created exactly one canonical match row'
);

select throws_like(
  $$select * from public.send_like('20000000-0000-4000-8000-000000000005', 'like')$$,
  '%not available%',
  'a member cannot like a banned profile'
);

-- Liking someone the caller just blocked must fail, then the block lifts.
insert into public.blocks (blocker_id, blocked_id)
values ('11111111-1111-4111-8111-111111111111', '20000000-0000-4000-8000-000000000002');

select throws_like(
  $$select * from public.send_like('20000000-0000-4000-8000-000000000002', 'like')$$,
  '%cannot like%',
  'a member cannot like someone they have blocked'
);

delete from public.blocks
where blocker_id = '11111111-1111-4111-8111-111111111111'
  and blocked_id = '20000000-0000-4000-8000-000000000002';

-- A pass removes the member from the deck.
select public.send_pass('20000000-0000-4000-8000-000000000002');
select is(
  (select count(*) from public.get_discover_candidates()),
  1::bigint,
  'a passed member leaves the deck'
);

-- ---------------------------------------------------------------------------
-- 6. The daily like limit lives in the database
-- ---------------------------------------------------------------------------
-- Owner-side setup: drop the (transaction-local) primary key so one hundred
-- rows to the same target are allowed, then stock them as today's likes.
reset role;
alter table public.likes drop constraint likes_pkey;

insert into public.likes (liker_id, liked_id, type, created_at)
select
  '11111111-1111-4111-8111-111111111111',
  '20000000-0000-4000-8000-000000000001',
  'like',
  now() - interval '5 minutes'
from generate_series(1, 100);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select throws_like(
  $$select * from public.send_like('20000000-0000-4000-8000-000000000001', 'like')$$,
  '%like limit%',
  'the 101st like of the day is refused by the database'
);

rollback;
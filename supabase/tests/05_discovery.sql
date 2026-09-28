-- 05 — Discovery, the public view, and distance.
--
-- public_profiles is the only door to another member's profile, and its column
-- list is the security boundary rather than a row policy. This file proves what
-- it does and does not publish, who it refuses to show, and that the distance
-- number it exposes is coarse enough to be safe.
--
-- Two claims are load-bearing and get their own sections: the view is
-- unreachable with somebody else's identity (IDOR), and a distance is withheld
-- outright when either party has asked for it to be.
--
-- Note the roles. Assertions about the raw `profiles` table run as the owner,
-- because a member can only see their own row there — which is itself asserted
-- in its own right further down. Assertions about the view and the two
-- SECURITY DEFINER functions run as a signed-in member, because that is the
-- only way the RLS and the `auth.uid()` checks are actually exercised.
--
-- The whole file runs in one transaction and is rolled back.

create extension if not exists pgtap with schema extensions;

begin;
select plan(47);

-- ---------------------------------------------------------------------------
-- Seeded ground truth, as the owner. Stated up front so a later assertion
-- cannot pass by coincidentally matching whatever the seed happens to contain.
--
-- 22 profiles: 20 members, the demo member, the half-finished signup and the
-- banned member. 21 visible (everything but the half-finished one), of which
-- one is banned, leaves 20 that are legitimately discoverable — minus the
-- caller, so the demo member's view holds 19 rows.
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.profiles),
  22::bigint,
  'the seed has twenty-two profiles'
);

select is(
  (select count(*) from public.profiles where is_visible),
  21::bigint,
  'the seed has twenty-one visible profiles'
);

select is(
  (select count(*) from public.profiles where is_banned),
  1::bigint,
  'the seed has one banned profile'
);

select is(
  (select count(*) from public.profiles where is_visible and not is_banned),
  20::bigint,
  'twenty of them are visible and not banned'
);

select is(
  (select count(*) from public.profiles where not is_visible),
  1::bigint,
  'exactly one seeded profile is not visible'
);

select is(
  (select full_name from public.profiles where not is_visible),
  'Halfway Through Signup'::text,
  'and it is the member who never supplied a birth date'
);

select is(
  (select is_banned from public.profiles
    where id = '20000000-0000-4000-8000-000000000005'),
  true,
  'the banned fixture is complete apart from the ban'
);

select is(
  (select is_visible from public.profiles
    where id = '20000000-0000-4000-8000-000000000005'),
  true,
  'so it would otherwise have been discoverable'
);

-- ---------------------------------------------------------------------------
-- Unauthenticated. `anon` is switched to explicitly: the rest of this file runs
-- as the owner, who is not a member and is not what the browser is.
-- ---------------------------------------------------------------------------
set local role anon;

select throws_like(
  $$select count(*) from public.public_profiles$$,
  '%permission denied%',
  'an anonymous caller cannot read the public view'
);

select throws_like(
  $$select count(*) from public.profiles$$,
  '%permission denied%',
  'an anonymous caller cannot read the profiles table'
);

select throws_like(
  $$select * from public.get_potential_matches('11111111-1111-4111-8111-111111111111')$$,
  '%permission denied%',
  'an anonymous caller cannot pull a discovery feed'
);

select throws_like(
  $$select * from public.search_profiles_by_distance(19.08, 72.88, 50)$$,
  '%permission denied%',
  'an anonymous caller cannot run a distance search'
);

select throws_like(
  $$select public.get_contact_number('20000000-0000-4000-8000-000000000001')$$,
  '%permission denied%',
  'an anonymous caller cannot ask for a number'
);

reset role;

-- ---------------------------------------------------------------------------
-- The member session. Everything from here is what the browser actually does.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

-- profiles is self-only. A member reading the table sees their own row and
-- nothing else, which is why the feed has to go through the view at all.
select is(
  (select count(*) from public.profiles),
  1::bigint,
  'a member reading the profiles table sees exactly one row'
);

select is(
  (select id from public.profiles),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'and that row is their own'
);

-- ---------------------------------------------------------------------------
-- IDOR. The feed takes a user_id argument because the browser already sends
-- one, and the reason it is safe is that the argument is checked against the
-- caller rather than trusted. Proving that requires calling it with somebody
-- else's id and being refused.
-- ---------------------------------------------------------------------------
select throws_like(
  $$select * from public.get_potential_matches('20000000-0000-4000-8000-000000000001')$$,
  '%You can only read your own discovery feed%',
  'a member cannot pull another member''s discovery feed'
);

select throws_like(
  $$select * from public.get_potential_matches(null)$$,
  '%You can only read your own discovery feed%',
  'a null user_id is refused rather than defaulting to everybody'
);

select lives_ok(
  $$select * from public.get_potential_matches('11111111-1111-4111-8111-111111111111')$$,
  'a member can pull their own discovery feed'
);

-- ---------------------------------------------------------------------------
-- What the view includes and excludes.
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.public_profiles),
  19::bigint,
  'the view returns the twenty discoverable profiles less the caller'
);

select ok(
  not exists (
    select 1 from public.public_profiles
    where id = '11111111-1111-4111-8111-111111111111'
  ),
  'the view never returns the caller'
);

select ok(
  not exists (
    select 1 from public.public_profiles
    where id = '20000000-0000-4000-8000-000000000021'
  ),
  'a profile that never finished signing up is not discoverable'
);

select ok(
  not exists (
    select 1 from public.public_profiles
    where id = '20000000-0000-4000-8000-000000000005'
  ),
  'a banned member is not discoverable'
);

-- ---------------------------------------------------------------------------
-- Blocking, in both directions. Blocking is symmetric in the view because
-- either party not wanting to see the other is sufficient reason.
-- ---------------------------------------------------------------------------
reset role;

insert into public.blocks (blocker_id, blocked_id)
values ('20000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111');

set local role authenticated;

select is(
  (select count(*) from public.public_profiles),
  18::bigint,
  'a member who blocked the caller drops out of their view'
);

reset role;

-- And the other direction: the caller blocked them. Both sides have to be
-- filtered, or blocking only half works and is worse than not blocking at all.
delete from public.blocks
 where blocker_id = '20000000-0000-4000-8000-000000000002';

insert into public.blocks (blocker_id, blocked_id)
values ('11111111-1111-4111-8111-111111111111', '20000000-0000-4000-8000-000000000002');

set local role authenticated;

select is(
  (select count(*) from public.public_profiles),
  18::bigint,
  'a member the caller blocked drops out of their view too'
);

select ok(
  not exists (
    select 1 from public.public_profiles
    where id = '20000000-0000-4000-8000-000000000002'
  ),
  'and it is that member specifically'
);

reset role;

delete from public.blocks
 where blocker_id = '11111111-1111-4111-8111-111111111111';

set local role authenticated;

select is(
  (select count(*) from public.public_profiles),
  19::bigint,
  'unblocking restores them'
);

-- ---------------------------------------------------------------------------
-- What the view publishes. Not a claim about which columns exist — a claim about
-- the values, read out of the relation itself, so a same-named column could not
-- smuggle something through.
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(column_name::text order by column_name)
     from information_schema.columns
     where table_schema = 'public' and table_name = 'public_profiles'),
  array['age', 'bio', 'distance_km', 'full_name', 'gender', 'id',
        'interested_in', 'is_online', 'last_active', 'location_city',
        'location_country', 'photos']::text[],
  'the view publishes exactly the twelve expected columns'
);

select ok(
  not exists (
    select 1
    from public.public_profiles pp
    where to_jsonb(pp) ?| array['email', 'latitude', 'longitude',
                                'date_of_birth', 'is_banned', 'is_admin',
                                'is_verified', 'age_verified', 'phone_verified',
                                'whatsapp_number']
  ),
  'no row of the view carries an email, coordinate, birth date or flag'
);

-- ---------------------------------------------------------------------------
-- Coordinates and distance. Coordinates are rounded to two decimals before they
-- are stored, which bounds precision to roughly a kilometre; the view publishes
-- distance to one decimal, and never the coordinates themselves.
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.profiles
    where (latitude is not null and latitude <> round(latitude, 2))
       or (longitude is not null and longitude <> round(longitude, 2))),
  0::bigint,
  'no stored coordinate has more precision than two decimals'
);

-- A three-decimal value is rounded on the way in, not rejected.
select lives_ok(
  $$update public.profiles set latitude = 19.0764
     where id = '11111111-1111-4111-8111-111111111111'$$,
  'a precise coordinate is accepted'
);

select is(
  (select latitude from public.profiles
    where id = '11111111-1111-4111-8111-111111111111'),
  19.08::numeric,
  'and is rounded to two decimals before storage'
);

-- distance_km is published, but to one decimal, so it is a band and not a fix.
select ok(
  not exists (
    select 1 from public.public_profiles
    where distance_km is not null and distance_km <> round(distance_km, 1)
  ),
  'the published distance carries one decimal, not a precise figure'
);

-- A member who sets show_distance = false is not publishing their position.
select is(
  (select distance_km from public.public_profiles
    where id = '20000000-0000-4000-8000-000000000020'),
  null::numeric,
  'a member who hides their distance is published with a null distance'
);

select ok(
  exists (
    select 1 from public.public_profiles where distance_km is not null
  ),
  'other members in the same feed still carry a distance'
);

-- The caller's own privacy preference withholds distance for the whole feed.
reset role;
update public.user_preferences
   set privacy = jsonb_set(privacy, '{show_distance}', 'false')
 where user_id = '11111111-1111-4111-8111-111111111111';
set local role authenticated;

select is(
  (select count(*) from public.public_profiles where distance_km is not null),
  0::bigint,
  'a caller who hides their own distance gets no distances for anyone'
);

reset role;
update public.user_preferences
   set privacy = jsonb_set(privacy, '{show_distance}', 'true')
 where user_id = '11111111-1111-4111-8111-111111111111';
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Radius. The demo member sits in Mumbai at 19.08/72.88. Two members make the
-- test meaningful: 0002 is about 5 km away in Mumbai and 0014 is over 1,300 km
-- away in Kolkata, so a tight radius has to keep one and drop the other.
-- Without both, "the radius works" would also be satisfied by a search that
-- returns nothing at all.
-- ---------------------------------------------------------------------------
select is(
  (select distance_km from public.search_profiles_by_distance(19.08, 72.88, 25)
    where id = '20000000-0000-4000-8000-000000000002'),
  5.4::numeric,
  'the near fixture really is about 5 km from the caller'
);

-- A band rather than an exact figure, so the assertion is about the fixture
-- being genuinely distant rather than about one hardcoded float.
select ok(
  (select distance_km from public.search_profiles_by_distance(19.08, 72.88, 2000)
    where id = '20000000-0000-4000-8000-000000000014') > 1000,
  'the far fixture really is over a thousand kilometres away'
);

select ok(
  exists (
    select 1 from public.search_profiles_by_distance(19.08, 72.88, 25)
    where id = '20000000-0000-4000-8000-000000000002'
  ),
  'a member 5 km away is inside a 25 km radius'
);

select ok(
  not exists (
    select 1 from public.search_profiles_by_distance(19.08, 72.88, 25)
    where id = '20000000-0000-4000-8000-000000000014'
  ),
  'a member over a thousand kilometres away is outside a 25 km radius'
);

select ok(
  exists (
    select 1 from public.search_profiles_by_distance(19.08, 72.88, 2000)
    where id = '20000000-0000-4000-8000-000000000014'
  ),
  'and inside a 2,000 km radius'
);

select ok(
  not exists (
    select 1 from public.search_profiles_by_distance(19.08, 72.88, 2000)
    where id = '11111111-1111-4111-8111-111111111111'
  ),
  'a distance search never returns the caller'
);

-- The radius is a hard filter on the returned rows, not a display hint.
select ok(
  not exists (
    select 1
    from public.search_profiles_by_distance(19.08, 72.88, 25) s
    where s.distance_km > 25
  ),
  'every row returned by a 25 km search is within 25 km'
);

-- A banned member is excluded from a distance search too, not only from the view.
select ok(
  not exists (
    select 1 from public.search_profiles_by_distance(19.08, 72.88, 2000)
    where id = '20000000-0000-4000-8000-000000000005'
  ),
  'a banned member is not returned by a distance search'
);

-- Out-of-range arguments are refused rather than silently returning nothing.
select throws_like(
  $$select * from public.search_profiles_by_distance(19.08, 72.88, 0)$$,
  '%Radius must be greater than zero%',
  'a zero radius is rejected'
);

select throws_like(
  $$select * from public.search_profiles_by_distance(91, 72.88, 50)$$,
  '%Latitude must be between%',
  'a latitude outside the globe is rejected'
);

select throws_like(
  $$select * from public.search_profiles_by_distance(19.08, 181, 50)$$,
  '%Longitude must be between%',
  'a longitude outside the globe is rejected'
);

-- ---------------------------------------------------------------------------
-- Distance search is gated on the caller's own preference, so turning the
-- setting off turns the feature off rather than quietly returning nothing.
-- ---------------------------------------------------------------------------
reset role;
update public.profiles set show_distance = false
 where id = '11111111-1111-4111-8111-111111111111';
set local role authenticated;

select throws_like(
  $$select * from public.search_profiles_by_distance(19.08, 72.88, 50)$$,
  '%Distance search is turned off%',
  'a member who has hidden their distance cannot run a distance search'
);

select * from finish();
rollback;

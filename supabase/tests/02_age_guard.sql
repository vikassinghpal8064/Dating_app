-- 02 — The 18+ rule.
--
-- The product promise is 18+ only, and it is enforced in the database rather
-- than only in the form. This file proves the guard is on every write path and
-- cannot be lowered by a later edit, which is the failure mode a client-only
-- check always has.
--
-- The minimum age cannot be a CHECK constraint: Postgres rejects a CHECK that
-- references current_date, because a CHECK must be immutable. So it lives in
-- the profiles_prepare_write trigger, and these tests exercise that trigger
-- directly — as the database owner and as a signed-in member, because the guard
-- has to hold for both.
--
-- The whole file runs in one transaction and is rolled back, so the fixtures
-- below never outlive it.
--
-- Note on throws_like: pgTAP matches the pattern as a SQL LIKE pattern against
-- the error message, not as a regular expression, so `_` and `%` are the only
-- wildcards available. Every pattern is therefore wrapped in % rather than .*.

create extension if not exists pgtap with schema extensions;

begin;
select plan(17);

-- ---------------------------------------------------------------------------
-- Fixtures. Each auth.users insert fires on_auth_user_created, which leaves a
-- placeholder profile row behind. Those placeholders are removed so the
-- profiles INSERT branch of the guard is reachable: in production that branch
-- is only ever taken by a server write, because the sign-up trigger has already
-- created the row by the time the member fills the form in. The UPDATE branch
-- below is the one a member actually hits.
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'seventeen@local.test', crypt('local-seed-only', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'eighteen@local.test', crypt('local-seed-only', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'tomorrow@local.test', crypt('local-seed-only', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'ancient@local.test', crypt('local-seed-only', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000000',
   'a0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
   'grower@local.test', crypt('local-seed-only', gen_salt('bf')),
   now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

delete from public.profiles
 where id in (
   'a0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000003',
   'a0000000-0000-4000-8000-000000000004',
   'a0000000-0000-4000-8000-000000000005'
 );

-- ---------------------------------------------------------------------------
-- INSERT path, as the database owner.
-- ---------------------------------------------------------------------------

-- Seventeen years and a day short of the threshold, written as an interval so
-- the test does not rot on a fixed calendar date.
select throws_like(
  $$insert into public.profiles (id, full_name, date_of_birth, location_city)
    values ('a0000000-0000-4000-8000-000000000001', 'Seventeen',
            (current_date - interval '17 years 1 day')::date, 'Mumbai')$$,
  '%You must be at least 18 years old to use this app%',
  'inserting a seventeen year old is rejected'
);

select lives_ok(
  $$insert into public.profiles (id, full_name, date_of_birth, location_city)
    values ('a0000000-0000-4000-8000-000000000002', 'Exactly Eighteen',
            (current_date - interval '18 years')::date, 'Mumbai')$$,
  'a member who turned eighteen today is accepted'
);

select throws_like(
  $$insert into public.profiles (id, full_name, date_of_birth, location_city)
    values ('a0000000-0000-4000-8000-000000000003', 'From Tomorrow',
            (current_date + interval '1 day')::date, 'Mumbai')$$,
  '%Date of birth cannot be in the future%',
  'a date of birth in the future is rejected'
);

-- 1700 is old enough to pass the trigger and has to be caught by the CHECK.
select throws_like(
  $$insert into public.profiles (id, full_name, date_of_birth, location_city)
    values ('a0000000-0000-4000-8000-000000000004', 'Ancient',
            date '1700-01-01', 'Mumbai')$$,
  '%violates check constraint "profiles_dob_is_plausible"%',
  'a birth date outside the plausible range is rejected by the CHECK'
);

-- The one that is allowed to exist, and the one every later test starts from.
insert into public.profiles (id, full_name, date_of_birth, location_city)
values ('a0000000-0000-4000-8000-000000000005', 'Adult',
        (current_date - interval '25 years')::date, 'Pune');

-- ---------------------------------------------------------------------------
-- The guard must not be a client-only check. A server-side write, a migration, a
-- moderation script or a SECURITY DEFINER function all run as the owner, so the
-- age rule has to be unconditional rather than part of the member-write branch.
-- ---------------------------------------------------------------------------
select throws_like(
  $$update public.profiles
       set date_of_birth = (current_date - interval '16 years')::date
     where id = 'a0000000-0000-4000-8000-000000000002'$$,
  '%You must be at least 18 years old to use this app%',
  'a server-side write cannot backdate someone below eighteen'
);

-- ---------------------------------------------------------------------------
-- UPDATE path. This is the one that matters: the row is created empty by the
-- sign-up trigger, so the birth date always arrives on a later write, and
-- nothing may stop a member setting it once and then lowering it again.
-- ---------------------------------------------------------------------------
select throws_like(
  $$update public.profiles
       set date_of_birth = (current_date - interval '15 years')::date
     where id = 'a0000000-0000-4000-8000-000000000002'$$,
  '%You must be at least 18 years old to use this app%',
  'a later edit cannot lower an age below eighteen'
);

select lives_ok(
  $$update public.profiles
       set date_of_birth = (current_date - interval '30 years')::date
     where id = 'a0000000-0000-4000-8000-000000000002'$$,
  'the same edit to a valid adult date succeeds'
);

-- ---------------------------------------------------------------------------
-- The same guard, reached as a signed-in member rather than as the owner, so
-- the trigger is proved to fire under the role PostgREST actually uses.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_like(
  $$update public.profiles
       set date_of_birth = (current_date - interval '17 years')::date
     where id = 'a0000000-0000-4000-8000-000000000005'$$,
  '%You must be at least 18 years old to use this app%',
  'a signed-in member cannot set their own birth date below eighteen'
);

select lives_ok(
  $$update public.profiles
       set date_of_birth = (current_date - interval '18 years')::date
     where id = 'a0000000-0000-4000-8000-000000000005'$$,
  'a signed-in member can set their own birth date to their eighteenth birthday'
);

reset role;

-- ---------------------------------------------------------------------------
-- calculate_age is what the public view publishes, so it has to be a count of
-- completed years and not a simple year subtraction. Two members born a day
-- apart either side of a birthday are the whole test.
-- ---------------------------------------------------------------------------
select is(
  public.calculate_age((current_date - interval '26 years 6 months')::date::text),
  26::integer,
  'calculate_age counts completed years, not elapsed ones'
);

select is(
  public.calculate_age((current_date - interval '18 years')::date::text),
  18::integer,
  'calculate_age reports exactly eighteen on the eighteenth birthday'
);

-- One day short of the eighteenth birthday: the date on which they turn eighteen
-- is tomorrow, so today they are still seventeen. This is the boundary the
-- trigger's `> (current_date - interval '18 years')` test turns on, so it is
-- worth pinning from both sides.
select is(
  public.calculate_age((current_date - interval '18 years' + interval '1 day')::date::text),
  17::integer,
  'calculate_age reports seventeen the day before the eighteenth birthday'
);

select is(
  public.calculate_age(null),
  0::integer,
  'calculate_age is safe on a profile with no birth date'
);

select is(
  public.calculate_age((current_date + interval '5 years')::date::text),
  0::integer,
  'calculate_age will not return a negative age for a future date'
);

-- ---------------------------------------------------------------------------
-- The seeded data is held to the same rule, so a bad fixture fails here rather
-- than being discovered in the browser.
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.profiles
    where date_of_birth is not null
      and date_of_birth > (current_date - interval '18 years')::date),
  0::bigint,
  'no seeded profile is under eighteen'
);

select ok(
  (select min(public.calculate_age(date_of_birth::text))
     from public.profiles where date_of_birth is not null) >= 18,
  'the youngest seeded member is at least eighteen'
);

-- The accepted row has a name, a birth date and a city, so the derived
-- visibility flag put it into discovery rather than leaving it stranded.
select is(
  (select is_visible from public.profiles
    where id = 'a0000000-0000-4000-8000-000000000002'),
  true,
  'a profile that passes the age gate becomes visible to discovery'
);

select * from finish();
rollback;

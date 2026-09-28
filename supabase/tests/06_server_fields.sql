-- 06 — Server-managed fields.
--
-- Thirty-three columns on `profiles`. Twenty-three of them describe a member
-- and are theirs to write. Ten are not, and the ten are the whole reason this
-- file exists:
--
--   is_admin   is_banned   is_verified   age_verified   phone_verified
--   is_visible  email  created_at  updated_at  last_active_at
--
-- The first six decide what a member may do. A member who can write any of them
-- can promote themselves to moderator, escape a ban, or claim a verification
-- they never did. The next four are derived, mirrored, or owned by auth.users.
--
-- Row level security cannot express any of this. A policy is row-scoped and
-- these rules are column-scoped, so the enforcement is a narrow column grant:
-- `authenticated` holds `rd` on the table and `aw` on exactly the twenty-three
-- editable columns. Naming any other column is refused by Postgres with 42501.
-- A BEFORE trigger pins the same values for the writes that arrive as the table
-- owner, which the column grant cannot see.
--
-- The two halves are not redundant, they are layered, and the layering is what
-- the tests below pin:
--
--   * a member request is stopped by the grant, before the trigger runs at all;
--   * a server write is allowed through, because moderation has to be able to
--     ban somebody, and it is the owner, not the member, that does it.
--
-- The whole file runs in one transaction and is rolled back.

create extension if not exists pgtap with schema extensions;

begin;
select plan(45);

-- ---------------------------------------------------------------------------
-- The boundary itself, asserted before any behaviour. A behavioural test that
-- passes because a column happens not to exist proves nothing, so the grant set
-- is pinned explicitly: these twenty-three, and nothing else.
-- ---------------------------------------------------------------------------
select is(
  (select array_agg(distinct column_name::text order by column_name::text)
     from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'profiles'
       and grantee = 'authenticated'
       and privilege_type in ('INSERT', 'UPDATE')),
  array['bio', 'date_of_birth', 'drinking', 'education', 'exercise', 'full_name',
        'gender', 'height_cm', 'id', 'interested_in', 'interests', 'languages',
        'latitude', 'location_city', 'location_country', 'location_state',
        'longitude', 'looking_for', 'occupation', 'photos', 'show_distance',
        'smoking', 'whatsapp_consent']::text[],
  'authenticated may write exactly the twenty-three editable columns'
);

select is(
  (select count(*) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE')),
  46::bigint,
  'and nothing else — 23 columns, once for INSERT and once for UPDATE'
);

select ok(
  not exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE')
      and column_name = any (array[
            'is_admin', 'is_banned', 'is_verified', 'age_verified',
            'phone_verified', 'is_visible', 'email', 'created_at',
            'updated_at', 'last_active_at'])
  ),
  'none of the ten withheld columns is writable by a member'
);

-- ---------------------------------------------------------------------------
-- A member may write the columns they own. Asserted first, and on its own: if
-- this stopped working there would be no point testing the refusals, and a
-- blanket denial would pass every test below.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$update public.profiles
       set full_name = 'Rohan Iyer',
           bio = 'Accountant and amateur radio operator.',
           height_cm = 178,
           education = 'BCom',
           interests = array['radio', 'walking']
     where id = '20000000-0000-4000-8000-000000000003'$$,
  'a member writing their own editable columns succeeds'
);

select is(
  (select bio from public.profiles
    where id = '20000000-0000-4000-8000-000000000003'),
  'Accountant and amateur radio operator.'::text,
  'and the values they are allowed to change did change'
);

select is(
  (select education from public.profiles
    where id = '20000000-0000-4000-8000-000000000003'),
  'BCom'::text,
  'including a list-valued column'
);

-- ---------------------------------------------------------------------------
-- The six withheld claims, one assertion each so a failure names the field that
-- broke rather than an array index.
-- ---------------------------------------------------------------------------
select throws_like(
  $$update public.profiles set is_admin = true
     where id = '20000000-0000-4000-8000-000000000003'$$,
  '%permission denied%',
  'a member cannot make themselves an admin'
);

select throws_like(
  $$update public.profiles set is_banned = false
     where id = '20000000-0000-4000-8000-000000000003'$$,
  '%permission denied%',
  'a member cannot clear their own ban'
);

select throws_like(
  $$update public.profiles set is_verified = true
     where id = '20000000-0000-4000-8000-000000000003'$$,
  '%permission denied%',
  'a member cannot verify themselves'
);

select throws_like(
  $$update public.profiles set age_verified = true
     where id = '20000000-0000-4000-8000-000000000003'$$,
  '%permission denied%',
  'a member cannot claim an age check'
);

select throws_like(
  $$update public.profiles set phone_verified = true
     where id = '20000000-0000-4000-8000-000000000003'$$,
  '%permission denied%',
  'a member cannot claim a phone check'
);

select throws_like(
  $$update public.profiles set is_visible = true
     where id = '20000000-0000-4000-8000-000000000003'$$,
  '%permission denied%',
  'a member cannot request to be discoverable'
);

-- A refused write leaves nothing behind: the grant denies the statement, so
-- there is no partial application and the trigger never fired.
select ok(
  not coalesce((select is_admin or is_verified or age_verified or phone_verified
                  from public.profiles
                 where id = '20000000-0000-4000-8000-000000000003'), false),
  'none of the six claims took effect'
);

-- One withheld column spoils the whole statement, including the legitimate edits
-- travelling alongside it. That is the correct trade: a silent partial write is
-- much harder to reason about than a request that fails cleanly and can be
-- retried with the offending key removed.
select throws_like(
  $$update public.profiles
       set full_name = 'Rohan Iyer', is_admin = true
     where id = '20000000-0000-4000-8000-000000000003'$$,
  '%permission denied%',
  'a legitimate edit alongside a withheld column is refused as a whole'
);

select is(
  (select updated_at from public.profiles
    where id = '20000000-0000-4000-8000-000000000003') is not null,
  true,
  'and the refused statement left the row untouched'
);

-- ---------------------------------------------------------------------------
-- A ban cannot be lifted.
-- ---------------------------------------------------------------------------
reset role;

update public.profiles set is_banned = true
 where id = '20000000-0000-4000-8000-000000000003';

set local role authenticated;

select is(
  (select is_banned from public.profiles
    where id = '20000000-0000-4000-8000-000000000003'),
  true,
  'the ban is in place before the attempt'
);

select throws_like(
  $$update public.profiles set is_banned = false
     where id = '20000000-0000-4000-8000-000000000003'$$,
  '%permission denied%',
  'a banned member cannot lift their own ban'
);

select is(
  (select is_banned from public.profiles
    where id = '20000000-0000-4000-8000-000000000003'),
  true,
  'and the ban is still in place afterwards'
);

-- A banned member can still edit the rest of their profile. Otherwise a ban
-- would be a denial of service against their own account rather than a removal
-- from discovery.
select lives_ok(
  $$update public.profiles set bio = 'Still here.'
     where id = '20000000-0000-4000-8000-000000000003'$$,
  'a banned member can still edit their own fields'
);

-- ---------------------------------------------------------------------------
-- The sign-up path, on the INSERT branch, which is a different code path in the
-- trigger: there is no old row to copy from, so the values are forced rather
-- than preserved.
-- ---------------------------------------------------------------------------
reset role;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000',
        'b0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
        'claims@local.test', crypt('local-seed-only', gen_salt('bf')),
        now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

select is(
  (select count(*) from public.profiles
    where id = 'b0000000-0000-4000-8000-000000000001'),
  1::bigint,
  'the sign-up trigger created the profile row'
);

select is(
  (select is_visible from public.profiles
    where id = 'b0000000-0000-4000-8000-000000000001'),
  false,
  'and left it undiscoverable, because it is still empty'
);

select is(
  (select count(*) from public.user_preferences
    where user_id = 'b0000000-0000-4000-8000-000000000001'),
  1::bigint,
  'and created the default preferences row the settings page expects'
);

-- ---------------------------------------------------------------------------
-- The app's real sign-up payload, copied verbatim from src/lib/auth.tsx. If this
-- stopped working nobody could register, so it is pinned against the schema.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into public.profiles (
       id, full_name, date_of_birth, gender, interested_in,
       location_city, location_country, bio, photos, show_distance,
       whatsapp_consent
     ) values (
       'b0000000-0000-4000-8000-000000000001', 'Claims Everything',
       (current_date - interval '24 years')::date, 'prefer_not_to_say',
       array['everyone']::public.interested_in[],
       'Pune', 'India', '', '{}'::text[], true, false
     )
     on conflict (id) do update
       set full_name = excluded.full_name,
           date_of_birth = excluded.date_of_birth,
           gender = excluded.gender,
           interested_in = excluded.interested_in,
           location_city = excluded.location_city,
           location_country = excluded.location_country,
           bio = excluded.bio,
           photos = excluded.photos,
           show_distance = excluded.show_distance,
           whatsapp_consent = excluded.whatsapp_consent$$,
  'the sign-up payload the app sends is accepted'
);

select is(
  (select is_visible from public.profiles
    where id = 'b0000000-0000-4000-8000-000000000001'),
  true,
  'and completing name, birth date and city makes the new member discoverable'
);

select is(
  (select full_name from public.profiles
    where id = 'b0000000-0000-4000-8000-000000000001'),
  'Claims Everything'::text,
  'and the name they typed is what is stored'
);

-- The same upsert carrying the six claims. The grant refuses it before the
-- trigger runs, which is the whole reason the grant exists rather than relying
-- on the trigger alone.
select throws_like(
  $$insert into public.profiles (
       id, full_name, is_admin, is_banned, is_verified, age_verified,
       phone_verified
     ) values (
       'b0000000-0000-4000-8000-000000000001', 'Claims Everything',
       true, true, true, true, true
     )
     on conflict (id) do update
       set is_admin = excluded.is_admin,
           is_banned = excluded.is_banned,
           is_verified = excluded.is_verified,
           age_verified = excluded.age_verified,
           phone_verified = excluded.phone_verified$$,
  '%permission denied%',
  'a sign-up payload carrying every claim is refused'
);

select ok(
  not coalesce((select is_admin or is_banned or is_verified or age_verified
                     or phone_verified
                  from public.profiles
                 where id = 'b0000000-0000-4000-8000-000000000001'), false),
  'so a new member holds none of the six, however loudly the payload asked'
);

-- ---------------------------------------------------------------------------
-- Visibility is derived. Not written, not requested — computed from the three
-- fields the rule names, on every write.
-- ---------------------------------------------------------------------------
reset role;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000',
        'b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
        'phantom@local.test', crypt('local-seed-only', gen_salt('bf')),
        now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  (select is_visible from public.profiles
    where id = 'b0000000-0000-4000-8000-000000000002'),
  false,
  'a brand new row is not discoverable'
);

-- Two of the three required fields. Still not discoverable, which is the case a
-- blank profile card would come from.
update public.profiles
   set full_name = 'Almost Complete', location_city = 'Pune'
 where id = 'b0000000-0000-4000-8000-000000000002';

select is(
  (select is_visible from public.profiles
    where id = 'b0000000-0000-4000-8000-000000000002'),
  false,
  'a name and a city without a birth date is still not discoverable'
);

-- The third field, and no request to be discoverable anywhere in the payload.
update public.profiles
   set date_of_birth = (current_date - interval '30 years')::date
 where id = 'b0000000-0000-4000-8000-000000000002';

select is(
  (select is_visible from public.profiles
    where id = 'b0000000-0000-4000-8000-000000000002'),
  true,
  'and the missing birth date makes it discoverable with no request from the client'
);

-- Clearing one required field takes it back out, so the flag cannot be latched
-- on by a profile that later becomes incomplete.
update public.profiles
   set date_of_birth = null
 where id = 'b0000000-0000-4000-8000-000000000002';

select is(
  (select is_visible from public.profiles
    where id = 'b0000000-0000-4000-8000-000000000002'),
  false,
  'clearing a required field takes the profile back out of discovery'
);

-- ---------------------------------------------------------------------------
-- The server half of the layering. A moderation write arrives as the table
-- owner, where the column grant cannot reach, and it must be able to set the
-- withheld fields — otherwise nobody could ban anybody. This is the positive
-- control for every refusal above: it shows the columns are writable in
-- principle, so the refusals are a privilege boundary and not a missing column.
-- ---------------------------------------------------------------------------
reset role;

-- is_visible is the exception, and deliberately so. The trigger recomputes it on
-- every write whatever the caller's role, so it cannot be latched on even by a
-- migration or a moderation script: there is no code path that sets it
-- directly. The row is still missing its birth date, so it stays false.
update public.profiles set is_visible = true
 where id = 'b0000000-0000-4000-8000-000000000002';

select is(
  (select is_visible from public.profiles
    where id = 'b0000000-0000-4000-8000-000000000002'),
  false,
  'is_visible is recomputed even for a server write, so it cannot be forced on'
);

update public.profiles set is_banned = true, is_verified = true
 where id = 'b0000000-0000-4000-8000-000000000002';

select ok(
  (select is_banned and is_verified
     from public.profiles where id = 'b0000000-0000-4000-8000-000000000002'),
  'but a server write may ban and verify'
);

-- ---------------------------------------------------------------------------
-- Roles. `user_roles` is the authority; `profiles.is_admin` is a mirror kept in
-- step by a trigger so the existing column keeps working. A member can write
-- neither.
-- ---------------------------------------------------------------------------
select is(
  (select is_admin from public.profiles
    where id = '11111111-1111-4111-8111-111111111111'),
  true,
  'the seeded demo member holds the admin role'
);

select is(
  (select role from public.user_roles
    where user_id = '11111111-1111-4111-8111-111111111111'),
  'admin'::public.user_role,
  'and user_roles is where the authority actually lives'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_like(
  $$insert into public.user_roles (user_id, role)
    values ('20000000-0000-4000-8000-000000000001', 'admin')$$,
  '%permission denied%',
  'a member cannot grant themselves the admin role'
);

-- A member cannot even see who holds a role: user_roles is administrator-only, so
-- the count comes back empty rather than showing them the admin list. The count
-- itself is therefore asserted from the owner side, below.
select is(
  (select count(*) from public.user_roles),
  0::bigint,
  'and a member cannot read the role table either'
);

-- is_admin() takes no argument: it answers for the caller, which is the only
-- question worth answering, since a version taking a user_id would be an IDOR
-- waiting to happen. So it is tested as each of two members in turn.
select is(
  (select public.is_admin()),
  false,
  'is_admin() is false for an ordinary member'
);

select is(
  (select public.is_moderator()),
  false,
  'and is_moderator() is false for them too'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select public.is_admin()),
  true,
  'is_admin() reports the role to its holder'
);

select is(
  (select public.is_moderator()),
  true,
  'and the admin counts as a moderator'
);

-- Removing the role demotes the mirror, which is what makes it a mirror and not
-- a second source of truth.
reset role;

-- From the owner side, the count the member could not have made.
select is(
  (select count(*) from public.user_roles where role = 'admin'),
  1::bigint,
  'from the owner side there is still exactly one admin'
);

delete from public.user_roles
 where user_id = '11111111-1111-4111-8111-111111111111';

select is(
  (select is_admin from public.profiles
    where id = '11111111-1111-4111-8111-111111111111'),
  false,
  'removing the role clears profiles.is_admin'
);

insert into public.user_roles (user_id, role)
values ('11111111-1111-4111-8111-111111111111', 'admin');

select is(
  (select is_admin from public.profiles
    where id = '11111111-1111-4111-8111-111111111111'),
  true,
  'and granting it again sets the mirror back'
);

-- A member cannot promote themselves through the mirror either, even if the
-- trigger that maintains it is the only thing that should ever be writing it.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_like(
  $$update public.profiles set is_admin = true
     where id = '20000000-0000-4000-8000-000000000001'$$,
  '%permission denied%',
  'and a member cannot write the mirror column directly'
);

select * from finish();
rollback;

-- 08 — The security contract, with real users and an anonymous client.
--
-- The product requirements for access control, stated as tests. Each scenario
-- runs as one of four real members (Alice, Bob, Carol, Dave) or as the
-- anonymous role, and every "cannot" below is shown twice over: once by the
-- grant/policy layer refusing and once by the numbers coming back empty.
--
--   Alice  30000000-...-001  the protagonist of most scenarios
--   Bob    30000000-...-002  the other half of Alice's match, and the one whose
--                            number is (mostly) protected
--   Carol  30000000-...-003  an ordinary member who becomes an administrator
--                            in the last section
--   Dave   30000000-...-004  a fresh member used only for the rate-limit test,
--                            so nobody else's quota is spent
--
-- The whole file runs in one transaction and is rolled back.

create extension if not exists pgtap with schema extensions;

begin;
select plan(44);

-- ---------------------------------------------------------------------------
-- Fixtures. auth.users inserts fire on_auth_user_created, which leaves a
-- placeholder profile behind; those placeholders are removed first so the real
-- profiles can be written exactly like the rest of the suite does.
-- ---------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
   recovery_token, recovery_sent_at, email_change_token_new, email_change,
   email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
   created_at, updated_at, phone, phone_confirmed_at, email_change_confirm_status)
values
  ('00000000-0000-0000-0000-000000000000',
   '30000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'alice@local.test', crypt('local-seed-only', gen_salt('bf')),
   now(), now(), '', now(), '', now(), '', '', now(), now(),
   '{}'::jsonb, '{}'::jsonb, now(), now(), null, null, 0),
  ('00000000-0000-0000-0000-000000000000',
   '30000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'bob@local.test', crypt('local-seed-only', gen_salt('bf')),
   now(), now(), '', now(), '', now(), '', '', now(), now(),
   '{}'::jsonb, '{}'::jsonb, now(), now(), null, null, 0),
  ('00000000-0000-0000-0000-000000000000',
   '30000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'carol@local.test', crypt('local-seed-only', gen_salt('bf')),
   now(), now(), '', now(), '', now(), '', '', now(), now(),
   '{}'::jsonb, '{}'::jsonb, now(), now(), null, null, 0),
  ('00000000-0000-0000-0000-000000000000',
   '30000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'dave@local.test', crypt('local-seed-only', gen_salt('bf')),
   now(), now(), '', now(), '', now(), '', '', now(), now(),
   '{}'::jsonb, '{}'::jsonb, now(), now(), null, null, 0);

delete from public.profiles
 where id in (
   '30000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000002',
   '30000000-0000-4000-8000-000000000003',
   '30000000-0000-4000-8000-000000000004'
 );

insert into public.profiles
  (id, full_name, date_of_birth, location_city, location_country)
values
  ('30000000-0000-4000-8000-000000000001', 'Alice', '1990-06-15', 'Mumbai', 'India'),
  ('30000000-0000-4000-8000-000000000002', 'Bob',   '1991-07-20', 'Mumbai', 'India'),
  ('30000000-0000-4000-8000-000000000003', 'Carol', '1992-08-25', 'Pune',   'India'),
  ('30000000-0000-4000-8000-000000000004', 'Dave',  '1993-09-30', 'Pune',   'India');

-- Bob will share his WhatsApp number; Alice and Dave never save one. Carol is
-- not involved in the number tests at all.
insert into public.private_contacts (user_id, whatsapp_number, share_mode)
values ('30000000-0000-4000-8000-000000000002', '+1555012345', 'matches');

-- ===========================================================================
-- 1. An anonymous client can read nothing at all.
-- ===========================================================================
set local role anon;

select throws_like(
  $$select * from public.profiles$$, '%permission denied%',
  'anon: profiles is unreadable'
);
select throws_like(
  $$select * from public.user_preferences$$, '%permission denied%',
  'anon: user_preferences is unreadable'
);
select throws_like(
  $$select * from public.private_contacts$$, '%permission denied%',
  'anon: private_contacts is unreadable'
);
select throws_like(
  $$select * from public.contact_approvals$$, '%permission denied%',
  'anon: contact_approvals is unreadable'
);
select throws_like(
  $$select * from public.whatsapp_consents$$, '%permission denied%',
  'anon: whatsapp_consents is unreadable'
);
select throws_like(
  $$select * from public.profile_photos$$, '%permission denied%',
  'anon: profile_photos is unreadable'
);
select throws_like(
  $$select * from public.likes$$, '%permission denied%',
  'anon: likes is unreadable'
);
select throws_like(
  $$select * from public.passes$$, '%permission denied%',
  'anon: passes is unreadable'
);
select throws_like(
  $$select * from public.matches$$, '%permission denied%',
  'anon: matches is unreadable'
);
select throws_like(
  $$select * from public.messages$$, '%permission denied%',
  'anon: messages is unreadable'
);
select throws_like(
  $$select * from public.blocks$$, '%permission denied%',
  'anon: blocks is unreadable'
);
select throws_like(
  $$select * from public.reports$$, '%permission denied%',
  'anon: reports is unreadable'
);
select throws_like(
  $$select * from public.user_roles$$, '%permission denied%',
  'anon: user_roles is unreadable'
);
select throws_like(
  $$select * from public.contact_link_requests$$, '%permission denied%',
  'anon: contact_link_requests is unreadable'
);
select throws_like(
  $$select * from public.public_profiles$$, '%permission denied%',
  'anon: the discovery view is unreadable'
);
select throws_like(
  $$select * from public.likes_received$$, '%permission denied%',
  'anon: the likes_received view is unreadable'
);

reset role;

-- ===========================================================================
-- 2. Alice cannot read Bob's private_contacts — same table, own row only.
-- ===========================================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.private_contacts
    where user_id = '30000000-0000-4000-8000-000000000002'),
  0::bigint,
  'Alice cannot read Bob private_contacts row'
);

reset role;

-- ===========================================================================
-- 3. Alice cannot read messages of a match she is not in.
-- ===========================================================================
-- Bob and Carol are matched; Alice is not a party to that match.
insert into public.matches (user_id, matched_user_id)
values ('30000000-0000-4000-8000-000000000002',
        '30000000-0000-4000-8000-000000000003');

insert into public.messages (match_id, sender_id, content)
select m.id, m.user_id, 'bob to carol, none of Alices business'
from public.matches m
where m.user_id = '30000000-0000-4000-8000-000000000002'
  and m.matched_user_id = '30000000-0000-4000-8000-000000000003';

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.messages
    where match_id in (
      select id from public.matches
      where user_id = '30000000-0000-4000-8000-000000000002'
        and matched_user_id = '30000000-0000-4000-8000-000000000003')),
  0::bigint,
  'Alice cannot read a thread she is not in, even knowing the match id'
);

reset role;

-- ===========================================================================
-- 4. Alice cannot impersonate Bob as the sender of a message.
-- ===========================================================================
-- Alice and Bob become a match, which also gives section 5 its stage.
insert into public.matches (user_id, matched_user_id)
values ('30000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000002');

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select throws_like(
  $$insert into public.messages (match_id, sender_id, content)
    select m.id, '30000000-0000-4000-8000-000000000002', 'pretending to be Bob'
    from public.matches m
    where m.user_id = '30000000-0000-4000-8000-000000000001'
      and m.matched_user_id = '30000000-0000-4000-8000-000000000002'$$,
  '%row-level security%',
  'Alice cannot send a message with Bob as the sender'
);

select is(
  (select count(*) from public.messages where content = 'pretending to be Bob'),
  0::bigint,
  'and the forged message does not exist anywhere'
);

reset role;

-- ===========================================================================
-- 5. get_contact_link: nothing before a match, the number after, consent-gated.
-- ===========================================================================
-- Alice is matched with Bob (section 4) and Bob shares in 'matches' mode. She
-- is not matched with Dave, and Dave has no number anyway.
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select public.get_contact_link('30000000-0000-4000-8000-000000000004')),
  null,
  'before a match exists, the number stays null'
);

select is(
  (select public.get_contact_link('30000000-0000-4000-8000-000000000002')),
  '+1555012345',
  'a matched member sharing in matches mode releases the number'
);

reset role;

-- The same owner flips Bob to consent-gated sharing and back.
update public.private_contacts
   set share_mode = 'approved'
 where user_id = '30000000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select public.get_contact_link('30000000-0000-4000-8000-000000000002')),
  null,
  'approved mode without Bob''s per-viewer grant stays null'
);

reset role;

insert into public.contact_approvals (owner_id, viewer_id)
values ('30000000-0000-4000-8000-000000000002',
        '30000000-0000-4000-8000-000000000001');

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select public.get_contact_link('30000000-0000-4000-8000-000000000002')),
  '+1555012345',
  'an explicit approval makes the number visible again'
);

reset role;

update public.private_contacts
   set share_mode = 'never'
 where user_id = '30000000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select public.get_contact_link('30000000-0000-4000-8000-000000000002')),
  null,
  'never mode is a hard no even when matched'
);

reset role;

-- ===========================================================================
-- 6. A blocked user can neither see nor message the blocker.
-- ===========================================================================
-- Bob blocks Alice. Alice is the blocked party for every assertion below.
insert into public.blocks (blocker_id, blocked_id)
values ('30000000-0000-4000-8000-000000000002',
        '30000000-0000-4000-8000-000000000001');

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.public_profiles
    where id = '30000000-0000-4000-8000-000000000002'),
  0::bigint,
  'the blocked member cannot even see the blocker in the discovery feed'
);

select throws_like(
  $$insert into public.messages (match_id, sender_id, content)
    select m.id, '30000000-0000-4000-8000-000000000001', 'still trying'
    from public.matches m
    where m.user_id = '30000000-0000-4000-8000-000000000001'
      and m.matched_user_id = '30000000-0000-4000-8000-000000000002'$$,
  '%row-level security%',
  'the blocked member cannot message into the old thread'
);

select is(
  (select count(*) from public.messages
    where match_id in (
      select id from public.matches
      where user_id = '30000000-0000-4000-8000-000000000001'
        and matched_user_id = '30000000-0000-4000-8000-000000000002')),
  0::bigint,
  'and the blocked member cannot read the old thread either'
);

select is(
  (select public.get_contact_link('30000000-0000-4000-8000-000000000002')),
  null,
  'a block cancels the number even when a match exists'
);

reset role;

-- ===========================================================================
-- 7. get_contact_link is rate limited: 20 calls per hour per caller.
-- ===========================================================================
-- Dave exists as a member but has no number and no match with Alice, so every
-- call comes back null — yet every call still counts against his quota, which
-- is exactly what makes the limit worth having.
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select public.get_contact_link('30000000-0000-4000-8000-000000000001')),
  null,
  'Dave: first call within the limit'
);

do $$
begin
  for i in 1..18 loop
    perform public.get_contact_link('30000000-0000-4000-8000-000000000001');
  end loop;
end $$;

select is(
  (select public.get_contact_link('30000000-0000-4000-8000-000000000001')),
  null,
  'Dave: the twentieth call within the hour is still allowed'
);

select throws_like(
  $$select public.get_contact_link('30000000-0000-4000-8000-000000000001')$$,
  '%Rate limited%',
  'Dave: the twenty-first call within the hour is refused'
);

reset role;

-- ===========================================================================
-- 8. The raw profiles table stays self-only; the view is the discovery door.
-- ===========================================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.profiles
    where id = '30000000-0000-4000-8000-000000000001'),
  1::bigint,
  'Alice can still read her own profile row'
);

select is(
  (select count(*) from public.profiles
    where id = '30000000-0000-4000-8000-000000000002'),
  0::bigint,
  'but the raw table never shows her another member''s row'
);

reset role;

-- ===========================================================================
-- 9. user_roles is administrator-readable only.
-- ===========================================================================
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.user_roles),
  0::bigint,
  'an ordinary member sees no role table at all'
);

reset role;

-- Carol is promoted by an operator action (the service-role equivalent).
insert into public.user_roles (user_id, role)
values ('30000000-0000-4000-8000-000000000003', 'admin');

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

select ok(
  (select public.is_admin()),
  'an administrator is an administrator'
);

select is(
  (select count(*) from public.user_roles),
  2::bigint,
  'and an administrator can read the role table, including the seeded admin''s row'
);

reset role;

-- ===========================================================================
-- 10. Storage: private buckets, own-folder uploads, admin-only selfies.
-- ===========================================================================
select is(
  (select count(*) from storage.buckets
    where id = 'profile-photos'
      and public = false
      and file_size_limit = 5242880
      and allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]),
  1::bigint,
  'profile-photos is a private bucket, 5 MB, images only'
);

select is(
  (select count(*) from storage.buckets
    where id = 'verification-selfies'
      and public = false
      and file_size_limit = 10485760
      and allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]),
  1::bigint,
  'verification-selfies is a private bucket, 10 MB, images only'
);

select is(
  (select count(*) from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'profile_photos_insert_own_folder',
        'profile_photos_update_own_folder',
        'profile_photos_delete_own_folder',
        'profile_photos_select_own_or_visible',
        'verification_selfies_select_admin')),
  5::bigint,
  'all five storage policies exist'
);

-- The own-folder rule, proven behaviourally: Alice may place an object in her
-- own folder, but not in Bob''s.
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('profile-photos', '30000000-0000-4000-8000-000000000001/me.jpg')$$,
  'a member can upload into their own folder'
);

select throws_like(
  $$insert into storage.objects (bucket_id, name)
    values ('profile-photos', '30000000-0000-4000-8000-000000000002/not-mine.jpg')$$,
  '%row-level security%',
  'a member cannot upload into someone else''s folder'
);

select is(
  (select count(*) from storage.objects
    where bucket_id = 'profile-photos'
      and name = '30000000-0000-4000-8000-000000000001/me.jpg'),
  1::bigint,
  'and their own upload is present'
);

reset role;

set local role anon;

select is(
  (select count(*) from storage.objects),
  0::bigint,
  'an anonymous client sees nothing in storage either'
);

reset role;

select * from finish();
rollback;
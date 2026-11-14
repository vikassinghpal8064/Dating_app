-- 09 — member_photos: the upload pipeline, its moderation wall and its
-- storage visibility.
--
-- The uploading member (Alice) can always read and manage her own photos; other
-- members see only APPROVED photos whose owner their public_profiles exposes;
-- moderators see the queue; nobody but a SECURITY DEFINER RPC (or a moderator)
-- can change a photo's state. The storage SELECT policy is proven twice: what
-- a member can and cannot see mirrors exactly what member_photos lets them
-- read.
--
--   Alice  30000000-...-001  uploads five photos with four moderation outcomes
--   Bob    30000000-...-002  the curious other member (read-only)
--   Carol  30000000-...-003  promoted to admin for the moderation tests
--
-- Storage paths are the exact shape the pipeline produces: <owner-uid>/<uuid>.webp
-- where the engine can encode WebP, <owner-uid>/<uuid>.jpg where it cannot
-- (WebKit). The declared mimetype must match the extension either way.
--
-- The whole file runs in one transaction and is rolled back. Storage objects
-- are inserted by the test as the table owner (bypassing RLS), exactly like a
-- real upload would leave them.

create extension if not exists pgtap with schema extensions;

begin;
select plan(36);

-- ---------------------------------------------------------------------------
-- Fixtures. Profiles are written directly the same way 08 does: the
-- on_auth_user_created placeholders are removed first.
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
   '{}'::jsonb, '{}'::jsonb, now(), now(), null, null, 0);

delete from public.profiles
 where id in (
   '30000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000002',
   '30000000-0000-4000-8000-000000000003'
 );

insert into public.profiles
  (id, full_name, date_of_birth, location_city, location_country)
values
  ('30000000-0000-4000-8000-000000000001', 'Alice', '1990-06-15', 'Mumbai', 'India'),
  ('30000000-0000-4000-8000-000000000002', 'Bob',   '1991-07-20', 'Mumbai', 'India'),
  ('30000000-0000-4000-8000-000000000003', 'Carol', '1992-08-25', 'Pune',   'India');

-- Carol becomes the moderator for the moderation section.
insert into public.user_roles (user_id, role)
values ('30000000-0000-4000-8000-000000000003', 'admin');

-- The objects the uploads would have produced: four Alice files and two Bob
-- files, with the metadata the storage service records for a real upload.
-- (mimetype, size) decides auto-approval; width/height are absent, exactly as
-- the storage API stores them for an upload without image processing.
insert into storage.objects (bucket_id, name, metadata) values
  ('profile-photos', '30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000001.webp',
   '{"mimetype":"image/webp","size":120000}'::jsonb),
  ('profile-photos', '30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000002.webp',
   '{"mimetype":"image/webp","size":90000}'::jsonb),
  ('profile-photos', '30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000003.webp',
   '{"mimetype":"image/webp","size":400000}'::jsonb),
  ('profile-photos', '30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000004.webp',
   '{"mimetype":"image/jpeg","size":120000}'::jsonb),
  ('profile-photos', '30000000-0000-4000-8000-000000000002/bbbbbbbb-0000-4000-8000-000000000001.webp',
   '{"mimetype":"image/webp","size":80000}'::jsonb),
  ('profile-photos', '30000000-0000-4000-8000-000000000002/bbbbbbbb-0000-4000-8000-000000000002.jpg',
   '{"mimetype":"image/jpeg","size":90000}'::jsonb);

-- ===========================================================================
-- 1. Anonymous: nothing, not even the table's own shape.
-- ===========================================================================
set local role anon;

select throws_like(
  $$select * from public.member_photos$$, '%permission denied%',
  'anon: member_photos is unreadable'
);
select throws_like(
  $$insert into public.member_photos (user_id, storage_path)
    values ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000099.webp')$$,
  '%permission denied%',
  'anon: member_photos is not writable'
);

reset role;

-- ===========================================================================
-- 2. The table itself: RLS on, one policy, no unconditional reads.
-- ===========================================================================
select is(
  (select count(*) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'member_photos' and c.relrowsecurity),
  1::bigint,
  'member_photos has row level security enabled'
);

select is(
  (select count(*) from pg_policy pol
     join pg_class c on c.oid = pol.polrelid
    where c.relname = 'member_photos'),
  1::bigint,
  'member_photos exposes exactly one policy'
);

-- A member cannot write the table directly either: writes go through the RPC.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select throws_like(
  $$insert into public.member_photos (user_id, storage_path)
    values ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000099.webp')$$,
  '%permission denied%',
  'a member cannot INSERT into member_photos directly'
);

-- ===========================================================================
-- 3. record_member_photo rejects anything that is not a real own-folder path.
-- ===========================================================================
select throws_like(
  $$select public.record_member_photo('not-a-path')$$,
  '%A photo path must be%',
  'record_member_photo rejects a malformed path'
);
select throws_like(
  $$select public.record_member_photo('30000000-0000-4000-8000-000000000002/aaaaaaaa-1111-4111-8111-111111111111.webp')$$,
  '%own folder%',
  'record_member_photo rejects a path in someone else''s folder'
);

-- ===========================================================================
-- 4. The four moderation outcomes come straight out of the auto-checks.
-- ===========================================================================
select is(
  (select moderation_status::text from public.record_member_photo('30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000005.webp')),
  'pending',
  'a photo whose object does not exist stays pending'
);
select is(
  (select moderation_status::text from public.record_member_photo('30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000001.webp')),
  'approved',
  'a valid webp object within the size budget is auto-approved'
);
select is(
  (select moderation_status::text from public.record_member_photo('30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000002.webp')),
  'approved',
  'and the second valid photo is auto-approved too'
);
select is(
  (select moderation_status::text from public.record_member_photo('30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000003.webp')),
  'pending',
  'an oversized webp stays pending for a human moderator'
);
select is(
  (select moderation_status::text from public.record_member_photo('30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000004.webp')),
  'pending',
  'a webp-named object whose declared mimetype is not image/webp stays pending'
);

-- The six-photo cap is enforced at record time. The sixth photo succeeds as a
-- normal row; the seventh is refused.
select is(
  (select position from public.record_member_photo('30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000006.webp')),
  5::smallint,
  'a sixth photo is recorded at position 5'
);
select throws_like(
  $$select public.record_member_photo('30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000007.webp')$$,
  '%at most six photos%',
  'a seventh photo is refused'
);

-- Positions are assigned densely from zero and never collide.
select is(
  (select array_agg(position order by position) as positions
     from (select position from public.member_photos where user_id = '30000000-0000-4000-8000-000000000001') s),
  array[0, 1, 2, 3, 4, 5]::smallint[],
  'the first six photos occupy positions 0..5'
);

-- Bob records a photo of his own, which Alice must not be able to touch.
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(
  (select id is not null from public.record_member_photo('30000000-0000-4000-8000-000000000002/bbbbbbbb-0000-4000-8000-000000000001.webp')),
  true,
  'bob records his own photo'
);

-- The JPEG fallback (engines that cannot encode WebP) is auto-approved too,
-- because the declared mimetype matches the .jpg extension the pipeline chose.
select is(
  (select moderation_status::text from public.record_member_photo('30000000-0000-4000-8000-000000000002/bbbbbbbb-0000-4000-8000-000000000002.jpg')),
  'approved',
  'a valid jpeg object within the size budget is auto-approved'
);

-- ===========================================================================
-- 5. reorder_member_photos is strict about ownership and positions.
-- ===========================================================================
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select throws_like(
  $$select public.reorder_member_photos(
     array['30000000-0000-4000-8000-000000000001'::uuid],
     array[0, 1])$$,
  '%same length%',
  'reorder requires matching array lengths'
);
select throws_like(
  $$select public.reorder_member_photos(
     array['10000000-0000-4000-8000-00000000000a'::uuid],
     array[5])$$,
  '%permutation%',
  'reorder requires a permutation of 0..n-1'
);
select throws_like(
  $$select public.reorder_member_photos(
     array['30000000-0000-4000-8000-000000000001'::uuid,
           '30000000-0000-4000-8000-000000000002'::uuid],
     array[0, 1])$$,
  '%own photos%',
  'reorder refuses a photo that is not the caller''s'
);

-- A real swap: move the last photo to the front.
select lives_ok(
  $$select public.reorder_member_photos(
     array[
       (select id from public.member_photos where user_id = '30000000-0000-4000-8000-000000000001' and position = 5),
       (select id from public.member_photos where user_id = '30000000-0000-4000-8000-000000000001' and position = 0),
       (select id from public.member_photos where user_id = '30000000-0000-4000-8000-000000000001' and position = 1),
       (select id from public.member_photos where user_id = '30000000-0000-4000-8000-000000000001' and position = 2),
       (select id from public.member_photos where user_id = '30000000-0000-4000-8000-000000000001' and position = 3),
       (select id from public.member_photos where user_id = '30000000-0000-4000-8000-000000000001' and position = 4)
     ],
     array[0, 1, 2, 3, 4, 5])$$,
  'reorder accepts a valid permutation'
);

select is(
  (select array_agg(position order by position) as positions
     from (select position from public.member_photos where user_id = '30000000-0000-4000-8000-000000000001') s),
  array[0, 1, 2, 3, 4, 5]::smallint[],
  'swap leaves positions 0..5 assigned once each'
);

-- ===========================================================================
-- 6. delete_member_photo is ownership-checked and compacts the positions.
-- ===========================================================================
select throws_like(
  $$select public.delete_member_photo(
     (select id from public.member_photos
       where user_id = '30000000-0000-4000-8000-000000000002'
         and storage_path = '30000000-0000-4000-8000-000000000002/bbbbbbbb-0000-4000-8000-000000000001.webp'))$$,
  '%own photos%',
  'delete refuses another member''s photo'
);

select lives_ok(
  $$select public.delete_member_photo(
     (select id from public.member_photos
       where user_id = '30000000-0000-4000-8000-000000000001'
         and storage_path = '30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000001.webp'))$$,
  'delete removes an own photo'
);

select is(
  (select count(*) from public.member_photos
    where user_id = '30000000-0000-4000-8000-000000000001'),
  5::bigint,
  'alice has five photos after the delete'
);
select is(
  (select array_agg(position order by position) as positions
     from (select position from public.member_photos where user_id = '30000000-0000-4000-8000-000000000001') s),
  array[0, 1, 2, 3, 4]::smallint[],
  'the positions are compacted back to 0..4'
);

-- ===========================================================================
-- 7. Moderation is moderator-only: members cannot flip their own status.
-- ===========================================================================
select throws_like(
  $$select public.set_member_photo_moderation(
     (select id from public.member_photos
       where user_id = '30000000-0000-4000-8000-000000000001'
         and storage_path = '30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000003.webp'),
     'approved')$$,
  '%moderator%',
  'a member cannot approve their own pending photo'
);

select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select lives_ok(
  $$select public.set_member_photo_moderation(
     (select id from public.member_photos
       where user_id = '30000000-0000-4000-8000-000000000001'
         and storage_path = '30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000003.webp'),
     'approved')$$,
  'a moderator can approve the oversized photo manually'
);
select is(
  (select moderation_status::text from public.member_photos
    where user_id = '30000000-0000-4000-8000-000000000001'
      and storage_path = '30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000003.webp'),
  'approved',
  'and the manual approval is visible on the row'
);

-- ===========================================================================
-- 8. RLS: what each reader actually sees. Alice's six photos were:
-- approved-2 (approved), missing (pending), oversized (pending, then moderated
-- to approved), notwebp (pending), sixth (pending) — and her first approved
-- photo was deleted. So the approved set visible to Bob is exactly
-- approved-2 and oversized.
-- ===========================================================================
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(
  (select count(*) from public.member_photos
    where user_id = '30000000-0000-4000-8000-000000000001'),
  2::bigint,
  'bob sees only alice''s approved photos (pending ones are invisible)'
);
select is(
  (select array_agg(storage_path order by position) from (
     select storage_path, position from public.member_photos
      where user_id = '30000000-0000-4000-8000-000000000001') s),
  array['30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000002.webp',
        '30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000003.webp']::text[],
  'and exactly the approved pair, in display order'
);

select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(
  (select count(*) from public.member_photos
    where user_id = '30000000-0000-4000-8000-000000000001'),
  5::bigint,
  'the owner sees all of her own photos, pending included'
);

select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select is(
  (select count(*) from public.member_photos
    where user_id = '30000000-0000-4000-8000-000000000001'),
  5::bigint,
  'a moderator sees the whole queue'
);

-- ===========================================================================
-- 9. Storage: the SELECT policy mirrors exactly what member_photos allows.
-- ===========================================================================
select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is(
  (select count(*) from storage.objects
    where bucket_id = 'profile-photos'
      and name in (
        '30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000002.webp',
        '30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000003.webp',
        '30000000-0000-4000-8000-000000000001/aaaaaaaa-0000-4000-8000-000000000005.webp')),
  2::bigint,
  'bob can read the approved objects but not the pending ones'
);

select set_config('request.jwt.claims', '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is(
  (select count(*) from storage.objects
    where bucket_id = 'profile-photos'
      and (storage.foldername(name))[1] = '30000000-0000-4000-8000-000000000001'),
  4::bigint,
  'the owner can read every object in their own folder'
);

reset role;

set local role anon;
select is(
  (select count(*) from storage.objects),
  0::bigint,
  'an anonymous client sees no storage object at all'
);

select * from finish();
rollback;
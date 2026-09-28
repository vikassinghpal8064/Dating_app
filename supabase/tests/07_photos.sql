-- 07 — Photos, and who gets to say no.
--
-- `profiles.photos` is the array the browser renders and the member writes it:
-- the edit page adds, removes and reorders URLs, and it must keep working, so
-- this is a load-bearing part of the product rather than a schema detail.
--
-- `profile_photos` is a deny-list. A row there whose status is 'rejected' names
-- a URL that must not appear in a member's photos, and that is the only thing
-- it does. It never adds a photo, and reversing a verdict does not bring one
-- back, because a table that could both add and remove would be a second source
-- of truth able to contradict the member's own list.
--
-- Two triggers carry that, and this file tests both halves plus the two ways a
-- deny-list is usually defeated:
--
--   * the member re-adding a refused URL in a later edit (strip_rejected_photos
--     filters on every write, so the answer is no);
--   * the member emptying the deny-list itself (profile_photos is not
--     member-writable, so they cannot reach their own verdict).
--
-- The whole file runs in one transaction and is rolled back.

create extension if not exists pgtap with schema extensions;

begin;
select plan(39);

-- Two members. 0001 is the one carrying the seeded verdicts; 0002 is an
-- uninvolved bystander, so cross-contamination has somewhere to show up.
-- 1111... is the seeded admin, the only holder of a moderator role.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- The shape of the mechanism
-- ===========================================================================

-- SECURITY DEFINER, because a member cannot read profile_photos: RLS on it
-- allows only their own rows, and the verdict on an image is not theirs to see.
-- Reading it as the table owner is the only way the filter can work.
select ok(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'strip_rejected_photos'),
  'strip_rejected_photos is SECURITY DEFINER, so it can read verdicts a member cannot'
);

select ok(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'sync_profile_photos'),
  'and so is sync_profile_photos, which applies a verdict as soon as it is written'
);

-- Both are pinned to a search_path, so a caller cannot steer name resolution at
-- a schema of their choosing and have the function read a table they made.
select ok(
  (select proconfig is not null
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'strip_rejected_photos'),
  'and its search_path is pinned rather than inherited from the session'
);

-- Filtering has to happen on the member's write, not only when a moderator
-- speaks. Without the profiles-side trigger a refused URL could simply be typed
-- back in, and the deny-list would only delay the problem.
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'profiles_strip_rejected_photos'
      and not tgisinternal
      and tgrelid = 'public.profiles'::regclass
      and tgtype & 2 > 0            -- BEFORE
  ),
  'a BEFORE trigger filters photos on every write to profiles'
);

select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'profile_photos_sync_profiles_photos'
      and not tgisinternal
      and tgrelid = 'public.profile_photos'::regclass
  ),
  'and a trigger applies a verdict the moment it is written'
);

-- ===========================================================================
-- A member can still manage their photos
--
-- The edit page writes this column, so if any of this stopped working the
-- product broke. A deny-list that quietly emptied the list would pass every
-- refusal test below while breaking the app, which is why these come first.
-- ===========================================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$update public.profiles
       set photos = array['https://a.example/1.jpg',
                         'https://a.example/2.jpg',
                         'https://a.example/3.jpg']
     where id = '20000000-0000-4000-8000-000000000001'$$,
  'a member may set their photo list'
);

select is(
  (select photos from public.profiles
    where id = '20000000-0000-4000-8000-000000000001'),
  array['https://a.example/1.jpg', 'https://a.example/2.jpg',
        'https://a.example/3.jpg']::text[],
  'and all three are stored in the order they were given'
);

select lives_ok(
  $$update public.profiles
       set photos = array['https://a.example/3.jpg', 'https://a.example/1.jpg',
                         'https://a.example/2.jpg']
     where id = '20000000-0000-4000-8000-000000000001'$$,
  'a member may reorder their photos'
);

select is(
  (select photos from public.profiles
    where id = '20000000-0000-4000-8000-000000000001'),
  array['https://a.example/3.jpg', 'https://a.example/1.jpg',
        'https://a.example/2.jpg']::text[],
  'and the new order is what is kept'
);

select lives_ok(
  $$update public.profiles
       set photos = array['https://a.example/1.jpg']
     where id = '20000000-0000-4000-8000-000000000001'$$,
  'a member may remove a photo themselves'
);

select is(
  (select photos from public.profiles
    where id = '20000000-0000-4000-8000-000000000001'),
  array['https://a.example/1.jpg']::text[],
  'and the removal is theirs to make, with no verdict involved'
);

select lives_ok(
  $$update public.profiles set photos = '{}'
     where id = '20000000-0000-4000-8000-000000000001'$$,
  'a member may clear their photos entirely'
);

select is(
  (select photos from public.profiles
    where id = '20000000-0000-4000-8000-000000000001'),
  '{}'::text[],
  'and an empty list is a legal thing to want'
);

-- ===========================================================================
-- A verdict acts at once, on the one URL, and leaves everything else alone
-- ===========================================================================

reset role;

update public.profiles
   set photos = array['https://a.example/1.jpg', 'https://a.example/2.jpg',
                      'https://a.example/3.jpg']
 where id = '20000000-0000-4000-8000-000000000001';

update public.profiles
   set photos = array['https://b.example/1.jpg', 'https://b.example/2.jpg']
 where id = '20000000-0000-4000-8000-000000000002';

-- A verdict on the middle photo. This is the case the previous design got wrong:
-- it rebuilt the array from approved rows, so this one action silently reduced a
-- member's three photos to one and lost the other two.
insert into public.profile_photos (user_id, storage_path, position, moderation_status)
values ('20000000-0000-4000-8000-000000000001', 'https://a.example/2.jpg', 1, 'rejected');

select is(
  (select photos from public.profiles
    where id = '20000000-0000-4000-8000-000000000001'),
  array['https://a.example/1.jpg', 'https://a.example/3.jpg']::text[],
  'rejecting one photo removes that photo and keeps the rest, in order'
);

select ok(
  not exists (
    select 1
    from unnest((select photos from public.profiles
                  where id = '20000000-0000-4000-8000-000000000001')) as u(url)
    where u.url = 'https://a.example/2.jpg'
  ),
  'and the refused URL is genuinely gone rather than merely reordered'
);

-- The deny-list is keyed on user_id as well as the URL, so a verdict about one
-- member cannot reach another's list even when the URL is identical.
select is(
  (select photos from public.profiles
    where id = '20000000-0000-4000-8000-000000000002'),
  array['https://b.example/1.jpg', 'https://b.example/2.jpg']::text[],
  'a verdict about one member does not touch anyone else, even on a matching URL'
);

-- 'pending' and 'approved' mean "not objected to". Under this design they are
-- not adding either, which is the property that keeps the table from being a
-- second source of truth: it can only ever take photos away.
insert into public.profile_photos (user_id, storage_path, position, moderation_status)
values ('20000000-0000-4000-8000-000000000001', 'https://a.example/4.jpg', 3, 'approved');

select is(
  (select photos from public.profiles
    where id = '20000000-0000-4000-8000-000000000001'),
  array['https://a.example/1.jpg', 'https://a.example/3.jpg']::text[],
  'approving a photo adds nothing, because profiles.photos is what the member wrote'
);

-- ===========================================================================
-- The member cannot put a refused URL back
--
-- The write succeeds rather than erroring: the URL is filtered out of the array
-- the trigger hands onward, so the rest of the payload is saved. Silently
-- dropping one entry the member asked to remove is a small lie, but the
-- alternative — failing the whole edit and stranding the member — is worse for
-- a photo they are trying to delete anyway.
-- ===========================================================================

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$update public.profiles
       set photos = array['https://a.example/2.jpg', 'https://a.example/5.jpg']
     where id = '20000000-0000-4000-8000-000000000001'$$,
  'a write naming a refused URL is accepted rather than refused'
);

select is(
  (select photos from public.profiles
    where id = '20000000-0000-4000-8000-000000000001'),
  array['https://a.example/5.jpg']::text[],
  'the refused URL is filtered out and the legitimate one alongside it is kept'
);

-- A verdict has to hold against the sign-up payload too, or re-registering with
-- a remembered payload would restore a refused image.
--
-- The order below is forced rather than chosen. profile_photos.user_id is a
-- foreign key to profiles, so a verdict cannot be written for a row that does not
-- exist; and a row being created cannot have verdicts against it yet. Which
-- means the deny-list has nothing to filter on a pure INSERT, and every real
-- path that does carry a verdict is an upsert onto the row the sign-up trigger
-- already created. That runs the UPDATE branch, so this is the path worth
-- testing -- and it is the one the app actually takes, since signUp upserts.
reset role;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000',
        'c0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
        'photos@local.test', crypt('local-seed-only', gen_salt('bf')),
        now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

-- The placeholder profile now exists, so the verdict can be planted against it.
insert into public.profile_photos (user_id, storage_path, position, moderation_status)
values ('c0000000-0000-4000-8000-000000000001', 'https://c1.example/1.jpg', 0, 'rejected');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into public.profiles (id, full_name, photos)
    values ('c0000000-0000-4000-8000-000000000001', 'Sign Up Again',
            array['https://c1.example/1.jpg', 'https://c1.example/2.jpg'])
    on conflict (id) do update
      set full_name = excluded.full_name,
          photos = excluded.photos$$,
  'a sign-up payload naming a refused URL is accepted'
);

select is(
  (select photos from public.profiles
    where id = 'c0000000-0000-4000-8000-000000000001'),
  array['https://c1.example/2.jpg']::text[],
  'and the refusal holds on the sign-up upsert, not only on a later edit'
);

-- ===========================================================================
-- The member cannot empty the deny-list
--
-- This is the half that makes the first half mean anything. A member who could
-- delete the row naming their own image would empty the deny-list and re-add the
-- image in one request, and the filter above would be theatre.
-- ===========================================================================

reset role;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000',
        'c0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
        'verdict@local.test', crypt('local-seed-only', gen_salt('bf')),
        now(), now(), now(), '{}'::jsonb, '{}'::jsonb);

-- A member who already has a list, and a moderator who then refuses one of it.
-- This is the ordinary case: the photos came first, the verdict came later.
update public.profiles
   set photos = array['https://c2.example/1.jpg', 'https://c2.example/2.jpg']
 where id = 'c0000000-0000-4000-8000-000000000002';

insert into public.profile_photos (user_id, storage_path, position, moderation_status)
values ('c0000000-0000-4000-8000-000000000002', 'https://c2.example/1.jpg', 0, 'rejected');

select is(
  (select photos from public.profiles
    where id = 'c0000000-0000-4000-8000-000000000002'),
  array['https://c2.example/2.jpg']::text[],
  'a verdict on an existing list removes that photo and keeps the rest'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

-- RLS filters these silently rather than raising, so the assertions are on what
-- the verdicts look like afterwards, not on an error message.
delete from public.profile_photos
 where user_id = 'c0000000-0000-4000-8000-000000000002'
   and storage_path = 'https://c2.example/1.jpg';

select is(
  (select moderation_status from public.profile_photos
    where user_id = 'c0000000-0000-4000-8000-000000000002'
      and storage_path = 'https://c2.example/1.jpg'),
  'rejected'::public.moderation_status,
  'a member cannot delete the verdict against their own photo'
);

update public.profile_photos set moderation_status = 'approved'
 where user_id = 'c0000000-0000-4000-8000-000000000002'
   and storage_path = 'https://c2.example/1.jpg';

select is(
  (select moderation_status from public.profile_photos
    where user_id = 'c0000000-0000-4000-8000-000000000002'
      and storage_path = 'https://c2.example/1.jpg'),
  'rejected'::public.moderation_status,
  'nor may they overturn it themselves'
);

-- Unlike the UPDATE and DELETE above, which RLS filters silently to no rows, an
-- INSERT that violates its WITH CHECK clause raises, so this one is asserted on
-- the error rather than on the absence of a row.
select throws_like(
  $$insert into public.profile_photos (user_id, storage_path, position, moderation_status)
    values ('c0000000-0000-4000-8000-000000000002', 'https://c2.example/3.jpg', 1, 'rejected')$$,
  '%row-level security%',
  'nor may a member add a verdict of their own'
);

select is(
  (select count(*) from public.profile_photos
    where user_id = 'c0000000-0000-4000-8000-000000000002'
      and storage_path = 'https://c2.example/3.jpg'),
  0::bigint,
  'and no such row exists afterwards'
);

select is(
  (select photos from public.profiles
    where id = 'c0000000-0000-4000-8000-000000000002'),
  array['https://c2.example/2.jpg']::text[],
  'so their photo list is exactly what the verdicts leave it as'
);

-- ===========================================================================
-- Moderation still works, and it is one-directional
-- ===========================================================================

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

-- Recording a verdict against a photo that has none yet, which is the ordinary
-- case: the member published a URL and a moderator later refused it.
--
-- This is an INSERT rather than an UPDATE, and deliberately so. An UPDATE here
-- would match no rows, and lives_ok() would pass without the trigger ever
-- running -- a vacuous test that reports green while proving nothing.
select lives_ok(
  $$insert into public.profile_photos (user_id, storage_path, position, moderation_status)
    values ('c0000000-0000-4000-8000-000000000002', 'https://c2.example/2.jpg', 1, 'rejected')$$,
  'a moderator may record a verdict'
);

select is(
  (select count(*) from public.profile_photos
    where user_id = 'c0000000-0000-4000-8000-000000000002'
      and storage_path = 'https://c2.example/2.jpg'),
  1::bigint,
  'and the verdict was actually written, not just accepted'
);

-- The verdict is the moderator's to write but not the profile's to read:
-- profiles is self-only even for an admin, which is tested in 05 and is why
-- these assertions are read from the owner side. A moderator moderating a photo
-- queue is not thereby entitled to read the profiles behind it.
select is(
  (select count(*) from public.profiles
    where id = 'c0000000-0000-4000-8000-000000000002'),
  0::bigint,
  'a moderator still cannot read the profile the photo belongs to'
);

reset role;

select is(
  (select photos from public.profiles
    where id = 'c0000000-0000-4000-8000-000000000002'),
  '{}'::text[],
  'and the verdict took effect on the member''s list straight away'
);

-- Overturning the verdict is a thing a moderator must be able to do, and it
-- deliberately does not put the photo back. The member's list is the record of
-- what they chose to show; a moderator deciding they may show it again is not
-- the same as them choosing to, and silently republishing an image is not a
-- decision a schema should make on a member's behalf.
update public.profile_photos set moderation_status = 'approved'
 where user_id = 'c0000000-0000-4000-8000-000000000002'
   and storage_path = 'https://c2.example/2.jpg';

select is(
  (select photos from public.profiles
    where id = 'c0000000-0000-4000-8000-000000000002'),
  '{}'::text[],
  'overturning a verdict does not resurrect the photo'
);

update public.profiles set photos = array['https://c2.example/2.jpg']
 where id = 'c0000000-0000-4000-8000-000000000002';

select is(
  (select photos from public.profiles
    where id = 'c0000000-0000-4000-8000-000000000002'),
  array['https://c2.example/2.jpg']::text[],
  'and once the member adds it back it stays, because the member owns the list'
);

-- ===========================================================================
-- The limit and the shape are still enforced
-- ===========================================================================

reset role;

update public.profiles set is_visible = true
 where id = '20000000-0000-4000-8000-000000000001';

update public.profiles set photos = array['https://a.example/2.jpg'];

select is(
  (select count(*) from public.public_profiles
    where id = '20000000-0000-4000-8000-000000000001'
      and 'https://a.example/2.jpg' = any (photos)),
  0::bigint,
  'a refused URL cannot reach the published view either'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- The six-photo ceiling is checked after filtering, so it is the stored list
-- that is bounded, not the submitted one. That is the invariant worth holding:
-- nothing the member sends can put more than six rows' worth of images into
-- anything that renders.
select throws_like(
  $$update public.profiles set photos = array[
       'https://a.example/1.jpg', 'https://a.example/3.jpg',
       'https://a.example/9.jpg', 'https://a.example/10.jpg',
       'https://a.example/11.jpg', 'https://a.example/12.jpg',
       'https://a.example/13.jpg']
     where id = '20000000-0000-4000-8000-000000000001'$$,
  '%profiles_photo_count%',
  'more than six photos is still refused'
);

select lives_ok(
  $$update public.profiles set photos = array[
       'https://a.example/1.jpg', 'https://a.example/3.jpg',
       'https://a.example/9.jpg', 'https://a.example/10.jpg',
       'https://a.example/11.jpg', 'https://a.example/12.jpg']
     where id = '20000000-0000-4000-8000-000000000001'$$,
  'and exactly six is allowed'
);

select is(
  (select cardinality(photos) from public.profiles
    where id = '20000000-0000-4000-8000-000000000001'),
  6,
  'so the stored list is six'
);

-- NULL reaches the trigger before the NOT NULL constraint is checked. The
-- trigger must leave it alone rather than turning it into an empty array, which
-- would quietly convert "no photos" into "photos, none of them" and let a broken
-- client through as a valid profile.
select throws_like(
  $$update public.profiles set photos = null
     where id = '20000000-0000-4000-8000-000000000001'$$,
  '%null value in column "photos"%',
  'a null photo list is refused rather than laundered into an empty one'
);

select throws_like(
  $$update public.profiles set photos = array['http://insecure.example/1.jpg']
     where id = '20000000-0000-4000-8000-000000000001'$$,
  '%profiles_photos_are_https%',
  'and a non-https photo is still refused'
);

select * from finish();
rollback;

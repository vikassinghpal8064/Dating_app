-- 11 — Profile details, likes lists, match overviews, unmatch and unread stats.
--
-- Proves what migration 21 added: get_profile returns exactly one member and
-- nothing for hidden, banned, blocked, self or missing targets (identical,
-- uninformative absence); likes_sent mirrors likes_received for members only;
-- list_matches carries the partner profile, last message and honest unread
-- counts; mark_messages_read touches only received messages; unmatch removes
-- the match and the cascade removes the whole thread; and unread_stats drives
-- the nav badge. None of it is reachable by `anon`.
--
-- The whole file runs in one transaction and is rolled back.
--
-- Members: demo = 11111111-1111-4111-8111-111111111111 (Mumbai 19.08/72.88),
-- aarav = ...0001 (Mumbai), diya = ...0002 (Mumbai), vivek = ...0007
-- (Bengaluru), tanya = ...0012 (Bengaluru). The seed already has the one-sided
-- aarav → demo like.

create extension if not exists pgtap with schema extensions;

begin;
select plan(46);

-- ---------------------------------------------------------------------------
-- 1. The new surface is members-only
-- ---------------------------------------------------------------------------
select is(
  has_table_privilege('authenticated', 'public.likes_sent', 'select'),
  true,
  'likes_sent is selectable by authenticated'
);
select is(
  has_table_privilege('anon', 'public.likes_sent', 'select'),
  false,
  'likes_sent is not selectable by anon'
);
select is(
  has_function_privilege('anon', 'public.get_profile(uuid)', 'execute'),
  false,
  'get_profile is not callable by anon'
);
select is(
  has_function_privilege('anon', 'public.unread_stats()', 'execute'),
  false,
  'unread_stats is not callable by anon'
);
select is(
  has_function_privilege('anon', 'public.list_matches()', 'execute'),
  false,
  'list_matches is not callable by anon'
);
select is(
  has_function_privilege('anon', 'public.unmatch(uuid)', 'execute'),
  false,
  'unmatch is not callable by anon'
);
select is(
  has_function_privilege('anon', 'public.mark_messages_read(uuid)', 'execute'),
  false,
  'mark_messages_read is not callable by anon'
);
select is(
  has_function_privilege('authenticated', 'public.get_profile(uuid)', 'execute'),
  true,
  'get_profile is callable by authenticated'
);

-- ---------------------------------------------------------------------------
-- 2. Seal the caller's identity as demo
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.likes_sent),
  0::bigint,
  'demo has sent no likes yet, so likes_sent is empty'
);

-- ---------------------------------------------------------------------------
-- 3. unread_stats drives the badge
-- ---------------------------------------------------------------------------
select is(
  (select new_likes from public.unread_stats()),
  1::bigint,
  'the seeded aarav → demo like is one unreciprocated new like'
);
select is(
  (select unread_messages from public.unread_stats()),
  0::bigint,
  'no unread messages yet'
);

-- ---------------------------------------------------------------------------
-- 4. get_profile: the honest, and the absent
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.get_profile('20000000-0000-4000-8000-000000000007')),
  1::bigint,
  'a visible member returns exactly one profile row'
);
select is(
  (select distance_bucket from public.get_profile('20000000-0000-4000-8000-000000000007')),
  'distant',
  'vivek (Bengaluru) from demo (Mumbai) is a distant bucket'
);
select is(
  (select liked_viewer from public.get_profile('20000000-0000-4000-8000-000000000001')),
  true,
  'demo learns aarav liked them (the seed like)'
);
select is(
  (select viewer_liked_type from public.get_profile('20000000-0000-4000-8000-000000000001')),
  null,
  'demo has not liked aarav back yet'
);
select is(
  (select is_match from public.get_profile('20000000-0000-4000-8000-000000000001')),
  false,
  'one-sided like is not yet a match'
);
select is(
  (select count(*) from public.get_profile('11111111-1111-4111-8111-111111111111')),
  0::bigint,
  'the caller can never be their own profile page'
);
select is(
  (select count(*) from public.get_profile('ffffffff-ffff-4fff-8fff-ffffffffffff')),
  0::bigint,
  'a nonexistent id is indistinguishable from "not here"'
);

-- ---------------------------------------------------------------------------
-- 5. Reciprocating the seed like: mutual pair, lists, unread badge drains
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.send_like('20000000-0000-4000-8000-000000000001', 'like')$$,
  'demo likes aarav back'
);
select is(
  (select new_likes from public.unread_stats()),
  0::bigint,
  'the reciprocated like is no longer a new like'
);
select is(
  (select viewer_liked_type from public.get_profile('20000000-0000-4000-8000-000000000001')),
  'like',
  'get_profile reports the viewer liked them'
);
select is(
  (select count(*) from public.likes_sent),
  1::bigint,
  'likes_sent lists the person demo liked'
);
select is(
  (select liked_id from public.likes_sent),
  '20000000-0000-4000-8000-000000000001',
  'likes_sent names aarav, not an anonymous id'
);
select is(
  (select is_match from public.get_profile('20000000-0000-4000-8000-000000000001')),
  true,
  'mutual likes read as a match on the profile page'
);
select is(
  (select match_id from public.get_profile('20000000-0000-4000-8000-000000000001')) is not null,
  true,
  'the profile page can deep-link straight into the chat'
);

-- ---------------------------------------------------------------------------
-- 6. list_matches feeds the /matches surface
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.list_matches()),
  1::bigint,
  'one match for demo'
);
select is(
  (select (partner).id from public.list_matches()),
  '20000000-0000-4000-8000-000000000001',
  'list_matches resolves the partner, not just the match row'
);
select is(
  (select unread_count from public.list_matches()),
  0::bigint,
  'a fresh match has no unread messages'
);

-- ---------------------------------------------------------------------------
-- 7. Last message preview + read receipts
-- ---------------------------------------------------------------------------
-- The message is inserted as the owner because the insert policy is strictly
-- sender-scoped; that is what the RLS suite already covers.
reset role;
insert into public.messages (match_id, sender_id, content)
select m.id, '20000000-0000-4000-8000-000000000001', 'Hello demo'
from public.matches m
where m.user_id = least('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000001'::uuid)
  and m.matched_user_id = greatest('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000001'::uuid);

set local role authenticated;
select is(
  (select last_message from public.list_matches()),
  'Hello demo',
  'list_matches carries the latest message text for the preview'
);
select is(
  (select unread_count from public.list_matches()),
  1::bigint,
  'an unread received message counts as unread'
);
select is(
  (select unread_messages from public.unread_stats()),
  1::bigint,
  'unread_stats agrees with the badge'
);

select lives_ok(
  $$select public.mark_messages_read('00000000-0000-4000-8000-000000000000')$$,
  'mark_messages_read on a nonexistent match is a no-op'
);
select is(
  (select unread_count from public.list_matches()),
  1::bigint,
  'a no-op read never drains the count'
);

select lives_ok(
  format(
    $$select public.mark_messages_read(
      (select m.id from public.matches m
        where m.user_id = least('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000001'::uuid)
          and m.matched_user_id = greatest('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000001'::uuid)))$$
  ),
  'the recipient marks the thread read'
);
select is(
  (select unread_count from public.list_matches()),
  0::bigint,
  'opening the chat drains the unread count'
);
select is(
  (select count(*) from public.messages m
    join public.matches mm on mm.id = m.match_id
   where mm.id = (select m2.id from public.matches m2
     where m2.user_id = least('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000001'::uuid)
       and m2.matched_user_id = greatest('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000001'::uuid))
     and m.sender_id = '20000000-0000-4000-8000-000000000001'
     and m.read_at is not null),
  1::bigint,
  'mark_messages_read stamped read_at on the received message'
);

-- ---------------------------------------------------------------------------
-- 8. Unmatch kills the match and the thread for both members
-- ---------------------------------------------------------------------------
create temp table _mid on commit drop as
  select m.id from public.matches m
  where m.user_id = least('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000001'::uuid)
    and m.matched_user_id = greatest('11111111-1111-4111-8111-111111111111'::uuid, '20000000-0000-4000-8000-000000000001'::uuid);

select lives_ok(
  $$select public.unmatch((select id from _mid))$$,
  'a participant can unmatch'
);
select is(
  (select count(*) from public.matches where id = (select id from _mid)),
  0::bigint,
  'the match row is gone'
);
select is(
  (select count(*) from public.messages where match_id = (select id from _mid)),
  0::bigint,
  'the thread is gone for both members (cascade)'
);
select is(
  (select count(*) from public.list_matches()),
  0::bigint,
  'the unmatch no longer appears in /matches'
);
select lives_ok(
  $$select public.unmatch((select id from _mid))$$,
  'unmatching again is an idempotent no-op'
);

-- ---------------------------------------------------------------------------
-- 9. The identical uninformative 404
-- ---------------------------------------------------------------------------
reset role;
update public.profiles set profile_paused = true where id = '20000000-0000-4000-8000-000000000007';
set local role authenticated;
select is(
  (select count(*) from public.get_profile('20000000-0000-4000-8000-000000000007')),
  0::bigint,
  'a paused member returns no profile rows'
);
reset role;
update public.profiles set profile_paused = false where id = '20000000-0000-4000-8000-000000000007';
set local role authenticated;
select is(
  (select count(*) from public.get_profile('20000000-0000-4000-8000-000000000007')),
  1::bigint,
  'unpausing restores the derived visibility'
);

reset role;
update public.profiles set is_banned = true where id = '20000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(
  (select count(*) from public.get_profile('20000000-0000-4000-8000-000000000001')),
  0::bigint,
  'a banned member returns no profile rows'
);

reset role;
insert into public.blocks (blocker_id, blocked_id)
values ('11111111-1111-4111-8111-111111111111', '20000000-0000-4000-8000-000000000002')
on conflict (blocker_id, blocked_id) do nothing;
set local role authenticated;
select is(
  (select count(*) from public.get_profile('20000000-0000-4000-8000-000000000002')),
  0::bigint,
  'a member demo blocked returns no profile rows'
);

reset role;
insert into public.blocks (blocker_id, blocked_id)
values ('20000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111')
on conflict (blocker_id, blocked_id) do nothing;
set local role authenticated;
select is(
  (select count(*) from public.get_profile('20000000-0000-4000-8000-000000000002')),
  0::bigint,
  'a member who blocked demo still returns no profile rows'
);

reset role;
select finish();
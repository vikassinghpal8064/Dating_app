-- 17 — The RLS contract, tightened to match the product requirements.
--
-- Migration 14 enabled RLS everywhere and set the posture that still holds:
-- `anon` reads nothing, and every command on every table starts from deny.
-- This migration changes four of those policies where the requirement is
-- stricter or more precise than the original draft, and it removes one
-- capability (self-delete of your own profile) that the product must not ship:
--
--   likes       — a member may now read only the rows where they are the liker.
--                 "Who liked you" moves to the likes_received view, which joins
--                 public_profiles, so the answer comes back as profile data, not
--                 as an id of somebody the product has decided you may not see.
--                 The raw table never shows the liked side again.
--   messages    — SELECT/INSERT now require that no block exists between the two
--                 members of the match, and UPDATE is re-scoped from "your own
--                 sent messages" to "read_at on messages you received". A sender
--                 has no reason to touch their own message, and yesterday's
--                 policy let them; the requirement is that only the recipient
--                 marks a thread read.
--   reports     — insert-only for members (unchanged), but SELECT is now admins
--                 only; a reporter no longer reads the queue back.
--   user_roles  — readable only by administrators; nobody writes from a client
--                 (there is still no grant and no write policy).
--   profiles    — the DELETE policy and grant are removed outright: a profile is
--                 never deleted by the client. Rows are hidden (is_visible),
--                 banned, or left alone — not removed.
--
-- The one requirement this migration deliberately does NOT implement as a raw
-- policy is "a logged-in user can SELECT other visible profiles": that already
-- exists, through public.public_profiles (migration 12), which is the only
-- relation through which one member's profile is ever visible to another. The
-- raw `profiles` table stays self-only, because opening it would publish email,
-- date of birth and full-precision coordinates alongside the visible rows — the
-- exact leak the 12-column view exists to prevent. See the report.

drop policy likes_select_involved on public.likes;

create policy likes_select_as_liker
  on public.likes for select to authenticated
  using (liker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- likes_received: who liked me, as people rather than as rows.
-- ---------------------------------------------------------------------------
-- The view is owned (not security_invoker) for the same reason public_profiles
-- is: the RLS on `likes` would refuse the read if evaluated as the member, and
-- the WHERE clause below is the boundary that replaces it. The join goes
-- through public_profiles, so a liker who is hidden, banned or blocked never
-- appears in the list — "who liked you" must not become a way to learn about
-- somebody the product would otherwise hide.
create view public.likes_received as
select
  pp.id as liker_id,
  pp.full_name,
  pp.age,
  pp.gender,
  pp.interested_in,
  pp.bio,
  pp.photos,
  pp.location_city,
  pp.location_country,
  pp.distance_km,
  pp.is_online,
  pp.last_active,
  l.type as like_type,
  l.created_at as liked_at
from public.likes l
join public.public_profiles pp on pp.id = l.liker_id
where l.liked_id = auth.uid();

comment on view public.likes_received is
  'The people who liked the caller, as public profile rows. Joins public_profiles, '
  'so a hidden, banned or blocked liker is not revealed as having liked the caller. '
  'This is the only place a member learns who liked them; the raw likes table no '
  'longer exposes its liked side to the member.';

revoke all on public.likes_received from public;
revoke all on public.likes_received from anon;
grant select on public.likes_received to authenticated;

-- ---------------------------------------------------------------------------
-- messages: match membership, no block, and recipient-only read receipts.
-- ---------------------------------------------------------------------------
drop policy messages_select_involved on public.messages;
drop policy messages_insert_as_match_member on public.messages;
drop policy messages_update_own on public.messages;

create policy messages_select_involved
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = messages.match_id
        and auth.uid() in (m.user_id, m.matched_user_id)
        and not public.is_blocked_pair(m.user_id, m.matched_user_id)
    )
  );

create policy messages_insert_as_match_member
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = messages.match_id
        and auth.uid() in (m.user_id, m.matched_user_id)
        and not public.is_blocked_pair(m.user_id, m.matched_user_id)
    )
  );

-- The only UPDATE a client may perform is marking a received message as read.
-- The column grant (migration 14) already narrows it to `read_at`; this policy
-- now narrows it to rows the caller received, not rows they sent.
create policy messages_update_received
  on public.messages for update to authenticated
  using (
    messages.sender_id <> auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = messages.match_id
        and auth.uid() in (m.user_id, m.matched_user_id)
        and not public.is_blocked_pair(m.user_id, m.matched_user_id)
    )
  )
  with check (
    messages.sender_id <> auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = messages.match_id
        and auth.uid() in (m.user_id, m.matched_user_id)
        and not public.is_blocked_pair(m.user_id, m.matched_user_id)
    )
  );

-- ---------------------------------------------------------------------------
-- reports: the queue is for administrators.
-- ---------------------------------------------------------------------------
drop policy reports_select_own_or_staff on public.reports;

create policy reports_select_staff
  on public.reports for select to authenticated
  using (public.is_admin());

-- Status changes follow the queue: only an administrator sees it, so only an
-- administrator changes it. is_moderator is deliberately not used here; the
-- reports requirement names admins, and moderators have their own surface on
-- profile_photos.
drop policy reports_update_staff on public.reports;

create policy reports_update_staff
  on public.reports for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- user_roles: an administrator sees the table; nobody writes it from a client.
-- ---------------------------------------------------------------------------
drop policy user_roles_select_own on public.user_roles;

create policy user_roles_select_staff
  on public.user_roles for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- profiles: no client DELETE, ever. A profile is hidden or banned, not gone.
-- ---------------------------------------------------------------------------
drop policy profiles_delete_own on public.profiles;
revoke delete on public.profiles from authenticated;
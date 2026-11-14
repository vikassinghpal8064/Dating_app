-- 21 — Profile details, the likes lists, match overviews, unmatch and the
-- unread badge stats.
--
-- Adds the read side of the product surface the deck writes to:
--
--   likes_sent     — "You liked" as people, the mirror of the likes_received
--                    view from migration 17. Both read through public_profiles,
--                    so a hidden, banned or blocked account never appears as
--                    having liked you (or as someone you liked).
--   get_profile    — the only route to another member's full profile page.
--                    Returns ZERO rows for a target who is hidden, banned,
--                    blocked in either direction, the caller themselves or
--                    missing entirely, so /profile/:id renders one
--                    indistinguishable "not available" state and can never
--                    reveal why a profile is gone.
--   list_matches   — a viewer's matches with the partner's public profile,
--                    the last message text and the unread count, newest
--                    activity first.
--   mark_messages_read — recipient-only read receipts for one match.
--   unmatch        — deletes a match and, via the ON DELETE CASCADE on
--                    messages.match_id, the whole thread for both members.
--   unread_stats   — nav badge counts: incoming likes that have not been
--                    reciprocated (and therefore have not become a match),
--                    plus unread received messages.
--
-- Every relation and function here starts from deny: no grants to `anon`, and
-- `authenticated` gets exactly the read/write surface named in the comments.

-- ---------------------------------------------------------------------------
-- likes_sent: "You liked" as people, not as ids.
-- ---------------------------------------------------------------------------
create view public.likes_sent as
select
  pp.id as liked_id,
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
join public.public_profiles pp on pp.id = l.liked_id
where l.liker_id = auth.uid();

comment on view public.likes_sent is
  'The people the caller has liked, as public profile rows. Joins public_profiles, '
  'so a hidden, banned, blocked or deleted target is not revealed as someone the '
  'caller liked. The mirror of likes_received.';

revoke all on public.likes_sent from public;
revoke all on public.likes_sent from anon;
grant select on public.likes_sent to authenticated;

-- ---------------------------------------------------------------------------
-- get_profile: the profile-page door. Signalling absence, never the reason.
-- ---------------------------------------------------------------------------
create or replace function public.get_profile(target_id uuid)
returns table (
  id uuid,
  full_name text,
  age integer,
  gender text,
  interested_in text[],
  bio text,
  photos text[],
  location_city text,
  location_country text,
  distance_bucket text,
  is_online boolean,
  last_active timestamptz,
  is_verified boolean,
  looking_for text,
  interests text[],
  height_cm integer,
  education text,
  occupation text,
  languages text[],
  smoking text,
  drinking text,
  exercise text,
  is_match boolean,
  match_id uuid,
  viewer_liked_type text,
  liked_viewer boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    pp.id,
    pp.full_name,
    pp.age,
    pp.gender,
    pp.interested_in,
    pp.bio,
    pp.photos,
    pp.location_city,
    pp.location_country,
    case when pp.distance_km is null then null else public.distance_bucket(pp.distance_km) end,
    pp.is_online,
    pp.last_active,
    p.is_verified,
    p.looking_for::text,
    coalesce(p.interests, '{}')::text[],
    p.height_cm,
    p.education,
    p.occupation,
    coalesce(p.languages, '{}')::text[],
    p.smoking::text,
    p.drinking::text,
    p.exercise::text,
    m.id is not null as is_match,
    m.id as match_id,
    (
      select l.type::text
      from public.likes l
      where l.liker_id = auth.uid() and l.liked_id = pp.id
      limit 1
    ) as viewer_liked_type,
    exists (
      select 1
      from public.likes l
      where l.liker_id = pp.id and l.liked_id = auth.uid()
    ) as liked_viewer
  from public.public_profiles pp
  join public.profiles p on p.id = pp.id
  left join public.matches m
    on auth.uid() in (m.user_id, m.matched_user_id)
   and pp.id = case when m.user_id = auth.uid() then m.matched_user_id else m.user_id end
  where pp.id = target_id;
$$;

comment on function public.get_profile(uuid) is
  'One member''s full profile page: the public profile columns, the distance '
  'bucket, approximate activity and the lifestyle fields, plus the caller''s '
  'relationship to them (matched / liked them / liked by them). Returns no rows '
  'for hidden, banned, blocked, self or nonexistent targets so the 404 state is '
  'uninformative.';

-- ---------------------------------------------------------------------------
-- list_matches: partner + thread preview + unread count, one call.
-- ---------------------------------------------------------------------------
create or replace function public.list_matches()
returns table (
  match_id uuid,
  created_at timestamptz,
  last_message_at timestamptz,
  partner public_profiles,
  last_message text,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with my_matches as (
    select
      m.id,
      m.created_at,
      m.last_message_at,
      case when m.user_id = auth.uid() then m.matched_user_id else m.user_id end as partner_id
    from public.matches m
    where auth.uid() in (m.user_id, m.matched_user_id)
  ),
  latest_message as (
    select distinct on (msg.match_id) msg.match_id, msg.content
    from public.messages msg
    order by msg.match_id, msg.created_at desc
  ),
  unread as (
    select msg.match_id, count(*) as unread_count
    from public.messages msg
    where msg.sender_id <> auth.uid() and msg.read_at is null
    group by msg.match_id
  )
  select
    mm.id,
    mm.created_at,
    mm.last_message_at,
    pp,
    lm.content,
    coalesce(u.unread_count, 0)
  from my_matches mm
  join public.public_profiles pp on pp.id = mm.partner_id
  left join latest_message lm on lm.match_id = mm.id
  left join unread u on u.match_id = mm.id
  order by mm.last_message_at desc nulls last, mm.created_at desc;
$$;

comment on function public.list_matches() is
  'The viewer''s matches with the partner''s public profile, the text of the '
  'latest message and how many received messages are unread. A match whose '
  'partner has since gone hidden, banned or blocked is simply not listed.';

-- ---------------------------------------------------------------------------
-- mark_messages_read: the recipient marks their received messages read.
-- ---------------------------------------------------------------------------
create or replace function public.mark_messages_read(p_match_id uuid)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.messages m
  set read_at = now()
  where m.match_id = p_match_id
    and m.sender_id <> auth.uid()
    and m.read_at is null
    and exists (
      select 1 from public.matches mm
      where mm.id = m.match_id
        and auth.uid() in (mm.user_id, mm.matched_user_id)
    );
$$;

comment on function public.mark_messages_read(uuid) is
  'Marks every received, still-unread message of a match the caller belongs to '
  'as read. A sender can never mark their own messages.';

-- ---------------------------------------------------------------------------
-- unmatch: ends the match and the thread for both members.
-- ---------------------------------------------------------------------------
create or replace function public.unmatch(p_match_id uuid)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  delete from public.matches m
  where m.id = p_match_id
    and auth.uid() in (m.user_id, m.matched_user_id);
$$;

comment on function public.unmatch(uuid) is
  'Deletes a match the caller belongs to; the ON DELETE CASCADE on messages '
  'removes the whole conversation for both members. Idempotent: a second call '
  'matches nothing.';

-- ---------------------------------------------------------------------------
-- unread_stats: the nav badge numbers.
-- ---------------------------------------------------------------------------
create or replace function public.unread_stats()
returns table (new_likes bigint, unread_messages bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (
      select count(*)
      from public.likes incoming
      join public.public_profiles pp on pp.id = incoming.liker_id
      where incoming.liked_id = auth.uid()
        and not exists (
          select 1 from public.likes outgoing
          where outgoing.liker_id = auth.uid()
            and outgoing.liked_id = incoming.liker_id
        )
    ) as new_likes,
    (
      select count(*)
      from public.messages msg
      join public.matches mm on mm.id = msg.match_id
      where auth.uid() in (mm.user_id, mm.matched_user_id)
        and msg.sender_id <> auth.uid()
        and msg.read_at is null
    ) as unread_messages;
$$;

comment on function public.unread_stats() is
  'Nav badge counts: incoming likes the caller has not reciprocated (so they '
  'have not become matches), and received messages not yet marked read.';

-- ---------------------------------------------------------------------------
-- Grants — members only, and only the named surface.
-- ---------------------------------------------------------------------------
revoke all on function public.get_profile(uuid) from public;
revoke all on function public.get_profile(uuid) from anon;
revoke all on function public.list_matches() from public;
revoke all on function public.list_matches() from anon;
revoke all on function public.mark_messages_read(uuid) from public;
revoke all on function public.mark_messages_read(uuid) from anon;
revoke all on function public.unmatch(uuid) from public;
revoke all on function public.unmatch(uuid) from anon;
revoke all on function public.unread_stats() from public;
revoke all on function public.unread_stats() from anon;

grant execute on function public.get_profile(uuid) to authenticated;
grant execute on function public.list_matches() to authenticated;
grant execute on function public.mark_messages_read(uuid) to authenticated;
grant execute on function public.unmatch(uuid) to authenticated;
grant execute on function public.unread_stats() to authenticated;
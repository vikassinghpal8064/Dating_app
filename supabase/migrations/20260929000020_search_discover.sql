-- 15 — Search, discover and the like/pass actions.
--
-- Everything the /search and /discover pages call that is more than one view
-- read lives here, as SECURITY DEFINER functions with pinned search_path and
-- revoke-from-PUBLIC grants, exactly like migration 13.
--
-- The extra card fields — is_verified, looking_for, interests, height_cm — are
-- returned by the search/deck functions because the profile cards render them.
-- They are still governed by the profile-card contract: no email, no
-- coordinates, no date of birth, no phone, and no exact distance. Distance is
-- returned as a coarse bucket id, computed here on the server, so the browser
-- never receives a number it could triangulate from.

-- ---------------------------------------------------------------------------
-- The city gazetteer behind the search autocomplete
-- ---------------------------------------------------------------------------
-- A static table, not an external geocoding service (free-tier constraint).
-- Coordinates are rounded to two decimals — the same rounding every stored
-- coordinate in this schema carries — so picking a search centre can never
-- reveal a precise location.
create table public.city_coordinates (
  city text not null,
  country text not null default '',
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,

  primary key (city, country),
  constraint city_coordinates_city_length
    check (char_length(city) between 1 and 120),
  constraint city_coordinates_latitude_rounded
    check (latitude between -90 and 90 and latitude = round(latitude, 2)),
  constraint city_coordinates_longitude_rounded
    check (longitude between -180 and 180 and longitude = round(longitude, 2))
);

comment on table public.city_coordinates is
  'Static city gazetteer for the search autocomplete. Coordinates are rounded '
  'to two decimal places, the same coarse rounding stored on profiles, so '
  'choosing a search centre never reveals a precise location.';

alter table public.city_coordinates enable row level security;

create policy city_coordinates_select_authenticated
  on public.city_coordinates
  for select to authenticated
  using (true);

comment on policy city_coordinates_select_authenticated
  on public.city_coordinates is
  'Any signed-in member may read the gazetteer to autocomplete a city. The '
  'table holds no identity data: no members, no numbers, no live locations.';

grant select on public.city_coordinates to authenticated;

-- ---------------------------------------------------------------------------
-- Distance buckets, computed on the server
-- ---------------------------------------------------------------------------
-- The ids below match the client DISTANCE_BUCKETS, so the label text lives in
-- one place (the UI) while the *classification* lives in one place (here).
-- The browser only ever stores or renders a bucket, never a raw distance.
create or replace function public.distance_bucket(distance_km numeric)
returns text
language sql
immutable
as $$
  select case
    when distance_km is null then null
    when distance_km < 1 then 'near'
    when distance_km < 5 then 'walking'
    when distance_km < 10 then 'city'
    when distance_km < 25 then 'region'
    when distance_km < 50 then 'wide'
    when distance_km < 100 then 'far'
    else 'distant'
  end;
$$;

comment on function public.distance_bucket(numeric) is
  'Maps a distance in kilometres onto the coarse bucket id the UI renders. The '
  'boundaries mirror the client DISTANCE_BUCKETS table; never returning the '
  'raw number is what keeps the value safe to hand to the browser.';

-- ---------------------------------------------------------------------------
-- Filterable profile search
-- ---------------------------------------------------------------------------
-- Renders the /search grid. Always excludes: the caller, blocked members in
-- either direction, hidden and banned profiles, and members without at least
-- one approved photo (pasted photo URLs count; the approved-upload rule is
-- mandatory, not a filter the caller can relax).
--
-- Results are sorted by distance from the search centre, then recency of
-- activity. The search centre defaults to the caller's stored location when
-- none is supplied, so the slider keeps meaning "distance from me" without a
-- city chosen.
create or replace function public.search_profiles(
  search_lat double precision default null,
  search_lng double precision default null,
  radius_km double precision default null,
  city_name text default null,
  min_age integer default null,
  max_age integer default null,
  genders text[] default null,
  looking_for_values text[] default null,
  verified_only boolean default false,
  online_only boolean default false,
  interest_values text[] default null,
  height_min_cm integer default null,
  height_max_cm integer default null,
  limit_count integer default 20,
  offset_count integer default 0
)
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
  height_cm integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  viewer profiles%rowtype;
  centre_lat double precision;
  centre_lng double precision;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  -- Client input validation is mirrored here, in the database. Coordinates are
  -- the only values that could probe a member's vicinity, and a one-sided pair
  -- is a bug callers should hear about rather than silently treat as "none".
  if (search_lat is null) <> (search_lng is null) then
    raise exception 'search_lat and search_lng must be supplied together'
      using errcode = 'invalid_parameter_value';
  end if;
  if search_lat is not null and (search_lat not between -90 and 90 or search_lng not between -180 and 180) then
    raise exception 'Coordinates out of range' using errcode = 'invalid_parameter_value';
  end if;
  if radius_km is not null and radius_km <= 0 then
    raise exception 'radius_km must be positive' using errcode = 'invalid_parameter_value';
  end if;
  if min_age is not null and (min_age < 18 or min_age > 120) then
    raise exception 'min_age must be between 18 and 120' using errcode = 'invalid_parameter_value';
  end if;
  if max_age is not null and (max_age < 18 or max_age > 120) then
    raise exception 'max_age must be between 18 and 120' using errcode = 'invalid_parameter_value';
  end if;
  if min_age is not null and max_age is not null and min_age > max_age then
    raise exception 'min_age cannot exceed max_age' using errcode = 'invalid_parameter_value';
  end if;
  if height_min_cm is not null and (height_min_cm < 90 or height_min_cm > 250) then
    raise exception 'height_min_cm out of range' using errcode = 'invalid_parameter_value';
  end if;
  if height_max_cm is not null and (height_max_cm < 90 or height_max_cm > 250) then
    raise exception 'height_max_cm out of range' using errcode = 'invalid_parameter_value';
  end if;
  if height_min_cm is not null and height_max_cm is not null and height_min_cm > height_max_cm then
    raise exception 'height_min_cm cannot exceed height_max_cm'
      using errcode = 'invalid_parameter_value';
  end if;

  select * into viewer from public.profiles where profiles.id = auth.uid();

  -- A missing centre falls back to the caller's stored location, exactly as
  -- the schema's other surfaces do. A named city wins over the fallback: the
  -- gazetteer lives here too, so a shared "?city=Bengaluru" link resolves to
  -- the same rounded search centre for every viewer, without the browser ever
  -- needing (or sending) coordinates.
  if city_name is not null and search_lat is null then
    select cc.latitude::double precision, cc.longitude::double precision
      into centre_lat, centre_lng
      from public.city_coordinates cc
     where lower(cc.city) = lower(city_name)
     limit 1;
  end if;

  if centre_lat is null then
    centre_lat := coalesce(search_lat, viewer.latitude::double precision);
  end if;
  if centre_lng is null then
    centre_lng := coalesce(search_lng, viewer.longitude::double precision);
  end if;

  return query
    select
      p.id,
      coalesce(p.full_name, '') as full_name,
      public.calculate_age(p.date_of_birth::text) as age,
      p.gender::text as gender,
      p.interested_in::text[] as interested_in,
      p.bio,
      p.photos,
      coalesce(p.location_city, '') as location_city,
      coalesce(p.location_country, '') as location_country,
      case
        when centre_lat is null or centre_lng is null
          or p.latitude is null or p.longitude is null
        then null
        else public.distance_bucket(
          public.calculate_distance(
            centre_lat, centre_lng, p.latitude::double precision, p.longitude::double precision
          )::numeric
        )
      end as distance_bucket,
      p.last_active_at > now() - interval '5 minutes' as is_online,
      p.last_active_at as last_active,
      p.is_verified,
      p.looking_for::text as looking_for,
      p.interests,
      p.height_cm
    from public.profiles p
    where p.id is distinct from auth.uid()
      and p.is_visible
      and not p.is_banned
      -- Mandatory photo rule: a profile with no approved photo never appears,
      -- regardless of any filter the caller sets.
      and (
        cardinality(p.photos) > 0
        or exists (
          select 1
          from public.member_photos mp
          where mp.user_id = p.id and mp.moderation_status = 'approved'
        )
      )
      and (city_name is null or lower(p.location_city) = lower(city_name))
      and (
        centre_lat is null or centre_lng is null
        or p.latitude is null or p.longitude is null
        or radius_km is null
        or public.calculate_distance(
          centre_lat, centre_lng, p.latitude::double precision, p.longitude::double precision
        ) <= radius_km
      )
      and not exists (
        select 1
        from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = auth.uid())
      )
      and (min_age is null or public.calculate_age(p.date_of_birth::text) >= min_age)
      and (max_age is null or public.calculate_age(p.date_of_birth::text) <= max_age)
      -- Gender filter means the member's own gender (a profile search browses
      -- people, unlike discovery which matches on preferences).
      and (
        genders is null or cardinality(genders) = 0
        or p.gender::text = any (genders)
      )
      and (
        looking_for_values is null or cardinality(looking_for_values) = 0
        or p.looking_for::text = any (looking_for_values)
      )
      and (not verified_only or p.is_verified)
      and (not online_only or p.last_active_at > now() - interval '5 minutes')
      and (
        interest_values is null or cardinality(interest_values) = 0
        or exists (
          select 1
          from unnest(p.interests) with ordinality as it(value, ord)
          where btrim(it.value) = any (interest_values)
        )
      )
      and (height_min_cm is null or p.height_cm >= height_min_cm)
      and (height_max_cm is null or p.height_cm <= height_max_cm)
    order by
      case
        when centre_lat is null or centre_lng is null
          or p.latitude is null or p.longitude is null
        then null
        else public.calculate_distance(
          centre_lat, centre_lng, p.latitude::double precision, p.longitude::double precision
        )
      end asc nulls last,
      p.last_active_at desc
    limit least(greatest(coalesce(limit_count, 20), 1), 200)
    offset greatest(coalesce(offset_count, 0), 0);
end;
$$;

comment on function public.search_profiles(
  double precision, double precision, double precision, text,
  integer, integer, text[], text[], boolean, boolean,
  text[], integer, integer, integer, integer
) is
  'Filterable profile search for /search. Excludes the caller, any blocked '
  'member (either direction), hidden and banned profiles, and members without '
  'an approved photo. Distance is returned only as a coarse bucket id, never '
  'as a raw value.';

-- ---------------------------------------------------------------------------
-- The /discover deck
-- ---------------------------------------------------------------------------
-- The same result shape as search_profiles, centred on the caller's stored
-- location and bounded by their saved preferences (age range, max distance),
-- with profiles the caller has passed removed. A member with no stored
-- location sees distance as unknown and no radius bound, exactly like the
-- existing discovery feed.
create or replace function public.get_discover_candidates(
  limit_count integer default 20,
  offset_count integer default 0
)
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
  height_cm integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  viewer profiles%rowtype;
  pref user_preferences%rowtype;
  fetch_more integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select * into viewer from public.profiles where profiles.id = auth.uid();
  select * into pref from public.user_preferences where user_id = auth.uid();

  -- Pull a generous window from the shared search so filtering out passed
  -- profiles cannot starve a page; slice to the requested window afterwards.
  fetch_more := least(greatest(coalesce(limit_count, 20), 1), 200) * 4;

  return query
    select
      s.id, s.full_name, s.age, s.gender, s.interested_in, s.bio, s.photos,
      s.location_city, s.location_country, s.distance_bucket, s.is_online,
      s.last_active, s.is_verified, s.looking_for, s.interests, s.height_cm
    from public.search_profiles(
      viewer.latitude::double precision,
      viewer.longitude::double precision,
      pref.max_distance_km::double precision,
      null,
      pref.min_age,
      pref.max_age,
      null, null,
      false, false,
      null, null, null,
      fetch_more, 0
    ) s
    where not exists (
      select 1
      from public.passes p
      where p.user_id = auth.uid() and p.passed_id = s.id
    )
    limit least(greatest(coalesce(limit_count, 20), 1), 200)
    offset greatest(coalesce(offset_count, 0), 0);
end;
$$;

comment on function public.get_discover_candidates(integer, integer) is
  'The swipe deck for /discover: the caller''s neighbourhood per their saved '
  'preferences, without profiles they have passed, and with the same '
  'exclusions and distance-bucket rule as search_profiles.';

-- ---------------------------------------------------------------------------
-- Liking and passing through the API
-- ---------------------------------------------------------------------------
-- Direct INSERT into `likes` is allowed by policy, but the daily limit has to
-- live in the database, not the client, so the deck goes through these.
-- They are SECURITY DEFINER: they must read the target profile's visibility
-- and the block list, which RLS would otherwise hide from the caller.
create or replace function public.send_like(
  target_user_id uuid,
  like_kind public.like_type default 'like'
)
returns table (matched boolean, match_id uuid, created_at timestamptz)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  target profiles%rowtype;
  daily_like_limit constant integer := 100;
  today_start timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if target_user_id is null or target_user_id = auth.uid() then
    raise exception 'Not permitted' using errcode = 'insufficient_privilege';
  end if;

  select * into target from public.profiles where profiles.id = target_user_id;
  if not found or not target.is_visible or target.is_banned then
    raise exception 'That profile is not available' using errcode = 'insufficient_privilege';
  end if;

  if exists (
    select 1
    from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = target_user_id)
       or (b.blocker_id = target_user_id and b.blocked_id = auth.uid())
  ) then
    raise exception 'You cannot like a member you are blocked by or have blocked'
      using errcode = 'insufficient_privilege';
  end if;

  today_start := date_trunc('day', now());
  if (select count(*) from public.likes
     where liker_id = auth.uid() and public.likes.created_at >= today_start) >= daily_like_limit then
    raise exception 'You have reached today''s like limit'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.likes (liker_id, liked_id, type)
  values (auth.uid(), target_user_id, like_kind)
  on conflict (liker_id, liked_id) do nothing;

  matched := false;
  match_id := null;
  if exists (
    select 1
    from public.likes reciprocal
    where reciprocal.liker_id = target_user_id and reciprocal.liked_id = auth.uid()
  ) then
    matched := true;
    select m.id into match_id
    from public.matches m
    where m.user_id = least(auth.uid(), target_user_id)
      and m.matched_user_id = greatest(auth.uid(), target_user_id)
    limit 1;
  end if;
  created_at := now();
  return next;
end;
$$;

comment on function public.send_like(uuid, public.like_type) is
  'Records a like, capped at 100 per member per day, refusing self-likes and '
  'likes of hidden, banned or blocked profiles. Returns whether this completed '
  'a mutual pair and, if so, the new match id (created by the likes trigger).';

create or replace function public.send_pass(target_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if target_user_id is null or target_user_id = auth.uid() then
    raise exception 'Not permitted' using errcode = 'insufficient_privilege';
  end if;

  insert into public.passes (user_id, passed_id)
  values (auth.uid(), target_user_id)
  on conflict (user_id, passed_id) do nothing;
end;
$$;

comment on function public.send_pass(uuid) is
  'Records a one-way pass so the member stops appearing in the discovery deck. '
  'Idempotent: passing someone twice stores a single row.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.search_profiles(
  double precision, double precision, double precision, text,
  integer, integer, text[], text[], boolean, boolean,
  text[], integer, integer, integer, integer
) from public;
revoke all on function public.get_discover_candidates(integer, integer) from public;
revoke all on function public.send_like(uuid, public.like_type) from public;
revoke all on function public.send_pass(uuid) from public;
revoke all on function public.distance_bucket(numeric) from public;

grant execute on function public.search_profiles(
  double precision, double precision, double precision, text,
  integer, integer, text[], text[], boolean, boolean,
  text[], integer, integer, integer, integer
) to authenticated;
grant execute on function public.get_discover_candidates(integer, integer) to authenticated;
grant execute on function public.send_like(uuid, public.like_type) to authenticated;
grant execute on function public.send_pass(uuid) to authenticated;
grant execute on function public.distance_bucket(numeric) to authenticated;
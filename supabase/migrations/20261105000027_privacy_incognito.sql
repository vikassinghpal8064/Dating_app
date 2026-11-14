-- 27 — Privacy: incognito mode and discovery preferences enforcement.

-- ============================================================================
-- 1. Add incognito column to profiles
-- ============================================================================
alter table public.profiles
  add column incognito boolean not null default false;

comment on column public.profiles.incognito is
  'When true, the member is hidden from search and discovery. Does not affect existing matches or messages.';

-- Grant update permission
grant update (incognito) on public.profiles to authenticated;

-- ============================================================================
-- 2. Update public_profiles view to respect incognito
-- ============================================================================
create or replace view public.public_profiles as
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

  -- Distance is only ever a number the UI turns into a coarse band, and it is
  -- withheld outright when either party has asked for it to be hidden.
  case
    when me.id is null then null
    when coalesce(me.show_distance, false) = false then null
    when coalesce((mep.privacy ->> 'show_distance')::boolean, true) = false then null
    when p.show_distance = false then null
    when me.latitude is null or me.longitude is null then null
    when p.latitude is null or p.longitude is null then null
    else round(
      public.calculate_distance(
        me.latitude::double precision,
        me.longitude::double precision,
        p.latitude::double precision,
        p.longitude::double precision
      )::numeric,
      1
    )
  end as distance_km,

  case
    when me.id is null then false
    when coalesce((mep.privacy ->> 'show_online_status')::boolean, true) = false then false
    else p.last_active_at > now() - interval '5 minutes'
  end as is_online,

  -- With last-active hidden, the join date is published instead. It is not a
  -- precise activity signal and it keeps the non-null contract the client types
  -- declare, but it is a substitute rather than the real value.
  case
    when me.id is null then p.created_at
    when coalesce((mep.privacy ->> 'show_last_active')::boolean, true) = false then p.created_at
    else p.last_active_at
  end as last_active

from public.profiles p
left join public.profiles me on me.id = auth.uid()
left join public.user_preferences mep on mep.user_id = me.id
where p.id is distinct from auth.uid()
  and p.is_visible
  and not p.is_banned
  and not p.incognito  -- NEW: respect incognito
  and not exists (
    select 1
    from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

-- ============================================================================
-- 3. Update search_profiles to respect incognito
-- ============================================================================
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
      and not p.incognito  -- NEW: respect incognito
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

revoke all on function public.search_profiles(
  double precision, double precision, double precision, text,
  integer, integer, text[], text[], boolean, boolean,
  text[], integer, integer, integer, integer
) from public;
revoke all on function public.search_profiles(
  double precision, double precision, double precision, text,
  integer, integer, text[], text[], boolean, boolean,
  text[], integer, integer, integer, integer
) from anon;
grant execute on function public.search_profiles(
  double precision, double precision, double precision, text,
  integer, integer, text[], text[], boolean, boolean,
  text[], integer, integer, integer, integer
) to authenticated;

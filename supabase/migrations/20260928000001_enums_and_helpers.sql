-- 01 — Enumerations and immutable helper functions.
--
-- Every enum used by a column lives here so that later migrations reference a
-- type that already exists. The helper functions are IMMUTABLE on purpose:
-- Postgres only permits IMMUTABLE functions inside a CHECK constraint, so
-- anything a CHECK needs to validate has to be declared that way.

-- Enums the application already spoke to. Names and members are unchanged, so
-- no client query changes.
create type public.gender as enum ('male', 'female', 'non_binary', 'prefer_not_to_say');

create type public.interested_in as enum ('male', 'female', 'non_binary', 'everyone');

create type public.message_type as enum ('text', 'image', 'whatsapp_request');

create type public.whatsapp_consent_status as enum ('pending', 'approved', 'declined', 'revoked');

create type public.show_me_to as enum ('everyone', 'interested_in_me', 'matches_only');

-- Enums introduced with this schema.
create type public.looking_for as enum ('casual', 'serious', 'friends', 'unsure');

create type public.share_mode as enum ('never', 'matches', 'approved');

create type public.like_type as enum ('like', 'super_like');

create type public.moderation_status as enum ('pending', 'approved', 'rejected');

create type public.report_reason as enum (
  'harassment',
  'spam',
  'impersonation',
  'nudity',
  'underage',
  'violence',
  'other'
);

create type public.report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');

create type public.user_role as enum ('admin', 'moderator');

-- ---------------------------------------------------------------------------
-- Helper functions used by CHECK constraints
-- ---------------------------------------------------------------------------

-- True when every entry is an absolute https URL with no whitespace. A CHECK
-- constraint may not contain a subquery, so the unnest() has to live inside an
-- immutable function. An empty or NULL array is vacuously true.
create or replace function public.photo_urls_are_https(urls text[])
returns boolean
language sql
immutable
strict
as $$
  select coalesce(bool_and(u ~ '^https://[^[:space:]]+$'), true)
  from unnest(urls) as u;
$$;

-- E.164: a leading '+', a non-zero first digit, then 7 to 14 more digits.
create or replace function public.is_e164(value text)
returns boolean
language sql
immutable
strict
as $$
  select value ~ '^\+[1-9][0-9]{7,14}$';
$$;

-- A single-word-ish human name: no control characters, no angle brackets, so a
-- name can never become markup in any renderer downstream.
create or replace function public.is_plain_name(value text)
returns boolean
language sql
immutable
strict
as $$
  select char_length(value) between 1 and 80
     and value !~ '[[:cntrl:]<>]';
$$;

-- ---------------------------------------------------------------------------
-- Public functions the browser already calls
-- ---------------------------------------------------------------------------

-- The application calls this with an ISO date string, so the parameter is text
-- rather than date; a malformed value yields 0 rather than raising, because a
-- bad row must not take down a whole profile list.
--
-- age(later, earlier) yields the elapsed interval and its `year` field is
-- already the count of completed years, so no month/day correction is needed.
-- The argument order matters: age() subtracts the second from the first.
create or replace function public.calculate_age(date_of_birth text)
returns integer
language sql
immutable
as $$
  select case
    when date_of_birth is null
      or date_of_birth !~ '^\d{4}-\d{2}-\d{2}$'
      or date_of_birth > current_date::text
      then 0
    else greatest(0, extract(year from age(current_date, date_of_birth::date))::integer)
  end;
$$;

comment on function public.calculate_age(text) is
  'Completed years of age for an ISO date string. Returns 0 for an absent or '
  'malformed date rather than raising, so one bad row cannot break a feed.';

-- Great-circle distance in kilometres. Haversine rather than PostGIS: the
-- coordinates are rounded to two decimals before they reach this function, so a
-- spherical model is accurate to well under the coarsest distance band the UI
-- ever renders, and it needs no extension on the free tier.
create or replace function public.calculate_distance(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
returns double precision
language sql
immutable
as $$
  select case
    when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else 6371.0088 * 2.0 * asin(
      sqrt(
        power(sin(radians(lat2 - lat1) / 2.0), 2)
        + cos(radians(lat1)) * cos(radians(lat2))
          * power(sin(radians(lon2 - lon1) / 2.0), 2)
      )
    )
  end;
$$;

comment on function public.calculate_distance(double precision, double precision, double precision, double precision) is
  'Great-circle distance in kilometres between two WGS84 points, or NULL if any '
  'coordinate is unknown.';

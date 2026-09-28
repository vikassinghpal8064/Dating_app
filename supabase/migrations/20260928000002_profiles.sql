-- 02 — profiles and user_preferences.
--
-- Column names follow what the React app already reads and writes
-- (`full_name`, `location_city`, `latitude`, `show_distance`, `is_admin`, …).
-- The richer profile attributes requested for this schema are added as extra
-- columns, which is additive: `select('*')` callers keep working.
--
-- Two columns that were `not null` in the old design become nullable here,
-- because the sign-up trigger (migration 13) has to be able to create a row
-- before the person has filled anything in.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  -- Server-managed identity. Never exposed through `public_profiles`.
  email text unique,

  full_name text,
  date_of_birth date,
  gender public.gender not null default 'prefer_not_to_say',
  interested_in public.interested_in[] not null default '{}',
  bio text not null default '',
  photos text[] not null default '{}',

  location_city text,
  location_state text,
  location_country text,

  -- Stored to six decimal places and truncated to two on write by a trigger
  -- (migration 13). Two decimals is about 1.1 km of latitude, which is coarser
  -- than every distance band the UI renders, so it cannot be used to pinpoint
  -- anyone.
  latitude numeric(9, 6),
  longitude numeric(9, 6),

  height_cm integer,
  education text,
  occupation text,
  looking_for public.looking_for not null default 'unsure',
  interests text[] not null default '{}',
  languages text[] not null default '{}',

  -- Free-text-with-a-fixed-vocabulary rather than enum types: a new value is a
  -- CHECK edit in this file, not an ALTER TYPE that would have to rewrite the
  -- table.
  smoking text not null default 'never',
  drinking text not null default 'socially',
  exercise text not null default 'sometimes',

  show_distance boolean not null default true,
  age_verified boolean not null default false,
  phone_verified boolean not null default false,
  whatsapp_consent boolean not null default false,
  is_verified boolean not null default false,

  -- Maintained by a trigger. Until a profile has a name, a birth date and a
  -- city it is not visible, so an empty row can never appear in discovery.
  is_visible boolean not null default false,
  is_banned boolean not null default false,

  -- Denormalised from `user_roles` by a trigger, because the client reads
  -- `is_admin` off the profile row it already fetched. `user_roles` is the
  -- source of truth; never grant a client write to this column.
  is_admin boolean not null default false,

  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_name_is_plain
    check (full_name is null or public.is_plain_name(full_name)),
  constraint profiles_bio_length
    check (char_length(bio) <= 500),
  constraint profiles_photos_are_https
    check (public.photo_urls_are_https(photos)),
  constraint profiles_photo_count
    check (cardinality(photos) <= 6),
  constraint profiles_interests_count
    check (cardinality(interests) <= 20),
  constraint profiles_languages_count
    check (cardinality(languages) <= 10),
  constraint profiles_dob_is_plausible
    check (date_of_birth is null or date_of_birth between date '1900-01-01' and date '2100-12-31'),
  constraint profiles_latitude_range
    check (latitude is null or (latitude between -90 and 90 and latitude = round(latitude, 2))),
  constraint profiles_longitude_range
    check (longitude is null or (longitude between -180 and 180 and longitude = round(longitude, 2))),
  constraint profiles_height_range
    check (height_cm is null or height_cm between 90 and 250),
  constraint profiles_education_length
    check (education is null or char_length(education) <= 120),
  constraint profiles_occupation_length
    check (occupation is null or char_length(occupation) <= 120),
  constraint profiles_city_length
    check (location_city is null or char_length(location_city) between 1 and 120),
  constraint profiles_state_length
    check (location_state is null or char_length(location_state) <= 120),
  constraint profiles_country_length
    check (location_country is null or char_length(location_country) between 2 and 80),
  constraint profiles_smoking_vocabulary
    check (smoking in ('never', 'occasionally', 'regularly', 'quitting')),
  constraint profiles_drinking_vocabulary
    check (drinking in ('never', 'socially', 'regularly', 'quitting')),
  constraint profiles_exercise_vocabulary
    check (exercise in ('never', 'sometimes', 'often', 'daily'))
);

comment on table public.profiles is
  'One row per auth user. Direct SELECT is restricted to the owner; everything '
  'another member may learn goes through the public_profiles view, which does '
  'not expose email, coordinates or any contact detail.';

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  min_age integer not null default 18,
  max_age integer not null default 99,
  max_distance_km integer not null default 50,
  show_me_to public.show_me_to not null default 'everyone',
  notifications jsonb not null default '{"new_match":true,"new_message":true,"whatsapp_request":true,"profile_liked":true}'::jsonb,
  privacy jsonb not null default '{"show_distance":true,"show_online_status":true,"show_last_active":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_preferences_min_age_floor
    check (min_age >= 18),
  constraint user_preferences_max_age_ceiling
    check (max_age <= 99),
  constraint user_preferences_age_order
    check (min_age <= max_age),
  constraint user_preferences_distance_range
    check (max_distance_km between 1 and 500),
  constraint user_preferences_notifications_shape
    check (
      jsonb_typeof(notifications) = 'object'
      and notifications ?& array['new_match', 'new_message', 'whatsapp_request', 'profile_liked']
    ),
  constraint user_preferences_privacy_shape
    check (
      jsonb_typeof(privacy) = 'object'
      and privacy ?& array['show_distance', 'show_online_status', 'show_last_active']
    )
);

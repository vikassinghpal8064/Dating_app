-- 11 — public_profiles: the only door to another member's profile.
--
-- SECURITY MODEL
-- --------------
-- `profiles` has row-level security that allows SELECT on your own row and
-- nothing else, so this view is deliberately NOT created with
-- `security_invoker = true`. It runs with the privileges of its owner and reads
-- the table directly. That is the design: the column list below *is* the
-- security boundary. `email`, `latitude`, `longitude`, `date_of_birth`,
-- `is_banned` and every column of `private_contacts` are simply not published
-- here, so there is nothing in this relation to leak.
--
-- The consequence, and it matters: adding a column to this SELECT list is a
-- security decision, not a cosmetic one. Nothing else may ever grant SELECT on
-- `profiles` to the authenticated role.
--
-- `supabase db lint` reports `security_definer_view` for this relation. That
-- warning is the price of the design above, not a defect to silence.

create view public.public_profiles as
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
  and not exists (
    select 1
    from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );

comment on view public.public_profiles is
  'Public projection of a member profile. Publishes no email, no coordinates, '
  'no date of birth and no contact detail. Excludes the caller, hidden, banned '
  'and blocked profiles.';

revoke all on public.public_profiles from public;
revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

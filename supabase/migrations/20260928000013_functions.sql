-- 12 — Server functions.
--
-- Everything the browser calls that is more than a plain row read lives here.
-- Each one is SECURITY DEFINER with a pinned search_path, revoked from PUBLIC
-- and granted only to `authenticated`, because RLS would otherwise stop them
-- reading the rows they are supposed to filter. The revoked `PUBLIC` grant is
-- the important half: without it any role, including `anon`, could call them.

-- ---------------------------------------------------------------------------
-- Distance search
-- ---------------------------------------------------------------------------
-- Returns only profiles inside `radius_km` of the supplied point, excluding the
-- caller, anyone hidden or banned, and anyone who blocks the caller or is
-- blocked by them.
--
-- `distance_km` here is measured from the *supplied* search point, not from the
-- caller's stored location. That is deliberately different from the identically
-- named column on public_profiles, which is always relative to the caller.
create or replace function public.search_profiles_by_distance(
  search_lat double precision,
  search_lng double precision,
  radius_km double precision default 50,
  limit_count integer default 50,
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
  distance_km numeric,
  is_online boolean,
  last_active timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  viewer profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if search_lat is null or search_lat not between -90 and 90 then
    raise exception 'Latitude must be between -90 and 90' using errcode = '22023';
  end if;

  if search_lng is null or search_lng not between -180 and 180 then
    raise exception 'Longitude must be between -180 and 180' using errcode = '22023';
  end if;

  if radius_km is null or radius_km <= 0 then
    raise exception 'Radius must be greater than zero' using errcode = '22023';
  end if;

  select * into viewer from public.profiles where profiles.id = auth.uid();

  if not coalesce(viewer.show_distance, false) then
    raise exception 'Distance search is turned off on your profile'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      p.id,
      coalesce(p.full_name, ''),
      public.calculate_age(p.date_of_birth::text),
      p.gender::text,
      p.interested_in::text[],
      p.bio,
      p.photos,
      coalesce(p.location_city, ''),
      coalesce(p.location_country, ''),
      round(
        public.calculate_distance(
          search_lat,
          search_lng,
          p.latitude::double precision,
          p.longitude::double precision
        )::numeric,
        1
      ),
      p.last_active_at > now() - interval '5 minutes',
      p.last_active_at
    from public.profiles p
    where p.id is distinct from auth.uid()
      and p.is_visible
      and not p.is_banned
      and p.latitude is not null
      and p.longitude is not null
      and public.calculate_distance(
            search_lat,
            search_lng,
            p.latitude::double precision,
            p.longitude::double precision
          ) <= radius_km
      and not exists (
        select 1
        from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = auth.uid())
      )
    order by
      public.calculate_distance(
        search_lat,
        search_lng,
        p.latitude::double precision,
        p.longitude::double precision
      ) asc,
      p.last_active_at desc
    limit least(greatest(coalesce(limit_count, 50), 0), 200)
    offset greatest(coalesce(offset_count, 0), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Discovery feed
-- ---------------------------------------------------------------------------
-- Same signature the browser already calls. The `user_id` argument is checked
-- against the caller rather than trusted, so it cannot be used to read someone
-- else's feed.
create or replace function public.get_potential_matches(
  user_id uuid,
  limit_count integer default 20,
  offset_count integer default 0
)
returns setof public.public_profiles
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if user_id is distinct from auth.uid() then
    raise exception 'You can only read your own discovery feed'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select pp.*
    from public.public_profiles pp
    join public.profiles me on me.id = auth.uid()
    join public.user_preferences pref on pref.user_id = me.id
    where pp.age between pref.min_age and pref.max_age
      and (
        pref.max_distance_km is null
        or pp.distance_km is null
        or pp.distance_km <= pref.max_distance_km
      )
      and (me.interested_in::text[] @> array['everyone']::text[] or me.interested_in::text[] @> array[me.gender::text])
      and (pp.interested_in @> array['everyone']::text[] or pp.interested_in @> array[me.gender::text])
      and case pref.show_me_to
        when 'everyone' then true
        when 'interested_in_me' then (
          pp.interested_in @> array['everyone']::text[]
          or pp.interested_in @> array[me.gender::text]
        )
        when 'matches_only' then exists (
          select 1
          from public.matches m
          where (m.user_id = me.id and m.matched_user_id = pp.id)
             or (m.user_id = pp.id and m.matched_user_id = me.id)
        )
      end
      and not exists (
        select 1
        from public.passes p
        where p.user_id = auth.uid() and p.passed_id = pp.id
      )
    order by pp.distance_km asc nulls last, pp.last_active desc
    limit least(greatest(coalesce(limit_count, 20), 0), 200)
    offset greatest(coalesce(offset_count, 0), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Releasing a phone number
-- ---------------------------------------------------------------------------
-- The single read path out of `private_contacts`. Three things must all hold
-- before a single digit comes out: the two members are matched, the owner has
-- not set share_mode to 'never', and — when share_mode is 'approved' — the
-- owner has granted this specific viewer.
create or replace function public.get_contact_number(viewer_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  contact private_contacts%rowtype;
  requested_viewer uuid := viewer_id;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if viewer_id is null or viewer_id = auth.uid() then
    raise exception 'Not permitted' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1
    from public.matches m
    where (m.user_id = auth.uid() and m.matched_user_id = viewer_id)
       or (m.user_id = viewer_id and m.matched_user_id = auth.uid())
  ) then
    raise exception 'Not permitted' using errcode = 'insufficient_privilege';
  end if;

  select * into contact from public.private_contacts where user_id = viewer_id;

  if not found then
    return null;
  end if;

  if contact.share_mode = 'never' then
    return null;
  end if;

  if contact.share_mode = 'approved' then
    -- `viewer_id` is the name of both this function's parameter and a
    -- contact_approvals column. Unqualified it is ambiguous, and PL/pgSQL
    -- raises `column reference "viewer_id" is ambiguous` at runtime rather than
    -- at creation time, so the function compiles and then fails the first time
    -- somebody actually uses share_mode = 'approved'. The local variable is
    -- what keeps the two apart.
    if not exists (
      select 1
      from public.contact_approvals ca
      where ca.owner_id = requested_viewer and ca.viewer_id = auth.uid()
    ) then
      return null;
    end if;
  end if;

  return contact.whatsapp_number;
end;
$$;

comment on function public.get_contact_number(uuid) is
  'Returns a matched member''s WhatsApp number, or NULL when they have not
  consented. The only function in the database that reads private_contacts.';

-- ---------------------------------------------------------------------------
-- WhatsApp handover request / response
-- ---------------------------------------------------------------------------
-- The caller offers *their own* number to a matched member. The number is
-- written to the caller's private_contacts row, never to the consent trail, so
-- no table the other member can read ever contains it.
create or replace function public.request_whatsapp(
  matched_user_id uuid,
  whatsapp_number text
)
returns public.whatsapp_consents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing private_contacts%rowtype;
  consent_row public.whatsapp_consents%rowtype;
  -- `matched_user_id` is both this function's first parameter and a column of
  -- matches and of whatsapp_consents. Unqualified it is ambiguous wherever a
  -- table carrying that column is in scope, and PL/pgSQL raises
  -- `column reference "matched_user_id" is ambiguous` at runtime rather than at
  -- creation time — so the function compiles and then fails on every call.
  recipient uuid := matched_user_id;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if recipient is null or recipient = auth.uid() then
    raise exception 'Not permitted' using errcode = 'insufficient_privilege';
  end if;

  if not public.is_e164(whatsapp_number) then
    raise exception 'That number is not in international E.164 format'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.matches m
    where (m.user_id = auth.uid() and m.matched_user_id = recipient)
       or (m.user_id = recipient and m.matched_user_id = auth.uid())
  ) then
    raise exception 'You can only share contact details with a match'
      using errcode = 'insufficient_privilege';
  end if;

  select * into existing from public.private_contacts where user_id = auth.uid();

  if found then
    if existing.whatsapp_number <> whatsapp_number then
      raise exception 'That is not the number saved on your profile'
        using errcode = '22023';
    end if;

    if existing.share_mode = 'never' then
      raise exception 'Turn on number sharing in Settings before requesting a handover'
        using errcode = 'insufficient_privilege';
    end if;
  else
    -- First time: sharing is an explicit opt-in to matched members, never a
    -- silent default.
    insert into public.private_contacts (user_id, whatsapp_number, share_mode)
    values (auth.uid(), whatsapp_number, 'matches')
    on conflict (user_id) do nothing;
  end if;

  -- The conflict target names the constraint rather than the columns, because
  -- `on conflict (user_id, matched_user_id)` is itself ambiguous here: the
  -- second name is a parameter of this function as well as a column.
  insert into public.whatsapp_consents (user_id, matched_user_id, status)
  values (auth.uid(), recipient, 'pending')
  on conflict on constraint whatsapp_consents_unique_pair do update
    set status = 'pending',
        requested_at = now(),
        responded_at = null
  returning * into consent_row;

  return consent_row;
end;
$$;

-- The matched member answers. Approving records a contact_approvals grant; it
-- does not override an owner who has set share_mode to 'never'.
create or replace function public.respond_whatsapp_request(
  consent_id uuid,
  status public.whatsapp_consent_status
)
returns public.whatsapp_consents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  consent_row public.whatsapp_consents%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if status not in ('approved', 'declined') then
    raise exception 'A request can only be approved or declined'
      using errcode = '22023';
  end if;

  select * into consent_row
  from public.whatsapp_consents
  where whatsapp_consents.id = consent_id
    and whatsapp_consents.matched_user_id = auth.uid();

  if not found then
    raise exception 'Not permitted' using errcode = 'insufficient_privilege';
  end if;

  update public.whatsapp_consents
  set status = respond_whatsapp_request.status,
      responded_at = now()
  where id = consent_id
  returning * into consent_row;

  if status = 'approved' then
    insert into public.contact_approvals (owner_id, viewer_id)
    values (consent_row.user_id, auth.uid())
    on conflict do nothing;
  else
    delete from public.contact_approvals
    where owner_id = consent_row.user_id and viewer_id = auth.uid();
  end if;

  return consent_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.search_profiles_by_distance(double precision, double precision, double precision, integer, integer) from public;
revoke all on function public.get_potential_matches(uuid, integer, integer) from public;
revoke all on function public.get_contact_number(uuid) from public;
revoke all on function public.request_whatsapp(uuid, text) from public;
revoke all on function public.respond_whatsapp_request(uuid, public.whatsapp_consent_status) from public;

grant execute on function public.search_profiles_by_distance(double precision, double precision, double precision, integer, integer) to authenticated;
grant execute on function public.get_potential_matches(uuid, integer, integer) to authenticated;
grant execute on function public.get_contact_number(uuid) to authenticated;
grant execute on function public.request_whatsapp(uuid, text) to authenticated;
grant execute on function public.respond_whatsapp_request(uuid, public.whatsapp_consent_status) to authenticated;

-- The browser has always been able to call these two.
revoke all on function public.calculate_age(text) from public;
revoke all on function public.calculate_distance(double precision, double precision, double precision, double precision) from public;
grant execute on function public.calculate_age(text) to authenticated;
grant execute on function public.calculate_distance(double precision, double precision, double precision, double precision) to authenticated;

-- Role helpers, defined in migration 09. RLS policies run as the querying role,
-- so `authenticated` needs EXECUTE on them.
revoke all on function public.is_admin() from public;
revoke all on function public.is_moderator() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_moderator() to authenticated;

-- ---------------------------------------------------------------------------
-- CHECK constraint helpers.
-- ---------------------------------------------------------------------------
-- These three are named inside CHECK constraints, and Postgres evaluates a
-- constraint expression as the role that issued the statement, not as the table
-- owner. So a member writing their own profile needs EXECUTE on
-- is_plain_name and photo_urls_are_https, and a member saving their own number
-- needs it on is_e164. Without these grants the write fails with
-- `permission denied for function ...` and 42501 — which reads exactly like a
-- schema bug rather than a privilege one.
--
-- This is not a hole. Each is `language sql`, `immutable`, takes text or a text
-- array, touches no table, and returns a boolean. There is nothing in them to
-- read: they cannot reach a profile, a number, or a coordinate. `anon` is
-- still granted nothing, so an unsigned request cannot call them either.
revoke all on function public.is_plain_name(text) from public;
revoke all on function public.photo_urls_are_https(text[]) from public;
revoke all on function public.is_e164(text) from public;
grant execute on function public.is_plain_name(text) to authenticated;
grant execute on function public.photo_urls_are_https(text[]) to authenticated;
grant execute on function public.is_e164(text) to authenticated;

-- 22 — "Pause my profile": a member-controlled visibility switch.
--
-- Visibility was, until now, purely derived: `prepare_profile_write` recomputes
-- `profiles.is_visible` from name + birth date + city on every write, so there
-- was no way to pause a profile and no honest way to hide one on purpose. This
-- migration adds a persisted, member-controlled `profile_paused` flag and folds
-- it into that derivation: a paused profile gets `is_visible = false`, which
-- every consumer backend already respects (the `public_profiles` view, the
-- discover/search RPCs and the new `get_profile` door all filter on
-- `is_visible`), and an unpause restores the derived value.
--
-- `profile_paused` is deliberately NOT in the server-managed list that pins
-- `is_admin`/`is_banned`/`is_verified` back to their old values: pausing is the
-- one field a member is supposed to control. The RLS UPDATE policy on profiles
-- is still strictly own-row, so nobody can pause (or unpause) anyone else.

alter table public.profiles
  add column profile_paused boolean not null default false;

comment on column public.profiles.profile_paused is
  'Member-controlled pause switch. When true, the derived `is_visible` is forced '
  'to false, removing the member from every discovery, search and profile surface '
  'until they unpause. Never directly requested as `is_visible` on the wire: the '
  'trigger below still derives that column.';

-- The UPDATE column grant (migration 15) is explicit, so the one new
-- member-writable column needs its own grant; RLS still restricts updates to
-- the row's owner via the existing own-row policy.
grant update (profile_paused) on public.profiles to authenticated;

-- Redefine 20260928000014's function verbatim, with one change: the derivation
-- must also stay off while the member has paused their profile, no matter which
-- column the update touches (a later UPDATE of e.g. `bio` must not resurrect a
-- paused member).
create or replace function public.prepare_profile_write()
returns trigger
language plpgsql
as $$
declare
  -- A write is trusted when it did not come from a member through the data API.
  -- Two things establish that, and both are needed:
  --
  --   * the app.server_write flag, which a SECURITY DEFINER trigger sets while
  --     doing a legitimate server-side write on a member's behalf, and
  --   * the current role. PostgREST authenticates as `anon` or `authenticated`
  --     and nothing else, so a write arriving as `postgres` — a migration, a
  --     seed, an operator script — is not a member write and is not subject to
  --     the guards below.
  --
  -- The role test is what lets `supabase db reset` load a seed without faking a
  -- flag. The flag is what keeps the SECURITY DEFINER triggers below working,
  -- because they run as the owner while acting for a member.
  server_write boolean :=
    coalesce(current_setting('app.server_write', true), 'off') = 'on'
    or current_user not in ('anon', 'authenticated');
begin
  -- 1. Coordinates are rounded to two decimals before they are ever stored, so
  --    no downstream reader can reconstruct a precise position.
  new.latitude := case when new.latitude is null then null else round(new.latitude, 2) end;
  new.longitude := case when new.longitude is null then null else round(new.longitude, 2) end;

  -- 2. Minimum age. Applied on every write, not just sign-up, so a later edit
  --    cannot lower someone's date of birth below the threshold.
  if new.date_of_birth is not null then
    if new.date_of_birth > current_date then
      raise exception 'Date of birth cannot be in the future'
        using errcode = 'check_violation';
    end if;

    if new.date_of_birth > (current_date - interval '18 years')::date then
      raise exception 'You must be at least 18 years old to use this app'
        using errcode = 'check_violation';
    end if;
  end if;

  -- 3. Server-managed fields. The INSERT column grant has to include
  --    age_verified and phone_verified because the sign-up form still sends
  --    them explicitly, which makes this guard load-bearing rather than
  --    decorative: without it a member could claim to be verified.
  if tg_op = 'INSERT' then
    if not server_write then
      new.is_admin := false;
      new.is_banned := false;
      new.is_verified := false;
      new.age_verified := false;
      new.phone_verified := false;
      new.last_active_at := now();
    end if;
  else
    new.id := old.id;
    new.created_at := old.created_at;

    if not server_write then
      new.is_admin := old.is_admin;
      new.is_banned := old.is_banned;
      new.is_verified := old.is_verified;
      new.age_verified := old.age_verified;
      new.phone_verified := old.phone_verified;
      new.last_active_at := old.last_active_at;
    end if;
  end if;

  -- 4. Visibility is derived, never requested. A row that is missing a name, a
  --    birth date or a city stays out of discovery until it has all three, so
  --    the empty row the sign-up trigger creates cannot surface as a blank card.
  --    A member who has paused their profile stays out no matter how complete
  --    the row is; the member-controlled `profile_paused` flag is the only
  --    member-writable input to this derivation.
  new.is_visible := (
    new.full_name is not null
    and btrim(new.full_name) <> ''
    and new.date_of_birth is not null
    and new.location_city is not null
    and btrim(new.location_city) <> ''
    and not new.profile_paused
  );

  new.updated_at := now();
  return new;
end;
$$;

comment on function public.prepare_profile_write() is
  'Guards every profile write: pads no fields, pins server-managed flags for '
  'member writes, rounds coordinates, enforces the 18+ rule and derives '
  'is_visible from completeness plus the member-controlled profile_paused flag.';
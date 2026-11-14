-- 13 — Triggers.
--
-- Triggers rather than CHECK constraints for anything that depends on "now".
-- Postgres rejects a non-immutable function inside a CHECK, so the two rules
-- that involve the current date (minimum age, visibility once a profile is
-- filled in) cannot be expressed that way.

-- ---------------------------------------------------------------------------
-- Generic updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger private_contacts_set_updated_at
  before update on public.private_contacts
  for each row execute function public.set_updated_at();

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

create trigger profile_photos_set_updated_at
  before update on public.profile_photos
  for each row execute function public.set_updated_at();

create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Everything that happens to a profile row before it is stored
-- ---------------------------------------------------------------------------
-- One trigger, so the order the rules run in cannot depend on trigger-name
-- ordering. `app.server_write` is a transaction-local flag that a SECURITY
-- DEFINER trigger sets while it is doing a legitimate server-side write; it is
-- the only way past the guards below.
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
  new.is_visible := (
    new.full_name is not null
    and btrim(new.full_name) <> ''
    and new.date_of_birth is not null
    and new.location_city is not null
    and btrim(new.location_city) <> ''
  );

  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_prepare_write
  before insert or update on public.profiles
  for each row execute function public.prepare_profile_write();

-- ---------------------------------------------------------------------------
-- user_roles -> profiles.is_admin
-- ---------------------------------------------------------------------------
create or replace function public.propagate_role_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid;
  has_admin boolean;
begin
  if tg_op = 'DELETE' then
    target := old.user_id;
  else
    target := new.user_id;
  end if;

  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = target and ur.role = 'admin'
  ) into has_admin;

  perform set_config('app.server_write', 'on', true);

  update public.profiles
     set is_admin = has_admin
   where id = target
     and is_admin is distinct from has_admin;

  perform set_config('app.server_write', 'off', true);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger user_roles_propagate_to_profile
  after insert or update or delete on public.user_roles
  for each row execute function public.propagate_role_to_profile();

-- ---------------------------------------------------------------------------
-- profile_photos -> profiles.photos
-- ---------------------------------------------------------------------------
-- `profile_photos` is the authoritative list; `profiles.photos` stays in step
-- so the browser keeps reading the array it already reads.
-- ---------------------------------------------------------------------------
-- Photo deny-list
-- ---------------------------------------------------------------------------
-- `profiles.photos` belongs to the member and is the array the browser renders.
-- `profile_photos` records the URLs a moderator has refused. Two triggers keep
-- that promise, and both are needed:
--
--   * strip_rejected_photos runs on every write to profiles.photos, so a
--     member cannot re-add an image that was refused;
--   * sync_profile_photos runs when a moderator changes a verdict, so refusing
--     an image pulls it out of the member's list straight away.
--
-- Neither ever adds a URL. Reversing a rejection does not resurrect the photo:
-- the member re-adds it. That keeps this table from becoming a second source of
-- truth that can contradict the member's own list.

-- SECURITY DEFINER because a member may not read profile_photos at all: RLS on
-- it allows only their own rows, and the verdict on an image is not theirs to
-- see. Reading it as the owner is what makes the filter work at all.
create or replace function public.strip_rejected_photos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.photos is null then
    return new;
  end if;

  new.photos := (
    select coalesce(array_agg(p.url order by p.ord), '{}'::text[])
    from unnest(new.photos) with ordinality as p(url, ord)
    where not exists (
      select 1
      from public.profile_photos pp
      where pp.user_id = new.id
        and pp.storage_path = p.url
        and pp.moderation_status = 'rejected'
    )
  );

  return new;
end;
$$;

-- Named to sort after prepare_profile_write ('p' < 's'), so the six
-- server-managed fields are pinned before the photo list is filtered. The two
-- touch different columns, so the order is tidiness rather than correctness.
create trigger profiles_strip_rejected_photos
  before insert or update of photos on public.profiles
  for each row execute function public.strip_rejected_photos();

create or replace function public.sync_profile_photos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid;
begin
  if tg_op = 'DELETE' then
    target := old.user_id;
  else
    target := new.user_id;
  end if;

  perform set_config('app.server_write', 'on', true);

  -- Subtract rather than rebuild. The previous version replaced the whole array
  -- with the approved rows, which wiped a member's photos whenever a single
  -- verdict changed; this removes only what was actually refused and leaves
  -- every other URL, and its position, exactly as the member left it.
  update public.profiles p
     set photos = (
       select coalesce(array_agg(q.url order by q.ord), '{}'::text[])
       from unnest(coalesce(p.photos, '{}'::text[]))
            with ordinality as q(url, ord)
       where not exists (
         select 1
         from public.profile_photos pp
         where pp.user_id = p.id
           and pp.storage_path = q.url
           and pp.moderation_status = 'rejected'
       )
     )
   where p.id = target;

  perform set_config('app.server_write', 'off', true);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger profile_photos_sync_profiles_photos
  after insert or update or delete on public.profile_photos
  for each row execute function public.sync_profile_photos();

-- ---------------------------------------------------------------------------
-- New auth user -> empty profile + default preferences
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- The sign-up form sends what it collects as GoTrue user metadata, because
  -- with email confirmation on there is no session yet and a member cannot
  -- write their own profile row. Hydrated here, server-side, before GoTrue
  -- even returns. The `prepare_profile_write` trigger then re-checks the age
  -- and derives visibility on the row exactly as it would for any other write.
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  perform set_config('app.server_write', 'on', true);

  insert into public.profiles (
    id, email, full_name, date_of_birth, gender, interested_in,
    location_city, location_country
  )
  values (
    new.id, new.email,
    nullif(btrim(meta->>'full_name'), ''),
    case
      when meta->>'date_of_birth' is null or meta->>'date_of_birth' = '' then null
      else (meta->>'date_of_birth')::date
    end,
    case
      when meta->>'gender' is not null then (meta->>'gender')::public.gender
      else 'prefer_not_to_say'::public.gender
    end,
    case
      when jsonb_typeof(meta->'interested_in') = 'array'
      then (
        select coalesce(array_agg(v.value::public.interested_in order by v.ord), '{}'::public.interested_in[])
        from jsonb_array_elements_text(meta->'interested_in') with ordinality as v(value, ord)
      )
      else '{}'::public.interested_in[]
    end,
    nullif(btrim(meta->>'location_city'), ''),
    nullif(btrim(meta->>'location_country'), '')
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  perform set_config('app.server_write', 'off', true);
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates the profile and default preferences row for every new auth user,
  hydrating what the sign-up form collected as GoTrue user metadata. Columns
  the form cannot know or that are left for onboarding (bio, interests,
  photos) keep their defaults, so a fresh member is deliberately incomplete
  and the app routes them to the finishing screens.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The mirrored copy of the address has to follow auth.users, or Settings would
-- show a stale one after an email change.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('app.server_write', 'on', true);

  update public.profiles set email = new.email where id = new.id;

  perform set_config('app.server_write', 'off', true);
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

-- ---------------------------------------------------------------------------
-- Mutual like -> exactly one match
-- ---------------------------------------------------------------------------
create or replace function public.create_match_on_mutual_like()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.likes reciprocal
    where reciprocal.liker_id = new.liked_id
      and reciprocal.liked_id = new.liker_id
  ) then
    return new;
  end if;

  insert into public.matches (user_id, matched_user_id)
  values (least(new.liker_id, new.liked_id), greatest(new.liker_id, new.liked_id))
  on conflict (user_id, matched_user_id) do nothing;

  return new;
end;
$$;

comment on function public.create_match_on_mutual_like() is
  'Creates the match when a like completes a mutual pair. The pair is stored
  smallest-uuid-first so the unique constraint makes this idempotent.';

create trigger likes_create_match
  after insert on public.likes
  for each row execute function public.create_match_on_mutual_like();

-- ---------------------------------------------------------------------------
-- Activity signal
-- ---------------------------------------------------------------------------
create or replace function public.touch_last_active()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('app.server_write', 'on', true);

  update public.profiles
     set last_active_at = now()
   where id = new.sender_id
     and last_active_at < now() - interval '5 minutes';

  perform set_config('app.server_write', 'off', true);
  return new;
end;
$$;

create trigger messages_touch_last_active
  after insert on public.messages
  for each row execute function public.touch_last_active();

revoke all on function public.set_updated_at() from public;
revoke all on function public.prepare_profile_write() from public;
revoke all on function public.propagate_role_to_profile() from public;
revoke all on function public.sync_profile_photos() from public;
revoke all on function public.strip_rejected_photos() from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.sync_profile_email() from public;
revoke all on function public.create_match_on_mutual_like() from public;
revoke all on function public.touch_last_active() from public;

-- 19 — member_photos: the member's own uploads.
--
-- `member_photos` is the account of every file a member uploaded into the
-- private `profile-photos` bucket. It deliberately sits *next to* the legacy
-- `profiles.photos` / `profile_photos` URL system rather than replacing it:
--
--   * `profiles.photos` keeps holding pasted https:// URLs (a checked-in,
--     pgTAP-pinned contract, migration 04/07 — untouched).
--   * `member_photos` records uploaded objects, one row per stored file, with
--     the moderation state the storage layer cannot express (storage.objects
--     has no moderation column).
--
-- The two systems stay separate so the load-bearing URL machinery and its 39
-- tests keep working unchanged. Both are merged client-side when a profile is
-- rendered.
--
-- Security model (matches every other table in this schema):
--   * RLS on, default deny. The only grant is SELECT; every mutation goes
--     through a SECURITY DEFINER RPC so the position arithmetic, the six-photo
--     cap and the moderation flip can never be bypassed by a stray INSERT.
--   * A member reads their own rows always (pending ones included, so their own
--     profile is immediate).
--   * Moderators read everything (the moderation queue).
--   * Any other member reads ONLY rows that are `approved` AND whose owner is a
--     member `public_profiles` exposes to *them* — the same boundary the
--     discovery feed already enforces (not banned, not blocked either way,
--     not hidden, not the caller).
--
-- The storage SELECT policy is recreated under the SAME name
-- (`profile_photos_select_own_or_visible`, keeping 08's five-policy pin): an
-- object is now readable in your own folder, or when an *approved* member_photos
-- row names it. The moderation check composes through member_photos' own RLS,
-- so approval can never be widened by guessing a storage path.

create table public.member_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  position smallint not null default 0,
  moderation_status public.moderation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The path is <owner-uid>/<uuid>.webp or <owner-uid>/<uuid>.jpg — the two
  -- shapes the pipeline produces (WebP where the engine can encode it, JPEG
  -- where it cannot). A plain regex, deliberately NOT a helper function, so
  -- the three CHECK-helper count that test 01 pins stays at exactly three.
  constraint member_photos_storage_path_pattern
    check (storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$'),
  constraint member_photos_position_range
    check (position between 0 and 5),
  -- Deferrable so a reorder can swap two rows inside one function call without
  -- tripping the unique index row-by-row beforehand.
  constraint member_photos_unique_position
    unique (user_id, position) deferrable initially deferred
);

comment on table public.member_photos is
  'One row per photo the member uploaded to the private profile-photos bucket. '
  'The moderation state lives here; the bytes live in storage.';

create index member_photos_owner_position_idx on public.member_photos (user_id, position);
create index member_photos_moderation_queue_idx on public.member_photos (moderation_status, created_at);

create trigger member_photos_set_updated_at
  before update on public.member_photos
  for each row execute function public.set_updated_at();

alter table public.member_photos enable row level security;

-- Own rows, the moderation queue, or approved uploads of a member the viewer's
-- public_profiles actually exposes. `exists on public_profiles` is a view read,
-- not a function call, so 01's pinned policy-helper count (3) is untouched.
create policy member_photos_select_own_or_visible
  on public.member_photos for select to authenticated
  using (
    auth.uid() = user_id
    or public.is_admin()
    or (
      moderation_status = 'approved'
      and exists (
        select 1 from public.public_profiles pp where pp.id = member_photos.user_id
      )
    )
  );

-- No direct INSERT/UPDATE/DELETE on this table, under any role other than the
-- owner implied by the definer functions below. That is the moderation wall:
-- a member can never mark their own photo approved, because they cannot touch
-- the row except through record_member_photo, whose approval step is gated by
-- the auto-checks.
grant select on public.member_photos to authenticated;

-- ---------------------------------------------------------------------------
-- Storage reads: drop and recreate the five-policy set under the same name.
-- ---------------------------------------------------------------------------
drop policy profile_photos_select_own_or_visible on storage.objects;

create policy profile_photos_select_own_or_visible
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or exists (
        select 1
        from public.member_photos mp
        where mp.storage_path = storage.objects.name
          and mp.moderation_status = 'approved'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Auto-checks: the only thing that can approve a photo without a human
-- moderator. Called from record_member_photo; not callable by the client.
-- ---------------------------------------------------------------------------
create or replace function public.member_photo_passes_auto_checks(photo_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  meta jsonb;
begin
  if photo_path is null or photo_path = '' then
    return false;
  end if;

  select o.metadata into meta
    from storage.objects o
   where o.bucket_id = 'profile-photos'
     and o.name = photo_path;

  -- The object must actually exist: an approved row with no bytes is a broken
  -- profile, and a pending row for a missing object is a queue item a moderator
  -- can safely delete instead of approving.
  if not found then
    return false;
  end if;

  -- The upload pipeline converts everything to WebP where the engine can
  -- encode it (~80% quality, capped at 200 KB client-side) and to JPEG where
  -- it cannot (WebKit). The declared mimetype must match the extension the
  -- pipeline chose — a `.webp` object claiming a JPEG type (or vice versa)
  -- was not produced by it: content sniffing means a renamed .exe never
  -- reaches this point, but a mis-typed content-type would.
  if (photo_path like '%.webp' and meta ->> 'mimetype' <> 'image/webp')
     or (photo_path like '%.jpg' and meta ->> 'mimetype' <> 'image/jpeg') then
    return false;
  end if;

  if (meta ->> 'size')::bigint < 1024
     or (meta ->> 'size')::bigint > 250000 then
    return false;
  end if;

  -- Dimensions are only consulted when the uploader supplied them; the format
  -- and size contracts above are the ones the client guarantees.
  if meta ? 'width' and meta ? 'height' then
    if (meta ->> 'width')::int < 200 or (meta ->> 'width')::int > 4000
       or (meta ->> 'height')::int < 200 or (meta ->> 'height')::int > 4000 then
      return false;
    end if;
  end if;

  return true;
end;
$$;

revoke all on function public.member_photo_passes_auto_checks(text) from public;

-- ---------------------------------------------------------------------------
-- record_member_photo: the only INSERT path. Validates the path belongs to the
-- caller's own storage folder, enforces the six-photo cap, assigns the next
-- position, then lets the auto-checks decide between approved and pending.
-- ---------------------------------------------------------------------------
create or replace function public.record_member_photo(photo_path text)
returns public.member_photos
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  folder text;
  next_position smallint;
  inserted public.member_photos%rowtype;
begin
  if me is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if photo_path is null or photo_path = '' then
    raise exception 'A storage path is required' using errcode = '22023';
  end if;

  -- Validate the shape before touching the folder: a path that is not even
  -- <uuid>/<uuid>.webp or <uuid>/<uuid>.jpg is a client bug, not a folder
  -- ownership problem.
  if photo_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg)$' then
    raise exception 'A photo path must be <owner-uid>/<uuid>.webp or <owner-uid>/<uuid>.jpg'
      using errcode = '22023';
  end if;

  folder := (storage.foldername(photo_path))[1];
  if folder is null or folder <> me::text then
    raise exception 'You can only record photos in your own folder'
      using errcode = 'insufficient_privilege';
  end if;

  if (select count(*) from public.member_photos where user_id = me) >= 6 then
    raise exception 'A profile can hold at most six photos'
      using errcode = 'check_violation';
  end if;

  -- Next free position, gap-tolerant: deletions leave holes, reorders compact
  -- them, and this never collides with the (deferred) unique constraint.
  select coalesce(max(position) + 1, 0) into next_position
    from public.member_photos
   where user_id = me;

  insert into public.member_photos (user_id, storage_path, position)
  values (me, photo_path, next_position)
  returning * into inserted;

  if public.member_photo_passes_auto_checks(photo_path) then
    update public.member_photos
       set moderation_status = 'approved'
     where id = inserted.id
     returning * into inserted;
  end if;

  return inserted;
end;
$$;

revoke all on function public.record_member_photo(text) from public;
grant execute on function public.record_member_photo(text) to authenticated;

-- ---------------------------------------------------------------------------
-- reorder_member_photos: swaps the display order. Positions must be a
-- permutation of 0..n-1 and every photo must belong to the caller.
-- ---------------------------------------------------------------------------
create or replace function public.reorder_member_photos(photo_ids uuid[], positions integer[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  n integer;
  i integer;
  mine public.member_photos%rowtype;
begin
  if me is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  n := array_length(photo_ids, 1);
  if n is null or n = 0 then
    return;
  end if;

  if n <> array_length(positions, 1) then
    raise exception 'photo_ids and positions must be the same length'
      using errcode = '22023';
  end if;

  if (select count(distinct p) <> n from unnest(positions) as u(p))
     or (select min(p) <> 0 from unnest(positions) as u(p))
     or (select max(p) <> n - 1 from unnest(positions) as u(p)) then
    raise exception 'Positions must be a permutation of 0..n-1'
      using errcode = '22023';
  end if;

  if (select count(distinct id) <> n from unnest(photo_ids) as u(id)) then
    raise exception 'photo_ids must be distinct'
      using errcode = '22023';
  end if;

  for i in 1..n loop
    select * into mine from public.member_photos where id = photo_ids[i];
    if not found or mine.user_id <> me then
      raise exception 'You can only reorder your own photos'
        using errcode = 'insufficient_privilege';
    end if;
  end loop;

  for i in 1..n loop
    update public.member_photos
       set position = positions[i]
     where id = photo_ids[i];
  end loop;
end;
$$;

revoke all on function public.reorder_member_photos(uuid[], integer[]) from public;
grant execute on function public.reorder_member_photos(uuid[], integer[]) to authenticated;

-- ---------------------------------------------------------------------------
-- delete_member_photo: removes an own row and compacts the remaining
-- positions so the main photo stays at position 0. The bytes in storage are
-- removed by the client (it holds the delete grant on its own folder).
-- ---------------------------------------------------------------------------
create or replace function public.delete_member_photo(photo_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  mine public.member_photos%rowtype;
begin
  if me is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select * into mine from public.member_photos where id = photo_id;
  if not found or mine.user_id <> me then
    raise exception 'You can only delete your own photos'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.member_photos where id = photo_id;

  -- Compact: photos 0..n-1 again, in current display order.
  update public.member_photos mp
     set position = t.rn - 1
    from (
      select id, row_number() over (order by position, created_at) as rn
        from public.member_photos
       where user_id = me
    ) t
   where mp.id = t.id;
end;
$$;

revoke all on function public.delete_member_photo(uuid) from public;
grant execute on function public.delete_member_photo(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- set_member_photo_moderation: human decision, moderators only. Members cannot
-- approve their own uploads by any route — there is no other write path.
-- ---------------------------------------------------------------------------
create or replace function public.set_member_photo_moderation(photo_id uuid, next_status public.moderation_status)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if not public.is_admin() then
    raise exception 'Only a moderator can change a photo''s moderation status'
      using errcode = 'insufficient_privilege';
  end if;

  update public.member_photos
     set moderation_status = next_status
   where id = photo_id;

  if not found then
    raise exception 'No such photo' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.set_member_photo_moderation(uuid, public.moderation_status) from public;
grant execute on function public.set_member_photo_moderation(uuid, public.moderation_status) to authenticated;
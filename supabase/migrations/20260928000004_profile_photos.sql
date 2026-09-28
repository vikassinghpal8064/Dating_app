-- 04 — profile_photos, a deny-list of images a moderator has refused.
--
-- `profiles.photos` is the list the browser renders, it is what the member
-- writes, and it is authoritative. `profile_photos` records exactly one thing
-- about it: which of those URLs a moderator has rejected. A rejected URL is
-- removed from `profiles.photos` and is filtered out of any later write that
-- tries to put it back, so a member cannot re-add what they were refused.
--
-- The relationship is deliberately one-directional. This table never adds a
-- photo to `profiles.photos`, and reversing a rejection does not resurrect one:
-- if a moderator is satisfied, the member re-adds the photo themselves. Anything
-- else would make this table a second source of truth that could quietly
-- contradict the member's own list, which is the failure mode it was built to
-- remove.
--
-- `moderation_status` records the moderator's position on a URL. Only
-- 'rejected' has an effect here; 'pending' and 'approved' mean "not objected
-- to" and are the states a URL passes through before it is refused.

create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  position smallint not null default 0,
  moderation_status public.moderation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profile_photos_storage_path_is_https
    check (storage_path ~ '^https://[^[:space:]]+$'),
  constraint profile_photos_position_range
    check (position between 0 and 5),
  constraint profile_photos_unique_position
    unique (user_id, position, moderation_status)
);

comment on table public.profile_photos is
  'Deny-list of photo URLs a moderator has rejected. Rows with '
  'moderation_status = ''rejected'' are removed from, and filtered out of '
  'writes to, profiles.photos. Nothing in this table is ever added to '
  'profiles.photos.';

-- Ordering is a property of the row, so re-ordering cannot produce two photos
-- claiming the same slot for the same moderation status. It is moderator
-- bookkeeping only: the order the UI renders in comes from profiles.photos.
create index profile_photos_denied_url_idx
  on public.profile_photos (user_id, storage_path)
  where moderation_status = 'rejected';

create index profile_photos_moderation_queue_idx
  on public.profile_photos (moderation_status, created_at)
  where moderation_status = 'pending';

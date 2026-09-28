-- 08 — blocks and reports.
--
-- `blocks` is a two-way exclusion list: once a block exists in either
-- direction, discovery, search and messaging treat the pair as invisible. That
-- is deliberate — a blocker must not be discoverable by the person they
-- blocked, and that has to hold even if the block is later deleted.
--
-- `reports` is the moderation queue. A member can file one and read their own;
-- resolving one needs a role in `user_roles`.

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (blocker_id, blocked_id),
  constraint blocks_not_self
    check (blocker_id <> blocked_id)
);

comment on table public.blocks is
  'Block list. Both rows are hidden from each other: a blocked member neither '
  'appears in the blocker''s discovery feed nor in search results.';

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason public.report_reason not null,
  details text,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reports_not_self
    check (reporter_id <> reported_id),
  constraint reports_unique_pair
    unique (reporter_id, reported_id),
  constraint reports_details_length
    check (details is null or char_length(details) <= 2000),
  constraint reports_details_is_plain
    check (details is null or details !~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
);

comment on table public.reports is
  'Moderation queue. Members file and read their own reports; only a role in '
  'user_roles can change status. Reported members never see who reported them.';

create index reports_status_created_at_idx
  on public.reports (status, created_at)
  where status in ('open', 'reviewing');

create index reports_reported_id_idx on public.reports (reported_id);

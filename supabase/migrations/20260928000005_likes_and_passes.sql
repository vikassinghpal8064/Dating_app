-- 05 — likes and passes.
--
-- Both tables record a one-way decision. The pair is the unique key, so a
-- repeated like is idempotent, and the self-like guard is a CHECK so it holds
-- even for writes that bypass the API.

create table public.likes (
  liker_id uuid not null references public.profiles (id) on delete cascade,
  liked_id uuid not null references public.profiles (id) on delete cascade,
  type public.like_type not null default 'like',
  created_at timestamptz not null default now(),

  primary key (liker_id, liked_id),
  constraint likes_not_self
    check (liker_id <> liked_id)
);

comment on table public.likes is
  'A one-way like. Two mutual likes create exactly one match, via the trigger '
  'in migration 13.';

create table public.passes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  passed_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (user_id, passed_id),
  constraint passes_not_self
    check (user_id <> passed_id)
);

comment on table public.passes is
  'A one-way pass. Passes are excluded from discovery and can be withdrawn by '
  'deleting the row.';

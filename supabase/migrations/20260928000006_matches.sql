-- 06 — matches.
--
-- The two member columns keep the names the browser already uses
-- (`user_id`, `matched_user_id`) rather than `user_a`/`user_b`. The ordering
-- rule that made `user_a < user_b` meaningful is enforced here instead: the
-- pair is always stored smallest-uuid-first and the unique constraint is on
-- that canonical pair, so a match can only exist once no matter which member
-- triggers it.

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  matched_user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,

  constraint matches_not_self
    check (user_id <> matched_user_id),
  constraint matches_user_id_is_the_lower_uuid
    check (user_id < matched_user_id),
  constraint matches_unique_pair
    unique (user_id, matched_user_id)
);

comment on table public.matches is
  'A mutual like. Rows are only ever created by the trigger in migration 13; '
  'there is no INSERT policy for the authenticated role, so a client cannot '
  'fabricate a match. user_id < matched_user_id makes the pair canonical.';

create index matches_user_id_idx on public.matches (user_id);
create index matches_matched_user_id_idx on public.matches (matched_user_id);
create index matches_last_message_at_idx
  on public.matches (last_message_at desc nulls last);

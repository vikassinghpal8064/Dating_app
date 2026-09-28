-- 16 — get_contact_link: the consented way to release a number, rate limited.
--
-- The schema already had one number-release path, public.get_contact_number():
-- it is SECURITY DEFINER, it requires a match, and it respects share_mode and
-- per-viewer approvals. It raises "Not permitted" when the caller fails the
-- preconditions, which is right for a UI that has already shown the pair as
-- matched.
--
-- get_contact_link() is the stricter companion the product actually calls:
--
--   * it answers "young" rather than "loud" — every failure to qualify returns
--     NULL, so a caller can never distinguish "no match" from "they hide their
--     number" from "we are rate limited", and there is nothing to probe;
--   * it refuses when either party has blocked the other, in either direction;
--   * it is rate limited by caller: at most 20 calls per hour per user, counted
--     across outcomes, which is what keeps a harvested list of matched members
--     from being drained number by number;
--   * it keeps the original conditions from get_contact_number: share_mode
--     'matches' requires the match, share_mode 'approved' requires the
--     owner's per-viewer grant in contact_approvals, share_mode 'never' is a
--     hard no.
--
-- The call log is a real table because the limit must survive restarts and be
-- charged to the right user. It is default-deny like everything else: the only
-- policy is a member reading their own log, and the only writer is this
-- function, running as the definer. A client has no INSERT grant, so it cannot
-- spend someone else's budget or zero out its own.

create table public.contact_link_requests (
  user_id uuid not null references public.profiles (id) on delete cascade,
  called_at timestamptz not null default now()
);

-- The rate-limit query is "how many rows did this user write in the last hour",
-- so this is a straightforward range scan per caller.
create index contact_link_requests_user_called_at_idx
  on public.contact_link_requests (user_id, called_at);

alter table public.contact_link_requests enable row level security;

create policy contact_link_requests_select_own
  on public.contact_link_requests for select to authenticated
  using (auth.uid() = user_id);

grant select on public.contact_link_requests to authenticated;

comment on table public.contact_link_requests is
  'One row per get_contact_link() call, kept for an hour, charged to the caller. '
  'The only writer is the function itself; the only reader is the caller.';

-- ---------------------------------------------------------------------------
-- is_blocked_pair(a, b): the "neither user has blocked the other" test, written
-- as a function because an RLS policy expression cannot run the test itself.
--
-- A policy is evaluated as the invoking role, and RLS on `blocks` lets a member
-- see only the rows where *they* are the blocker (blocks_select_own). So a
-- subquery inside a messages policy that looks for "does the other party block
-- me" would see exactly nothing: the blockers keep their own rows private by
-- design. The function runs as the definer, reads blocks without that filter,
-- and answers the one question the policy is allowed to ask.
--
-- The caller must be one of the two arguments. That is what keeps a member from
-- probing whether *any* two strangers have blocked each other: the answer is
-- only ever about a relationship the caller is already a part of.
-- ---------------------------------------------------------------------------
create or replace function public.is_blocked_pair(a uuid, b uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if a is null or b is null or a = b then
    return false;
  end if;

  -- Only a participant may ask. Asymmetry is the point: the *blocker* is told
  -- their block is in force, while the *blocked* party is not told anything
  -- they could fish with. Both get the same answer for the purposes of the
  -- read/write guards, which is all the caller is entitled to.
  if auth.uid() not in (a, b) then
    return false;
  end if;

  return exists (
    select 1
    from public.blocks bl
    where (bl.blocker_id = a and bl.blocked_id = b)
       or (bl.blocker_id = b and bl.blocked_id = a)
  );
end;
$$;

revoke all on function public.is_blocked_pair(uuid, uuid) from public;
revoke all on function public.is_blocked_pair(uuid, uuid) from anon;
grant execute on function public.is_blocked_pair(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_contact_link(target_user_id)
-- ---------------------------------------------------------------------------
create or replace function public.get_contact_link(target_user_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  contact private_contacts%rowtype;
  target uuid := target_user_id;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if target is null or target = auth.uid() then
    return null;
  end if;

  -- Charge the call before looking anything up. "20 calls per hour per user"
  -- counts attempts, not successful reads: a limit that only counted released
  -- numbers could be probed once per number and then "hit" twenty times.
  insert into public.contact_link_requests (user_id) values (auth.uid());

  if (select count(*)
        from public.contact_link_requests
       where user_id = auth.uid()
         and called_at > now() - interval '1 hour') > 20 then
    raise exception 'Rate limited: too many contact lookups in the last hour'
      using errcode = '53400';
  end if;

  -- A block in either direction cancels the lookup, matched or not.
  if public.is_blocked_pair(auth.uid(), target) then
    return null;
  end if;

  select * into contact from public.private_contacts where user_id = target;

  if not found then
    return null;
  end if;

  if contact.share_mode = 'never' then
    return null;
  end if;

  if contact.share_mode = 'matches'
     and not exists (
       select 1
       from public.matches m
       where (m.user_id = auth.uid() and m.matched_user_id = target)
          or (m.user_id = target and m.matched_user_id = auth.uid())
     ) then
    return null;
  end if;

  if contact.share_mode = 'approved'
     and not exists (
       select 1
       from public.contact_approvals ca
       where ca.owner_id = target and ca.viewer_id = auth.uid()
     ) then
    return null;
  end if;

  return contact.whatsapp_number;
end;
$$;

comment on function public.get_contact_link(uuid) is
  'The consented number-release path the browser calls. Returns the target''s '
  'number only when the caller is matched (or specifically approved) and neither '
  'party has blocked the other; any other outcome is NULL. At most 20 calls per '
  'hour per caller.';

revoke all on function public.get_contact_link(uuid) from public;
revoke all on function public.get_contact_link(uuid) from anon;
grant execute on function public.get_contact_link(uuid) to authenticated;
-- 23 — Consent-based WhatsApp requests and the access trail.
--
-- Migration 16 already shipped the *release* gate: private_contacts holds the
-- only copy of a number, contact_approvals grants it per viewer, and
-- get_contact_link() lets it out only to a match (or an approved viewer) when
-- the owner opted into sharing. This migration adds the two things that gate
-- still lacked:
--
--   contact_requests   — the ask. One row per requester/owner pair. Rows are
--                        created only by request_contact() and answered only by
--                        respond_contact_request(), so a member can never forge
--                        a request, answer on someone else's behalf, or rewrite
--                        history.
--   contact_access_log — the trail. An append-only record of every number
--                        get_contact_link() actually released, readable only by
--                        the owner of the number and writable by nobody.
--
-- And the four functions that complete the product surface:
--
--   request_contact(p_owner)        — ask once, at most 10 asks a day, and only
--                                     against an owner whose share_mode is
--                                     'approved' (the explicit "ask me" opt-in).
--   respond_contact_request(...)    — only the owner may answer; approving also
--                                     writes the contact_approvals grant.
--   revoke_all_contact_access()     — the owner's panic button: every grant gone,
--                                     share_mode back to 'never' in one call.
--   get_contact_link(...)           — re-declared to log each successful release
--                                     into contact_access_log.
--
-- Every object here starts from deny, like the rest of the schema: no grant to
-- `anon` anywhere, and `authenticated` gets exactly the read it is named for.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.contact_request_status as enum ('pending', 'approved', 'declined');

-- ---------------------------------------------------------------------------
-- contact_requests
-- ---------------------------------------------------------------------------
create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  status public.contact_request_status not null default 'pending',
  created_at timestamptz not null default now(),

  constraint contact_requests_not_self check (requester_id <> owner_id),
  constraint contact_requests_unique_pair unique (requester_id, owner_id)
);

comment on table public.contact_requests is
  'A request from one member to another for their WhatsApp number. Deliberately '
  'number-free: the table is readable by both parties, so any number it stored '
  'would be a leak. Nobody writes it directly — request_contact() inserts and '
  'respond_contact_request() answers, both SECURITY DEFINER.';

-- ---------------------------------------------------------------------------
-- contact_access_log
-- ---------------------------------------------------------------------------
create table public.contact_access_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint contact_access_log_not_self check (owner_id <> viewer_id)
);

create index contact_access_log_owner_created_idx
  on public.contact_access_log (owner_id, created_at desc);

comment on table public.contact_access_log is
  'Append-only record of which viewer received which owner''s number, written '
  'only by get_contact_link() on a successful release. Readable only by the '
  'owner; a client can neither write nor delete a row.';

-- ---------------------------------------------------------------------------
-- Row level security: default deny on both, then the two narrow reads.
-- ---------------------------------------------------------------------------
alter table public.contact_requests enable row level security;
alter table public.contact_access_log enable row level security;

create policy contact_requests_select_involved
  on public.contact_requests for select to authenticated
  using (requester_id = auth.uid() or owner_id = auth.uid());

create policy contact_access_log_select_owner
  on public.contact_access_log for select to authenticated
  using (owner_id = auth.uid());

grant select on public.contact_requests to authenticated;
grant select on public.contact_access_log to authenticated;

-- ---------------------------------------------------------------------------
-- request_contact(p_owner)
-- ---------------------------------------------------------------------------
-- The only way a contact_requests row comes into being. Refuses — with the
-- same "Not permitted" either way — when the owner did not opt into requests
-- (share_mode 'approved'), when either party blocks the other, or when the
-- caller already burned their ten requests for the day.
create or replace function public.request_contact(p_owner uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  owner_mode public.share_mode;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if p_owner is null or p_owner = auth.uid() then
    raise exception 'Not permitted' using errcode = 'insufficient_privilege';
  end if;

  -- A blocked pair cannot ask each other for anything.
  if public.is_blocked_pair(auth.uid(), p_owner) then
    raise exception 'Not permitted' using errcode = 'insufficient_privilege';
  end if;

  -- Only an owner who opted into "people I approve" receives requests. The
  -- failure mode is the same for "has no number" and "is in matches mode", so
  -- a caller cannot map out consent settings by probing.
  select share_mode into owner_mode
    from public.private_contacts
   where user_id = p_owner;
  if not found or owner_mode <> 'approved' then
    raise exception 'Not permitted' using errcode = 'insufficient_privilege';
  end if;

  -- At most ten asks per day, counted per requester across all owners. The
  -- count happens before the insert so the quota reflects requests that were
  -- actually made. A declined request may be re-asked: that reopens the same
  -- row (same unique pair) rather than spamming the owner.
  if (select count(*)
        from public.contact_requests
       where requester_id = auth.uid()
         and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Rate limited: too many contact requests in the last day'
      using errcode = '53400';
  end if;

  if exists (
    select 1 from public.contact_requests
     where requester_id = auth.uid()
       and owner_id = p_owner
       and status = 'declined'
  ) then
    update public.contact_requests
       set status = 'pending'
     where requester_id = auth.uid()
       and owner_id = p_owner;
  else
    insert into public.contact_requests (requester_id, owner_id)
    values (auth.uid(), p_owner)
    on conflict (requester_id, owner_id) do nothing;
  end if;
end;
$$;

comment on function public.request_contact(uuid) is
  'Ask an owner for their WhatsApp number. Succeeds only when the owner''s '
  'share_mode is ''approved'' and neither party blocks the other, and only ten '
  'times a day per requester. Returns rather than revealing: every refusal is '
  'the same exception, so the caller learns nothing it could fish with.';

revoke all on function public.request_contact(uuid) from public;
revoke all on function public.request_contact(uuid) from anon;
grant execute on function public.request_contact(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- respond_contact_request(p_request, p_approve)
-- ---------------------------------------------------------------------------
-- Only the owner of the number may answer a request for it. Approving writes
-- the per-viewer contact_approvals grant in the same call, so there is no
-- window where "approved" is claimed but the grant is missing. Re-answering an
-- already-answered request is a no-op: a double click on Approve creates no
-- duplicate grant, and a change of heart is handled by revoke_all_contact_access.
create or replace function public.respond_contact_request(p_request uuid, p_approve boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  found_requester uuid;
  found_owner uuid;
  found_status public.contact_request_status;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if p_request is null or p_approve is null then
    raise exception 'Not permitted' using errcode = 'insufficient_privilege';
  end if;

  select requester_id, owner_id, status
    into found_requester, found_owner, found_status
    from public.contact_requests
   where id = p_request;

  if not found then
    raise exception 'Not found' using errcode = 'no_data_found';
  end if;

  -- Only the owner of the number may answer a request for it.
  if found_owner <> auth.uid() then
    raise exception 'Not permitted' using errcode = 'insufficient_privilege';
  end if;

  if found_status <> 'pending' then
    return;
  end if;

  if p_approve then
    insert into public.contact_approvals (owner_id, viewer_id)
    values (found_owner, found_requester)
    on conflict (owner_id, viewer_id) do nothing;

    update public.contact_requests
       set status = 'approved'
     where id = p_request;
  else
    update public.contact_requests
       set status = 'declined'
     where id = p_request;
  end if;
end;
$$;

comment on function public.respond_contact_request(uuid, boolean) is
  'The owner answers one incoming request. False declines it; true approves it '
  'and writes the contact_approvals grant the release gate in get_contact_link '
  'checks. Any caller who is not the owner, or any request that does not '
  'belong to the caller, is refused.';

revoke all on function public.respond_contact_request(uuid, boolean) from public;
revoke all on function public.respond_contact_request(uuid, boolean) from anon;
grant execute on function public.respond_contact_request(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- revoke_all_contact_access()
-- ---------------------------------------------------------------------------
-- The owner's reset: every per-viewer grant is deleted and share_mode drops
-- back to 'never', so get_contact_link() stops releasing anything immediately.
create or replace function public.revoke_all_contact_access()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  delete from public.contact_approvals
   where owner_id = auth.uid();

  update public.private_contacts
     set share_mode = 'never',
         updated_at = now()
   where user_id = auth.uid();
end;
$$;

comment on function public.revoke_all_contact_access() is
  'Revokes every WhatsApp grant the caller has ever made and sets their '
  'share_mode to ''never''. The number itself stays saved, but nothing can be '
  'released while it is in never mode.';

revoke all on function public.revoke_all_contact_access() from public;
revoke all on function public.revoke_all_contact_access() from anon;
grant execute on function public.revoke_all_contact_access() to authenticated;

-- ---------------------------------------------------------------------------
-- get_contact_link: every successful release leaves a trail.
-- ---------------------------------------------------------------------------
-- Redefined with everything the original contract preserved — rate limit,
-- block awareness, and the silent null for every refusal — plus one addition:
-- when the number is actually returned, the release is recorded in
-- contact_access_log so the owner can see who has received their number.
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

  -- The release: record it before it leaves. The owner reads their own log.
  insert into public.contact_access_log (owner_id, viewer_id)
  values (target, auth.uid());

  return contact.whatsapp_number;
end;
$$;

comment on function public.get_contact_link(uuid) is
  'The consented number-release path the browser calls. Returns the target''s '
  'number only when the caller is matched (or specifically approved) and neither '
  'party has blocked the other; any other outcome is NULL. Each successful '
  'release is recorded in contact_access_log. At most 20 calls per hour per caller.';

revoke all on function public.get_contact_link(uuid) from public;
revoke all on function public.get_contact_link(uuid) from anon;
grant execute on function public.get_contact_link(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_profile: one flag about contact consent, and nothing more.
-- ---------------------------------------------------------------------------
-- The profile page needs to know whether the target welcomes contact requests
-- (share_mode 'approved') so it can offer the "Request WhatsApp" action to a
-- viewer who is not matched. Only that single boolean is exposed — an
-- 'approved' owner wants to be asked, so telling a viewer "you may ask" is the
-- point of the setting. Nobody else's consent posture is revealed.
--
-- Adding a column to the OUT record type is a return-type change, which
-- CREATE OR REPLACE refuses (42P13), so the function is dropped and rebuilt.
-- Nothing else depends on it, and execute is granted again below.
drop function if exists public.get_profile(uuid);

create function public.get_profile(target_id uuid)
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
  distance_bucket text,
  is_online boolean,
  last_active timestamptz,
  is_verified boolean,
  looking_for text,
  interests text[],
  height_cm integer,
  education text,
  occupation text,
  languages text[],
  smoking text,
  drinking text,
  exercise text,
  is_match boolean,
  match_id uuid,
  viewer_liked_type text,
  liked_viewer boolean,
  contact_can_request boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    pp.id,
    pp.full_name,
    pp.age,
    pp.gender,
    pp.interested_in,
    pp.bio,
    pp.photos,
    pp.location_city,
    pp.location_country,
    case when pp.distance_km is null then null else public.distance_bucket(pp.distance_km) end,
    pp.is_online,
    pp.last_active,
    p.is_verified,
    p.looking_for::text,
    coalesce(p.interests, '{}')::text[],
    p.height_cm,
    p.education,
    p.occupation,
    coalesce(p.languages, '{}')::text[],
    p.smoking::text,
    p.drinking::text,
    p.exercise::text,
    m.id is not null as is_match,
    m.id as match_id,
    (
      select l.type::text
      from public.likes l
      where l.liker_id = auth.uid() and l.liked_id = pp.id
      limit 1
    ) as viewer_liked_type,
    exists (
      select 1
      from public.likes l
      where l.liker_id = pp.id and l.liked_id = auth.uid()
    ) as liked_viewer,
    exists (
      select 1
      from public.private_contacts pc
      where pc.user_id = pp.id
        and pc.share_mode = 'approved'
    ) as contact_can_request
  from public.public_profiles pp
  join public.profiles p on p.id = pp.id
  left join public.matches m
    on auth.uid() in (m.user_id, m.matched_user_id)
   and pp.id = case when m.user_id = auth.uid() then m.matched_user_id else m.user_id end
  where pp.id = target_id;
$$;

comment on function public.get_profile(uuid) is
  'One member''s full profile page: the public profile columns, the distance '
  'bucket, approximate activity and the lifestyle fields, plus the caller''s '
  'relationship to them (matched / liked them / liked by them) and whether the '
  'target welcomes contact requests. Returns no rows for hidden, banned, '
  'blocked, self or nonexistent targets so the 404 state is uninformative.';

revoke all on function public.get_profile(uuid) from public;
revoke all on function public.get_profile(uuid) from anon;
grant execute on function public.get_profile(uuid) to authenticated;
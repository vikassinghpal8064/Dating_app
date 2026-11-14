-- 24 — chat validation trigger + realtime publication.

-- Validation trigger: BEFORE INSERT on messages.
-- Checks: sender in match, no block, body valid, rate limit 30/min.
create or replace function public.validate_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  match_row matches%rowtype;
  other_id uuid;
  rate_count integer;
begin
  -- 1. Sender must be in the match (defensive; RLS also enforces).
  select * into match_row from public.matches where id = new.match_id;
  if not found then
    raise exception 'Match not found' using errcode = 'foreign_key_violation';
  end if;

  if new.sender_id <> match_row.user_id and new.sender_id <> match_row.matched_user_id then
    raise exception 'You are not part of this match' using errcode = 'insufficient_privilege';
  end if;

  -- Identify the other member of the match.
  if match_row.user_id = new.sender_id then
    other_id := match_row.matched_user_id;
  else
    other_id := match_row.user_id;
  end if;

  -- 2. No block exists either way.
  if exists (
    select 1
    from public.blocks b
    where (b.blocker_id = new.sender_id and b.blocked_id = other_id)
       or (b.blocker_id = other_id and b.blocked_id = new.sender_id)
  ) then
    raise exception 'You cannot message this person' using errcode = 'insufficient_privilege';
  end if;

  -- 3. Body not empty or over 2000 chars (defensive; CHECK also enforces).
  if char_length(btrim(new.content)) < 1 then
    raise exception 'Message cannot be empty' using errcode = 'check_violation';
  end if;

  if char_length(new.content) > 2000 then
    raise exception 'Message too long (max 2000 characters)' using errcode = 'check_violation';
  end if;

  -- 4. Rate limit: 30 messages per minute per sender.
  --    At this point the NEW row has not been inserted yet, so we count existing
  --    messages. If 30 or more were sent in the last minute, this one (the 31st)
  --    is rejected.
  select count(*) into rate_count
  from public.messages
  where sender_id = new.sender_id
    and created_at >= now() - interval '1 minute';

  if rate_count >= 30 then
    raise exception 'RATE_LIMIT' using errcode = 'RATE_LIMIT';
  end if;

  return new;
end;
$$;

create trigger validate_message_insert
  before insert on public.messages
  for each row execute function public.validate_message_insert();

revoke all on function public.validate_message_insert() from public;
revoke all on function public.validate_message_insert() from anon;
grant execute on function public.validate_message_insert() to authenticated;

comment on function public.validate_message_insert() is
  'BEFORE INSERT trigger: validates sender in match, no block, body length, and 30/min rate limit.';

-- Add messages to the supabase_realtime publication.
-- RLS already restricts visibility to match members via messages_select_involved.
alter publication supabase_realtime add table public.messages;

comment on table public.messages is
  'Chat messages with realtime. RLS restricts visibility to match members only.';

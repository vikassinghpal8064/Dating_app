-- 07 — messages.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  message_type public.message_type not null default 'text',
  read_at timestamptz,
  created_at timestamptz not null default now(),

  constraint messages_content_length
    check (char_length(btrim(content)) between 1 and 2000),
  -- Reject C0/C1 control characters except tab, newline and carriage return,
  -- so a message body can never carry a NUL or an escape sequence downstream.
  constraint messages_content_is_plain
    check (content !~ '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
);

comment on table public.messages is
  'Chat messages. A message is only visible to, and only insertable by, the two '
  'members of its match; the update grant is limited to read_at.';

create index messages_match_id_created_at_idx
  on public.messages (match_id, created_at);

create index messages_unread_idx
  on public.messages (match_id)
  where read_at is null;

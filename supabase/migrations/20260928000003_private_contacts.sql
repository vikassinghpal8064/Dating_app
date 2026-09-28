-- 03 — Contact details and the consent trail around them.
--
-- A phone number is the single most damaging thing on a dating profile, so it
-- lives in exactly one place: `private_contacts`. No other table has a column
-- that can hold a phone number, and the only way to read one out is
-- `public.get_contact_number`, which refuses unless the caller is matched, the
-- owner has opted in, and (for share_mode 'approved') an approval exists.
--
-- `whatsapp_consents` is the request/response trail the browser already uses.
-- It deliberately has NO number column: the requesting member is another user,
-- so any column on a table they can read would be a leak.

create table public.private_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  whatsapp_number text not null,
  share_mode public.share_mode not null default 'never',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint private_contacts_number_is_e164
    check (public.is_e164(whatsapp_number))
);

comment on table public.private_contacts is
  'The only table permitted to hold a phone number. Row-level security allows '
  'its owner and nobody else; other users reach a number only through '
  'public.get_contact_number().';

create table public.contact_approvals (
  owner_id uuid not null references public.profiles (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (owner_id, viewer_id),
  constraint contact_approvals_not_self
    check (owner_id <> viewer_id)
);

comment on table public.contact_approvals is
  'An explicit grant from `owner_id` letting `viewer_id` see their number. '
  'Consulted only when private_contacts.share_mode = ''approved''.';

create table public.whatsapp_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  matched_user_id uuid not null references public.profiles (id) on delete cascade,
  status public.whatsapp_consent_status not null default 'pending',
  requested_at timestamptz not null default now(),
  responded_at timestamptz,

  constraint whatsapp_consents_not_self
    check (user_id <> matched_user_id),
  constraint whatsapp_consents_unique_pair
    unique (user_id, matched_user_id),
  constraint whatsapp_consents_responded_at_required
    check (
      (status = 'pending' and responded_at is null)
      or (status <> 'pending' and responded_at is not null)
    )
);

comment on column public.whatsapp_consents.user_id is
  'Owner of the number being offered.';
comment on column public.whatsapp_consents.matched_user_id is
  'The member who was asked. They are the only party allowed to respond.';
comment on table public.whatsapp_consents is
  'Request/response trail for number sharing. Holds no number: the number stays '
  'in private_contacts and is released only through public.get_contact_number().';

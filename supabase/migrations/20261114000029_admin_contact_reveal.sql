-- 29 — Admin contact reveal.
--
-- The product owner asked for the WhatsApp number to be readable from the admin
-- dashboard. This is deliberately the smallest possible door:
--
--   * a dedicated function, not a column on `profiles` and not a field on
--     `admin_get_user` — routine browsing of a member record cannot read a
--     number, only an explicit reveal can;
--   * administrator only (`is_admin()`), one member at a time, `anon` gets no
--     grant;
--   * every call writes `reveal_phone_number` to `admin_audit_log`, with the
--     member id and who asked, so access is attributable after the fact;
--   * the member's own consent state is returned alongside the number, because
--     "the owner has not opted in" is relevant context for an operator.
--
-- This does not change `public.get_contact_number`, the member-facing consent
-- path, or any RLS policy on `private_contacts`.
create or replace function public.admin_reveal_contact(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  payload jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'user_id', c.user_id,
    'whatsapp_number', c.whatsapp_number,
    'share_mode', c.share_mode::text,
    'whatsapp_consent', p.whatsapp_consent,
    'phone_verified', p.phone_verified,
    'updated_at', c.updated_at
  ) into payload
  from public.private_contacts c
  join public.profiles p on p.id = c.user_id
  where c.user_id = p_user;

  -- Audited whether or not a number exists: "the operator looked" is the fact
  -- worth recording.
  perform public.write_admin_audit_log(
    'reveal_phone_number',
    p_user,
    jsonb_build_object('found', payload is not null)
  );

  return coalesce(payload, jsonb_build_object('user_id', p_user, 'whatsapp_number', null));
end;
$$;

comment on function public.admin_reveal_contact(uuid) is
  'Returns one member''s WhatsApp number to an administrator, audited. The only '
  'admin path that reads private_contacts.';

revoke all on function public.admin_reveal_contact(uuid) from public;
revoke all on function public.admin_reveal_contact(uuid) from anon;
grant execute on function public.admin_reveal_contact(uuid) to authenticated;

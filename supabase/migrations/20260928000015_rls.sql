-- 14 — Row level security, policies and grants.
--
-- RLS is enabled on every table in the schema, and the grants below are
-- explicit. `anon` receives nothing at all, which is the default-deny posture:
-- an unauthenticated request cannot read a single row of application data, and
-- the only relations it can reach are the auth schema's own endpoints.
--
-- The one place RLS is deliberately *not* the boundary is `profiles` → other
-- members, which goes through the public_profiles view (migration 11). No policy
-- here ever grants SELECT on `profiles` to another member's rows.

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.private_contacts enable row level security;
alter table public.contact_approvals enable row level security;
alter table public.whatsapp_consents enable row level security;
alter table public.profile_photos enable row level security;
alter table public.likes enable row level security;
alter table public.passes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.user_roles enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select_own
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy profiles_insert_own
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy profiles_delete_own
  on public.profiles for delete to authenticated
  using (auth.uid() = id);

grant select on public.profiles to authenticated;

-- `email`, `is_admin`, `is_banned`, `is_verified`, `age_verified`,
-- `phone_verified`, `is_visible` and `last_active_at` are absent on purpose.
-- The sign-up trigger writes email from auth.users, and the verification flags
-- are only ever set server-side, so no client path needs to write them. The
-- BEFORE trigger in migration 13 forces them regardless, in case a grant is
-- ever widened by mistake.
grant insert (
  id, full_name, date_of_birth, gender, interested_in, bio, photos,
  location_city, location_state, location_country, latitude, longitude,
  height_cm, education, occupation, looking_for, interests, languages,
  smoking, drinking, exercise, show_distance, whatsapp_consent
) on public.profiles to authenticated;

-- `id` is here because PostgREST's upsert emits `ON CONFLICT ("id") DO UPDATE
-- SET "id" = EXCLUDED."id"`, so the column has to carry UPDATE privilege for an
-- upsert to be possible at all. It is not writable in practice: the BEFORE
-- trigger in migration 13 copies old.id over new.id, and the policy requires
-- auth.uid() = id.
grant update (
  id, full_name, date_of_birth, gender, interested_in, bio, photos,
  location_city, location_state, location_country, latitude, longitude,
  height_cm, education, occupation, looking_for, interests, languages,
  smoking, drinking, exercise, show_distance, whatsapp_consent
) on public.profiles to authenticated;

grant delete on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- user_preferences
-- ---------------------------------------------------------------------------
create policy user_preferences_select_own
  on public.user_preferences for select to authenticated
  using (auth.uid() = user_id);

create policy user_preferences_insert_own
  on public.user_preferences for insert to authenticated
  with check (auth.uid() = user_id);

create policy user_preferences_update_own
  on public.user_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy user_preferences_delete_own
  on public.user_preferences for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- private_contacts
-- ---------------------------------------------------------------------------
-- There is no policy that lets anyone read another member's row. Ever. The only
-- path is public.get_contact_number(), which applies the consent rules.
create policy private_contacts_select_own
  on public.private_contacts for select to authenticated
  using (auth.uid() = user_id);

create policy private_contacts_insert_own
  on public.private_contacts for insert to authenticated
  with check (auth.uid() = user_id);

create policy private_contacts_update_own
  on public.private_contacts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy private_contacts_delete_own
  on public.private_contacts for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.private_contacts to authenticated;

-- ---------------------------------------------------------------------------
-- contact_approvals
-- ---------------------------------------------------------------------------
create policy contact_approvals_select_involved
  on public.contact_approvals for select to authenticated
  using (auth.uid() in (owner_id, viewer_id));

-- Only the owner of the number can grant access to it.
create policy contact_approvals_insert_own
  on public.contact_approvals for insert to authenticated
  with check (auth.uid() = owner_id);

create policy contact_approvals_delete_involved
  on public.contact_approvals for delete to authenticated
  using (auth.uid() in (owner_id, viewer_id));

grant select, insert, delete on public.contact_approvals to authenticated;

-- ---------------------------------------------------------------------------
-- whatsapp_consents
-- ---------------------------------------------------------------------------
-- Readable by both parties; writable only through request_whatsapp() and
-- respond_whatsapp_request(), so a client cannot approve its own request.
create policy whatsapp_consents_select_involved
  on public.whatsapp_consents for select to authenticated
  using (auth.uid() in (user_id, matched_user_id));

grant select on public.whatsapp_consents to authenticated;

-- ---------------------------------------------------------------------------
-- profile_photos
-- ---------------------------------------------------------------------------
-- A member may look at their own verdicts and nothing more. They may not write
-- them: profile_photos is the moderator's record, and a member who could delete
-- the rejected row naming one of their own images would empty the deny-list and
-- re-add the image in the same request. Reads are self-only, so a member cannot
-- enumerate anybody else's queue either.
create policy profile_photos_select_own
  on public.profile_photos for select to authenticated
  using (auth.uid() = user_id or public.is_moderator());

create policy profile_photos_insert_moderator
  on public.profile_photos for insert to authenticated
  with check (public.is_moderator());

create policy profile_photos_update_moderator
  on public.profile_photos for update to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

create policy profile_photos_delete_moderator
  on public.profile_photos for delete to authenticated
  using (public.is_moderator());

grant select, insert, update, delete on public.profile_photos to authenticated;

-- ---------------------------------------------------------------------------
-- likes
-- ---------------------------------------------------------------------------
-- A like is visible to both people involved: that is what lets the liked person
-- see that they were liked, and what makes a mutual pair discoverable.
create policy likes_select_involved
  on public.likes for select to authenticated
  using (auth.uid() in (liker_id, liked_id));

create policy likes_insert_own
  on public.likes for insert to authenticated
  with check (liker_id = auth.uid());

create policy likes_delete_own
  on public.likes for delete to authenticated
  using (liker_id = auth.uid());

grant select, insert, delete on public.likes to authenticated;

-- ---------------------------------------------------------------------------
-- passes
-- ---------------------------------------------------------------------------
create policy passes_select_own
  on public.passes for select to authenticated
  using (user_id = auth.uid());

create policy passes_insert_own
  on public.passes for insert to authenticated
  with check (user_id = auth.uid());

create policy passes_delete_own
  on public.passes for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, delete on public.passes to authenticated;

-- ---------------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------------
-- Select only. There is no INSERT, UPDATE or DELETE policy and no grant, so a
-- client cannot manufacture a match; rows come from the mutual-like trigger.
create policy matches_select_involved
  on public.matches for select to authenticated
  using (auth.uid() in (user_id, matched_user_id));

grant select on public.matches to authenticated;

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create policy messages_select_involved
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = messages.match_id
        and auth.uid() in (m.user_id, m.matched_user_id)
    )
  );

create policy messages_insert_as_match_member
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = messages.match_id
        and auth.uid() in (m.user_id, m.matched_user_id)
    )
  );

create policy messages_update_own
  on public.messages for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

grant select, insert on public.messages to authenticated;
-- read_at is the only column a client may ever change on a message.
grant update (read_at) on public.messages to authenticated;

-- ---------------------------------------------------------------------------
-- blocks
-- ---------------------------------------------------------------------------
-- Readable only by the blocker. Giving the blocked member read access would
-- confirm the block exists, which is information they should not have.
create policy blocks_select_own
  on public.blocks for select to authenticated
  using (blocker_id = auth.uid());

create policy blocks_insert_own
  on public.blocks for insert to authenticated
  with check (blocker_id = auth.uid());

create policy blocks_delete_own
  on public.blocks for delete to authenticated
  using (blocker_id = auth.uid());

grant select, insert, delete on public.blocks to authenticated;

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
create policy reports_select_own_or_staff
  on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderator());

create policy reports_insert_own
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

create policy reports_update_staff
  on public.reports for update to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

grant select, insert on public.reports to authenticated;
grant update (status) on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------------
create policy user_roles_select_own
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());

grant select on public.user_roles to authenticated;

-- ---------------------------------------------------------------------------
-- service_role
-- ---------------------------------------------------------------------------
-- Only ever used from the server. Bypasses RLS by design; never shipped to a
-- browser. The anon key in the browser maps to `anon`/`authenticated`, so none
-- of these grants are reachable from the client.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

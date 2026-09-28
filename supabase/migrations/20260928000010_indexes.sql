-- 10 — Indexes.
--
-- One entry per foreign key that is not already the left-hand side of a primary
-- key or a unique constraint, plus the profile columns discovery actually filters
-- and sorts on. Postgres does not index foreign keys automatically, and an
-- unindexed `on delete cascade` re-checks the referencing table row by row.

-- ---- foreign keys -----------------------------------------------------
create index contact_approvals_viewer_id_idx on public.contact_approvals (viewer_id);
create index whatsapp_consents_matched_user_id_idx on public.whatsapp_consents (matched_user_id);
create index profile_photos_user_id_idx on public.profile_photos (user_id);
create index likes_liked_id_idx on public.likes (liked_id);
create index passes_passed_id_idx on public.passes (passed_id);
create index messages_sender_id_idx on public.messages (sender_id);
create index blocks_blocked_id_idx on public.blocks (blocked_id);
create index reports_reporter_id_idx on public.reports (reporter_id);
create index user_roles_role_idx on public.user_roles (role);

-- ---- discovery --------------------------------------------------------
-- Discovery excludes banned and not-yet-complete rows, then orders by distance
-- and last activity. These two cover the filter and the sort.
create index profiles_discovery_idx
  on public.profiles (last_active_at desc)
  where is_visible and not is_banned;

create index profiles_location_idx on public.profiles (latitude, longitude);

create index profiles_location_city_idx on public.profiles (lower(location_city));
create index profiles_location_country_idx on public.profiles (lower(location_country));

-- A cheap equality lookup for the /profile/:id page and for admin search.
create index profiles_full_name_idx on public.profiles (lower(full_name));

create index profiles_banned_idx on public.profiles (id) where is_banned;

-- ---- session churn ----------------------------------------------------
create index profiles_last_active_at_idx on public.profiles (last_active_at desc);

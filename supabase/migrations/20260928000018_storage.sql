-- 18 — Private storage: profile photos and verification selfies.
--
-- Two buckets, both private. `public = false` means the storage service refuses
-- unsigned object reads at the API layer; anything the browser renders must
-- come back as a short-lived signed URL issued to the signed-in member. The
-- bucket rows also carry the file and type limits, and the storage service
-- enforces both at upload time: allowed_mime_types is matched against the
-- declared content type, and file_size_limit is checked against the body size.
-- No extra trigger is needed; the service itself is the guard.
--
-- The requirement "users may upload only to a folder named with their own uid"
-- is a policy on storage.objects, because the storage API performs the insert
-- as the uploading member and row-level security is the gate.
--
-- Note on grants: the local stack ships broad table grants on storage.objects
-- to anon and authenticated (the storage API design), but the objects table has
-- row-level security on and the policies below are the access control. `anon`
-- gets no policy, so an unsigned request can neither list nor upload nor read
-- a single object despite holding a raw grant.

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  false,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Verification selfies are a matter between the member and the moderation team:
-- nobody else may ever read them, so nothing here grants uploads from a client
-- either. An upload is a server-side act, and the read side is administrator
-- only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-selfies',
  'verification-selfies',
  false,
  10 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- profile-photos policies
-- ---------------------------------------------------------------------------
-- Uploads, updates and deletes are confined to the caller's own folder. The
-- folder name is the member's uid as text, and storage.foldername() splits the
-- object path into its components: the first component is the folder.
create policy profile_photos_insert_own_folder
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

create policy profile_photos_update_own_folder
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (auth.uid())::text
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

create policy profile_photos_delete_own_folder
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Reads: the caller's own uploads, plus the uploads of any member whose profile
-- public_profiles shows them. The join is the same boundary the discovery feed
-- already enforces — visible, not banned, not blocked in either direction, and
-- not the caller — so an object can only be read when its folder's owner would
-- otherwise appear in the feed. A hidden, banned or blocked member's photos are
-- unreadable even with the exact path in hand.
create policy profile_photos_select_own_or_visible
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-photos'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or exists (
        select 1
        from public.public_profiles pp
        where pp.id = (storage.foldername(name))[1]::uuid
      )
    )
  );

-- ---------------------------------------------------------------------------
-- verification-selfies policies
-- ---------------------------------------------------------------------------
create policy verification_selfies_select_admin
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-selfies'
    and public.is_admin()
  );
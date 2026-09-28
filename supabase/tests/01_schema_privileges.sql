-- 01 — The schema's own security posture.
--
-- Structural assertions about what the database is allowed to expose,
-- independent of any particular member's data. If this file fails, the schema
-- is unsafe regardless of what the rest of the suite says.
--
--   supabase test db
--
-- pgTAP's is() is generic over a single type, so every expected value is cast to
-- match the count(*) it is compared against.

create extension if not exists pgtap with schema extensions;

begin;
select plan(38);

-- ---------------------------------------------------------------------------
-- Row level security is on for every table, with no exceptions.
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and not c.relrowsecurity),
  0::bigint,
  'every table in public has row level security enabled'
);

-- ---------------------------------------------------------------------------
-- Default deny. `anon` must be able to read nothing at all.
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public'),
  0::bigint,
  'anon holds no privilege on any table in public'
);

select is(
  (select count(*) from information_schema.role_usage_grants
     where grantee = 'anon' and object_schema = 'public' and object_type = 'SEQUENCE'),
  0::bigint,
  'anon holds no privilege on any sequence in public'
);

select is(
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     cross join pg_roles r
     where n.nspname = 'public'
       and r.rolname = 'anon'
       and has_function_privilege(r.oid, p.oid, 'EXECUTE')),
  0::bigint,
  'anon cannot execute any function in public'
);

-- ---------------------------------------------------------------------------
-- public_profiles is the security boundary. Its column list is the whole point:
-- if any of these names appears, the design has been breached.
-- ---------------------------------------------------------------------------
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'public_profiles'
      and column_name = any (array['email', 'latitude', 'longitude', 'date_of_birth'])
  ),
  'public_profiles exposes no email, coordinates or date of birth'
);

select is(
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'public_profiles'),
  12::bigint,
  'public_profiles publishes exactly the twelve documented columns'
);

select ok(
  exists (
    select 1 from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'public_profiles'
      and a.attname = 'distance_km'
  ),
  'public_profiles still exposes the coarse distance column'
);

-- ---------------------------------------------------------------------------
-- A phone number may only ever be stored in private_contacts.
-- ---------------------------------------------------------------------------
select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and column_name in ('whatsapp_number', 'phone', 'phone_number', 'contact_number')
      and table_name <> 'private_contacts'
  ),
  'no table other than private_contacts has a phone number column'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'whatsapp_consents'
      and (column_name ilike '%number%' or column_name ilike '%phone%')
  ),
  'whatsapp_consents holds no number, so its other party cannot read one'
);

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER functions must pin their search_path, or an object in a
-- schema ahead of public could be substituted for the tables they name.
-- ---------------------------------------------------------------------------
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=%'
  ),
  'every SECURITY DEFINER function in public pins its search_path'
);

-- ---------------------------------------------------------------------------
-- No function may be callable by PUBLIC without an explicit grant, which is how
-- a function quietly becomes reachable by `anon`.
-- ---------------------------------------------------------------------------
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join pg_roles r
    where n.nspname = 'public'
      and r.rolname = 'public'
      and has_function_privilege(r.oid, p.oid, 'EXECUTE')
      and p.proname = any (array[
        'is_admin', 'is_moderator', 'get_contact_number', 'request_whatsapp',
        'respond_whatsapp_request', 'get_potential_matches', 'search_profiles_by_distance'
      ])
  ),
  'the sensitive server functions are not executable by PUBLIC'
);

-- Revoking from PUBLIC is not sufficient on its own: Supabase's default
-- privileges write a *direct* grant onto the anon role, which a PUBLIC revoke
-- leaves intact. This asserts the outcome that actually matters.
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join pg_roles r
    where n.nspname = 'public'
      and r.rolname = 'anon'
      and has_function_privilege(r.oid, p.oid, 'EXECUTE')
      and p.proname = any (array[
        'is_admin', 'is_moderator', 'get_contact_number', 'request_whatsapp',
        'respond_whatsapp_request', 'get_potential_matches', 'search_profiles_by_distance'
      ])
  ),
  'anon cannot execute any of the sensitive server functions'
);

-- ---------------------------------------------------------------------------
-- A function named inside a CHECK constraint or an RLS policy is evaluated as
-- the role that issued the statement, not as the table owner. So if such a
-- function is not executable by `authenticated`, every write that would have
-- evaluated it fails with `permission denied for function` and 42501 — which
-- presents as a broken feature rather than a missing grant. This is the
-- assertion that would have caught the CHECK helpers being revoked along with
-- everything else.
--
-- The function is recovered by OID, because pg_constraint.conbin and
-- pg_policy.polqual are node trees that reference a function as `:funcid 17937`
-- and never by name.
-- ---------------------------------------------------------------------------
select is(
  (select count(distinct p.oid)
     from pg_constraint con
     join pg_class c on c.oid = con.conrelid
     join pg_namespace n on n.oid = c.relnamespace
     cross join lateral (
       select (regexp_matches(coalesce(con.conbin::text, ''), ':funcid (\d+)', 'g'))[1]::oid as funcid
     ) as f
     join pg_proc p on p.oid = f.funcid
     join pg_namespace pn on pn.oid = p.pronamespace and pn.nspname = 'public'
     cross join pg_roles r
     where n.nspname = 'public'
       and con.contype = 'c'
       and r.rolname = 'authenticated'
       and not has_function_privilege(r.oid, p.oid, 'EXECUTE')),
  0::bigint,
  'every function called by a CHECK constraint is executable by authenticated'
);

-- The mirror image of the assertion above, and the one that matters most: a
-- CHECK helper must stay unreachable by an unsigned request. These functions
-- read nothing, but "reads nothing" is an argument, not an enforcement.
select is(
  (select count(distinct p.oid)
     from pg_constraint con
     join pg_class c on c.oid = con.conrelid
     join pg_namespace n on n.oid = c.relnamespace
     cross join lateral (
       select (regexp_matches(coalesce(con.conbin::text, ''), ':funcid (\d+)', 'g'))[1]::oid as funcid
     ) as f
     join pg_proc p on p.oid = f.funcid
     join pg_namespace pn on pn.oid = p.pronamespace and pn.nspname = 'public'
     cross join pg_roles r
     where n.nspname = 'public'
       and con.contype = 'c'
       and r.rolname = 'anon'
       and has_function_privilege(r.oid, p.oid, 'EXECUTE')),
  0::bigint,
  'no CHECK constraint helper is executable by anon'
);

-- RLS policies are likewise evaluated as the querying role.
select is(
  (select count(distinct p.oid)
     from pg_policy pol
     cross join lateral (
       select (regexp_matches(
                coalesce(pol.polqual::text, '') || ' ' || coalesce(pol.polwithcheck::text, ''),
                ':funcid (\d+)', 'g'))[1]::oid as funcid
     ) as f
     join pg_proc p on p.oid = f.funcid
     join pg_namespace pn on pn.oid = p.pronamespace and pn.nspname = 'public'
     cross join pg_roles r
     where r.rolname = 'authenticated'
       and not has_function_privilege(r.oid, p.oid, 'EXECUTE')),
  0::bigint,
  'every function called by an RLS policy is executable by authenticated'
);

-- Guard against the three assertions above going vacuous: if the node tree
-- format ever stops yielding a resolvable funcid, they would pass while checking
-- nothing. The count is pinned to what the schema actually references today.
select is(
  (select count(distinct p.oid)
     from pg_constraint con
     join pg_class c on c.oid = con.conrelid
     join pg_namespace n on n.oid = c.relnamespace
     cross join lateral (
       select (regexp_matches(coalesce(con.conbin::text, ''), ':funcid (\d+)', 'g'))[1]::oid as funcid
     ) as f
     join pg_proc p on p.oid = f.funcid
     join pg_namespace pn on pn.oid = p.pronamespace and pn.nspname = 'public'
     where n.nspname = 'public' and con.contype = 'c'),
  3::bigint,
  'the three CHECK helpers are still discoverable, so the checks above are not vacuous'
);

select is(
  (select count(distinct p.oid)
     from pg_policy pol
     cross join lateral (
       select (regexp_matches(
                coalesce(pol.polqual::text, '') || ' ' || coalesce(pol.polwithcheck::text, ''),
                ':funcid (\d+)', 'g'))[1]::oid as funcid
     ) as f
     join pg_proc p on p.oid = f.funcid
     join pg_namespace pn on pn.oid = p.pronamespace and pn.nspname = 'public'),
  1::bigint,
  'the moderator policy helper is still discoverable, so that check is not vacuous'
);

-- ---------------------------------------------------------------------------
-- A table with RLS on and no policy returns nothing, which is the desired
-- default. A member may still only read what a policy explicitly allows.
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
       and not exists (select 1 from pg_policy pol where pol.polrelid = c.oid)),
  0::bigint,
  'every RLS-enabled table has at least one policy'
);

select is(
  (select count(*) from pg_policy pol
     join pg_class c on c.oid = pol.polrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and pol.polqual is null and pol.polwithcheck is null),
  0::bigint,
  'no policy is unconditionally permissive'
);

-- ---------------------------------------------------------------------------
-- The seed produces sign-ins that actually work
-- ---------------------------------------------------------------------------
-- auth.users token columns are nullable, but GoTrue scans confirmation_token,
-- recovery_token, email_change_token_new and email_change into Go strings,
-- which cannot hold NULL. A NULL there does not fail as a missing column: it
-- fails as 500 "Database error querying schema" on every password sign-in, for
-- every seeded account, one column at a time, with the real cause buried in the
-- auth container's log as
--   sql: Scan error on column index N, name "...": converting NULL to string is unsupported
--
-- Nothing in the schema can catch that, because it is a property of the data
-- the seed leaves behind rather than of any object defined here. This asserts
-- the precondition GoTrue relies on, so a seed edit that drops any one of the
-- four columns cannot quietly make the whole local stack unloginable again.
select ok(
  not exists (
    select 1
      from auth.users
     where confirmation_token is null
        or recovery_token is null
        or email_change_token_new is null
        or email_change is null
  ),
  'every seeded auth user has non-null GoTrue token columns (confirmation_token, recovery_token, email_change_token_new, email_change), so GoTrue can sign it in'
);

select ok(
  exists (
    select 1 from auth.users
    where email = 'demo@local.test' and encrypted_password is not null
  ),
  'and the demo account the README points at exists with a password set'
);

-- ---------------------------------------------------------------------------
-- Indexes the schema depends on for correctness, not just speed.
-- ---------------------------------------------------------------------------
-- The deny-list is looked up on every write to profiles.photos, by user and by
-- URL, so without this index each member photo write degrades into a scan.
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'profile_photos_denied_url_idx'
  ),
  'the photo deny-list lookup index exists'
);

-- And it must be the partial form: a row that is not rejected is not a verdict
-- that filters anything, so indexing only the rejected rows keeps the index
-- small enough to stay out of the write path for everything else.
select ok(
  exists (
    select 1 from pg_index i
    join pg_class c on c.oid = i.indexrelid
    join pg_indexes p on p.indexname = c.relname and p.schemaname = 'public'
    where c.relname = 'profile_photos_denied_url_idx'
      and i.indpred is not null
      and pg_get_indexdef(i.indexrelid) like '%moderation_status = ''rejected''%'
  ),
  'and it is partial on moderation_status = rejected, which is the query it serves'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'messages'
      and indexname = 'messages_match_id_created_at_idx'
  ),
  'messages are indexed by match and creation order'
);

-- ---------------------------------------------------------------------------
-- The trigger that keeps a signup's empty row out of discovery. Existence is
-- checked against pg_proc directly rather than with has_function(), whose
-- name-only form is ambiguous for trigger functions.
-- ---------------------------------------------------------------------------
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'prepare_profile_write'
  ),
  'the profile write guard exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_user'
  ),
  'the sign-up trigger function exists'
);

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_match_on_mutual_like'
  ),
  'the mutual-like trigger function exists'
);

select ok(
  exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth' and c.relname = 'users'
      and t.tgname = 'on_auth_user_created'
  ),
  'a trigger on auth.users creates the profile row for a new member'
);

select ok(
  exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'likes'
      and t.tgname = 'likes_create_match'
  ),
  'a trigger on likes creates the match'
);

-- ---------------------------------------------------------------------------
-- Structural constraints that must exist for the invariants to hold even when
-- a write bypasses the API.
-- ---------------------------------------------------------------------------
select ok(
  exists (select 1 from pg_constraint where conname = 'likes_not_self' and contype = 'c'),
  'likes has a self-like check constraint'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'matches_user_id_is_the_lower_uuid' and contype = 'c'),
  'likes and matches agree on the canonical ordering'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'profiles_latitude_range' and contype = 'c'),
  'profiles has a coordinate range and precision check'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'private_contacts_number_is_e164' and contype = 'c'),
  'private_contacts only accepts E.164 numbers'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'profiles_bio_length' and contype = 'c'),
  'profiles bounds the bio length in the database, not just in the form'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'messages_content_length' and contype = 'c'),
  'messages bounds the content length in the database'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'matches_unique_pair' and contype = 'u'),
  'a match pair is unique, which is what makes a mutual like idempotent'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'profiles_smoking_vocabulary' and contype = 'c'),
  'lifestyle fields are constrained to a fixed vocabulary'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'whatsapp_consents_not_self' and contype = 'c'),
  'a member cannot request a handover from themselves'
);

select * from finish();
rollback;

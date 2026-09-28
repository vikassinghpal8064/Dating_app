-- 11 — Default deny.
--
-- Supabase grants the data API roles broad privileges on everything in `public`
-- by default. This strips all of it back, once, after every table, view and
-- function in the schema exists but before any of them is deliberately granted
-- back. Migrations 12, 13 and 15 then hand out exactly the privileges they mean
-- to.
--
-- The ordering is the whole point. A blanket revoke placed after the specific
-- grants would silently undo them, which is exactly the kind of bug that reads
-- as "RLS is on and it still 403s".
--
-- After this migration, `anon` can reach nothing at all. Every later grant names
-- `authenticated`, never `anon`.

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
revoke all on all routines in schema public from anon, authenticated;

-- `public` is the pseudo-role every other role inherits from, so a grant to it
-- is a grant to anon as well. The statements above only name the two named
-- roles, which leaves the PUBLIC grant on anything created by migration 10 or
-- earlier — the CHECK helpers in migration 1 are the ones that show up.
revoke all on all tables in schema public from public;
revoke all on all sequences in schema public from public;
revoke all on all functions in schema public from public;
revoke all on all routines in schema public from public;

-- ---------------------------------------------------------------------------
-- Disable the default privileges themselves.
-- ---------------------------------------------------------------------------
-- The four `revoke ... on all` statements above only clean up objects that exist
-- at this moment. They do not change what happens to the *next* object: Supabase
-- installs `alter default privileges in schema public grant all on tables,
-- functions and sequences to postgres, anon, authenticated, service_role`, so
-- every function created by a later migration silently regains EXECUTE for anon
-- the moment it is created.
--
-- That is why a later `revoke execute on function f() from public` is not
-- enough. Revoking from the PUBLIC pseudo-role removes the inherited grant, not
-- the direct one the default privilege already wrote onto the anon role, and the
-- ACL still reads `anon=X`. Removing the default privileges is what actually
-- makes "default deny" hold for everything created after this point.
--
-- The statements below are unqualified, so they apply to the role this file is
-- applied as — the role that creates every object in the schema. supabase_admin
-- carries an equivalent set of defaults, but nothing here is ever created as
-- supabase_admin, and altering another role's defaults requires membership in
-- that role.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges in schema public revoke all on routines from anon, authenticated;

alter default privileges in schema public revoke all on tables from public;
alter default privileges in schema public revoke all on sequences from public;
alter default privileges in schema public revoke all on functions from public;
alter default privileges in schema public revoke all on routines from public;

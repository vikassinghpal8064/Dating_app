-- 09 — user_roles, and the is_admin() helper.
--
-- A member can hold more than one role, so the key is the pair. Nothing in the
-- `authenticated` role may write here: promotion is an operator action, done
-- with the service role or straight in SQL. The only rows a member can read are
-- their own, which is what `/admin` needs to explain its own access.

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.user_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  primary key (user_id, role)
);

comment on table public.user_roles is
  'Role assignments. Source of truth for staff access; profiles.is_admin is a '
  'denormalised mirror of the ''admin'' role, kept in step by a trigger.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'True when the caller holds the admin role. SECURITY DEFINER because '
  'user_roles is not readable by other members; search_path is pinned so a '
  'malicious object in another schema cannot be substituted.';

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'moderator')
  );
$$;

comment on function public.is_moderator() is
  'True when the caller holds the admin or moderator role.';

-- Grants for both are issued in migration 13, after the blanket revoke in
-- migration 11, so that the revoke does not undo them.

-- 28 — Owner analytics dashboard.
--
-- Everything an administrator needs to see the state of the product in one
-- place: aggregate analytics, a searchable member list, per-member detail, the
-- conversation list and the message bodies themselves.
--
-- Design rules, in line with the rest of this schema:
--   * Every function is SECURITY DEFINER and starts with `is_admin()`; a
--     non-admin gets `42501`, never an empty result that hides an authorization
--     bug. Nothing here is granted to `anon`.
--   * Reading a member's detail or a conversation writes an `admin_audit_log`
--     row. Full visibility for the owner does not mean unnoticeable access:
--     whose inbox was read, by whom, and when is itself part of the record.
--   * `private_contacts` is never selected. The detail payload carries
--     `has_phone_number` (a boolean) and nothing more, because the rule that a
--     phone number is released only through the consent-checking function has
--     no administrator exception. Same for the exact coordinates: only the
--     two-decimal values the schema already stores are returned.
--
-- The payloads are jsonb. That keeps the client free of a `Database` type
-- regeneration and lets the shape evolve additively.

-- ---------------------------------------------------------------------------
-- Aggregate overview
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_overview()
returns jsonb
language plpgsql
stable
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
    'generated_at', now(),

    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'visible', (select count(*) from public.profiles where is_visible),
      'verified', (select count(*) from public.profiles where is_verified),
      'banned', (select count(*) from public.profiles where is_banned),
      'paused', (select count(*) from public.profiles where profile_paused),
      'incognito', (select count(*) from public.profiles where incognito),
      'admins', (select count(*) from public.user_roles where role = 'admin'),
      'new_today', (select count(*) from public.profiles
                     where created_at >= date_trunc('day', now())),
      'new_7d', (select count(*) from public.profiles
                  where created_at >= now() - interval '7 days'),
      'new_30d', (select count(*) from public.profiles
                   where created_at >= now() - interval '30 days'),
      'active_24h', (select count(*) from public.profiles
                      where last_active_at >= now() - interval '24 hours'),
      'active_7d', (select count(*) from public.profiles
                     where last_active_at >= now() - interval '7 days'),
      'active_30d', (select count(*) from public.profiles
                      where last_active_at >= now() - interval '30 days')
    ),

    'engagement', jsonb_build_object(
      'likes', (select count(*) from public.likes where type = 'like'),
      'super_likes', (select count(*) from public.likes where type = 'super_like'),
      'passes', (select count(*) from public.passes),
      'matches', (select count(*) from public.matches),
      'messages', (select count(*) from public.messages),
      'messages_24h', (select count(*) from public.messages
                        where created_at >= now() - interval '24 hours'),
      'messages_7d', (select count(*) from public.messages
                       where created_at >= now() - interval '7 days'),
      'avg_messages_per_match', (
        select coalesce(round(avg(per_match.n)::numeric, 1), 0)
        from (select count(*) as n from public.messages group by match_id) per_match
      ),
      'matches_with_messages', (
        select count(distinct match_id) from public.messages
      )
    ),

    'moderation', jsonb_build_object(
      'open_reports', (select count(*) from public.reports where status = 'open'),
      'reviewing_reports', (select count(*) from public.reports where status = 'reviewing'),
      'reports_7d', (select count(*) from public.reports
                      where created_at >= now() - interval '7 days'),
      'pending_photos', (select count(*) from public.profile_photos
                          where moderation_status = 'pending'),
      'pending_uploads', (select count(*) from public.member_photos
                           where moderation_status = 'pending'),
      'pending_verifications', (select count(*) from public.verification_requests
                                 where status = 'pending'),
      'pending_contact_requests', (select count(*) from public.contact_requests
                                    where status = 'pending'),
      'blocked_pairs', (select count(*) from public.blocks),
      'banned_emails', (select count(*) from public.blocked_email_domains)
    ),

    'signups_30d', (
      select coalesce(jsonb_agg(jsonb_build_object('date', day, 'count', n) order by day), '[]'::jsonb)
      from (
        select date_trunc('day', created_at)::date as day, count(*)::int as n
        from public.profiles
        where created_at >= now() - interval '30 days'
        group by 1
      ) s
    ),

    'messages_14d', (
      select coalesce(jsonb_agg(jsonb_build_object('date', day, 'count', n) order by day), '[]'::jsonb)
      from (
        select date_trunc('day', created_at)::date as day, count(*)::int as n
        from public.messages
        where created_at >= now() - interval '14 days'
        group by 1
      ) s
    ),

    'matches_14d', (
      select coalesce(jsonb_agg(jsonb_build_object('date', day, 'count', n) order by day), '[]'::jsonb)
      from (
        select date_trunc('day', created_at)::date as day, count(*)::int as n
        from public.matches
        where created_at >= now() - interval '14 days'
        group by 1
      ) s
    ),

    'gender_split', (
      select coalesce(jsonb_agg(jsonb_build_object('label', gender::text, 'count', n) order by n desc), '[]'::jsonb)
      from (
        select gender, count(*)::int as n
        from public.profiles
        group by 1
      ) s
    ),

    'age_buckets', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'count', n) order by floor_order), '[]'::jsonb)
      from (
        select
          case
            when age < 21 then '18-20'
            when age < 26 then '21-25'
            when age < 31 then '26-30'
            when age < 36 then '31-35'
            when age < 41 then '36-40'
            else '40+'
          end as label,
          case
            when age < 21 then 1
            when age < 26 then 2
            when age < 31 then 3
            when age < 36 then 4
            when age < 41 then 5
            else 6
          end as floor_order,
          count(*)::int as n
        from (
          select public.calculate_age(date_of_birth::text) as age
          from public.profiles
          where date_of_birth is not null
        ) people
        group by 1, 2
      ) s
    ),

    'top_cities', (
      select coalesce(jsonb_agg(jsonb_build_object('label', city, 'count', n) order by n desc), '[]'::jsonb)
      from (
        select location_city as city, count(*)::int as n
        from public.profiles
        where location_city is not null and btrim(location_city) <> ''
        group by 1
        order by n desc
        limit 8
      ) s
    ),

    'top_interests', (
      select coalesce(jsonb_agg(jsonb_build_object('label', interest, 'count', n) order by n desc), '[]'::jsonb)
      from (
        select btrim(i) as interest, count(*)::int as n
        from public.profiles, unnest(interests) as i
        where btrim(i) <> ''
        group by 1
        order by n desc
        limit 10
      ) s
    ),

    'recent_audit', (
      select coalesce(jsonb_agg(row_to_json(a) order by a.created_at desc), '[]'::jsonb)
      from (
        select l.id, l.action, l.target_user_id, l.details, l.created_at,
               p.full_name as admin_name
        from public.admin_audit_log l
        left join public.profiles p on p.id = l.admin_id
        order by l.created_at desc
        limit 8
      ) a
    )
  ) into payload;

  return payload;
end;
$$;

comment on function public.admin_dashboard_overview() is
  'Aggregate product analytics for the admin dashboard. Admin-only.';

revoke all on function public.admin_dashboard_overview() from public;
revoke all on function public.admin_dashboard_overview() from anon;
grant execute on function public.admin_dashboard_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- Member list
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_users(
  p_query text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  email text,
  age integer,
  gender text,
  location_city text,
  location_country text,
  is_verified boolean,
  is_banned boolean,
  is_admin boolean,
  incognito boolean,
  profile_paused boolean,
  is_visible boolean,
  created_at timestamptz,
  last_active_at timestamptz,
  photos_count integer,
  approved_uploads integer,
  matches_count integer,
  messages_sent integer,
  likes_sent integer,
  reports_against integer,
  verification_status text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  needle text := nullif(btrim(coalesce(p_query, '')), '');
  bounded_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  bounded_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.email,
    public.calculate_age(p.date_of_birth::text),
    p.gender::text,
    p.location_city,
    p.location_country,
    p.is_verified,
    p.is_banned,
    p.is_admin,
    p.incognito,
    p.profile_paused,
    p.is_visible,
    p.created_at,
    p.last_active_at,
    cardinality(p.photos),
    (select count(*)::int from public.member_photos mp
      where mp.user_id = p.id and mp.moderation_status = 'approved'),
    (select count(*)::int from public.matches m
      where m.user_id = p.id or m.matched_user_id = p.id),
    (select count(*)::int from public.messages msg where msg.sender_id = p.id),
    (select count(*)::int from public.likes l where l.liker_id = p.id),
    (select count(*)::int from public.reports r where r.reported_id = p.id),
    (select vr.status::text from public.verification_requests vr
      where vr.user_id = p.id
      order by vr.created_at desc
      limit 1)
  from public.profiles p
  where needle is null
     or p.full_name ilike '%' || needle || '%'
     or p.email ilike '%' || needle || '%'
     or p.location_city ilike '%' || needle || '%'
  order by p.created_at desc
  limit bounded_limit
  offset bounded_offset;
end;
$$;

comment on function public.admin_list_users(text, integer, integer) is
  'Searchable member directory with per-member activity counts. Admin-only.';

revoke all on function public.admin_list_users(text, integer, integer) from public;
revoke all on function public.admin_list_users(text, integer, integer) from anon;
grant execute on function public.admin_list_users(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- One member, everything about them
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_user(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  payload jsonb;
  admin_id uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id,
      'email', p.email,
      'full_name', p.full_name,
      'date_of_birth', p.date_of_birth,
      'age', public.calculate_age(p.date_of_birth::text),
      'gender', p.gender::text,
      'interested_in', p.interested_in::text[],
      'bio', p.bio,
      'photos', p.photos,
      'location_city', p.location_city,
      'location_state', p.location_state,
      'location_country', p.location_country,
      -- Stored at two decimals by the write trigger; never a precise fix.
      'latitude', p.latitude,
      'longitude', p.longitude,
      'height_cm', p.height_cm,
      'education', p.education,
      'occupation', p.occupation,
      'looking_for', p.looking_for::text,
      'interests', p.interests,
      'languages', p.languages,
      'smoking', p.smoking,
      'drinking', p.drinking,
      'exercise', p.exercise,
      'show_distance', p.show_distance,
      'age_verified', p.age_verified,
      'phone_verified', p.phone_verified,
      'whatsapp_consent', p.whatsapp_consent,
      'is_verified', p.is_verified,
      'is_visible', p.is_visible,
      'is_banned', p.is_banned,
      'is_admin', p.is_admin,
      'incognito', p.incognito,
      'profile_paused', p.profile_paused,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'last_active_at', p.last_active_at,
      'roles', (
        select coalesce(jsonb_agg(ur.role::text order by ur.role::text), '[]'::jsonb)
        from public.user_roles ur where ur.user_id = p.id
      ),
      'email_confirmed_at', (select u.email_confirmed_at from auth.users u where u.id = p.id),
      'last_sign_in_at', (select u.last_sign_in_at from auth.users u where u.id = p.id),
      -- The number itself is never returned, only whether one exists.
      'has_phone_number', exists (
        select 1 from public.private_contacts c where c.user_id = p.id
      ),
      'preferences', (
        select jsonb_build_object(
          'min_age', up.min_age,
          'max_age', up.max_age,
          'max_distance_km', up.max_distance_km,
          'show_me_to', up.show_me_to::text,
          'notifications', up.notifications,
          'privacy', up.privacy
        )
        from public.user_preferences up where up.user_id = p.id
      )
    ),

    'stats', jsonb_build_object(
      'photos', cardinality(p.photos),
      'approved_uploads', (select count(*) from public.member_photos mp
                            where mp.user_id = p.id and mp.moderation_status = 'approved'),
      'pending_uploads', (select count(*) from public.member_photos mp
                           where mp.user_id = p.id and mp.moderation_status = 'pending'),
      'likes_sent', (select count(*) from public.likes l where l.liker_id = p.id),
      'likes_received', (select count(*) from public.likes l where l.liked_id = p.id),
      'passes_sent', (select count(*) from public.passes ps where ps.user_id = p.id),
      'matches', (select count(*) from public.matches m
                   where m.user_id = p.id or m.matched_user_id = p.id),
      'messages_sent', (select count(*) from public.messages msg where msg.sender_id = p.id),
      'messages_received', (
        select count(*) from public.messages msg
        join public.matches m on m.id = msg.match_id
        where (m.user_id = p.id or m.matched_user_id = p.id) and msg.sender_id <> p.id
      ),
      'reports_made', (select count(*) from public.reports r where r.reporter_id = p.id),
      'reports_against', (select count(*) from public.reports r where r.reported_id = p.id),
      'blocks_made', (select count(*) from public.blocks b where b.blocker_id = p.id),
      'blocked_by', (select count(*) from public.blocks b where b.blocked_id = p.id),
      'contact_requests_sent', (select count(*) from public.contact_requests cr
                                 where cr.requester_id = p.id),
      'contact_requests_received', (select count(*) from public.contact_requests cr
                                     where cr.owner_id = p.id)
    ),

    'matches', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.matched_at desc), '[]'::jsonb)
      from (
        select
          m.id as match_id,
          m.created_at as matched_at,
          m.last_message_at,
          other.id as other_id,
          other.full_name as other_name,
          (select count(*) from public.messages msg where msg.match_id = m.id) as message_count
        from public.matches m
        join public.profiles other
          on other.id = case when m.user_id = p.id then m.matched_user_id else m.user_id end
        where m.user_id = p.id or m.matched_user_id = p.id
        order by m.created_at desc
        limit 20
      ) x
    ),

    'recent_messages', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc), '[]'::jsonb)
      from (
        select
          msg.id,
          msg.match_id,
          msg.sender_id,
          sender.full_name as sender_name,
          msg.content,
          msg.message_type::text,
          msg.read_at,
          msg.created_at
        from public.messages msg
        join public.matches m on m.id = msg.match_id
        join public.profiles sender on sender.id = msg.sender_id
        where m.user_id = p.id or m.matched_user_id = p.id
        order by msg.created_at desc
        limit 25
      ) x
    ),

    'reports_against', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc), '[]'::jsonb)
      from (
        select r.id, r.reason::text, r.details, r.status::text, r.created_at,
               reporter.full_name as reporter_name
        from public.reports r
        left join public.profiles reporter on reporter.id = r.reporter_id
        where r.reported_id = p.id
        order by r.created_at desc
        limit 10
      ) x
    ),

    'verification_requests', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc), '[]'::jsonb)
      from (
        select vr.id, vr.status::text, vr.pose_prompt, vr.reason,
               vr.created_at, vr.reviewed_at
        from public.verification_requests vr
        where vr.user_id = p.id
        order by vr.created_at desc
        limit 10
      ) x
    ),

    'audit_log', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc), '[]'::jsonb)
      from (
        select l.id, l.action, l.details, l.created_at,
               admin.full_name as admin_name
        from public.admin_audit_log l
        left join public.profiles admin on admin.id = l.admin_id
        where l.target_user_id = p.id
        order by l.created_at desc
        limit 20
      ) x
    )
  ) into payload
  from public.profiles p
  where p.id = p_user;

  if payload is null then
    raise exception 'No such member' using errcode = 'no_data_found';
  end if;

  -- Full visibility is deliberate and logged: reading an inbox is an action.
  perform public.write_admin_audit_log(
    'view_user_detail',
    p_user,
    jsonb_build_object('admin_id', admin_id)
  );

  return payload;
end;
$$;

comment on function public.admin_get_user(uuid) is
  'Everything about one member except the WhatsApp number. Admin-only and audited.';

revoke all on function public.admin_get_user(uuid) from public;
revoke all on function public.admin_get_user(uuid) from anon;
grant execute on function public.admin_get_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Conversation list
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_conversations(
  p_query text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  match_id uuid,
  user_a_id uuid,
  user_a_name text,
  user_b_id uuid,
  user_b_name text,
  matched_at timestamptz,
  last_message_at timestamptz,
  message_count integer,
  unread_count integer,
  last_message_preview text,
  last_sender_name text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  needle text := nullif(btrim(coalesce(p_query, '')), '');
  bounded_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  bounded_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    m.id,
    m.user_id,
    ua.full_name,
    m.matched_user_id,
    ub.full_name,
    m.created_at,
    m.last_message_at,
    (select count(*)::int from public.messages msg where msg.match_id = m.id),
    (select count(*)::int from public.messages msg
      where msg.match_id = m.id and msg.read_at is null),
    latest.content,
    latest.sender_name
  from public.matches m
  join public.profiles ua on ua.id = m.user_id
  join public.profiles ub on ub.id = m.matched_user_id
  left join lateral (
    select msg.content, sender.full_name as sender_name
    from public.messages msg
    join public.profiles sender on sender.id = msg.sender_id
    where msg.match_id = m.id
    order by msg.created_at desc
    limit 1
  ) latest on true
  where needle is null
     or ua.full_name ilike '%' || needle || '%'
     or ub.full_name ilike '%' || needle || '%'
     or latest.content ilike '%' || needle || '%'
  order by coalesce(m.last_message_at, m.created_at) desc
  limit bounded_limit
  offset bounded_offset;
end;
$$;

comment on function public.admin_list_conversations(text, integer, integer) is
  'Every match with participant names, message counts and a preview. Admin-only.';

revoke all on function public.admin_list_conversations(text, integer, integer) from public;
revoke all on function public.admin_list_conversations(text, integer, integer) from anon;
grant execute on function public.admin_list_conversations(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- One conversation, message bodies included
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_conversation(
  p_match uuid,
  p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  payload jsonb;
  bounded_limit integer := least(greatest(coalesce(p_limit, 200), 1), 500);
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'match', jsonb_build_object(
      'id', m.id,
      'matched_at', m.created_at,
      'last_message_at', m.last_message_at,
      'message_count', (select count(*) from public.messages msg where msg.match_id = m.id),
      'participants', jsonb_build_array(
        jsonb_build_object('id', ua.id, 'full_name', ua.full_name, 'email', ua.email),
        jsonb_build_object('id', ub.id, 'full_name', ub.full_name, 'email', ub.email)
      )
    ),
    'messages', coalesce((
      select jsonb_agg(row_to_json(x) order by x.created_at)
      from (
        select
          msg.id,
          msg.sender_id,
          sender.full_name as sender_name,
          msg.content,
          msg.message_type::text,
          msg.read_at,
          msg.created_at
        from public.messages msg
        join public.profiles sender on sender.id = msg.sender_id
        where msg.match_id = m.id
        order by msg.created_at desc
        limit bounded_limit
      ) x
    ), '[]'::jsonb)
  ) into payload
  from public.matches m
  join public.profiles ua on ua.id = m.user_id
  join public.profiles ub on ub.id = m.matched_user_id
  where m.id = p_match;

  if payload is null then
    raise exception 'No such conversation' using errcode = 'no_data_found';
  end if;

  perform public.write_admin_audit_log(
    'view_conversation',
    null,
    jsonb_build_object('match_id', p_match, 'limit', bounded_limit)
  );

  return payload;
end;
$$;

comment on function public.admin_get_conversation(uuid, integer) is
  'The messages of one match, newest last. Admin-only and audited.';

revoke all on function public.admin_get_conversation(uuid, integer) from public;
revoke all on function public.admin_get_conversation(uuid, integer) from anon;
grant execute on function public.admin_get_conversation(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Full-text-ish message search
-- ---------------------------------------------------------------------------
create or replace function public.admin_search_messages(
  p_query text,
  p_limit integer default 50
)
returns table (
  message_id uuid,
  match_id uuid,
  sender_id uuid,
  sender_name text,
  recipient_name text,
  content text,
  message_type text,
  read_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  needle text := nullif(btrim(coalesce(p_query, '')), '');
  bounded_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = 'insufficient_privilege';
  end if;

  if needle is null then
    raise exception 'A search term is required' using errcode = '22023';
  end if;

  perform public.write_admin_audit_log(
    'search_messages',
    null,
    jsonb_build_object('query', needle, 'limit', bounded_limit)
  );

  return query
  select
    msg.id,
    msg.match_id,
    msg.sender_id,
    sender.full_name,
    recipient.full_name,
    msg.content,
    msg.message_type::text,
    msg.read_at,
    msg.created_at
  from public.messages msg
  join public.profiles sender on sender.id = msg.sender_id
  join public.matches m on m.id = msg.match_id
  join public.profiles recipient
    on recipient.id = case when m.user_id = msg.sender_id then m.matched_user_id else m.user_id end
  where msg.content ilike '%' || needle || '%'
  order by msg.created_at desc
  limit bounded_limit;
end;
$$;

comment on function public.admin_search_messages(text, integer) is
  'Search across every message body. Admin-only and audited.';

revoke all on function public.admin_search_messages(text, integer) from public;
revoke all on function public.admin_search_messages(text, integer) from anon;
grant execute on function public.admin_search_messages(text, integer) to authenticated;

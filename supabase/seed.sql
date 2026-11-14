-- Seed data for the local stack only.
--
--   supabase db reset      # loads this after the migrations
--
-- NOTHING HERE IS REAL. Every name is invented, every address is a real city
-- paired with coordinates rounded to the two decimals the app stores, and every
-- phone number is inside the +1555 01xx range that the North American
-- numbering plan reserves for fictional use. There are no photographs: the
-- storage_path values point at a placeholder host that serves no image.
--
-- The demo member is demo@local.test / Demo-Local-2026. It exists so the app
-- can be driven end to end without signing up by hand. It holds the admin role
-- so /admin can be reached; nothing else in the app is different about it.
--
-- Every row created below sets four token columns to '': `confirmation_token`,
-- `recovery_token`, `email_change_token_new` and `email_change`.
--
-- All four are nullable in the table, and all four are scanned by GoTrue into a
-- Go `string`, which cannot hold NULL. Leaving any of them NULL does not fail as
-- a missing column: it fails as a bare
--   500 "Database error querying schema"
-- on password sign-in, for every seeded account, one column at a time, with the
-- real cause buried in the auth container's log:
--   sql: Scan error on column index N, name "...": converting NULL to string is unsupported
--
-- 01_schema_privileges.sql asserts all four stay non-null so this cannot come
-- back one column at a time.

-- ---------------------------------------------------------------------------
-- Demo account
-- ---------------------------------------------------------------------------
do $$
declare
  demo_id uuid;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    email_change_token_new, email_change, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated',
    'demo@local.test',
    crypt('Demo-Local-2026', gen_salt('bf')),
    now(), '', '', '', '', now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Demo Member"}'::jsonb
  )
  on conflict (id) do nothing;

  select id into demo_id from auth.users where email = 'demo@local.test';

  perform set_config('app.server_write', 'on', true);

  update public.profiles p
     set full_name = 'Demo Member',
         date_of_birth = date '1994-03-11',
         gender = 'prefer_not_to_say',
         interested_in = array['everyone']::public.interested_in[],
         bio = 'Local development account. Not a real person.',
         location_city = 'Mumbai',
         location_state = 'Maharashtra',
         location_country = 'India',
         latitude = 19.08,
         longitude = 72.88,
         height_cm = 170,
         education = 'BSc Computer Science',
         occupation = 'Software engineer',
         looking_for = 'friends',
         interests = array['climbing', 'film', 'coffee']::text[],
         languages = array['English', 'Hindi']::text[],
         smoking = 'never',
         drinking = 'socially',
         exercise = 'often',
         show_distance = true,
         is_verified = true
   where p.id = demo_id;

  insert into public.user_roles (user_id, role, granted_by)
  values (demo_id, 'admin', null)
  on conflict do nothing;

  perform set_config('app.server_write', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Twenty fictional members, plus one who stopped halfway through sign-up
-- ---------------------------------------------------------------------------
-- Staged in a temporary table so the same rows can drive both the auth.users
-- insert (profiles.id is a foreign key onto it) and the profiles insert.
--
-- Server-managed columns are written directly: this file runs as the table
-- owner, which the BEFORE trigger in migration 14 treats as a trusted write. A
-- real client runs as `authenticated` and cannot set any of them.

create temporary table seed_people on commit drop as
select d from jsonb_array_elements(
  $$
  [
    {"id":"20000000-0000-4000-8000-000000000001","email":"aarav@local.test","full_name":"Aarav Mehta","date_of_birth":"1996-02-18","gender":"male","interested_in":"everyone","bio":"Trail runner, terrible cook, reliable bus companion.","location_city":"Mumbai","location_state":"Maharashtra","location_country":"India","latitude":"19.08","longitude":"72.88","height_cm":"178","education":"BEng Mechanical","occupation":"Structural engineer","looking_for":"serious","interests":"running, cycling, trekking","languages":"English, Hindi, Marathi","smoking":"never","drinking":"socially","exercise":"daily","show_distance":true,"is_verified":true,"last_active_minutes_ago":"4"},
    {"id":"20000000-0000-4000-8000-000000000002","email":"diya@local.test","full_name":"Diya Sharma","date_of_birth":"1998-07-02","gender":"female","interested_in":"everyone","bio":"Pottery, long walks, and arguing about filter coffee.","location_city":"Mumbai","location_state":"Maharashtra","location_country":"India","latitude":"19.11","longitude":"72.84","height_cm":"163","education":"BA Fine Art","occupation":"Ceramicist","looking_for":"casual","interests":"pottery, reading, street food","languages":"English, Hindi","smoking":"never","drinking":"never","exercise":"often","show_distance":true,"is_verified":true,"last_active_minutes_ago":"22"},
    {"id":"20000000-0000-4000-8000-000000000003","email":"rohan@local.test","full_name":"Rohan Iyer","date_of_birth":"1994-11-30","gender":"male","interested_in":"female","bio":"Chennai transplant. Ask me about filter coffee.","location_city":"Pune","location_state":"Maharashtra","location_country":"India","latitude":"18.52","longitude":"73.86","height_cm":"175","education":"MSc Statistics","occupation":"Data analyst","looking_for":"serious","interests":"cricket, board games, cooking","languages":"English, Tamil, Hindi","smoking":"never","drinking":"socially","exercise":"sometimes","show_distance":true,"is_verified":false,"last_active_minutes_ago":"180"},
    {"id":"20000000-0000-4000-8000-000000000004","email":"ananya@local.test","full_name":"Ananya Nair","date_of_birth":"1997-05-21","gender":"female","interested_in":"everyone","bio":"Marine biologist. Occasionally surfaces to see sunlight.","location_city":"Kochi","location_state":"Kerala","location_country":"India","latitude":"9.93","longitude":"76.27","height_cm":"160","education":"MSc Marine Biology","occupation":"Research associate","looking_for":"casual","interests":"scuba diving, birdwatching, kayaking","languages":"English, Malayalam","smoking":"never","drinking":"never","exercise":"often","show_distance":true,"is_verified":true,"last_active_minutes_ago":"61"},
    {"id":"20000000-0000-4000-8000-000000000005","email":"kabir@local.test","full_name":"Kabir Singh","date_of_birth":"1993-01-09","gender":"male","interested_in":"everyone","bio":"I run a tiny bookshop and an even tinier podcast.","location_city":"Delhi","location_state":"Delhi","location_country":"India","latitude":"28.61","longitude":"77.21","height_cm":"181","education":"BA English","occupation":"Bookseller","looking_for":"friends","interests":"books, jazz, cycling","languages":"English, Hindi, Punjabi","smoking":"occasionally","drinking":"socially","exercise":"sometimes","show_distance":true,"is_verified":false,"last_active_minutes_ago":"1440"},
    {"id":"20000000-0000-4000-8000-000000000006","email":"meera@local.test","full_name":"Meera Joshi","date_of_birth":"1995-09-14","gender":"female","interested_in":"everyone","bio":"Architect. I will draw you a floor plan if you talk to me long enough.","location_city":"Pune","location_state":"Maharashtra","location_country":"India","latitude":"18.53","longitude":"73.85","height_cm":"165","education":"BArch","occupation":"Architect","looking_for":"serious","interests":"architecture, sketching, live music","languages":"English, Hindi, Marathi","smoking":"never","drinking":"socially","exercise":"sometimes","show_distance":true,"is_verified":true,"last_active_minutes_ago":"9"},
    {"id":"20000000-0000-4000-8000-000000000007","email":"vivek@local.test","full_name":"Vivek Ranganathan","date_of_birth":"1991-04-25","gender":"male","interested_in":"female","bio":"Backend engineer. I optimise things for fun, which is a problem.","location_city":"Bengaluru","location_state":"Karnataka","location_country":"India","latitude":"12.97","longitude":"77.59","height_cm":"174","education":"BTech IT","occupation":"Backend engineer","looking_for":"casual","interests":"climbing, chess, synthesizers","languages":"English, Tamil, Kannada","smoking":"never","drinking":"regularly","exercise":"often","show_distance":true,"is_verified":false,"last_active_minutes_ago":"7"},
    {"id":"20000000-0000-4000-8000-000000000008","email":"sneha@local.test","full_name":"Sneha Kulkarni","date_of_birth":"1999-12-03","gender":"female","interested_in":"everyone","bio":"Paediatric nurse. Night shifts, strong opinions about sleep.","location_city":"Mumbai","location_state":"Maharashtra","location_country":"India","latitude":"19.02","longitude":"72.94","height_cm":"158","education":"BSc Nursing","occupation":"Registered nurse","looking_for":"friends","interests":"baking, yoga, podcasts","languages":"English, Hindi, Marathi","smoking":"never","drinking":"never","exercise":"often","show_distance":true,"is_verified":true,"last_active_minutes_ago":"35"},
    {"id":"20000000-0000-4000-8000-000000000009","email":"arjun@local.test","full_name":"Arjun Deshpande","date_of_birth":"1992-06-17","gender":"male","interested_in":"everyone","bio":"Teacher. Ask me about the school lunch menu. Do not ask.","location_city":"Nashik","location_state":"Maharashtra","location_country":"India","latitude":"19.99","longitude":"73.79","height_cm":"177","education":"BEd","occupation":"Secondary school teacher","looking_for":"serious","interests":"hiking, crossword, vinyl","languages":"English, Hindi, Marathi","smoking":"never","drinking":"socially","exercise":"sometimes","show_distance":true,"is_verified":false,"last_active_minutes_ago":"2880"},
    {"id":"20000000-0000-4000-8000-000000000010","email":"priya@local.test","full_name":"Priya Ramanathan","date_of_birth":"1996-03-08","gender":"female","interested_in":"male,non_binary","bio":"Sound engineer. I will notice if your speakers are bad.","location_city":"Chennai","location_state":"Tamil Nadu","location_country":"India","latitude":"13.08","longitude":"80.27","height_cm":"162","education":"BE Electronics","occupation":"Sound engineer","looking_for":"casual","interests":"live music, synths, street photography","languages":"English, Tamil","smoking":"never","drinking":"socially","exercise":"often","show_distance":true,"is_verified":true,"last_active_minutes_ago":"13"},
    {"id":"20000000-0000-4000-8000-000000000011","email":"rahul@local.test","full_name":"Rahul Batra","date_of_birth":"1990-08-30","gender":"male","interested_in":"everyone","bio":"I have strong opinions about biryani and no filter for saying so.","location_city":"Hyderabad","location_state":"Telangana","location_country":"India","latitude":"17.39","longitude":"78.49","height_cm":"180","education":"MBA","occupation":"Sales manager","looking_for":"unsure","interests":"food, cricket, photography","languages":"English, Hindi, Telugu","smoking":"occasionally","drinking":"regularly","exercise":"never","show_distance":true,"is_verified":false,"last_active_minutes_ago":"4320"},
    {"id":"20000000-0000-4000-8000-000000000012","email":"tanya@local.test","full_name":"Tanya Bedi","date_of_birth":"1998-10-11","gender":"female","interested_in":"everyone","bio":"Climbing gym instructor. I will spot you, I will not carry you.","location_city":"Bengaluru","location_state":"Karnataka","location_country":"India","latitude":"12.95","longitude":"77.61","height_cm":"167","education":"BPE","occupation":"Fitness instructor","looking_for":"casual","interests":"bouldering, surfskate, salsa","languages":"English, Kannada, Hindi","smoking":"never","drinking":"never","exercise":"daily","show_distance":true,"is_verified":true,"last_active_minutes_ago":"2"},
    {"id":"20000000-0000-4000-8000-000000000013","email":"aditya@local.test","full_name":"Aditya Rao","date_of_birth":"1994-02-28","gender":"male","interested_in":"everyone","bio":"Pastry chef. Please do not ask me to bake a cake on a Tuesday.","location_city":"Mumbai","location_state":"Maharashtra","location_country":"India","latitude":"19.06","longitude":"72.86","height_cm":"173","education":"Diploma Hotel Management","occupation":"Pastry chef","looking_for":"friends","interests":"baking, coffee, cycling","languages":"English, Kannada, Hindi, Marathi","smoking":"never","drinking":"socially","exercise":"often","show_distance":true,"is_verified":true,"last_active_minutes_ago":"48"},
    {"id":"20000000-0000-4000-8000-000000000014","email":"ishita@local.test","full_name":"Ishita Ghosh","date_of_birth":"1997-07-19","gender":"female","interested_in":"everyone","bio":"Documentary editor. Long hours, quiet rooms, strong tea.","location_city":"Kolkata","location_state":"West Bengal","location_country":"India","latitude":"22.57","longitude":"88.36","height_cm":"159","education":"BA Mass Media","occupation":"Video editor","looking_for":"serious","interests":"film, birding, letterpress","languages":"English, Bengali, Hindi","smoking":"never","drinking":"never","exercise":"sometimes","show_distance":true,"is_verified":false,"last_active_minutes_ago":"120"},
    {"id":"20000000-0000-4000-8000-000000000015","email":"nikhil@local.test","full_name":"Nikhil Verma","date_of_birth":"1989-11-05","gender":"male","interested_in":"everyone","bio":"Photographer. Golden hour or nothing.","location_city":"Jaipur","location_state":"Rajasthan","location_country":"India","latitude":"26.91","longitude":"75.79","height_cm":"179","education":"BA Photography","occupation":"Photographer","looking_for":"unsure","interests":"landscape photography, history, long drives","languages":"English, Hindi","smoking":"occasionally","drinking":"socially","exercise":"sometimes","show_distance":true,"is_verified":true,"last_active_minutes_ago":"600"},
    {"id":"20000000-0000-4000-8000-000000000016","email":"aisha@local.test","full_name":"Aisha Khan","date_of_birth":"1995-05-24","gender":"female","interested_in":"everyone","bio":"Gardener and part-time radio operator. Yes, both.","location_city":"Bhopal","location_state":"Madhya Pradesh","location_country":"India","latitude":"23.26","longitude":"77.41","height_cm":"161","education":"BS Agriculture","occupation":"Horticulturist","looking_for":"friends","interests":"gardening, amateur radio, birding","languages":"English, Hindi, Urdu","smoking":"never","drinking":"never","exercise":"often","show_distance":true,"is_verified":false,"last_active_minutes_ago":"90"},
    {"id":"20000000-0000-4000-8000-000000000017","email":"siddharth@local.test","full_name":"Siddharth Malhotra","date_of_birth":"1993-09-12","gender":"male","interested_in":"everyone","bio":"Runs a small design studio. Will talk about kerning unprompted.","location_city":"Gurugram","location_state":"Haryana","location_country":"India","latitude":"28.46","longitude":"77.03","height_cm":"176","education":"BDes Graphic Design","occupation":"Design studio owner","looking_for":"casual","interests":"typography, cycling, espresso","languages":"English, Hindi","smoking":"never","drinking":"socially","exercise":"daily","show_distance":true,"is_verified":true,"last_active_minutes_ago":"16"},
    {"id":"20000000-0000-4000-8000-000000000018","email":"fatima@local.test","full_name":"Fatima Sheikh","date_of_birth":"2000-01-23","gender":"female","interested_in":"everyone","bio":"Law student. Reading is a love language.","location_city":"Mumbai","location_state":"Maharashtra","location_country":"India","latitude":"18.99","longitude":"72.83","height_cm":"164","education":"LLB","occupation":"Law student","looking_for":"casual","interests":"debate, reading, badminton","languages":"English, Hindi, Marathi","smoking":"never","drinking":"never","exercise":"sometimes","show_distance":true,"is_verified":false,"last_active_minutes_ago":"70"},
    {"id":"20000000-0000-4000-8000-000000000019","email":"harsh@local.test","full_name":"Harsh Agarwal","date_of_birth":"1992-06-02","gender":"male","interested_in":"male,everyone","bio":"Into climbing, bouldering, and long train journeys.","location_city":"Pune","location_state":"Maharashtra","location_country":"India","latitude":"18.50","longitude":"73.88","height_cm":"172","education":"BCom","occupation":"Accountant","looking_for":"friends","interests":"bouldering, trains, podcasts","languages":"English, Hindi","smoking":"never","drinking":"socially","exercise":"often","show_distance":true,"is_verified":false,"last_active_minutes_ago":"26"},
    {"id":"20000000-0000-4000-8000-000000000020","email":"anika@local.test","full_name":"Anika Pillai","date_of_birth":"1998-08-15","gender":"female","interested_in":"everyone","bio":"Has not finished her degree. Has finished a lot of books.","location_city":"Kochi","location_state":"Kerala","location_country":"India","latitude":"9.99","longitude":"76.31","height_cm":"157","education":"BA Philosophy","occupation":"Bookseller","looking_for":"unsure","interests":"reading, swimming, cooking","languages":"English, Malayalam","smoking":"never","drinking":"never","exercise":"often","show_distance":false,"is_verified":false,"last_active_minutes_ago":"500"},

    {"id":"20000000-0000-4000-8000-000000000021","email":"halfway@local.test","full_name":"Halfway Through Signup","date_of_birth":null,"location_city":"Mumbai","location_country":"India"}
  ]
  $$
) as t(d);

-- auth.users first: profiles.id is a foreign key onto it, and the insert fires
-- on_auth_user_created, which is what creates the empty profile row the real
-- sign-up flow then fills in. `local-seed-only` is not a credential worth
-- having: these accounts exist to be discovered, not logged into.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token,
  email_change_token_new, email_change, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
select
  '00000000-0000-0000-0000-000000000000',
  (d->>'id')::uuid,
  'authenticated',
  'authenticated',
  d->>'email',
  crypt('local-seed-only', gen_salt('bf')),
  now(), '', '', '', '', now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', d->>'full_name')
from seed_people
on conflict (id) do nothing;

-- Twenty complete profiles, plus one that stopped halfway through sign-up so
-- the discovery filters have a row to actually exclude. is_visible is derived
-- by the trigger from having a name, a birth date and a city.
insert into public.profiles (
  id, email, full_name, date_of_birth, gender, interested_in, bio,
  location_city, location_state, location_country, latitude, longitude,
  height_cm, education, occupation, looking_for, interests, languages,
  smoking, drinking, exercise, show_distance, is_verified, last_active_at
)
select
  (d->>'id')::uuid,
  d->>'email',
  d->>'full_name',
  (d->>'date_of_birth')::date,
  (d->>'gender')::public.gender,
  string_to_array(d->>'interested_in', ',')::public.interested_in[],
  d->>'bio',
  d->>'location_city',
  d->>'location_state',
  d->>'location_country',
  (d->>'latitude')::numeric,
  (d->>'longitude')::numeric,
  (d->>'height_cm')::integer,
  d->>'education',
  d->>'occupation',
  (d->>'looking_for')::public.looking_for,
  (select coalesce(array_agg(btrim(x)), '{}'::text[])
     from unnest(string_to_array(d->>'interests', ',')) x
    where btrim(x) <> ''),
  string_to_array(d->>'languages', ',')::text[],
  d->>'smoking',
  d->>'drinking',
  d->>'exercise',
  (d->>'show_distance')::boolean,
  (d->>'is_verified')::boolean,
  now() - make_interval(mins => (d->>'last_active_minutes_ago')::integer)
from seed_people
where d->'date_of_birth' is not null
  and d->'date_of_birth' <> 'null'::jsonb
on conflict (id) do update set
  full_name = excluded.full_name,
  date_of_birth = excluded.date_of_birth,
  gender = excluded.gender,
  interested_in = excluded.interested_in,
  bio = excluded.bio,
  location_city = excluded.location_city,
  location_state = excluded.location_state,
  location_country = excluded.location_country,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  height_cm = excluded.height_cm,
  education = excluded.education,
  occupation = excluded.occupation,
  looking_for = excluded.looking_for,
  interests = excluded.interests,
  languages = excluded.languages,
  smoking = excluded.smoking,
  drinking = excluded.drinking,
  exercise = excluded.exercise,
  show_distance = excluded.show_distance,
  is_verified = excluded.is_verified,
  last_active_at = excluded.last_active_at;

-- The one member who never finished onboarding. No birth date, so the trigger
-- leaves is_visible false and discovery never returns this row. The row already
-- exists — the auth.users insert above fired on_auth_user_created — so this
-- fills it in rather than inserting.
update public.profiles p
   set full_name = s.d->>'full_name',
       location_city = s.d->>'location_city',
       location_country = s.d->>'location_country'
  from seed_people s
 where s.d->'date_of_birth' = 'null'::jsonb
   and p.id = (s.d->>'id')::uuid;

-- ---------------------------------------------------------------------------
-- One banned profile, to prove banned members are filtered.
-- ---------------------------------------------------------------------------
update public.profiles set is_banned = true where id = '20000000-0000-4000-8000-000000000005';

-- ---------------------------------------------------------------------------
-- Fictional contact numbers, for the WhatsApp handover flow.
--
-- +1555 01xx is the range reserved by the North American Numbering Plan for
-- fiction, so none of these can belong to a real person. Stored in
-- private_contacts only — no other table in this schema holds a number.
-- ---------------------------------------------------------------------------
insert into private_contacts (user_id, whatsapp_number, share_mode) values
  ('11111111-1111-4111-8111-111111111111', '+15550100001', 'matches'),
  ('20000000-0000-4000-8000-000000000001', '+15550100002', 'matches'),
  ('20000000-0000-4000-8000-000000000002', '+15550100003', 'matches'),
  ('20000000-0000-4000-8000-000000000006', '+15550100004', 'never'),
  ('20000000-0000-4000-8000-000000000012', '+15550100005', 'approved')
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Moderation queue: two photos awaiting review, two approved.
-- ---------------------------------------------------------------------------
insert into profile_photos (user_id, storage_path, position, moderation_status) values
  ('20000000-0000-4000-8000-000000000001', 'https://placehold.co/600x800/png?text=Aarav+1', 0, 'pending'),
  ('20000000-0000-4000-8000-000000000001', 'https://placehold.co/600x800/png?text=Aarav+2', 1, 'pending'),
  ('20000000-0000-4000-8000-000000000002', 'https://placehold.co/600x800/png?text=Diya+1', 0, 'approved'),
  ('20000000-0000-4000-8000-000000000012', 'https://placehold.co/600x800/png?text=Tanya+1', 0, 'approved')
on conflict (storage_path) do nothing;

-- ---------------------------------------------------------------------------
-- Uploaded photos (member_photos), for the same fictional members.
--
-- These rows describe objects that the placeholder storage does not actually
-- serve, so the client's signed-URL resolution drops them; what matters here is
-- the moderation shape they give the feed and the completeness signal. The
-- demo member carries two approved uploads so its profile satisfies the
-- two-photo completeness requirement.
-- ---------------------------------------------------------------------------
insert into member_photos (user_id, storage_path, position, moderation_status) values
  -- demo: two approved uploads.
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111/00000000-0000-4000-8000-000000000001.webp', 0, 'approved'),
  ('11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111/00000000-0000-4000-8000-000000000002.webp', 1, 'approved'),
  -- aarav: two approved, one pending (moderation queue).
  ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000101.webp', 0, 'approved'),
  ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000102.webp', 1, 'approved'),
  ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000103.webp', 2, 'pending'),
  -- diya: two approved, one pending.
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000201.webp', 0, 'approved'),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000202.webp', 1, 'approved'),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000203.webp', 2, 'pending'),
  -- tanya: one approved, one pending.
  ('20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000012/00000000-0000-4000-8000-000000000301.webp', 0, 'approved'),
  ('20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000012/00000000-0000-4000-8000-000000000302.webp', 1, 'pending'),
  -- vivek: one approved upload (unverified member, so the verified-only
  -- filter has a real set to prune).
  ('20000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000007/00000000-0000-4000-8000-000000000401.webp', 0, 'approved')
on conflict (storage_path) do nothing;

-- ---------------------------------------------------------------------------
-- City gazetteer: the search autocomplete source.
--
-- Same two-decimal rounding as every stored coordinate in this schema. Every
-- city below appears in the fictional members above, plus a few extras so the
-- autocomplete has something to offer a member typing a city that nobody in
-- the seed lives in.
-- ---------------------------------------------------------------------------
insert into public.city_coordinates (city, country, latitude, longitude) values
  ('Mumbai', 'India', 19.08, 72.88),
  ('Pune', 'India', 18.52, 73.86),
  ('Kochi', 'India', 9.93, 76.27),
  ('Delhi', 'India', 28.61, 77.21),
  ('Bengaluru', 'India', 12.97, 77.59),
  ('Nashik', 'India', 20.00, 73.79),
  ('Chennai', 'India', 13.08, 80.27),
  ('Hyderabad', 'India', 17.39, 78.49),
  ('Kolkata', 'India', 22.57, 88.36),
  ('Jaipur', 'India', 26.91, 75.79),
  ('Bhopal', 'India', 23.26, 77.41),
  ('Gurugram', 'India', 28.46, 77.03),
  ('Leeds', 'United Kingdom', 53.80, -1.55),
  ('London', 'United Kingdom', 51.51, -0.13),
  ('Manchester', 'United Kingdom', 53.48, -2.24),
  ('Edinburgh', 'United Kingdom', 55.95, -3.19),
  ('Paris', 'France', 48.86, 2.35),
  ('Berlin', 'Germany', 52.52, 13.41),
  ('New York', 'United States', 40.71, -74.01),
  ('San Francisco', 'United States', 37.77, -122.42)
on conflict (city, country) do nothing;

-- ---------------------------------------------------------------------------
-- A one-sided like, so the signed-in demo member completes a match the moment
-- they like the nearest candidate (aarav). Purposely one-sided: the seeded
-- set must still contain no matches (test 03 asserts that), and the like only
-- becomes a match when the deck's own send_like call reciprocates it.
-- ---------------------------------------------------------------------------
insert into public.likes (liker_id, liked_id, type)
values ('20000000-0000-4000-8000-000000000001',
        '11111111-1111-4111-8111-111111111111', 'like')
on conflict (liker_id, liked_id) do nothing;

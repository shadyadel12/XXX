-- Dev seed data. Runs on `supabase db reset` (local stack only — never in prod).
-- Creates: 1 admin, 1 coach, 2 players (one active link, one expired).
-- All accounts use password: Password123!
--
-- Auth users are inserted directly (local dev only). The on_auth_user_created
-- trigger creates matching public.profiles rows from raw_user_meta_data.

-- Deterministic UUIDs so we can reference them below.
-- admin  : 00000000-0000-0000-0000-000000000001
-- coach  : 00000000-0000-0000-0000-000000000002
-- player1: 00000000-0000-0000-0000-000000000003  (active subscription)
-- player2: 00000000-0000-0000-0000-000000000004  (expired subscription)

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001',
   'authenticated', 'authenticated', 'admin@example.com',
   crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"name":"Platform Admin","role":"admin"}', now(), now()),

  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002',
   'authenticated', 'authenticated', 'coach@example.com',
   crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"name":"Casey Coach","role":"coach"}', now(), now()),

  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003',
   'authenticated', 'authenticated', 'player1@example.com',
   crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"name":"Pat Player","role":"player"}', now(), now()),

  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004',
   'authenticated', 'authenticated', 'player2@example.com',
   crypt('Password123!', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"name":"Jamie Player","role":"player"}', now(), now());

-- Identities (required for email/password sign-in in local Auth).
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   '{"sub":"00000000-0000-0000-0000-000000000001","email":"admin@example.com"}',
   'email', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002',
   '{"sub":"00000000-0000-0000-0000-000000000002","email":"coach@example.com"}',
   'email', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003',
   '{"sub":"00000000-0000-0000-0000-000000000003","email":"player1@example.com"}',
   'email', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004',
   '{"sub":"00000000-0000-0000-0000-000000000004","email":"player2@example.com"}',
   'email', now(), now(), now());

-- Links: player1 active (ends in 90 days), player2 expired (ended yesterday).
insert into public.coach_player_links
  (coach_id, player_id, subscription_key, subscription_end_date, status)
values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
   'KEY-ACTIVE-0001', current_date + 90, 'active'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004',
   'KEY-EXPIRED-0002', current_date - 1, 'active');

-- Sample program for player1: Week 1, Sunday (training) + Monday (rest).
insert into public.program_days (id, player_id, coach_id, week_number, day_of_week, day_type, title, diet_plan)
values
  ('00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002',
   1, 0, 'training', 'Push Day', 'High protein: chicken, rice, veg.'),
  ('00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002',
   1, 1, 'rest', null, 'Rest day: light meals, stay hydrated.');

insert into public.exercises (program_day_id, position, name, target_sets, target_reps, coach_comment)
values
  ('00000000-0000-0000-0000-0000000000a1', 0, 'Chest Press', 4, '8-12', 'Controlled tempo.'),
  ('00000000-0000-0000-0000-0000000000a1', 1, 'Shoulder Press', 3, '10-12', 'Keep core tight.');

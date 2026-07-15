-- 0001: enums, profiles table, and auth.users -> profiles trigger.

create type user_role   as enum ('admin', 'coach', 'player');
create type day_type    as enum ('training', 'rest');
create type link_status as enum ('active', 'expired', 'revoked');

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       user_role not null default 'player',
  email      text not null,
  name       text,
  created_at timestamptz not null default now()
);
create index idx_profiles_role on public.profiles(role);

-- Populate profiles on signup. Role/name come from user metadata set at
-- creation time; the admin edge function sets role='coach'|'player' explicitly.
-- SECURITY DEFINER so it can insert into public.profiles from the auth schema.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'name',
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'player')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
-- 0002: coach <-> player links carrying the subscription key + expiry.

create table public.coach_player_links (
  id                    uuid primary key default gen_random_uuid(),
  coach_id              uuid not null references public.profiles(id) on delete cascade,
  player_id             uuid not null references public.profiles(id) on delete cascade,
  subscription_key      text not null unique,
  subscription_end_date date not null,
  status                link_status not null default 'active',
  created_at            timestamptz not null default now(),
  unique (coach_id, player_id)
);
create index idx_cpl_coach  on public.coach_player_links(coach_id);
create index idx_cpl_player on public.coach_player_links(player_id);
create index idx_cpl_key    on public.coach_player_links(subscription_key);

-- A subscription is valid when: status = 'active' AND end_date >= current_date.
-- 0003: program_days (per player, per week + day-of-week) and exercises.

create table public.program_days (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.profiles(id) on delete cascade,
  coach_id    uuid not null references public.profiles(id) on delete cascade,
  week_number int  not null check (week_number >= 1),
  day_of_week int  not null check (day_of_week between 0 and 6), -- 0=Sun .. 6=Sat
  day_type    day_type not null default 'training',
  title       text,        -- e.g. "Push Day"
  diet_plan   text,        -- optional, both day types
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (player_id, week_number, day_of_week)
);
create index idx_pd_player_week on public.program_days(player_id, week_number);
create index idx_pd_coach on public.program_days(coach_id);

create table public.exercises (
  id                      uuid primary key default gen_random_uuid(),
  program_day_id          uuid not null references public.program_days(id) on delete cascade,
  position                int  not null default 0,   -- ordering within the day
  name                    text not null,
  target_sets             int,
  target_reps             text,   -- free text: "8-12", "AMRAP"
  coach_video_url         text,   -- Storage path OR external URL
  coach_video_is_external boolean not null default false,
  coach_comment           text,
  created_at              timestamptz not null default now()
);
create index idx_ex_program_day on public.exercises(program_day_id);

-- Keep updated_at fresh on program_days.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_program_days_touch
  before update on public.program_days
  for each row execute procedure public.touch_updated_at();
-- 0004: exercise_logs (player performance), messages, checkups.

create table public.exercise_logs (
  id                       uuid primary key default gen_random_uuid(),
  exercise_id              uuid not null references public.exercises(id) on delete cascade,
  player_id                uuid not null references public.profiles(id) on delete cascade,
  log_date                 date not null default current_date,
  actual_sets              int,
  actual_reps              text,
  player_video_url         text,
  player_video_is_external boolean not null default false,
  player_comment           text,
  is_completed             boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (exercise_id, player_id, log_date)
);
create index idx_log_exercise    on public.exercise_logs(exercise_id);
create index idx_log_player_date on public.exercise_logs(player_id, log_date);

create trigger trg_exercise_logs_touch
  before update on public.exercise_logs
  for each row execute procedure public.touch_updated_at();

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.profiles(id) on delete cascade,
  player_id   uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete cascade, -- null = general
  body        text not null,
  created_at  timestamptz not null default now()
);
create index idx_msg_player   on public.messages(player_id);
create index idx_msg_exercise on public.messages(exercise_id);

create table public.checkups (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references public.profiles(id) on delete cascade,
  player_id  uuid not null references public.profiles(id) on delete cascade,
  check_date date not null default current_date,
  is_checked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (coach_id, player_id, check_date)
);
create index idx_checkup_coach_date on public.checkups(coach_id, check_date);
-- 0005: SECURITY DEFINER helper functions used by RLS policies.
-- These run with the definer's privileges, avoiding recursive RLS evaluation
-- (e.g. a policy on profiles that itself needs to read profiles).

-- The caller's role. Named public.auth_role to avoid clashing with the
-- reserved-ish current_role builtin.
create or replace function public.auth_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- True if the given player is linked to the calling coach.
create or replace function public.is_my_player(p_player uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coach_player_links
    where coach_id = auth.uid() and player_id = p_player
  );
$$;

grant execute on function public.auth_role() to authenticated;
grant execute on function public.is_my_player(uuid) to authenticated;
-- 0006: Row-Level Security. Default-deny on every table; policies grant
-- admin = all, coach = only linked players, player = only self.
-- Multiple policies for the same command are OR'd together.
-- auth.uid() is wrapped as (select auth.uid()) for per-statement caching.

-- ------------------------------------------------------------------ profiles
alter table public.profiles enable row level security;

create policy profiles_self_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_coach_select_linked on public.profiles
  for select to authenticated
  using (public.auth_role() = 'coach' and public.is_my_player(id));

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

-- --------------------------------------------------------- coach_player_links
alter table public.coach_player_links enable row level security;

create policy cpl_coach_select on public.coach_player_links
  for select to authenticated
  using (coach_id = (select auth.uid()));

create policy cpl_player_select on public.coach_player_links
  for select to authenticated
  using (player_id = (select auth.uid()));

create policy cpl_admin_all on public.coach_player_links
  for all to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

-- ------------------------------------------------------------- program_days
alter table public.program_days enable row level security;

create policy pd_player_select on public.program_days
  for select to authenticated
  using (player_id = (select auth.uid()));

create policy pd_coach_select on public.program_days
  for select to authenticated
  using (public.auth_role() = 'coach' and public.is_my_player(player_id));

create policy pd_coach_insert on public.program_days
  for insert to authenticated
  with check (
    public.auth_role() = 'coach'
    and coach_id = (select auth.uid())
    and public.is_my_player(player_id)
  );

create policy pd_coach_update on public.program_days
  for update to authenticated
  using (public.auth_role() = 'coach' and public.is_my_player(player_id))
  with check (public.auth_role() = 'coach' and public.is_my_player(player_id));

create policy pd_coach_delete on public.program_days
  for delete to authenticated
  using (public.auth_role() = 'coach' and public.is_my_player(player_id));

create policy pd_admin_all on public.program_days
  for all to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

-- --------------------------------------------------------------- exercises
-- No player_id column; authorize via the parent program_day.
alter table public.exercises enable row level security;

create policy ex_player_select on public.exercises
  for select to authenticated
  using (exists (
    select 1 from public.program_days pd
    where pd.id = exercises.program_day_id
      and pd.player_id = (select auth.uid())
  ));

create policy ex_coach_all on public.exercises
  for all to authenticated
  using (
    public.auth_role() = 'coach' and exists (
      select 1 from public.program_days pd
      where pd.id = exercises.program_day_id and public.is_my_player(pd.player_id)
    )
  )
  with check (
    public.auth_role() = 'coach' and exists (
      select 1 from public.program_days pd
      where pd.id = exercises.program_day_id and public.is_my_player(pd.player_id)
    )
  );

create policy ex_admin_all on public.exercises
  for all to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

-- ------------------------------------------------------------ exercise_logs
alter table public.exercise_logs enable row level security;

create policy log_player_all on public.exercise_logs
  for all to authenticated
  using (player_id = (select auth.uid()))
  with check (player_id = (select auth.uid()));

create policy log_coach_select on public.exercise_logs
  for select to authenticated
  using (public.auth_role() = 'coach' and public.is_my_player(player_id));

create policy log_admin_all on public.exercise_logs
  for all to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

-- ---------------------------------------------------------------- messages
alter table public.messages enable row level security;

create policy msg_player_select on public.messages
  for select to authenticated
  using (player_id = (select auth.uid()));

create policy msg_coach_select on public.messages
  for select to authenticated
  using (coach_id = (select auth.uid()));

create policy msg_coach_insert on public.messages
  for insert to authenticated
  with check (
    public.auth_role() = 'coach'
    and coach_id = (select auth.uid())
    and public.is_my_player(player_id)
  );

create policy msg_coach_delete on public.messages
  for delete to authenticated
  using (coach_id = (select auth.uid()));

create policy msg_admin_all on public.messages
  for all to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

-- ---------------------------------------------------------------- checkups
alter table public.checkups enable row level security;

create policy checkup_coach_all on public.checkups
  for all to authenticated
  using (public.auth_role() = 'coach' and coach_id = (select auth.uid()))
  with check (public.auth_role() = 'coach' and coach_id = (select auth.uid()));

create policy checkup_admin_all on public.checkups
  for all to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');
-- 0007: private 'videos' bucket + storage RLS.
-- Object path convention: videos/{player_id}/<filename>
-- A player reads/writes only their own prefix; the linked coach can read it.

insert into storage.buckets (id, name, public)
values ('videos', 'videos', false)
on conflict (id) do nothing;

-- Helper: the player_id encoded as the first folder of an object path.
-- storage.foldername(name) returns the path segments as a text[].

create policy videos_player_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy videos_player_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy videos_player_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy videos_player_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Linked coach can read a player's videos.
create policy videos_coach_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'videos'
    and public.auth_role() = 'coach'
    and public.is_my_player(((storage.foldername(name))[1])::uuid)
  );

-- Coach can also upload a coaching video into a linked player's folder.
create policy videos_coach_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'videos'
    and public.auth_role() = 'coach'
    and public.is_my_player(((storage.foldername(name))[1])::uuid)
  );

create policy videos_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'videos' and public.auth_role() = 'admin')
  with check (bucket_id = 'videos' and public.auth_role() = 'admin');

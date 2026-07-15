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

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

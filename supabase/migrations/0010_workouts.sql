-- 0010: introduce a `workouts` layer between program_days and exercises.
-- Model becomes: program_days (Monday) -> workouts (named) -> exercises.

-- ---------------------------------------------------------------------------
-- workouts table
-- ---------------------------------------------------------------------------
create table if not exists public.workouts (
  id             uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days(id) on delete cascade,
  position       int  not null default 0,
  name           text not null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_workouts_day on public.workouts(program_day_id);

-- ---------------------------------------------------------------------------
-- exercises: add workout_id. Keep program_day_id for the migration, then make
-- workout_id the parent. New exercises reference a workout.
-- ---------------------------------------------------------------------------
alter table public.exercises
  add column if not exists workout_id uuid references public.workouts(id) on delete cascade;

-- Migrate: for each existing training day, create one workout (named from the
-- day title, or 'Workout') and move its exercises under it.
do $$
declare
  d record;
  w_id uuid;
begin
  for d in
    select distinct pd.id, pd.title
    from public.program_days pd
    join public.exercises e on e.program_day_id = pd.id
    where e.workout_id is null
  loop
    insert into public.workouts (program_day_id, name, position)
      values (d.id, coalesce(nullif(d.title, ''), 'Workout'), 0)
      returning id into w_id;
    update public.exercises
      set workout_id = w_id
      where program_day_id = d.id and workout_id is null;
  end loop;
end $$;

create index if not exists idx_ex_workout on public.exercises(workout_id);

-- ---------------------------------------------------------------------------
-- RLS for workouts: same rules as exercises, authorized via the parent day.
-- ---------------------------------------------------------------------------
alter table public.workouts enable row level security;

create policy wk_player_select on public.workouts
  for select to authenticated
  using (exists (
    select 1 from public.program_days pd
    where pd.id = workouts.program_day_id and pd.player_id = (select auth.uid())
  ));

create policy wk_coach_all on public.workouts
  for all to authenticated
  using (
    public.auth_role() = 'coach' and exists (
      select 1 from public.program_days pd
      where pd.id = workouts.program_day_id and public.is_my_player(pd.player_id)
    )
  )
  with check (
    public.auth_role() = 'coach' and exists (
      select 1 from public.program_days pd
      where pd.id = workouts.program_day_id and public.is_my_player(pd.player_id)
    )
  );

create policy wk_admin_all on public.workouts
  for all to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Update exercise RLS to authorize via workout -> program_day (previously via
-- program_day directly). Drop old policies, add workout-based ones.
-- ---------------------------------------------------------------------------
drop policy if exists ex_player_select on public.exercises;
drop policy if exists ex_coach_all on public.exercises;

create policy ex_player_select on public.exercises
  for select to authenticated
  using (exists (
    select 1
    from public.workouts w
    join public.program_days pd on pd.id = w.program_day_id
    where w.id = exercises.workout_id and pd.player_id = (select auth.uid())
  ));

create policy ex_coach_all on public.exercises
  for all to authenticated
  using (
    public.auth_role() = 'coach' and exists (
      select 1
      from public.workouts w
      join public.program_days pd on pd.id = w.program_day_id
      where w.id = exercises.workout_id and public.is_my_player(pd.player_id)
    )
  )
  with check (
    public.auth_role() = 'coach' and exists (
      select 1
      from public.workouts w
      join public.program_days pd on pd.id = w.program_day_id
      where w.id = exercises.workout_id and public.is_my_player(pd.player_id)
    )
  );
-- ex_admin_all stays as-is.

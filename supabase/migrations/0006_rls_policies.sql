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

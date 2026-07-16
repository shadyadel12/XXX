-- 0013: per-set logging. Each exercise_log row can have N child set_logs
-- (Set 1, Set 2, ...) with their own reps and weight. The parent's aggregate
-- actual_sets / actual_reps / actual_weight fields stay as a compact summary
-- used by existing UI and analysis; they're kept in sync by triggers below.

create table if not exists public.set_logs (
  id              uuid primary key default gen_random_uuid(),
  exercise_log_id uuid not null references public.exercise_logs(id) on delete cascade,
  set_number      int  not null check (set_number >= 1),
  reps            text,
  weight          text,
  created_at      timestamptz not null default now(),
  unique (exercise_log_id, set_number)
);
create index if not exists idx_setlogs_parent on public.set_logs(exercise_log_id);

alter table public.set_logs enable row level security;

-- Access mirrors exercise_logs: player owns their sets; coach reads for linked
-- players; admin all. Authorize via the parent exercise_logs row.

create policy setlog_player_all on public.set_logs
  for all to authenticated
  using (exists (
    select 1 from public.exercise_logs el
    where el.id = set_logs.exercise_log_id and el.player_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.exercise_logs el
    where el.id = set_logs.exercise_log_id and el.player_id = (select auth.uid())
  ));

create policy setlog_coach_select on public.set_logs
  for select to authenticated
  using (
    public.auth_role() = 'coach' and exists (
      select 1 from public.exercise_logs el
      where el.id = set_logs.exercise_log_id and public.is_my_player(el.player_id)
    )
  );

create policy setlog_admin_all on public.set_logs
  for all to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Keep the parent exercise_logs summary columns in sync with set_logs.
-- actual_sets  = number of set rows
-- actual_reps  = "10, 8, 6" (comma-joined)
-- actual_weight = "60kg, 65kg, 70kg" (comma-joined)
-- This lets the existing analysis / trend UI keep working unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.resync_exercise_log_summary(p_log_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_reps text;
  v_weight text;
begin
  select
    count(*),
    nullif(string_agg(coalesce(reps, ''), ', ' order by set_number), ''),
    nullif(string_agg(coalesce(weight, ''), ', ' order by set_number), '')
  into v_count, v_reps, v_weight
  from public.set_logs
  where exercise_log_id = p_log_id;

  update public.exercise_logs
    set actual_sets   = case when v_count = 0 then null else v_count end,
        actual_reps   = v_reps,
        actual_weight = v_weight
    where id = p_log_id;
end;
$$;

create or replace function public.set_logs_touch_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.resync_exercise_log_summary(coalesce(new.exercise_log_id, old.exercise_log_id));
  return null;
end;
$$;

create trigger trg_set_logs_touch_parent
  after insert or update or delete on public.set_logs
  for each row execute procedure public.set_logs_touch_parent();

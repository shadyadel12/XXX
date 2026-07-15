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

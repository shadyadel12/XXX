-- 0009: per-coach signup keys (admin-issued, single-use) + pre-check RPCs so
-- signup validates the key/code BEFORE creating an auth account (no orphans).

-- ---------------------------------------------------------------------------
-- coach_keys: single-use codes an admin issues; a person signs up with one and
-- becomes a coach. claimed_by is stamped when used.
-- ---------------------------------------------------------------------------
create table if not exists public.coach_keys (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  status     link_status not null default 'active',  -- active | revoked (expired unused)
  claimed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.coach_keys enable row level security;

-- Admin can see/manage all coach keys; nobody else reads this table directly.
create policy coachkeys_admin_all on public.coach_keys
  for all to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

-- ---------------------------------------------------------------------------
-- PRE-CHECK RPCs (SECURITY DEFINER, callable by anon) — validate a key exists
-- and is usable, WITHOUT creating anything. Signup calls these before signUp().
-- They intentionally reveal only a boolean-ish result, not row data.
-- ---------------------------------------------------------------------------

-- Returns true if the coach key is valid & unclaimed.
create or replace function public.check_coach_key(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coach_keys
    where key = trim(p_key) and status = 'active' and claimed_by is null
  );
$$;
grant execute on function public.check_coach_key(text) to anon, authenticated;

-- Returns true if the subscription key is valid & unclaimed (for player signup).
create or replace function public.check_subscription_key(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coach_player_links
    where subscription_key = trim(p_key)
      and status <> 'revoked'
      and player_id is null
  );
$$;
grant execute on function public.check_subscription_key(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Replace signup_as_coach: now consumes a single-use coach key (not a shared
-- invite code). Called right after the account is created.
-- ---------------------------------------------------------------------------
create or replace function public.claim_coach_key(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.coach_keys;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from public.coach_keys
    where key = trim(p_key) for update;

  if not found then
    raise exception 'Invalid coach key';
  end if;
  if v_row.status = 'revoked' then
    raise exception 'This coach key has been revoked';
  end if;
  if v_row.claimed_by is not null then
    if v_row.claimed_by = v_uid then
      -- already this user; ensure role is coach and return
      update public.profiles set role = 'coach' where id = v_uid;
      return;
    end if;
    raise exception 'This coach key is already in use';
  end if;

  update public.coach_keys set claimed_by = v_uid where id = v_row.id;
  update public.profiles set role = 'coach' where id = v_uid;
end;
$$;
grant execute on function public.claim_coach_key(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin issues / revokes coach keys.
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_coach_key(p_key text)
returns public.coach_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.coach_keys;
begin
  if public.auth_role() <> 'admin' then
    raise exception 'Admin only';
  end if;
  insert into public.coach_keys (key) values (trim(p_key)) returning * into v_row;
  return v_row;
end;
$$;
grant execute on function public.admin_create_coach_key(text) to authenticated;

create or replace function public.admin_revoke_coach_key(p_key_id uuid)
returns public.coach_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.coach_keys;
begin
  if public.auth_role() <> 'admin' then
    raise exception 'Admin only';
  end if;
  update public.coach_keys set status = 'revoked' where id = p_key_id returning * into v_row;
  if not found then raise exception 'Coach key not found'; end if;
  return v_row;
end;
$$;
grant execute on function public.admin_revoke_coach_key(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Cleanup: the old shared invite-code flow is replaced by per-coach keys.
-- ---------------------------------------------------------------------------
drop function if exists public.signup_as_coach(text);
delete from public.app_config where key = 'coach_invite_code';

-- 0008: self-serve signup (players via keys, coaches via invite code) and
-- admin-issued keys — all without a service-role key, using SECURITY DEFINER
-- RPCs that self-authorize the caller.

-- ---------------------------------------------------------------------------
-- Config table for server-held secrets (e.g. the coach invite code).
-- Not readable by clients (RLS default-deny, no policies) — only the
-- SECURITY DEFINER functions below can read it.
-- ---------------------------------------------------------------------------
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);
alter table public.app_config enable row level security;
-- (no policies => no client can read/write; definer functions bypass RLS)

-- Set your coach invite code here (change 'COACH-INVITE-2026' to your secret).
insert into public.app_config (key, value)
values ('coach_invite_code', 'COACH-INVITE-2026')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Keys can be issued before the player exists: player_id nullable.
-- ---------------------------------------------------------------------------
alter table public.coach_player_links
  alter column player_id drop not null;

-- ---------------------------------------------------------------------------
-- Coach signup: promote the caller to 'coach' if they present the invite code.
-- Called right after the user signs up (still default role 'player').
-- ---------------------------------------------------------------------------
create or replace function public.signup_as_coach(p_invite_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select value into v_code from public.app_config where key = 'coach_invite_code';
  if v_code is null or trim(p_invite_code) <> v_code then
    raise exception 'Invalid coach invite code';
  end if;

  update public.profiles set role = 'coach' where id = v_uid;
end;
$$;
grant execute on function public.signup_as_coach(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Player claims a pre-issued subscription key (stamps their id onto the row).
-- Expiry is NOT enforced here — an expired key still links (player sees the
-- renewal screen). Revoked/used/unknown keys are rejected.
-- ---------------------------------------------------------------------------
create or replace function public.claim_subscription_key(p_key text)
returns public.coach_player_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.coach_player_links;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from public.coach_player_links
    where subscription_key = trim(p_key)
    for update;

  if not found then
    raise exception 'Invalid subscription key';
  end if;
  if v_row.status = 'revoked' then
    raise exception 'This subscription key has been revoked';
  end if;
  if v_row.player_id is not null then
    if v_row.player_id = v_uid then
      return v_row;
    end if;
    raise exception 'This subscription key is already in use';
  end if;

  update public.coach_player_links
    set player_id = v_uid
    where id = v_row.id
    returning * into v_row;
  return v_row;
end;
$$;
grant execute on function public.claim_subscription_key(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin issues a new (unclaimed) key linked to a coach, with expiry.
-- Caller must be an admin.
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_key(
  p_coach_id uuid,
  p_key text,
  p_end_date date
)
returns public.coach_player_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.coach_player_links;
begin
  if public.auth_role() <> 'admin' then
    raise exception 'Admin only';
  end if;
  if not exists (select 1 from public.profiles where id = p_coach_id and role = 'coach') then
    raise exception 'coach_id is not a coach';
  end if;

  insert into public.coach_player_links (coach_id, player_id, subscription_key, subscription_end_date, status)
    values (p_coach_id, null, trim(p_key), p_end_date, 'active')
    returning * into v_row;
  return v_row;
end;
$$;
grant execute on function public.admin_create_key(uuid, text, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin renews / revokes a key.
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_key(
  p_key_id uuid,
  p_end_date date,
  p_status link_status
)
returns public.coach_player_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.coach_player_links;
begin
  if public.auth_role() <> 'admin' then
    raise exception 'Admin only';
  end if;
  update public.coach_player_links
    set subscription_end_date = coalesce(p_end_date, subscription_end_date),
        status = coalesce(p_status, status)
    where id = p_key_id
    returning * into v_row;
  if not found then
    raise exception 'Key not found';
  end if;
  return v_row;
end;
$$;
grant execute on function public.admin_update_key(uuid, date, link_status) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin + coach need to list coaches / all keys. Add read policies.
-- ---------------------------------------------------------------------------
-- Admin can already read everything (cpl_admin_all, profiles_admin_all).
-- Coaches listing for the admin key form: covered by profiles_admin_all.

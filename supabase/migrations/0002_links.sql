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

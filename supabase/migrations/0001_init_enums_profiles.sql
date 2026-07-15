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

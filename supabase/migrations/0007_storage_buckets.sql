-- 0007: private 'videos' bucket + storage RLS.
-- Object path convention: videos/{player_id}/<filename>
-- A player reads/writes only their own prefix; the linked coach can read it.

insert into storage.buckets (id, name, public)
values ('videos', 'videos', false)
on conflict (id) do nothing;

-- Helper: the player_id encoded as the first folder of an object path.
-- storage.foldername(name) returns the path segments as a text[].

create policy videos_player_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy videos_player_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy videos_player_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy videos_player_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Linked coach can read a player's videos.
create policy videos_coach_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'videos'
    and public.auth_role() = 'coach'
    and public.is_my_player(((storage.foldername(name))[1])::uuid)
  );

-- Coach can also upload a coaching video into a linked player's folder.
create policy videos_coach_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'videos'
    and public.auth_role() = 'coach'
    and public.is_my_player(((storage.foldername(name))[1])::uuid)
  );

create policy videos_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'videos' and public.auth_role() = 'admin')
  with check (bucket_id = 'videos' and public.auth_role() = 'admin');

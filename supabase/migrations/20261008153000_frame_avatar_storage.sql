-- Dedicated public profile avatars; uploads remain restricted to each authenticated user's folder.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('frame-avatars','frame-avatars',true,2097152,ARRAY['image/png','image/jpeg','image/webp','image/gif']::text[])
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "frame_avatars_insert_own" on storage.objects;
drop policy if exists "frame_avatars_update_own" on storage.objects;
drop policy if exists "frame_avatars_delete_own" on storage.objects;

create policy "frame_avatars_insert_own" on storage.objects
for insert to authenticated
with check (bucket_id='frame-avatars' and (storage.foldername(name))[1]=(select auth.uid()::text));

create policy "frame_avatars_update_own" on storage.objects
for update to authenticated
using (bucket_id='frame-avatars' and (storage.foldername(name))[1]=(select auth.uid()::text))
with check (bucket_id='frame-avatars' and (storage.foldername(name))[1]=(select auth.uid()::text));

create policy "frame_avatars_delete_own" on storage.objects
for delete to authenticated
using (bucket_id='frame-avatars' and (storage.foldername(name))[1]=(select auth.uid()::text));
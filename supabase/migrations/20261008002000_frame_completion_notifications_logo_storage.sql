-- FRAME completion pass: notifications and custom logo storage
create table if not exists public.frame_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'system',
  title text not null,
  body text not null default '',
  href text,
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists frame_notifications_user_dedupe_idx on public.frame_notifications(user_id,dedupe_key);
create index if not exists frame_notifications_user_created_idx on public.frame_notifications(user_id,created_at desc);
alter table public.frame_notifications enable row level security;
drop policy if exists "frame_notifications_select_own" on public.frame_notifications;
create policy "frame_notifications_select_own" on public.frame_notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "frame_notifications_insert_own" on public.frame_notifications;
create policy "frame_notifications_insert_own" on public.frame_notifications for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "frame_notifications_update_own" on public.frame_notifications;
create policy "frame_notifications_update_own" on public.frame_notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "frame_notifications_delete_own" on public.frame_notifications;
create policy "frame_notifications_delete_own" on public.frame_notifications for delete to authenticated using (user_id = auth.uid());
grant select,insert,update,delete on public.frame_notifications to authenticated;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('frame-logos','frame-logos',true,2097152,ARRAY['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "frame_logos_insert_own" on storage.objects;
create policy "frame_logos_insert_own" on storage.objects for insert to authenticated with check (bucket_id='frame-logos' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists "frame_logos_update_own" on storage.objects;
create policy "frame_logos_update_own" on storage.objects for update to authenticated using (bucket_id='frame-logos' and (storage.foldername(name))[1]=(select auth.uid()::text)) with check (bucket_id='frame-logos' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists "frame_logos_delete_own" on storage.objects;
create policy "frame_logos_delete_own" on storage.objects for delete to authenticated using (bucket_id='frame-logos' and (storage.foldername(name))[1]=(select auth.uid()::text));
alter table public.profiles drop constraint if exists profiles_frame_logo_check;
alter table public.profiles add constraint profiles_frame_logo_check check (frame_logo in ('ultra-instinct','classic-f','minimal-ring') or frame_logo like 'https://%');

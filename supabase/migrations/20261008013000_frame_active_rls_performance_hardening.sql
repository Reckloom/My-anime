drop policy if exists media_items_read_friends on public.media_items;
drop policy if exists "Users can read own media" on public.media_items;
create policy media_items_read_access on public.media_items
for select to authenticated
using (
  user_id=(select auth.uid())
  or exists (
    select 1 from public.library_permissions lp
    where lp.owner_id=media_items.user_id
      and lp.viewer_id=(select auth.uid())
      and lp.status='accepted'
  )
);

drop policy if exists prefs_own_select on public.user_preferences;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert to authenticated with check (id=(select auth.uid()));

drop policy if exists connected_apps_own on public.connected_apps;
create policy connected_apps_own on public.connected_apps
for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

drop policy if exists frame_notifications_select_own on public.frame_notifications;
create policy frame_notifications_select_own on public.frame_notifications for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists frame_notifications_insert_own on public.frame_notifications;
create policy frame_notifications_insert_own on public.frame_notifications for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists frame_notifications_update_own on public.frame_notifications;
create policy frame_notifications_update_own on public.frame_notifications for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists frame_notifications_delete_own on public.frame_notifications;
create policy frame_notifications_delete_own on public.frame_notifications for delete to authenticated using (user_id=(select auth.uid()));

drop policy if exists messages_participant_select on public.friend_messages;
create policy messages_participant_select on public.friend_messages for select to authenticated using (sender_id=(select auth.uid()) or recipient_id=(select auth.uid()));
drop policy if exists messages_sender_delete on public.friend_messages;
create policy messages_sender_delete on public.friend_messages for delete to authenticated using (sender_id=(select auth.uid()));
drop policy if exists messages_sender_insert on public.friend_messages;
create policy messages_sender_insert on public.friend_messages for insert to authenticated with check (sender_id=(select auth.uid()));

drop policy if exists friendships_participant_select on public.friendships;
create policy friendships_participant_select on public.friendships for select to authenticated using (requester_id=(select auth.uid()) or addressee_id=(select auth.uid()));
drop policy if exists friendships_participant_update on public.friendships;
create policy friendships_participant_update on public.friendships for update to authenticated using (requester_id=(select auth.uid()) or addressee_id=(select auth.uid())) with check (requester_id=(select auth.uid()) or addressee_id=(select auth.uid()));
drop policy if exists friendships_participant_delete on public.friendships;
create policy friendships_participant_delete on public.friendships for delete to authenticated using (requester_id=(select auth.uid()) or addressee_id=(select auth.uid()));
drop policy if exists friendships_request on public.friendships;
create policy friendships_request on public.friendships for insert to authenticated with check (requester_id=(select auth.uid()));

drop policy if exists library_permissions_participant_select on public.library_permissions;
create policy library_permissions_participant_select on public.library_permissions for select to authenticated using (owner_id=(select auth.uid()) or viewer_id=(select auth.uid()));
drop policy if exists library_permissions_participant_update on public.library_permissions;
create policy library_permissions_participant_update on public.library_permissions for update to authenticated using (owner_id=(select auth.uid()) or viewer_id=(select auth.uid())) with check (owner_id=(select auth.uid()) or viewer_id=(select auth.uid()));
drop policy if exists library_permissions_viewer_insert on public.library_permissions;
create policy library_permissions_viewer_insert on public.library_permissions for insert to authenticated with check (viewer_id=(select auth.uid()));

drop policy if exists call_rooms_public_read on public.call_rooms;
create policy call_rooms_public_read on public.call_rooms for select to authenticated
using (((active=true) and visibility='public') or host_id=(select auth.uid()) or exists(select 1 from public.call_participants cp where cp.room_id=call_rooms.id and cp.user_id=(select auth.uid())));
drop policy if exists call_rooms_host_insert on public.call_rooms;
create policy call_rooms_host_insert on public.call_rooms for insert to authenticated with check (host_id=(select auth.uid()));
drop policy if exists call_rooms_host_update on public.call_rooms;
create policy call_rooms_host_update on public.call_rooms for update to authenticated using (host_id=(select auth.uid())) with check (host_id=(select auth.uid()));
drop policy if exists call_rooms_host_delete on public.call_rooms;
create policy call_rooms_host_delete on public.call_rooms for delete to authenticated using (host_id=(select auth.uid()));

drop policy if exists call_participants_self_insert on public.call_participants;
create policy call_participants_self_insert on public.call_participants for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists call_participants_self_delete on public.call_participants;
create policy call_participants_self_delete on public.call_participants for delete to authenticated using (user_id=(select auth.uid()));

create index if not exists call_participants_user_idx on public.call_participants(user_id);
create index if not exists call_rooms_host_idx on public.call_rooms(host_id);
create index if not exists friend_messages_sender_idx on public.friend_messages(sender_id);
create index if not exists friend_messages_recipient_idx on public.friend_messages(recipient_id);
create index if not exists friendships_addressee_idx on public.friendships(addressee_id);
create index if not exists library_permissions_viewer_idx on public.library_permissions(viewer_id);
create index if not exists global_messages_user_idx on public.global_messages(user_id);

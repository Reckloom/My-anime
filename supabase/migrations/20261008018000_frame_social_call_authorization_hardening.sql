drop policy if exists friendships_participant_update on public.friendships;
drop policy if exists friendships_addressee_update on public.friendships;
create policy friendships_addressee_update on public.friendships
for update to authenticated
using (addressee_id=(select auth.uid()))
with check (addressee_id=(select auth.uid()));

create unique index if not exists friendships_unique_normalized_pair
on public.friendships (least(requester_id,addressee_id),greatest(requester_id,addressee_id));

drop policy if exists library_permissions_participant_update on public.library_permissions;
drop policy if exists library_permissions_owner_update on public.library_permissions;
create policy library_permissions_owner_update on public.library_permissions
for update to authenticated
using (owner_id=(select auth.uid()))
with check (owner_id=(select auth.uid()));

drop policy if exists call_rooms_public_read on public.call_rooms;
create policy call_rooms_public_read on public.call_rooms
for select to authenticated
using (
  ((active=true) and visibility='public')
  or host_id=(select auth.uid())
  or exists(
    select 1 from public.call_participants cp
    where cp.room_id=call_rooms.id
      and cp.user_id=(select auth.uid())
      and cp.status='approved'
  )
);

drop policy if exists call_participants_host_update on public.call_participants;
create policy call_participants_host_update on public.call_participants
for update to authenticated
using (
  exists(select 1 from public.call_rooms cr where cr.id=call_participants.room_id and cr.host_id=(select auth.uid()))
)
with check (
  exists(select 1 from public.call_rooms cr where cr.id=call_participants.room_id and cr.host_id=(select auth.uid()))
);

create or replace function private.frame_call_host(p_room_id uuid,p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select exists(select 1 from public.call_rooms where id=p_room_id and host_id=p_user_id);
$$;

create or replace function private.frame_call_room_readable(p_room_id uuid,p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select exists(
    select 1
    from public.call_rooms cr
    where cr.id=p_room_id
      and (
        (cr.active=true and cr.visibility='public')
        or cr.host_id=p_user_id
        or exists(
          select 1 from public.call_participants cp
          where cp.room_id=cr.id and cp.user_id=p_user_id and cp.status='approved'
        )
      )
  );
$$;

create or replace function private.frame_call_participant_readable(p_room_id uuid,p_participant_user_id uuid,p_viewer_id uuid)
returns boolean
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select p_participant_user_id=p_viewer_id
    or private.frame_call_host(p_room_id,p_viewer_id)
    or exists(
      select 1 from public.call_participants cp
      where cp.room_id=p_room_id and cp.user_id=p_viewer_id and cp.status='approved'
    );
$$;

revoke all on function private.frame_call_host(uuid,uuid) from public,anon,authenticated;
revoke all on function private.frame_call_room_readable(uuid,uuid) from public,anon,authenticated;
revoke all on function private.frame_call_participant_readable(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.frame_call_host(uuid,uuid) to authenticated;
grant execute on function private.frame_call_room_readable(uuid,uuid) to authenticated;
grant execute on function private.frame_call_participant_readable(uuid,uuid,uuid) to authenticated;

drop policy if exists call_rooms_public_read on public.call_rooms;
create policy call_rooms_public_read on public.call_rooms
for select to authenticated
using (private.frame_call_room_readable(id,(select auth.uid())));

drop policy if exists call_participants_visible on public.call_participants;
create policy call_participants_visible on public.call_participants
for select to authenticated
using (private.frame_call_participant_readable(room_id,user_id,(select auth.uid())));

drop policy if exists call_participants_host_update on public.call_participants;
create policy call_participants_host_update on public.call_participants
for update to authenticated
using (private.frame_call_host(room_id,(select auth.uid())))
with check (private.frame_call_host(room_id,(select auth.uid())));

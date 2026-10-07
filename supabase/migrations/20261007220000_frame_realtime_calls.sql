create table if not exists public.direct_call_sessions (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references public.profiles(id) on delete cascade,
  callee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'ringing' check (status in ('ringing','connected','ended','declined','missed')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists idx_direct_call_sessions_caller on public.direct_call_sessions(caller_id, created_at desc);
create index if not exists idx_direct_call_sessions_callee on public.direct_call_sessions(callee_id, created_at desc);

alter table public.direct_call_sessions enable row level security;

grant select, insert, update on public.direct_call_sessions to authenticated;
grant select, insert, delete on public.friend_messages to authenticated;
grant select, insert, delete on public.global_messages to authenticated;

drop policy if exists direct_call_sessions_select_participant on public.direct_call_sessions;
drop policy if exists direct_call_sessions_insert_caller on public.direct_call_sessions;
drop policy if exists direct_call_sessions_update_participant on public.direct_call_sessions;

create policy direct_call_sessions_select_participant on public.direct_call_sessions
for select to authenticated
using ((select auth.uid()) in (caller_id, callee_id));

create policy direct_call_sessions_insert_caller on public.direct_call_sessions
for insert to authenticated
with check (
  caller_id=(select auth.uid())
  and exists (
    select 1 from public.friendships f
    where f.status='accepted'
      and ((f.requester_id=(select auth.uid()) and f.addressee_id=callee_id)
        or (f.addressee_id=(select auth.uid()) and f.requester_id=callee_id))
  )
);

create policy direct_call_sessions_update_participant on public.direct_call_sessions
for update to authenticated
using ((select auth.uid()) in (caller_id, callee_id))
with check ((select auth.uid()) in (caller_id, callee_id));

do $$
begin
  begin
    alter publication supabase_realtime add table public.friend_messages;
  exception when duplicate_object then
    null;
  end;
end $$;

drop policy if exists frame_realtime_receive_authenticated on realtime.messages;
drop policy if exists frame_realtime_send_authenticated on realtime.messages;

create policy frame_realtime_receive_authenticated on realtime.messages
for select to authenticated
using (
  realtime.messages.extension='broadcast'
  and (
    realtime.topic()='frame-global-chat'
    or (
      realtime.topic() like 'frame-direct-inbox:%'
      and substring(realtime.topic() from 20)=(select auth.uid())::text
    )
    or (
      realtime.topic() like 'frame-direct-call:%'
      and substring(realtime.topic() from 19) ~ '^[0-9a-fA-F-]{36}$'
      and exists (
        select 1 from public.direct_call_sessions s
        where s.id=substring(realtime.topic() from 19)::uuid
          and (select auth.uid()) in (s.caller_id,s.callee_id)
      )
    )
    or (
      realtime.topic() like 'frame-call:%'
      and substring(realtime.topic() from 12) ~ '^[0-9a-fA-F-]{36}$'
      and exists (
        select 1 from public.call_participants cp
        where cp.room_id=substring(realtime.topic() from 12)::uuid
          and cp.user_id=(select auth.uid())
          and cp.status='approved'
      )
    )
  )
);

create policy frame_realtime_send_authenticated on realtime.messages
for insert to authenticated
with check (
  realtime.messages.extension='broadcast'
  and (
    realtime.topic()='frame-global-chat'
    or (
      realtime.topic() like 'frame-direct-inbox:%'
      and substring(realtime.topic() from 20) ~ '^[0-9a-fA-F-]{36}$'
      and exists (
        select 1 from public.friendships f
        where f.status='accepted'
          and (
            (f.requester_id=(select auth.uid()) and f.addressee_id=substring(realtime.topic() from 20)::uuid)
            or
            (f.addressee_id=(select auth.uid()) and f.requester_id=substring(realtime.topic() from 20)::uuid)
          )
      )
    )
    or (
      realtime.topic() like 'frame-direct-call:%'
      and substring(realtime.topic() from 19) ~ '^[0-9a-fA-F-]{36}$'
      and exists (
        select 1 from public.direct_call_sessions s
        where s.id=substring(realtime.topic() from 19)::uuid
          and (select auth.uid()) in (s.caller_id,s.callee_id)
      )
    )
    or (
      realtime.topic() like 'frame-call:%'
      and substring(realtime.topic() from 12) ~ '^[0-9a-fA-F-]{36}$'
      and exists (
        select 1 from public.call_participants cp
        where cp.room_id=substring(realtime.topic() from 12)::uuid
          and cp.user_id=(select auth.uid())
          and cp.status='approved'
      )
    )
  )
);

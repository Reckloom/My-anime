create schema if not exists private;

create or replace function private.create_frame_call(
  p_title text default 'FRAME Voice Room',
  p_visibility text default 'public',
  p_password_hash text default null,
  p_approval_required boolean default true,
  p_max_participants integer default 6
)
returns public.call_rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.call_rooms%rowtype;
  v_code text;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if p_visibility not in ('public','private') then raise exception 'Invalid call visibility.'; end if;
  if p_max_participants < 2 or p_max_participants > 8 then raise exception 'Call rooms support 2 to 8 participants.'; end if;
  if p_visibility='private' and nullif(trim(coalesce(p_password_hash,'')),'') is null then raise exception 'Private rooms require a password.'; end if;
  for i in 1..20 loop
    v_code := upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
    begin
      insert into public.call_rooms(room_code,host_id,title,visibility,password_hash,approval_required,max_participants,active)
      values(v_code,v_uid,left(coalesce(nullif(trim(p_title),''),'FRAME Voice Room'),120),p_visibility,p_password_hash,p_approval_required,p_max_participants,true)
      returning * into v_room;
      exit;
    exception when unique_violation then
      if i=20 then raise exception 'Could not generate a unique call code. Try again.'; end if;
    end;
  end loop;
  insert into public.call_participants(room_id,user_id,status,is_muted) values(v_room.id,v_uid,'approved',false);
  return v_room;
end;
$$;

create or replace function private.join_frame_call(p_room_code text,p_password_hash text default null)
returns table(id uuid,room_code text,host_id uuid,title text,visibility text,approval_required boolean,max_participants integer,active boolean,created_at timestamptz,participant_status text)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_uid uuid:=auth.uid(); r public.call_rooms%rowtype; s text;
begin
 if v_uid is null then return; end if;
 select * into r from public.call_rooms where call_rooms.room_code=upper(trim(p_room_code)) and call_rooms.active=true limit 1;
 if not found then return; end if;
 if r.visibility='private' and (p_password_hash is null or r.password_hash is distinct from p_password_hash) then return; end if;
 if r.max_participants <= (select count(*) from public.call_participants cp where cp.room_id=r.id and cp.status='approved')
    and not exists(select 1 from public.call_participants cp where cp.room_id=r.id and cp.user_id=v_uid and cp.status='approved') then return; end if;
 s:=case when r.host_id=v_uid or not r.approval_required then 'approved' else 'requested' end;
 insert into public.call_participants(room_id,user_id,status,updated_at) values(r.id,v_uid,s,now())
 on conflict(room_id,user_id) do update set status=excluded.status,updated_at=now();
 return query select r.id,r.room_code,r.host_id,r.title,r.visibility,r.approval_required,r.max_participants,r.active,r.created_at,s;
end;
$$;

create or replace function public.create_frame_call(p_title text default 'FRAME Voice Room',p_visibility text default 'public',p_password_hash text default null,p_approval_required boolean default true,p_max_participants integer default 6)
returns public.call_rooms language sql security invoker set search_path=public,pg_temp as $$
 select private.create_frame_call(p_title,p_visibility,p_password_hash,p_approval_required,p_max_participants);
$$;

create or replace function public.join_frame_call(p_room_code text,p_password_hash text default null)
returns table(id uuid,room_code text,host_id uuid,title text,visibility text,approval_required boolean,max_participants integer,active boolean,created_at timestamptz,participant_status text)
language sql security invoker set search_path=public,pg_temp as $$
 select * from private.join_frame_call(p_room_code,p_password_hash);
$$;

grant usage on schema private to authenticated;
grant execute on function private.create_frame_call(text,text,text,boolean,integer) to authenticated;
grant execute on function private.join_frame_call(text,text) to authenticated;
revoke all on function private.create_frame_call(text,text,text,boolean,integer) from anon,public;
revoke all on function private.join_frame_call(text,text) from anon,public;
revoke all on function public.create_frame_call(text,text,text,boolean,integer) from anon;
revoke all on function public.join_frame_call(text,text) from anon;
grant execute on function public.create_frame_call(text,text,text,boolean,integer) to authenticated;
grant execute on function public.join_frame_call(text,text) to authenticated;

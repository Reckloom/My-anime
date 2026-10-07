create or replace function public.create_frame_call(
  p_title text default 'FRAME Voice Room',
  p_visibility text default 'public',
  p_password_hash text default null,
  p_approval_required boolean default true,
  p_max_participants integer default 6
)
returns public.call_rooms
language plpgsql
security definer
set search_path=public,pg_temp
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

revoke all on function public.create_frame_call(text,text,text,boolean,integer) from public,anon;
grant execute on function public.create_frame_call(text,text,text,boolean,integer) to authenticated;
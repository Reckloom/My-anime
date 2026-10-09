-- Keep One Piece episodes in a single, chronological, non-overlapping arc sequence.
-- Arc IDs encode the first episode in that segment (one-piece-arc-1156 => episode 1156).
create or replace function public.frame_one_piece_assign_episode_arc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  episode_no integer;
  matching_arc text;
begin
  if new.id !~ '^one-piece-episode-[0-9]+$' then
    return new;
  end if;

  episode_no := substring(new.id from '^one-piece-episode-([0-9]+)$')::integer;
  select a.id into matching_arc
  from public.media_items a
  where a.user_id = new.user_id
    and a.id ~ '^one-piece-arc-[0-9]+$'
    and substring(a.id from '^one-piece-arc-([0-9]+)$')::integer <= episode_no
  order by substring(a.id from '^one-piece-arc-([0-9]+)$')::integer desc
  limit 1;

  if matching_arc is not null then
    new.parent_id := matching_arc;
  end if;
  return new;
end;
$$;

create or replace function public.frame_one_piece_reconcile_arc_episodes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  arc_start integer;
begin
  if new.id !~ '^one-piece-arc-[0-9]+$' then
    return new;
  end if;

  arc_start := substring(new.id from '^one-piece-arc-([0-9]+)$')::integer;
  update public.media_items e
  set parent_id = (
    select a.id
    from public.media_items a
    where a.user_id = e.user_id
      and a.id ~ '^one-piece-arc-[0-9]+$'
      and substring(a.id from '^one-piece-arc-([0-9]+)$')::integer
          <= substring(e.id from '^one-piece-episode-([0-9]+)$')::integer
    order by substring(a.id from '^one-piece-arc-([0-9]+)$')::integer desc
    limit 1
  ), updated_at = now()
  where e.user_id = new.user_id
    and e.id ~ '^one-piece-episode-[0-9]+$'
    and substring(e.id from '^one-piece-episode-([0-9]+)$')::integer >= arc_start
    and e.parent_id is distinct from (
      select a.id
      from public.media_items a
      where a.user_id = e.user_id
        and a.id ~ '^one-piece-arc-[0-9]+$'
        and substring(a.id from '^one-piece-arc-([0-9]+)$')::integer
            <= substring(e.id from '^one-piece-episode-([0-9]+)$')::integer
      order by substring(a.id from '^one-piece-arc-([0-9]+)$')::integer desc
      limit 1
    );
  return new;
end;
$$;

create or replace function public.frame_one_piece_recount_episode_parents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
  old_parent text;
  new_parent text;
  target_parent text;
  root_id text;
  episode_total integer;
  episode_completed integer;
begin
  if tg_op = 'DELETE' then
    if old.id !~ '^one-piece-episode-[0-9]+$' then return old; end if;
    target_user := old.user_id;
    old_parent := old.parent_id;
    new_parent := null;
  else
    if new.id !~ '^one-piece-episode-[0-9]+$' then return new; end if;
    target_user := new.user_id;
    old_parent := case when tg_op = 'UPDATE' then old.parent_id else null end;
    new_parent := new.parent_id;
  end if;

  for target_parent in
    select distinct p
    from unnest(array[old_parent, new_parent]) as parent_values(p)
    where p is not null and p ~ '^one-piece-arc-[0-9]+$'
  loop
    select count(*)::integer,
           count(*) filter (where status = 'completed')::integer
      into episode_total, episode_completed
    from public.media_items
    where user_id = target_user
      and parent_id = target_parent
      and id ~ '^one-piece-episode-[0-9]+$';

    update public.media_items
    set total = episode_total,
        progress = episode_completed,
        status = case when episode_total > 0 and episode_completed = episode_total
                      then 'completed' else 'watching' end,
        data = jsonb_set(coalesce(data, '{}'::jsonb), '{customTotal}', to_jsonb(episode_total), true),
        description = title || ' · Episodes ' ||
          coalesce((select min(substring(id from '^one-piece-episode-([0-9]+)$')::integer)::text
                    from public.media_items where user_id=target_user and parent_id=target_parent
                      and id ~ '^one-piece-episode-[0-9]+$'), '—')
          || '–' ||
          coalesce((select max(substring(id from '^one-piece-episode-([0-9]+)$')::integer)::text
                    from public.media_items where user_id=target_user and parent_id=target_parent
                      and id ~ '^one-piece-episode-[0-9]+$'), '—'),
        updated_at = now()
    where user_id = target_user and id = target_parent;

    select parent_id into root_id
    from public.media_items
    where user_id = target_user and id = target_parent;

    if root_id is not null then
      select count(*)::integer,
             count(*) filter (where e.status = 'completed')::integer
        into episode_total, episode_completed
      from public.media_items e
      where e.user_id = target_user
        and e.id ~ '^one-piece-episode-[0-9]+$'
        and e.parent_id in (
          select a.id from public.media_items a
          where a.user_id = target_user and a.parent_id = root_id
            and a.id ~ '^one-piece-arc-[0-9]+$'
        );

      update public.media_items
      set total = episode_total,
          progress = episode_completed,
          status = case when episode_total > 0 and episode_completed = episode_total
                        then 'completed' else 'watching' end,
          data = jsonb_set(coalesce(data, '{}'::jsonb), '{customTotal}', to_jsonb(episode_total), true),
          updated_at = now()
      where user_id = target_user and id = root_id;
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists frame_one_piece_assign_episode_arc on public.media_items;
create trigger frame_one_piece_assign_episode_arc
before insert or update on public.media_items
for each row execute function public.frame_one_piece_assign_episode_arc();

drop trigger if exists frame_one_piece_reconcile_arc_episodes on public.media_items;
create trigger frame_one_piece_reconcile_arc_episodes
after insert or update on public.media_items
for each row execute function public.frame_one_piece_reconcile_arc_episodes();

drop trigger if exists frame_one_piece_recount_episode_parents on public.media_items;
create trigger frame_one_piece_recount_episode_parents
after insert or update or delete on public.media_items
for each row execute function public.frame_one_piece_recount_episode_parents();

-- Repair any old mis-grouped episode rows according to the latest preceding arc boundary.
update public.media_items e
set parent_id = (
  select a.id
  from public.media_items a
  where a.user_id = e.user_id
    and a.id ~ '^one-piece-arc-[0-9]+$'
    and substring(a.id from '^one-piece-arc-([0-9]+)$')::integer
        <= substring(e.id from '^one-piece-episode-([0-9]+)$')::integer
  order by substring(a.id from '^one-piece-arc-([0-9]+)$')::integer desc
  limit 1
), updated_at = now()
where e.id ~ '^one-piece-episode-[0-9]+$'
  and e.parent_id is distinct from (
    select a.id
    from public.media_items a
    where a.user_id = e.user_id
      and a.id ~ '^one-piece-arc-[0-9]+$'
      and substring(a.id from '^one-piece-arc-([0-9]+)$')::integer
          <= substring(e.id from '^one-piece-episode-([0-9]+)$')::integer
    order by substring(a.id from '^one-piece-arc-([0-9]+)$')::integer desc
    limit 1
  );

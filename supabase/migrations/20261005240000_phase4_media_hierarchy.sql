-- FRAME Phase 4: robust per-user media hierarchy integrity.
-- Self-referencing parent_id supports unlimited depth. Triggers reject self-links,
-- cross-user parents, and cycles before a row is written.

create index if not exists media_items_parent_id_idx on public.media_items(parent_id);

create or replace function public.validate_media_parent()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  cursor_id uuid;
  hops integer := 0;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A media item cannot be its own parent';
  end if;

  if not exists (
    select 1 from public.media_items
    where id = new.parent_id and user_id = new.user_id
  ) then
    raise exception 'Parent media item must belong to the same user';
  end if;

  cursor_id := new.parent_id;
  while cursor_id is not null loop
    hops := hops + 1;
    if hops > 2000 then
      raise exception 'Media hierarchy is too deep';
    end if;
    if cursor_id = new.id then
      raise exception 'Media hierarchy cycle detected';
    end if;

    select parent_id into cursor_id
    from public.media_items
    where id = cursor_id and user_id = new.user_id;
  end loop;

  return new;
end;
$$;

drop trigger if exists media_items_validate_parent on public.media_items;
create trigger media_items_validate_parent
before insert or update of parent_id, user_id on public.media_items
for each row execute function public.validate_media_parent();

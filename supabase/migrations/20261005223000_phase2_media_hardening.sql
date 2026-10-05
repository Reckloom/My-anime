-- FRAME Phase 2: harden the cloud media foundation used by the library UI.
-- Safe to apply after the Phase 1 migration.

alter table public.media_items
  drop constraint if exists media_items_progress_check,
  add constraint media_items_progress_check check (progress between 0 and 2000);

alter table public.media_items
  drop constraint if exists media_items_total_check,
  add constraint media_items_total_check check (total is null or total >= 0);

alter table public.media_items
  drop constraint if exists media_items_score_check,
  add constraint media_items_score_check check (score is null or (score between 0 and 10));

create or replace function public.validate_media_parent()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.parent_id is not null then
    if not exists (
      select 1 from public.media_items
      where id = new.parent_id and user_id = new.user_id
    ) then
      raise exception 'Parent media item must belong to the same user';
    end if;
    if new.parent_id = new.id then
      raise exception 'A media item cannot be its own parent';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists media_items_validate_parent on public.media_items;
create trigger media_items_validate_parent
  before insert or update of parent_id, user_id on public.media_items
  for each row execute procedure public.validate_media_parent();

-- Keep ownership immutable through normal client updates.
create or replace function public.prevent_media_owner_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'Media ownership cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists media_items_prevent_owner_change on public.media_items;
create trigger media_items_prevent_owner_change
  before update of user_id on public.media_items
  for each row execute procedure public.prevent_media_owner_change();

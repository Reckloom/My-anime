-- FRAME Phase 8: statistics, activity history, collections and tags.
-- All personalization data is scoped to the authenticated owner.

create table if not exists public.media_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  event_type text not null check (event_type in ('added','progress','status','completed')),
  old_progress integer,
  new_progress integer,
  old_status text,
  new_status text,
  created_at timestamptz not null default now()
);

create index if not exists media_activity_user_created_idx on public.media_activity(user_id, created_at desc);
create index if not exists media_activity_media_created_idx on public.media_activity(media_item_id, created_at desc);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

create index if not exists collections_user_idx on public.collections(user_id);

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key(collection_id, media_item_id)
);

create index if not exists collection_items_media_idx on public.collection_items(media_item_id);
create index if not exists collection_items_collection_position_idx on public.collection_items(collection_id, position);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 50),
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

create index if not exists tags_user_idx on public.tags(user_id);

create table if not exists public.media_tags (
  tag_id uuid not null references public.tags(id) on delete cascade,
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(tag_id, media_item_id)
);

create index if not exists media_tags_media_idx on public.media_tags(media_item_id);

alter table public.media_activity enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.tags enable row level security;
alter table public.media_tags enable row level security;

drop policy if exists "Users can read their media activity" on public.media_activity;
create policy "Users can read their media activity" on public.media_activity for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their media activity" on public.media_activity;
create policy "Users can create their media activity" on public.media_activity for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their collections" on public.collections;
create policy "Users can read their collections" on public.collections for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their collections" on public.collections;
create policy "Users can create their collections" on public.collections for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their collections" on public.collections;
create policy "Users can update their collections" on public.collections for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their collections" on public.collections;
create policy "Users can delete their collections" on public.collections for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their collection items" on public.collection_items;
create policy "Users can read their collection items" on public.collection_items for select to authenticated
using (exists (select 1 from public.collections c where c.id=collection_id and c.user_id=(select auth.uid())));
drop policy if exists "Users can add to their collections" on public.collection_items;
create policy "Users can add to their collections" on public.collection_items for insert to authenticated
with check (
  exists (select 1 from public.collections c where c.id=collection_id and c.user_id=(select auth.uid()))
  and exists (select 1 from public.media_items m where m.id=media_item_id and m.user_id=(select auth.uid()))
);
drop policy if exists "Users can update their collection items" on public.collection_items;
create policy "Users can update their collection items" on public.collection_items for update to authenticated
using (exists (select 1 from public.collections c where c.id=collection_id and c.user_id=(select auth.uid())))
with check (
  exists (select 1 from public.collections c where c.id=collection_id and c.user_id=(select auth.uid()))
  and exists (select 1 from public.media_items m where m.id=media_item_id and m.user_id=(select auth.uid()))
);
drop policy if exists "Users can remove from their collections" on public.collection_items;
create policy "Users can remove from their collections" on public.collection_items for delete to authenticated
using (exists (select 1 from public.collections c where c.id=collection_id and c.user_id=(select auth.uid())));

drop policy if exists "Users can read their tags" on public.tags;
create policy "Users can read their tags" on public.tags for select to authenticated
using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their tags" on public.tags;
create policy "Users can create their tags" on public.tags for insert to authenticated
with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their tags" on public.tags;
create policy "Users can update their tags" on public.tags for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their tags" on public.tags;
create policy "Users can delete their tags" on public.tags for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their media tags" on public.media_tags;
create policy "Users can read their media tags" on public.media_tags for select to authenticated
using (exists (select 1 from public.tags t where t.id=tag_id and t.user_id=(select auth.uid())));
drop policy if exists "Users can add their media tags" on public.media_tags;
create policy "Users can add their media tags" on public.media_tags for insert to authenticated
with check (
  exists (select 1 from public.tags t where t.id=tag_id and t.user_id=(select auth.uid()))
  and exists (select 1 from public.media_items m where m.id=media_item_id and m.user_id=(select auth.uid()))
);
drop policy if exists "Users can remove their media tags" on public.media_tags;
create policy "Users can remove their media tags" on public.media_tags for delete to authenticated
using (exists (select 1 from public.tags t where t.id=tag_id and t.user_id=(select auth.uid())));

grant select, insert on public.media_activity to authenticated;
grant select, insert, update, delete on public.collections to authenticated;
grant select, insert, update, delete on public.collection_items to authenticated;
grant select, insert, update, delete on public.tags to authenticated;
grant select, insert, delete on public.media_tags to authenticated;

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at before update on public.collections for each row execute function public.set_updated_at();

create or replace function public.record_media_activity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  event_kind text;
begin
  if tg_op = 'INSERT' then
    insert into public.media_activity(user_id, media_item_id, event_type, new_progress, new_status)
    values (new.user_id, new.id, 'added', new.progress, new.status);
    return new;
  end if;

  if old.progress is distinct from new.progress and old.status is distinct from new.status then
    event_kind := case when new.status='completed' and old.status is distinct from new.status then 'completed' else 'progress' end;
  elsif old.status is distinct from new.status then
    event_kind := case when new.status='completed' then 'completed' else 'status' end;
  elsif old.progress is distinct from new.progress then
    event_kind := 'progress';
  else
    return new;
  end if;

  insert into public.media_activity(user_id, media_item_id, event_type, old_progress, new_progress, old_status, new_status)
  values (new.user_id, new.id, event_kind, old.progress, new.progress, old.status, new.status);
  return new;
end;
$$;

drop trigger if exists media_items_record_activity on public.media_items;
create trigger media_items_record_activity
after insert or update of progress, status on public.media_items
for each row execute function public.record_media_activity();

revoke all on function public.record_media_activity() from public, anon, authenticated;

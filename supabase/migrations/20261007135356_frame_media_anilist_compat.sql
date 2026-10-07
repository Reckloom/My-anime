-- FRAME compatibility migration for the existing media_items table.
-- Keeps existing data while adding the columns required by the AniList-backed importer.

create table if not exists public.media_metadata (
  id uuid primary key default gen_random_uuid(),
  anilist_id bigint not null unique,
  title text not null,
  alternative_titles text[] not null default '{}',
  description text not null default '',
  poster text not null default '',
  backdrop text not null default '',
  genres text[] not null default '{}',
  themes text[] not null default '{}',
  year integer,
  season text,
  score numeric(3,1),
  studio text,
  source text,
  episodes integer,
  duration integer,
  air_start text,
  air_end text,
  updated_at timestamptz not null default now()
);

alter table public.media_items
  add column if not exists parent_id text,
  add column if not exists metadata_id uuid,
  add column if not exists anilist_id bigint,
  add column if not exists description text not null default '',
  add column if not exists poster text not null default '',
  add column if not exists backdrop text not null default '',
  add column if not exists medium text not null default 'anime',
  add column if not exists status text not null default 'planned',
  add column if not exists progress integer not null default 0,
  add column if not exists total integer,
  add column if not exists year integer,
  add column if not exists score numeric(3,1),
  add column if not exists genres text[] not null default '{}',
  add column if not exists themes text[] not null default '{}',
  add column if not exists studio text,
  add column if not exists source text,
  add column if not exists favorite boolean not null default false,
  add column if not exists notes text,
  add column if not exists next_release text,
  add column if not exists next_release_number integer;

alter table public.media_items
  alter column id set default (gen_random_uuid()::text);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'media_items_metadata_id_fkey'
  ) then
    alter table public.media_items
      add constraint media_items_metadata_id_fkey
      foreign key (metadata_id) references public.media_metadata(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'media_items_medium_check'
  ) then
    alter table public.media_items
      add constraint media_items_medium_check
      check (medium in ('anime','manga','manhwa','light-novel','visual-novel','movie','series','game'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'media_items_status_check'
  ) then
    alter table public.media_items
      add constraint media_items_status_check
      check (status in ('watching','completed','planned','paused','dropped'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'media_items_progress_check'
  ) then
    alter table public.media_items
      add constraint media_items_progress_check
      check (progress between 0 and 2000);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'media_items_total_check'
  ) then
    alter table public.media_items
      add constraint media_items_total_check
      check (total is null or total between 0 and 2000);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'media_items_score_check'
  ) then
    alter table public.media_items
      add constraint media_items_score_check
      check (score is null or score between 0 and 10);
  end if;
end $$;

create index if not exists media_items_metadata_id_idx on public.media_items(metadata_id);

create unique index if not exists media_items_user_anilist_unique
  on public.media_items(user_id, anilist_id)
  where anilist_id is not null;

alter table public.media_metadata enable row level security;

drop policy if exists "AniList metadata is readable by authenticated users" on public.media_metadata;
create policy "AniList metadata is readable by authenticated users"
  on public.media_metadata
  for select
  to authenticated
  using (true);

grant select on public.media_metadata to authenticated;

-- FRAME Phase 3: AniList-backed global metadata separated from user-owned library state.

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

alter table public.media_items add column if not exists metadata_id uuid references public.media_metadata(id) on delete set null;
alter table public.media_items add column if not exists anilist_id bigint;

create unique index if not exists media_items_user_anilist_unique
  on public.media_items(user_id, anilist_id)
  where anilist_id is not null;
create index if not exists media_items_metadata_id_idx on public.media_items(metadata_id);

alter table public.media_metadata enable row level security;
drop policy if exists "AniList metadata is readable by authenticated users" on public.media_metadata;
create policy "AniList metadata is readable by authenticated users"
  on public.media_metadata for select to authenticated using (true);
grant select on public.media_metadata to authenticated;

-- Metadata is intentionally not writable through the public Data API.
-- The anilist-import Edge Function performs authenticated imports/refreshes
-- with its server-side privileged client, while user progress/status/favorites
-- remain protected by the existing media_items RLS policies.

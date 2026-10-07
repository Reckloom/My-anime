-- FRAME runtime reconciliation.
-- Keeps current installations aligned with the universal media model.
-- All operations are idempotent and preserve legacy rows.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.media_releases (
  id uuid primary key default gen_random_uuid(),
  media_metadata_id uuid not null references public.media_metadata(id) on delete cascade,
  anilist_id bigint not null,
  release_type text not null default 'episode' check (release_type in ('episode','season','part','special','unknown')),
  release_number numeric(8,2),
  title text,
  scheduled_at timestamptz,
  date_precision text not null default 'unknown' check (date_precision in ('exact','day','month','year','unknown')),
  status text not null default 'scheduled' check (status in ('scheduled','released','cancelled','rescheduled','unknown')),
  source text not null default 'anilist',
  source_key text not null,
  raw jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(source, source_key)
);
create index if not exists media_releases_scheduled_idx on public.media_releases(status, scheduled_at);
create index if not exists media_releases_metadata_idx on public.media_releases(media_metadata_id);
create index if not exists media_releases_anilist_idx on public.media_releases(anilist_id);
alter table public.media_releases enable row level security;
drop policy if exists media_releases_authenticated_read on public.media_releases;
create policy media_releases_authenticated_read on public.media_releases for select to authenticated using (true);
revoke all on public.media_releases from anon, public;
grant select on public.media_releases to authenticated;

create or replace function public.validate_frame_release_tracker_key(p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
declare expected text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role' then
    return false;
  end if;
  select decrypted_secret into expected from vault.decrypted_secrets where name='frame_release_tracker_secret' limit 1;
  return expected is not null and p_key = expected;
end;
$$;
revoke all on function public.validate_frame_release_tracker_key(text) from public, anon, authenticated;
grant execute on function public.validate_frame_release_tracker_key(text) to service_role;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name='frame_supabase_url') then
    perform vault.create_secret('https://blwnhfhpckqbetwxamqr.supabase.co','frame_supabase_url','FRAME public Supabase URL');
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name='frame_publishable_key') then
    perform vault.create_secret('sb_publishable_g3pzBUEsZtPQ1sGJjrDxHw_ldR3dO49','frame_publishable_key','FRAME publishable API key');
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name='frame_release_tracker_secret') then
    perform vault.create_secret(encode(gen_random_bytes(32),'hex'),'frame_release_tracker_secret','FRAME release tracker secret');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from cron.job where jobname='frame-release-tracker') then
    perform cron.schedule(
      'frame-release-tracker',
      '*/30 * * * *',
      $job$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name='frame_supabase_url' limit 1) || '/functions/v1/release-tracker',
          headers := jsonb_build_object(
            'Content-Type','application/json',
            'apikey',(select decrypted_secret from vault.decrypted_secrets where name='frame_publishable_key' limit 1),
            'x-frame-cron-key',(select decrypted_secret from vault.decrypted_secrets where name='frame_release_tracker_secret' limit 1)
          ),
          body := jsonb_build_object('source','cron')
        );
      $job$
    );
  end if;
end $$;

-- Preserve the older FRAME library by copying it into the current universal model.
insert into public.media_items (
  id,user_id,parent_id,metadata_id,anilist_id,title,data,description,poster,backdrop,medium,status,progress,total,year,score,genres,themes,studio,source,favorite,notes
)
select
  a.id::text,a.user_id,null,null,null,a.title,
  jsonb_build_object(
    'provider',null,'externalId',null,
    'personalRating',case when a.rating is null or a.rating=0 then null else greatest(0,least(10,a.rating::numeric)) end,
    'progressUnit',case lower(coalesce(a.media_type,'Anime'))
      when 'movie' then 'watch state' when 'anime' then 'episodes' when 'series' then 'episodes'
      when 'manga' then 'chapters' when 'manhwa' then 'chapters' when 'light novel' then 'chapters'
      when 'visual novel' then '%' when 'books' then 'pages' else 'episodes' end,
    'legacySource','public.anime'
  ),
  coalesce(a.description,''),coalesce(a.cover_url,''),'',
  case lower(coalesce(a.media_type,'Anime'))
    when 'movie' then 'movie' when 'series' then 'series' when 'light novel' then 'light-novel'
    when 'visual novel' then 'visual-novel' when 'manga' then 'manga' when 'manhwa' then 'manhwa'
    when 'books' then 'book' else 'anime' end,
  case lower(a.status)
    when 'watching' then 'watching' when 'reading' then 'reading' when 'playing' then 'playing'
    when 'completed' then 'completed' when 'paused' then 'paused' when 'dropped' then 'dropped'
    else 'planned' end,
  greatest(0,least(2000,case
    when lower(coalesce(a.media_type,'Anime')) in ('manga','manhwa','light novel','books')
      then coalesce(a.current_chapter,a.current_volume,a.current_episode,0)
    else coalesce(a.current_episode,a.current_chapter,a.current_volume,0) end)),
  case
    when lower(coalesce(a.media_type,'Anime'))='movie' then 1
    when lower(coalesce(a.media_type,'Anime')) in ('manga','manhwa','light novel','books') then nullif(coalesce(a.total_chapters,a.total_volumes,a.total_episodes),0)
    else nullif(coalesce(a.total_episodes,a.total_chapters,a.total_volumes),0) end,
  a.year,null,coalesce(a.genres,'{}'),coalesce(a.tags,'{}'),null,'Legacy FRAME',coalesce(a.favorite,false),nullif(a.notes,'')
from public.anime a
where not exists (select 1 from public.media_items mi where mi.id=a.id::text);

insert into public.media_items (
  id,user_id,parent_id,metadata_id,anilist_id,title,data,description,poster,backdrop,medium,status,progress,total,year,score,genres,themes,studio,source,favorite,notes
)
select
  p.id::text,a.user_id,p.anime_id::text,null,null,p.name,
  jsonb_build_object(
    'provider',null,'externalId',null,
    'personalRating',case when p.rating is null or p.rating=0 then null else greatest(0,least(10,p.rating::numeric)) end,
    'progressUnit',case lower(coalesce(p.media_type,a.media_type,'Anime'))
      when 'movie' then 'watch state' when 'anime' then 'episodes' when 'series' then 'episodes'
      when 'manga' then 'chapters' when 'manhwa' then 'chapters' when 'light novel' then 'chapters'
      when 'visual novel' then '%' when 'books' then 'pages' else 'episodes' end,
    'legacySource','public.parts'
  ),
  coalesce(p.description,''),coalesce(p.cover_url,p.image_url,''),'',
  case lower(coalesce(p.media_type,a.media_type,'Anime'))
    when 'movie' then 'movie' when 'series' then 'series' when 'light novel' then 'light-novel'
    when 'visual novel' then 'visual-novel' when 'manga' then 'manga' when 'manhwa' then 'manhwa'
    when 'books' then 'book' else 'anime' end,
  case lower(p.status)
    when 'watching' then 'watching' when 'completed' then 'completed' when 'paused' then 'paused'
    when 'dropped' then 'dropped' else 'planned' end,
  greatest(0,least(2000,coalesce(p.current_episode,p.current_chapter,p.current_volume,0))),
  case when lower(coalesce(p.media_type,a.media_type,'Anime'))='movie' then 1
       else nullif(coalesce(p.total_episodes,p.total_chapters,p.total_volumes),0) end,
  p.year,null,coalesce(p.genres,'{}'),coalesce(p.tags,'{}'),null,'Legacy FRAME',coalesce(p.favorite,false),nullif(p.notes,'')
from public.parts p
join public.anime a on a.id=p.anime_id
where not exists (select 1 from public.media_items mi where mi.id=p.id::text);

create index if not exists media_items_parent_user_idx on public.media_items(user_id,parent_id);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('frame-media-art','frame-media-art',true,5242880,array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists frame_media_art_insert_own on storage.objects;
create policy frame_media_art_insert_own on storage.objects for insert to authenticated
with check (bucket_id='frame-media-art' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists frame_media_art_update_own on storage.objects;
create policy frame_media_art_update_own on storage.objects for update to authenticated
using (bucket_id='frame-media-art' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='frame-media-art' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists frame_media_art_delete_own on storage.objects;
create policy frame_media_art_delete_own on storage.objects for delete to authenticated
using (bucket_id='frame-media-art' and (storage.foldername(name))[1]=auth.uid()::text);

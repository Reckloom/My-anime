-- FRAME Phase 5: automatic release tracking.
-- Global release facts are shared metadata; user watch state remains on media_items.

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

drop policy if exists "Release data is readable by authenticated users" on public.media_releases;
create policy "Release data is readable by authenticated users"
  on public.media_releases for select to authenticated using (true);

grant select on public.media_releases to authenticated;

-- Keep release ingestion server-side. No INSERT/UPDATE/DELETE policies are exposed.

-- Scheduling is intentionally represented as a database function + cron job.
-- The URL and credentials are read from Supabase Vault at runtime, never stored
-- in frontend code. Configure these secrets after migration:
--   project_url = https://<project-ref>.supabase.co
--   publishable_key = <Supabase publishable key>
--   release_tracker_cron_secret = <random secret used by the Edge Function>
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.invoke_release_tracker()
returns bigint
language plpgsql
security invoker
set search_path = public, extensions, vault
as $$
declare
  request_id bigint;
  project_url text;
  publishable_key text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into publishable_key from vault.decrypted_secrets where name = 'publishable_key' limit 1;
  -- The tracker secret authenticates the scheduled worker itself; it is never sent to browsers.
  if project_url is null or publishable_key is null or (select decrypted_secret from vault.decrypted_secrets where name = 'release_tracker_cron_secret' limit 1) is null then
    raise exception 'Release tracker Vault secrets are not configured';
  end if;

  select net.http_post(
    url := project_url || '/functions/v1/release-tracker',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey',publishable_key,
      'x-release-tracker-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'release_tracker_cron_secret' limit 1)
    ),
    body := jsonb_build_object('source','cron')
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_release_tracker() from public, anon, authenticated;
grant execute on function public.invoke_release_tracker() to postgres;

-- Every 30 minutes keeps the radar fresh without making AniList requests excessive.
select cron.schedule(
  'frame-release-tracker',
  '*/30 * * * *',
  $$select public.invoke_release_tracker()$$
)
where not exists (select 1 from cron.job where jobname = 'frame-release-tracker');

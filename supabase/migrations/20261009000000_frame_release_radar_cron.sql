-- FRAME background release radar
-- The live project uses Vault + pg_cron + pg_net to run the checker every 30 minutes.
-- Required Vault secrets:
--   frame_project_url
--   frame_publishable_key
--   frame_release_radar_cron_secret
-- The cron secret is generated automatically by this migration on first install.
-- Project URL and publishable key are environment-specific and must be stored in Vault.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name='frame_release_radar_cron_secret') then
    perform vault.create_secret(
      encode(gen_random_bytes(32),'hex'),
      'frame_release_radar_cron_secret',
      'Private token used only by the scheduled FRAME release radar job.'
    );
  end if;
end $$;

create unique index if not exists frame_notifications_user_dedupe_uidx
  on public.frame_notifications(user_id,dedupe_key);

create or replace function public.frame_get_release_radar_cron_secret()
returns text
language plpgsql
security definer
set search_path=public,auth,vault,pg_catalog
as $$
declare v text;
begin
  if auth.uid() is not null then
    raise exception 'Not allowed';
  end if;
  select decrypted_secret into v
  from vault.decrypted_secrets
  where name='frame_release_radar_cron_secret'
  limit 1;
  if v is null then raise exception 'Radar cron secret missing'; end if;
  return v;
end
$$;

revoke all on function public.frame_get_release_radar_cron_secret() from public,anon,authenticated;
grant execute on function public.frame_get_release_radar_cron_secret() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname='frame-release-radar') then
    perform cron.unschedule(jobid) from cron.job where jobname='frame-release-radar';
  end if;

  if exists (
    select 1 from vault.decrypted_secrets
    where name='frame_project_url'
  ) and exists (
    select 1 from vault.decrypted_secrets
    where name='frame_publishable_key'
  ) and exists (
    select 1 from vault.decrypted_secrets
    where name='frame_release_radar_cron_secret'
  ) then
    perform cron.schedule(
      'frame-release-radar',
      '*/30 * * * *',
      $job$
        select net.http_post(
          url:=(select decrypted_secret from vault.decrypted_secrets where name='frame_project_url') || '/functions/v1/release-radar-cron',
          headers:=jsonb_build_object(
            'Content-Type','application/json',
            'apikey',(select decrypted_secret from vault.decrypted_secrets where name='frame_publishable_key'),
            'x-frame-cron',(select decrypted_secret from vault.decrypted_secrets where name='frame_release_radar_cron_secret')
          ),
          body:=jsonb_build_object('source','supabase-cron','scheduled_at',now()),
          timeout_milliseconds:=20000
        ) as request_id;
      $job$
    );
  end if;
end $$;

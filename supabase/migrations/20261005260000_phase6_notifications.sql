-- FRAME Phase 6: notifications and user preferences.
-- Notifications are per-user and are generated from the existing media_releases data.

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  episode_releases boolean not null default true,
  new_seasons boolean not null default true,
  new_parts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  release_id uuid not null references public.media_releases(id) on delete cascade,
  kind text not null check (kind in ('episode','season','part','special','unknown')),
  title text not null,
  body text not null,
  media_title text,
  release_number numeric(8,2),
  scheduled_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, release_id)
);

create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, read_at) where read_at is null;

alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Users can read their notification preferences" on public.notification_preferences;
create policy "Users can read their notification preferences" on public.notification_preferences for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their notification preferences" on public.notification_preferences;
create policy "Users can create their notification preferences" on public.notification_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their notification preferences" on public.notification_preferences;
create policy "Users can update their notification preferences" on public.notification_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their notifications" on public.notifications;
create policy "Users can read their notifications" on public.notifications for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can update their notifications" on public.notifications;
create policy "Users can update their notifications" on public.notifications for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update on public.notification_preferences to authenticated;
grant select, update on public.notifications to authenticated;

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at before update on public.notification_preferences for each row execute function public.set_updated_at();

-- Server-side helper: materialize a release into notifications only for users
-- who currently have the corresponding metadata in their private library.
create or replace function public.create_release_notifications(p_release_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.media_releases%rowtype;
  inserted_count integer := 0;
begin
  select * into r from public.media_releases where id = p_release_id;
  if not found or r.status <> 'released' then return 0; end if;

  insert into public.notifications(user_id, release_id, kind, title, body, media_title, release_number, scheduled_at)
  select
    mi.user_id,
    r.id,
    r.release_type,
    case when r.release_type = 'episode' then 'New episode released' else 'New release available' end,
    coalesce(r.title, 'A new release is available for ' || coalesce(mm.title, 'your library.')),
    mm.title,
    r.release_number,
    r.scheduled_at
  from public.media_items mi
  join public.media_metadata mm on mm.id = mi.metadata_id
  left join public.notification_preferences np on np.user_id = mi.user_id
  where mi.metadata_id = r.media_metadata_id
    and coalesce(np.episode_releases, true) = (r.release_type = 'episode')
    and (r.release_type <> 'episode' or coalesce(np.episode_releases, true))
    and r.release_type <> 'season'
    and r.release_type <> 'part'
  on conflict (user_id, release_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

-- Separate preference-aware helper for all supported release kinds.
create or replace function public.create_release_notifications(p_release_id uuid, p_kind text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.media_releases%rowtype;
  inserted_count integer := 0;
begin
  select * into r from public.media_releases where id = p_release_id;
  if not found or r.status <> 'released' then return 0; end if;

  insert into public.notifications(user_id, release_id, kind, title, body, media_title, release_number, scheduled_at)
  select mi.user_id, r.id, r.release_type,
    case when r.release_type='episode' then 'New episode released'
         when r.release_type='season' then 'New season available'
         when r.release_type='part' then 'New part available'
         else 'New release available' end,
    coalesce(r.title, 'A new release is available for ' || coalesce(mm.title, 'your library.')),
    mm.title, r.release_number, r.scheduled_at
  from public.media_items mi
  join public.media_metadata mm on mm.id=mi.metadata_id
  left join public.notification_preferences np on np.user_id=mi.user_id
  where mi.metadata_id=r.media_metadata_id
    and case r.release_type
      when 'episode' then coalesce(np.episode_releases,true)
      when 'season' then coalesce(np.new_seasons,true)
      when 'part' then coalesce(np.new_parts,true)
      else coalesce(np.episode_releases,true)
    end
  on conflict (user_id, release_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.create_release_notifications(uuid) from public, anon, authenticated;
revoke all on function public.create_release_notifications(uuid,text) from public, anon, authenticated;
grant execute on function public.create_release_notifications(uuid) to service_role;
grant execute on function public.create_release_notifications(uuid,text) to service_role;

-- Default preferences are created lazily by the frontend and may be added
-- by future account provisioning. No notification rows are writable by browsers.

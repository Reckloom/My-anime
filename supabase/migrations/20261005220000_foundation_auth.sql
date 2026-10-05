-- FRAME Phase 1: authentication and private media foundation.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.media_items(id) on delete set null,
  title text not null,
  description text not null default '',
  poster text not null default '',
  backdrop text not null default '',
  medium text not null check (medium in ('anime','manga','manhwa','light-novel','visual-novel','movie','series')),
  status text not null check (status in ('watching','completed','planned','paused','dropped')),
  progress integer not null default 0 check (progress >= 0),
  total integer check (total is null or total >= 0),
  year integer,
  score numeric(3,1) check (score is null or (score >= 0 and score <= 10)),
  genres text[] not null default '{}',
  themes text[] not null default '{}',
  studio text,
  source text,
  favorite boolean not null default false,
  notes text,
  next_release timestamptz,
  next_release_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_items_user_id_idx on public.media_items(user_id);
create index if not exists media_items_parent_id_idx on public.media_items(parent_id);

alter table public.profiles enable row level security;
alter table public.media_items enable row level security;

drop policy if exists "Profiles are readable by their owner" on public.profiles;
create policy "Profiles are readable by their owner" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Profiles are insertable by their owner" on public.profiles;
create policy "Profiles are insertable by their owner" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "Profiles are updatable by their owner" on public.profiles;
create policy "Profiles are updatable by their owner" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Media is readable by its owner" on public.media_items;
create policy "Media is readable by its owner" on public.media_items for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Media is insertable by its owner" on public.media_items;
create policy "Media is insertable by its owner" on public.media_items for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Media is updatable by its owner" on public.media_items;
create policy "Media is updatable by its owner" on public.media_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Media is deletable by its owner" on public.media_items;
create policy "Media is deletable by its owner" on public.media_items for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists media_items_set_updated_at on public.media_items;
create trigger media_items_set_updated_at before update on public.media_items for each row execute procedure public.set_updated_at();

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.media_items to authenticated;

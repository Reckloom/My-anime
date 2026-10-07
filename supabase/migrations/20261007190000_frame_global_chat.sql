create table if not exists public.global_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists global_messages_created_at_idx on public.global_messages (created_at desc);
alter table public.global_messages enable row level security;
drop policy if exists "global_messages_read_authenticated" on public.global_messages;
drop policy if exists "global_messages_insert_own" on public.global_messages;
drop policy if exists "global_messages_delete_own" on public.global_messages;
create policy "global_messages_read_authenticated" on public.global_messages for select to authenticated using (true);
create policy "global_messages_insert_own" on public.global_messages for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "global_messages_delete_own" on public.global_messages for delete to authenticated using ((select auth.uid()) = user_id);
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='global_messages'
  ) then
    alter publication supabase_realtime add table public.global_messages;
  end if;
end $$;

-- FRAME Phase 10: production hardening.
-- The application schema remains user-scoped and read-only where appropriate.

-- Activity history is trigger-owned. Clients must not be able to forge history rows.
drop policy if exists "Users can create their media activity" on public.media_activity;
revoke insert on public.media_activity from authenticated;
grant select on public.media_activity to authenticated;

-- Organization names are case-insensitively unique per user.
create unique index if not exists collections_user_lower_name_unique
  on public.collections(user_id, lower(name));
create unique index if not exists tags_user_lower_name_unique
  on public.tags(user_id, lower(name));

-- Harden known legacy project functions when they exist.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
  if to_regprocedure('public.set_release_metadata_updated_at()') is not null then
    alter function public.set_release_metadata_updated_at() set search_path = public;
  end if;
end $$;

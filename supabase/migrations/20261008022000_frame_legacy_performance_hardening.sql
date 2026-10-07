-- Peak-pass performance hardening for legacy FRAME tables.
-- The legacy tables remain supported, but their RLS policies should use
-- init-plan friendly auth.uid() calls and their foreign keys need indexes.

alter policy "Users can add their own anime" on public.anime
  with check (user_id = (select auth.uid()));
alter policy "Users can delete their own anime" on public.anime
  using (user_id = (select auth.uid()));
alter policy "Users can edit their own anime" on public.anime
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
alter policy "Users can view their own anime" on public.anime
  using (user_id = (select auth.uid()));

alter policy "Users can delete their notifications" on public.anime_notifications
  using ((select auth.uid()) = user_id);
alter policy "Users can read their notifications" on public.anime_notifications
  using ((select auth.uid()) = user_id);
alter policy "Users can update their notifications" on public.anime_notifications
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can delete their release tracking" on public.anime_release_tracking
  using ((select auth.uid()) = user_id);
alter policy "Users can insert their release tracking" on public.anime_release_tracking
  with check ((select auth.uid()) = user_id);
alter policy "Users can read their release tracking" on public.anime_release_tracking
  using ((select auth.uid()) = user_id);
alter policy "Users can update their release tracking" on public.anime_release_tracking
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can create their own media relationships" on public.media_relationships
  with check (
    exists (select 1 from public.anime source_media
      where source_media.id=media_relationships.source_media_id
        and source_media.user_id=(select auth.uid()))
    and exists (select 1 from public.anime target_media
      where target_media.id=media_relationships.target_media_id
        and target_media.user_id=(select auth.uid()))
  );
alter policy "Users can delete their own media relationships" on public.media_relationships
  using (
    exists (select 1 from public.anime source_media
      where source_media.id=media_relationships.source_media_id
        and source_media.user_id=(select auth.uid()))
    and exists (select 1 from public.anime target_media
      where target_media.id=media_relationships.target_media_id
        and target_media.user_id=(select auth.uid()))
  );
alter policy "Users can edit their own media relationships" on public.media_relationships
  using (
    exists (select 1 from public.anime source_media
      where source_media.id=media_relationships.source_media_id
        and source_media.user_id=(select auth.uid()))
    and exists (select 1 from public.anime target_media
      where target_media.id=media_relationships.target_media_id
        and target_media.user_id=(select auth.uid()))
  )
  with check (
    exists (select 1 from public.anime source_media
      where source_media.id=media_relationships.source_media_id
        and source_media.user_id=(select auth.uid()))
    and exists (select 1 from public.anime target_media
      where target_media.id=media_relationships.target_media_id
        and target_media.user_id=(select auth.uid()))
  );
alter policy "Users can view their own media relationships" on public.media_relationships
  using (
    exists (select 1 from public.anime source_media
      where source_media.id=media_relationships.source_media_id
        and source_media.user_id=(select auth.uid()))
    and exists (select 1 from public.anime target_media
      where target_media.id=media_relationships.target_media_id
        and target_media.user_id=(select auth.uid()))
  );

alter policy "Users can add parts to their anime" on public.parts
  with check (exists (select 1 from public.anime where anime.id=parts.anime_id and anime.user_id=(select auth.uid())));
alter policy "Users can delete parts of their anime" on public.parts
  using (exists (select 1 from public.anime where anime.id=parts.anime_id and anime.user_id=(select auth.uid())));
alter policy "Users can edit parts of their anime" on public.parts
  using (exists (select 1 from public.anime where anime.id=parts.anime_id and anime.user_id=(select auth.uid())))
  with check (exists (select 1 from public.anime where anime.id=parts.anime_id and anime.user_id=(select auth.uid())));
alter policy "Users can view parts of their anime" on public.parts
  using (exists (select 1 from public.anime where anime.id=parts.anime_id and anime.user_id=(select auth.uid())));

create index if not exists anime_user_id_idx on public.anime(user_id);
create index if not exists anime_notifications_library_entry_id_idx on public.anime_notifications(library_entry_id);
create index if not exists anime_notifications_part_id_idx on public.anime_notifications(part_id);
create index if not exists anime_notifications_release_event_id_idx on public.anime_notifications(release_event_id);
create index if not exists anime_notifications_tracking_id_idx on public.anime_notifications(tracking_id);
create index if not exists anime_release_tracking_library_entry_id_idx on public.anime_release_tracking(library_entry_id);
create index if not exists anime_release_tracking_part_id_idx on public.anime_release_tracking(part_id);
create index if not exists media_relationships_source_media_id_idx on public.media_relationships(source_media_id);
create index if not exists media_relationships_target_media_id_idx on public.media_relationships(target_media_id);
create index if not exists parts_anime_id_idx on public.parts(anime_id);

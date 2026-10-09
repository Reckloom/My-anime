-- AniList-linked media can be release-tracked before a shared metadata row exists.
-- Release records still carry the AniList ID and source key, so this link is optional.
alter table public.media_releases
  alter column media_metadata_id drop not null;

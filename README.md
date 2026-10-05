# FRAME — My Anime

A personal cloud-backed media library for anime, manga, manhwa, light novels, visual novels, movies and series.

## Phase 1 + Phase 2

FRAME retains its existing React + TypeScript + Vite cinematic UI and Supabase authentication foundation. Phase 2 turns the library into a real per-user cloud library.

### Phase 2 features

- Loads the authenticated user's media from Supabase.
- Add media directly from the website.
- Edit and delete media.
- Statuses: Watching, Completed, Plan to Watch, Paused, Dropped.
- Progress from 0–2000.
- Optional episode/chapter total.
- Favorites and private notes.
- Anime, Manga, Manhwa, Light Novel, Visual Novel, Movie and Series types.
- Search across titles, descriptions, genres and themes.
- Status and media-type filters.
- Sorting by recent, title, progress and rating.
- Loading, empty, error and success states.
- Immediate cloud saves for edits, additions, favorites and deletes.
- Supabase RLS keeps every user's rows private.

## Supabase setup

Apply the migrations in order:

1. `supabase/migrations/20261005220000_foundation_auth.sql`
2. `supabase/migrations/20261005223000_phase2_media_hardening.sql`

The Phase 2 migration adds the 0–2000 progress constraint, validates parent ownership, prevents self-parenting, and prevents client-side ownership changes.

Create a local `.env` from `.env.example`:

`VITE_SUPABASE_URL=`
`VITE_SUPABASE_PUBLISHABLE_KEY=`

Use only the Supabase publishable client key in the Vite frontend. Never expose a `service_role` or Supabase secret key.

## Development without Supabase

If Supabase environment variables are empty, the existing local-storage development mode remains available so the FRAME UI can still be worked on. This is not the cloud-backed production mode.

When Supabase is configured, FRAME loads only the signed-in user's rows and all library mutations go through Supabase with RLS.

## Verification

Run:

`npm run build`

The repository's GitHub Actions workflow also builds the project on pushes to `main`.

## Phase boundaries

AniList automation, release notifications, AI features and Android packaging are intentionally not part of Phase 2.

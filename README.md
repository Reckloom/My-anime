# FRAME — My Anime

A personal media library for anime, manga, manhwa, light novels, visual novels, movies and series.

## Phase 1 — Foundation + Authentication

The existing cinematic React + TypeScript + Vite UI is retained. Phase 1 adds persistent Supabase sessions, email/password sign-up and login, logout support, password-reset/recovery flow, protected application access when Supabase is configured, private profiles/media database foundations, Row Level Security, environment documentation, and a versioned migration.

## Supabase setup

1. Open your Supabase project.
2. Apply `supabase/migrations/20261005220000_foundation_auth.sql` through your normal Supabase migration/deployment workflow.
3. Copy the project URL and **publishable** client key from Supabase project settings.
4. Create a local `.env` from `.env.example` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. In Supabase Auth URL configuration, allow your local Vite origin (normally `http://localhost:5173`) and your eventual deployed FRAME URL.
6. Configure email confirmation to your preferred policy.

Never expose a `service_role` or Supabase secret key in frontend code, Vite variables, GitHub Actions, or the deployed app.

## Development without Supabase

If the two Vite variables are empty, FRAME remains usable with its existing local-storage library for UI development. This is intentionally not a substitute for authentication. Once the variables are configured, application access is protected by Supabase authentication.

## Verification

Run `npm run build`. GitHub Actions runs the same build on pushes to main.

## Phase boundaries

AniList import, release notifications, AI, Android packaging, and cloud media synchronization are intentionally outside Phase 1.

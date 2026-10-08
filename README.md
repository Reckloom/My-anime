# FRAME — Universal Media Library

FRAME is a private, cloud-backed personal media platform for tracking anime, manga, manhwa, light novels, visual novels, movies, series, games and books.

## What is included

- Account-gated Supabase Auth with email/password, password recovery and identity linking.
- Per-user cloud library with RLS, local recovery and exact cloud synchronization.
- Manual media entry plus AniList discovery/import and metadata refresh.
- Progress and totals up to 2,000 with media-aware units.
- Parent/child hierarchy for seasons, parts, specials and related entries.
- Child-aware status filtering, search, sorting, favorites, notes and detail views.
- Artwork uploads with user-scoped storage cleanup.
- Release Radar, scheduled release tracking and deduplicated in-app notifications.
- Friends, friend messaging, global chat and library sharing.
- Direct one-to-one calls and group voice rooms with WebRTC microphone handling.
- Steam library synchronization and import into FRAME.
- Universal media discovery across supported catalogues.
- Multiple visual themes, light/dark/system mode, density controls and custom FRAME logos.
- Responsive desktop/mobile UI, PWA shell and Capacitor Android packaging.
- Backup/import tools and resilient local/cloud recovery paths.

## Stack

React 19 + TypeScript + Vite, Supabase, Capacitor 8 and GitHub Actions.

## Environment

The browser only needs:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Never place `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` or other server secrets in a `VITE_*` variable.


## Supabase

The connected Supabase project is active and currently contains the FRAME runtime tables, RLS policies, secure call functions, release-tracking data and deployed Edge Functions.

Current deployed functions include:

- `frame-ai` — JWT required
- `anilist-import` — JWT required
- `release-tracker` — scheduled/server endpoint
- `media-discovery` — public discovery endpoint
- `release-radar` — JWT required
- `steam-library` — JWT required
- `web-search` — JWT required

The release tracker is scheduled every 30 minutes.

## Development

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

For Android:

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

## Automated verification

GitHub Actions currently covers:

1. TypeScript/build validation.
2. High-severity npm audit.
3. Playwright Chromium smoke QA.
4. Real Capacitor/Gradle Android debug packaging.

The latest browser feature suite passes 4/4 core tests:
- main navigation
- manual library entry
- Settings appearance controls
- primary-page crash smoke coverage

## Security notes

- User library/social/call data is protected with RLS.
- Browser clients do not receive Supabase service-role keys.
- Release-tracker and third-party provider secrets remain server-side.
- OAuth linking uses Supabase Auth redirects and never asks FRAME for third-party passwords.
- The Supabase security advisor currently reports two non-blocking warnings: the managed `pg_net` extension is installed in `public`, and leaked-password protection is disabled. `pg_net` is non-relocatable in the current deployment, so it was not moved blindly because that could break the scheduled release tracker. Leaked-password protection should be enabled in Supabase Auth settings before treating the production security checklist as fully green.

## Deployment

FRAME is a static Vite application and can be deployed to a static host such as Cloudflare Pages or GitHub Pages. Configure the two `VITE_*` values in the deployment environment before using the cloud-backed production build.

For GitHub Pages or any non-root static path, configure the Vite base path for that host so asset URLs resolve correctly.

## Current finish line

The codebase, cloud schema, deployed discovery/release functions, browser smoke suite and Android build are validated in CI. The remaining certification gap is live multi-user verification that requires real authenticated accounts and devices: OAuth provider handshakes, two-user chat/calls, and microphone/WebRTC behavior.

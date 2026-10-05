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


## Phase 3 — AniList media discovery

FRAME now includes an AniList-powered discovery flow:
- live title search against the public AniList GraphQL API
- poster-based search results and a metadata detail view
- import into the signed-in user's library
- AniList ID stored separately from user progress/status
- global metadata stored in `media_metadata`
- duplicate protection per user + AniList ID
- metadata refresh without resetting progress, status, favorites, or notes
- missing metadata handled gracefully
- authenticated Supabase Edge Function for metadata writes; no secret key is shipped to the browser

AniList's public GraphQL API is called at `https://graphql.anilist.co`; public data queries do not require an API secret.

### Phase 3 cloud setup

Apply the repository migrations in this order:
1. `supabase/migrations/20261005220000_foundation_auth.sql`
2. `supabase/migrations/20261005223000_phase2_media_hardening.sql`
3. `supabase/migrations/20261005230000_phase3_anilist_metadata.sql`

Then deploy the authenticated Edge Function:
`supabase functions deploy anilist-import --project-ref <your-project-ref>`

The function is intentionally protected by user JWT authentication. It is the only component allowed to write shared AniList metadata; the browser only receives the Supabase publishable key and the user's session.

The current connected Supabase project was inspected during Phase 3. It currently contains the older `anime`/`parts`/release-tracking schema and reports no applied repository migrations, so these repository migrations have **not** been applied automatically. This avoids silently changing or overwriting the existing database. The FRAME frontend continues to use the `media_items` architecture established by the repository's Phase 1/2 migrations.

Release notifications remain outside Phase 3.

## Phase 6 — Notifications + reminders

Phase 6 adds per-user in-app notifications driven by the existing `media_releases` engine. It does not create a second release tracker.

Apply migrations in order through Phase 6, then deploy the existing `release-tracker` Edge Function. The release tracker uses its server-side service role to create notifications through the protected database function `create_release_notifications`.

User-facing tables:
- `notification_preferences` — per-user episode/season/part preferences.
- `notifications` — per-user notification history with read state.

RLS ensures users can only read/update their own notification rows and preferences. Browser clients cannot insert notification rows.

The notification architecture is channel-ready: future browser push/email workers can consume the same notification records without changing release tracking or exposing service-role credentials.


## Phase 10 — Production + Android

Phase 10 preserves the existing FRAME application and adds production hardening plus deterministic Android packaging.

### Production hardening

- Browser configuration contains only the Supabase URL and publishable key.
- Activity history is trigger-owned; clients cannot forge activity records.
- Collection and tag names are case-insensitively unique per user.
- AniList calls have a 12-second timeout and invalid-response handling.
- Release data is server-filtered to the current user's metadata IDs and avoids refetching on every progress/status edit.
- Release tracking reconciles scheduled-to-released transitions before creating idempotent notifications.
- The AI function remains JWT-protected, server-side, read-only, and excludes raw media IDs from model context.
- Web security headers are supplied through `public/_headers`.
- Android and web use the same Supabase backend and authentication.

### Environment

Create the deployment environment from `.env.production.example`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Never place `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or release-tracker secrets in a `VITE_*` variable.

### Web deployment

```
npm install
npm run typecheck
npm audit --audit-level=high
npm run build
npm run preview
```

Deploy the generated `dist/` directory to a static host such as Cloudflare Pages. The native Android wrapper does not create a separate application backend.

Before first cloud-backed use, apply the repository migrations in order through Phase 10. The connected Supabase project currently has the older legacy schema and no recorded repository migrations, so this is a deliberate database cutover step and should be reviewed against any legacy data before execution.

### Supabase production configuration

Deploy these Edge Functions:

```
supabase functions deploy anilist-import --project-ref <project-ref>
supabase functions deploy release-tracker --project-ref <project-ref>
supabase functions deploy frame-ai --project-ref <project-ref>
```

Configure Edge Function secrets in the Supabase dashboard, without committing or pasting them into source control:

- `OPENAI_API_KEY`
- optional `FRAME_AI_MODEL`
- `RELEASE_TRACKER_CRON_SECRET`

Configure the Vault values consumed by the release cron:

- `project_url`
- `publishable_key`
- `release_tracker_cron_secret`

Enable leaked-password protection in Supabase Auth. Verify the cron job and perform one manual release-tracker run after migration.

### Android / Capacitor

Capacitor 8 is configured in `capacitor.config.ts` with app ID `com.reckloom.frame` and app name `FRAME`.

```
npm install
npm run build
npx cap add android
npx cap sync android
node scripts/prepare-android-branding.mjs
npx cap open android
```

The Android project is intentionally generated from Capacitor rather than committing generated boilerplate. The branding script reapplies FRAME's icon and dark splash resources after generation.

Debug APK:

```
cd android
./gradlew assembleDebug
```

GitHub Actions also produces the debug APK as the `frame-debug-apk` artifact.

Signed Play-ready AAB:

```
# Configure these GitHub repository secrets first:
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

Then manually run `.github/workflows/release-android.yml`. The signing keystore is created only on the runner and is not committed.

### Validation

The web CI workflow runs on pushes, pull requests and manual dispatch and performs:

1. dependency installation
2. TypeScript typecheck
3. high-severity npm audit
4. production Vite build

The Android workflow runs on pushes/manual dispatch and builds a real debug APK through Capacitor + Gradle.

### Final repository structure

```
.
├── .env.example
├── .env.production.example
├── .gitignore
├── .github/workflows/
│   ├── build.yml
│   ├── android.yml
│   └── release-android.yml
├── capacitor.config.ts
├── index.html
├── package.json
├── public/
│   ├── _headers
│   └── favicon.svg
├── scripts/
│   └── prepare-android-branding.mjs
├── src/
│   ├── App.tsx
│   ├── anilist.ts
│   ├── auth/
│   ├── components/
│   └── lib/
├── supabase/
│   ├── functions/
│   │   ├── anilist-import/
│   │   ├── frame-ai/
│   │   └── release-tracker/
│   └── migrations/
│       ├── 20261005220000_foundation_auth.sql
│       ├── 20261005223000_phase2_media_hardening.sql
│       ├── 20261005230000_phase3_anilist_metadata.sql
│       ├── 20261005240000_phase4_media_hierarchy.sql
│       ├── 20261005250000_phase5_release_tracking.sql
│       ├── 20261005260000_phase6_notifications.sql
│       ├── 20261005270000_phase8_statistics_personalization.sql
│       └── 20261005280000_phase10_production_hardening.sql
├── tsconfig.app.json
├── tsconfig.json
└── vite.config.ts
```

# FRAME — Perfect Anime Addition Contract

This file is the permanent acceptance contract for every anime/franchise added to FRAME. An addition is not complete until every applicable item below passes.

## 1. Research before mutation
- Resolve the canonical anime/franchise and every relevant TV season, cour, movie, OVA/ONA and special from authoritative metadata.
- Record AniList IDs only when verified. Never fabricate IDs or poster URLs.
- Separate alternate continuities instead of pretending they are one canonical episode run.
- Determine the user's watch state from explicit saved data. Never auto-complete on hydration and never guess progress.

## 2. Hierarchy
- Create one root franchise/main card.
- Create top-level seasons/parts/films/special collections as children.
- Create story arcs beneath the correct season/part when an accurate arc split is available.
- No individual episode rows.
- Arc coverage must be continuous inside the represented season: first episode through last episode, with no gaps or accidental overlaps.
- Root totals sum top-level children only. Nested arcs must never be double-counted.
- Root progress sums top-level child progress only.

## 3. Artwork
- Root must have a real, working poster.
- Every season/part/movie/special must have a real, working poster.
- Every arc must have appropriate artwork; prefer distinct arc/key art when a trustworthy source exists.
- Saved valid AniList CDN covers are real artwork and must not be treated as placeholders.
- Never use FRAME logo or a fabricated URL as a finished poster.
- Verify artwork renders in the UI, not merely that a URL exists in the database.

## 4. Characters
- Anime roots expose the character archive.
- Target Top 20 for major franchises unless the title has a deliberate larger archive.
- Character entries need name, image, role/info when available, and deterministic rank/order.
- Use a stable verified AniList media ID as the character source and preserve cached/saved character data when possible.
- Never invent an official numeric character rating. If the UI says rating/rank, it must clearly be FRAME/user ranking unless a source genuinely supplies a rating.
- Verify character cards actually render.

## 5. Progress/status
- Database progress is authoritative.
- planned: progress 0.
- completed: progress equals total.
- watching: 0 < progress < total, except franchise roots may reflect mixed child states.
- Reloading the app must not mutate progress.
- Release updates may increase totals but must not silently mark new episodes watched.

## 6. Data integrity
- No duplicate root or child records.
- No duplicate AniList identity collisions.
- No missing required titles/totals.
- No child with progress greater than total.
- Every child has the intended parent.
- Re-query Supabase after writes and reconcile totals/progress.

## 7. Frontend acceptance
- Main card visible in Anime library.
- Main poster renders.
- Hierarchy opens and all children are visible.
- Child/arc posters render.
- Character archive opens and character images render.
- Progress percentage/status matches the database.
- Existing anime are not regressed.

## 8. Engineering acceptance
- Add/update tests for any new generic behavior or bug fix before calling the change complete.
- TypeScript/build passes.
- FRAME validation passes.
- FRAME Feature QA passes.
- Verify FRAME passes.
- Deployment passes.
- Android Debug passes when the change affects the app build.
- Inspect failed job logs and fix the cause; never call an addition verified while required checks are red.

## 9. Definition of DONE
Only say an anime addition is complete/verified after database reconciliation AND the required CI/UI checks above pass. If any item is pending, say exactly what remains instead of calling it perfect.

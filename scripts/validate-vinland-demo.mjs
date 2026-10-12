import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../src/components/FrameDetail.tsx', import.meta.url), 'utf8');
const characters = readFileSync(new URL('../src/components/FrameAnimeCharacters.tsx', import.meta.url), 'utf8');
const themes = [
  'cinematic-archive',
  'midnight-glass',
  'clean-editorial',
  'full-screen-epic',
  'collectors-archive',
  'modern-media-hub',
];

assert.doesNotMatch(app, /importVinlandSaga|Add Vinland Saga guide|VINLAND_SAGA_SEASONS/,
  'No anime should have a one-off special importer or dedicated Home button');

const importStart = app.indexOf(' const importItem=async(raw:MediaItem)=>{');
const importEnd = app.indexOf(' const addSteamGame=', importStart);
assert.ok(importStart >= 0 && importEnd > importStart, 'Normal media import function must exist');
const importBlock = app.slice(importStart, importEnd);
assert.match(importBlock, /Anime in FRAME is intentionally lightweight/,
  'Anime import must use the main title + season/arc format');
assert.match(importBlock, /total:undefined,customTotal:undefined,progressUnit:undefined,episode:undefined/,
  'Anime imports must not carry episode tracking data');
assert.doesNotMatch(importBlock, /buildOnePieceHierarchy|buildNarutoHierarchy|one-piece-episode-|frame-naruto-episode/,
  'Adding an anime must not generate episode rows');

assert.match(detail, /directChildren\.filter\(x=>!isEpisodeRow\(x\)\)/,
  'Anime detail pages must show only season/arc children');
assert.match(detail, /d\.medium==='anime'\?'Seasons & arcs'/,
  'The anime hierarchy should be labelled Seasons & arcs');
assert.doesNotMatch(detail, /FrameEpisodeList/,
  'Individual episode progress/catalogue UI must not appear in anime details');

assert.match(app, /character-prefetch-/,
  'Missing One Piece character data must automatically refresh in the background');
assert.match(characters, /publishCharacters\(combined\)/,
  'Fetched character profiles should appear and save without waiting for extra searches');
assert.match(characters, /data\.characters\.length > 0/,
  'An empty proxy response should fall back to the direct AniList character query');

assert.match(app, /dataset\.frameTheme=theme/, 'Selected theme must be applied to the document');
assert.match(app, /setTheme\(id\);void persistSetting\('theme',id\)/,
  'Theme picker must apply and persist the selected theme');
assert.equal((app.match(/from\('user_preferences'\)\.select\('\*'\)\.eq\('user_id',(cloudUserId|user\.id)\)\.maybeSingle\(\)/g) || []).length, 1,
  'User preferences should only be loaded once to avoid stale settings overwriting changes');

for (const theme of themes) {
  assert.ok(app.includes(theme), `Theme picker is missing ${theme}`);
  assert.ok(css.includes(`data-frame-theme="${theme}"`), `Theme styles are missing ${theme}`);
}

console.log('FRAME checks passed: lightweight season/arc-only anime, no episode tracking UI/rows, One Piece character auto-refresh, six styled themes, and persisted theme preferences.');

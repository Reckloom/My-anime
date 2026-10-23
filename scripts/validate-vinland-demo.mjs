import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const detail = readFileSync(new URL('../src/components/FrameDetail.tsx', import.meta.url), 'utf8');

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
assert.match(detail, /FrameAnimeEpisodeCatalogue|FrameEpisodeList/,
  'Anime detail pages must include the episode catalogue when episode data exists');

assert.match(app, /dataset\.frameTheme=['"]ultra-movie['"]/,
  'FRAME must lock the document to the permanent Ultra-Movie UI');
assert.match(css, /ULTRA-MOVIE FINAL SHELL/,
  'Permanent Ultra-Movie shell styles must be present');
assert.doesNotMatch(app, /theme-picker/,
  'Theme selector must not be exposed in the permanent UI');

assert.equal((app.match(/from\('user_preferences'\)\.select\('\*'\)\.eq\('user_id',(cloudUserId|user\.id)\)\.maybeSingle\(\)/g) || []).length, 1,
  'User preferences should only be loaded once to avoid stale settings overwriting changes');

console.log('FRAME checks passed: lightweight anime imports, hierarchy handling, episode catalogue, and permanent Ultra-Movie UI.');

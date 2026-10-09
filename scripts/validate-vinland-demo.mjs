import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
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
assert.match(app, /Loading One Piece canon arcs and episode metadata/,
  'One Piece must use the normal anime import flow for its arc/episode hierarchy');
assert.match(app, /one-piece-episode-/,
  'One Piece episodes must be stored as individual child media entries');
assert.match(app, /dataset\.frameTheme=theme/, 'Selected theme must be applied to the document');
assert.match(app, /setTheme\(id\);void persistSetting\('theme',id\)/,
  'Theme picker must apply and persist the selected theme');
assert.equal((app.match(/from\('user_preferences'\)\.select\('\*'\)\.eq\('user_id',user\.id\)\.maybeSingle\(\)/g) || []).length, 1,
  'User preferences should only be loaded once to avoid stale settings overwriting changes');

for (const theme of themes) {
  assert.ok(app.includes(theme), `Theme picker is missing ${theme}`);
  assert.ok(css.includes(`data-frame-theme="${theme}"`), `Theme styles are missing ${theme}`);
}

console.log('FRAME checks passed: standard anime import flow, One Piece hierarchy, six themes styled, theme changes applied/persisted, no duplicate preference reload.');

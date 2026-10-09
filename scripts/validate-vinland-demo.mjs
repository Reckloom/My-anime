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

assert.doesNotMatch(app, /Vinland Saga|vinlandSagaDemo|vinland-feature|seedVinlandDemo/i,
  'The retired Vinland Saga demo must not be part of the app');
assert.match(app, /dataset\.frameTheme=theme/, 'Selected theme must be applied to the document');
assert.match(app, /setTheme\(id\);void persistSetting\('theme',id\)/,
  'Theme picker must apply and persist the selected theme');
assert.equal((app.match(/from\('user_preferences'\)\.select\('\*'\)\.eq\('user_id',user\.id\)\.maybeSingle\(\)/g) || []).length, 1,
  'User preferences should only be loaded once to avoid stale settings overwriting changes');

for (const theme of themes) {
  assert.ok(app.includes(theme), `Theme picker is missing ${theme}`);
  assert.ok(css.includes(`data-frame-theme="${theme}"`), `Theme styles are missing ${theme}`);
}

console.log('FRAME appearance checks passed: Vinland demo removed, six themes styled, theme changes applied/persisted, no duplicate preference reload.');

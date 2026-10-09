import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const clientSource = await readFile(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8');
const projectUrl = clientSource.match(/DEFAULT_SUPABASE_URL\s*=\s*'([^']+)'/)?.[1];
const publishableKey = clientSource.match(/DEFAULT_SUPABASE_PUBLISHABLE_KEY\s*=\s*'([^']+)'/)?.[1];
assert.ok(projectUrl && publishableKey, 'FRAME public Supabase client configuration was not found.');

const arcs = [
  { id: 'qa-one-piece-romance-dawn', title: 'Romance Dawn', currentPoster: 'https://example.invalid/root.jpg', candidates: [{ absoluteEpisode: 6, title: 'One Piece Episode 6', poster: 'https://one-piece.com/img/anime/story/img_story_006.jpg', backdrop: '' }] },
  { id: 'qa-one-piece-arlong-park', title: 'Arlong Park', currentPoster: 'https://example.invalid/root.jpg', candidates: [{ absoluteEpisode: 37, title: 'One Piece Episode 37', poster: 'https://one-piece.com/img/anime/story/img_story_037.jpg', backdrop: '' }] },
  { id: 'qa-one-piece-water-7', title: 'Water 7', currentPoster: 'https://example.invalid/root.jpg', candidates: [{ absoluteEpisode: 246, title: 'One Piece Episode 246', poster: 'https://one-piece.com/img/anime/story/img_story_246.jpg', backdrop: '' }] },
  { id: 'qa-one-piece-dressrosa', title: 'Dressrosa', currentPoster: 'https://example.invalid/root.jpg', candidates: [{ absoluteEpisode: 629, title: 'One Piece Episode 629', poster: 'https://one-piece.com/o/assets/images/anime/tvstory/3952/story_img_1.jpg', backdrop: '' }] },
  { id: 'one-piece-arc-422', title: 'Impel Down', currentPoster: 'https://example.invalid/root.jpg', candidates: [{ absoluteEpisode: 423, title: 'One Piece Episode 423', poster: 'https://one-piece.com/img/anime/story/img_story_423.jpg', backdrop: '' }] },
  { id: 'one-piece-arc-430', title: 'Impel Down', currentPoster: 'https://example.invalid/root.jpg', candidates: [{ absoluteEpisode: 441, title: 'One Piece Episode 441', poster: 'https://one-piece.com/img/anime/story/img_story_441.jpg', backdrop: '' }] }
];

const response = await fetch(projectUrl + '/functions/v1/media-discovery', {
  method: 'POST',
  headers: {
    apikey: publishableKey,
    Authorization: 'Bearer ' + publishableKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ action: 'arc-posters', provider: 'series', source: 'tmdb-tv', externalId: '37854', arcs }),
  signal: AbortSignal.timeout(90000)
});
const result = await response.json();
assert.equal(response.status, 200, 'Arc artwork endpoint returned HTTP ' + response.status + ': ' + JSON.stringify(result));
const posters = Object.values(result?.posters || {});
assert.equal(posters.length, arcs.length, 'Expected artwork for all four test arcs; received ' + posters.length + '. Response: ' + JSON.stringify(result));
const urls = posters.map(item => String(item?.poster || ''));
assert.ok(urls.every(Boolean), 'One or more arc results had no poster URL.');
assert.equal(new Set(urls).size, urls.length, 'Arc artwork returned duplicate poster URLs.');
const wikiCount = urls.filter(url => url.startsWith('https://static.wikia.nocookie.net/onepiece/images/')).length;
assert.equal(wikiCount, arcs.length, 'Expected dedicated One Piece Wiki arc artwork for all four test arcs; received ' + wikiCount + '/4. Results: ' + JSON.stringify(result));
const samplePoster = 'https://static.wikia.nocookie.net/onepiece/images/5/5a/Orange_Town_Arc.png/revision/latest/scale-to-width-down/1000?cb=20130206004236';
const proxiedImageUrl = projectUrl + '/functions/v1/media-discovery?action=proxy-image&url=' + encodeURIComponent(samplePoster);
const imageResponse = await fetch(proxiedImageUrl, {
  headers: { apikey: publishableKey, Authorization: 'Bearer ' + publishableKey },
  signal: AbortSignal.timeout(45000)
});
assert.equal(imageResponse.status, 200, 'Poster image proxy returned HTTP ' + imageResponse.status + '.');
assert.match(imageResponse.headers.get('content-type') || '', /^image\//i, 'Poster proxy did not return an image MIME type.');
const imageBytes = await imageResponse.arrayBuffer();
assert.ok(imageBytes.byteLength > 1000, 'Poster proxy returned an empty or suspiciously small image (' + imageBytes.byteLength + ' bytes).');
console.log('One Piece poster proxy test passed: image response is ' + imageBytes.byteLength + ' bytes (' + imageResponse.headers.get('content-type') + ').');

const episodeSamples = [
  'https://one-piece.com/img/anime/story/img_story_001.jpg',
  'https://www.vodanime.com/media/one-piece-episode-6-thumbnail-3419070.jpg?v=1787086569',
  'https://image.idn.media/post/20260928/asasadqwadaqwd_7c4ba1d5-9169-4c9a-b684-bffbe4346f26.jpg'
];
for (const source of episodeSamples) {
  const episodeUrl = projectUrl + '/functions/v1/media-discovery?action=proxy-image&url=' + encodeURIComponent(source);
  const res = await fetch(episodeUrl, {
    headers: { apikey: publishableKey, Authorization: 'Bearer ' + publishableKey },
    signal: AbortSignal.timeout(45000)
  });
  assert.equal(res.status, 200, 'Episode poster proxy failed for ' + source + ' (HTTP ' + res.status + ').');
  assert.match(res.headers.get('content-type') || '', /^image\\//i, 'Episode proxy returned non-image data for ' + source + '.');
  const bytes = await res.arrayBuffer();
  assert.ok(bytes.byteLength > 1000, 'Episode proxy returned too few bytes for ' + source + ' (' + bytes.byteLength + ').');
  console.log('Episode artwork source verified: ' + new URL(source).hostname + ' · ' + bytes.byteLength + ' bytes.');
}
console.log('One Piece arc artwork integration test passed: ' + posters.length + ' arcs, ' + new Set(urls).size + ' unique posters, ' + wikiCount + ' dedicated arc artworks.');

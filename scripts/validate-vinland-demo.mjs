import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../src/data/vinlandSagaDemo.ts', import.meta.url), 'utf8');
const sectionOne = source.split('const seasonTwo:EpisodeRow[]=[')[0].split('const seasonOne:EpisodeRow[]=[')[1];
const sectionTwo = source.split('const seasonTwo:EpisodeRow[]=[')[1].split('];')[0];
const countRows = text => (text.match(/\{title:/g) || []).length;
const countSummaries = text => (text.match(/^\s*\{title:.*summary:/gm) || []).length;

assert.equal(countRows(sectionOne), 24, 'Season 1 should have 24 episodes');
assert.equal(countRows(sectionTwo), 24, 'Season 2 should have 24 episodes');
assert.equal(countSummaries(sectionOne), 24, 'Every Season 1 episode should have a synopsis');
assert.equal(countSummaries(sectionTwo), 24, 'Every Season 2 episode should have a synopsis');
assert.match(source, /return \[root,s1,s2,\.\.\.seasonOne\.map/);
assert.match(source, /imdbEpisodeUrl:'https:\/\/www\.imdb\.com\/title\/tt10233448\/episodes\/\?season='\+seasonNumber/);
assert.match(source, /source:'IMDb episode-rating average \(computed from listed episode scores\)'/);

const scores = [...source.matchAll(/\{title:[^\n]*?rating:([0-9.]+)/g)].map(match => Number(match[1]));
assert.equal(scores.length, 48, 'Should contain exactly 48 episode ratings');
assert.ok(scores.every(score => score >= 0 && score <= 10), 'Episode ratings must be between 0 and 10');

console.log('Vinland Saga fixture checks passed: 24 episodes per season, 48 ratings, 48 synopses, IMDb links present.');

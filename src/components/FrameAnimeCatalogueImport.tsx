import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, LoaderCircle, Play, RefreshCw } from 'lucide-react';
import type { AniListMedia } from '../anilist';
import { aniList, cleanDescription, titleOf } from '../anilist';
import type { AnimeCharacterProfile, EpisodeMetadata, MediaItem } from '../types';
import { supabase } from '../lib/supabase';

type CatalogueStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS' | string;
type CatalogueMedia = AniListMedia & {
  status?: CatalogueStatus;
  nextAiringEpisode?: { episode?: number; airingAt?: number } | null;
  relations?: { edges?: Array<{ relationType?: string; node?: CatalogueMedia | null }> };
  characters?: { edges?: Array<{ role?: string; node?: { id?: number; name?: { full?: string | null; native?: string | null }; image?: { large?: string | null }; description?: string | null; siteUrl?: string | null } | null }> };
};
type EpisodeRow = {
  number: number;
  title: string;
  airDate?: string;
  synopsis?: string;
  poster?: string;
  source: 'Jikan' | 'Kitsu' | 'AniList count fallback';
  sourceUrl: string;
};
type CatalogueResult = { items: MediaItem[]; warnings: string[]; summary: string };
type Task = { key: string; title: string; search: string; aliases: string[]; relatedLimit: number; relationDepth: number };
type StoredProgress = { completedKeys: string[]; warnings: Record<string, string[]>; updatedAt?: string };

const TASKS: Task[] = [
  { key: 'naruto', title: 'Naruto', search: 'Naruto', aliases: ['Naruto'], relatedLimit: 1, relationDepth: 1 },
  { key: 'bleach', title: 'Bleach', search: 'Bleach', aliases: ['Bleach'], relatedLimit: 16, relationDepth: 2 },
  { key: 'summertime-rendering', title: 'Summertime Rendering', search: 'Summertime Rendering', aliases: ['Summertime Rendering', 'Summer Time Rendering'], relatedLimit: 5, relationDepth: 1 },
  { key: 'attack-on-titan', title: 'Attack on Titan', search: 'Attack on Titan', aliases: ['Attack on Titan', 'Shingeki no Kyojin'], relatedLimit: 30, relationDepth: 3 },
  { key: 'steins-gate', title: 'Steins;Gate', search: 'Steins;Gate', aliases: ['Steins;Gate'], relatedLimit: 18, relationDepth: 2 },
  { key: 'black-clover', title: 'Black Clover', search: 'Black Clover', aliases: ['Black Clover'], relatedLimit: 12, relationDepth: 2 },
  { key: 'jujutsu-kaisen', title: 'Jujutsu Kaisen', search: 'Jujutsu Kaisen', aliases: ['Jujutsu Kaisen'], relatedLimit: 12, relationDepth: 2 },
  { key: 'dragon-ball', title: 'Dragon Ball', search: 'Dragon Ball', aliases: ['Dragon Ball'], relatedLimit: 60, relationDepth: 3 },
  { key: 'fullmetal-alchemist-brotherhood', title: 'Fullmetal Alchemist: Brotherhood', search: 'Fullmetal Alchemist: Brotherhood', aliases: ['Fullmetal Alchemist: Brotherhood', 'Hagane no Renkinjutsushi: Fullmetal Alchemist'], relatedLimit: 6, relationDepth: 1 },
  { key: 'my-hero-academia', title: 'My Hero Academia', search: 'My Hero Academia', aliases: ['My Hero Academia', 'Boku no Hero Academia'], relatedLimit: 20, relationDepth: 2 },
  { key: 'one-punch-man', title: 'One Punch Man', search: 'One Punch Man', aliases: ['One Punch Man', 'One-Punch Man'], relatedLimit: 12, relationDepth: 2 },
  { key: 'hajime-no-ippo', title: 'Hajime no Ippo', search: 'Hajime no Ippo', aliases: ['Hajime no Ippo', 'Fighting Spirit'], relatedLimit: 18, relationDepth: 2 },
  { key: 'parasyte', title: 'Parasyte', search: 'Parasyte', aliases: ['Parasyte -the maxim-', 'Kiseijuu: Sei no Kakuritsu', 'Parasyte'], relatedLimit: 5, relationDepth: 1 },
  { key: 'erased', title: 'Erased', search: 'Erased', aliases: ['Erased', 'Boku dake ga Inai Machi'], relatedLimit: 5, relationDepth: 1 },
  { key: 'death-note', title: 'Death Note', search: 'Death Note', aliases: ['Death Note'], relatedLimit: 8, relationDepth: 2 },
  { key: 're-zero', title: 'Re:Zero', search: 'Re:Zero kara Hajimeru Isekai Seikatsu', aliases: ['Re:Zero kara Hajimeru Isekai Seikatsu', 'Re:Zero -Starting Life in Another World-'], relatedLimit: 16, relationDepth: 2 },
  { key: 'mushoku-tensei', title: 'Mushoku Tensei: Jobless Reincarnation', search: 'Mushoku Tensei: Isekai Ittara Honki Dasu', aliases: ['Mushoku Tensei: Jobless Reincarnation', 'Mushoku Tensei: Isekai Ittara Honki Dasu'], relatedLimit: 12, relationDepth: 2 },
  { key: 'hells-paradise', title: "Hell's Paradise", search: 'Jigokuraku', aliases: ["Hell's Paradise: Jigokuraku", 'Jigokuraku'], relatedLimit: 7, relationDepth: 2 },
  { key: 'mashle', title: 'Mashle: Magic and Muscles', search: 'Mashle', aliases: ['Mashle: Magic and Muscles', 'Mashle'], relatedLimit: 8, relationDepth: 2 },
  { key: 'solo-leveling', title: 'Solo Leveling', search: 'Ore dake Level Up na Ken', aliases: ['Solo Leveling', 'Ore dake Level Up na Ken'], relatedLimit: 8, relationDepth: 2 },
  { key: 'spy-family', title: 'Spy × Family', search: 'Spy x Family', aliases: ['Spy x Family', 'Spy × Family'], relatedLimit: 16, relationDepth: 2 },
  { key: 'chainsaw-man', title: 'Chainsaw Man', search: 'Chainsaw Man', aliases: ['Chainsaw Man'], relatedLimit: 9, relationDepth: 2 },
  { key: 'tokyo-revengers', title: 'Tokyo Revengers', search: 'Tokyo Revengers', aliases: ['Tokyo Revengers'], relatedLimit: 12, relationDepth: 2 },
  { key: 'demon-slayer', title: 'Demon Slayer: Kimetsu no Yaiba', search: 'Kimetsu no Yaiba', aliases: ['Demon Slayer: Kimetsu no Yaiba', 'Kimetsu no Yaiba', 'Demon Slayer'], relatedLimit: 24, relationDepth: 3 }
];

const BLEACH_ARCS = [
  [1,'Agent of the Shinigami',1,20,'Ichigo becomes a Substitute Soul Reaper and protects Karakura Town.'],
  [2,'Soul Society: Sneak Entry',21,41,'Ichigo and his friends enter Soul Society to rescue Rukia.'],
  [3,'Soul Society: Rescue',42,63,'The rescue mission reaches its turning point in Soul Society.'],
  [4,'The Bount',64,91,'A mysterious group called the Bount emerges.'],
  [5,'Bount Assault on Soul Society',92,109,'The Bount conflict reaches Soul Society.'],
  [6,'Arrancar: The Arrival',110,131,'The Arrancar threat reaches the human world.'],
  [7,'Hueco Mundo: Sneak Entry',132,151,'The rescue mission moves into Hueco Mundo.'],
  [8,'Hueco Mundo: Fierce Fight',152,167,'Battles against the Arrancar intensify.'],
  [9,'The New Captain Shusuke Amagai',168,189,'A new captain takes command of the Third Division.'],
  [10,'Arrancar vs. Shinigami',190,205,'The conflict between Soul Reapers and Arrancar escalates.'],
  [11,'The Past',206,212,'The origins of the Visored are revealed.'],
  [12,'Decisive Battle of Karakura',213,229,'The battle for Karakura Town reaches a critical stage.'],
  [13,'Zanpakuto: The Alternate Tale',230,265,'Zanpakuto spirits become central to a new conflict.'],
  [14,'Arrancar: Downfall',266,316,'The Arrancar conflict approaches its conclusion.'],
  [15,'Gotei 13 Invading Army',317,342,'A new threat targets the Gotei 13.'],
  [16,'The Lost Substitute Shinigami',343,366,'Ichigo faces life after losing his Soul Reaper powers.']
] as const;

// Curated non-overlapping TV arc ranges. Ranges are local to their parent TV
// part/season; they are organizational metadata only and never add to root totals.
type CuratedArc = { season: string; name: string; start: number; end: number; description: string };
const CURATED_ARCS: Record<string, CuratedArc[]> = {
  'my-hero-academia': [
    {season:'Season 1',name:'U.A. Entrance & Battle Trial',start:1,end:8,description:'Izuku enters U.A., learns to control One For All and faces the first class trials.'},
    {season:'Season 1',name:'U.S.J. Arc',start:9,end:13,description:'Class 1-A faces the League of Villains during the U.S.J. attack.'},
    {season:'Season 2',name:'U.A. Sports Festival',start:1,end:12,description:'Class 1-A competes in U.A.’s major student tournament.'},
    {season:'Season 2',name:'Vs. Hero Killer Stain',start:13,end:20,description:'The students encounter Stain and the consequences of his ideology.'},
    {season:'Season 2',name:'Final Exams',start:21,end:25,description:'Students face practical final exams against their teachers.'},
    {season:'Season 3',name:'Forest Training Camp',start:1,end:7,description:'Class 1-A trains in the forest before a villain attack changes everything.'},
    {season:'Season 3',name:'Hideout Raid',start:8,end:12,description:'The heroes launch a rescue operation against the League of Villains.'},
    {season:'Season 3',name:'Provisional Hero License Exam',start:13,end:23,description:'Students compete for provisional hero licenses.'},
    {season:'Season 3',name:'Shie Hassaikai Setup',start:24,end:25,description:'The heroes prepare for the next major conflict.'},
    {season:'Season 4',name:'Shie Hassaikai',start:1,end:14,description:'The heroes confront Overhaul and the Shie Hassaikai.'},
    {season:'Season 4',name:'Remedial Course',start:15,end:18,description:'Students complete remedial training after the license exam.'},
    {season:'Season 4',name:'U.A. School Festival',start:19,end:21,description:'Class 1-A works to make the school festival a success.'},
    {season:'Season 4',name:'Pro Hero',start:22,end:25,description:'Endeavor faces a major test as the new No. 1 hero.'},
    {season:'Season 5',name:'Joint Training',start:1,end:12,description:'Classes 1-A and 1-B compete in joint battle training.'},
    {season:'Season 5',name:'Meta Liberation Army',start:13,end:25,description:'The League of Villains collides with the Meta Liberation Army.'},
    {season:'Season 6',name:'Paranormal Liberation War',start:1,end:13,description:'Heroes and villains clash in an enormous coordinated war.'},
    {season:'Season 6',name:'Dark Hero',start:14,end:25,description:'Society collapses around Izuku as he operates independently.'},
    {season:'Season 7',name:'Star and Stripe',start:1,end:2,description:'America’s top hero enters the conflict.'},
    {season:'Season 7',name:'U.A. Traitor',start:3,end:5,description:'The heroes uncover the traitor and prepare for the final battle.'},
    {season:'Season 7',name:'Final War',start:6,end:21,description:'The heroes fight the villains in the decisive war.'},
    {season:'Final Season',name:'Final War',start:1,end:9,description:'The final season concludes the decisive battle.'},
    {season:'Final Season',name:'Epilogue',start:10,end:11,description:'The story closes with the aftermath and future of the heroes.'}
  ],
  'solo-leveling': [
    {season:'Season 1',name:'Double Dungeon',start:1,end:2,description:'Jinwoo survives the deadly double dungeon and awakens the System.'},
    {season:'Season 1',name:'Instant Dungeon & Dungeon Raids',start:3,end:7,description:'Jinwoo begins systematic leveling and takes on increasingly dangerous gates.'},
    {season:'Season 1',name:'Yoo Jinho Raid Party',start:8,end:10,description:'Jinwoo works with Jinho while preparing for his class change.'},
    {season:'Season 1',name:'Job Change',start:11,end:12,description:'Jinwoo faces the brutal class-change dungeon.'},
    {season:'Season 2',name:'Red Gate',start:1,end:3,description:'A training raid turns into a deadly Red Gate survival battle.'},
    {season:'Season 2',name:'Demon Castle',start:4,end:9,description:'Jinwoo clears the Demon Castle while seeking the Elixir of Life.'},
    {season:'Season 2',name:'Jeju Island',start:10,end:13,description:'Jinwoo joins the decisive Jeju Island raid and confronts the Ant King.'}
  ],
  'hells-paradise': [
    {season:'Season 1',name:'Island',start:1,end:7,description:'Gabimaru and the condemned prisoners arrive on the mysterious island.'},
    {season:'Season 1',name:'Lord Tensen',start:8,end:13,description:'The survivors uncover the island’s deeper mysteries and face Lord Tensen.'},
    {season:'Season 2',name:'Horizon of the Island',start:1,end:6,description:'The surviving group continues the search while facing new threats.'},
    {season:'Season 2',name:'Lord Tensen Conflict',start:7,end:12,description:'The struggle against the island’s forces escalates toward its conclusion.'}
  ],
  'mashle': [
    {season:'Season 1',name:'Easton Enrollment',start:1,end:5,description:'Mash enters Easton Magic Academy and begins proving himself.'},
    {season:'Season 1',name:'Magia Lupus',start:6,end:12,description:'Mash confronts the Magia Lupus group and their leader.'},
    {season:'Season 2',name:'Divine Visionary Selection Exam',start:1,end:12,description:'Mash and his friends compete in the Divine Visionary Selection Exam.'}
  ],
  'chainsaw-man': [
    {season:'Season 1',name:'Introduction',start:1,end:3,description:'Denji becomes Chainsaw Man and joins Public Safety.'},
    {season:'Season 1',name:'Bat Devil',start:4,end:6,description:'Denji and Power confront the Bat Devil.'},
    {season:'Season 1',name:'Eternity Devil',start:7,end:9,description:'The Public Safety team becomes trapped in a terrifying devil encounter.'},
    {season:'Season 1',name:'Katana Man',start:10,end:12,description:'Denji and the surviving hunters pursue Katana Man.'}
  ],
  'death-note': [
    {season:'TV Series',name:'Kira Investigation',start:1,end:25,description:'Light and L engage in their central battle of wits over Kira.'},
    {season:'TV Series',name:'Near & Mello',start:26,end:37,description:'A new generation of investigators takes the fight to Kira.'}
  ],
  'jujutsu-kaisen': [
    {season:'Season 1',name:'Fearsome Womb',start:1,end:8,description:'Yuji enters Jujutsu High and confronts his first major curses.'},
    {season:'Season 1',name:'Vs. Mahito',start:9,end:13,description:'Yuji and Nanami face Mahito and his evolving threat.'},
    {season:'Season 1',name:'Kyoto Goodwill Event',start:14,end:21,description:'Tokyo and Kyoto students clash in the Goodwill Event.'},
    {season:'Season 1',name:'Death Painting',start:22,end:24,description:'Yuji and his allies confront the Death Painting brothers.'},
    {season:'Season 2',name:'Hidden Inventory / Premature Death',start:1,end:5,description:'Gojo and Geto’s past is revealed.'},
    {season:'Season 2',name:'Shibuya Incident',start:6,end:23,description:'The Shibuya Incident reshapes the jujutsu world.'},
    {season:'Season 3',name:'Culling Game: Part 1',start:1,end:12,description:'Yuji and the sorcerers enter the Culling Game.'}
  ],
  'demon-slayer': [
    {season:'Season 1',name:'Final Selection',start:1,end:5,description:'Tanjiro trains and survives Final Selection.'},
    {season:'Season 1',name:'First Mission',start:6,end:7,description:'Tanjiro begins his work as a Demon Slayer.'},
    {season:'Season 1',name:'Asakusa',start:8,end:10,description:'Tanjiro encounters Muzan and the demon Tamayo.'},
    {season:'Season 1',name:'Tsuzumi Mansion',start:11,end:14,description:'Tanjiro joins Zenitsu and Inosuke against a dangerous demon.'},
    {season:'Season 1',name:'Natagumo Mountain',start:15,end:21,description:'The group faces the Spider Family and Rui.'},
    {season:'Season 1',name:'Rehabilitation Training',start:22,end:26,description:'Tanjiro recovers and trains at the Butterfly Mansion.'},
    {season:'Mugen Train Arc',name:'Mugen Train',start:1,end:7,description:'Tanjiro and his allies board the Mugen Train with Rengoku.'},
    {season:'Entertainment District Arc',name:'Entertainment District',start:1,end:11,description:'The Demon Slayers investigate demon activity in Yoshiwara.'},
    {season:'Swordsmith Village Arc',name:'Swordsmith Village',start:1,end:11,description:'Tanjiro protects the Swordsmith Village from Upper Rank demons.'},
    {season:'Hashira Training Arc',name:'Hashira Training',start:1,end:8,description:'The Demon Slayer Corps prepares for the final confrontation.'}
  ],
  'tokyo-revengers': [
    {season:'Season 1',name:'Moebius',start:1,end:13,description:'Takemichi becomes involved in the Moebius conflict.'},
    {season:'Season 1',name:'Valhalla',start:14,end:24,description:'The Bloody Halloween conflict pits Toman against Valhalla.'},
    {season:'Season 2',name:'Christmas Showdown',start:1,end:13,description:'Takemichi and Chifuyu confront the Black Dragon conflict.'},
    {season:'Season 3',name:'Tenjiku',start:1,end:13,description:'Toman faces Izana and the Tenjiku gang.'},
    {season:'Season 4',name:'Three Deities War',start:1,end:13,description:'The final televised conflict begins around the Three Deities.'}
  ],
  'summer-time-rendering': [
    {season:'Season 1',name:'Mio & the Shadow Mystery',start:1,end:7,description:'Shinpei discovers the Shadow phenomenon and begins repeating July 22.'},
    {season:'Season 1',name:'Hiruko & Ushio',start:8,end:14,description:'The mystery expands as Shinpei and Ushio investigate the island.'},
    {season:'Season 1',name:'Final Loop',start:15,end:25,description:'The group prepares for the decisive confrontation with Shide.'}
  ]
};
const SEARCH_QUERY = 'query ($search:String!,$page:Int!,$perPage:Int!,$type:MediaType!){Page(page:$page,perPage:$perPage){media(search:$search,type:$type,sort:[SEARCH_MATCH]){id idMal type format title{romaji english native userPreferred} synonyms coverImage{extraLarge} bannerImage genres season seasonYear averageScore}}}';
const DETAIL_FIELDS = 'id idMal type format status title{romaji english native userPreferred} synonyms description coverImage{extraLarge} bannerImage genres tags{name} season seasonYear averageScore studios{nodes{name}} source episodes duration startDate{year month day} endDate{year month day} nextAiringEpisode{episode airingAt} relations{edges{relationType node{id idMal type format status title{romaji english native userPreferred} synonyms coverImage{extraLarge} bannerImage genres season seasonYear averageScore studios{nodes{name}} source episodes duration startDate{year month day} endDate{year month day}}}}';
const ROOT_DETAIL_QUERY = 'query ($id:Int!){Media(id:$id){' + DETAIL_FIELDS + ' characters(sort:ROLE,perPage:20){edges{role node{id name{full native} image{large} description siteUrl}}}}}';
const RELATED_DETAIL_QUERY = 'query ($id:Int!){Media(id:$id){' + DETAIL_FIELDS + '}}';
const ALLOWED_RELATIONS = new Set(['PREQUEL', 'SEQUEL', 'SIDE_STORY', 'SPIN_OFF', 'PARENT', 'CHARACTER']);
const ALLOWED_FORMATS = new Set(['TV', 'TV_SHORT', 'MOVIE', 'OVA', 'ONA', 'SPECIAL']);
const MOVIE_FORMATS = new Set(['MOVIE']);
const MIN_REQUEST_GAP_MS = 720;
let lastAniListRequestAt = 0;
let lastJikanRequestAt = 0;

const sleep = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));
const pad = (n: number) => String(n).padStart(3, '0');
const clean = (value?: string | null) => cleanDescription(value || '');
const preferredTitle = (m: CatalogueMedia) => String(m.title?.english || m.title?.userPreferred || m.title?.romaji || m.title?.native || 'Untitled').trim();
const normalizeText = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/×/g, 'x').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const titleVariants = (m: CatalogueMedia) => [m.title?.english, m.title?.userPreferred, m.title?.romaji, m.title?.native, ...(m.synonyms || [])].filter(Boolean).map(normalizeText);
const dateOnly = (value?: string | null) => {
  if (!value) return undefined;
  const date = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
};
const formatDate = (d?: { year?: number | null; month?: number | null; day?: number | null } | null) => {
  if (!d?.year) return undefined;
  return String(d.year) + (d.month ? '-' + String(d.month).padStart(2, '0') : '') + (d.day ? '-' + String(d.day).padStart(2, '0') : '');
};
const getJson = async (url: string, provider: 'Jikan' | 'Kitsu', signal?: AbortSignal): Promise<any> => {
  if (provider === 'Jikan') {
    const wait = Math.max(0, MIN_REQUEST_GAP_MS - (Date.now() - lastJikanRequestAt));
    if (wait) await sleep(wait);
    lastJikanRequestAt = Date.now();
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
      const raw = await response.text();
      let data: any;
      try { data = JSON.parse(raw); } catch { throw new Error(provider + ' returned invalid JSON.'); }
      if (!response.ok) {
        const message = provider + ' returned HTTP ' + response.status + '.';
        if (response.status === 429 || response.status >= 500) throw new Error(message);
        throw Object.assign(new Error(message), { permanent: true });
      }
      return data;
    } catch (error) {
      lastError = error;
      if ((error as any)?.permanent || (error instanceof DOMException && error.name === 'AbortError')) break;
      if (attempt < 2) await sleep(900 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(provider + ' request failed.');
};
const queryAniList = async (query: string, variables: Record<string, unknown>) => {
  const wait = Math.max(0, MIN_REQUEST_GAP_MS - (Date.now() - lastAniListRequestAt));
  if (wait) await sleep(wait);
  lastAniListRequestAt = Date.now();
  return aniList<any>(query, variables);
};

function excludedTitle(task: Task, title: string) {
  const t = normalizeText(title);
  if (!t || /\b(recap|summary|digest|compilation)\b/.test(t)) return true;
  if (task.key === 'dragon-ball') {
    if (/^dragon ball gt\b/.test(t) || /^dragon ball daima\b/.test(t)) return true;
    // Kai is an alternate recut of Z, not an additional story to count twice.
    if (/^dragon ball z kai\b/.test(t) || /^dragon ball kai\b/.test(t)) return true;
  }
  if (task.key === 're-zero' && (t.includes('shin henshuu ban') || t.includes('directors cut'))) return true;
  return false;
}

function isEligibleRelation(task: Task, edge: { relationType?: string; node?: CatalogueMedia | null }) {
  const node = edge.node;
  if (!node || node.type !== 'ANIME' || !Number(node.id) || !ALLOWED_RELATIONS.has(String(edge.relationType || ''))) return false;
  if (!ALLOWED_FORMATS.has(String(node.format || ''))) return false;
  if (String(node.status || '') === 'NOT_YET_RELEASED') return false;
  if (excludedTitle(task, preferredTitle(node))) return false;
  return true;
}

async function findRoot(task: Task): Promise<CatalogueMedia> {
  const searches = [...new Set([task.search, ...task.aliases])].slice(0, 5);
  const accepted = new Set(task.aliases.map(normalizeText).concat([normalizeText(task.title), normalizeText(task.search)]));
  for (const search of searches) {
    const result = await queryAniList(SEARCH_QUERY, { search, page: 1, perPage: 15, type: 'ANIME' });
    const rows = Array.isArray(result?.Page?.media) ? result.Page.media as CatalogueMedia[] : [];
    const exact = rows.filter(row => titleVariants(row).some(v => accepted.has(v)) || titleVariants(row).some(v => searches.some(s => normalizeText(s) === v)));
    const tv = exact.filter(row => ['TV', 'TV_SHORT'].includes(String(row.format || '')));
    const chosen = (tv.length ? tv : exact)[0];
    if (chosen) return chosen;
  }
  throw new Error('AniList did not return an exact title match for ' + task.title + '; no substitute title was imported.');
}

async function fetchDetails(id: number, includeCharacters: boolean): Promise<CatalogueMedia> {
  const result = await queryAniList(includeCharacters ? ROOT_DETAIL_QUERY : RELATED_DETAIL_QUERY, { id });
  const media = result?.Media as CatalogueMedia | undefined;
  if (!media?.id) throw new Error('AniList returned no detail record for ID ' + id + '.');
  return media;
}

async function resolveMalId(media: CatalogueMedia): Promise<number | undefined> {
  if (Number(media.idMal) > 0) return Number(media.idMal);
  const q = preferredTitle(media);
  const response = await getJson('https://api.jikan.moe/v4/anime?q=' + encodeURIComponent(q) + '&limit=10', 'Jikan');
  const rows = Array.isArray(response?.data) ? response.data : [];
  const accepted = new Set(titleVariants(media));
  const match = rows.find((row: any) => [row.title, row.title_english, row.title_japanese, row.title_synonyms?.join(' ')].filter(Boolean).some((v: string) => accepted.has(normalizeText(v))));
  return Number(match?.mal_id) > 0 ? Number(match.mal_id) : undefined;
}

async function loadJikanEpisodes(malId: number): Promise<{ rows: EpisodeRow[]; totalPages: number; sourceCount: number }> {
  const rows: EpisodeRow[] = [];
  let page = 1;
  let totalPages = 1;
  let lastPageLength = 0;
  do {
    const response = await getJson('https://api.jikan.moe/v4/anime/' + malId + '/episodes?page=' + page + '&limit=100', 'Jikan');
    const data = Array.isArray(response?.data) ? response.data : [];
    totalPages = Math.max(1, Number(response?.pagination?.last_visible_page || 1));
    lastPageLength = data.length;
    for (const raw of data) {
      const number = Number(raw?.mal_id);
      const title = String(raw?.title || raw?.title_japanese || raw?.title_romanji || '').trim();
      if (!Number.isInteger(number) || number < 1 || !title || !hasRealEpisodeTitle(title, number)) continue;
      rows.push({
        number,
        title,
        airDate: dateOnly(raw?.aired),
        synopsis: clean(raw?.synopsis),
        source: 'Jikan',
        sourceUrl: 'https://myanimelist.net/anime/' + malId + '/episode/' + number
      });
    }
    page++;
  } while (page <= totalPages && page <= 40 && lastPageLength > 0);
  return { rows: dedupeEpisodes(rows), totalPages, sourceCount: rows.length };
}

async function loadKitsuEpisodes(media: CatalogueMedia): Promise<{ rows: EpisodeRow[]; totalPages: number; sourceCount: number }> {
  const query = encodeURIComponent(preferredTitle(media));
  const search = await getJson('https://kitsu.io/api/edge/anime?filter%5Btext%5D=' + query + '&page%5Blimit%5D=10', 'Kitsu');
  const candidates = Array.isArray(search?.data) ? search.data : [];
  const accepted = new Set(titleVariants(media));
  const match = candidates.find((row: any) => {
    const attrs = row?.attributes || {};
    const vals = [attrs.canonicalTitle, attrs.titles?.en, attrs.titles?.en_jp, attrs.titles?.ja_jp, attrs.slug].filter(Boolean);
    return vals.some((v: string) => accepted.has(normalizeText(v)));
  });
  if (!match?.id) throw new Error('Kitsu did not find an exact title match for ' + preferredTitle(media) + '.');
  const rows: EpisodeRow[] = [];
  let offset = 0;
  let totalPages = 1;
  let calls = 0;
  while (calls < 100) {
    const response = await getJson('https://kitsu.io/api/edge/anime/' + encodeURIComponent(String(match.id)) + '/episodes?page%5Blimit%5D=20&page%5Boffset%5D=' + offset, 'Kitsu');
    const data = Array.isArray(response?.data) ? response.data : [];
    if (calls === 0) totalPages = Math.max(1, Math.ceil(Number(response?.meta?.count || data.length) / 20));
    if (!data.length) break;
    for (const raw of data) {
      const attrs = raw?.attributes || {};
      const number = Number(attrs.number);
      const title = String(attrs.titles?.en || attrs.titles?.en_jp || attrs.titles?.ja_jp || attrs.canonicalTitle || '').trim();
      if (!Number.isInteger(number) || number < 1 || !title) continue;
      rows.push({
        number,
        title,
        airDate: dateOnly(attrs.airdate),
        synopsis: clean(attrs.synopsis),
        poster: String(attrs.thumbnail?.original || attrs.thumbnail?.small || ''),
        source: 'Kitsu',
        sourceUrl: 'https://kitsu.io/episodes/' + String(raw.id)
      });
    }
    calls++;
    offset += data.length;
    if (data.length < 20) break;
    await sleep(220);
  }
  return { rows: dedupeEpisodes(rows), totalPages, sourceCount: rows.length };
}

function hasRealEpisodeTitle(title: string, number: number) {
  const normalized = title.trim().replace(/^(?:(?:episode|ep)\s*\d+\s*[:·.—-]?\s*)+/i, '').replace(/^\d+\.\s*/, '').trim();
  return Boolean(normalized) && !new RegExp('^episode\\s*' + number + '$', 'i').test(normalized) && !/^\d+\.?$/.test(normalized);
}

function dedupeEpisodes(rows: EpisodeRow[]): EpisodeRow[] {
  const map = new Map<number, EpisodeRow>();
  for (const row of rows) {
    const existing = map.get(row.number);
    if (!existing || (!existing.title && row.title) || (existing.source === 'Jikan' && row.source === 'Kitsu' && !existing.poster && row.poster)) map.set(row.number, row);
  }
  return [...map.values()].sort((a, b) => a.number - b.number);
}

function airedThroughToday(row: EpisodeRow) {
  if (!row.airDate) return false;
  const time = Date.parse(row.airDate + 'T23:59:59Z');
  return Number.isFinite(time) && time <= Date.now();
}

async function episodeCatalogue(media: CatalogueMedia): Promise<{ rows: EpisodeRow[]; verified: boolean; warnings: string[] }> {
  const format = String(media.format || 'TV');
  if (MOVIE_FORMATS.has(format)) return { rows: [], verified: true, warnings: [] };
  const expected = Math.max(0, Number(media.episodes || 0));
  const status = String(media.status || '');
  const nextEpisode = Number(media.nextAiringEpisode?.episode || 0);
  if (status === 'NOT_YET_RELEASED') return { rows: [], verified: expected === 0, warnings: expected ? ['AniList lists ' + expected + ' episodes before the title has released; no future episodes were marked watched.'] : [] };
  const malId = await resolveMalId(media).catch(() => undefined);
  if (!malId) {
    const count = status === 'FINISHED' && expected > 0 ? Math.min(2000, expected) : nextEpisode > 0 ? Math.min(2000, nextEpisode - 1) : 0;
    const rows: EpisodeRow[] = Array.from({ length: count }, (_, index) => ({
      number: index + 1,
      title: 'Episode ' + pad(index + 1),
      source: 'AniList count fallback',
      sourceUrl: 'https://anilist.co/anime/' + Number(media.id) + '/',
      synopsis: ''
    }));
    if (!count) return { rows: [], verified: false, warnings: ['No MyAnimeList ID or exact Jikan match for ' + preferredTitle(media) + '; episode details could not be verified.'] };
    return { rows, verified: false, warnings: ['No MyAnimeList ID or exact Jikan match for ' + preferredTitle(media) + '; preserved ' + count + ' numbered episodes using clearly labeled placeholders rather than omitting the series.'] };
  }

  let primary: { rows: EpisodeRow[]; totalPages: number; sourceCount: number } | undefined;
  const sourceErrors: string[] = [];
  try { primary = await loadJikanEpisodes(malId); }
  catch (error) { sourceErrors.push(error instanceof Error ? error.message : 'Jikan episode request failed.'); }

  const finished = status === 'FINISHED';
  let current: EpisodeRow[] = [];
  if (primary?.rows.length) {
    current = finished
      ? primary.rows.filter(row => !expected || row.number <= expected)
      : nextEpisode > 0
        ? primary.rows.filter(row => row.number < nextEpisode && (!row.airDate || airedThroughToday(row)))
        : primary.rows.filter(airedThroughToday);
  }

  const needsFallback = !primary?.rows.length || (expected > 0 && finished && current.length !== expected) || (!finished && expected > 0 && current.length === 0);
  if (needsFallback) {
    try {
      const kitsu = await loadKitsuEpisodes(media);
      const candidate = finished
        ? kitsu.rows.filter(row => !expected || row.number <= expected)
        : nextEpisode > 0
          ? kitsu.rows.filter(row => row.number < nextEpisode && (!row.airDate || airedThroughToday(row)))
          : kitsu.rows.filter(airedThroughToday);
      if (candidate.length > current.length || (expected > 0 && finished && candidate.length === expected)) current = candidate;
    } catch (error) {
      sourceErrors.push(error instanceof Error ? error.message : 'Kitsu episode request failed.');
    }
  }

  current = dedupeEpisodes(current).filter(row => row.title.trim());
  const sourcedCount = current.length;
  // Preserve every numbered episode when a trusted catalogue confirms the count,
  // even if Jikan/Kitsu omit a title or an episode page. Real source titles always win.
  const targetCount = finished && expected > 0 ? Math.min(2000, expected) : nextEpisode > 0 ? Math.min(2000, nextEpisode - 1) : 0;
  if (targetCount > 0) {
    const byNumber = new Map(current.map(row => [row.number, row]));
    for (let number = 1; number <= targetCount; number++) {
      if (byNumber.has(number)) continue;
      byNumber.set(number, {
        number,
        title: 'Episode ' + pad(number),
        source: 'AniList count fallback',
        sourceUrl: 'https://anilist.co/anime/' + Number(media.id) + '/',
        synopsis: ''
      });
    }
    current = [...byNumber.values()].sort((a, b) => a.number - b.number);
  }

  // Jikan provides episode titles but usually no still image. Enrich missing
  // artwork (and source-only placeholder titles) from Kitsu without replacing
  // a real title or synopsis already supplied by the primary source.
  if (current.some(row => !row.poster || row.source === 'AniList count fallback')) {
    try {
      const kitsu = await loadKitsuEpisodes(media);
      const kitsuByNumber = new Map(kitsu.rows.map(row => [row.number, row]));
      current = current.map(row => {
        const visual = kitsuByNumber.get(row.number);
        if (!visual) return row;
        const placeholder = row.source === 'AniList count fallback';
        const title = placeholder && hasRealEpisodeTitle(visual.title, visual.number) ? visual.title : row.title;
        return {
          ...row,
          title,
          airDate: row.airDate || visual.airDate,
          synopsis: row.synopsis || visual.synopsis,
          poster: row.poster || visual.poster,
          source: placeholder && title !== row.title ? 'Kitsu' : row.source,
          sourceUrl: placeholder && title !== row.title ? visual.sourceUrl : row.sourceUrl
        };
      });
    } catch {
      // Keep the verified title/count data even when Kitsu artwork is unavailable.
    }
  }
  const missingPosterCount = current.filter(row => !String(row.poster || '').trim()).length;
  // Never drop a real or count-verified episode just because a still image is missing.
  // FrameArtwork renders a title-specific fallback until source artwork becomes available.
  const maxSourceNumber = current.reduce((n, row) => Math.max(n, row.number), 0);
  const countMismatch = expected > 0 && finished && current.length !== Math.min(2000, expected);
  const airingMismatch = !finished && nextEpisode > 0 && maxSourceNumber < nextEpisode - 1;
  const fallbackCount = current.filter(row => row.source === 'AniList count fallback').length;
  const warnings: string[] = [];
  if (fallbackCount) warnings.push(preferredTitle(media) + ': added ' + fallbackCount + ' numbered episode entries where source episode titles/pages were missing; verify titles later.');
  if (missingPosterCount) warnings.push(preferredTitle(media) + ': ' + missingPosterCount + ' episode(s) have no source still poster and will use a title-specific fallback until artwork is available.');
  if (countMismatch) warnings.push(preferredTitle(media) + ': AniList reports ' + expected + ' episodes, but the sources did not establish the full numbered range.');
  if (airingMismatch) warnings.push(preferredTitle(media) + ': the upcoming AniList episode implies ' + (nextEpisode - 1) + ' released episodes, but source titles reach only episode ' + maxSourceNumber + '.');
  if (!primary?.rows.length && sourceErrors.length) warnings.push(preferredTitle(media) + ': episode source problem — ' + sourceErrors.join(' / '));
  return { rows: current, verified: !countMismatch && !airingMismatch && missingPosterCount === 0 && (!expected || current.length > 0), warnings };
}

function charactersFrom(media: CatalogueMedia): AnimeCharacterProfile[] {
  const edges = Array.isArray(media.characters?.edges) ? media.characters!.edges! : [];
  const result: AnimeCharacterProfile[] = [];
  const seen = new Set<string>();
  for (const edge of edges) {
    const node = edge.node;
    const name = String(node?.name?.full || '').trim();
    if (!name || seen.has(normalizeText(name))) continue;
    seen.add(normalizeText(name));
    result.push({
      id: Number(node?.id) || undefined,
      name,
      nativeName: String(node?.name?.native || '').trim() || undefined,
      role: String(edge.role || 'SUPPORTING').toLowerCase(),
      image: String(node?.image?.large || '').trim() || undefined,
      description: clean(node?.description).slice(0, 900) || undefined,
      sourceUrl: String(node?.siteUrl || '').trim() || undefined
    });
  }
  return result.slice(0, 20);
}

function mediaIdFor(media: CatalogueMedia, task: Task, userId: string, library: MediaItem[], isRoot: boolean, rootId: string) {
  const wantedMedium = MOVIE_FORMATS.has(String(media.format || '')) ? 'movie' : 'anime';
  const existing = library.find(x => x.anilistId === Number(media.id) && x.medium === wantedMedium);
  if (existing) return existing.id;
  if (isRoot) return rootId;
  const scope = userId.replace(/-/g, '').slice(0, 12);
  return 'frame-anime-media-' + Number(media.id) + '-' + scope;
}

function mapMediaItem(media: CatalogueMedia, opts: {
  id: string; parentId?: string; progress: number; total: number; characters?: AnimeCharacterProfile[];
}): MediaItem {
  const movie = MOVIE_FORMATS.has(String(media.format || ''));
  const title = preferredTitle(media);
  const alt = [...new Set([media.title?.english, media.title?.userPreferred, media.title?.romaji, media.title?.native, ...(media.synonyms || [])].filter(Boolean).map(String).filter(x => x !== title))];
  const genres = Array.isArray(media.genres) ? media.genres.map(String) : [];
  const themes = Array.isArray(media.tags) ? media.tags.slice(0, 15).map((x: any) => String(x?.name || '')).filter(Boolean) : [];
  const starts = formatDate(media.startDate);
  const ends = formatDate(media.endDate);
  const mal = Number(media.idMal) > 0 ? String(media.idMal) : undefined;
  return {
    id: opts.id,
    parentId: opts.parentId,
    anilistId: Number(media.id),
    sourceProvider: 'frame-anime-catalogue',
    externalId: 'anilist:' + Number(media.id),
    title,
    alternativeTitles: alt,
    description: clean(media.description),
    poster: String(media.coverImage?.extraLarge || ''),
    backdrop: String(media.bannerImage || ''),
    medium: movie ? 'movie' : 'anime',
    // A catalogue import records availability, not whether the user watched it.
    // Existing tracking state is preserved by the merge layer.
    status: opts.total > 0 && opts.progress >= opts.total ? 'completed' : 'planned',
    progress: movie ? 0 : Math.max(0, Math.min(opts.progress, opts.total)),
    total: movie ? 1 : Math.min(2000, Math.max(0, opts.total)),
    customTotal: undefined,
    progressUnit: movie ? 'watch state' : 'episodes',
    year: media.startDate?.year ? Number(media.startDate.year) : media.seasonYear ? Number(media.seasonYear) : undefined,
    score: media.averageScore == null ? undefined : Number(media.averageScore) / 10,
    genres,
    themes,
    studio: media.studios?.nodes?.[0]?.name || undefined,
    source: 'AniList; episode titles: MyAnimeList/Jikan or Kitsu',
    season: media.season ? String(media.season) : undefined,
    duration: media.duration == null ? undefined : Number(media.duration),
    airStart: starts,
    airEnd: ends,
    favorite: false,
    characters: opts.characters,
    externalLinks: {
      malId: mal,
      officialUrl: undefined,
      newsUrl: 'https://anilist.co/anime/' + Number(media.id) + '/'
    }
  };
}

async function buildTask(task: Task, userId: string, library: MediaItem[], onProgress: (text: string) => void): Promise<CatalogueResult> {
  const found = await findRoot(task);
  const rootDetails = await fetchDetails(Number(found.id), true);
  const chosen: CatalogueMedia[] = [rootDetails];
  const warnings: string[] = [];
  const seen = new Set<number>([Number(rootDetails.id)]);
  const queue: Array<{ id: number; depth: number; parentId: number }> = [];
  const parentByMediaId = new Map<number, number>();
  if (task.relatedLimit > 0) {
    const relationEdges = rootDetails.relations?.edges || [];
    const eligibleEdges = task.key === 'naruto'
      ? relationEdges.filter(edge => edge.node && titleVariants(edge.node).some(value => value === normalizeText('Naruto Shippuden')))
      : relationEdges;
    for (const edge of eligibleEdges) {
      if (isEligibleRelation(task, edge) && Number(edge.node?.id) !== Number(rootDetails.id)) {
        queue.push({ id: Number(edge.node!.id), depth: 1, parentId: Number(rootDetails.id) });
      }
    }
  }
  while (queue.length && chosen.length < task.relatedLimit + 1) {
    const next = queue.shift()!;
    if (!next.id || seen.has(next.id)) continue;
    seen.add(next.id);
    try {
      const related = await fetchDetails(next.id, false);
      if (!isEligibleRelation(task, { relationType: 'SEQUEL', node: related })) continue;
      chosen.push(related);
      parentByMediaId.set(Number(related.id), next.parentId);
      if (next.depth < task.relationDepth) {
        for (const edge of related.relations?.edges || []) {
          const childId = Number(edge.node?.id);
          if (childId && !seen.has(childId) && isEligibleRelation(task, edge)) {
            queue.push({ id: childId, depth: next.depth + 1, parentId: Number(related.id) });
          }
        }
      }
      onProgress('Found ' + chosen.length + ' linked animated entries for ' + task.title + '.');
    } catch (error) {
      warnings.push('Related entry ID ' + next.id + ' could not be verified: ' + (error instanceof Error ? error.message : 'detail lookup failed') + '.');
    }
  }

  // Keep movies as media entries; build a complete titled episode list for each episodic release.
  const catalogues = new Map<number, { rows: EpisodeRow[]; verified: boolean; warnings: string[] }>();
  for (let index = 0; index < chosen.length; index++) {
    const media = chosen[index];
    onProgress('Checking episode titles for ' + preferredTitle(media) + ' (' + (index + 1) + '/' + chosen.length + ').');
    try {
      const catalogue = await episodeCatalogue(media);
      catalogues.set(Number(media.id), catalogue);
      warnings.push(...catalogue.warnings);
    } catch (error) {
      catalogues.set(Number(media.id), { rows: [], verified: false, warnings: [] });
      warnings.push(preferredTitle(media) + ': episode catalogue could not be read — ' + (error instanceof Error ? error.message : 'unknown source error') + '. No placeholder episodes were generated.');
    }
  }

  const rootExisting = library.find(x => !x.parentId && x.medium === 'anime' && (x.anilistId === Number(rootDetails.id) || titleVariants(rootDetails).includes(normalizeText(x.title))));
  const scope = userId.replace(/-/g, '').slice(0, 12);
  const rootId = rootExisting?.id || ('frame-anime-media-' + Number(rootDetails.id) + '-' + scope);
  const narutoPartFor = (media: CatalogueMedia) => task.key === 'naruto'
    ? library.find(x => x.parentId === rootId && x.sourceProvider === 'frame-naruto-part' && normalizeText(x.title) === normalizeText(preferredTitle(media)))
    : undefined;
  const itemIds = new Map<number, string>();
  for (let index = 0; index < chosen.length; index++) {
    const media = chosen[index];
    const existingEpisodes = catalogues.get(Number(media.id))?.rows || [];
    const existingNarutoPart = narutoPartFor(media);
    // Naruto's franchise root already owns explicit "Naruto" and "Naruto Shippuden"
    // subparts. Episode rows must be children of those parts, never of the root,
    // and the root must never be re-imported as its own child.
    const id = task.key === 'naruto'
      ? (existingNarutoPart?.id || ('frame-naruto-part-' + Number(media.id) + '-' + scope))
      : (index === 0 ? rootId : mediaIdFor(media, task, userId, library, false, rootId));
    itemIds.set(Number(media.id), id);
  }

  const incoming: MediaItem[] = [];
  const bleachArcIds = new Map<number, string>();
  if (task.key === 'bleach') {
    const bleachMedia = chosen[0];
    const bleachEpisodes = catalogues.get(Number(bleachMedia?.id))?.rows || [];
    for (const [order, name, start, end, summary] of BLEACH_ARCS) {
      const arcEpisodes = bleachEpisodes.filter(episode => episode.number >= start && episode.number <= end);
      // Keep the complete curated arc structure even if an upstream episode source
      // temporarily omits a range; source warnings still make an incomplete import visible.
      const arcId = 'frame-story-arc-bleach-' + String(order).padStart(2, '0') + '-' + scope;
      bleachArcIds.set(order, arcId);
      const existingArc = library.find(item => item.id === arcId);
      const poster = arcEpisodes.find(episode => episode.poster)?.poster || '';
      incoming.push({
        id: arcId,
        parentId: rootId,
        sourceProvider: 'frame-story-arc',
        externalId: 'frame-story-arc-bleach-' + String(order).padStart(2, '0'),
        title: name,
        description: summary,
        poster,
        backdrop: poster,
        medium: 'anime',
        status: existingArc?.status || 'planned',
        progress: Math.max(0, Number(existingArc?.progress) || 0),
        total: arcEpisodes.length,
        progressUnit: 'episodes',
        genres: existingArc?.genres || [],
        themes: existingArc?.themes || [],
        favorite: existingArc?.favorite || false,
        source: 'FRAME curated story arc',
        externalLinks: existingArc?.externalLinks || {}
      });
    }
  }
  // Add curated story arcs as children of their actual TV part. Arc totals are
  // deliberately derived from start/end ranges and never contribute to root totals.
  const curated = CURATED_ARCS[task.key] || [];
  for (const media of chosen) {
    const mediaTitle = normalizeText(preferredTitle(media));
    const candidates = curated.filter(arc => {
      const s = normalizeText(arc.season);
      const arcSeasonNumber = Number(s.match(/season (\\d+)/)?.[1] || 0);
      const mediaSeasonNumber = Number(
        mediaTitle.match(/(?:season|series|s) (\\d+)/)?.[1] ||
        mediaTitle.match(/(\\d+)(?:st|nd|rd|th) season/)?.[1] || 0
      );
      const finalSeason = s === 'final season' && (mediaTitle.includes('final season') || mediaTitle.includes('8th season') || mediaTitle.includes('8th season'));
      const firstChosenIsSeasonOne = Number(media.id) === Number(chosen[0]?.id) && arcSeasonNumber === 1;
      return mediaTitle.includes(s) ||
        (s === 'tv series' && mediaTitle.includes(normalizeText(task.title))) ||
        (arcSeasonNumber > 0 && mediaSeasonNumber === arcSeasonNumber) ||
        finalSeason ||
        firstChosenIsSeasonOne;
    });
    const mediaId = itemIds.get(Number(media.id));
    if (!mediaId) continue;
    for (let i = 0; i < candidates.length; i++) {
      const arc = candidates[i];
      const arcId = 'frame-story-arc-' + task.key + '-' + Number(media.id) + '-' + String(i + 1).padStart(2, '0');
      const existingArc = library.find(item => item.id === arcId);
      const count = arc.end - arc.start + 1;
      incoming.push({
        id: arcId,
        parentId: mediaId,
        sourceProvider: 'frame-story-arc',
        externalId: arcId,
        title: arc.name,
        description: arc.description + ' Episodes ' + arc.start + '–' + arc.end + ' of this part.',
        poster: String(media.coverImage?.extraLarge || ''),
        backdrop: String(media.bannerImage || media.coverImage?.extraLarge || ''),
        medium: 'anime',
        status: existingArc?.status || 'planned',
        progress: existingArc?.progress || 0,
        total: count,
        progressUnit: 'episodes',
        genres: existingArc?.genres || media.genres || [],
        themes: existingArc?.themes || [],
        studio: media.studios?.nodes?.[0]?.name,
        source: 'FRAME curated story arc',
        externalLinks: existingArc?.externalLinks || {}
      });
    }
  }

  if (task.key === 'my-hero-academia') {
    const existingSpecial = library.find(item => item.anilistId === 214886 || normalizeText(item.title) === normalizeText('My Hero Academia No. 170+1: More'));
    incoming.push({
      id: existingSpecial?.id || 'frame-mha-more-special-' + scope,
      parentId: rootId,
      sourceProvider: 'frame-anime-special',
      externalId: 'mha-more-431',
      anilistId: 214886,
      title: 'My Hero Academia No. 170+1: More',
      alternativeTitles: ['My Hero Academia: More', 'Boku no Hero Academia No. 170+1: More'],
      description: 'A 2026 television special adapting the post-finale chapter 431 story.',
      poster: String(rootDetails.coverImage?.extraLarge || ''),
      backdrop: String(rootDetails.bannerImage || rootDetails.coverImage?.extraLarge || ''),
      medium: 'anime',
      status: 'completed',
      progress: 1,
      total: 1,
      progressUnit: 'episodes',
      year: 2026,
      genres: rootDetails.genres || [],
      themes: [],
      studio: rootDetails.studios?.nodes?.[0]?.name,
      source: 'Manga',
      favorite: existingSpecial?.favorite || false,
      externalLinks: { officialUrl: 'https://www.heroaca.com/' }
    });
  }

  let franchiseEpisodes = 0;
  for (let index = 0; index < chosen.length; index++) {
    const media = chosen[index];
    const movie = MOVIE_FORMATS.has(String(media.format || ''));
    const catalogue = catalogues.get(Number(media.id)) || { rows: [], verified: false, warnings: [] };
    const episodes = movie ? [] : catalogue.rows;
    const id = itemIds.get(Number(media.id))!;
    const existingMedia = library.find(x =>
      x.id === id ||
      (x.anilistId === Number(media.id) && x.medium === (movie ? 'movie' : 'anime'))
    );
    // Never assume a new title or season is watched just because episode
    // metadata exists. Keep an existing entry's progress, otherwise start at 0.
    const confirmedCompleted = task.key === 'my-hero-academia' || task.key === 'summertime-rendering';
    const progress = confirmedCompleted
      ? Math.max(0, movie ? 1 : episodes.length)
      : Math.max(0, Number(existingMedia?.progress) || 0);
    const total = movie ? 1 : (task.key === 'my-hero-academia' && /final season/i.test(preferredTitle(media)) ? 11 : episodes.length);
    if (!movie) {
      franchiseEpisodes += total;
    }
    const mappedMedia = mapMediaItem(media, {
      id,
      parentId: task.key === 'naruto'
        ? rootId
        : index === 0
          ? undefined
          : (itemIds.get(parentByMediaId.get(Number(media.id)) ?? Number(rootDetails.id)) || rootId),
      progress,
      total,
      characters: index === 0 ? charactersFrom(rootDetails) : undefined
    });
    // Treat the existing TYBW Part 1 entry as an arc group too, so its
    // episodes remain inside the same ordered arc hierarchy after refresh.
    if (task.key === 'bleach' && Number(media.id) === 116674) {
      mappedMedia.sourceProvider = 'frame-story-arc';
      mappedMedia.externalId = 'frame-story-arc-bleach-17';
      mappedMedia.source = 'FRAME curated story arc';
    }
    incoming.push(mappedMedia);
    // FRAME's permanent anime model intentionally stores no individual episode rows.
    // Episode catalogues above are used only to verify released counts/totals; the UI
    // represents episodes through season/part totals and curated arc ranges.
  }

  // The root's progress represents the released episodes across its imported animated entries.
  const rootRow = incoming.find(x => x.id === rootId);
  if (rootRow && chosen.length > 1) {
    // Keep the user's established root-level tracking total stable. Related
    // seasons, specials and spin-offs remain individually tracked beneath it;
    // blindly summing every relation can inflate the main-series episode count.
    rootRow.total = Number(rootExisting?.total) > 0
      ? Math.min(2000, Number(rootExisting!.total))
      : Math.min(2000, franchiseEpisodes);
    rootRow.progress = (task.key === 'my-hero-academia' || task.key === 'summertime-rendering')
      ? rootRow.total
      : Math.min(Math.max(0, Number(rootExisting?.progress) || 0), rootRow.total || 0);
    if (task.key === 'my-hero-academia' || task.key === 'summertime-rendering') rootRow.status = 'completed';
    rootRow.customTotal = undefined;
    rootRow.description = clean(rootDetails.description);
  }
  const missingPosterTitles = chosen.filter(media => !String(media.coverImage?.extraLarge || '').trim()).map(preferredTitle);
  if (missingPosterTitles.length) warnings.push('Cover artwork unavailable from AniList for: ' + missingPosterTitles.join(', ') + '.');
  if (!String(rootDetails.coverImage?.extraLarge || '').trim()) warnings.push('Main poster URL is missing from AniList for ' + task.title + '.');
  const uniqueRows = new Map<string, MediaItem>();
  for (const item of incoming) {
    const key = item.sourceProvider === 'frame-anime-episode' ? String(item.externalId) : 'media:' + String(item.anilistId || item.id);
    uniqueRows.set(key, item);
  }
  const finalItems = [...uniqueRows.values()];
  const verified = !warnings.some(w => /reports \d+ episodes|upcoming AniList episode|no MyAnimeList ID|source problem|could not be read|could not be verified|missing episode posters|Main poster URL is missing|added \d+ numbered episode entries/i.test(w));
  return {
    items: finalItems,
    warnings: [...new Set(warnings)],
    summary: chosen.length + ' animated entries; no individual episode rows; ' + (verified ? 'catalogue checks passed' : 'catalogue needs another verification pass')
  };
}

export function FrameAnimeCatalogueImport({ userId, enabled, library, onImportBatch }: {
  userId?: string;
  enabled: boolean;
  library: MediaItem[];
  onImportBatch: (items: MediaItem[]) => Promise<boolean>;
}) {
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState('');
  const [processed, setProcessed] = useState(0);
  const storedProgress = useState<StoredProgress>(() => {
    if (!userId) return { completedKeys: [], warnings: {} };
    try {
      const raw = localStorage.getItem('frame-anime-catalogue:v2:' + userId);
      const parsed = raw ? JSON.parse(raw) as StoredProgress : null;
      return parsed && Array.isArray(parsed.completedKeys) ? { completedKeys: parsed.completedKeys, warnings: parsed.warnings || {}, updatedAt: parsed.updatedAt } : { completedKeys: [], warnings: {} };
    } catch { return { completedKeys: [], warnings: {} }; }
  })[0];
  const [completedKeys, setCompletedKeys] = useState<string[]>(storedProgress.completedKeys);
  const [warningsByTask, setWarningsByTask] = useState<Record<string, string[]>>(storedProgress.warnings);
  const libraryRef = useRef<MediaItem[]>(library);
  useEffect(() => { libraryRef.current = library; }, [library]);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState('');
  const autoStartedRef = useRef(false);

  const addLog = (message: string) => setLogs(prev => [message, ...prev].slice(0, 8));
  const persistCompleted = (keys: string[], warnings: Record<string, string[]>) => {
    setCompletedKeys(keys);
    if (!userId) return;
    try {
      const payload: StoredProgress = { completedKeys: keys, warnings, updatedAt: new Date().toISOString() };
      localStorage.setItem('frame-anime-catalogue:v2:' + userId, JSON.stringify(payload));
    } catch { /* Import still works when browser storage is unavailable. */ }
  };

  const runCatalogue = async (force = false) => {
    if (running) return;
    if (!enabled || !userId || !supabase) {
      setError('Sign in to FRAME before importing the anime catalogue.');
      return;
    }
    setRunning(true);
    setError('');
    setProcessed(0);
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data.user || data.user.id !== userId) throw new Error('The active FRAME account could not be verified. Sign in again and retry.');
      let done = force ? [] : [...completedKeys];
      let warningMap = force ? {} : { ...warningsByTask };
      if (force) persistCompleted([], {});
      for (let index = 0; index < TASKS.length; index++) {
        const task = TASKS[index];
        if (done.includes(task.key)) {
          setProcessed(index + 1);
          continue;
        }
        setCurrent(task.title);
        addLog('Starting ' + task.title + '…');
        try {
          const built = await buildTask(task, userId, libraryRef.current, message => setCurrent(task.title + ' · ' + message));
          const saved = await onImportBatch(built.items);
          if (!saved) throw new Error('FRAME could not save this batch. Existing entries were left in place; resume to retry.');
          const localRows = [...libraryRef.current];
          for (const imported of built.items) {
            const match = localRows.findIndex(existing =>
              Boolean(imported.anilistId && existing.anilistId === imported.anilistId && existing.medium === imported.medium) ||
              Boolean(imported.sourceProvider && imported.externalId && existing.sourceProvider === imported.sourceProvider && existing.externalId === imported.externalId) ||
              existing.id === imported.id
            );
            if (match < 0) localRows.push(imported);
            else {
              const existing = localRows[match];
              // Catalogue refreshes may replace source metadata, but must never
              // silently rewrite the user's own tracking state or reading notes.
              const customTotal = existing.customTotal ?? imported.customTotal;
              localRows[match] = {
                ...existing,
                ...imported,
                id: existing.id,
                parentId: imported.parentId === undefined && imported.sourceProvider === 'frame-anime-catalogue' ? undefined : (imported.parentId ?? existing.parentId),
                progress: existing.progress,
                status: existing.status,
                favorite: existing.favorite,
                personalRating: existing.personalRating,
                notes: existing.notes,
                customTotal,
                total: existing.customTotal != null ? existing.customTotal : imported.total
              };
            }
          }
          libraryRef.current = localRows;
          warningMap[task.key] = built.warnings;
          setWarningsByTask({ ...warningMap });
          const hasVerificationWarning = built.warnings.some(w => /reports \d+ episodes|upcoming AniList episode|no MyAnimeList ID|source problem|could not be read|could not be verified|missing episode posters|Main poster URL is missing|added \d+ numbered episode entries/i.test(w));
          if (!hasVerificationWarning) done = [...new Set([...done, task.key])];
          persistCompleted(done, warningMap);
          addLog(task.title + ': saved ' + built.summary + (built.warnings.length ? '; ' + built.warnings.length + ' warning(s).' : '.'));
          setProcessed(index + 1);
        } catch (taskError) {
          const message = taskError instanceof Error ? taskError.message : 'Unknown import error.';
          warningMap[task.key] = [message];
          setWarningsByTask({ ...warningMap });
          persistCompleted(done, warningMap);
          addLog(task.title + ': ' + message);
          setError(task.title + ' was not fully verified: ' + message);
          setProcessed(index + 1);
        }
      }
      const pending = TASKS.filter(task => !done.includes(task.key));
      setCurrent(pending.length ? 'Import paused with ' + pending.length + ' task(s) needing retry.' : 'All catalogue tasks passed source checks.');
      addLog(pending.length ? pending.length + ' task(s) remain incomplete or need source verification.' : 'All ' + TASKS.length + ' configured entries passed the importer checks.');
    } catch (authOrRunError) {
      const message = authOrRunError instanceof Error ? authOrRunError.message : 'The catalogue import could not start.';
      setError(message);
      setCurrent('Import stopped.');
      addLog(message);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (!enabled || !userId || running || autoStartedRef.current) return;
    const remaining = TASKS.some(task => !completedKeys.includes(task.key));
    if (!remaining) return;
    autoStartedRef.current = true;
    void runCatalogue(false);
  }, [enabled, userId, running, completedKeys]);

  const verifiedCount = completedKeys.filter(key =>
    TASKS.some(task => task.key === key) &&
    !(warningsByTask[key] || []).some(w => /added \d+ numbered episode entries|reports \d+ episodes|upcoming AniList episode|no MyAnimeList ID|source problem|could not be read|could not be verified|missing episode posters|Main poster URL is missing/i.test(w))
  ).length;
  const warningsCount = Object.values(warningsByTask).reduce((sum, list) => sum + list.length, 0);
  return <section className="anime-catalogue-import settings-panel settings-panel-wide" aria-label="Anime catalogue import">
    <div className="section-title">
      <div><small>CATALOGUE REPAIR</small><h2>Anime library import</h2><p>Fetch AniList metadata, related animated entries, character portraits, and source-verified episode counts without creating individual episode rows. Each completed franchise is saved separately so the import can resume after an interrupted session.</p></div>
    </div>
    {!enabled && <p className="muted">Sign in to import catalogue records into your account.</p>}
    <div className="anime-catalogue-import-status">
      <div><strong>{verifiedCount} / {TASKS.length}</strong><span>franchises verified</span></div>
      <div><strong>{warningsCount}</strong><span>recorded warnings</span></div>
      <div><strong>{processed} / {TASKS.length}</strong><span>tasks checked this run</span></div>
    </div>
    <div className="anime-catalogue-import-actions">
      <button type="button" className="primary" disabled={!enabled || running} onClick={() => void runCatalogue(false)}>{running ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />} {running ? 'Importing…' : 'Start / resume import'}</button>
      <button type="button" className="secondary" disabled={!enabled || running} onClick={() => void runCatalogue(true)}><RefreshCw size={15} /> Recheck all sources</button>
    </div>
    {current && <p className="anime-catalogue-import-current" role="status">{current}</p>}
    {error && <p className="anime-catalogue-import-error"><CircleAlert size={15} />{error}</p>}
    {logs.length > 0 && <div className="anime-catalogue-import-log" aria-label="Recent import log">{logs.map((line, i) => <p key={i}>{line}</p>)}</div>}
    <details className="anime-catalogue-import-manifest">
      <summary>Import manifest and verification status</summary>
      <div>{TASKS.map(task => {
        const done = completedKeys.includes(task.key);
        const issue = warningsByTask[task.key] || [];
        return <article key={task.key}>
          {done ? <CheckCircle2 size={15} /> : issue.length ? <CircleAlert size={15} /> : <span className="anime-catalogue-import-pending" />}
          <div><b>{task.title}</b><small>{done && (issue.length > 0) ? issue[0] : done ? 'Source-count checks passed' : issue.length ? issue[0] : 'Not verified yet'}</small></div>
        </article>;
      })}</div>
      <p className="muted">One Piece is intentionally not re-imported because its existing catalogue is the reference entry. Dragon Ball GT and Dragon Ball Daima are excluded by the importer.</p>
    </details>
    <p className="anime-catalogue-import-footnote">No individual episode rows are stored. Episode sources are used only to verify released totals; if AniList and the episode sources disagree, the task remains flagged. Images are sourced per title from AniList; unavailable source artwork is reported.</p>
  </section>;
}

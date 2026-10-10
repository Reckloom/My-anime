const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: HEADERS });
}
async function fetchJson(url: string, init: RequestInit = {}, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal, headers: { Accept: 'application/json', ...(init.headers || {}) } });
      const raw = await response.text();
      let data: any;
      try { data = JSON.parse(raw); } catch { throw new Error('The anime data provider returned an invalid response.'); }
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 900 * (attempt + 1)));
          continue;
        }
        throw new Error('Anime data provider returned HTTP ' + response.status + '.');
      }
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
    } finally { clearTimeout(timer); }
  }
  throw lastError instanceof Error ? lastError : new Error('The anime data provider could not be reached.');
}
const characterQuery = `query ($search: String!) { Character(search: $search, sort: SEARCH_MATCH) { name { full } image { large } description(asHtml: false) } }`;
async function character(name: string) {
  const data = await fetchJson('https://graphql.anilist.co', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: characterQuery, variables: { search: name } }),
  });
  const row = data?.data?.Character;
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!row?.name?.full || normalize(row.name.full) !== normalize(name)) return { name, image: '', description: '' };
  return { name, image: String(row.image?.large || ''), description: String(row.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() };
}
async function characters(names: unknown) {
  const list = Array.isArray(names) ? names.map(String).filter(Boolean).slice(0, 40) : [];
  const results: Array<{ name: string; image: string; description: string }> = [];
  for (let start = 0; start < list.length; start += 4) {
    const batch = list.slice(start, start + 4);
    const settled = await Promise.allSettled(batch.map(character));
    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      results.push(result.status === 'fulfilled' ? result.value : { name: batch[i], image: '', description: '' });
    }
  }
  return { characters: results, matched: results.filter(item => item.image).length, requested: list.length };
}
async function animeCharacters(anilistIdValue: unknown) {
  const anilistId = Number(anilistIdValue);
  if (!Number.isInteger(anilistId) || anilistId < 1 || anilistId > 2147483647) throw new Error('A valid AniList anime ID is required.');
  const query = `query ($id: Int!) { Media(id: $id, type: ANIME) { id title { romaji english native userPreferred } characters(page: 1, perPage: 24, sort: [ROLE]) { edges { role node { id name { full native } image { large } description(asHtml: false) siteUrl } } } } }`;
  const result = await fetchJson('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { id: anilistId } }),
  }, 3);
  const media = result?.data?.Media;
  if (!media) throw new Error('AniList returned no character catalogue for this anime.');
  const edges = Array.isArray(media?.characters?.edges) ? media.characters.edges : [];
  const mapped = edges.filter((edge: any) => edge?.node?.name?.full).map((edge: any) => ({
    id: Number(edge.node.id) || undefined,
    name: String(edge.node.name.full),
    nativeName: edge.node.name.native ? String(edge.node.name.native) : undefined,
    role: edge.role ? String(edge.role) : undefined,
    image: edge.node.image?.large ? String(edge.node.image.large) : undefined,
    description: edge.node.description ? String(edge.node.description).replace(/<br\s*\/?>(\s*)/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : undefined,
    sourceUrl: edge.node.siteUrl ? String(edge.node.siteUrl) : undefined,
  }));
  return { characters: mapped, matched: mapped.filter((item: any) => item.image).length, requested: mapped.length, source: 'AniList' };
}
async function searchAnime(query: string) {
  const cleanQuery = query.trim().slice(0, 120);
  if (!cleanQuery) throw new Error('Anime title is required.');
  const data = await fetchJson('https://api.jikan.moe/v4/anime?q=' + encodeURIComponent(cleanQuery) + '&limit=8', {}, 3);
  const results = Array.isArray(data?.data) ? data.data : [];
  return {
    results: results.map((item: any) => ({
      mal_id: Number(item.mal_id),
      title: String(item.title || ''),
      title_english: String(item.title_english || ''),
      title_japanese: String(item.title_japanese || ''),
    })).filter((item: any) => Number.isInteger(item.mal_id) && item.mal_id > 0),
    source: 'Jikan / MyAnimeList',
  };
}
async function episodePage(malIdValue: unknown, pageValue: unknown) {
  const malId = Number(malIdValue);
  const page = Number(pageValue);
  if (!Number.isInteger(malId) || malId < 1 || malId > 2147483647) throw new Error('A valid MyAnimeList anime ID is required.');
  if (!Number.isInteger(page) || page < 1 || page > 100) throw new Error('Episode page must be between 1 and 100.');
  const data = await fetchJson('https://api.jikan.moe/v4/anime/' + malId + '/episodes?page=' + page, {}, 3);
  return {
    data: Array.isArray(data?.data) ? data.data : [],
    pagination: {
      last_visible_page: Math.max(1, Number(data?.pagination?.last_visible_page || 1)),
      has_next_page: Boolean(data?.pagination?.has_next_page),
    },
    source: 'Jikan / MyAnimeList',
  };
}
async function episodes(anime: string) {
  const id = anime === 'naruto-shippuden' ? 1735 : anime === 'naruto' ? 20 : anime === 'one-piece' ? 21 : 0;
  if (!id) throw new Error('Unsupported anime series.');
  const all: any[] = [];
  let page = 1;
  let lastPage = 1;
  while (page <= lastPage && page <= 20) {
    const data = await fetchJson('https://api.jikan.moe/v4/anime/' + id + '/episodes?page=' + page, {}, 3);
    const rows = Array.isArray(data?.data) ? data.data : [];
    all.push(...rows);
    lastPage = Math.max(1, Math.min(20, Number(data?.pagination?.last_visible_page || 1)));
    page++;
    if (page <= lastPage) await new Promise(resolve => setTimeout(resolve, 350));
  }
  const clean = all.map((item: any) => ({
    number: Number(item.mal_id), mal_id: Number(item.mal_id), title: String(item.title || item.title_english || '').trim(),
    airDate: item.aired?.from ? String(item.aired.from).slice(0, 10) : '', aired: item.aired || null,
    synopsis: String(item.synopsis || '').trim(),
    image: String(item.images?.jpg?.image_url || item.images?.webp?.image_url || ''),
    images: item.images || {}, url: String(item.url || ''), score: Number(item.score) || null,
    ratingSource: 'MyAnimeList / Jikan',
  })).filter((item: any) => Number.isInteger(item.number) && item.number > 0 && item.title);
  if (!clean.length) throw new Error('The anime provider returned no episode records.');
  return { anime, episodes: clean, total: clean.length, source: 'Jikan / MyAnimeList' };
}
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: HEADERS });
  if (request.method !== 'POST') return json({ error: 'POST required.' }, 405);
  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON request.' }, 400); }
  try {
    const action = String(body?.action || '');
    if (action === 'characters') return json(await characters(body?.names));
    if (action === 'anime-characters') return json(await animeCharacters(body?.anilistId));
    if (action === 'search') return json(await searchAnime(String(body?.query || '')));
    if (action === 'episode-page') return json(await episodePage(body?.malId, body?.page));
    if (action === 'episodes') return json(await episodes(String(body?.anime || '')));
    return json({ error: 'Unsupported anime catalogue action.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Anime catalogue request failed.' }, 502);
  }
});

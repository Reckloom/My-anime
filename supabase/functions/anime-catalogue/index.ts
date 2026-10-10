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
  return { name, image: String(row.image?.large || ''), description: String(row.description || '').replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim() };
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
async function episodes(anime: string) {
  const id = anime === 'naruto-shippuden' ? 1735 : anime === 'naruto' ? 20 : 0;
  if (!id) throw new Error('Unsupported Naruto series.');
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
    number: Number(item.mal_id), title: String(item.title || item.title_english || '').trim(),
    airDate: item.aired?.from ? String(item.aired.from).slice(0, 10) : '',
    synopsis: String(item.synopsis || '').trim(),
    image: String(item.images?.jpg?.image_url || item.images?.webp?.image_url || ''),
    url: String(item.url || ''), score: null,
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
    if (action === 'episodes') return json(await episodes(String(body?.anime || '')));
    return json({ error: 'Unsupported anime catalogue action.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Anime catalogue request failed.' }, 502);
  }
});

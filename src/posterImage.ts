const DEFAULT_SUPABASE_URL = 'https://blwnhfhpckqbetwxamqr.supabase.co';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL).replace(/\/$/, '');

export function posterImageSrc(value?: string | null): string {
  const url = String(value || '').trim();
  if (!url) return '/frame-logo.svg';

  try {
    const parsed = new URL(url);
    const wikiEpisodeArtwork =
      parsed.protocol === 'https:' &&
      parsed.hostname === 'static.wikia.nocookie.net' &&
      parsed.pathname.startsWith('/onepiece/images/');
    const officialEpisodeArtwork =
      parsed.protocol === 'https:' &&
      parsed.hostname === 'one-piece.com' &&
      (/^\/img\/anime\/story\/img_story_\d+\.jpg$/i.test(parsed.pathname) ||
       /^\/o\/assets\/images\/anime\/tvstory\/[a-z0-9_-]+\/story_img_\d+\.jpg$/i.test(parsed.pathname));
    const vodAnimeEpisodeArtwork =
      parsed.protocol === 'https:' &&
      parsed.hostname === 'www.vodanime.com' &&
      /^\/media\/one-piece-episode-\d+-thumbnail-\d+\.jpg$/i.test(parsed.pathname);
    const idnEpisodeArtwork =
      parsed.protocol === 'https:' &&
      parsed.hostname === 'image.idn.media' &&
      /\.(?:jpe?g|png|webp|avif)$/i.test(parsed.pathname);
    if (wikiEpisodeArtwork || officialEpisodeArtwork || vodAnimeEpisodeArtwork || idnEpisodeArtwork) {
      return supabaseUrl + '/functions/v1/media-discovery?action=proxy-image&url=' + encodeURIComponent(parsed.href);
    }
    return url;
  } catch {
    return '/frame-logo.svg';
  }
}

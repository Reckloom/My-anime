const DEFAULT_SUPABASE_URL = 'https://blwnhfhpckqbetwxamqr.supabase.co';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL).replace(/\/$/, '');

export function posterImageSrc(value?: string | null): string {
  const url = String(value || '').trim();
  if (!url) return '/frame-logo.svg';

  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'static.wikia.nocookie.net' &&
      parsed.pathname.startsWith('/onepiece/images/')
    ) {
      return supabaseUrl + '/functions/v1/media-discovery?action=proxy-image&url=' + encodeURIComponent(parsed.href);
    }
    return url;
  } catch {
    return '/frame-logo.svg';
  }
}

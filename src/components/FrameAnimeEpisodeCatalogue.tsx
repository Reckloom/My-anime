import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { MediaItem } from '../types';

const PAGE_SIZE = 100;
const episodeNumber = (item: MediaItem) => {
  const match = String(item.externalId || '').match(/:episode:(\d+)$/);
  return Number(match?.[1] || item.episode?.episodeNumber || 0);
};

export function FrameAnimeEpisodeCatalogue({ title, episodes, onOpen }: {
  title: string;
  episodes: MediaItem[];
  onOpen: (item: MediaItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const sorted = useMemo(() => [...episodes].sort((a, b) => episodeNumber(a) - episodeNumber(b)), [episodes]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return sorted;
    return sorted.filter(item => [item.title, item.description, item.externalId, item.episode?.episodeCode, String(episodeNumber(item))].join(' ').toLocaleLowerCase().includes(q));
  }, [query, sorted]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const shown = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  if (!episodes.length) return null;
  return <section className="frame-anime-episode-catalogue detail-section" aria-label={title + ' episode catalogue'}>
    <div className="detail-section-head">
      <div><small>VERIFIED EPISODE CATALOGUE</small><h3>Episodes</h3></div>
      <span>{episodes.length.toLocaleString()} stored</span>
    </div>
    <div className="frame-anime-episode-tools">
      <label><Search size={15}/><input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Search episode number or title…" aria-label="Search episode number or title"/></label>
      <span>Showing {shown.length ? ((safePage - 1) * PAGE_SIZE + 1).toLocaleString() : '0'}–{Math.min(safePage * PAGE_SIZE, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}</span>
    </div>
    {shown.length ? <div className="frame-anime-episode-rows">
      {shown.map(item => <button type="button" className="frame-anime-episode-row" key={item.id} onClick={() => onOpen(item)}>
        <span className="frame-anime-episode-number">{String(episodeNumber(item)).padStart(3, '0')}</span>
        <span className="frame-anime-episode-copy"><b>{item.title.replace(/^Episode\s+\d+\s*[—–-]\s*/i, '')}</b><small>{item.episode?.airDate || 'Air date unavailable'} · {item.episode?.ratingSource || item.source || 'Catalogue title'}{item.episode?.episodeCode ? ' · ' + item.episode.episodeCode : ''}</small></span>
        <span className="frame-anime-episode-status">{item.status === 'completed' ? 'Watched' : 'Released'}</span>
        <ChevronRight size={15}/>
      </button>)}
    </div> : <p className="muted frame-anime-episode-empty">No episodes match that search.</p>}
    {pageCount > 1 && <div className="frame-anime-episode-pagination">
      <button type="button" className="secondary" disabled={safePage <= 1} onClick={() => setPage(1)}>First</button>
      <button type="button" className="secondary" disabled={safePage <= 1} onClick={() => setPage(v => Math.max(1, v - 1))}><ChevronLeft size={14}/> Previous</button>
      <span>Page {safePage} of {pageCount}</span>
      <button type="button" className="secondary" disabled={safePage >= pageCount} onClick={() => setPage(v => Math.min(pageCount, v + 1))}>Next <ChevronRight size={14}/></button>
      <button type="button" className="secondary" disabled={safePage >= pageCount} onClick={() => setPage(pageCount)}>Last</button>
    </div>}
    <p className="frame-anime-episode-footnote">Episode titles were imported from the episode source shown in each row. Only rows with a source title are included.</p>
  </section>;
}

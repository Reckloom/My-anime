import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { MediaItem } from '../types';
import { FrameArtwork } from './FrameArtwork';

const PAGE_SIZE = 100;

const episodeNumber = (item: MediaItem) => {
  const externalId = String(item.externalId || '');
  const match = externalId.match(/:episode:(\d+)$/)
    || externalId.match(/^one-piece-episode-(\d+)$/i)
    || externalId.match(/^naruto-episode-(\d+)$/i)
    || externalId.match(/^frame-anime-episode-\d+-(\d+)-/i);
  if (match?.[1]) return Number(match[1]);
  if (item.episode?.episodeNumber) return Number(item.episode.episodeNumber);
  const titleNumber = item.title.match(/^Episode\s+(\d+)/i);
  return Number(titleNumber?.[1] || 0);
};

export function FrameAnimeEpisodeCatalogue({ title, episodes, parentPoster, parentTitle, parentAnilistId, onOpen }: {
  title: string;
  episodes: MediaItem[];
  parentPoster?: string;
  parentTitle?: string;
  parentAnilistId?: number;
  onOpen: (item: MediaItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [watchFilter, setWatchFilter] = useState<'all' | 'watched' | 'unwatched'>('all');
  const [minEpisode, setMinEpisode] = useState('');
  const [maxEpisode, setMaxEpisode] = useState('');
  const sorted = useMemo(() => [...episodes].sort((a, b) => episodeNumber(a) - episodeNumber(b)), [episodes]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const min = minEpisode === '' ? null : Number(minEpisode);
    const max = maxEpisode === '' ? null : Number(maxEpisode);
    return sorted.filter(item => {
      const number = episodeNumber(item);
      const watched = item.status === 'completed';
      const matchesQuery = !q || [item.title, item.description, item.externalId, item.episode?.episodeCode, String(number)].join(' ').toLocaleLowerCase().includes(q);
      const matchesWatch = watchFilter === 'all' || (watchFilter === 'watched' ? watched : !watched);
      const matchesMin = min === null || (!Number.isNaN(min) && number >= min);
      const matchesMax = max === null || (!Number.isNaN(max) && number <= max);
      return matchesQuery && matchesWatch && matchesMin && matchesMax;
    });
  }, [maxEpisode, minEpisode, query, sorted, watchFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const shown = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  if (!episodes.length) return null;
  return <section className="frame-anime-episode-catalogue detail-section" aria-label={title + ' episode catalogue'}>
    <div className="detail-section-head">
      <div><small>ARC EPISODES</small><h3>Episodes & details</h3></div>
      <span>{episodes.length.toLocaleString()} stored</span>
    </div>
    <div className="frame-anime-episode-tools">
      <label><Search size={15}/><input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Search episode number or title…" aria-label="Search episode number or title"/></label>
      <div className="frame-anime-episode-filters" aria-label="Episode filters">
        <label><span>Watch</span><select value={watchFilter} onChange={e => { setWatchFilter(e.target.value as typeof watchFilter); setPage(1); }}><option value="all">All</option><option value="watched">Watched</option><option value="unwatched">Unwatched</option></select></label>
        <label><span>From</span><input type="number" min="1" inputMode="numeric" value={minEpisode} onChange={e => { setMinEpisode(e.target.value); setPage(1); }} placeholder="1" aria-label="Minimum episode number"/></label>
        <span className="frame-anime-episode-range-separator">–</span>
        <label><span>To</span><input type="number" min="1" inputMode="numeric" value={maxEpisode} onChange={e => { setMaxEpisode(e.target.value); setPage(1); }} placeholder="∞" aria-label="Maximum episode number"/></label>
      </div>
      <span>Showing {shown.length ? ((safePage - 1) * PAGE_SIZE + 1).toLocaleString() : '0'}–{Math.min(safePage * PAGE_SIZE, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}</span>
    </div>
    {shown.length ? <div className="frame-anime-arc-groups">
      <details className="frame-anime-arc-group" open>
        <summary className="frame-anime-arc-heading">
          <span className="frame-anime-arc-cover">{shown[0]&&<FrameArtwork title={shown[0].title} medium={shown[0].medium} poster={shown[0].poster} parentPoster={parentPoster} parentTitle={parentTitle || title} parentMedium="anime" parentAnilistId={parentAnilistId} sourceProvider={shown[0].sourceProvider} externalId={shown[0].externalId} className="frame-episode-artwork" alt="" loading="lazy"/>}</span>
          <span className="frame-anime-arc-copy"><b>Episodes</b><small>Episode metadata and artwork from your stored catalogue.</small><small>{filtered.length.toLocaleString()} episode{filtered.length===1?'':'s'}</small></span>
          <ChevronRight size={17}/>
        </summary>
        <div className="frame-anime-episode-rows" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:12}}>
          {shown.map(item => <button type="button" className="frame-anime-episode-row" key={item.id} onClick={() => onOpen(item)} style={{display:'flex',flexDirection:'column',alignItems:'stretch',gap:8,textAlign:'left',padding:10,minWidth:0,height:'100%'}}>
            <span style={{position:'relative',display:'block',width:'100%',aspectRatio:'16 / 9',overflow:'hidden',borderRadius:10,background:'var(--surface, #171717)'}}>
              <FrameArtwork title={item.title} medium={item.medium} poster={item.poster} anilistId={item.anilistId} parentPoster={parentPoster} parentTitle={parentTitle || title} parentMedium="anime" parentAnilistId={parentAnilistId} sourceProvider={item.sourceProvider} externalId={item.externalId} className="frame-episode-artwork" alt={item.title} loading="lazy" />
              <span className="frame-anime-episode-number" style={{position:'absolute',left:8,top:8}}>{String(episodeNumber(item)).padStart(3, '0')}</span>
            </span>
            <span className="frame-anime-episode-copy" style={{display:'flex',flexDirection:'column',gap:5,minWidth:0}}><b>{item.title.replace(/^Episode\s*\d+\s*[—–-]?\s*/i, '') || item.title}</b><small>{item.episode?.airDate || 'Air date unavailable'} · {item.episode?.ratingSource || item.source || 'Episode details'}{item.episode?.episodeCode ? ' · ' + item.episode.episodeCode : ''}</small><small>{item.description || item.episode?.synopsis || 'Open episode details to view or edit its metadata.'}</small></span>
            <span className="frame-anime-episode-status">{item.status === 'completed' ? 'Watched' : 'Unwatched'} <ChevronRight size={13}/></span>
          </button>)}
        </div>
      </details>
    </div> : <p className="muted frame-anime-episode-empty">No episodes match that search.</p>}
    {pageCount > 1 && <div className="frame-anime-episode-pagination">
      <button type="button" className="secondary" disabled={safePage <= 1} onClick={() => setPage(1)}>First</button>
      <button type="button" className="secondary" disabled={safePage <= 1} onClick={() => setPage(v => Math.max(1, v - 1))}><ChevronLeft size={14}/> Previous</button>
      <span>Page {safePage} of {pageCount}</span>
      <button type="button" className="secondary" disabled={safePage >= pageCount} onClick={() => setPage(v => Math.min(pageCount, v + 1))}>Next <ChevronRight size={14}/></button>
      <button type="button" className="secondary" disabled={safePage >= pageCount} onClick={() => setPage(pageCount)}>Last</button>
    </div>}
    <p className="frame-anime-episode-footnote">Episode titles, dates and artwork are shown only when supplied by the stored catalogue. No episode data is invented.</p>
  </section>;
}

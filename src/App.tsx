import { useEffect, useMemo, useState } from 'react';
import { Menu, Plus, Search, Heart, Play, X, Pencil, Save, Star, Film, Library as LibraryIcon, Compass, CalendarDays, BarChart3, Settings, Trash2, CheckCircle2, AlertCircle, Loader2, ArrowUpDown } from 'lucide-react';
import { starterLibrary } from './data';
import { signOut, useAuth } from './auth/Auth';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import type { MediaItem, Status, Medium } from './types';
import { AniListSearch } from './components/AniListSearch';

const STORE = 'frame-my-anime-v1';
type SortMode = 'recent' | 'title' | 'progress' | 'rating';
const statuses: Status[] = ['watching', 'completed', 'planned', 'paused', 'dropped'];
const mediaTypes: Medium[] = ['anime', 'manga', 'manhwa', 'light-novel', 'visual-novel', 'movie', 'series'];

function initial() {
  try { const x = localStorage.getItem(STORE); return x ? JSON.parse(x) as MediaItem[] : starterLibrary; }
  catch { return starterLibrary; }
}
function labelStatus(s: Status) { return s === 'planned' ? 'Plan to Watch' : s[0].toUpperCase() + s.slice(1); }
function labelMedium(s: Medium) { return s.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()); }

function fromRow(row: Record<string, unknown>): MediaItem {
  const meta = (row.media_metadata && typeof row.media_metadata === 'object' ? row.media_metadata : {}) as Record<string, unknown>;
  const value = (key: string, legacy = key) => meta[key] ?? row[legacy];
  return {
    id: String(row.id), parentId: row.parent_id ? String(row.parent_id) : undefined,
    metadataId: row.metadata_id ? String(row.metadata_id) : undefined,
    anilistId: row.anilist_id == null ? undefined : Number(row.anilist_id),
    title: String(value('title') ?? ''), alternativeTitles: Array.isArray(meta.alternative_titles) ? meta.alternative_titles.map(String) : [],
    description: String(value('description') ?? ''), poster: String(value('poster') ?? ''), backdrop: String(value('backdrop') ?? ''),
    medium: row.medium as Medium, status: row.status as Status, progress: Number(row.progress ?? 0),
    total: value('episodes', 'total') == null ? undefined : Number(value('episodes', 'total')),
    year: value('year') == null ? undefined : Number(value('year')), score: value('score') == null ? undefined : Number(value('score')),
    genres: Array.isArray(value('genres')) ? (value('genres') as unknown[]).map(String) : [],
    themes: Array.isArray(value('themes')) ? (value('themes') as unknown[]).map(String) : [],
    studio: value('studio') ? String(value('studio')) : undefined, source: value('source') ? String(value('source')) : undefined,
    season: meta.season ? String(meta.season) : undefined, duration: meta.duration == null ? undefined : Number(meta.duration),
    airStart: meta.air_start ? String(meta.air_start) : undefined, airEnd: meta.air_end ? String(meta.air_end) : undefined,
    favorite: Boolean(row.favorite), notes: row.notes ? String(row.notes) : undefined,
    nextRelease: row.next_release ? String(row.next_release) : undefined,
    nextReleaseNumber: row.next_release_number == null ? undefined : Number(row.next_release_number),
  };
}
function toRow(item: MediaItem, userId: string) {
  return {
    id: item.id, user_id: userId, parent_id: item.parentId ?? null, metadata_id: item.metadataId ?? null, anilist_id: item.anilistId ?? null, title: item.title.trim(),
    description: item.description ?? '', poster: item.poster ?? '', backdrop: item.backdrop ?? '',
    medium: item.medium, status: item.status, progress: Math.max(0, Math.min(2000, Math.round(item.progress || 0))),
    total: item.total == null ? null : Math.max(0, Math.round(item.total)), year: item.year ?? null,
    score: item.score ?? null, genres: item.genres ?? [], themes: item.themes ?? [], studio: item.studio ?? null,
    source: item.source ?? null, favorite: Boolean(item.favorite), notes: item.notes ?? null,
    next_release: item.nextRelease ?? null, next_release_number: item.nextReleaseNumber ?? null,
  };
}

export default function App() {
  const { user } = useAuth();
  const [items, setItems] = useState<MediaItem[]>(initial);
  const [page, setPage] = useState('home');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [medium, setMedium] = useState<Medium | 'all'>('all');
  const [sort, setSort] = useState<SortMode>('recent');
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [menu, setMenu] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [aniSearchOpen, setAniSearchOpen] = useState(false);

  useEffect(() => {
    if (!supabase || !user) { setLoading(false); return; }
    let active = true;
    setLoading(true); setError('');
    supabase.from('media_items').select('*,media_metadata(*)').order('created_at', { ascending: false }).then(({ data, error: e }) => {
      if (!active) return;
      if (e) setError(e.message);
      else setItems((data ?? []).map(fromRow));
      setLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  const persistLocal = (next: MediaItem[]) => { setItems(next); localStorage.setItem(STORE, JSON.stringify(next)); };
  const saveCloud = async (item: MediaItem) => {
    if (!supabase || !user) return;
    const { data, error: e } = await supabase.from('media_items').upsert(toRow(item, user.id), { onConflict: 'id' }).select('*,media_metadata(*)').single();
    if (e) throw e;
    return fromRow(data);
  };
  const update = async (item: MediaItem) => {
    setError(''); setNotice('');
    try {
      if (supabase && user) {
        const saved = await saveCloud(item);
        setItems(prev => prev.map(i => i.id === item.id ? saved! : i));
        setSelected(saved!); setNotice('Changes saved.');
      } else {
        persistLocal(items.map(i => i.id === item.id ? item : i)); setSelected(item); setNotice('Saved locally. Configure Supabase for cloud storage.');
      }
      setEditMode(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save changes.'); }
  };
  const add = async (item: MediaItem) => {
    setError(''); setNotice('');
    try {
      if (supabase && user) {
        const saved = await saveCloud(item);
        setItems(prev => [saved!, ...prev]); setSelected(saved!); setNotice('Added to your library.');
      } else {
        persistLocal([item, ...items]); setSelected(item); setNotice('Added locally. Configure Supabase for cloud storage.');
      }
      setAddMode(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add media.'); }
  };
  const remove = async (item: MediaItem) => {
    if (!window.confirm(`Delete “${item.title}” from your library?`)) return;
    setError(''); setNotice('');
    try {
      if (supabase && user) {
        const { error: e } = await supabase.from('media_items').delete().eq('id', item.id);
        if (e) throw e;
      }
      const next = items.filter(i => i.id !== item.id && i.parentId !== item.id);
      if (!supabase || !user) persistLocal(next); else setItems(next);
      setSelected(null); setEditMode(false); setNotice('Removed from your library.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete media.'); }
  };

  const filtered = useMemo(() => {
    const normalized = q.trim().toLowerCase();
    return items.filter(x =>
      (!normalized || [x.title, x.description, ...x.genres, ...x.themes].join(' ').toLowerCase().includes(normalized)) &&
      (status === 'all' || x.status === status) && (medium === 'all' || x.medium === medium)
    ).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'progress' ? b.progress - a.progress : sort === 'rating' ? (b.score ?? -1) - (a.score ?? -1) : 0);
  }, [items, q, status, medium, sort]);
  const roots = items.filter(x => !x.parentId);
  const stats = { total: roots.length, watching: items.filter(x => x.status === 'watching').length, completed: items.filter(x => x.status === 'completed').length, favorites: items.filter(x => x.favorite).length };

  const defaultItem: MediaItem = { id: crypto.randomUUID(), title: '', description: '', poster: '', backdrop: '', medium: 'anime', status: 'planned', progress: 0, genres: [], themes: [], favorite: false };

  return <div className="app">
    <header className="top"><button className="icon" onClick={() => setMenu(true)}><Menu /></button><button className="logo" onClick={() => setPage('home')}><b>F</b>FRAME</button>
      <nav><button className={page === 'home' ? 'on' : ''} onClick={() => setPage('home')}>Home</button><button className={page === 'library' ? 'on' : ''} onClick={() => setPage('library')}>Library</button><button className={page === 'discover' ? 'on' : ''} onClick={() => setPage('discover')}>Discover</button><button className={page === 'calendar' ? 'on' : ''} onClick={() => setPage('calendar')}>Release Radar</button></nav>
      <div className="topright"><div className="search"><Search size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search library" /></div><button className="add" onClick={() => setAniSearchOpen(true)}><Search size={17} />Find media</button><button className="add" onClick={() => { setAddMode(true); setError(''); }}><Plus size={17} />Add</button></div>
    </header>
    {notice && <div className="toast success"><CheckCircle2 size={15} />{notice}<button onClick={() => setNotice('')}><X size={13}/></button></div>}
    {error && <div className="toast error"><AlertCircle size={15} />{error}<button onClick={() => setError('')}><X size={13}/></button></div>}
    {loading ? <Loading /> : <>
      {page === 'home' && <Home items={items} stats={stats} open={setSelected} />}
      {page === 'library' && <LibraryPage items={filtered} q={q} setQ={setQ} status={status} setStatus={setStatus} medium={medium} setMedium={setMedium} sort={sort} setSort={setSort} open={setSelected} />}
      {page === 'discover' && <Discover open={setSelected} />}
      {page === 'calendar' && <Calendar items={items} />}
      {page === 'stats' && <Stats stats={stats} />}
    </>}
    <div className="mobilebar"><button onClick={() => setPage('home')}><Film />Home</button><button onClick={() => setPage('library')}><LibraryIcon />Library</button><button onClick={() => setPage('discover')}><Compass />Discover</button><button onClick={() => setPage('stats')}><BarChart3 />Stats</button></div>
    {selected && <Drawer item={selected} parts={items.filter(x => x.parentId === selected.id)} close={() => setSelected(null)} edit={() => setEditMode(true)} update={update} remove={() => void remove(selected)} />}
    {editMode && selected && <Editor item={selected} close={() => setEditMode(false)} save={update} />}
    {addMode && <Editor item={defaultItem} close={() => setAddMode(false)} save={add} isNew />}
    {menu && <MenuPanel close={() => setMenu(false)} page={page} setPage={setPage} />}
    {aniSearchOpen && <AniListSearch close={() => setAniSearchOpen(false)} onImported={() => { setAniSearchOpen(false); window.location.reload(); }} />}
  </div>;
}

function Loading() { return <main className="state"><Loader2 className="spin" /><h2>Loading your library</h2><p>Syncing your private FRAME collection…</p></main> }
function Home({ items, stats, open }: { items: MediaItem[]; stats: { total: number; watching: number; completed: number; favorites: number }; open: (x: MediaItem) => void }) {
  const hero = items.find(x => x.id === 'aot') || items[0];
  if (!hero) return <Empty title="Your FRAME is empty." text="Add your first piece of media to start building your library." />;
  return <main><section className="hero" style={{ backgroundImage: `linear-gradient(90deg,#09090df5 5%,#09090d88 55%,transparent),url(${hero.backdrop})` }}><div><small>YOUR MEDIA UNIVERSE</small><h1>{hero.title}</h1><p>{hero.description}</p><div className="meta"><span><Star /> {hero.score ?? '—'}</span><span>{hero.year ?? '—'}</span><span>{labelMedium(hero.medium)}</span><span>{labelStatus(hero.status)}</span></div><button className="primary" onClick={() => open(hero)}><Play fill="currentColor" />Open details</button></div></section><div className="stats"><Stat n={stats.total} t="Series" /><Stat n={stats.watching} t="Watching" /><Stat n={stats.completed} t="Completed" /><Stat n={stats.favorites} t="Favorites" /></div><Shelf title="Continue watching" items={items.filter(x => x.status === 'watching')} open={open} /><Shelf title="Favorites" items={items.filter(x => x.favorite)} open={open} /><Shelf title="Your library" items={items.filter(x => !x.parentId)} open={open} /></main>;
}
function Stat({ n, t }: { n: number; t: string }) { return <div><b>{n}</b><span>{t}</span></div> }
function Shelf({ title, items, open }: { title: string; items: MediaItem[]; open: (x: MediaItem) => void }) { return <section className="shelf"><div className="heading"><h2>{title}</h2><span>{items.length}</span></div>{items.length ? <div className="cards">{items.map(x => <Card key={x.id} item={x} open={open} />)}</div> : <p className="muted">Nothing here yet.</p>}</section> }
function Card({ item, open }: { item: MediaItem; open: (x: MediaItem) => void }) { return <button className="card" onClick={() => open(item)}><img src={item.poster || 'https://placehold.co/700x1000/111116/777?text=FRAME'} /><strong>{item.title || 'Untitled'}</strong><small>{item.progress}{item.total ? '/' + item.total : ''} · {labelStatus(item.status)}</small>{item.favorite && <Heart className="heart" fill="currentColor" />}</button> }

function LibraryPage({ items, q, setQ, status, setStatus, medium, setMedium, sort, setSort, open }: { items: MediaItem[]; q: string; setQ: (x: string) => void; status: Status | 'all'; setStatus: (x: Status | 'all') => void; medium: Medium | 'all'; setMedium: (x: Medium | 'all') => void; sort: SortMode; setSort: (x: SortMode) => void; open: (x: MediaItem) => void }) {
  return <main className="page"><small>YOUR LIBRARY</small><h1>Everything you follow.</h1><div className="library-toolbar"><div className="search library-search"><Search size={16}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title, genres, notes…" /></div><div className="filters"><select value={status} onChange={e => setStatus(e.target.value as Status | 'all')}><option value="all">All status</option>{statuses.map(x => <option key={x} value={x}>{labelStatus(x)}</option>)}</select><select value={medium} onChange={e => setMedium(e.target.value as Medium | 'all')}><option value="all">All media</option>{mediaTypes.map(x => <option key={x} value={x}>{labelMedium(x)}</option>)}</select><select value={sort} onChange={e => setSort(e.target.value as SortMode)}><option value="recent">Recently added</option><option value="title">Title</option><option value="progress">Progress</option><option value="rating">Rating</option></select><ArrowUpDown size={15}/></div></div>{items.length ? <div className="grid">{items.map(x => <Card key={x.id} item={x} open={open} />)}</div> : <Empty title="No matching media." text="Try another search or filter, or add something new." />}</main>;
}
function Empty({ title, text }: { title: string; text: string }) { return <main className="state"><LibraryIcon /><h2>{title}</h2><p>{text}</p></main> }
function Discover({ open }: { open: (x: MediaItem) => void }) { return <main className="page"><small>DISCOVER</small><h1>Find your next obsession.</h1><p className="muted">Use <b>Find media</b> in the header to search the live AniList catalogue and import titles with their metadata.</p><div className="discover">{starterLibrary.filter(x => !x.parentId).map(x => <button key={x.id} onClick={() => open(x)} style={{ backgroundImage: `linear-gradient(0deg,#000e,transparent),url(${x.backdrop})` }}><div><small>{labelMedium(x.medium)}</small><h2>{x.title}</h2><span>{x.genres.join(' · ')}</span></div></button>)}</div></main> }
function Calendar({ items }: { items: MediaItem[] }) { return <main className="page"><small>RELEASE RADAR</small><h1>Never miss what comes next.</h1><div className="releases">{items.filter(x => x.status === 'watching').map(x => <div key={x.id}><img src={x.poster}/><section><b>{x.title}</b><span>{x.nextReleaseNumber ? 'Episode ' + x.nextReleaseNumber : 'Tracking ready'}</span><small>{x.nextRelease || 'Release tracking will be connected in a later phase.'}</small></section><CalendarDays /></div>)}</div></main> }
function Stats({ stats }: { stats: { total: number; watching: number; completed: number; favorites: number } }) { return <main className="page"><small>STATISTICS</small><h1>Your media, measured.</h1><div className="bigstats"><Stat n={stats.total} t="Library" /><Stat n={stats.watching} t="Watching" /><Stat n={stats.completed} t="Completed" /><Stat n={stats.favorites} t="Favorites" /></div></main> }

function Drawer({ item, parts, close, edit, update, remove }: { item: MediaItem; parts: MediaItem[]; close: () => void; edit: () => void; update: (x: MediaItem) => Promise<void>; remove: () => void }) {
  const [savingFavorite, setSavingFavorite] = useState(false);
  const toggleFavorite = async () => { setSavingFavorite(true); await update({ ...item, favorite: !item.favorite }); setSavingFavorite(false); };
  return <div className="overlay"><aside className="drawer"><button className="close" onClick={close}><X /></button><div className="cover" style={{ backgroundImage: `linear-gradient(0deg,#111116,transparent),url(${item.backdrop})` }} /><div className="detail"><img src={item.poster || 'https://placehold.co/700x1000/111116/777?text=FRAME'} /><div><small>{labelMedium(item.medium)} · {labelStatus(item.status)}</small><h1>{item.title}</h1><p>{item.description}</p>{item.notes && <div className="notes"><b>Notes</b><p>{item.notes}</p></div>}<div className="tags">{item.genres.map(x => <span key={x}>{x}</span>)}</div><div className="bar"><i style={{ width: (item.total ? Math.min(100, item.progress / item.total * 100) : item.progress / 20) + '%' }} /></div><div className="meta"><span>{item.progress}{item.total ? ' / ' + item.total : ''}</span><span>{item.year || '—'}</span><span>★ {item.score || '—'}</span></div><button className="primary" onClick={edit}><Pencil />Edit details</button><button className="secondary" disabled={savingFavorite} onClick={() => void toggleFavorite()}><Heart fill={item.favorite ? 'currentColor' : 'none'} />{item.favorite ? 'Unfavorite' : 'Favorite'}</button><button className="danger" onClick={remove}><Trash2 />Delete</button>{item.anilistId && <button className="secondary" onClick={() => void refreshMetadata(item)}><RefreshCw />Refresh metadata</button></div></div>{parts.length > 0 && <div className="parts"><h3>Parts & seasons</h3>{parts.map(x => <button key={x.id} onClick={() => setSelectedPart(x, update)}><img src={x.poster}/><span>{x.title}</span><small>{x.progress}{x.total ? '/' + x.total : ''}</small></button>)}</div>}</aside></div>;
}
async function setSelectedPart(item: MediaItem, update: (x: MediaItem) => Promise<void>) { await update(item); }

function Editor({ item, close, save, isNew = false }: { item: MediaItem; close: () => void; save: (x: MediaItem) => Promise<void> | void; isNew?: boolean }) {
  const [d, setD] = useState(item); const [saving, setSaving] = useState(false);
  const set = (k: keyof MediaItem, v: unknown) => setD(x => ({ ...x, [k]: v }));
  const submit = async () => { if (!d.title.trim()) return; if (d.progress < 0 || d.progress > 2000 || (d.total != null && d.total < 0)) return; setSaving(true); await save({ ...d, title: d.title.trim(), progress: Math.min(2000, Math.max(0, Math.round(d.progress))) }); setSaving(false); };
  return <div className="modalwrap"><div className="modal"><div className="modalhead"><div><small>{isNew ? 'ADD TO LIBRARY' : 'EDITOR'}</small><h2>{isNew ? 'Add media' : 'Edit media'}</h2></div><button onClick={close}><X /></button></div><div className="form">
    <label>Title<input value={d.title} onChange={e => set('title', e.target.value)} autoFocus /></label>
    <label>Media type<select value={d.medium} onChange={e => set('medium', e.target.value as Medium)}>{mediaTypes.map(x => <option key={x} value={x}>{labelMedium(x)}</option>)}</select></label>
    <label>Status<select value={d.status} onChange={e => set('status', e.target.value as Status)}>{statuses.map(x => <option key={x} value={x}>{labelStatus(x)}</option>)}</select></label>
    <label>Progress (0–2000)<input type="number" min="0" max="2000" value={d.progress} onChange={e => set('progress', Number(e.target.value))} /></label>
    <label>Total episodes / chapters<input type="number" min="0" value={d.total ?? ''} onChange={e => set('total', e.target.value ? Number(e.target.value) : undefined)} /></label>
    <label>Year<input type="number" min="0" value={d.year ?? ''} onChange={e => set('year', e.target.value ? Number(e.target.value) : undefined)} /></label>
    <label>Score<input type="number" min="0" max="10" step=".1" value={d.score ?? ''} onChange={e => set('score', e.target.value ? Number(e.target.value) : undefined)} /></label>
    <label>Studio / creator<input value={d.studio ?? ''} onChange={e => set('studio', e.target.value)} /></label>
    <label>Poster URL<input value={d.poster} onChange={e => set('poster', e.target.value)} /></label>
    <label>Backdrop URL<input value={d.backdrop} onChange={e => set('backdrop', e.target.value)} /></label>
    <label className="wide">Description<textarea value={d.description} onChange={e => set('description', e.target.value)} /></label>
    <label className="wide">Genres<input value={d.genres.join(', ')} onChange={e => set('genres', e.target.value.split(',').map(x => x.trim()).filter(Boolean))} /></label>
    <label className="wide">Notes<textarea value={d.notes ?? ''} onChange={e => set('notes', e.target.value)} placeholder="Personal notes…" /></label>
    <label className="check"><input type="checkbox" checked={d.favorite} onChange={e => set('favorite', e.target.checked)} /> Favorite</label>
  </div><button className="primary save" disabled={saving || !d.title.trim()} onClick={() => void submit()}>{saving ? <><Loader2 className="spin"/>Saving…</> : <><Save />Save changes</>}</button></div></div>;
}
function MenuPanel({ close, page, setPage }: { close: () => void; page: string; setPage: (x: string) => void }) { const rows: [string, string, typeof Film][] = [['home','Home',Film],['library','Library',LibraryIcon],['discover','Discover',Compass],['calendar','Release Radar',CalendarDays],['stats','Statistics',BarChart3]]; return <div className="menuoverlay" onClick={close}><aside className="menu" onClick={e => e.stopPropagation()}><div className="menulogo"><b>F</b>FRAME<button onClick={close}><X /></button></div>{rows.map(([id,label,Icon]) => <button className={page === id ? 'selected' : ''} key={id} onClick={() => {setPage(id);close();}}><Icon />{label}</button>)}<div className="menubottom"><button><Settings />Settings</button><button className="signout" onClick={() => void signOut()}>Log out</button><p>FRAME v2.0<br />Your personal media universe.</p></div></aside></div> }

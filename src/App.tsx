import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Menu, Plus, Search, Heart, Bell, Play, X, Pencil, Save, Star, Film, Library as LibraryIcon, Compass, CalendarDays, BarChart3, Settings, Trash2, CheckCircle2, AlertCircle, Loader2, ArrowUpDown, RefreshCw } from 'lucide-react';
import { starterLibrary } from './data';
import { signOut, useAuth } from './auth/Auth';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import type { MediaItem, Status, Medium } from './types';
import { AniListSearch } from './components/AniListSearch';
import { aniList, cleanDescription, DETAIL_QUERY, type AniListMedia } from './anilist';

const STORE = 'frame-my-anime-v1';
type SortMode = 'recent' | 'title' | 'progress' | 'rating';
type Notification = { id:string; releaseId:string; kind:string; title:string; body:string; mediaTitle?:string; releaseNumber?:number; scheduledAt?:string; readAt?:string; createdAt:string };
type NotificationPreferences = { episode_releases:boolean; new_seasons:boolean; new_parts:boolean };
type Activity = { id:string; mediaItemId:string; eventType:string; oldProgress?:number; newProgress?:number; oldStatus?:string; newStatus?:string; createdAt:string };
type Collection = { id:string; name:string; description?:string; itemIds:string[] };
type Tag = { id:string; name:string; itemIds:string[] };
type Release = {
  id:string; mediaMetadataId:string; anilistId:number; releaseType:string; releaseNumber?:number;
  title?:string; scheduledAt?:string; status:'scheduled'|'released'|'cancelled'|'rescheduled'|'unknown'; source:string;
  mediaTitle:string; poster:string;
};
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
  const [releases, setReleases] = useState<Release[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({ episode_releases:true, new_seasons:true, new_parts:true });
  const [activity, setActivity] = useState<Activity[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

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

  useEffect(() => {
    if (!supabase || !user) { setReleases([]); return; }
    let active = true;
    supabase.from('media_releases').select('*,media_metadata(title,poster)').order('scheduled_at', { ascending: true }).limit(200).then(({ data, error: e }) => {
      if (!active) return;
      if (!e) setReleases((data ?? []).map((x: Record<string, unknown>) => ({
        id: String(x.id), mediaMetadataId: String(x.media_metadata_id), anilistId: Number(x.anilist_id),
        releaseType: String(x.release_type), releaseNumber: x.release_number == null ? undefined : Number(x.release_number),
        title: x.title ? String(x.title) : undefined, scheduledAt: x.scheduled_at ? String(x.scheduled_at) : undefined,
        status: String(x.status) as Release['status'], source: String(x.source),
        mediaTitle: x.media_metadata && typeof x.media_metadata === 'object' ? String((x.media_metadata as Record<string, unknown>).title ?? '') : '',
        poster: x.media_metadata && typeof x.media_metadata === 'object' ? String((x.media_metadata as Record<string, unknown>).poster ?? '') : ''
      })).filter(x => items.some(i => i.metadataId === x.mediaMetadataId)));
    });
    return () => { active = false; };
  }, [user, items]);

  useEffect(() => {
    if (!supabase || !user) { setActivity([]); setCollections([]); setTags([]); return; }
    let active = true;
    Promise.all([
      supabase.from('media_activity').select('id,media_item_id,event_type,old_progress,new_progress,old_status,new_status,created_at').order('created_at',{ascending:false}).limit(500),
      supabase.from('collections').select('id,name,description').order('created_at',{ascending:true}),
      supabase.from('collection_items').select('collection_id,media_item_id,position').order('position',{ascending:true}),
      supabase.from('tags').select('id,name').order('name',{ascending:true}),
      supabase.from('media_tags').select('tag_id,media_item_id')
    ]).then(([a,cx,ci,t,mt]) => {
      if (!active) return;
      if (!a.error) setActivity((a.data ?? []).map((x:Record<string,unknown>)=>({id:String(x.id),mediaItemId:String(x.media_item_id),eventType:String(x.event_type),oldProgress:x.old_progress==null?undefined:Number(x.old_progress),newProgress:x.new_progress==null?undefined:Number(x.new_progress),oldStatus:x.old_status?String(x.old_status):undefined,newStatus:x.new_status?String(x.new_status):undefined,createdAt:String(x.created_at)})));
      if (!cx.error) {
        const rows=(cx.data??[]) as Record<string,unknown>[];
        const links=(ci.error?[]:(ci.data??[])) as Record<string,unknown>[];
        setCollections(rows.map(x=>({id:String(x.id),name:String(x.name),description:x.description?String(x.description):undefined,itemIds:links.filter(l=>String(l.collection_id)===String(x.id)).map(l=>String(l.media_item_id))})));
      }
      if (!t.error) {
        const rows=(t.data??[]) as Record<string,unknown>[];
        const links=(mt.error?[]:(mt.data??[])) as Record<string,unknown>[];
        setTags(rows.map(x=>({id:String(x.id),name:String(x.name),itemIds:links.filter(l=>String(l.tag_id)===String(x.id)).map(l=>String(l.media_item_id))})));
      }
    });
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    if (!supabase || !user) { setNotifications([]); return; }
    let active = true;
    Promise.all([
      supabase.from('notifications').select('*').order('created_at', { ascending:false }).limit(100),
      supabase.from('notification_preferences').select('episode_releases,new_seasons,new_parts').eq('user_id', user.id).maybeSingle()
    ]).then(([n,p]) => {
      if (!active) return;
      if (!n.error) setNotifications((n.data ?? []).map((x:Record<string,unknown>) => ({
        id:String(x.id), releaseId:String(x.release_id), kind:String(x.kind), title:String(x.title), body:String(x.body),
        mediaTitle:x.media_title ? String(x.media_title) : undefined, releaseNumber:x.release_number == null ? undefined : Number(x.release_number),
        scheduledAt:x.scheduled_at ? String(x.scheduled_at) : undefined, readAt:x.read_at ? String(x.read_at) : undefined, createdAt:String(x.created_at)
      })));
      if (!p.error && p.data) setNotificationPrefs({ episode_releases:Boolean(p.data.episode_releases), new_seasons:Boolean(p.data.new_seasons), new_parts:Boolean(p.data.new_parts) });
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
  const markNotificationRead = async (id:string) => {
    if (!supabase || !user) return;
    const { error:e } = await supabase.from('notifications').update({ read_at:new Date().toISOString() }).eq('id',id).eq('user_id',user.id);
    if (!e) setNotifications(prev => prev.map(n => n.id===id ? {...n,readAt:new Date().toISOString()} : n));
  };
  const markAllNotificationsRead = async () => {
    if (!supabase || !user) return;
    const { error:e } = await supabase.from('notifications').update({ read_at:new Date().toISOString() }).eq('user_id',user.id).is('read_at',null);
    if (!e) setNotifications(prev => prev.map(n => ({...n,readAt:n.readAt || new Date().toISOString()})));
  };
  const saveNotificationPrefs = async (next:NotificationPreferences) => {
    if (!supabase || !user) return;
    const { error:e } = await supabase.from('notification_preferences').upsert({ user_id:user.id, ...next }, { onConflict:'user_id' });
    if (e) setError(e.message); else { setNotificationPrefs(next); setNotice('Notification preferences saved.'); }
  };
  const createCollection = async (name:string) => {
    if (!supabase || !user || !name.trim()) return;
    const {data,error:e}=await supabase.from('collections').insert({user_id:user.id,name:name.trim()}).select('id,name,description').single();
    if(e) setError(e.message); else if(data) { setCollections(prev=>[...prev,{id:String(data.id),name:String(data.name),itemIds:[]}]); setNotice('Collection created.'); }
  };
  const toggleCollectionItem = async (collectionId:string,itemId:string) => {
    if(!supabase || !user) return;
    const collection=collections.find(x=>x.id===collectionId); if(!collection) return;
    const has=collection.itemIds.includes(itemId);
    const result=has
      ? await supabase.from('collection_items').delete().eq('collection_id',collectionId).eq('media_item_id',itemId)
      : await supabase.from('collection_items').insert({collection_id:collectionId,media_item_id:itemId});
    if(result.error) setError(result.error.message); else setCollections(prev=>prev.map(x=>x.id===collectionId?{...x,itemIds:has?x.itemIds.filter(id=>id!==itemId):[...x.itemIds,itemId]}:x));
  };
  const createTag = async (name:string) => {
    if (!supabase || !user || !name.trim()) return;
    const {data,error:e}=await supabase.from('tags').insert({user_id:user.id,name:name.trim()}).select('id,name').single();
    if(e) setError(e.message); else if(data) { setTags(prev=>[...prev,{id:String(data.id),name:String(data.name),itemIds:[]}]); setNotice('Tag created.'); }
  };
  const toggleTagItem = async (tagId:string,itemId:string) => {
    if(!supabase || !user) return;
    const tag=tags.find(x=>x.id===tagId); if(!tag) return;
    const has=tag.itemIds.includes(itemId);
    const result=has
      ? await supabase.from('media_tags').delete().eq('tag_id',tagId).eq('media_item_id',itemId)
      : await supabase.from('media_tags').insert({tag_id:tagId,media_item_id:itemId});
    if(result.error) setError(result.error.message); else setTags(prev=>prev.map(x=>x.id===tagId?{...x,itemIds:has?x.itemIds.filter(id=>id!==itemId):[...x.itemIds,itemId]}:x));
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

  const refreshMetadata = async (item: MediaItem) => {
    if (!item.anilistId) { setError('This item has no AniList ID.'); return; }
    setError(''); setNotice('');
    try {
      if (supabase && user) {
        const { error: e } = await supabase.functions.invoke('anilist-import', { body: { action: 'refresh', anilistId: item.anilistId, mediaItemId: item.id } });
        if (e) throw e;
        const { data, error: loadError } = await supabase.from('media_items').select('*,media_metadata(*)').eq('id', item.id).single();
        if (loadError) throw loadError;
        const saved = fromRow(data);
        setItems(prev => prev.map(x => x.id === item.id ? saved : x));
        setSelected(saved); setNotice('AniList metadata refreshed.');
      } else {
        const { Media } = await aniList<{ Media: AniListMedia }>(DETAIL_QUERY, { id: item.anilistId });
        const title = Media.title.userPreferred || Media.title.english || Media.title.romaji || Media.title.native || item.title;
        const saved = { ...item, title, alternativeTitles: [Media.title.english, Media.title.romaji, Media.title.native, ...(Media.synonyms || [])].filter((x): x is string => Boolean(x && x !== title)), description: cleanDescription(Media.description), poster: Media.coverImage?.extraLarge || '', backdrop: Media.bannerImage || '', genres: Media.genres || [], themes: (Media.tags || []).map(x => x.name), year: Media.seasonYear ?? undefined, score: Media.averageScore == null ? undefined : Media.averageScore / 10, studio: Media.studios?.nodes?.map(x => x.name).join(', ') || undefined, source: Media.source || undefined, total: Media.episodes ?? item.total, season: Media.season || undefined, duration: Media.duration || undefined };
        persistLocal(items.map(x => x.id === item.id ? saved : x)); setSelected(saved); setNotice('Metadata refreshed locally.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not refresh metadata.'); }
  };

  const filtered = useMemo(() => {
    const normalized = q.trim().toLowerCase();
    const matches = items.filter(x =>
      (!normalized || [x.title, x.description, x.notes ?? '', ...x.genres, ...x.themes].join(' ').toLowerCase().includes(normalized)) &&
      (status === 'all' || x.status === status) && (medium === 'all' || x.medium === medium)
    );
    // When a child matches a filter, retain every ancestor so the hierarchy stays understandable.
    const visible = new Set(matches.map(x => x.id));
    const byId = new Map(items.map(x => [x.id, x]));
    for (const match of matches) {
      let parent = match.parentId ? byId.get(match.parentId) : undefined;
      let guard = 0;
      while (parent && guard++ < 2000) {
        visible.add(parent.id);
        parent = parent.parentId ? byId.get(parent.parentId) : undefined;
      }
    }
    return items.filter(x => visible.has(x.id)).sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title) :
      sort === 'progress' ? b.progress - a.progress :
      sort === 'rating' ? (b.score ?? -1) - (a.score ?? -1) : 0
    );
  }, [items, q, status, medium, sort]);

  const hierarchyChildren = (parentId: string) => items.filter(x => x.parentId === parentId);
  const descendants = (id: string) => {
    const out = new Set<string>();
    const queue = [id];
    while (queue.length) {
      const current = queue.shift()!;
      for (const child of items.filter(x => x.parentId === current)) {
        if (!out.has(child.id)) { out.add(child.id); queue.push(child.id); }
      }
    }
    return out;
  };
  const hierarchyProgress = (item: MediaItem): { progress: number; total?: number } => {
    const children: MediaItem[] = hierarchyChildren(item.id);
    if (!children.length) return { progress: item.progress, total: item.total };
    const leaf: Array<{ progress: number; total?: number }> = children.map((child: MediaItem) => hierarchyProgress(child));
    const withTotals: Array<{ progress: number; total?: number }> = leaf.filter((x: { progress: number; total?: number }) => x.total != null && x.total > 0);
    if (withTotals.length) {
      const total: number = withTotals.reduce((n: number, x: { progress: number; total?: number }) => n + (x.total ?? 0), 0);
      const progress: number = withTotals.reduce((n: number, x: { progress: number; total?: number }) => n + Math.min(x.progress, x.total ?? x.progress), 0);
      return { progress, total };
    }
    return { progress: leaf.reduce((n: number, x: { progress: number; total?: number }) => n + x.progress, 0) };
  };
  const roots = items.filter(x => !x.parentId);
  const childIds = new Set(items.filter(x => x.parentId).map(x => x.parentId!));
  const tracked = items.filter(x => !childIds.has(x.id));
  const stats = {
    total: roots.length,
    watching: items.filter(x => x.status === 'watching').length,
    completed: items.filter(x => x.status === 'completed').length,
    planned: items.filter(x => x.status === 'planned').length,
    paused: items.filter(x => x.status === 'paused').length,
    dropped: items.filter(x => x.status === 'dropped').length,
    favorites: items.filter(x => x.favorite).length,
    completedUnits: tracked.reduce((n,x)=>n+(Number.isFinite(x.progress)?Math.max(0,x.progress):0),0),
    rated: tracked.filter(x=>x.score != null && Number.isFinite(x.score)),
    genres: Object.entries(tracked.flatMap(x=>x.genres).reduce<Record<string,number>>((m,g)=>{m[g]=(m[g]??0)+1;return m;},{})).sort((a,b)=>b[1]-a[1]),
    types: Object.entries(tracked.reduce<Record<string,number>>((m,x)=>{m[x.medium]=(m[x.medium]??0)+1;return m;},{})).sort((a,b)=>b[1]-a[1]),
    scoreBuckets: Object.entries(tracked.filter(x=>x.score!=null).reduce<Record<string,number>>((m,x)=>{const bucket=(Math.round((x.score??0)*2)/2).toFixed(1);m[bucket]=(m[bucket]??0)+1;return m;},{})).sort((a,b)=>Number(a[0])-Number(b[0]))
  };

  const defaultItem: MediaItem = { id: crypto.randomUUID(), title: '', description: '', poster: '', backdrop: '', medium: 'anime', status: 'planned', progress: 0, genres: [], themes: [], favorite: false };

  return <div className="app">
    <header className="top"><button className="icon" onClick={() => setMenu(true)}><Menu /></button><button className="logo" onClick={() => setPage('home')}><b>F</b>FRAME</button>
      <nav><button className={page === 'home' ? 'on' : ''} onClick={() => setPage('home')}>Home</button><button className={page === 'library' ? 'on' : ''} onClick={() => setPage('library')}>Library</button><button className={page === 'discover' ? 'on' : ''} onClick={() => setPage('discover')}>Discover</button><button className={page === 'calendar' ? 'on' : ''} onClick={() => setPage('calendar')}>Release Radar</button></nav>
      <div className="topright"><button className="notification-button" onClick={() => setPage('notifications')} aria-label="Notifications"><Bell size={17} />{notifications.filter(n => !n.readAt).length > 0 && <span>{notifications.filter(n => !n.readAt).length > 99 ? '99+' : notifications.filter(n => !n.readAt).length}</span>}</button><div className="search"><Search size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search library" /></div><button className="add" onClick={() => setAniSearchOpen(true)}><Search size={17} />Find media</button><button className="add" onClick={() => { setAddMode(true); setError(''); }}><Plus size={17} />Add</button></div>
    </header>
    {notice && <div className="toast success"><CheckCircle2 size={15} />{notice}<button onClick={() => setNotice('')}><X size={13}/></button></div>}
    {error && <div className="toast error"><AlertCircle size={15} />{error}<button onClick={() => setError('')}><X size={13}/></button></div>}
    {loading ? <Loading /> : <>
      {page === 'home' && <Home items={items} stats={stats} open={setSelected} />}
      {page === 'library' && <LibraryPage items={filtered} q={q} setQ={setQ} status={status} setStatus={setStatus} medium={medium} setMedium={setMedium} sort={sort} setSort={setSort} open={setSelected} />}
      {page === 'discover' && <Discover open={setSelected} />}
      {page === 'calendar' && <Calendar releases={releases} />}
      {page === 'stats' && <Stats stats={stats} activity={activity} items={items} collections={collections} tags={tags} createCollection={createCollection} toggleCollectionItem={toggleCollectionItem} createTag={createTag} toggleTagItem={toggleTagItem} />} {page === 'notifications' && <NotificationsPage notifications={notifications} markRead={markNotificationRead} markAll={markAllNotificationsRead} />} {page === 'settings' && <NotificationSettings prefs={notificationPrefs} save={saveNotificationPrefs} />}
    </>}
    <div className="mobilebar"><button onClick={() => setPage('home')}><Film />Home</button><button onClick={() => setPage('library')}><LibraryIcon />Library</button><button onClick={() => setPage('discover')}><Compass />Discover</button><button onClick={() => setPage('stats')}><BarChart3 />Stats</button></div>
    {selected && <Drawer item={selected} parts={hierarchyChildren(selected.id)} allItems={items} summary={hierarchyProgress(selected)} close={() => setSelected(null)} open={setSelected} edit={() => setEditMode(true)} update={update} remove={() => void remove(selected)} refresh={(item) => void refreshMetadata(item)} />}
    {editMode && selected && <Editor item={selected} close={() => setEditMode(false)} save={update} parentOptions={items.filter(x => x.id !== selected.id && !descendants(selected.id).has(x.id))} />}
    {addMode && <Editor item={defaultItem} close={() => setAddMode(false)} save={add} isNew parentOptions={items} />}
    {menu && <MenuPanel close={() => setMenu(false)} page={page} setPage={setPage} />}
    {aniSearchOpen && <AniListSearch close={() => setAniSearchOpen(false)} onImported={() => { setAniSearchOpen(false); window.location.reload(); }} />}
  </div>;
}

function Loading() { return <main className="state"><Loader2 className="spin" /><h2>Loading your library</h2><p>Syncing your private FRAME collection…</p></main> }
function Home({ items, stats, open }: { items: MediaItem[]; stats: { total: number; watching: number; completed: number; favorites: number }; open: (x: MediaItem) => void }) {
  const hero = items.find(x => x.id === 'aot') || items[0];
  if (!hero) return <Empty title="Your FRAME is empty." text="Add your first piece of media to start building your library." />;
  return <main><section className="hero" style={{ backgroundImage: `linear-gradient(90deg,#09090df5 5%,#09090d88 55%,transparent),url(${hero.backdrop})` }}><div><small>YOUR MEDIA UNIVERSE</small><h1>{hero.title}</h1><p>{hero.description}</p><div className="meta"><span><Star /> {hero.score ?? '—'}</span><span>{hero.year ?? '—'}</span><span>{labelMedium(hero.medium)}</span><span>{labelStatus(hero.status)}</span></div><button className="primary" onClick={() => open(hero)}><Play fill="currentColor" />Open details</button></div></section><div className="stats"><Stat n={stats.total} t="Series" /><Stat n={stats.watching} t="Watching" /><Stat n={stats.completed} t="Completed" /><Stat n={stats.favorites} t="Favorites" /></div><Shelf title="Continue watching" items={items.filter(x => x.status === 'watching').sort((a,b)=>b.progress-a.progress)} open={open} /><Shelf title="Favorites" items={items.filter(x => x.favorite)} open={open} /><Shelf title="Recently active" items={[...items].sort((a,b)=>b.progress-a.progress).filter(x=>x.progress>0).slice(0,8)} open={open} /><Shelf title="Your library" items={items.filter(x => !x.parentId)} open={open} /></main>;
}
function Stat({ n, t }: { n: number; t: string }) { return <div><b>{n}</b><span>{t}</span></div> }
function Shelf({ title, items, open }: { title: string; items: MediaItem[]; open: (x: MediaItem) => void }) { return <section className="shelf"><div className="heading"><h2>{title}</h2><span>{items.length}</span></div>{items.length ? <div className="cards">{items.map(x => <Card key={x.id} item={x} open={open} />)}</div> : <p className="muted">Nothing here yet.</p>}</section> }
function Card({ item, open }: { item: MediaItem; open: (x: MediaItem) => void }) { return <button className="card" onClick={() => open(item)}><img src={item.poster || 'https://placehold.co/700x1000/111116/777?text=FRAME'} /><strong>{item.title || 'Untitled'}</strong><small>{item.progress}{item.total ? '/' + item.total : ''} · {labelStatus(item.status)}</small>{item.favorite && <Heart className="heart" fill="currentColor" />}</button> }

function LibraryPage({ items, q, setQ, status, setStatus, medium, setMedium, sort, setSort, open }: { items: MediaItem[]; q: string; setQ: (x: string) => void; status: Status | 'all'; setStatus: (x: Status | 'all') => void; medium: Medium | 'all'; setMedium: (x: Medium | 'all') => void; sort: SortMode; setSort: (x: SortMode) => void; open: (x: MediaItem) => void }) {
  return <main className="page"><small>YOUR LIBRARY</small><h1>Everything you follow.</h1><div className="library-toolbar"><div className="search library-search"><Search size={16}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title, genres, notes…" /></div><div className="filters"><select value={status} onChange={e => setStatus(e.target.value as Status | 'all')}><option value="all">All status</option>{statuses.map(x => <option key={x} value={x}>{labelStatus(x)}</option>)}</select><select value={medium} onChange={e => setMedium(e.target.value as Medium | 'all')}><option value="all">All media</option>{mediaTypes.map(x => <option key={x} value={x}>{labelMedium(x)}</option>)}</select><select value={sort} onChange={e => setSort(e.target.value as SortMode)}><option value="recent">Recently added</option><option value="title">Title</option><option value="progress">Progress</option><option value="rating">Rating</option></select><ArrowUpDown size={15}/></div></div>{items.length ? <div className="grid">{items.map(x => <Card key={x.id} item={x} open={open} />)}</div> : <Empty title="No matching media." text="Try another search or filter, or add something new." />}</main>;
}
function Empty({ title, text }: { title: string; text: string }) { return <main className="state"><LibraryIcon /><h2>{title}</h2><p>{text}</p></main> }
function Discover({ open }: { open: (x: MediaItem) => void }) { return <main className="page"><small>DISCOVER</small><h1>Find your next obsession.</h1><p className="muted">Use <b>Find media</b> in the header to search the live AniList catalogue and import titles with their metadata.</p><div className="discover">{starterLibrary.filter(x => !x.parentId).map(x => <button key={x.id} onClick={() => open(x)} style={{ backgroundImage: `linear-gradient(0deg,#000e,transparent),url(${x.backdrop})` }}><div><small>{labelMedium(x.medium)}</small><h2>{x.title}</h2><span>{x.genres.join(' · ')}</span></div></button>)}</div></main> }
function Calendar({ releases }: { releases: Release[] }) {
  const now = Date.now();
  const upcoming = releases.filter(x => x.status === 'scheduled' && x.scheduledAt && new Date(x.scheduledAt).getTime() >= now).sort((a,b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
  const recent = releases.filter(x => (x.status === 'released' || (x.scheduledAt && new Date(x.scheduledAt).getTime() < now)) && x.scheduledAt).sort((a,b) => new Date(b.scheduledAt!).getTime() - new Date(a.scheduledAt!).getTime()).slice(0, 30);
  const row = (x: Release) => <div key={x.id} className={x.status === 'cancelled' ? 'cancelled' : ''}><img src={x.poster || 'https://placehold.co/240x360/111116/777?text=FRAME'} /><section><b>{x.mediaTitle || x.title || 'Unknown media'}</b><span>{x.releaseType === 'episode' && x.releaseNumber != null ? 'Episode ' + x.releaseNumber : x.releaseType}</span><small>{x.status === 'cancelled' ? 'Cancelled' : x.scheduledAt ? new Date(x.scheduledAt).toLocaleString() : 'Date unknown'}</small></section><CalendarDays /></div>;
  return <main className="page"><small>RELEASE RADAR</small><h1>Never miss what comes next.</h1><p className="muted">Release data is refreshed automatically by the server-side tracker. Your library status and progress remain separate.</p><section className="release-section"><div className="heading"><h2>Upcoming</h2><span>{upcoming.length}</span></div><div className="releases">{upcoming.length ? upcoming.map(row) : <p className="muted">No upcoming releases currently known.</p>}</div></section><section className="release-section"><div className="heading"><h2>Recently released</h2><span>{recent.length}</span></div><div className="releases">{recent.length ? recent.map(row) : <p className="muted">No recent releases currently known.</p>}</div></section></main>;
}
function NotificationsPage({ notifications, markRead, markAll }: { notifications:Notification[]; markRead:(id:string)=>void; markAll:()=>void }) {
  const unread=notifications.filter(n=>!n.readAt).length;
  return <main className="page"><div className="heading"><div><small>NOTIFICATIONS</small><h1>Your release updates.</h1></div><button className="secondary" disabled={!unread} onClick={markAll}>Mark all as read</button></div>
  {notifications.length ? <div className="notification-list">{notifications.map(n=><button className={n.readAt?'notification read':'notification'} key={n.id} onClick={()=>markRead(n.id)}><div className="notification-icon"><Bell size={16}/></div><section><b>{n.title}</b><span>{n.mediaTitle || 'Your library'}{n.releaseNumber != null ? ' · Episode '+n.releaseNumber : ''}</span><p>{n.body}</p><small>{new Date(n.createdAt).toLocaleString()}</small></section>{!n.readAt && <i />}</button>)}</div> : <Empty title="You're all caught up." text="New release notifications for media in your library will appear here." />}
  </main>;
}
function NotificationSettings({ prefs, save }: { prefs:NotificationPreferences; save:(x:NotificationPreferences)=>void }) {
  const [draft,setDraft]=useState(prefs);
  useEffect(()=>setDraft(prefs),[prefs]);
  const toggle=(key:keyof NotificationPreferences)=>(e:ChangeEvent<HTMLInputElement>)=>setDraft({...draft,[key]:e.target.checked});
  return <main className="page settings-page"><small>SETTINGS</small><h1>Notification settings.</h1><p className="muted">Choose which release events FRAME should turn into in-app notifications. Future browser push and email channels can use these same preferences.</p><div className="settings-card"><SettingToggle title="New episodes" text="Notify me when an episode tracked in my library is released." checked={draft.episode_releases} onChange={toggle('episode_releases')}/><SettingToggle title="New seasons" text="Notify me when a tracked season release is detected." checked={draft.new_seasons} onChange={toggle('new_seasons')}/><SettingToggle title="New parts & related entries" text="Notify me about new parts and related releases." checked={draft.new_parts} onChange={toggle('new_parts')}/><button className="primary" onClick={()=>save(draft)}>Save preferences</button></div></main>;
}
function SettingToggle({title,text,checked,onChange}:{title:string;text:string;checked:boolean;onChange:(e:React.ChangeEvent<HTMLInputElement>)=>void}) { return <label className="setting-toggle"><span><b>{title}</b><small>{text}</small></span><input type="checkbox" checked={checked} onChange={onChange}/></label> }
function Stats({ stats, activity, items, collections, tags, createCollection, toggleCollectionItem, createTag, toggleTagItem }: { stats: any; activity:Activity[]; items:MediaItem[]; collections:Collection[]; tags:Tag[]; createCollection:(name:string)=>Promise<void>; toggleCollectionItem:(collectionId:string,itemId:string)=>Promise<void>; createTag:(name:string)=>Promise<void>; toggleTagItem:(tagId:string,itemId:string)=>Promise<void> }) {
  const [collectionName,setCollectionName]=useState('');
  const [tagName,setTagName]=useState('');
  const [orgItem,setOrgItem]=useState(items.find(x=>!x.parentId)?.id ?? items[0]?.id ?? '');
  const [orgCollection,setOrgCollection]=useState(collections[0]?.id ?? '');
  const [orgTag,setOrgTag]=useState(tags[0]?.id ?? '');
  useEffect(()=>{if(!orgItem && items[0])setOrgItem(items[0].id)},[items,orgItem]);
  useEffect(()=>{if(!orgCollection && collections[0])setOrgCollection(collections[0].id)},[collections,orgCollection]);
  useEffect(()=>{if(!orgTag && tags[0])setOrgTag(tags[0].id)},[tags,orgTag]);
  const trend=Object.entries(activity.filter(x=>x.eventType==='completed'||x.newStatus==='completed').reduce<Record<string,number>>((m,x)=>{const d=new Date(x.createdAt);const key=d.toLocaleDateString(undefined,{month:'short',year:'2-digit'});m[key]=(m[key]??0)+1;return m;},{}));
  const recent=activity.filter(x=>x.eventType!=='added').slice(0,10);
  const titleFor=(id:string)=>items.find(x=>x.id===id)?.title??'Unknown media';
  const avg=stats.rated.length ? (stats.rated.reduce((n: number,x:MediaItem)=>n+(x.score??0),0)/stats.rated.length).toFixed(1) : '—';
  return <main className="page stats-page"><small>STATISTICS + PERSONALIZATION</small><h1>Your media, measured.</h1>
    <div className="bigstats"><Stat n={stats.total} t="Library" /><Stat n={stats.watching} t="Watching" /><Stat n={stats.completed} t="Completed" /><Stat n={stats.planned} t="Planned" /><Stat n={stats.paused} t="Paused" /><Stat n={stats.dropped} t="Dropped" /><Stat n={stats.completedUnits} t="Episodes / chapters" /><Stat n={stats.favorites} t="Favorites" /></div>
    <section className="stat-panels">
      <div className="stat-panel"><div className="heading"><h2>Completion trends</h2><span>{trend.length} months</span></div>{trend.length?<div className="bars">{trend.map(([month,count])=><div className="bar-row" key={month}><span>{month}</span><i style={{width:Math.max(8,(count/Math.max(...trend.map(([,n])=>n)))*100)+'%'}}/><b>{count}</b></div>)}</div>:<p className="muted">Completion history will appear as you update progress.</p>}</div>
      <div className="stat-panel"><div className="heading"><h2>Score profile</h2><span>Average {avg}</span></div>{stats.scoreBuckets.length?<div className="distribution">{stats.scoreBuckets.map(([score,count]:[string,number])=><span key={score} style={{height:Math.max(8,count*18)+'px'}} title={score+' · '+count}>{score}</span>)}</div>:<p className="muted">Add scores to see your rating profile.</p>}</div>
    </section>
    <section className="stat-panels">
      <div className="stat-panel"><div className="heading"><h2>Genres</h2></div>{stats.genres.length?stats.genres.slice(0,10).map(([g,n]:[string,number])=><div className="rank-row" key={g}><span>{g}</span><b>{n}</b></div>):<p className="muted">Genre data will appear from your library.</p>}</div>
      <div className="stat-panel"><div className="heading"><h2>Media types</h2></div>{stats.types.length?stats.types.map(([g,n]:[string,number])=><div className="rank-row" key={g}><span>{labelMedium(g as Medium)}</span><b>{n}</b></div>):<p className="muted">Add media to build type statistics.</p>}</div>
    </section>
    <section className="stat-panel activity-panel"><div className="heading"><h2>Watching activity</h2><span>{activity.length} events</span></div>{recent.length?<div className="activity-list">{recent.map(a=><div key={a.id}><span>{a.eventType==='completed'?'Completed':a.eventType==='progress'?'Progress updated':'Status changed'}</span><b>{titleFor(a.mediaItemId)}</b><small>{a.newProgress!=null?' · '+a.newProgress+(items.find(x=>x.id===a.mediaItemId)?.total?'/'+items.find(x=>x.id===a.mediaItemId)?.total:''):''} · {new Date(a.createdAt).toLocaleString()}</small></div>)}</div>:<p className="muted">No activity yet. Your progress and status changes will appear here.</p>}</section>
    <section className="stat-panel organization-panel"><div className="heading"><h2>Collections & tags</h2><span>Private organization</span></div>
      <div className="org-create"><input value={collectionName} onChange={e=>setCollectionName(e.target.value)} placeholder="New collection name" /><button className="secondary" onClick={()=>{void createCollection(collectionName);setCollectionName('')}}>Create collection</button><input value={tagName} onChange={e=>setTagName(e.target.value)} placeholder="New tag name" /><button className="secondary" onClick={()=>{void createTag(tagName);setTagName('')}}>Create tag</button></div>
      <div className="org-controls"><select value={orgItem} onChange={e=>setOrgItem(e.target.value)}>{items.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select><select value={orgCollection} onChange={e=>setOrgCollection(e.target.value)}><option value="">Choose collection</option>{collections.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><button className="secondary" disabled={!orgCollection} onClick={()=>{if(orgCollection)void toggleCollectionItem(orgCollection,orgItem)}}>Add / remove collection</button><select value={orgTag} onChange={e=>setOrgTag(e.target.value)}><option value="">Choose tag</option>{tags.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><button className="secondary" disabled={!orgTag} onClick={()=>{if(orgTag)void toggleTagItem(orgTag,orgItem)}}>Add / remove tag</button></div>
      <div className="org-list">{collections.map(c=><div key={c.id}><b>{c.name}</b><span>{c.itemIds.length} items</span></div>)}{tags.map(t=><div key={t.id}><b>#{t.name}</b><span>{t.itemIds.length} tagged</span></div>)}</div>
    </section>
  </main>;
}

function Drawer({ item, parts, allItems, summary, close, open, edit, update, remove, refresh }: { item: MediaItem; parts: MediaItem[]; allItems: MediaItem[]; summary: { progress: number; total?: number }; close: () => void; open: (x: MediaItem) => void; edit: () => void; update: (x: MediaItem) => Promise<void>; remove: () => void; refresh: (x: MediaItem) => void }) {
  const [savingFavorite, setSavingFavorite] = useState(false);
  const toggleFavorite = async () => {
    setSavingFavorite(true);
    await update({ ...item, favorite: !item.favorite });
    setSavingFavorite(false);
  };
  const parent = item.parentId ? allItems.find(x => x.id === item.parentId) : undefined;
  const childCount = parts.length;
  return (
    <div className="overlay">
      <aside className="drawer">
        <button className="close" onClick={close}><X /></button>
        <div className="cover" style={{ backgroundImage: `linear-gradient(0deg,#111116,transparent),url(${item.backdrop})` }} />
        <div className="detail">
          <img src={item.poster || 'https://placehold.co/700x1000/111116/777?text=FRAME'} />
          <div>
            {parent && <button className="breadcrumb" onClick={() => open(parent)}>← {parent.title}</button>}
            <small>{labelMedium(item.medium)} · {labelStatus(item.status)}{item.anilistId ? ' · AniList #' + item.anilistId : ''}</small>
            <h1>{item.title}</h1>
            {item.alternativeTitles?.length ? <p className="alt-titles"><b>Also known as:</b> {item.alternativeTitles.join(' · ')}</p> : null}
            <p>{item.description || 'No description available.'}</p>
            {item.notes && <div className="notes"><b>Notes</b><p>{item.notes}</p></div>}
            <div className="tags">{item.genres.map(x => <span key={x}>{x}</span>)}</div>
            <div className="bar"><i style={{ width: (summary.total ? Math.min(100, summary.progress / summary.total * 100) : Math.min(100, summary.progress / 20)) + '%' }} /></div>
            <div className="meta"><span>{summary.progress}{summary.total ? ' / ' + summary.total : ''}{childCount ? ' · ' + childCount + ' child' + (childCount === 1 ? '' : 'ren') : ''}</span><span>{item.year || '—'}</span><span>★ {item.score ?? '—'}</span></div>
            {item.season && <div className="info-line">Season: {item.season} {item.year ?? ''}</div>}
            {item.duration && <div className="info-line">Duration: {item.duration} min · {item.airStart || '—'}{item.airEnd ? ' → ' + item.airEnd : ''}</div>}
            {item.studio && <div className="info-line">Studio: {item.studio}</div>}
            {item.source && <div className="info-line">Source: {item.source}</div>}
            <div className="detail-actions">
              <button className="primary" onClick={edit}><Pencil />Edit details</button>
              <button className="secondary" disabled={savingFavorite} onClick={() => void toggleFavorite()}><Heart fill={item.favorite ? 'currentColor' : 'none'} />{item.favorite ? 'Unfavorite' : 'Favorite'}</button>
              {item.anilistId && <button className="secondary" onClick={() => refresh(item)}><RefreshCw />Refresh metadata</button>}
              <button className="danger" onClick={remove}><Trash2 />Delete</button>
            </div>
          </div>
        </div>
        {parts.length > 0 && <div className="parts"><h3>{item.parentId ? 'Child parts' : 'Seasons & parts'}</h3>{parts.map(x =>
          <button key={x.id} onClick={() => open(x)}><img src={x.poster || 'https://placehold.co/240x360/111116/777?text=FRAME'} /><span>{x.title}</span><small>{labelStatus(x.status)} · {x.progress}{x.total ? '/' + x.total : ''}</small></button>
        )}</div>}
      </aside>
    </div>
  );
}

function Editor({ item, close, save, isNew = false, parentOptions = [] }: { item: MediaItem; close: () => void; save: (x: MediaItem) => Promise<void> | void; isNew?: boolean; parentOptions?: MediaItem[] }) {
  const [d, setD] = useState(item); const [saving, setSaving] = useState(false);
  const set = (k: keyof MediaItem, v: unknown) => setD(x => ({ ...x, [k]: v }));
  const submit = async () => { if (!d.title.trim()) return; if (d.progress < 0 || d.progress > 2000 || (d.total != null && d.total < 0)) return; setSaving(true); await save({ ...d, title: d.title.trim(), progress: Math.min(2000, Math.max(0, Math.round(d.progress))) }); setSaving(false); };
  return <div className="modalwrap"><div className="modal"><div className="modalhead"><div><small>{isNew ? 'ADD TO LIBRARY' : 'EDITOR'}</small><h2>{isNew ? 'Add media' : 'Edit media'}</h2></div><button onClick={close}><X /></button></div><div className="form">
    <label>Title<input value={d.title} onChange={e => set('title', e.target.value)} autoFocus /></label>
    <label>Media type<select value={d.medium} onChange={e => set('medium', e.target.value as Medium)}>{mediaTypes.map(x => <option key={x} value={x}>{labelMedium(x)}</option>)}</select></label>
    <label>Status<select value={d.status} onChange={e => set('status', e.target.value as Status)}>{statuses.map(x => <option key={x} value={x}>{labelStatus(x)}</option>)}</select></label>
    <label>Parent media<select value={d.parentId ?? ''} onChange={e => set('parentId', e.target.value || undefined)}><option value="">No parent (top level)</option>{parentOptions.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
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
function MenuPanel({ close, page, setPage }: { close: () => void; page: string; setPage: (x: string) => void }) { const rows: [string, string, typeof Film][] = [['home','Home',Film],['library','Library',LibraryIcon],['discover','Discover',Compass],['calendar','Release Radar',CalendarDays],['stats','Statistics',BarChart3],['notifications','Notifications',Bell],['settings','Settings',Settings]]; return <div className="menuoverlay" onClick={close}><aside className="menu" onClick={e => e.stopPropagation()}><div className="menulogo"><b>F</b>FRAME<button onClick={close}><X /></button></div>{rows.map(([id,label,Icon]) => <button className={page === id ? 'selected' : ''} key={id} onClick={() => {setPage(id);close();}}><Icon />{label}</button>)}<div className="menubottom"><button><Settings />Settings</button><button className="signout" onClick={() => void signOut()}>Log out</button><p>FRAME v2.0<br />Your personal media universe.</p></div></aside></div> }

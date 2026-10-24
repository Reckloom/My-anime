import {useEffect,useMemo,useState} from 'react';
import type {Dispatch,SetStateAction} from 'react';
import {CalendarDays,SlidersHorizontal,ChevronLeft,ChevronRight,Plus,RefreshCw,Search,Check,Clock3,Save,X,ExternalLink,Play,Star,Users,Heart,Globe2,Building2,Timer,Tag} from 'lucide-react';
import type {MediaItem} from '../types';
import {FrameArtwork} from './FrameArtwork';
import {supabase} from '../lib/supabase';

type CatalogRow={
 id:number;
 title:{romaji?:string|null;english?:string|null;native?:string|null;userPreferred?:string|null};
 synonyms?:string[];
 description?:string|null;
 coverImage?:{extraLarge?:string|null;large?:string|null}|null;
 bannerImage?:string|null;
 genres?:string[];
 tags?:{name?:string|null}[];
 season?:string|null;
 seasonYear?:number|null;
 averageScore?:number|null;
 popularity?:number|null;
 episodes?:number|null;
 duration?:number|null;
 status?:string|null;
 format?:string|null;
 startDate?:{year?:number|null;month?:number|null;day?:number|null}|null;
 endDate?:{year?:number|null;month?:number|null;day?:number|null}|null;
 nextAiringEpisode?:{episode?:number|null;airingAt?:number|null}|null;
 studios?:{nodes?:{name?:string|null}[]}|null;
 siteUrl?:string|null;
 countryOfOrigin?:string|null;
 source?:string|null;
 hashtag?:string|null;
 favourites?:number|null;
 isLicensed?:boolean|null;
 isAdult?:boolean|null;
 rankings?:{rank?:number|null;type?:string|null;allTime?:boolean|null;context?:string|null;season?:string|null;year?:number|null}[];
 relations?:{edges?:{relationType?:string|null;node?:{id?:number|null;type?:string|null;format?:string|null;status?:string|null;title?:{userPreferred?:string|null;english?:string|null;romaji?:string|null;native?:string|null};coverImage?:{large?:string|null}}}[]}|null;
};
type Props={library:MediaItem[];open:(item:MediaItem)=>void;add:(item:MediaItem)=>Promise<boolean|void>;update?:(item:MediaItem)=>Promise<boolean|void>;guest?:boolean};

type CatalogCache={savedAt:number;results:CatalogRow[];pageInfo?:Record<string,unknown>};
const CATALOG_CACHE_TTL=5*60*1000;
const UPCOMING_CACHE_TTL=15*60*1000;
const cacheKey=(body:Record<string,unknown>)=>'frame-anime-catalog:'+btoa(unescape(encodeURIComponent(JSON.stringify(body))));
function readCatalogCache(body:Record<string,unknown>,ttl:number){
 try{const raw=sessionStorage.getItem(cacheKey(body));if(!raw)return null;const parsed=JSON.parse(raw) as CatalogCache;if(!parsed?.savedAt||Date.now()-parsed.savedAt>ttl)return null;return parsed}catch{return null}
}
function writeCatalogCache(body:Record<string,unknown>,value:{results:CatalogRow[];pageInfo?:Record<string,unknown>}){
 try{sessionStorage.setItem(cacheKey(body),JSON.stringify({savedAt:Date.now(),...value}))}catch{}
}

const titleOf=(x:CatalogRow)=>x.title.userPreferred||x.title.english||x.title.romaji||x.title.native||'Untitled';
const clean=(x?:string|null)=>(x||'').replace(/<br\s*\/?>(\s*)/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
function toMedia(x:CatalogRow,existing?:MediaItem):MediaItem{
 const title=titleOf(x);
 const total=x.episodes==null?undefined:Number(x.episodes);
 return {
  ...(existing||{}),
  id:existing?.id||crypto.randomUUID(),
  anilistId:x.id,
  sourceProvider:'anilist',
  externalId:String(x.id),
  title,
  alternativeTitles:[x.title.english,x.title.romaji,x.title.native,...(x.synonyms||[])].filter((v,i,a)=>Boolean(v)&&v!==title&&a.indexOf(v)===i) as string[],
  description:clean(x.description),
  poster:existing?.poster||String(x.coverImage?.extraLarge||x.coverImage?.large||''),
  backdrop:existing?.backdrop||String(x.bannerImage||''),
  medium:'anime',
  status:existing?.status||'planned',
  progress:existing?.progress||0,
  total,
  year:x.seasonYear==null?undefined:Number(x.seasonYear),
  score:x.averageScore==null?undefined:Number(x.averageScore)/10,
  popularity:x.popularity==null?undefined:Number(x.popularity),
  genres:x.genres||[],
  themes:(x.tags||[]).map(t=>String(t.name||'')).filter(Boolean),
  studio:x.studios?.nodes?.map(s=>s.name).filter(Boolean).join(', ')||undefined,
  source:'AniList',
  season:x.season||undefined,
  duration:x.duration==null?undefined:Number(x.duration),
  airStart:x.startDate?.year?([x.startDate.year,x.startDate.month,x.startDate.day].filter(Boolean).join('-')):undefined,
  airEnd:x.endDate?.year?([x.endDate.year,x.endDate.month,x.endDate.day].filter(Boolean).join('-')):undefined,
  favorite:existing?.favorite||false ,
  notes:existing?.notes||''
 };
}
async function invoke(body:Record<string,unknown>){
 if(!supabase)throw new Error('FRAME data connection is not configured.');
 const {data,error}=await supabase.functions.invoke('anime-catalogue',{body});
 if(error)throw error;
 if(data?.error)throw new Error(String(data.error));
 return data;
}
export function FrameAnimeCatalogPage({library,open,add,update}:Props){
 const [tab,setTab]=useState<'browse'|'upcoming'|'mine'>('browse');
 const [query,setQuery]=useState('');
 const [page,setPage]=useState(1);
 const [rows,setRows]=useState<CatalogRow[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [sort,setSort]=useState('POPULARITY_DESC');
 const [status,setStatus]=useState('ALL');
 const [format,setFormat]=useState('ALL');
 const [season,setSeason]=useState('ALL');
 const [busyId,setBusyId]=useState<number|null>(null);
 const [lastUpdated,setLastUpdated]=useState('');
 const [selectedMine,setSelectedMine]=useState('ALL');
 const [pageInfo,setPageInfo]=useState<Record<string,unknown>>({});
 const [savingProgress,setSavingProgress]=useState<string|null>(null);
 const [progressDraft,setProgressDraft]=useState<Record<string,string>>({});
 const [planDraft,setPlanDraft]=useState<Record<string,string>>({});
 const [detail,setDetail]=useState<{row:CatalogRow;item:MediaItem}|null>(null);
 const [genre,setGenre]=useState('ALL');
  const [filtersOpen,setFiltersOpen]=useState(false);
 const [onlyUntracked,setOnlyUntracked]=useState(false);

 const load=async(force=false)=>{
  setLoading(true);setError('');
  const body=tab==='upcoming'?{action:'upcoming',page,perPage:24}:{action:'browse',page,perPage:24,search:query.trim(),sort,status,format,season};
  const cached=!force?readCatalogCache(body,tab==='upcoming'?UPCOMING_CACHE_TTL:CATALOG_CACHE_TTL):null;
  if(cached){setRows(cached.results);setPageInfo(cached.pageInfo||{});setLastUpdated(new Date(cached.savedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));setLoading(false);return;}
  try{
   const data=await invoke(body);
   const results=Array.isArray(data?.results)?data.results:[];
   setRows(results);setPageInfo((data?.pageInfo&&typeof data.pageInfo==='object'?data.pageInfo:{}));
   writeCatalogCache(body,{results,pageInfo:data?.pageInfo&&typeof data.pageInfo==='object'?data.pageInfo:undefined});
   setLastUpdated(new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
  }catch(e){
   const stale=readCatalogCache(body,365*24*60*60*1000);
   if(stale){setRows(stale.results);setPageInfo(stale.pageInfo||{});setLastUpdated('cached');setError('Live catalogue unavailable — showing cached results.');}
   else setError(e instanceof Error?e.message:'Could not load the anime catalogue.');
  }finally{setLoading(false);}
 };
 useEffect(()=>{setPage(1)},[query,sort,status,format,season,tab]);
 useEffect(()=>{if(tab==='mine')return;const timer=window.setTimeout(()=>void load(),query.trim()?300:0);return()=>window.clearTimeout(timer)},[page,query,sort,status,format,season,tab]);
 useEffect(()=>{if(tab!=='upcoming')return;const timer=window.setInterval(()=>void load(true),15*60*1000);return()=>window.clearInterval(timer)},[tab,page]);

 const mine=useMemo(()=>library.filter(x=>x.medium==='anime'&&!x.parentId),[library]);
 const visibleMine=useMemo(()=>selectedMine==='ALL'?mine:mine.filter(x=>x.status===selectedMine),[mine,selectedMine]);
 const libraryMap=useMemo(()=>new Map(library.filter(x=>x.medium==='anime').map(x=>[x.anilistId||0,x])),[library]);
 const availableGenres=useMemo(()=>[...new Set(rows.flatMap(x=>x.genres||[]))].sort((a,b)=>a.localeCompare(b)),[rows]);
 const displayRows=useMemo(()=>rows.filter(row=>(genre==='ALL'||row.genres?.includes(genre))&&(!onlyUntracked||!libraryMap.has(row.id))),[rows,genre,onlyUntracked,libraryMap]);

 const setNextToWatch=async(item:MediaItem)=>{
  if(!update)return;
  const raw=planDraft[item.id]??String(Math.max(1,Number(item.progress||0)+1));
  const nextEpisode=Math.max(1,Math.min(item.total&&item.total>0?item.total+1:2000,Number(raw)||1));
  setSavingProgress(item.id+'-next');
  try{await update({...item,progress:Math.max(0,nextEpisode-1),status:'watching',notes:(item.notes||'').replace(/\\n?FRAME_NEXT_EPISODE:\\d+/g,'').trim()+'\\nFRAME_NEXT_EPISODE:'+nextEpisode});}
  finally{setSavingProgress(null)}
 };

 const saveProgress=async(item:MediaItem)=>{
  if(!update)return;
  const raw=progressDraft[item.id]??String(item.progress||0);
  const max=item.total&&item.total>0?item.total:2000;
  const next=Math.max(0,Math.min(max,Number(raw)||0));
  setSavingProgress(item.id);
  try{await update({...item,progress:next,status:next>0?(item.total&&next>=item.total?'completed':'watching'):item.status==='completed'?'watching':item.status});}
  finally{setSavingProgress(null)}
 };

 const showDetail=(row:CatalogRow,existing?:MediaItem)=>setDetail({row,item:toMedia(row,existing)});

 const addOrOpen=async(row:CatalogRow)=>{
  const existing=libraryMap.get(row.id);
  if(existing){open(existing);return;}
  const item=toMedia(row);
  setBusyId(row.id);
  try{
   const ok=await add(item);
   if(ok!==false)open(item);
  }finally{setBusyId(null);}
 };

 return <section className="frame-anime-catalog-page">
  <div className="frame-catalog-head">
   <div><small>FRAME ANIME CATALOGUE</small><h1>Every anime. One place.</h1><p>Browse the live catalogue without loading thousands of cards into your phone at once. Your watch state stays in FRAME.</p></div>
   <button className="secondary" type="button" onClick={()=>tab==='mine'?setTab('browse'):void load()} disabled={loading}><RefreshCw size={15} className={loading?'spin':''}/> {loading?'Updating…':'Refresh'}</button>
  </div>
  <div className="frame-catalog-tabs">
   <button className={tab==='browse'?'active':''} onClick={()=>setTab('browse')}>Browse</button>
   <button className={tab==='upcoming'?'active':''} onClick={()=>setTab('upcoming')}><CalendarDays size={15}/> Upcoming</button>
   <button className={tab==='mine'?'active':''} onClick={()=>setTab('mine')}>My Anime <span>{mine.length}</span></button>
  </div>
  {tab!=='mine'&&<div className="frame-catalog-tools">
   <label className="frame-catalog-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search every anime…" aria-label="Search every anime"/></label>
   <select value={sort} onChange={e=>setSort(e.target.value)}><option value="POPULARITY_DESC">Most popular</option><option value="SCORE_DESC">Top rated</option><option value="START_DATE_DESC">Newest</option><option value="UPDATED_AT_DESC">Recently updated</option><option value="EPISODES_DESC">Most episodes</option></select>
   <select value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">Any status</option><option value="RELEASING">Airing</option><option value="FINISHED">Finished</option><option value="NOT_YET_RELEASED">Upcoming</option><option value="HIATUS">Hiatus</option></select>
   <select value={format} onChange={e=>setFormat(e.target.value)}><option value="ALL">Any format</option><option value="TV">TV</option><option value="TV_SHORT">TV Short</option><option value="MOVIE">Movie</option><option value="ONA">ONA</option><option value="OVA">OVA</option><option value="SPECIAL">Special</option></select>
   <select value={season} onChange={e=>setSeason(e.target.value)}><option value="ALL">Any season</option><option value="WINTER">Winter</option><option value="SPRING">Spring</option><option value="SUMMER">Summer</option><option value="FALL">Fall</option></select>
   <select value={genre} onChange={e=>setGenre(e.target.value)}><option value="ALL">Any genre</option>{availableGenres.map(g=><option key={g} value={g}>{g}</option>)}</select>
   <button type="button" className={onlyUntracked?'secondary active':'secondary'} onClick={()=>setOnlyUntracked(x=>!x)}>{onlyUntracked?<Check size={14}/>:<Plus size={14}/>} {onlyUntracked?'Untracked only':'Hide My Anime'}</button>
  </div>}
  {tab==='mine'&&<div className="frame-catalog-tools"><select value={selectedMine} onChange={e=>setSelectedMine(e.target.value)}><option value="ALL">All my anime</option><option value="watching">Watching</option><option value="planned">Plan to Watch</option><option value="completed">Completed</option><option value="paused">Paused</option><option value="dropped">Dropped</option></select><span className="frame-catalog-count">{visibleMine.length} titles</span></div>}
  {error&&<div className="frame-catalog-error"><b>Catalogue temporarily unavailable</b><span>{error}</span><button className="secondary" onClick={()=>void load()}><RefreshCw size={14}/> Retry</button></div>}
  {loading&&tab!=='mine'?<div className="frame-catalog-grid">{Array.from({length:12},(_,i)=><div className="frame-catalog-skeleton" key={i}/>)}</div>:
   <div className="frame-catalog-grid">
    {(tab==='mine'?visibleMine:displayRows).map((row:any)=>{
      const source=tab==='mine'?row as MediaItem:row as CatalogRow;
      const existing=tab==='mine'?row as MediaItem:libraryMap.get(row.id);
      const item=tab==='mine'?row as MediaItem:toMedia(row as CatalogRow,existing);
      const title=tab==='mine'?item.title:titleOf(row as CatalogRow);
      const progress=Number(item.progress||0),total=item.total;
      const pct=total&&total>0?Math.min(100,Math.round(progress/total*100)):0;
      const upcoming=tab!=='mine'&&((row as CatalogRow).status==='NOT_YET_RELEASED');
      return <article className="frame-catalog-card" key={item.anilistId||item.id}>
       <button className="frame-catalog-poster" onClick={()=>showDetail(row as CatalogRow,existing)}>
        <FrameArtwork title={title} medium="anime" poster={item.poster} anilistId={item.anilistId} alt={title} loading="lazy"/>
        {upcoming&&<span className="frame-catalog-badge">UPCOMING</span>}
        {existing&&<span className="frame-catalog-owned">{item.status==='completed'?<Check size={12}/>:<Clock3 size={12}/>} {item.status==='planned'?'PLAN':item.status.toUpperCase()}</span>}
       </button>
       <div className="frame-catalog-copy">
        <button className="frame-catalog-title" onClick={()=>showDetail(row as CatalogRow,existing)}>{title}</button>
        <div className="frame-catalog-meta"><span>{row.format||'ANIME'}</span><span>{row.seasonYear||item.year||'—'}</span><span>{row.episodes||item.total||'—'} eps</span></div>
        <div className="frame-catalog-score">{row.averageScore?('★ '+(Number(row.averageScore)/10).toFixed(1)):item.score?('★ '+item.score.toFixed(1)):'No score'}{row.popularity?(' · '+Number(row.popularity).toLocaleString()+' popularity'):''}{row.favourites?(' · '+Number(row.favourites).toLocaleString()+' favourites'):''}</div>
        {tab!=='mine'&&<div className="frame-catalog-details">{row.countryOfOrigin&&<span>{row.countryOfOrigin}</span>}{row.studios?.nodes?.length&&<span>{row.studios.nodes.slice(0,2).map((s:{name?:string|null})=>s.name).filter(Boolean).join(' · ')}</span>}{row.duration&&<span>{row.duration} min/ep</span>}</div>}
        {tab!=='mine'&&row.description&&<p className="frame-catalog-description">{clean(row.description).slice(0,150)}{clean(row.description).length>150?'…':''}</p>}
        {tab!=='mine'&&row.nextAiringEpisode?.episode&&<small className="frame-catalog-next">Next: EP {row.nextAiringEpisode.episode}{row.nextAiringEpisode.airingAt?(' · '+new Date(Number(row.nextAiringEpisode.airingAt)*1000).toLocaleDateString()):''}</small>}
        {existing&&<div className="frame-catalog-progress"><i style={{width:pct+'%'}}/><span>{progress}/{total||'—'}</span></div>}
        {existing&&update&&<>
          <div className="frame-catalog-quick-progress">
            <label><span>Watched through</span><input type="number" min="0" max={total&&total>0?total:2000} inputMode="numeric" value={progressDraft[item.id]??String(progress)} onChange={e=>setProgressDraft(prev=>({...prev,[item.id]:e.target.value}))}/></label>
            <button className="secondary" type="button" disabled={savingProgress===item.id} onClick={()=>void saveProgress(item)}>{savingProgress===item.id?<RefreshCw size={13} className="spin"/>:<Save size={13}/>} Watched through</button>
          </div>
          <div className="frame-catalog-quick-progress frame-catalog-plan-progress">
            <label><span>Next episode to watch</span><input type="number" min="1" max={total&&total>0?total+1:2000} inputMode="numeric" value={planDraft[item.id]??String(Math.max(1,progress+1))} onChange={e=>setPlanDraft(prev=>({...prev,[item.id]:e.target.value}))}/></label>
            <button className="secondary" type="button" disabled={savingProgress===item.id+'-next'} onClick={()=>void setNextToWatch(item)}>{savingProgress===item.id+'-next'?<RefreshCw size={13} className="spin"/>:<Clock3 size={13}/>} Set next</button>
          </div>
        </>}
        {!existing&&<button className="secondary frame-catalog-add" disabled={busyId===row.id} onClick={()=>void addOrOpen(row)}>{busyId===row.id?'Adding…':<><Plus size={14}/> {upcoming?'Add to plan':'Add to FRAME'}</>}</button>}
       </div>
      </article>
    })}
   </div>}
  {detail&&<AnimeDetailPanel detail={detail} update={update} savingProgress={savingProgress} progressDraft={progressDraft} planDraft={planDraft} setProgressDraft={setProgressDraft} setPlanDraft={setPlanDraft} saveProgress={saveProgress} setNextToWatch={setNextToWatch} close={()=>setDetail(null)} openEpisodeList={()=>{setDetail(null);open(detail.item)}}/>}
  {!loading&&tab!=='mine'&&!displayRows.length&&<div className="frame-catalog-empty"><h3>{rows.length?'No anime matches these filters.':'No anime found.'}</h3><p>{rows.length?'Clear the genre or library filter to see more titles.':'Try another title or remove a filter.'}</p>{rows.length&&<button className="secondary" onClick={()=>{setGenre('ALL');setOnlyUntracked(false)}}>Clear local filters</button>}</div>}
  {tab!=='mine'&&<div className="frame-catalog-pagination"><button className="secondary" disabled={page<=1||loading} onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronLeft size={15}/> Previous</button><span>Page {page}</span><button className="secondary" disabled={loading||rows.length<24} onClick={()=>setPage(p=>p+1)}>Next <ChevronRight size={15}/></button>{lastUpdated&&<small>Updated {lastUpdated}</small>}</div>}
 </section>;
}

function AnimeDetailPanel({detail,update,savingProgress,progressDraft,planDraft,setProgressDraft,setPlanDraft,saveProgress,setNextToWatch,close,openEpisodeList}:{detail:{row:CatalogRow;item:MediaItem};update?:Props['update'];savingProgress:string|null;progressDraft:Record<string,string>;planDraft:Record<string,string>;setProgressDraft:Dispatch<SetStateAction<Record<string,string>>>;setPlanDraft:React.Dispatch<React.SetStateAction<Record<string,string>>>;saveProgress:(item:MediaItem)=>Promise<void>;setNextToWatch:(item:MediaItem)=>Promise<void>;close:()=>void;openEpisodeList:()=>void}){
 const {row,item}=detail;
 const title=titleOf(row);
 const description=clean(row.description);
 const progress=Number(item.progress||0);
 const total=item.total;
 const pct=total&&total>0?Math.min(100,Math.round(progress/total*100)):0;
 const studios=(row.studios?.nodes||[]).map(s=>s.name).filter(Boolean) as string[];
 const tags=(row.tags||[]).map(t=>t.name).filter(Boolean) as string[];
 const relations=(row.relations?.edges||[]).filter(e=>e.node?.id);
 const rank=(row.rankings||[]).find(r=>r.type==='RATED'&&r.allTime)?.rank;
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close()}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[close]);
 return <div className="frame-detail-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
  <aside className="frame-detail-panel">
   <button className="frame-detail-close" type="button" onClick={close} aria-label="Close details"><X size={18}/></button>
   <div className="frame-detail-hero" style={row.bannerImage?{backgroundImage:'linear-gradient(90deg,rgba(7,7,8,.98),rgba(7,7,8,.75) 48%,rgba(7,7,8,.25)),linear-gradient(0deg,#070708,transparent 60%),url("'+row.bannerImage+'")'}:undefined}>
    <div className="frame-detail-hero-copy">
     <div className="frame-detail-kicker">{row.format||'ANIME'} {row.seasonYear?'· '+row.seasonYear:''} {row.status?'· '+row.status.replaceAll('_',' '):''}</div>
     <h2>{title}</h2>
     <div className="frame-detail-alt">{[row.title.english,row.title.romaji,row.title.native].filter(Boolean).filter(v=>v!==title).slice(0,2).join(' · ')}</div>
     <div className="frame-detail-actions"><button className="primary" type="button" onClick={openEpisodeList}><Play size={15}/> Open episodes</button><button type="button" onClick={openEpisodeList}>Open in FRAME</button></div>
    </div>
    <div className="frame-detail-poster"><FrameArtwork title={title} medium="anime" poster={item.poster} anilistId={item.anilistId} alt={title}/></div>
   </div>
   <div className="frame-detail-body">
    <div className="frame-detail-stats"><span><Star size={14}/> {row.averageScore?(Number(row.averageScore)/10).toFixed(1)+'/10':'—'}</span><span><Users size={14}/> {row.popularity?Number(row.popularity).toLocaleString():'—'}</span><span><Heart size={14}/> {row.favourites?Number(row.favourites).toLocaleString():'—'}</span>{rank&&<span># {rank} all-time</span>}</div>
    {description&&<section className="frame-detail-section"><h3>Synopsis</h3><p>{description}</p></section>}
    <section className="frame-detail-section"><h3>Anime details</h3><div className="frame-detail-facts"><span><Globe2 size={13}/> {row.countryOfOrigin||'Unknown origin'}</span><span><Timer size={13}/> {row.duration?row.duration+' min / episode':'Duration unknown'}</span><span><Tag size={13}/> {row.episodes?row.episodes+' episodes':'Episode count unknown'}</span><span><Building2 size={13}/> {studios.length?studios.join(', '):'Studio unknown'}</span><span>Source: {row.source||'Unknown'}</span>{row.startDate?.year&&<span>Started: {[row.startDate.year,row.startDate.month,row.startDate.day].filter(Boolean).join('-')}</span>}{row.endDate?.year&&<span>Ended: {[row.endDate.year,row.endDate.month,row.endDate.day].filter(Boolean).join('-')}</span>}</div></section>
    {row.genres?.length&&<section className="frame-detail-section"><h3>Genres</h3><div className="frame-detail-chips">{row.genres.map(g=><span key={g}>{g}</span>)}</div></section>}
    {tags.length>0&&<section className="frame-detail-section"><h3>Tags</h3><div className="frame-detail-chips muted">{tags.slice(0,18).map(t=><span key={t}>{t}</span>)}</div></section>}
    {row.nextAiringEpisode?.episode&&<section className="frame-detail-airing"><div><small>NEXT EPISODE</small><b>Episode {row.nextAiringEpisode.episode}</b></div><span>{row.nextAiringEpisode.airingAt?new Date(Number(row.nextAiringEpisode.airingAt)*1000).toLocaleString():''}</span></section>}
    {update&&<section className="frame-detail-section"><div className="frame-detail-progress-head"><h3>My progress</h3><strong>{progress}/{total||'—'} {pct?'· '+pct+'%':''}</strong></div><div className="frame-detail-progress"><i style={{width:pct+'%'}}/></div><div className="frame-detail-controls"><label>Watched through<input type="number" min="0" max={total||2000} inputMode="numeric" value={progressDraft[item.id]??String(progress)} onChange={e=>setProgressDraft(prev=>({...prev,[item.id]:e.target.value}))}/></label><button type="button" disabled={savingProgress===item.id} onClick={()=>void saveProgress(item)}><Save size={14}/> Save progress</button><label>Next episode<input type="number" min="1" max={total?total+1:2000} inputMode="numeric" value={planDraft[item.id]??String(Math.max(1,progress+1))} onChange={e=>setPlanDraft(prev=>({...prev,[item.id]:e.target.value}))}/></label><button type="button" disabled={savingProgress===item.id+'-next'} onClick={()=>void setNextToWatch(item)}><Clock3 size={14}/> Set next</button></div></section>}
    {relations.length>0&&<section className="frame-detail-section"><h3>Related anime</h3><div className="frame-detail-relations">{relations.slice(0,12).map((edge,i)=>{const n=edge.node!;const rt=String(edge.relationType||'RELATED').replaceAll('_',' ');const nt=n.title?.userPreferred||n.title?.english||n.title?.romaji||n.title?.native||'Untitled';return <div key={String(n.id||i)}><img src={n.coverImage?.large||''} alt="" loading="lazy"/><span><b>{nt}</b><small>{rt}</small></span></div>})}</div></section>}
    {row.siteUrl&&<a className="frame-detail-source" href={row.siteUrl} target="_blank" rel="noreferrer">View full AniList entry <ExternalLink size={13}/></a>}
   </div>
  </aside>
 </div>
}
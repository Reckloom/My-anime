import {useEffect,useMemo,useState} from 'react';
import {CalendarDays,Clock3,RefreshCw,Search,Star,ChevronRight} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {FrameArtwork} from './FrameArtwork';
import type {MediaItem} from '../types';

type Row={id:number;title:any;coverImage?:any;bannerImage?:string|null;averageScore?:number|null;popularity?:number|null;format?:string|null;status?:string|null;seasonYear?:number|null;startDate?:any;nextAiringEpisode?:{episode?:number|null;airingAt?:number|null}|null;episodes?:number|null;genres?:string[]};
type Props={library:MediaItem[];open:(item:MediaItem)=>void};

const title=(r:Row)=>r.title?.userPreferred||r.title?.english||r.title?.romaji||r.title?.native||'Untitled';
const poster=(r:Row)=>String(r.coverImage?.extraLarge||r.coverImage?.large||'');
const media=(r:Row,existing?:MediaItem):MediaItem=>existing||({id:'catalogue-'+r.id,anilistId:r.id,title:title(r),poster:poster(r),backdrop:String(r.bannerImage||''),medium:'anime',status:'planned',progress:0,total:r.episodes||undefined,score:r.averageScore?Number(r.averageScore)/10:undefined} as MediaItem);

export function FrameSchedulePage({library,open}:Props){
 const [mode,setMode]=useState<'tracked'|'upcoming'>('tracked');
 const [tracked,setTracked]=useState<any[]>([]);
 const [upcoming,setUpcoming]=useState<Row[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [query,setQuery]=useState('');
 const existing=new Map(library.filter(x=>x.medium==='anime'&&x.anilistId).map(x=>[Number(x.anilistId),x]));
 const refresh=async()=>{
  if(!supabase)return;
  setBusy(true);setError('');
  try{
   try{
    const {data,error}=await supabase.functions.invoke('release-radar',{body:{action:'refresh'}});
    if(!error)setTracked(Array.isArray(data?.releases)?data.releases:[]);
   }catch(e){if(mode==='tracked')throw e;}
   const q=`query($page:Int!,$perPage:Int!){Page(page:$page,perPage:$perPage,sort:START_DATE,status:NOT_YET_RELEASED){pageInfo{hasNextPage} media(type:ANIME){id title{userPreferred english romaji native} coverImage{large extraLarge} bannerImage averageScore popularity format status seasonYear startDate{year month day} episodes genres nextAiringEpisode{episode airingAt}}}}`;
   const r=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q,variables:{page:1,perPage:24}})});
   const j=await r.json();setUpcoming(Array.isArray(j?.data?.Page?.media)?j.data.Page.media:[]);
  }catch(e){setError(e instanceof Error?e.message:'Schedule unavailable.')}
  finally{setBusy(false)}
 };
 useEffect(()=>{void refresh()},[]);
 const shown=useMemo(()=>{
  const q=query.trim().toLowerCase();
  const list=mode==='tracked'?tracked:upcoming;
  return list.filter((x:any)=>!q||String(mode==='tracked'?x.title:title(x)).toLowerCase().includes(q));
 },[mode,tracked,upcoming,query]);
 const groups=useMemo(()=>{
  const map=new Map<string,any[]>();
  for(const x of shown){
   const raw=mode==='tracked'?x.airingAt:(x.nextAiringEpisode?.airingAt?new Date(Number(x.nextAiringEpisode.airingAt)*1000).toISOString():null);
   if(!raw)continue;
   const key=new Date(raw).toLocaleDateString([], {weekday:'long',month:'short',day:'numeric'});
   const arr=map.get(key)||[];arr.push(x);map.set(key,arr);
  }
  return [...map.entries()];
 },[shown,mode]);
 return <div className="frame-schedule">
  <header className="frame-schedule-head"><div><span>RELEASE INTELLIGENCE</span><h1>Schedule</h1><p>Upcoming episodes for your library, plus the wider anime release calendar.</p></div><button className="secondary" onClick={()=>void refresh()} disabled={busy}>{busy?<RefreshCw className="spin"/>:<RefreshCw/>} {busy?'Updating…':'Refresh'}</button></header>
  {error&&<div className="inline-error">{error}</div>}
  <div className="frame-schedule-switch"><button className={mode==='tracked'?'active':''} onClick={()=>setMode('tracked')}>My releases <b>{tracked.length}</b></button><button className={mode==='upcoming'?'active':''} onClick={()=>setMode('upcoming')}>Upcoming anime <b>{upcoming.length}</b></button><label><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search schedule…"/></label></div>
  {mode==='tracked'&&tracked.length===0&&!busy&&<div className="frame-schedule-empty"><CalendarDays size={25}/><b>No tracked releases yet</b><span>Add an anime to FRAME and its airing schedule will appear here.</span></div>}
  {groups.map(([day,items])=><section className="frame-schedule-day" key={day}><div className="frame-schedule-day-head"><CalendarDays size={15}/><h2>{day}</h2><small>{items.length} release{items.length===1?'':'s'}</small></div><div className="frame-schedule-list">{items.map((x:any)=>{
   const trackedMode=mode==='tracked'; const when=trackedMode?new Date(x.airingAt):new Date(Number(x.nextAiringEpisode?.airingAt)*1000); const ep=trackedMode?x.episode:x.nextAiringEpisode?.episode; const id=trackedMode?Number(x.anilistId):Number(x.id); const item=existing.get(id);
   return <button className="frame-schedule-item" key={String(id)+'-'+String(ep)} onClick={()=>{if(item)open(item)}}><div className="frame-schedule-art">{trackedMode?<FrameArtwork title={x.title} medium="anime" poster={x.poster} anilistId={x.anilistId} alt="" loading="lazy"/>:<FrameArtwork title={title(x)} medium="anime" poster={poster(x)} anilistId={x.id} alt="" loading="lazy"/>}</div><span><b>{trackedMode?x.title:title(x)}</b><small>{ep?'Episode '+ep:'Release'} · {when.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</small>{!trackedMode&&x.averageScore&&<em><Star size={10} fill="currentColor"/> {(Number(x.averageScore)/10).toFixed(1)}</em>}</span><ChevronRight size={15}/></button>;
  })}</div></section>)}
 </div>;
}
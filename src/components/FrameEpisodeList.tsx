import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import {CalendarDays,ChevronLeft,ChevronRight,LoaderCircle,RefreshCw,Search} from 'lucide-react';

type JikanEpisode={
  mal_id:number;
  title?:string|null;
  title_japanese?:string|null;
  aired?:string|null;
  filler?:boolean;
  recap?:boolean;
};
type EpisodeResponse={
  data?:JikanEpisode[];
  pagination?:{last_visible_page?:number;has_next_page?:boolean};
};

type CachedEpisodePage={data:JikanEpisode[];lastPage:number};
const EPISODE_PAGE_CACHE_LIMIT=120;
const episodePageCache=new Map<string,CachedEpisodePage>();
const ANIME_SEARCH_CACHE_LIMIT=256;
const animeSearchCache=new Map<string,string>();
function getCachedAnimeId(key:string){
 const value=animeSearchCache.get(key);
 if(value){animeSearchCache.delete(key);animeSearchCache.set(key,value);}
 return value;
}
function cacheAnimeId(key:string,value:string){
 animeSearchCache.delete(key);animeSearchCache.set(key,value);
 while(animeSearchCache.size>ANIME_SEARCH_CACHE_LIMIT){
  const oldest=animeSearchCache.keys().next().value as string|undefined;
  if(oldest===undefined)break;
  animeSearchCache.delete(oldest);
 }
}
function getCachedEpisodePage(key:string){
 const cached=episodePageCache.get(key);
 if(cached){episodePageCache.delete(key);episodePageCache.set(key,cached);}
 return cached;
}
function cacheEpisodePage(key:string,value:CachedEpisodePage){
 episodePageCache.delete(key);
 episodePageCache.set(key,value);
 while(episodePageCache.size>EPISODE_PAGE_CACHE_LIMIT){
  const oldest=episodePageCache.keys().next().value as string|undefined;
  if(oldest===undefined)break;
  episodePageCache.delete(oldest);
 }
}
async function fetchJikan(url:string,signal:AbortSignal):Promise<Response>{
  if(signal.aborted)throw new DOMException('Aborted','AbortError');
  const direct=()=>fetch(url,{signal});
  if(!supabase)return direct();
  try{
    if(url.includes('/anime?q=')){
      const query=decodeURIComponent((url.split('q=')[1]||'').split('&')[0]);
      const {data,error}=await supabase.functions.invoke('anime-catalogue',{body:{action:'search',query}});
      if(error||data?.error)throw error||new Error(String(data.error));
      return new Response(JSON.stringify({data:Array.isArray(data?.results)?data.results:[]}),{status:200,headers:{'Content-Type':'application/json'}});
    }
    const match=url.match(/anime\/(\d+)\/episodes\?page=(\d+)/);
    if(!match)throw new Error('Unsupported episode lookup request.');
    const {data,error}=await supabase.functions.invoke('anime-catalogue',{body:{action:'episode-page',malId:Number(match[1]),page:Number(match[2])}});
    if(error||data?.error)throw error||new Error(String(data.error));
    return new Response(JSON.stringify({data:Array.isArray(data?.data)?data.data:[],pagination:data?.pagination||{}}),{status:200,headers:{'Content-Type':'application/json'}});
  }catch(primaryError){
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    try{return await direct()}catch{throw primaryError}
  }
}
export function FrameEpisodeList({malId,title,currentProgress,onMarkThrough}:{malId?:string;title:string;currentProgress:number;onMarkThrough:(episode:number)=>Promise<void>}){
  const [resolvedMalId,setResolvedMalId]=useState(malId||'');
  const [resolving,setResolving]=useState(!malId);
  const [page,setPage]=useState(1);
  const [episodes,setEpisodes]=useState<JikanEpisode[]>([]);
  const [lastPage,setLastPage]=useState(1);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [savingEpisode,setSavingEpisode]=useState<number|null>(null);
  const [attempt,setAttempt]=useState(0);
  const [query,setQuery]=useState('');
  const [watchFilter,setWatchFilter]=useState<'all'|'watched'|'unwatched'>('all');
  const [minEpisode,setMinEpisode]=useState('');
  const [maxEpisode,setMaxEpisode]=useState('');

  useEffect(()=>{
    let alive=true;const controller=new AbortController();
    setResolvedMalId(malId||'');setResolving(!malId);setPage(1);setEpisodes([]);setError('');
    if(malId){setResolving(false);return()=>{alive=false;controller.abort()};}
    const query=title.trim();
    if(!query){setResolving(false);setError('Add a title or MyAnimeList ID to load episodes.');return()=>{alive=false;controller.abort()};}
    const norm=(v:string)=>v.toLocaleLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const cachedId=getCachedAnimeId(norm(query));
    if(cachedId){setResolvedMalId(cachedId);setResolving(false);return()=>{alive=false;controller.abort()};}
    fetchJikan('https://api.jikan.moe/v4/anime?q='+encodeURIComponent(query)+'&limit=8',controller.signal)
      .then(async response=>{
        const raw=await response.text();let data:{data?:Array<{mal_id:number;title?:string|null;title_english?:string|null;title_japanese?:string|null}>};
        try{data=JSON.parse(raw)}catch{throw new Error('Anime lookup returned an invalid response.')}
        if(!response.ok)throw new Error(response.status===429?'Episode source is rate-limiting requests. Wait a moment and retry.':'Could not identify this anime (HTTP '+response.status+').');
        const results=Array.isArray(data.data)?data.data:[];
        const picked=results.find(x=>[x.title,x.title_english,x.title_japanese].some(v=>v&&norm(v)===norm(query)));
        if(!picked?.mal_id)throw new Error('No matching anime was found. Add a MyAnimeList ID in Edit all details and retry.');
        cacheAnimeId(norm(query),String(picked.mal_id));
        if(alive)setResolvedMalId(String(picked.mal_id));
      })
      .catch(e=>{if(alive&&!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof Error?e.message:'Anime lookup failed.')})
      .finally(()=>{if(alive)setResolving(false)});
    return()=>{alive=false;controller.abort()};
  },[malId,title,attempt]);

  useEffect(()=>{
    if(!resolvedMalId)return;
    const controller=new AbortController();let alive=true;
    const cacheKey=resolvedMalId+':'+page;
    const cached=getCachedEpisodePage(cacheKey);
    if(cached){setEpisodes(cached.data);setLastPage(cached.lastPage);setLoading(false);return()=>{alive=false;controller.abort()};}
    setLoading(true);setError('');
    fetchJikan('https://api.jikan.moe/v4/anime/'+encodeURIComponent(resolvedMalId)+'/episodes?page='+page,controller.signal)
      .then(async response=>{
        const raw=await response.text();let data:EpisodeResponse;
        try{data=JSON.parse(raw) as EpisodeResponse}catch{throw new Error('Episode source returned an invalid response.')}
        if(!response.ok)throw new Error(response.status===429?'Episode source is rate-limiting requests. Wait a moment and retry.':'Episode list could not be loaded (HTTP '+response.status+').');
        if(!Array.isArray(data.data))throw new Error('No episode list was returned.');
        const lastPage=Math.max(1,Number(data.pagination?.last_visible_page||1));
        cacheEpisodePage(cacheKey,{data:data.data,lastPage});
        if(alive){setEpisodes(data.data);setLastPage(lastPage);}
      })
      .catch(e=>{if(alive&&!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof Error?e.message:'Episode list could not be loaded.')})
      .finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false;controller.abort()};
  },[resolvedMalId,page,attempt]);

  const visibleEpisodes=episodes.filter(ep=>{
    const n=Number(ep.mal_id);
    const min=minEpisode===''?null:Number(minEpisode), max=maxEpisode===''?null:Number(maxEpisode);
    const hay=[ep.title||'',ep.title_japanese||'',String(n)].join(' ').toLocaleLowerCase();
    return (!query.trim()||hay.includes(query.trim().toLocaleLowerCase())) && (watchFilter==='all'||(watchFilter==='watched'?n<=currentProgress:n>currentProgress)) && (min===null||(!Number.isNaN(min)&&n>=min)) && (max===null||(!Number.isNaN(max)&&n<=max));
  });

  const markThrough=async(episode:number)=>{
    setSavingEpisode(episode);
    try{await onMarkThrough(episode)}finally{setSavingEpisode(null)}
  };

  return <section className="frame-episode-list detail-section" aria-label="Episode list">
    <div className="detail-section-head">
      <div><small>EPISODE CATALOGUE</small><h3>Episodes</h3></div>
      {resolvedMalId&&<a href={'https://myanimelist.net/anime/'+encodeURIComponent(resolvedMalId)+'/'} target="_blank" rel="noreferrer">Source <RefreshCw size={12}/></a>}
    </div>
    <p className="frame-episode-list-summary">{title} · Watched through episode {currentProgress}. Episode titles and air dates load page by page from the MyAnimeList catalogue.</p>
    {resolving?<div className="frame-episode-list-state"><LoaderCircle size={17} className="spin"/> Finding the matching anime…</div>:loading?<div className="frame-episode-list-state"><LoaderCircle size={17} className="spin"/> Loading episode list…</div>:error?<div className="frame-episode-list-state error">{error}<button type="button" className="secondary" onClick={()=>setAttempt(v=>v+1)}>Retry</button></div>:episodes.length===0?<div className="frame-episode-list-state">No episodes were listed by the source.</div>:<>
      <div className="frame-episode-list-rows">
        {episodes.map(ep=><div className={'frame-episode-row '+(ep.mal_id<=currentProgress?'watched':'')} key={ep.mal_id}>
          <span className="frame-episode-number">{ep.mal_id}</span>
          <div className="frame-episode-title"><b>{ep.title||'Episode '+ep.mal_id}</b><small>{ep.aired?new Date(ep.aired).toLocaleDateString(): 'Air date unavailable'}{ep.filler?' · Filler':''}{ep.recap?' · Recap':''}</small></div>
          {ep.mal_id<=currentProgress?<span className="frame-episode-watched">Watched</span>:<button type="button" className="secondary frame-episode-mark" disabled={savingEpisode!==null} onClick={()=>void markThrough(ep.mal_id)}>{savingEpisode===ep.mal_id?'Saving…':'Mark through'}</button>}
        </div>)}
      </div>
      <div className="frame-episode-pagination"><button className="secondary frame-episode-jump" type="button" disabled={page<=1||loading} onClick={()=>setPage(1)}>Oldest</button><button className="secondary" type="button" disabled={page<=1||loading} onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronLeft size={15}/> Previous</button><span>Page {page} of {lastPage}</span><button className="secondary" type="button" disabled={page>=lastPage||loading} onClick={()=>setPage(p=>Math.min(lastPage,p+1))}>Next <ChevronRight size={15}/></button><button className="secondary frame-episode-jump" type="button" disabled={page>=lastPage||loading} onClick={()=>setPage(lastPage)}>Latest</button></div>
    </>}
    <div className="frame-episode-list-foot"><CalendarDays size={13}/> Episode titles and dates are supplied by the external catalogue and may be incomplete or revised.</div>
  </section>;
}

import {useEffect,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,LoaderCircle,RefreshCw} from 'lucide-react';

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

async function fetchJikan(url:string,signal:AbortSignal):Promise<Response>{
  let lastError:unknown;
  for(let attempt=0;attempt<4;attempt++){
    try{
      const response=await fetch(url,{signal,headers:{Accept:'application/json'}});
      if((response.status===429||response.status>=500)&&attempt<3){
        await new Promise(resolve=>setTimeout(resolve,700*(attempt+1)));
        if(signal.aborted)throw new DOMException('Aborted','AbortError');
        continue;
      }
      return response;
    }catch(error){
      if(signal.aborted)throw error;
      lastError=error;
      if(attempt<3)await new Promise(resolve=>setTimeout(resolve,700*(attempt+1)));
    }
  }
  throw lastError instanceof Error?lastError:new Error('Anime episode service is temporarily unavailable.');
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

  useEffect(()=>{
    let alive=true;const controller=new AbortController();
    setResolvedMalId(malId||'');setResolving(!malId);setPage(1);setEpisodes([]);setError('');
    if(malId){setResolving(false);return()=>{alive=false;controller.abort()};}
    const query=title.trim();
    if(!query){setResolving(false);setError('Add a title or MyAnimeList ID to load episodes.');return()=>{alive=false;controller.abort()};}
    fetchJikan('https://api.jikan.moe/v4/anime?q='+encodeURIComponent(query)+'&limit=8',controller.signal)
      .then(async response=>{
        const raw=await response.text();let data:{data?:Array<{mal_id:number;title?:string|null;title_english?:string|null;title_japanese?:string|null}>};
        try{data=JSON.parse(raw)}catch{throw new Error('Anime lookup returned an invalid response.')}
        if(!response.ok)throw new Error(response.status===429?'Episode source is rate-limiting requests. Wait a moment and retry.':'Could not identify this anime (HTTP '+response.status+').');
        const results=Array.isArray(data.data)?data.data:[];
        const norm=(v:string)=>v.toLocaleLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
        const picked=results.find(x=>[x.title,x.title_english,x.title_japanese].some(v=>v&&norm(v)===norm(query)))||results[0];
        if(!picked?.mal_id)throw new Error('No matching anime was found. Add a MyAnimeList ID in Edit all details and retry.');
        if(alive)setResolvedMalId(String(picked.mal_id));
      })
      .catch(e=>{if(alive&&!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof Error?e.message:'Anime lookup failed.')})
      .finally(()=>{if(alive)setResolving(false)});
    return()=>{alive=false;controller.abort()};
  },[malId,title,attempt]);

  useEffect(()=>{
    if(!resolvedMalId)return;
    const controller=new AbortController();let alive=true;
    setLoading(true);setError('');
    fetchJikan('https://api.jikan.moe/v4/anime/'+encodeURIComponent(resolvedMalId)+'/episodes?page='+page,controller.signal)
      .then(async response=>{
        const raw=await response.text();let data:EpisodeResponse;
        try{data=JSON.parse(raw) as EpisodeResponse}catch{throw new Error('Episode source returned an invalid response.')}
        if(!response.ok)throw new Error(response.status===429?'Episode source is rate-limiting requests. Wait a moment and retry.':'Episode list could not be loaded (HTTP '+response.status+').');
        if(!Array.isArray(data.data))throw new Error('No episode list was returned.');
        if(alive){setEpisodes(data.data);setLastPage(Math.max(1,Number(data.pagination?.last_visible_page||1)));}
      })
      .catch(e=>{if(alive&&!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof Error?e.message:'Episode list could not be loaded.')})
      .finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false;controller.abort()};
  },[resolvedMalId,page,attempt]);

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

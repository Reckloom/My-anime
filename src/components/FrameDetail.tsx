import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Check,ChevronLeft,ChevronRight,Edit3,ExternalLink,Heart,RefreshCw,Star,X} from 'lucide-react';
import type {MediaAvailability,MediaItem,Status} from '../types';
import {aniList,DETAIL_QUERY,titleOf,cleanDescription} from '../anilist';
import {supabase} from '../lib/supabase';
import {posterImageSrc} from '../posterImage';
import {FrameEpisodeList} from './FrameEpisodeList';
import {FrameCharacterArchive} from './FrameCharacterArchive';

const labels:Record<Status,string>={watching:'Watching',reading:'Reading',playing:'Playing',completed:'Completed',planned:'Planned',paused:'Paused',dropped:'Dropped'};
const units={anime:'episodes',manga:'chapters',manhwa:'chapters','light-novel':'chapters','visual-novel':'%',movie:'watch state',series:'episodes',game:'%',book:'pages'} as const;
const types:Record<MediaItem['medium'],string>={anime:'Anime',manga:'Manga',manhwa:'Manhwa','light-novel':'Light Novel','visual-novel':'Visual Novel',movie:'Movie',series:'Series',game:'Game',book:'Book'};
const statuses=Object.entries(labels) as [Status,string][];
const links=(m:MediaItem)=>{const q=encodeURIComponent(m.title);return [
 m.anilistId?{label:'AniList',url:'https://anilist.co/'+(['manga','manhwa','light-novel'].includes(m.medium)?'manga':'anime')+'/'+m.anilistId}:null,
 m.game?.storeUrl?{label:'Store',url:m.game.storeUrl}:null,
 {label:'IMDb',url:m.episode?.imdbEpisodeUrl||('https://www.imdb.com/find/?q='+encodeURIComponent(m.title))},{label:'Google Images',url:m.episode?.googleImageSearchUrl||('https://www.google.com/search?tbm=isch&q='+encodeURIComponent(m.title+' official still'))},{label:'JustWatch',url:'https://www.justwatch.com/in/search?q='+q},{label:'Google',url:'https://www.google.com/search?q='+q+' official watch buy'}
 ].filter(Boolean) as {label:string;url:string}[]};

function listValue(value?:string[]){return(value||[]).join(', ')}
function parseList(value:string){return [...new Set(value.split(/[,\n]/).map(x=>x.trim()).filter(Boolean))]}
function numberOrUndefined(value:string){return value.trim()===''?undefined:Number(value)}
function hierarchyPartOrder(item:MediaItem){
 const t=item.title.trim().toLowerCase();
 const exact:Record<string,number>={
  'steins;gate':10,
  'steins;gate: oukoubakko no poriomania':20,
  'steins;gate: fuka ryouiki no déjà vu':30,
  'steins;gate: kyoukaimenjou no missing link - divide by zero':40,
  'steins;gate 0':50,
  'steins;gate 0: kesshou takei no valentine - bittersweet day':60,
  'attack on titan season 1':10,
  'attack on titan season 2':20,
  'attack on titan season 3':30,
  'attack on titan season 3 part 2':40,
  'attack on titan final season':50,
  'attack on titan final season part 2':60,
  'attack on titan final chapters: special 1':70,
  'attack on titan final chapters: special 2':80,
  'vinland saga season 1':10,
  'vinland saga season 2':20,
  'chainsaw man season 1':10,
  'chainsaw man: reze arc':20,
 };
 if(exact[t]!=null)return exact[t];
 const season=t.match(/season\s+(\d+)/i);
 const part=t.match(/part\s+(\d+)/i);
 const cour=t.match(/cour\s+(\d+)/i);
 return (season?Number(season[1])*100:10000)+(part?Number(part[1])*10:0)+(cour?Number(cour[1]):0);
}
function compareHierarchyParts(a:MediaItem,b:MediaItem){
 const arcStart=(item:MediaItem)=>{const match=String(item.externalId||'').match(/^one-piece-arc-(\d+|other)$/);return match?(match[1]==='other'?Number.POSITIVE_INFINITY:Number(match[1])):null};
 const aArc=arcStart(a),bArc=arcStart(b);
 if(aArc!==null&&bArc!==null&&aArc!==bArc)return aArc-bArc;
 const aEpisode=String(a.externalId||'').match(/^one-piece-episode-(\d+)$/),bEpisode=String(b.externalId||'').match(/^one-piece-episode-(\d+)$/);
 if(aEpisode&&bEpisode)return Number(aEpisode[1])-Number(bEpisode[1]);
 const ao=hierarchyPartOrder(a),bo=hierarchyPartOrder(b);
 if(ao!==bo)return ao-bo;
 const ay=a.year??9999,by=b.year??9999;
 if(ay!==by)return ay-by;
 return a.title.localeCompare(b.title,undefined,{numeric:true,sensitivity:'base'});
}

function normaliseAvailability(value?:MediaAvailability):MediaAvailability|undefined{
 if(!value)return undefined;
 const next:MediaAvailability={};
 for(const key of ['watch','buy','read','play'] as const){
  const items=value[key];
  if(items?.length)next[key]=items;
 }
 return Object.keys(next).length?next:undefined;
}

export function FrameDetail({item,library,navigationItems,navigate,close,save,onRefreshMetadata,onDelete}:{item:MediaItem;library:MediaItem[];navigationItems?:MediaItem[];navigate?:(item:MediaItem)=>void;close:()=>void;save:(x:MediaItem)=>void|Promise<boolean>;onRefreshMetadata?: (item:MediaItem)=>Promise<MediaItem>;onDelete?: (id:string)=>Promise<void>}){
 const[d,setD]=useState(item),[note,setNote]=useState(item.notes||''),[refreshing,setRefreshing]=useState(false),[refreshMessage,setRefreshMessage]=useState('');
 const[editing,setEditing]=useState(false),[saving,setSaving]=useState(false),[saveMessage,setSaveMessage]=useState('');
 const[hierarchyQuery,setHierarchyQuery]=useState('');
 const navigationHistory=useRef<Array<{item:MediaItem;overlayScrollTop:number;drawerScrollTop:number;bodyScrollTop:number;pageScrollTop:number}>>([]);
 const pendingScrollRestore=useRef<{item:MediaItem;overlayScrollTop:number;drawerScrollTop:number;bodyScrollTop:number;pageScrollTop:number}|null>(null);
 const openRelated=(next:MediaItem)=>{
  if(next.id!==item.id){
   const overlay=document.querySelector<HTMLElement>('.detail-overlay');
   const drawer=document.querySelector<HTMLElement>('.detail-overlay .detail-drawer');
   const body=document.querySelector<HTMLElement>('.detail-overlay .detail-body');
   navigationHistory.current.push({item,overlayScrollTop:overlay?.scrollTop||0,drawerScrollTop:drawer?.scrollTop||0,bodyScrollTop:body?.scrollTop||0,pageScrollTop:window.scrollY||0});
  }
  navigate?.(next);
 };
 const goBack=()=>{
  const previous=navigationHistory.current.pop();
  if(previous&&navigate){pendingScrollRestore.current=previous;navigate(previous.item);return}
  if(item.parentId){const parent=library.find(x=>x.id===item.parentId);if(parent&&navigate){navigate(parent);return}}
  close();
 };
 const game=d.medium==='game',movie=d.medium==='movie';
 const max=game?100:movie?1:(d.total||500);
 const pct=game||movie?d.progress:(d.progress/(d.total||1)*100);
 const canUseAsParent=(candidate:MediaItem)=>{
  if(candidate.id===d.id)return false;
  let cursor:MediaItem|undefined=candidate,hops=0;
  while(cursor?.parentId&&hops<2000){if(cursor.parentId===d.id)return false;cursor=library.find(x=>x.id===cursor?.parentId);hops++}
  return true;
 };
 useEffect(()=>{
  setD(item);setNote(item.notes||'');setEditing(false);setSaveMessage('');setHierarchyQuery('');
  const overlay=document.querySelector<HTMLElement>('.detail-overlay');
  const drawer=document.querySelector<HTMLElement>('.detail-overlay .detail-drawer');
  const body=document.querySelector<HTMLElement>('.detail-overlay .detail-body');
  const restore=pendingScrollRestore.current;
  if(restore&&restore.item.id===item.id){
   if(overlay)overlay.scrollTop=restore.overlayScrollTop;
   if(drawer)drawer.scrollTop=restore.drawerScrollTop;
   if(body)body.scrollTop=restore.bodyScrollTop;
   window.scrollTo(0,restore.pageScrollTop);
   pendingScrollRestore.current=null;
  }else{
   if(overlay)overlay.scrollTop=0;
   if(drawer)drawer.scrollTop=0;
   if(body)body.scrollTop=0;
  }
 },[item.id]);
 useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous}},[]);
 const progress=(n:number)=>setD(game?{...d,progress:n,game:d.game?{...d.game,storyProgress:n}:undefined}:{...d,progress:Math.max(0,Math.min(max,n))});
 const setTotal=(value:number)=>{const n=Math.max(1,Math.min(2000,value||1));setD({...d,total:n,customTotal:n,progress:Math.min(d.progress,n)})};
 const update=(key:keyof MediaItem,value:unknown)=>setD({...d,[key]:value});
 const saveEdits=async()=>{setSaving(true);setSaveMessage('Saving changes…');try{const ok=await save({...d,notes:note});if(ok){setSaveMessage('Saved.');setEditing(false)}else setSaveMessage('Could not save these changes. Your existing entry was kept.')}catch(e){setSaveMessage(e instanceof Error?e.message:'Could not save these changes.')}finally{setSaving(false)}};
 const refresh=async()=>{if(!onRefreshMetadata)return;setRefreshing(true);setRefreshMessage('Refreshing metadata…');try{const next=await onRefreshMetadata(d);setD({...next,progress:d.progress,total:d.customTotal??next.total,status:d.status,personalRating:d.personalRating,favorite:d.favorite,notes:d.notes,parentId:d.parentId});setRefreshMessage('Metadata refreshed. Save changes to keep it.')}catch{setRefreshMessage('Metadata refresh failed.')}finally{setRefreshing(false)}};
 const gameData=d.game||{};
 const complexity=gameData.complexity||{};
 const availability=d.availability||{};
 const externalLinks=d.externalLinks||{};
 const gamePlatforms=listValue(gameData.platforms);
 const gameModes=listValue(gameData.gameModes);
 const gameDlc=listValue(gameData.dlc);
 const altTitles=listValue(d.alternativeTitles);
 const genres=listValue(d.genres);
 const themes=listValue(d.themes);
 const parentCandidates=useMemo(()=>library.filter(canUseAsParent),[library,d.id,d.parentId]);
 const navItems=navigationItems?.length?navigationItems:[item];
 const navIndex=Math.max(0,navItems.findIndex(x=>x.id===item.id));
 const hasPrevious=navItems.length>1;
 const goPrevious=()=>{if(!navigate||navItems.length<2)return;navigate(navItems[(navIndex-1+navItems.length)%navItems.length])};
 const goNext=()=>{if(!navigate||navItems.length<2)return;navigate(navItems[(navIndex+1)%navItems.length])};
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='ArrowLeft'){e.preventDefault();goPrevious()}else if(e.key==='ArrowRight'){e.preventDefault();goNext()}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[navIndex,navItems.length,navigate]);

 return <div className="overlay detail-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
  <div className="detail-modal-shell">
   {hasPrevious&&<button className="detail-nav-arrow detail-nav-prev" aria-label="Previous media" title="Previous media" onClick={goPrevious}><ChevronLeft size={26}/></button>}
   <aside className="detail-drawer detail-modal" role="dialog" aria-modal="true" aria-labelledby="frame-detail-title">
    <button className="detail-back-bubble" aria-label="Go back" title="Go back" onClick={goBack}><ArrowLeft size={16}/></button>
    <button className="close-btn" aria-label="Close details" onClick={close}><X/></button>
   <div className="detail-body">
    <img className="detail-poster" src={posterImageSrc(d.poster)} alt={d.title} onError={e=>{e.currentTarget.src='/frame-logo.svg';e.currentTarget.classList.add('image-fallback')}}/>
    <div className="detail-main">
     <small>{types[d.medium]} · {labels[d.status]}</small>
     <h2 id="frame-detail-title">{d.title}</h2>
     <div className="detail-rating"><span><Star size={13} fill="currentColor"/> {d.episode?.ratingSource||(d.sourceProvider==='imdb'?'IMDb':'Source')} {d.score==null?'—':d.score.toFixed(1)}{d.episode?.ratingCount?` · ${d.episode.ratingCount.toLocaleString()} ratings`:''}</span><span>Your {d.personalRating==null?'—':d.personalRating.toFixed(1)}</span></div>
     <div className="detail-refresh-row">
      {(d.anilistId||d.sourceProvider==='anilist')&&<button className="secondary" disabled={refreshing} onClick={()=>void refresh()}>{refreshing?<RefreshCw size={13} className="spin"/>:<RefreshCw size={13}/>}Refresh metadata</button>}
      {refreshMessage&&<small>{refreshMessage}</small>}
     </div>
     <p>{d.episode?.synopsis||d.description||'No description available.'}</p>
     {d.episode&&<section className="episode-metadata-panel" aria-label="Episode details">
      <div className="detail-section-head"><h3>Episode details</h3><span>{d.episode.episodeCode}</span></div>
      <div className="episode-metadata-grid">
       <span><small>Season</small><b>{d.episode.seasonNumber}</b></span>
       <span><small>Episode</small><b>{d.episode.episodeNumber}</b></span>
       <span><small>Air date</small><b>{d.episode.airDate||'Not listed'}</b></span>
       <span><small>Runtime</small><b>{d.episode.runtimeMinutes?d.episode.runtimeMinutes+' min':'Not listed'}</b></span>
       <span><small>IMDb ID</small><b>{d.episode.imdbId||'Not listed'}</b></span>
      </div>
      {Boolean(d.episode.directors?.length)&&<p><strong>Director(s):</strong> {d.episode.directors!.join(', ')}</p>}
      {Boolean(d.episode.writers?.length)&&<p><strong>Writer(s):</strong> {d.episode.writers!.join(', ')}</p>}
      {Boolean(d.episode.cast?.length)&&<p><strong>Cast:</strong> {d.episode.cast!.join(', ')}</p>}
      <a className="episode-source-link" href={d.episode.imdbEpisodeUrl||(d.episode.imdbId?'https://www.imdb.com/title/'+d.episode.imdbId+'/':'https://www.imdb.com/find/?q='+encodeURIComponent(d.title))} target="_blank" rel="noreferrer">Open IMDb episode listing <ExternalLink size={13}/></a>
     </section>}
     <div className="tags">{d.genres.slice(0,8).map(x=><span key={x}>{x}</span>)}</div>
     {(externalLinks.imdbId||externalLinks.malId||d.anilistId||externalLinks.anilabId||externalLinks.anilabUrl||externalLinks.officialUrl||externalLinks.newsUrl)&&<section className="detail-external-links" aria-label="External anime links">
      <div className="detail-section-head"><h3>Sources & updates</h3><span>Verified identifiers</span></div>
      <div className="detail-external-link-list">
       {(externalLinks.imdbId)&&<a href={'https://www.imdb.com/title/'+externalLinks.imdbId+'/'} target="_blank" rel="noreferrer">IMDb <ExternalLink size={13}/></a>}
       {externalLinks.malId&&<a href={'https://myanimelist.net/anime/'+externalLinks.malId+'/'} target="_blank" rel="noreferrer">MyAnimeList <ExternalLink size={13}/></a>}
       {d.anilistId&&<a href={'https://anilist.co/anime/'+d.anilistId+'/'} target="_blank" rel="noreferrer">AniList <ExternalLink size={13}/></a>}
       {externalLinks.officialUrl&&<a href={externalLinks.officialUrl} target="_blank" rel="noreferrer">Official site <ExternalLink size={13}/></a>}
       {externalLinks.newsUrl&&<a href={externalLinks.newsUrl} target="_blank" rel="noreferrer">News & announcements <ExternalLink size={13}/></a>}
       {externalLinks.anilabUrl&&<a href={externalLinks.anilabUrl} target="_blank" rel="noreferrer">Open in AniLab <ExternalLink size={13}/></a>}
       {externalLinks.anilabId&&!externalLinks.anilabUrl&&<span className="detail-external-id">AniLab ID: {externalLinks.anilabId}</span>}
      </div>
     </section>}
     <div className="detail-edit-cta"><button className={editing?'secondary active':'secondary'} type="button" onClick={()=>{setEditing(x=>!x);setSaveMessage('')}}>{editing?<X size={15}/>:<Edit3 size={15}/>} {editing?'Close editor':'Edit all details'}</button></div>
    </div>
   </div>

     {d.medium==='anime'&&!d.episode&&d.title.trim().toLowerCase()==='one piece'&&<FrameCharacterArchive/>}

     {d.medium==='anime'&&!d.episode&&!(/^one piece( \(tv\))?$/i.test(d.title.trim())&&library.some(x=>x.parentId===d.id&&String(x.sourceProvider)==='jikan'&&String(x.externalId||'').startsWith('one-piece-arc-')))&&(d.anilistId||d.sourceProvider==='anilist'||d.sourceProvider==='anilist-episode-subpart'||externalLinks.malId)&&<FrameEpisodeList malId={externalLinks.malId} title={d.title} currentProgress={d.progress} onMarkThrough={async episodeNumber=>{
      const nextTotal=Math.max(d.total||0,episodeNumber);
      const next={...d,total:nextTotal,progress:Math.min(nextTotal,episodeNumber)};
      setD(next);setSaveMessage('Saving episode progress…');
      try{const result=await save(next);setSaveMessage(result===false?'Could not save episode progress.':'Episode progress saved.')}catch{setSaveMessage('Could not save episode progress.')}
     }}/>}
   {(()=>{const parentItem=d.parentId?library.find(x=>x.id===d.parentId):undefined;const childParts=library.filter(x=>x.parentId===d.id).sort(compareHierarchyParts);const isOnePieceArc=String(d.externalId||'').startsWith('one-piece-arc-');const query=hierarchyQuery.trim().toLowerCase();const visibleChildParts=childParts.filter(x=>!query||[x.title,x.description,x.episode?.episodeCode,String(x.episode?.episodeNumber||'')].join(' ').toLowerCase().includes(query));const pctFor=(x:MediaItem)=>x.medium==='movie'?(x.progress>=1?100:0):(x.total?Math.max(0,Math.min(100,(x.progress/x.total)*100)):(x.status==='completed'?100:0));return (parentItem||childParts.length>0)&&<section className="detail-section hierarchy-box"><div className="detail-section-head hierarchy-head"><div><small>MEDIA HIERARCHY</small><h3>{isOnePieceArc?'Episodes':(/^one piece( \(tv\))?$/i.test(d.title.trim())?'Story arcs':'Parts & editions')}</h3></div><span>{childParts.length>0?childParts.length+' part'+(childParts.length===1?'':'s'):'Attached'}</span></div>{parentItem&&<button className="hierarchy-parent-card" type="button" onClick={()=>openRelated(parentItem)}><img src={posterImageSrc(parentItem.poster)} alt="" /><div><small>Parent</small><b>{parentItem.title}</b><span>{types[parentItem.medium]} · {parentItem.status==='completed'?'Completed':parentItem.progress+' / '+(parentItem.total||'—')}</span></div><ChevronLeft size={17}/></button>}{childParts.length>12&&<input className="hierarchy-search" type="search" value={hierarchyQuery} onChange={e=>setHierarchyQuery(e.target.value)} placeholder={isOnePieceArc?'Search episodes by title or number…':'Search story arcs…'} aria-label={isOnePieceArc?'Search episodes':'Search story arcs'}/ >}{childParts.length>0&&<><div className="hierarchy-results-count">Showing {visibleChildParts.length} of {childParts.length}</div><div className="hierarchy-parts-grid">{visibleChildParts.map(x=>{const pct=pctFor(x);return <button className="hierarchy-part-card" type="button" key={x.id} onClick={()=>openRelated(x)}><img src={posterImageSrc(x.poster)} alt="" loading="lazy" onError={e=>{e.currentTarget.src='/frame-logo.svg';e.currentTarget.classList.add('image-fallback')}}/><span className="hierarchy-part-copy"><b>{x.title}</b><small>{types[x.medium]} · {x.status==='completed'?'Completed':x.progress+' / '+(x.total||'—')+(x.progressUnit?' '+x.progressUnit:'')}</small><span className="hierarchy-part-meta">{x.year||'—'} · {x.score==null?'No score':x.score.toFixed(1)}</span><i className="hierarchy-part-bar"><em style={{width:pct+'%'}} /></i><p>{x.description||'Open this part to edit its metadata, artwork, rating, notes and progress.'}</p></span><ChevronRight size={17} className="hierarchy-part-arrow"/></button>})}</div></>}</section>})()}
   <section className="detail-section"><div className="detail-section-head"><h3>Progress</h3><span>{Math.round(pct)}%</span></div><input className="progress-slider" type="range" min="0" max={max} value={d.progress} onChange={e=>progress(Number(e.target.value))}/><div className="progress-edit"><input type="number" min="0" max={max} value={d.progress} onChange={e=>progress(Number(e.target.value)||0)}/><span>{d.progressUnit||units[d.medium]}</span><span>/</span><input type="number" min="1" max="2000" value={d.total|| (movie?1:500)} onChange={e=>setTotal(Number(e.target.value))}/><span>{movie?'watched state':'total'}</span></div><small className="hint">Change the total when an edition or source count is different.</small></section>

   <section className="detail-section two-col"><label>Status<select value={d.status} onChange={e=>update('status',e.target.value as Status)}>{statuses.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label>Your rating<input type="number" min="0" max="10" step=".1" value={d.personalRating??''} onChange={e=>update('personalRating',numberOrUndefined(e.target.value))}/></label><label>Parent entry<select value={d.parentId||''} onChange={e=>update('parentId',e.target.value||undefined)}><option value="">None</option>{parentCandidates.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label><label>Favorite<select value={d.favorite?'yes':'no'} onChange={e=>update('favorite',e.target.value==='yes')}><option value="no">No</option><option value="yes">Yes</option></select></label></section>

   

   {editing&&<section className="detail-section detail-editor">
    <div className="detail-section-head"><div><small>FULL CONTROL</small><h3>Edit every detail</h3></div><span>Local + account save</span></div>
    <div className="detail-editor-grid">
      <label>Title<input value={d.title} onChange={e=>update('title',e.target.value)}/></label>
      <label>Media type<select value={d.medium} onChange={e=>{const medium=e.target.value as MediaItem['medium'];const nextUnit=units[medium];setD({...d,medium,progressUnit:nextUnit,total:medium==='movie'?1:(d.total||undefined),progress:Math.min(d.progress,medium==='movie'?1:(d.total||2000))})}}>{Object.entries(types).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label>Source provider<input value={d.sourceProvider||''} onChange={e=>update('sourceProvider',e.target.value||undefined)} placeholder="anilist, igdb, wikipedia-game…"/></label>
      <label>External ID<input value={d.externalId||''} onChange={e=>update('externalId',e.target.value||undefined)}/></label>
      <label>AniList ID<input type="number" value={d.anilistId??''} onChange={e=>update('anilistId',e.target.value===''?undefined:Number(e.target.value))}/></label>
      <label>Metadata ID<input value={d.metadataId||''} onChange={e=>update('metadataId',e.target.value||undefined)}/></label>
      <label>IMDb ID<input value={externalLinks.imdbId||''} onChange={e=>update('externalLinks',{...externalLinks,imdbId:e.target.value.trim()||undefined})} placeholder="tt0388629"/></label>
      <label>MyAnimeList ID<input value={externalLinks.malId||''} onChange={e=>update('externalLinks',{...externalLinks,malId:e.target.value.trim()||undefined})} placeholder="21"/></label>
      <label>AniLab ID<input value={externalLinks.anilabId||''} onChange={e=>update('externalLinks',{...externalLinks,anilabId:e.target.value.trim()||undefined})} placeholder="Paste the title ID from AniLab"/></label>
      <label>AniLab title link<input value={externalLinks.anilabUrl||''} onChange={e=>update('externalLinks',{...externalLinks,anilabUrl:e.target.value.trim()||undefined})} placeholder="Optional share link"/></label>
      <label>Official website<input value={externalLinks.officialUrl||''} onChange={e=>update('externalLinks',{...externalLinks,officialUrl:e.target.value.trim()||undefined})} placeholder="https://…"/></label>
      <label>News / announcements URL<input value={externalLinks.newsUrl||''} onChange={e=>update('externalLinks',{...externalLinks,newsUrl:e.target.value.trim()||undefined})} placeholder="Official news page"/></label>
      <label>Year<input type="number" min="1800" max="3000" value={d.year??''} onChange={e=>update('year',e.target.value===''?undefined:Number(e.target.value))}/></label>
      <label>Source score<input type="number" min="0" max="10" step=".1" value={d.score??''} onChange={e=>update('score',e.target.value===''?undefined:Number(e.target.value))}/></label>
      <label>Studio / author / publisher<input value={d.studio||''} onChange={e=>update('studio',e.target.value||undefined)}/></label>
      <label>Season<input value={d.season||''} onChange={e=>update('season',e.target.value||undefined)}/></label>
      <label>Duration (minutes)<input type="number" min="0" value={d.duration??''} onChange={e=>update('duration',e.target.value===''?undefined:Number(e.target.value))}/></label>
      <label>Progress unit<input value={d.progressUnit||units[d.medium]} onChange={e=>update('progressUnit',e.target.value||undefined)}/></label>
      <label>Custom total<input type="number" min="1" max="2000" value={d.customTotal??''} onChange={e=>update('customTotal',e.target.value===''?undefined:Number(e.target.value))}/></label>
      <label>Air / release start<input type="text" value={d.airStart||''} onChange={e=>update('airStart',e.target.value||undefined)} placeholder="YYYY-MM-DD"/></label>
      <label>Air / release end<input type="text" value={d.airEnd||''} onChange={e=>update('airEnd',e.target.value||undefined)} placeholder="YYYY-MM-DD"/></label>
      <label>Next release<input value={d.nextRelease||''} onChange={e=>update('nextRelease',e.target.value||undefined)} placeholder="Optional"/></label>
      <label>Next release number<input type="number" min="0" value={d.nextReleaseNumber??''} onChange={e=>update('nextReleaseNumber',e.target.value===''?undefined:Number(e.target.value))}/></label>
      <label>Poster URL<input value={d.poster} onChange={e=>update('poster',e.target.value)}/></label>
      <label>Backdrop URL<input value={d.backdrop} onChange={e=>update('backdrop',e.target.value)}/></label>
      <label className="detail-editor-wide">Alternative titles<input value={altTitles} onChange={e=>update('alternativeTitles',parseList(e.target.value))} placeholder="Comma-separated"/></label>
      <label className="detail-editor-wide">Genres<input value={genres} onChange={e=>update('genres',parseList(e.target.value))} placeholder="Comma-separated"/></label>
      <label className="detail-editor-wide">Themes / tags<input value={themes} onChange={e=>update('themes',parseList(e.target.value))} placeholder="Comma-separated"/></label>
      <label className="detail-editor-wide">Description<textarea value={d.description} onChange={e=>update('description',e.target.value)} rows={5}/></label>
    </div>

    <div className="detail-sub-editor">
      <div className="detail-section-head"><div><small>AVAILABILITY</small><h4>Where it can be found</h4></div></div>
      <div className="detail-editor-grid">
       <label>Watch links<textarea value={listValue(availability.watch)} onChange={e=>update('availability',normaliseAvailability({...availability,watch:parseList(e.target.value)}))}/></label>
       <label>Buy links<textarea value={listValue(availability.buy)} onChange={e=>update('availability',normaliseAvailability({...availability,buy:parseList(e.target.value)}))}/></label>
       <label>Read links<textarea value={listValue(availability.read)} onChange={e=>update('availability',normaliseAvailability({...availability,read:parseList(e.target.value)}))}/></label>
       <label>Play links<textarea value={listValue(availability.play)} onChange={e=>update('availability',normaliseAvailability({...availability,play:parseList(e.target.value)}))}/></label>
      </div>
    </div>

    {game&&<div className="detail-sub-editor">
      <div className="detail-section-head"><div><small>GAME METADATA</small><h4>Game details</h4></div></div>
      <div className="detail-editor-grid">
       <label>Developer<input value={gameData.developer||''} onChange={e=>setD({...d,game:{...gameData,developer:e.target.value||undefined}})}/></label>
       <label>Publisher<input value={gameData.publisher||''} onChange={e=>setD({...d,game:{...gameData,publisher:e.target.value||undefined}})}/></label>
       <label>Release date<input value={gameData.releaseDate||''} onChange={e=>setD({...d,game:{...gameData,releaseDate:e.target.value||undefined}})} placeholder="YYYY-MM-DD"/></label>
       <label>Platforms<input value={gamePlatforms} onChange={e=>setD({...d,game:{...gameData,platforms:parseList(e.target.value)}})}/></label>
       <label>Game modes<input value={gameModes} onChange={e=>setD({...d,game:{...gameData,gameModes:parseList(e.target.value)}})}/></label>
       <label>Playtime (hours)<input type="number" min="0" value={gameData.playtimeHours??''} onChange={e=>setD({...d,game:{...gameData,playtimeHours:e.target.value===''?undefined:Number(e.target.value)}})}/></label>
       <label>Story progress %<input type="number" min="0" max="100" value={gameData.storyProgress??''} onChange={e=>setD({...d,game:{...gameData,storyProgress:e.target.value===''?undefined:Number(e.target.value),completionProgress:gameData.completionProgress}})}/></label>
       <label>Completion %<input type="number" min="0" max="100" value={gameData.completionProgress??''} onChange={e=>setD({...d,game:{...gameData,completionProgress:e.target.value===''?undefined:Number(e.target.value)}})}/></label>
       <label>Difficulty<input value={gameData.difficulty||''} onChange={e=>setD({...d,game:{...gameData,difficulty:e.target.value||undefined}})}/></label>
       <label>Franchise<input value={gameData.franchise||''} onChange={e=>setD({...d,game:{...gameData,franchise:e.target.value||undefined}})}/></label>
       <label>Edition<input value={gameData.edition||''} onChange={e=>setD({...d,game:{...gameData,edition:e.target.value||undefined}})}/></label>
       <label>Free to play<select value={gameData.isFree?'yes':'no'} onChange={e=>setD({...d,game:{...gameData,isFree:e.target.value==='yes'}})}><option value="no">No</option><option value="yes">Yes</option></select></label>
       <label>Price text<input value={gameData.priceText||''} onChange={e=>setD({...d,game:{...gameData,priceText:e.target.value||undefined}})}/></label>
       <label>Store URL<input value={gameData.storeUrl||''} onChange={e=>setD({...d,game:{...gameData,storeUrl:e.target.value||undefined}})}/></label>
       <label className="detail-editor-wide">DLC<input value={gameDlc} onChange={e=>setD({...d,game:{...gameData,dlc:parseList(e.target.value)}})}/></label>
       <label>Story complexity<input type="number" min="0" max="10" step=".1" value={complexity.story??''} onChange={e=>setD({...d,game:{...gameData,complexity:{...complexity,story:e.target.value===''?undefined:Number(e.target.value)}}})}/></label>
       <label>Gameplay complexity<input type="number" min="0" max="10" step=".1" value={complexity.gameplay??''} onChange={e=>setD({...d,game:{...gameData,complexity:{...complexity,gameplay:e.target.value===''?undefined:Number(e.target.value)}}})}/></label>
       <label>Systems complexity<input type="number" min="0" max="10" step=".1" value={complexity.systems??''} onChange={e=>setD({...d,game:{...gameData,complexity:{...complexity,systems:e.target.value===''?undefined:Number(e.target.value)}}})}/></label>
       <label>Exploration complexity<input type="number" min="0" max="10" step=".1" value={complexity.exploration??''} onChange={e=>setD({...d,game:{...gameData,complexity:{...complexity,exploration:e.target.value===''?undefined:Number(e.target.value)}}})}/></label>
      </div>
    </div>}
    <div className="detail-editor-save"><button className="primary" type="button" disabled={saving||!d.title.trim()} onClick={()=>void saveEdits()}>{saving?<RefreshCw className="spin"/>:<Check/>}{saving?'Saving…':'Save all details'}</button>{saveMessage&&<small>{saveMessage}</small>}</div>
   </section>}

   {d.game&&<section className="detail-section game-box"><h3>Game information</h3><div><span>Developer</span><b>{d.game.developer||'—'}</b></div><div><span>Publisher</span><b>{d.game.publisher||'—'}</b></div><div><span>Platforms</span><b>{d.game.platforms?.join(', ')||'—'}</b></div><div><span>Availability</span><b>{d.game.isFree?'Free':d.game.priceText||'Check store'}</b></div></section>}


   <section className="detail-section"><h3>Where to find it</h3><div className="source-links">{links(d).map(x=><a key={x.url} href={x.url} target="_blank" rel="noreferrer"><ExternalLink size={13}/>{x.label}</a>)}</div></section>
   <section className="detail-section"><label>Private notes<textarea value={note} onChange={e=>{setNote(e.target.value);setD({...d,notes:e.target.value})}} placeholder="Your notes…"/></label></section>

   <div className="detail-actions"><button className="primary" disabled={saving} onClick={()=>void saveEdits()}><Check size={16}/>Save changes</button><button className="secondary active" onClick={()=>setD({...d,favorite:!d.favorite})}><Heart size={16} fill={d.favorite?'currentColor':'none'}/>{d.favorite?'Favorited':'Favorite'}</button>{onDelete&&<button className="danger" type="button" onClick={()=>{const hasChildren=library.some(x=>x.parentId===d.id);const message=hasChildren?'Delete this entry? Its child entries will be kept but detached.':'Delete this entry? This cannot be undone.';if(window.confirm(message))void onDelete(d.id)}}>Delete</button>}</div>
   </aside>
   {hasPrevious&&<button className="detail-nav-arrow detail-nav-next" aria-label="Next media" title="Next media" onClick={goNext}><ChevronRight size={26}/></button>}
  </div>
 </div>;
}

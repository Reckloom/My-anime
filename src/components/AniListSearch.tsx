import {useEffect,useState} from 'react';
import {AlertCircle,BookOpen,Download,ExternalLink,Gamepad2,Film,Loader2,Search,Tv,X} from 'lucide-react';
import {aniList,cleanDescription,DETAIL_QUERY,SEARCH_QUERY,titleOf,type AniListMedia} from '../anilist';
import {supabase} from '../lib/supabase';
import type {MediaItem,Medium} from '../types';

type CatalogType='ANIME'|'MANGA';
type Tab='anime'|'manga'|'visual-novel'|'game'|'series'|'movie'|'book';
type DiscoveryResult={
 provider:string;externalId:string;title:string;medium:Medium;poster?:string;backdrop?:string;
 description?:string;genres?:string[];themes?:string[];studio?:string;source?:string;
 score?:number|null;year?:number|null;sourceUrl?:string;alternativeTitles?:string[];
 total?:number;duration?:number;airStart?:string;airEnd?:string;season?:string;
 game?:MediaItem['game']; meta?:Record<string,unknown>;
};

type SearchResponse={results?:AniListMedia[]};
type ExternalResponse={results?:DiscoveryResult[]};

const tabs:{id:Tab;label:string;icon:typeof Tv;hint:string}[]=[
 {id:'anime',label:'Anime',icon:Tv,hint:'AniList'},
 {id:'manga',label:'Manga / Manhwa / LN',icon:BookOpen,hint:'AniList'},
 {id:'visual-novel',label:'Visual Novels',icon:BookOpen,hint:'VNDB'},
 {id:'game',label:'Games',icon:Gamepad2,hint:'Steam'},
 {id:'series',label:'Series',icon:Tv,hint:'TVmaze'},
 {id:'movie',label:'Movies',icon:Film,hint:'Wikipedia'},
 {id:'book',label:'Books',icon:BookOpen,hint:'Open Library'}
];

function mangaMedium(media:AniListMedia):Medium{
 if(media.format==='NOVEL')return'light-novel';
 if(media.countryOfOrigin==='KR')return'manhwa';
 return'manga';
}
function localItem(media:AniListMedia):MediaItem{
 const title=titleOf(media);
 const alternatives=[media.title.english,media.title.romaji,media.title.native,...(media.synonyms||[])].filter((x):x is string=>Boolean(x&&x!==title));
 return{
   id:crypto.randomUUID(),anilistId:media.id,sourceProvider:'anilist',externalId:String(media.id),title,
   alternativeTitles:[...new Set(alternatives)],description:cleanDescription(media.description),
   poster:media.coverImage?.extraLarge||'',backdrop:media.bannerImage||'',
   medium:media.type==='MANGA'?mangaMedium(media):(media.format==='MOVIE'?'movie':'anime'),status:'planned',progress:0,
   total:media.type==='MANGA'?(media.chapters??media.volumes??undefined):(media.episodes??undefined),
   year:media.seasonYear??undefined,score:media.averageScore==null?undefined:media.averageScore/10,
   genres:media.genres||[],themes:(media.tags||[]).map(x=>x.name),
   studio:media.studios?.nodes?.map(x=>x.name).join(', ')||undefined,source:media.source||undefined,
   season:media.season||undefined,duration:media.duration??undefined,
   airStart:media.startDate?.year?[media.startDate.year,media.startDate.month,media.startDate.day].filter(Boolean).join('-'):undefined,
   airEnd:media.endDate?.year?[media.endDate.year,media.endDate.month,media.endDate.day].filter(Boolean).join('-'):undefined,
   favorite:false
 };
}
function fromImportedRow(row:unknown):MediaItem{
 const r=row as Record<string,unknown>;
 const meta=(r.media_metadata&&typeof r.media_metadata==='object'?r.media_metadata:{}) as Record<string,unknown>;
 const data=(r.data&&typeof r.data==='object'?r.data:{}) as Record<string,unknown>;
 const value=(key:string)=>meta[key]??r[key];
 return{
   id:String(r.id),parentId:r.parent_id?String(r.parent_id):undefined,metadataId:r.metadata_id?String(r.metadata_id):undefined,
   anilistId:r.anilist_id==null?undefined:Number(r.anilist_id),sourceProvider:data.provider?String(data.provider):(r.anilist_id?'anilist':undefined),
   externalId:data.externalId?String(data.externalId):(r.anilist_id?String(r.anilist_id):undefined),title:String(value('title')??''),
   alternativeTitles:Array.isArray(meta.alternative_titles)?meta.alternative_titles.map(String):[],description:String(value('description')??''),
   poster:String(value('poster')??''),backdrop:String(value('backdrop')??''),medium:String(r.medium) as Medium,status:String(r.status) as MediaItem['status'],
   progress:Number(r.progress??0),total:value('episodes')==null?(r.total==null?undefined:Number(r.total)):Number(value('episodes')),
   year:value('year')==null?undefined:Number(value('year')),score:value('score')==null?undefined:Number(value('score')),
   genres:Array.isArray(value('genres'))?(value('genres') as unknown[]).map(String):[],themes:Array.isArray(value('themes'))?(value('themes') as unknown[]).map(String):[],
   studio:value('studio')?String(value('studio')):undefined,source:value('source')?String(value('source')):undefined,
   season:meta.season?String(meta.season):undefined,duration:meta.duration==null?undefined:Number(meta.duration),
   airStart:meta.air_start?String(meta.air_start):undefined,airEnd:meta.air_end?String(meta.air_end):undefined,favorite:Boolean(r.favorite),notes:r.notes?String(r.notes):undefined,
   game:data.game&&typeof data.game==='object'?data.game as MediaItem['game']:undefined
 };
}
function anilistMediumLabel(media:AniListMedia){
 if(media.type==='MANGA')return mangaMedium(media)==='manhwa'?'MANHWA':media.format==='NOVEL'?'LIGHT NOVEL':'MANGA';
 return media.format==='MOVIE'?'MOVIE':'ANIME';
}
async function searchAni(term:string,type:CatalogType){
 if(supabase){
  try{
   const{data,error}=await supabase.functions.invoke('anilist-import',{body:{action:'search',query:term,mediaType:type}});
   if(!error&&Array.isArray((data as SearchResponse|undefined)?.results)&&(data as SearchResponse).results!.length)return(data as SearchResponse).results!;
  }catch{}
 }
 const d=await aniList<{Page:{media:AniListMedia[]}}>(SEARCH_QUERY,{search:term,page:1,perPage:12,type});
 return d.Page.media||[];
}
async function directExternalSearch(term:string,provider:Exclude<Tab,'anime'|'manga'>):Promise<DiscoveryResult[]>{
 const q=encodeURIComponent(term.trim());
 if(provider==='series'){
  const res=await fetch('https://api.tvmaze.com/search/shows?q='+q);if(!res.ok)throw new Error('TV series catalogue is temporarily unavailable.');
  const rows=await res.json() as Array<{show:any}>;
  return rows.slice(0,12).map(({show})=>({provider:'tvmaze',externalId:String(show.id),title:String(show.name||term),medium:'series',poster:show.image?.original||show.image?.medium,description:show.summary||'',genres:Array.isArray(show.genres)?show.genres:[],year:show.premiered?Number(String(show.premiered).slice(0,4)):undefined,score:show.rating?.average??null,sourceUrl:show.officialSite||show.url,source:'tvmaze'}));
 }
 if(provider==='book'){
  const res=await fetch('https://openlibrary.org/search.json?q='+q+'&limit=12&fields=key,title,author_name,first_publish_year,cover_i');if(!res.ok)throw new Error('Book catalogue is temporarily unavailable.');
  const data=await res.json() as {docs?:any[]};
  return (data.docs||[]).map(x=>({provider:'openlibrary',externalId:String(x.key||'').replace(/^\/works\//,''),title:String(x.title||term),medium:'book',poster:x.cover_i?'https://covers.openlibrary.org/b/id/'+x.cover_i+'-L.jpg':undefined,description:x.author_name?.length?'By '+x.author_name.slice(0,3).join(', '):'',year:x.first_publish_year?Number(x.first_publish_year):undefined,sourceUrl:x.key?'https://openlibrary.org'+x.key:undefined,source:'openlibrary',genres:[]}));
 }
 if(provider==='movie'){
  const url='https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch='+q+'&gsrnamespace=0&gsrlimit=12&prop=extracts|pageimages|info&exintro=1&explaintext=1&inprop=url&piprop=thumbnail&pithumbsize=400&format=json&origin=*';
  const res=await fetch(url);if(!res.ok)throw new Error('Movie catalogue is temporarily unavailable.');
  const data=await res.json() as {query?:{pages?:Record<string,any>}};
  return Object.values(data.query?.pages||{}).map(x=>({provider:'wikipedia',externalId:String(x.pageid),title:String(x.title||term),medium:'movie',poster:x.thumbnail?.source,description:String(x.extract||''),sourceUrl:x.fullurl||('https://en.wikipedia.org/?curid='+x.pageid),source:'wikipedia',genres:[]}));
 }
 if(provider==='visual-novel'){
  const res=await fetch('https://api.vndb.org/kana/vn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filters:['search','=',term.trim()],fields:'title,alttitle,description,image.url,released,rating',sort:'searchrank',results:12})});if(!res.ok)throw new Error('Visual novel catalogue is temporarily unavailable.');
  const data=await res.json() as {results?:any[]};
  return (data.results||[]).map(x=>({provider:'vndb',externalId:String(x.id),title:String(x.title||term),alternativeTitles:x.alttitle?[x.alttitle]:[],medium:'visual-novel',poster:x.image?.url,description:x.description||'',year:x.released?Number(String(x.released).slice(0,4)):undefined,score:x.rating?Number(x.rating)/10:null,sourceUrl:'https://vndb.org/'+x.id,source:'vndb',genres:[]}));
 }
 if(provider==='game'){
  const res=await fetch('https://store.steampowered.com/api/storesearch/?term='+q+'&l=english&cc=IN');if(!res.ok)throw new Error('Game catalogue is temporarily unavailable.');
  const data=await res.json() as {items?:any[]};
  return (data.items||[]).slice(0,12).map(x=>({provider:'steam',externalId:String(x.id),title:String(x.name||term),medium:'game',poster:x.tiny_image,score:null,sourceUrl:'https://store.steampowered.com/app/'+x.id+'/',source:'steam',genres:[],game:{isFree:Boolean(x.is_free),priceText:x.price_overview?.final_formatted||x.price_overview?.initial_formatted,storeUrl:'https://store.steampowered.com/app/'+x.id+'/'}}));
 }
 return [];
}

async function searchExternal(term:string,provider:Exclude<Tab,'anime'|'manga'>){
 if(supabase){try{const{data,error}=await supabase.functions.invoke('media-discovery',{body:{action:'search',query:term,provider}});const found=((data||{}) as ExternalResponse).results||[];if(!error&&found.length)return found;}catch{}}
 return directExternalSearch(term,provider);
}
async function detailExternal(result:DiscoveryResult){
 if(supabase){
  try{
   const providerName=result.provider==='steam'?'game':result.provider==='tvmaze'?'series':result.provider==='wikipedia'?'movie':result.provider==='vndb'?'visual-novel':'book';
   const{data,error}=await supabase.functions.invoke('media-discovery',{body:{action:'detail',provider:providerName,externalId:result.externalId}});
   if(!error&&(data as {result?:DiscoveryResult})?.result)return(data as {result:DiscoveryResult}).result!;
  }catch{}
 }
 if(result.provider==='tvmaze'){
  try{
   const res=await fetch('https://api.tvmaze.com/shows/'+encodeURIComponent(result.externalId)+'?embed=episodes');
   if(res.ok){
    const x=await res.json() as any;
    return{...result,total:Array.isArray(x._embedded?.episodes)?x._embedded.episodes.length:result.total,description:x.summary||result.description,poster:x.image?.original||result.poster,sourceUrl:x.officialSite||x.url};
   }
  }catch{}
 }
 if(result.provider==='steam'){
  try{
   const res=await fetch('https://store.steampowered.com/api/appdetails?appids='+encodeURIComponent(result.externalId)+'&cc=IN&l=english');
   if(res.ok){
    const raw=await res.json() as Record<string,{success:boolean;data?:any}>;
    const x=raw[result.externalId];
    if(x?.success&&x.data){
     return{
      ...result,
      description:x.data.short_description||x.data.detailed_description||result.description,
      poster:x.data.header_image||result.poster,
      year:x.data.release_date?.date?Number(String(x.data.release_date.date).slice(-4)):result.year,
      game:{
       ...(result.game||{}),
       developer:x.data.developers?.[0],
       publisher:x.data.publishers?.[0],
       releaseDate:x.data.release_date?.date,
       isFree:Boolean(x.data.is_free),
       priceText:x.data.price_overview?.final_formatted||x.data.price_overview?.initial_formatted,
       storeUrl:'https://store.steampowered.com/app/'+result.externalId+'/'
      }
     };
    }
   }
  }catch{}
 }
 return result;
}
function externalToMedia(r:DiscoveryResult):MediaItem{
 return{
  id:crypto.randomUUID(),sourceProvider:r.provider,externalId:r.externalId,title:r.title,description:cleanDescription(r.description),
  poster:r.poster||'',backdrop:r.backdrop||'',medium:r.medium,status:'planned',progress:0,
  total:r.total??(r.medium==='game'?100:undefined),year:r.year??undefined,score:r.score==null?undefined:r.score,
  genres:r.genres||[],themes:r.themes||[],studio:r.studio,source:r.source||r.provider,airStart:r.airStart,airEnd:r.airEnd,duration:r.duration,
  alternativeTitles:r.alternativeTitles,favorite:false,game:r.game
 };
}

export function AniListSearch({close,onImported,onManual}:{close:()=>void;onImported:(item:MediaItem)=>void;onManual?:()=>void}){
 const[tab,setTab]=useState<Tab>('anime'),[query,setQuery]=useState(''),[results,setResults]=useState<(AniListMedia|DiscoveryResult)[]>([]),[selected,setSelected]=useState<AniListMedia|DiscoveryResult|null>(null);
 const[loading,setLoading]=useState(false),[detailLoading,setDetailLoading]=useState(false),[importing,setImporting]=useState(false),[error,setError]=useState('');
 const current=tabs.find(x=>x.id===tab)!;
 const isAni=tab==='anime'||tab==='manga';
 const catalogType:CatalogType=tab==='anime'?'ANIME':'MANGA';
 useEffect(()=>{
  const term=query.trim();
  setSelected(null);
  if(term.length<2){setResults([]);setError('');return}
  let cancelled=false;
  const timer=window.setTimeout(async()=>{
   setLoading(true);setError('');
   try{
    if(isAni){
      const found=await searchAni(term,catalogType);
      if(!cancelled)setResults(found);
    }else{
      const found=await searchExternal(term,tab as Exclude<Tab,'anime'|'manga'>);
      if(!cancelled)setResults(found);
    }
   }catch(e){
    if(!cancelled){setResults([]);setError(e instanceof Error?e.message:'Search failed. Please try again.')}
   }finally{if(!cancelled)setLoading(false)}
  },450);
  return()=>{cancelled=true;window.clearTimeout(timer)};
 },[query,tab,isAni,catalogType]);

 const choose=async(raw:AniListMedia|DiscoveryResult)=>{
  setSelected(raw);setDetailLoading(true);setError('');
  try{
   if(isAni){
    const r=raw as AniListMedia;const d=await aniList<{Media:AniListMedia}>(DETAIL_QUERY,{id:r.id});setSelected(d.Media);
   }else setSelected(await detailExternal(raw as DiscoveryResult));
  }catch(e){setError(e instanceof Error?e.message:'Could not load full metadata.')}
  finally{setDetailLoading(false)}
 };
 const importMedia=async()=>{
  if(!selected)return;
  setImporting(true);setError('');
  try{
   if(isAni){
    const r=selected as AniListMedia;
    if(supabase){
     const{data,error:e}=await supabase.functions.invoke('anilist-import',{body:{action:'import',anilistId:r.id}});
     if(e)throw e;
     if((data as {existing?:boolean}|null)?.existing){setError('This title is already in your library.');return}
     const imported=(data as {media?:unknown}|null)?.media;
     onImported(imported?fromImportedRow(imported):localItem(r));
    }else onImported(localItem(r));
   }else onImported(externalToMedia(selected as DiscoveryResult));
  }catch(e){setError(e instanceof Error?e.message:'Could not import this title. Please try again.')}
  finally{setImporting(false)}
 };
 const selectedAni=isAni?(selected as AniListMedia|null):null;
 const selectedExt=!isAni?(selected as DiscoveryResult|null):null;
 const resultKey=(x:AniListMedia|DiscoveryResult)=>isAni?String((x as AniListMedia).id):(x as DiscoveryResult).provider+':'+(x as DiscoveryResult).externalId;
 const resultInfo=(x:AniListMedia|DiscoveryResult)=>{
  if(isAni){const m=x as AniListMedia;return{title:titleOf(m),poster:m.coverImage?.extraLarge||'',meta:anilistMediumLabel(m)+' · '+(m.format||'Unknown format')+(m.seasonYear?' · '+m.seasonYear:''),tags:m.genres?.slice(0,3)||[]}}
  const r=x as DiscoveryResult;return{title:r.title,poster:r.poster||'',meta:r.medium.toUpperCase()+' · '+r.provider+(r.year?' · '+r.year:''),tags:r.genres?.slice(0,3)||[]};
 };
 return <div className="modalwrap"><div className="modal search-modal">
  <div className="modalhead"><div><small>MEDIA DISCOVERY</small><h2>Find anything for FRAME</h2><p className="muted">Live catalogues for anime, manga, manhwa, games, series, movies and books.</p></div><button onClick={close} aria-label="Close"><X/></button></div>
  <div className="search-big"><Search size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={current.id==='game'?'Search games by title…':current.id==='series'?'Search TV series…':current.id==='movie'?'Search movies by title…':current.id==='book'?'Search books / novels…':current.id==='visual-novel'?'Search visual novels…':current.id==='manga'?'Search manga, manhwa or light novels…':'Search anime, movies, seasons…'}/></div>
  <div className="catalog-tabs catalog-tabs-wide" role="tablist" aria-label="Media catalogues">{tabs.map(t=>{const Icon=t.icon;return <button key={t.id} className={tab===t.id?'active':''} onClick={()=>{setTab(t.id);setResults([]);setError('')}}><Icon size={14}/>{t.label}<small>{t.hint}</small></button>})}</div>
  {error&&<div className="inline-error"><AlertCircle size={15}/><span>{error}</span></div>}
  {loading&&<div className="search-state"><Loader2 className="spin"/>Searching {current.hint}…</div>}
  {!loading&&query.trim().length<2&&<div className="search-state">Choose a catalogue and type at least two characters.</div>}
  {!loading&&query.trim().length>=2&&!results.length&&!error&&<div className="search-state">No results yet. Try another title or spelling.</div>}
  <div className="ani-results">{results.map(r=>{const i=resultInfo(r);return <button key={resultKey(r)} className={(isAni?(selected as AniListMedia|null)?.id=== (r as AniListMedia).id:(selected as DiscoveryResult|null)?.externalId===(r as DiscoveryResult).externalId)?'ani-result selected':'ani-result'} onClick={()=>void choose(r)}>
   <img src={i.poster||'https://placehold.co/240x360/111116/777?text=FRAME'} alt="" loading="lazy" decoding="async"/>
   <span><b>{i.title}</b><small>{i.meta}</small><em>{i.tags.join(' · ')||'Metadata available on selection'}</em></span>
  </button>})}</div>
  {selected&&<div className="ani-detail">
   {isAni&&selectedAni?<img src={selectedAni.coverImage?.extraLarge||'https://placehold.co/240x360/111116/777?text=FRAME'} alt="" loading="lazy" decoding="async"/>:
    selectedExt?<img src={selectedExt.poster||'https://placehold.co/240x360/111116/777?text=FRAME'} alt="" loading="lazy" decoding="async"/>:null}
   <div>
    {isAni&&selectedAni?<><small>{anilistMediumLabel(selectedAni)} · AniList</small><h3>{titleOf(selectedAni)}</h3></>:
     selectedExt?<><small>{selectedExt.medium.toUpperCase()} · {selectedExt.provider}</small><h3>{selectedExt.title}</h3></>:null}
    {detailLoading?<p><Loader2 className="spin"/> Loading metadata…</p>:<>
      <p>{cleanDescription(isAni&&selectedAni?selectedAni.description:selectedExt?.description)||'No description available.'}</p>
      <div className="tags">{((isAni && selectedAni?.genres) || selectedExt?.genres || []).map((x:string)=><span key={x}>{x}</span>)}</div>
      {!isAni&&selectedExt?.sourceUrl&&<p className="info-line">Source: {selectedExt.sourceUrl}</p>}
    </>}
    <div className="ani-actions">
     <button className="primary" disabled={importing||detailLoading} onClick={()=>void importMedia()}>{importing?<Loader2 className="spin"/>:<Download/>}{importing?'Importing…':'Add to my library'}</button>
     {isAni&&selectedAni?<a href={'https://anilist.co/'+selectedAni.type.toLowerCase()+'/'+selectedAni.id} target="_blank" rel="noreferrer"><ExternalLink/>Source</a>:
      selectedExt?.sourceUrl?<a href={selectedExt.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink/>Source</a>:null}
     {onManual&&<button className="secondary" onClick={onManual}>Manual entry</button>}
    </div>
   </div>
  </div>}
  {onManual&&!selected&&<button className="secondary manual-fallback" onClick={onManual}>Can't find it? Add manually</button>}
 </div></div>;
}
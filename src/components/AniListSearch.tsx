import {useEffect,useState} from 'react';
import {AlertCircle,Download,ExternalLink,Loader2,Search,X} from 'lucide-react';
import {aniList,cleanDescription,DETAIL_QUERY,SEARCH_QUERY,titleOf,type AniListMedia} from '../anilist';
import {supabase} from '../lib/supabase';
import type {MediaItem} from '../types';

type CatalogType = 'ANIME'|'MANGA';

type SearchResponse = {results?:AniListMedia[]};

function localItem(media:AniListMedia):MediaItem{
  const title=titleOf(media);
  const alternatives=[media.title.english,media.title.romaji,media.title.native,...(media.synonyms||[])].filter((x):x is string=>Boolean(x&&x!==title));
  return {
    id:crypto.randomUUID(),
    anilistId:media.id,
    title,
    alternativeTitles:[...new Set(alternatives)],
    description:cleanDescription(media.description),
    poster:media.coverImage?.extraLarge||'',
    backdrop:media.bannerImage||'',
    medium:media.type==='MANGA'?(media.format==='NOVEL'?'light-novel':'manga'):(media.format==='MOVIE'?'movie':'anime'),
    status:'planned',
    progress:0,
    total:media.episodes??undefined,
    year:media.seasonYear??undefined,
    score:media.averageScore==null?undefined:media.averageScore/10,
    genres:media.genres||[],
    themes:(media.tags||[]).map(x=>x.name),
    studio:media.studios?.nodes?.map(x=>x.name).join(', ')||undefined,
    source:media.source||undefined,
    season:media.season||undefined,
    duration:media.duration??undefined,
    airStart:media.startDate?.year?[media.startDate.year,media.startDate.month,media.startDate.day].filter(Boolean).join('-'):undefined,
    airEnd:media.endDate?.year?[media.endDate.year,media.endDate.month,media.endDate.day].filter(Boolean).join('-'):undefined,
    favorite:false
  };
}

function fromImportedRow(row:unknown):MediaItem{
  const r=row as Record<string,unknown>;
  const meta=(r.media_metadata&&typeof r.media_metadata==='object'?r.media_metadata:{}) as Record<string,unknown>;
  const value=(key:string)=>meta[key]??r[key];
  return {
    id:String(r.id),
    parentId:r.parent_id?String(r.parent_id):undefined,
    metadataId:r.metadata_id?String(r.metadata_id):undefined,
    anilistId:r.anilist_id==null?undefined:Number(r.anilist_id),
    title:String(value('title')??''),
    alternativeTitles:Array.isArray(meta.alternative_titles)?meta.alternative_titles.map(String):[],
    description:String(value('description')??''),
    poster:String(value('poster')??''),
    backdrop:String(value('backdrop')??''),
    medium:String(r.medium) as MediaItem['medium'],
    status:String(r.status) as MediaItem['status'],
    progress:Number(r.progress??0),
    total:value('episodes')==null?(r.total==null?undefined:Number(r.total)):Number(value('episodes')),
    year:value('year')==null?undefined:Number(value('year')),
    score:value('score')==null?undefined:Number(value('score')),
    genres:Array.isArray(value('genres'))?value('genres').map(String):[],
    themes:Array.isArray(value('themes'))?value('themes').map(String):[],
    studio:value('studio')?String(value('studio')):undefined,
    source:value('source')?String(value('source')):undefined,
    season:meta.season?String(meta.season):undefined,
    duration:meta.duration==null?undefined:Number(meta.duration),
    airStart:meta.air_start?String(meta.air_start):undefined,
    airEnd:meta.air_end?String(meta.air_end):undefined,
    favorite:Boolean(r.favorite),
    notes:r.notes?String(r.notes):undefined
  };
}

async function searchServer(term:string,mediaType:CatalogType){
  if(!supabase) return null;
  const {data,error}=await supabase.functions.invoke('anilist-import',{body:{action:'search',query:term,mediaType}});
  if(error) throw error;
  return ((data||{}) as SearchResponse).results||[];
}

export function AniListSearch({close,onImported,onManual}:{close:()=>void;onImported:(item:MediaItem)=>void;onManual?:()=>void}){
 const[query,setQuery]=useState(''),[mediaType,setMediaType]=useState<CatalogType>('ANIME'),[results,setResults]=useState<AniListMedia[]>([]),[selected,setSelected]=useState<AniListMedia|null>(null);
 const[loading,setLoading]=useState(false),[detailLoading,setDetailLoading]=useState(false),[importing,setImporting]=useState(false),[error,setError]=useState('');

 useEffect(()=>{
   const term=query.trim();
   if(term.length<2){setResults([]);setError('');return}
   let cancelled=false;
   const timer=window.setTimeout(async()=>{
     setLoading(true);setError('');
     try{
       let found:AniListMedia[]|null=null;
       try{
         found=await searchServer(term,mediaType);
       }catch{
         found=null;
       }
       if(found===null){
         const d=await aniList<{Page:{media:AniListMedia[]}}>(SEARCH_QUERY,{search:term,page:1,perPage:12,type:mediaType});
         found=d.Page.media||[];
       }
       if(!cancelled)setResults(found);
     }catch(e){
       if(!cancelled){
         setResults([]);
         setError(e instanceof Error?e.message:'Could not search the AniList catalogue. Please try again.');
       }
     }finally{
       if(!cancelled)setLoading(false);
     }
   },450);
   return()=>{cancelled=true;window.clearTimeout(timer)};
 },[query,mediaType]);

 const choose=async(r:AniListMedia)=>{
   setSelected(r);setDetailLoading(true);setError('');
   try{
     const d=await aniList<{Media:AniListMedia}>(DETAIL_QUERY,{id:r.id});
     setSelected(d.Media);
   }catch(e){
     setError(e instanceof Error?e.message:'Could not load this title.');
   }finally{setDetailLoading(false)}
 };

 const importMedia=async()=>{
   if(!selected)return;
   setImporting(true);setError('');
   try{
     if(supabase){
       const{data,error:e}=await supabase.functions.invoke('anilist-import',{body:{action:'import',anilistId:selected.id}});
       if(e)throw e;
       if((data as {existing?:boolean}|null)?.existing){
         setError('This title is already in your library.');
         return;
       }
       const imported=(data as {media?:unknown}|null)?.media;
       onImported(imported?fromImportedRow(imported):localItem(selected));
     }else{
       onImported(localItem(selected));
     }
   }catch(e){
     setError(e instanceof Error?e.message:'Could not import this title. Please try again.');
   }finally{
     setImporting(false);
   }
 };

 return <div className="modalwrap"><div className="modal search-modal">
   <div className="modalhead"><div><small>MEDIA DISCOVERY</small><h2>Find media</h2><p className="muted">Search the live AniList catalogue.</p></div><button onClick={close} aria-label="Close"><X/></button></div>
   <div className="search-big"><Search size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder={mediaType==='ANIME'?'Search anime, movies, seasons…':'Search manga and light novels…'}/></div>
   <div className="catalog-tabs" role="tablist" aria-label="Catalogue type">
     <button className={mediaType==='ANIME'?'active':''} onClick={()=>{setMediaType('ANIME');setSelected(null)}}>Anime</button>
     <button className={mediaType==='MANGA'?'active':''} onClick={()=>{setMediaType('MANGA');setSelected(null)}}>Manga / Light Novel</button>
   </div>
   {error&&<div className="inline-error"><AlertCircle size={15}/><span>{error}</span></div>}
   {loading&&<div className="search-state"><Loader2 className="spin"/>Searching the AniList catalogue…</div>}
   {!loading&&query.trim().length<2&&<div className="search-state">Type at least two characters to search the live catalogue.</div>}
   {!loading&&query.trim().length>=2&&!results.length&&!error&&<div className="search-state">No titles found. Try the English, Japanese, or romanized title.</div>}
   <div className="ani-results">{results.map(r=><button key={r.id} className={selected?.id===r.id?'ani-result selected':'ani-result'} onClick={()=>void choose(r)}>
     <img src={r.coverImage?.extraLarge||'https://placehold.co/240x360/111116/777?text=FRAME'} alt="" loading="lazy" decoding="async"/>
     <span><b>{titleOf(r)}</b><small>{r.type} · {r.format||'Unknown format'}{r.seasonYear?' · '+r.seasonYear:''}</small><em>{r.genres?.slice(0,3).join(' · ')||'No genres listed'}</em></span>
   </button>)}</div>
   {selected&&<div className="ani-detail">
     <img src={selected.coverImage?.extraLarge||'https://placehold.co/240x360/111116/777?text=FRAME'} alt="" loading="lazy" decoding="async"/>
     <div><small>{selected.type} · {selected.format||'Unknown format'}</small><h3>{titleOf(selected)}</h3>
       {detailLoading?<p><Loader2 className="spin"/> Loading metadata…</p>:<>
         <p>{cleanDescription(selected.description)||'No description available.'}</p>
         <div className="tags">{(selected.genres||[]).map(x=><span key={x}>{x}</span>)}</div>
       </>}
       <div className="ani-actions">
         <button className="primary" disabled={importing||detailLoading} onClick={()=>void importMedia()}>{importing?<Loader2 className="spin"/>:<Download/>}{importing?'Importing…':'Import to my library'}</button>
         <a href={`https://anilist.co/${selected.type.toLowerCase()}/${selected.id}`} target="_blank" rel="noreferrer"><ExternalLink/>AniList</a>
         {onManual&&<button className="secondary" onClick={onManual}>Manual entry</button>}
       </div>
     </div>
   </div>}
   {onManual&&!selected&&<button className="secondary manual-fallback" onClick={onManual}>Can't find it? Add manually</button>}
 </div></div>;
}

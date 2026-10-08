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

type AniListSearchResult=AniListMedia & {jikanId?:number;sourceProvider?:'anilist'|'jikan'};
type SearchResponse={results?:AniListMedia[]};
type JikanResponse={data?:any[]};
type ExternalResponse={results?:DiscoveryResult[]};

const SUPABASE_URL=((import.meta.env.VITE_SUPABASE_URL as string|undefined)?.trim()||'https://blwnhfhpckqbetwxamqr.supabase.co').replace(/\/+$/,'');
const DISCOVERY_URL=SUPABASE_URL+'/functions/v1/media-discovery';

async function discoveryRequest(body:Record<string,unknown>){
 const controller=new AbortController();
 const timer=window.setTimeout(()=>controller.abort(),12000);
 try{
  const params=new URLSearchParams();
  for(const[key,value] of Object.entries(body)){
   if(value!==undefined&&value!==null)params.set(key,String(value));
  }
  const response=await fetch(DISCOVERY_URL+'?'+params.toString(),{
   method:'GET',
   headers:{Accept:'application/json'},
   signal:controller.signal,
   cache:'no-store'
  });
  const raw=await response.text();
  let data:unknown;
  try{data=JSON.parse(raw)}catch{throw new Error('FRAME discovery returned an invalid response.')}
  if(!response.ok)throw new Error(String((data as {error?:unknown})?.error||('Discovery request failed (HTTP '+response.status+').')));
  return data as Record<string,unknown>;
 }catch(e){
  if(e instanceof DOMException&&e.name==='AbortError')throw new Error('Discovery request timed out.');
  throw e;
 }finally{window.clearTimeout(timer)}
}
const tabs:{id:Tab;label:string;icon:typeof Tv;hint:string}[]=[
 {id:'anime',label:'Anime',icon:Tv,hint:'AniList + Jikan'},
 {id:'manga',label:'Manga / Manhwa / LN',icon:BookOpen,hint:'AniList + Jikan'},
 {id:'visual-novel',label:'Visual Novels',icon:BookOpen,hint:'VNDB'},
 {id:'game',label:'Games',icon:Gamepad2,hint:'IGDB + RAWG'},
 {id:'series',label:'Series',icon:Tv,hint:'TMDB + TVmaze'},
 {id:'movie',label:'Movies',icon:Film,hint:'TMDB + Wikipedia'},
 {id:'book',label:'Books',icon:BookOpen,hint:'Open Library + Google Books'}
];

function mangaMedium(media:AniListMedia):Medium{
 if(media.format==='NOVEL')return'light-novel';
 if(media.countryOfOrigin==='KR')return'manhwa';
 return'manga';
}
function localItem(media:AniListSearchResult):MediaItem{
 const ext=media as AniListSearchResult;
 const title=titleOf(media);
 const alternatives=[media.title.english,media.title.romaji,media.title.native,...(media.synonyms||[])].filter((x):x is string=>Boolean(x&&x!==title));
 return{
   id:crypto.randomUUID(),anilistId:ext.sourceProvider==='jikan'?undefined:media.id,sourceProvider:ext.sourceProvider||'anilist',externalId:ext.sourceProvider==='jikan'?String(ext.jikanId||media.id):String(media.id),title,
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
function mapJikanMedia(x:any,type:CatalogType):AniListSearchResult{
 const isManga=type==='MANGA';
 const rawType=String(x?.type||'');
 const format=isManga?(rawType.toUpperCase()==='LIGHT NOVEL'?'NOVEL':rawType.toUpperCase()):rawType.toUpperCase();
 const genres=Array.isArray(x?.genres)?x.genres.map((g:any)=>String(g?.name||'')).filter(Boolean):[];
 const start=x?.aired?.from?new Date(x.aired.from):null;
 const end=x?.aired?.to?new Date(x.aired.to):null;
 return {id:Number(x?.mal_id||0),type:isManga?'MANGA':'ANIME',format,
  title:{romaji:String(x?.title||''),english:x?.title_english?String(x.title_english):null,native:x?.title_japanese?String(x.title_japanese):null,userPreferred:String(x?.title||'')},
  synonyms:Array.isArray(x?.title_synonyms)?x.title_synonyms.map(String):[],description:x?.synopsis?String(x.synopsis):null,
  coverImage:{extraLarge:String(x?.images?.jpg?.large_image_url||x?.images?.jpg?.image_url||'')},bannerImage:null,genres,
  tags:[],season:x?.season?String(x.season).toUpperCase():null,seasonYear:x?.year?Number(x.year):null,averageScore:x?.score==null?null:Number(x.score)*10,
  studios:{nodes:[]},source:null,episodes:isManga?null:(x?.episodes==null?null:Number(x.episodes)),duration:null,
  startDate:start?{year:start.getUTCFullYear(),month:start.getUTCMonth()+1,day:start.getUTCDate()}:null,
  endDate:end?{year:end.getUTCFullYear(),month:end.getUTCMonth()+1,day:end.getUTCDate()}:null,
  chapters:isManga?(x?.chapters==null?null:Number(x.chapters)):null,volumes:isManga?(x?.volumes==null?null:Number(x.volumes)):null,countryOfOrigin:null,
  jikanId:Number(x?.mal_id||0),sourceProvider:'jikan'};
}
async function searchAni(term:string,type:CatalogType){
 if(supabase){
  try{
   const{data,error}=await supabase.functions.invoke('anilist-import',{body:{action:'search',query:term,mediaType:type}});
   if(!error&&Array.isArray((data as SearchResponse|undefined)?.results)&&(data as SearchResponse).results!.length)return(data as SearchResponse).results! as AniListSearchResult[];
  }catch{}
 }
 try{
  const d=await aniList<{Page:{media:AniListMedia[]}}>(SEARCH_QUERY,{search:term,page:1,perPage:12,type});
  if(d.Page.media?.length)return d.Page.media as AniListSearchResult[];
 }catch{}
 const endpoint=type==='MANGA'?'manga':'anime';
 const d=await fetchJsonWithTimeout('https://api.jikan.moe/v4/'+endpoint+'?q='+encodeURIComponent(term.trim())+'&limit=12') as JikanResponse;
 return(Array.isArray(d.data)?d.data:[]).map(x=>mapJikanMedia(x,type));
}
async function fetchJsonWithTimeout(url:string,init?:RequestInit,timeoutMs=12000){
 const controller=new AbortController();
 const timer=window.setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const res=await fetch(url,{...init,signal:controller.signal});
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  return await res.json();
 }catch(e){
  if(e instanceof DOMException&&e.name==='AbortError')throw new Error('request timed out');
  throw e;
 }finally{window.clearTimeout(timer)}
}

function providerLabel(provider:Exclude<Tab,'anime'|'manga'>){
 return provider==='game'?'IGDB + RAWG + Wikipedia fallback':provider==='series'?'TMDB + TVmaze':provider==='movie'?'TMDB + Wikipedia':provider==='book'?'Open Library + Google Books':'VNDB';
}

async function enrichMovieArtwork(results:DiscoveryResult[]){
  if(!results.length)return results;
  const missing=results.filter(x=>x.medium==='movie'&&!x.poster).slice(0,3);
  if(!missing.length)return results;
  try{
    const ids=missing.map(x=>x.externalId).join('|');
    const data=await fetchJsonWithTimeout('https://en.wikipedia.org/w/api.php?action=query&pageids='+encodeURIComponent(ids)+'&prop=images&imlimit=20&format=json&origin=*') as {query?:{pages?:Record<string,any>}};
    const files=new Map<string,string>();
    for(const page of Object.values(data.query?.pages||{})){
      const images=Array.isArray((page as any).images)?(page as any).images:[];
      const title=String((page as any).title||'');
      const candidates=images.map((x:any)=>String(x.title||'')).filter((x:string)=>/\.(jpe?g|png|webp)$/i.test(x)&&!/logo|icon|screenshot|cast/i.test(x));
      const poster=candidates.find((x:string)=>/poster/i.test(x))||candidates.find((x:string)=>x.toLowerCase().includes(title.toLowerCase()))||candidates[0];
      if((page as any).pageid&&poster)files.set(String((page as any).pageid),poster);
    }
    return results.map(x=>{
      if(x.poster)return x;
      const file=files.get(x.externalId);
      return file?{...x,poster:'https://en.wikipedia.org/wiki/Special:Redirect/file/'+encodeURIComponent(file.replace(/^File:/i,''))}:x;
    });
  }catch{return results}
}

async function directExternalSearch(term:string,provider:Exclude<Tab,'anime'|'manga'>):Promise<DiscoveryResult[]>{
 const q=encodeURIComponent(term.trim());
 if(provider==='series'){
  const rows=await fetchJsonWithTimeout('https://api.tvmaze.com/search/shows?q='+q) as Array<{show:any}>;
  return rows.slice(0,12).map(({show})=>({provider:'tvmaze',externalId:String(show.id),title:String(show.name||term),medium:'series',poster:show.image?.original||show.image?.medium,description:show.summary||'',genres:Array.isArray(show.genres)?show.genres:[],year:show.premiered?Number(String(show.premiered).slice(0,4)):undefined,score:show.rating?.average??null,sourceUrl:show.officialSite||show.url,source:'tvmaze'}));
 }
 if(provider==='book'){
  const data=await fetchJsonWithTimeout('https://openlibrary.org/search.json?q='+q+'&limit=12&fields=key,title,author_name,first_publish_year,cover_i') as {docs?:any[]};
  return (data.docs||[]).map(x=>({provider:'openlibrary',externalId:String(x.key||''),title:String(x.title||term),medium:'book',poster:x.cover_i?'https://covers.openlibrary.org/b/id/'+x.cover_i+'-L.jpg':undefined,description:x.author_name?.length?'By '+x.author_name.slice(0,3).join(', '):'',year:x.first_publish_year?Number(x.first_publish_year):undefined,sourceUrl:x.key?'https://openlibrary.org'+x.key:undefined,source:'openlibrary',genres:[]}));
 }
 if(provider==='movie'){
  const url='https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch='+q+'%20film&gsrnamespace=0&gsrlimit=12&prop=extracts|pageimages|info&exintro=1&explaintext=1&inprop=url&piprop=thumbnail&pithumbsize=400&format=json&origin=*';
  const data=await fetchJsonWithTimeout(url) as {query?:{pages?:Record<string,any>}};
  return Object.values(data.query?.pages||{}).map(x=>({provider:'wikipedia',externalId:String(x.pageid),title:String(x.title||term),medium:'movie',poster:x.thumbnail?.source,description:String(x.extract||''),sourceUrl:x.fullurl||('https://en.wikipedia.org/?curid='+x.pageid),source:'wikipedia',genres:[],year:extractYear(x.extract)}));
 }
 if(provider==='game'){
  const url='https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch='+q+'%20video%20game&gsrnamespace=0&gsrlimit=12&prop=extracts|pageimages|info&exintro=1&explaintext=1&inprop=url&piprop=thumbnail&pithumbsize=700&format=json&origin=*';
  const data=await fetchJsonWithTimeout(url) as {query?:{pages?:Record<string,any>}};
  return Object.values(data.query?.pages||{}).map(x=>({provider:'wikipedia-game',externalId:String(x.pageid),title:String(x.title||term),medium:'game',poster:x.thumbnail?.source||'',backdrop:'',description:String(x.extract||''),sourceUrl:x.fullurl||('https://en.wikipedia.org/?curid='+x.pageid),source:'Wikipedia',genres:[],themes:[],year:extractYear(x.extract),game:{isFree:false,platforms:[],releaseDate:undefined,gameModes:[],storeUrl:x.fullurl||('https://en.wikipedia.org/?curid='+x.pageid)}}));
 }
 if(provider==='visual-novel'){
  const data=await fetchJsonWithTimeout('https://api.vndb.org/kana/vn',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filters:['search','=',term.trim()],fields:'id,title,alttitle,description,image.url,released,rating',sort:'searchrank',results:12})
  }) as {results?:any[]};
  return (data.results||[]).map(x=>({provider:'vndb',externalId:String(x.id),title:String(x.title||term),alternativeTitles:x.alttitle?[String(x.alttitle)]:[],medium:'visual-novel',poster:x.image?.url,description:x.description||'',year:x.released?Number(String(x.released).slice(0,4)):undefined,score:x.rating==null?null:Number(x.rating)/10,sourceUrl:'https://vndb.org/'+x.id,source:'vndb',genres:[]}));
 }
 if(provider==='game')return [];
 return [];
}

async function searchExternal(term:string,provider:Exclude<Tab,'anime'|'manga'>){
 let lastError='';
 try{
  const data=await discoveryRequest({action:'search',query:term,provider});
  const found=Array.isArray(data.results)?data.results as DiscoveryResult[]:[];
  if(found.length)return await enrichMovieArtwork(found);
  lastError=String((data as {error?:unknown})?.error||'The discovery service returned no matches.');
 }catch(e){
  lastError=e instanceof Error?e.message:'Discovery request failed.';
 }
 // Direct provider fallback is last-resort only; the FRAME Supabase gateway is preferred.
 try{
  const found=await directExternalSearch(term,provider);
  if(found.length)return await enrichMovieArtwork(found);
 }catch(e){
  lastError=e instanceof Error?e.message:lastError;
 }
 throw new Error(lastError||providerLabel(provider)+' did not return any matches. Try another spelling or title.');
}

async function detailExternal(result:DiscoveryResult){
 try{
  const providerName=['igdb','rawg'].includes(result.provider)?'game':['tmdb-tv','tvmaze'].includes(result.provider)?'series':['tmdb-movie','wikipedia'].includes(result.provider)?'movie':['openlibrary','googlebooks'].includes(result.provider)?'book':'visual-novel';
  const data=await discoveryRequest({action:'detail',provider:providerName,externalId:result.externalId,source:result.provider});
  if(data.result)return data.result as DiscoveryResult;
 }catch{}
 if(supabase){
  try{
   const providerName=['igdb','rawg','wikipedia-game'].includes(result.provider)?'game':['tmdb-tv','tvmaze'].includes(result.provider)?'series':['tmdb-movie','wikipedia'].includes(result.provider)?'movie':['openlibrary','googlebooks'].includes(result.provider)?'book':'visual-novel';
   const{data,error}=await supabase.functions.invoke('media-discovery',{body:{action:'detail',provider:providerName,externalId:result.externalId,source:result.provider}});
   if(!error&&(data as {result?:DiscoveryResult})?.result)return(data as {result:DiscoveryResult}).result!;
  }catch{}
 }
 try{
  if(result.provider==='wikipedia-game'){
   const data=await fetchJsonWithTimeout('https://en.wikipedia.org/w/api.php?action=query&pageids='+encodeURIComponent(result.externalId)+'&prop=pageimages|extracts|info&exintro=1&explaintext=1&inprop=url&piprop=thumbnail&pithumbsize=900&format=json&origin=*') as {query?:{pages?:Record<string,any>}};
   const page=Object.values(data.query?.pages||{})[0];
   if(page)return{...result,title:String((page as any).title||result.title),poster:(page as any).thumbnail?.source||result.poster,description:String((page as any).extract||result.description),year:extractYear((page as any).extract),sourceUrl:(page as any).fullurl||result.sourceUrl,source:'Wikipedia',game:{...(result.game||{}),storeUrl:(page as any).fullurl||result.sourceUrl}};
  }
  if(result.provider==='tvmaze'){
   const x=await fetchJsonWithTimeout('https://api.tvmaze.com/shows/'+encodeURIComponent(result.externalId)+'?embed=episodes') as any;
   return{...result,total:Array.isArray(x._embedded?.episodes)?x._embedded.episodes.length:result.total,description:x.summary||result.description,poster:x.image?.original||result.poster,backdrop:x.image?.original||result.backdrop,sourceUrl:x.officialSite||x.url};
  }
  if(result.provider==='movie'){
   const data=await fetchJsonWithTimeout('https://en.wikipedia.org/w/api.php?action=query&pageids='+encodeURIComponent(result.externalId)+'&prop=pageimages|extracts|info&exintro=1&explaintext=1&inprop=url&piprop=thumbnail&pithumbsize=700&format=json&origin=*') as {query?:{pages?:Record<string,any>}};
   const page=Object.values(data.query?.pages||{})[0];
   if(page)return{...result,title:String((page as any).title||result.title),poster:(page as any).thumbnail?.source||result.poster,description:String((page as any).extract||result.description),year:extractYear((page as any).extract),sourceUrl:(page as any).fullurl||result.sourceUrl};
  }
  if(result.provider==='visual-novel'){
   const data=await fetchJsonWithTimeout('https://api.vndb.org/kana/vn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filters:['id','=',result.externalId],fields:'id,title,alttitle,description,image.url,released,rating',results:1})}) as {results?:any[]};
   const x=data.results?.[0];
   if(x)return{...result,title:String(x.title||result.title),alternativeTitles:x.alttitle?[String(x.alttitle)]:result.alternativeTitles,poster:x.image?.url||result.poster,description:x.description||result.description,year:extractYear(x.released),score:x.rating==null?result.score:Number(x.rating)/10,sourceUrl:'https://vndb.org/'+x.id};
  }
  if(result.provider==='openlibrary'){
   const key=result.externalId.startsWith('/')?result.externalId:'/works/'+result.externalId;
   const x=await fetchJsonWithTimeout('https://openlibrary.org'+key+'.json') as any;
   const cover=x?.covers?.[0];
   if(x)return{...result,title:String(x.title||result.title),poster:cover?'https://covers.openlibrary.org/b/id/'+cover+'-L.jpg':result.poster,description:typeof x.description==='string'?x.description:typeof x.description?.value==='string'?x.description.value:result.description,year:x.first_publish_date?extractYear(String(x.first_publish_date)):result.year,sourceUrl:'https://openlibrary.org'+key};
  }
 }catch{}
 return result;
}

function extractYear(value?:string|null){
 const m=String(value||'').match(/(?:18|19|20)\d{2}/);
 return m?Number(m[0]):undefined;
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

export function AniListSearch({close,onImported,onManual,initialQuery='',guest=false}:{close:()=>void;onImported:(item:MediaItem)=>void|Promise<void>;onManual?:()=>void;initialQuery?:string;guest?:boolean}){
 const[tab,setTab]=useState<Tab>('anime'),[query,setQuery]=useState(initialQuery),[results,setResults]=useState<(AniListMedia|DiscoveryResult)[]>([]),[selected,setSelected]=useState<AniListMedia|DiscoveryResult|null>(null);
 const[loading,setLoading]=useState(false),[detailLoading,setDetailLoading]=useState(false),[importing,setImporting]=useState(false),[added,setAdded]=useState(false),[error,setError]=useState('');
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
  },tab==='game'?950:450);
  return()=>{cancelled=true;window.clearTimeout(timer)};
 },[query,tab,isAni,catalogType]);

 const choose=async(raw:AniListSearchResult|DiscoveryResult)=>{
  setSelected(raw);setAdded(false);setDetailLoading(true);setError('');
  try{
   if(isAni){
    const r=raw as AniListSearchResult;
    if(r.sourceProvider==='jikan'&&r.jikanId){
     const endpoint=tab==='manga'?'manga':'anime';
     const data=await fetchJsonWithTimeout('https://api.jikan.moe/v4/'+endpoint+'/'+r.jikanId) as {data?:any};
     if(!data.data)throw new Error('Jikan details were not available.');
     setSelected(mapJikanMedia(data.data,catalogType));
    }else{
     const d=await aniList<{Media:AniListMedia}>(DETAIL_QUERY,{id:r.id});setSelected(d.Media as AniListSearchResult);
    }
   }else setSelected(await detailExternal(raw as DiscoveryResult));
  }catch(e){setError(e instanceof Error?e.message:'Could not load full metadata.')}
  finally{setDetailLoading(false)}
 };
 const importMedia=async()=>{
  if(!selected||added)return;
  setImporting(true);setError('');
  try{
   const candidate=isAni?localItem(selected as AniListSearchResult):externalToMedia(selected as DiscoveryResult);
   const result=await onImported(candidate);
   if(result!==false)setAdded(true);
   else setError('This title is already in your library.');
  }catch(e){setError(e instanceof Error?e.message:'Could not add this title to your library. Please try again.')}
  finally{setImporting(false)}
 };
 const selectedAni=isAni?(selected as AniListSearchResult|null):null;
 const selectedExt=!isAni?(selected as DiscoveryResult|null):null;
 const resultKey=(x:AniListSearchResult|DiscoveryResult)=>isAni?String((x as AniListSearchResult).sourceProvider||'anilist')+':'+String((x as AniListSearchResult).id):(x as DiscoveryResult).provider+':'+(x as DiscoveryResult).externalId;
 const resultInfo=(x:AniListSearchResult|DiscoveryResult)=>{
  if(isAni){const m=x as AniListMedia;return{title:titleOf(m),poster:m.coverImage?.extraLarge||'',meta:anilistMediumLabel(m)+' · '+(m.format||'Unknown format')+(m.seasonYear?' · '+m.seasonYear:''),tags:m.genres?.slice(0,3)||[]}}
  const r=x as DiscoveryResult;return{title:r.title,poster:r.poster||'',meta:r.medium.toUpperCase()+' · '+providerLabel(tab as Exclude<Tab,'anime'|'manga'>)+(r.year?' · '+r.year:''),tags:r.genres?.slice(0,3)||[]};
 };
 return <div className="modalwrap" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
  <div className="modal search-modal">
   <div className="modalhead"><div><small>MEDIA DISCOVERY</small><h2>Find anything for FRAME</h2><p className="muted">Live catalogues for anime, manga, manhwa, games, series, movies and books.</p></div><button onClick={close} aria-label="Close"><X/></button></div>
   <div className="search-big"><Search size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close()}}} aria-label="Search media" placeholder={current.id==='game'?'Search games by title…':current.id==='series'?'Search TV series…':current.id==='movie'?'Search movies by title…':current.id==='book'?'Search books / novels…':current.id==='visual-novel'?'Search visual novels…':current.id==='manga'?'Search manga, manhwa or light novels…':'Search anime, movies, seasons…'}/></div>
   <div className="catalog-tabs catalog-tabs-wide" role="tablist" aria-label="Media catalogues">{tabs.map(t=>{const Icon=t.icon;return <button role="tab" aria-selected={tab===t.id} key={t.id} className={tab===t.id?'active':''} onClick={()=>{setTab(t.id);setResults([]);setSelected(null);setAdded(false);setError('')}}><Icon size={14}/>{t.label}<small>{t.hint}</small></button>})}</div>
   {error&&<div className="inline-error"><AlertCircle size={15}/><span>{error}</span></div>}
   {loading&&<div className="search-state"><Loader2 className="spin"/>Searching {current.hint}…</div>}
   {!loading&&query.trim().length<2&&<div className="search-state">Choose a catalogue and type at least two characters.</div>}
   {!loading&&query.trim().length>=2&&!results.length&&!error&&<div className="search-state">No results yet. Try another title or spelling.</div>}
   {results.length>0&&<div className="ani-results">{results.map(r=>{const i=resultInfo(r);const isSelected=isAni?(selected as AniListMedia|null)?.id===(r as AniListMedia).id:(selected as DiscoveryResult|null)?.externalId===(r as DiscoveryResult).externalId;return <button type="button" key={resultKey(r)} className={isSelected?'ani-result selected':'ani-result'} onClick={()=>void choose(r)}>
    <img className="ani-result-art" src={i.poster||'/frame-logo.svg'} alt={i.title} loading="lazy" decoding="async" onError={e=>{e.currentTarget.src='/frame-logo.svg';e.currentTarget.classList.add('image-fallback')}}/>
    <span className="ani-result-copy"><b>{i.title}</b><small>{i.meta}</small><em>{i.tags.join(' · ')||'Metadata available on selection'}</em></span>
   </button>})}</div>}
   {onManual&&!selected&&<button className="secondary manual-fallback" onClick={onManual}>Can't find it? Add manually</button>}
  </div>

  {selected&&<div className="finder-detail-layer" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}>
   <section className="finder-detail-bubble" role="dialog" aria-modal="true" aria-label="Media details" onMouseDown={e=>e.stopPropagation()}>
    <button className="finder-detail-close" type="button" aria-label="Back to search results" onClick={()=>setSelected(null)}><X/></button>
    <div className="finder-detail-head">
     {isAni&&selectedAni?<img className="finder-detail-poster" src={selectedAni.coverImage?.extraLarge||'/frame-logo.svg'} alt={titleOf(selectedAni)} onError={e=>{e.currentTarget.src='/frame-logo.svg';e.currentTarget.classList.add('image-fallback')}}/>:
      selectedExt?<img className="finder-detail-poster" src={selectedExt.poster||'/frame-logo.svg'} alt={selectedExt.title} onError={e=>{e.currentTarget.src='/frame-logo.svg';e.currentTarget.classList.add('image-fallback')}}/>:null}
     <div className="finder-detail-copy">
      {isAni&&selectedAni?<><small>{anilistMediumLabel(selectedAni)} · AniList</small><h3>{titleOf(selectedAni)}</h3><div className="tags">{selectedAni.genres?.map((x:string)=><span key={x}>{x}</span>)}</div></>:
       selectedExt?<><small>{selectedExt.medium.toUpperCase()} · {selectedExt.source||providerLabel(tab as Exclude<Tab,'anime'|'manga'>)}</small><h3>{selectedExt.title}</h3><div className="tags">{(selectedExt.genres||[]).map((x:string)=><span key={x}>{x}</span>)}</div></>:null}
     </div>
    </div>
    <div className="finder-detail-body">
     {detailLoading?<p className="finder-detail-loading"><Loader2 className="spin"/>Loading full metadata…</p>:<>
      <p>{cleanDescription(isAni&&selectedAni?selectedAni.description:selectedExt?.description)||'No description available.'}</p>
      {selectedExt?.year&&<p className="finder-detail-meta">Year: {selectedExt.year}</p>}
      {selectedExt?.sourceUrl&&<p className="finder-detail-meta">Source: {selectedExt.sourceUrl}</p>}
     </>}
     <div className="ani-actions finder-detail-actions">
      <button className="primary" disabled={importing||detailLoading||added} onClick={()=>void importMedia()}>{importing?<Loader2 className="spin"/>:<Download/>}{added?'Added to library':importing?'Adding…':'Add to my library'}</button>
      {isAni&&selectedAni?<a href={'https://anilist.co/'+selectedAni.type.toLowerCase()+'/'+selectedAni.id} target="_blank" rel="noreferrer"><ExternalLink/>Source</a>:
       selectedExt?.sourceUrl?<a href={selectedExt.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink/>Source</a>:null}
      {onManual&&<button className="secondary" onClick={onManual}>Manual entry</button>}
     </div>
    </div>
   </section>
  </div>}
 </div>;
}
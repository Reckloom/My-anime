import {useEffect,useState} from 'react';
import type {MediaItem,Medium} from '../types';
import {ANILIST_URL,type AniListMedia,SEARCH_QUERY,DETAIL_QUERY} from '../anilist';

type Props={
 title:string; medium:Medium; poster?:string; anilistId?:number; parentPoster?:string; parentTitle?:string; parentMedium?:Medium; parentAnilistId?:number;
 sourceProvider?:string; externalId?:string; posterSource?:string; className?:string; alt?:string; loading?:'eager'|'lazy';
};
const cache=new Map<string,Promise<string>>();
let activeArtworkRequests=0;
const artworkRequestQueue:Array<()=>void>=[];
async function withArtworkLimit<T>(job:()=>Promise<T>):Promise<T>{
 if(activeArtworkRequests>=4)await new Promise<void>(resolve=>artworkRequestQueue.push(resolve));
 activeArtworkRequests++;
 try{return await job()}finally{activeArtworkRequests--;artworkRequestQueue.shift()?.();}
}
const normal=(v:string)=>v.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const isNarutoHierarchy=(p:Props)=>/frame-naruto-(?:arc|episode)/i.test(p.sourceProvider||'');
const isPlaceholderArtwork=(value?:string)=>!value||value.toLowerCase().includes('frame-logo.svg');
const isHierarchyNode=(p:Props)=>p.sourceProvider==='frame-story-arc'||isNarutoHierarchy(p)||/one-piece-(?:arc|episode)-/i.test(p.externalId||'');
const svgFallback=(title:string,medium:Medium)=>{
 const hash=[...title].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
 const hue=hash%360,second=(hue+62)%360;
 const short=title.length>42?title.slice(0,39)+'…':title;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="900" viewBox="0 0 640 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl('+hue+',54%,22%)"/><stop offset="1" stop-color="hsl('+second+',65%,8%)"/></linearGradient><pattern id="p" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M0 44L44 0" stroke="white" stroke-opacity=".06" stroke-width="2"/></pattern></defs><rect width="640" height="900" fill="url(#g)"/><rect width="640" height="900" fill="url(#p)"/><circle cx="510" cy="160" r="150" fill="white" fill-opacity=".045"/><circle cx="80" cy="730" r="210" fill="white" fill-opacity=".035"/><text x="48" y="710" fill="white" fill-opacity=".65" font-family="Arial,sans-serif" font-size="20" letter-spacing="5">'+medium.toUpperCase()+'</text><text x="48" y="770" fill="white" font-family="Arial,sans-serif" font-size="42" font-weight="700">'+escapeXml(short)+'</text><path d="M48 800H220" stroke="hsl('+hue+',80%,70%)" stroke-width="5" stroke-linecap="round"/></svg>';
 return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
};
const escapeXml=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
async function resolve(p:Props):Promise<string>{
 const sharedOnePiecePoster='https://media.themoviedb.org/t/p/w500/dB4EDhre2dsC2kxYDavyKWqLQwi.jpg';
 const isOnePiece=/^one piece$/i.test(p.title.trim());
 const hasSavedPoster=Boolean(p.poster&&!isPlaceholderArtwork(p.poster)&&!/(?:not-available|not-supplied-by-source)/i.test(p.posterSource||'')&&!(p.poster===sharedOnePiecePoster&&!isOnePiece));
 if(hasSavedPoster&&(!['anime','manga','manhwa','light-novel'].includes(p.medium)||isHierarchyNode(p)))return p.poster;
 const isEpisode=/frame-(?:anime|naruto)-episode/i.test(p.sourceProvider||'')||/:episode:\\d+$/i.test(p.externalId||'')||/naruto-episode-/i.test(p.externalId||'');
 if(isEpisode)return hasSavedPoster?p.poster!:svgFallback(p.title,p.medium);
  const isSeriesMedia=['anime','manga','manhwa','light-novel'].includes(p.medium);
 if(isNarutoHierarchy(p)){
  if(hasSavedPoster)return p.poster!;
  return svgFallback(p.title,p.medium);
 }
 if(isHierarchyNode(p)){
  if(p.poster&&!isPlaceholderArtwork(p.poster))return p.poster;
  return svgFallback(p.title,p.medium);
 }
 if(!isSeriesMedia)return p.poster||p.parentPoster||svgFallback(p.title,p.medium);
 const type=p.medium==='anime'?'ANIME':'MANGA';
 const key=p.anilistId?'id:'+p.anilistId:type+':'+normal(p.title);
 const existing=cache.get(key);if(existing)return existing;
 const request=withArtworkLimit(async()=>{
  try{
   let media:AniListMedia|undefined;
   if(p.anilistId){
    const response=await fetch(ANILIST_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:DETAIL_QUERY,variables:{id:p.anilistId}})});
    if(response.ok){const json=await response.json() as {data?:{Media?:AniListMedia}};media=json.data?.Media;}
   }else{
    const response=await fetch(ANILIST_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:SEARCH_QUERY,variables:{search:p.title,page:1,perPage:8,type}})});
    if(response.ok){const json=await response.json() as {data?:{Page?:{media?:AniListMedia[]}}};const results=json.data?.Page?.media||[];const target=normal(p.title);media=results.find(m=>[m.title.english,m.title.romaji,m.title.native,m.title.userPreferred,...(m.synonyms||[])].some(v=>v&&normal(v)===target));}
   }
   const image=media?.coverImage?.extraLarge;
   const titleMatches=Boolean(media&&[media.title.english,media.title.romaji,media.title.native,media.title.userPreferred,...(media.synonyms||[])].some(v=>v&&normal(v)===normal(p.title)));
  if(image&&media?.type===type&&titleMatches)return image;
  }catch{/* external metadata can be unavailable */}
  if(isSeriesMedia)return hasSavedPoster?p.poster!:p.parentPoster||svgFallback(p.title,p.medium);
  return p.poster||p.parentPoster||svgFallback(p.title,p.medium);
 });
 cache.set(key,request);
 return request;
}
export function artworkFallbackAncestor(item:MediaItem,library:MediaItem[]):MediaItem{
 let current=item;
 while(current.parentId){
  const parent=library.find(x=>x.id===current.parentId);
  if(!parent)break;
  current=parent;
  if(!isHierarchyNode({sourceProvider:current.sourceProvider,externalId:current.externalId,title:current.title,medium:current.medium}))return current;
 }
 return current;
}
function safeInitialArtwork(p:Props){
 if(p.poster&&!isPlaceholderArtwork(p.poster)&&!/(?:not-available|not-supplied-by-source)/i.test(p.posterSource||''))return p.poster;
 if(isNarutoHierarchy(p)||isHierarchyNode(p))return svgFallback(p.title,p.medium);
 if(['anime','manga','manhwa','light-novel'].includes(p.medium))return p.parentPoster||svgFallback(p.title,p.medium);
 return p.parentPoster||svgFallback(p.title,p.medium);
}
export function FrameArtwork(p:Props){
 const [src,setSrc]=useState(()=>safeInitialArtwork(p));
 useEffect(()=>{let active=true;void resolve(p).then(value=>{if(active)setSrc(value)});return()=>{active=false}},[p.title,p.medium,p.poster,p.anilistId,p.parentPoster,p.parentTitle,p.parentMedium,p.parentAnilistId,p.sourceProvider,p.externalId]);
 const fallback=safeInitialArtwork(p);
 return <img className={p.className} src={src} alt={p.alt??p.title} loading={p.loading||'lazy'} onError={e=>{const img=e.currentTarget;if(img.dataset.fallbackApplied==='1')return;img.dataset.fallbackApplied='1';img.src=fallback!==src?fallback:svgFallback(p.title,p.medium)}}/>;
}

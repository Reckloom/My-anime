import {useEffect,useState} from 'react';
import type {MediaItem,Medium} from '../types';
import {posterImageSrc} from '../posterImage';
import {ANILIST_URL,type AniListMedia,SEARCH_QUERY,DETAIL_QUERY} from '../anilist';

type Props={
 title:string; medium:Medium; poster?:string; anilistId?:number; parentPoster?:string; parentTitle?:string; parentMedium?:Medium; parentAnilistId?:number;
 sourceProvider?:string; externalId?:string; posterSource?:string; className?:string; alt?:string; loading?:'eager'|'lazy';
};
const ARTWORK_CACHE_LIMIT=256;
const cache=new Map<string,Promise<string>>();
function getArtworkCache(key:string){
 const cached=cache.get(key);
 if(cached){cache.delete(key);cache.set(key,cached);}
 return cached;
}
function setArtworkCache(key:string,value:Promise<string>){
 cache.delete(key);
 cache.set(key,value);
 while(cache.size>ARTWORK_CACHE_LIMIT){
  const oldest=cache.keys().next().value as string|undefined;
  if(oldest===undefined)break;
  cache.delete(oldest);
 }
}
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
const isHierarchyNode=(p:Props)=>p.sourceProvider==='frame-story-arc'||/^frame-anime-(?:season|arc|episode)$/i.test(p.sourceProvider||'')||isNarutoHierarchy(p)||/one-piece-(?:arc|episode)-/i.test(p.externalId||'')||/(?:^|[-_])(season|s)\d+(?:[-_]|$)/i.test(p.externalId||'')||/(?:^|[-_])arc[-_]/i.test(p.externalId||'');
const svgFallback=(title:string,medium:Medium)=>{
 const hash=[...title].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
 const hue=hash%360,second=(hue+62)%360;
 const short=title.length>42?title.slice(0,39)+'…':title;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="900" viewBox="0 0 640 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl('+hue+',54%,22%)"/><stop offset="1" stop-color="hsl('+second+',65%,8%)"/></linearGradient><pattern id="p" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M0 44L44 0" stroke="white" stroke-opacity=".06" stroke-width="2"/></pattern></defs><rect width="640" height="900" fill="url(#g)"/><rect width="640" height="900" fill="url(#p)"/><circle cx="510" cy="160" r="150" fill="white" fill-opacity=".045"/><circle cx="80" cy="730" r="210" fill="white" fill-opacity=".035"/><text x="48" y="710" fill="white" fill-opacity=".65" font-family="Arial,sans-serif" font-size="20" letter-spacing="5">'+medium.toUpperCase()+'</text><text x="48" y="770" fill="white" font-family="Arial,sans-serif" font-size="42" font-weight="700">'+escapeXml(short)+'</text><path d="M48 800H220" stroke="hsl('+hue+',80%,70%)" stroke-width="5" stroke-linecap="round"/></svg>';
 return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
};
const escapeXml=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');\nconst dedicatedHierarchyArtwork=(title:string)=>{
 const t=normal(title);
 // Explicit poster map for Link Click and To Be Hero X, plus Dragon Ball hierarchy.
 if(t.includes('link click')&&t.includes('season 1'))return 'https://images.justwatch.com/poster/311397638/s718/temporada-1.jpg';
 if(t.includes('link click')&&t.includes('season 2'))return 'https://images.plex.tv/photo?scale=2&size=medium-360&url=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Foriginal%2F3cyLMR577jQ2steJATIJ3tpxtoP.jpg';
 if(t.includes('to be hero x')&&t.includes('season 1'))return 'https://tbhx.net/wp-content/uploads/2025/03/keyvisual.jpg';
 if(t.includes('link click')&&t.includes('bridon'))return 'https://a.storyblok.com/f/178900/1280x720/ab35cef3fe/link-click-bridon-arc-kv-wide.jpg';
 if(t.includes('link click')&&t.includes('season 3'))return 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/b191832.jpg';
 if(t.includes('daima')&&t.includes('season 1'))return 'https://www.toei-animation-usa.com/newsAdmin/uploads/posts/617121621.jpg';
 if(t==='daima arc'||t.includes('daima arc'))return 'https://ogre.natalie.mu/media/news/comic/2024/0719/DBDAIMA_KV.jpg';
 if(t.includes('season 1')&&t.includes('black star dragon balls'))return 'https://metrunui.github.io/images/dbgts1.jpg';
 if(t.includes('season 2')&&t.includes('baby')&&t.includes('super 17')&&t.includes('shadow dragons'))return 'https://cdn.moviepilot.de/files/ca5e65dedfc253e92a08f59d1db4b8b45093fb2306d91994ec851009d4eb/limit/1600/900/dragon-ball-gt-season-2-poster-01.jpg';
 if(t.includes('black star dragon ball'))return 'https://resizing.flixster.com/-XZAfHZM39UwaGJIFWKAE8fS0ak%3D/v3/t/assets/p11929145_b_v8_aa.jpg';
 if(t.includes('baby'))return 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/29e04197-041b-4715-ba54-2d9132ce1b19/dfy9qsc-35e8ff7a-0734-4a64-ae84-0b8dbd061bde.png/v1/fill/w_1280%2Ch_720%2Cq_80%2Cstrp/dragon_ball_gt_baby_saga_poster_1_3_by_rcm2_dfy9qsc-fullview.jpg';
 if(t.includes('super 17'))return 'https://resizing.flixster.com/-XZAfHZM39UwaGJIFWKAE8fS0ak%3D/v3/t/assets/p11929148_b_v8_aa.jpg';
 if(t.includes('shadow dragon'))return 'https://i.pinimg.com/originals/94/32/60/943260f0ebd201af8f85161d22b4da9d.jpg';
 return undefined;
};

async function resolve(p:Props):Promise<string>{
 const sharedOnePiecePoster='https://media.themoviedb.org/t/p/w500/dB4EDhre2dsC2kxYDavyKWqLQwi.jpg';
 const isOnePiece=/^one piece$/i.test(p.title.trim());
 const hasSavedPoster=Boolean(p.poster&&!isPlaceholderArtwork(p.poster)&&!/(?:not-available|not-supplied-by-source)/i.test(p.posterSource||'')&&!(p.poster===sharedOnePiecePoster&&!isOnePiece));
 const hasDistinctSavedPoster=hasSavedPoster&&(!p.parentPoster||p.poster!==p.parentPoster);
 // Saved artwork is authoritative for custom/imported sources. For normal
 // AniList series records, validate the stored ID once so a stale poster cannot
 // remain attached to the wrong title (while still preserving artwork when the
 // external ID itself is mismatched).
 const isSeriesMedia=['anime','manga','manhwa','light-novel'].includes(p.medium);
 const shouldValidateSaved=hasSavedPoster&&isSeriesMedia&&String(p.sourceProvider||'').toLowerCase()==='anilist'&&Boolean(p.anilistId);
 if(hasSavedPoster&&!shouldValidateSaved)return p.poster as string;
 const isEpisode=/frame-(?:anime|naruto)-episode/i.test(p.sourceProvider||'')||/:episode:\\d+$/i.test(p.externalId||'')||/naruto-episode-/i.test(p.externalId||'');
 if(isEpisode)return hasSavedPoster?p.poster as string:svgFallback(p.title,p.medium);\n const dedicatedHierarchyPoster=dedicatedHierarchyArtwork(p.title);
 if(dedicatedHierarchyPoster)return dedicatedHierarchyPoster;
  if(isNarutoHierarchy(p)){
  if(hasDistinctSavedPoster)return p.poster!;
  if(p.parentAnilistId){
   try{
    const response=await fetch(ANILIST_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:DETAIL_QUERY,variables:{id:p.parentAnilistId}})});
    if(response.ok){
     const json=await response.json() as {data?:{Media?:AniListMedia}};
     const image=json.data?.Media?.coverImage?.extraLarge;
     if(image)return image;
    }
   }catch{/* parent artwork can be unavailable */}
  }
  return p.parentPoster||svgFallback(p.title,p.medium);
 }
 if(isHierarchyNode(p)){
  if(hasDistinctSavedPoster)return p.poster as string;
  // First try to find artwork for the exact season/arc title. This keeps
  // every anime consistent instead of making special-case poster rules.
  if(isSeriesMedia){
   try{
    const type=p.medium==='anime'?'ANIME':'MANGA';
    const response=await fetch(ANILIST_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:SEARCH_QUERY,variables:{search:p.title,page:1,perPage:8,type}})});
    if(response.ok){
     const json=await response.json() as {data?:{Page?:{media?:AniListMedia[]}}};
     const results=json.data?.Page?.media||[];
     const target=normal(p.title);
     const exact=results.find(m=>[m.title.english,m.title.romaji,m.title.native,m.title.userPreferred,...(m.synonyms||[])].some(v=>v&&normal(v)===target));
     const image=exact?.coverImage?.extraLarge;
     if(image)return image;
    }
   }catch{/* exact season/arc artwork can be unavailable */}
  }
  if(p.parentAnilistId){
   try{
    const response=await fetch(ANILIST_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:DETAIL_QUERY,variables:{id:p.parentAnilistId}})});
    if(response.ok){
     const json=await response.json() as {data?:{Media?:AniListMedia}};
     const image=json.data?.Media?.coverImage?.extraLarge;
     if(image)return image;
    }
   }catch{/* parent artwork can be unavailable */}
  }
  return p.parentPoster||svgFallback(p.title,p.medium);
 }
 if(!isSeriesMedia)return p.poster||p.parentPoster||svgFallback(p.title,p.medium);
 const type=p.medium==='anime'?'ANIME':'MANGA';
 const key=type+':'+(p.anilistId?'id:'+p.anilistId+':' : 'title:')+normal(p.title)+':poster:'+(p.poster||'')+':parent:'+(p.parentPoster||'')+':source:'+(p.posterSource||'');
 const existing=getArtworkCache(key);if(existing)return existing;
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
   const idTitleMatches=Boolean(media&&[media.title.english,media.title.romaji,media.title.native,media.title.userPreferred,...(media.synonyms||[])].some(v=>v&&normal(v)===normal(p.title)));
   if(!idTitleMatches){
    const response=await fetch(ANILIST_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:SEARCH_QUERY,variables:{search:p.title,page:1,perPage:8,type}})});
    if(response.ok){const json=await response.json() as {data?:{Page?:{media?:AniListMedia[]}}};const results=json.data?.Page?.media||[];const target=normal(p.title);const exact=results.find(m=>m.type===type&&[m.title.english,m.title.romaji,m.title.native,m.title.userPreferred,...(m.synonyms||[])].some(v=>v&&normal(v)===target));if(exact)media=exact;}
   }
   const image=media?.coverImage?.extraLarge;
   const titleMatches=Boolean(media&&[media.title.english,media.title.romaji,media.title.native,media.title.userPreferred,...(media.synonyms||[])].some(v=>v&&normal(v)===normal(p.title)));
  if(image&&media?.type===type&&titleMatches)return image;
  if(media&&!titleMatches)return hasSavedPoster&&p.poster?p.poster:svgFallback(p.title,p.medium);
  }catch{/* external metadata can be unavailable */}
  if(isSeriesMedia){if(hasSavedPoster&&p.poster)return p.poster as string;return p.parentPoster||svgFallback(p.title,p.medium);}
  return p.poster||p.parentPoster||svgFallback(p.title,p.medium);
 });
 setArtworkCache(key,request);
 void request.then(value=>{if(value.startsWith('data:image/svg+xml')&&getArtworkCache(key)===request)cache.delete(key)}).catch(()=>{if(cache.get(key)===request)cache.delete(key)});
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
 if(isNarutoHierarchy(p)||isHierarchyNode(p))return dedicatedHierarchyArtwork(p.title)||svgFallback(p.title,p.medium);
 if(['anime','manga','manhwa','light-novel'].includes(p.medium))return p.parentPoster||svgFallback(p.title,p.medium);
 return p.parentPoster||svgFallback(p.title,p.medium);
}
export function FrameArtwork(p:Props){
 const [src,setSrc]=useState(()=>safeInitialArtwork(p));
 useEffect(()=>{let active=true;void resolve(p).then(value=>{if(active)setSrc(value)});return()=>{active=false}},[p.title,p.medium,p.poster,p.anilistId,p.parentPoster,p.parentTitle,p.parentMedium,p.parentAnilistId,p.sourceProvider,p.externalId]);
 const fallback=safeInitialArtwork(p);
 return <img className={p.className} src={posterImageSrc(src)} alt={p.alt??p.title} loading={p.loading||'lazy'} onError={e=>{const img=e.currentTarget;if(img.dataset.fallbackApplied==='1')return;img.dataset.fallbackApplied='1';img.src=posterImageSrc(fallback!==src?fallback:svgFallback(p.title,p.medium))}}/>;
}

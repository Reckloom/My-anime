import {useEffect,useState} from 'react';
import type {MediaItem,Medium} from '../types';
import {posterImageSrc,proxyImageSrc} from '../posterImage';
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

const portraitValidationCache = new Map<string, Promise<boolean>>();
async function isPortraitSource(source?: string): Promise<boolean> {
 const url = String(source || '').trim();
 if (!url || url.startsWith('data:') || /frame-logo\.svg/i.test(url)) return false;
 const previous = portraitValidationCache.get(url);
 if (previous) return previous;
 const check = new Promise<boolean>(resolve => {
  const image = new Image();
  let finished = false;
  const timer = window.setTimeout(() => finish(false), 10000);
  const finish = (valid: boolean) => {
   if (finished) return;
   finished = true;
   window.clearTimeout(timer);
   resolve(valid);
  };
  image.onload = () => finish(
   image.naturalWidth > 0 &&
   image.naturalHeight > image.naturalWidth &&
   image.naturalHeight / image.naturalWidth >= 1.3
  );
  image.onerror = () => finish(false);
  image.src = url;
 });
 portraitValidationCache.set(url, check);
 while (portraitValidationCache.size > 512) {
  const first = portraitValidationCache.keys().next().value as string | undefined;
  if (!first) break;
  portraitValidationCache.delete(first);
 }
 return check;
}
const normal=(v:string)=>v.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const isNarutoHierarchy=(p:Props)=>/frame-naruto-(?:arc|episode)/i.test(p.sourceProvider||'');
const isFabricatedAniListPoster=(value?:string)=>{
 const v=String(value||'').trim();
 return /^https:\/\/s\d+\.anilist\.co\/file\/anilistcdn\/media\/anime\/cover\/large\/b\d+\.jpg(?:\?[^\s]*)?$/i.test(v);
};
const isBareAniListCover=(value?:string)=>{
 const v=String(value||'').trim();
 return /^https:\/\/s\d+\.anilist\.co\/file\/anilistcdn\/media\/anime\/cover\/large\/b\d+\.jpg(?:\?[^\s]*)?$/i.test(v);
};
const isPlaceholderArtwork=(value?:string)=>!value||value.toLowerCase().includes('frame-logo.svg')||isBareAniListCover(value);
const isHierarchyNode=(p:Props)=>p.sourceProvider==='frame-story-arc'||/^frame-anime-(?:season|arc|episode)$/i.test(p.sourceProvider||'')||isNarutoHierarchy(p)||/one-piece-(?:arc|episode)-/i.test(p.externalId||'')||/(?:^|[-_])(season|s)\d+(?:[-_]|$)/i.test(p.externalId||'')||/(?:^|[-_])arc[-_]/i.test(p.externalId||'');
const svgFallback=(title:string,medium:Medium)=>{
 const hash=[...title].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
 const hue=hash%360,second=(hue+62)%360;
 const short=title.length>42?title.slice(0,39)+'…':title;
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="900" viewBox="0 0 640 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl('+hue+',54%,22%)"/><stop offset="1" stop-color="hsl('+second+',65%,8%)"/></linearGradient><pattern id="p" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M0 44L44 0" stroke="white" stroke-opacity=".06" stroke-width="2"/></pattern></defs><rect width="640" height="900" fill="url(#g)"/><rect width="640" height="900" fill="url(#p)"/><circle cx="510" cy="160" r="150" fill="white" fill-opacity=".045"/><circle cx="80" cy="730" r="210" fill="white" fill-opacity=".035"/><text x="48" y="710" fill="white" fill-opacity=".65" font-family="Arial,sans-serif" font-size="20" letter-spacing="5">'+medium.toUpperCase()+'</text><text x="48" y="770" fill="white" font-family="Arial,sans-serif" font-size="42" font-weight="700">'+escapeXml(short)+'</text><path d="M48 800H220" stroke="hsl('+hue+',80%,70%)" stroke-width="5" stroke-linecap="round"/></svg>';
 return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
};
const escapeXml=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const FORCED_REPLACEMENT_ARTWORK:Record<string,string>={
  'steins gate':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b9253.jpg',
  'hell s paradise':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b128893.jpg',
  'solo leveling':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b151807.jpg',
  'chainsaw man':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b127230.jpg',
  'dragon ball gt':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b225.jpg',
  'dragon ball daima':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b170083.jpg',
  'kono subarashii sekai ni shukufuku wo':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b21202.jpg',
  'that time i got reincarnated as a slime':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b101280.jpg',
  'summer time render':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b129201.jpg',
  're zero kara hajimeru isekai seikatsu':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b21355.jpg',
  'to be hero x':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b156092.jpg',
  'vinland saga':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b101348.jpg',
  'fullmetal alchemist brotherhood':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b5114.jpg',
  'bleach':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b269.jpg',
  'dragon ball z':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b813.jpg',
  'dragon ball':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b223.jpg',
  'dragon ball super':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b21175.jpg',
  'attack on titan':'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b16498.jpg',
  'welcome to demon school iruma kun':'https://image.tmdb.org/t/p/original/tm6JNOQvkNyjHmqvKHM89PLqSTe.jpg',
  'sentenced to be a hero':'https://images.plex.tv/photo?scale=1&size=large-1920&url=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Foriginal%2Fk8bh5mvHDx3czHSF56v9lRyulLC.jpg',
  'i parry everything':'https://fr.web.img2.acsta.net/img/a8/da/a8dabd07ee11431241d0284cfcdf7514.jpg',
  'the ossan newbie adventurer trained to death by the most powerful party became invincible':'https://fr.web.img5.acsta.net/img/d8/59/d8591ab6aa3a53dd6cec9c540b50ce8a.jpg',
  'mushoku tensei jobless reincarnation':'https://peliculas.lavanguardia.com/imagenes/w1280/jp3nrI6D8h3mwsCLIgv6MFQvV6Q.jpg',
  'that time i reincarnated as a slime':'https://www.manga-news.com/public/images/dvd/Moi_quand_je_me_re_incarne_en_slime_anime.webp',
  'konosuba god s blessing on this wonderful world':'https://pics.filmaffinity.com/konosuba_kono_subarashii_sekai_ni_shukufuku_o-548726764-large.jpg',
  'overlord':'https://image.tmdb.org/t/p/original/7VCM0JezWRdt0sgaBNrv2eibg3t.jpg'
};
const FORCED_HIERARCHY_ARTWORK:Record<string,string>={
  'welcome to demon school iruma kun|season 1':'https://image.tmdb.org/t/p/original/rW5q9ezyHkkn8qtJjgnQa6fz4n1.jpg',
  'welcome to demon school iruma kun|season 2':'https://es.web.img3.acsta.net/pictures/20/09/24/14/43/4753851.jpg',
  'welcome to demon school iruma kun|season 4':'https://cdn.anime-planet.com/anime/primary/welcome-to-demon-school-iruma-kun-4-1.webp?t=1731866418',
  'sentenced to be a hero|season 1':'https://images.justwatch.com/poster/340658927/s718/Staffel-1.jpg',
  'i parry everything|season 1':'https://pics.filmaffinity.com/I_Parry_Everything_What_Do_You_Mean_I_m_the_Strongest_I_m_Not_Even_an_Adventurer_Yet_Serie_de_TV-928640450-large.jpg',
  'the ossan newbie adventurer trained to death by the most powerful party became invincible|season 1':'https://media.kg-portal.ru/anime/s/shinmaiossanbkenshasaikypartynishinuhodokitaeraretemutekininaru/posters/shinmaiossanbkenshasaikypartynishinuhodokitaeraretemutekininaru_1.jpg',
  'mushoku tensei jobless reincarnation|season 1':'https://images.theposterdb.com/prod/public/images/posters/optimized/shows/224306/season_1/nthGib77NbZOjVXa8nJidsnKjA66AfWQDUFAYUgV.jpg',
  'mushoku tensei jobless reincarnation|season 2 part 1':'https://contents.oricon.co.jp/upimg/news/2327000/2326717/20240512_220930_p_o_79991880.jpg',
  'mushoku tensei jobless reincarnation|season 2 part 2':'https://img1.daumcdn.net/thumb/R800x0/?fname=https%3A%2F%2Fblog.kakaocdn.net%2Fdna%2FMjfxr%2FbtsKFhKwW5F%2FAAAAAAAAAAAAAAAAAAAAALxSwGfjZ3EHfnhgz6lMLYtFuxb1LjAfazNY0TbXN5fS%2Fimg.webp',
  'mushoku tensei jobless reincarnation|season 3':'https://repotama.com/2023/07/177742/%E3%82%AD%E3%83%BC%E3%83%93%E3%82%B8%E3%83%A5%E3%82%A2%E3%83%ABs/',
  'that time i reincarnated as a slime|season 1':'https://images.plex.tv/photo?scale=1&size=large-1920&url=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Foriginal%2FbQlHgqXFpZ1xpiiBEzncSpXYIwF.jpg',
  'that time i reincarnated as a slime|season 2 part 1':'https://image.zeta-ai.io/plot-intro-image/51cdc7a8-32d3-4f66-b722-53c4a699ff46/65ffcb36-3d97-4fab-9e92-46ebd4c68328.png',
  'that time i reincarnated as a slime|season 2 part 2':'https://cdn.xlsbox.com/poster/small/1782735600/5232.jpg',
  'that time i reincarnated as a slime|season 3':'https://m.media-amazon.com/images/M/MV5BNWU3OTRlNWMtZGQyOC00YzJhLWIyNjctYmI2YzgyZTQ3ZDNmXkEyXkFqcGc%40._V1_.jpg',
  'konosuba god s blessing on this wonderful world|season 1':'https://image.tmdb.org/t/p/original/2bMFArvxTtgjN5CiNbnPG0rMmk5.jpg',
  'konosuba god s blessing on this wonderful world|season 2':'https://a.storyblok.com/f/178900/1500x2250/27783f4314/732987e919526f2d19cab429cec069fb1676298898_main.jpg/m/filters%3Aquality%2895%29format%28webp%29',
  'konosuba god s blessing on this wonderful world|season 3':'https://media.animationdigitalnetwork.com/images/show/0aefd89b-9fcd-4c17-9e9f-99ac01008734/portrait-with-logo',
  'overlord|season 1':'https://images.justwatch.com/poster/181525333/s718/season-1.jpg',
  'overlord|season 2':'https://otaku-ism.com/assets/entries/animation/overlord-season-2/cover-c5f0dd49b613452233d2af3ce4cfdf2b93ed6731a98f6b1ba4e5302fd1de44bb.jpg',
  'overlord|season 3':'https://images.plex.tv/photo?scale=1&size=large-1920&url=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Foriginal%2Fcvb5TA54NT6yL6eoS95zCB6lVcH.jpg',
  'overlord|season 4':'https://img1.ak.crunchyroll.com/i/spire4/1acc358362ffcf6a12023267c2eef75d1656870625_main.jpg'
};
const dedicatedHierarchyArtwork=(title:string)=>{
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
 const currentPoster=String(p.poster||'').trim();
 const replaceablePoster=!currentPoster
   || isPlaceholderArtwork(currentPoster)
   || /img\.anili\.st\/media\//i.test(currentPoster)
   || /s\d+\.anilist\.co\/file\/anilistcdn\/media\/anime\/cover\/large\//i.test(currentPoster)
   || /(?:not-available|not-supplied-by-source)/i.test(String(p.posterSource||''));
 const forcedRoot = p.medium==='anime' && !isHierarchyNode(p) && replaceablePoster
   ? FORCED_REPLACEMENT_ARTWORK[normal(p.title)]
   : undefined;
 const forcedHierarchy = isHierarchyNode(p) ? FORCED_HIERARCHY_ARTWORK[normal(p.parentTitle||'')+'|'+normal(p.title)] : undefined;
 // Curated artwork is already intentionally selected. Do not make rendering depend
 // on a fresh browser dimension/network probe on every reload; transient image-host
 // failures were turning good posters into blanks.
 if(forcedRoot) return forcedRoot;
 if(forcedHierarchy) return forcedHierarchy;
 const hasSavedPoster=Boolean(p.poster&&!isPlaceholderArtwork(p.poster)&&!/(?:not-available|not-supplied-by-source)/i.test(p.posterSource||'')&&!(p.poster===sharedOnePiecePoster&&!isOnePiece));
 const freshHierarchyPoster = isHierarchyNode(p) && p.medium==='anime' && p.anilistId
   ? `https://s4.anilist.co/file/anilistcdn/media/anime/cover/extraLarge/b${p.anilistId}.jpg`
   : '';
 const hasDistinctSavedPoster=hasSavedPoster&&(!p.parentPoster||p.poster!==p.parentPoster);
 // DATABASE ARTWORK IS AUTHORITATIVE.
 // Existing saved artwork always wins. AniList is only a source for rows that
 // do not already have a trusted poster, preventing future imports/syncs from
 // silently replacing established library artwork.
 if(freshHierarchyPoster)return freshHierarchyPoster;
 if(!forcedRoot && hasSavedPoster)return p.poster as string;
 if(p.anilistId&&p.medium==='anime'){
  const key='anilist-exact:'+p.anilistId;
  const existing=getArtworkCache(key);if(existing)return existing;
  const request=withArtworkLimit(async()=>{
   try{
    const response=await fetch(ANILIST_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:DETAIL_QUERY,variables:{id:p.anilistId}})});
    if(response.ok){
     const json=await response.json() as {data?:{Media?:AniListMedia}};
     const image=json.data?.Media?.coverImage?.extraLarge;
     if(image && await isPortraitSource(image))return image;
    }
   }catch{/* retain fallback artwork */}
   return '';
  });
  setArtworkCache(key,request);
  return request;
 }
 const isSeriesMedia=['anime','manga','manhwa','light-novel'].includes(p.medium);
 const isEpisode=/frame-(?:anime|naruto)-episode/i.test(p.sourceProvider||'')||/:episode:\\d+$/i.test(p.externalId||'')||/naruto-episode-/i.test(p.externalId||'');
 if(isEpisode)return hasSavedPoster && await isPortraitSource(p.poster)?p.poster as string:'';
 const dedicatedHierarchyPoster=dedicatedHierarchyArtwork(p.title);
 if(dedicatedHierarchyPoster)return dedicatedHierarchyPoster;
  if(isNarutoHierarchy(p)){
   if(hasSavedPoster)return p.poster!;
   // Arcs must use their own image; never reuse the parent anime poster.
   return '';
  }
 if(isHierarchyNode(p)){
  if(hasSavedPoster)return p.poster as string;
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
     if(image && await isPortraitSource(image))return image;
    }
   }catch{/* exact season/arc artwork can be unavailable */}
  }
  // A missing exact season/arc image is not permission to inherit the root poster.
  return '';
 }
 if(!isSeriesMedia){if(p.medium==='anime')return (p.poster && await isPortraitSource(p.poster))?p.poster:'';return p.poster||p.parentPoster||svgFallback(p.title,p.medium);}
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
  if(image&&media?.type===type&&titleMatches&&await isPortraitSource(image))return image;
  if(media&&!titleMatches)return hasSavedPoster&&p.poster&&await isPortraitSource(p.poster)?p.poster:'';
  }catch{/* external metadata can be unavailable */}
  if(isSeriesMedia){if(hasSavedPoster && p.poster && (!p.parentPoster || p.poster !== p.parentPoster) && await isPortraitSource(p.poster))return p.poster as string;return p.medium==='anime'?'':(p.parentPoster||'');}
  if(p.medium==='anime')return p.poster && await isPortraitSource(p.poster)?p.poster:'';
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
 const forcedRoot = p.medium==='anime' && !isHierarchyNode(p) ? FORCED_REPLACEMENT_ARTWORK[normal(p.title)] : undefined;
 const forcedHierarchy = isHierarchyNode(p) ? FORCED_HIERARCHY_ARTWORK[normal(p.parentTitle||'')+'|'+normal(p.title)] : undefined;
 if(forcedRoot)return forcedRoot;
 if(forcedHierarchy)return forcedHierarchy;
 if(p.medium==='anime')return dedicatedHierarchyArtwork(p.title)||'';
 if(isNarutoHierarchy(p)||isHierarchyNode(p))return dedicatedHierarchyArtwork(p.title)||p.parentPoster||'';
  if(['manga','manhwa','light-novel'].includes(p.medium))return p.parentPoster||(import.meta.env.BASE_URL+'frame-logo.svg');
 return p.parentPoster||(import.meta.env.BASE_URL+'frame-logo.svg');
}
export function FrameArtwork(p:Props){
 const identity=[p.title,p.medium,p.anilistId??'',p.sourceProvider??'',p.externalId??'',p.poster??'',p.posterSource??'',p.parentPoster??''].join('|');
 const fallback=safeInitialArtwork(p);
 const [resolved,setResolved]=useState<{identity:string;src:string}|null>(null);
 const [failedIdentity,setFailedIdentity]=useState('');
 useEffect(()=>{let active=true;setFailedIdentity('');void resolve(p).then(value=>{if(active)setResolved({identity,src:value})});return()=>{active=false}},[identity]);
 // Render a persisted/curated poster immediately. The previous anime-specific
 // empty initial state made every reload depend on an async AniList/network
 // lookup before a poster could appear.
 const base=resolved&&resolved.identity===identity?resolved.src:fallback;
 // If a remote image fails, keep a deterministic visual fallback instead of a
 // blank <img>. The next mount can still retry the saved URL.
 const src=failedIdentity===identity?svgFallback(p.title,p.medium):base;
 const displaySrc=src?posterImageSrc(src):undefined;
 return <img className={p.className} {...(displaySrc?{src:displaySrc}:{})} alt={displaySrc?(p.alt??p.title):''} loading={p.loading||'lazy'} onError={e=>{const img=e.currentTarget;const failedSrc=img.currentSrc||img.src;const rawSource=resolved&&resolved.identity===identity?resolved.src:'';if(p.medium==='anime'&&rawSource&&failedSrc.includes('/functions/v1/media-discovery?action=proxy-image')&&img.dataset.directRetryApplied!=='1'){img.dataset.directRetryApplied='1';img.src=rawSource;return}if(/^https?:\/\//i.test(failedSrc)&&!failedSrc.includes('/functions/v1/media-discovery?action=proxy-image')&&img.dataset.imageProxyApplied!=='1'){img.dataset.imageProxyApplied='1';img.src=proxyImageSrc(failedSrc);return}if(failedIdentity!==identity)setFailedIdentity(identity)}}/>;
}

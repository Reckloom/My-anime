export const ANILIST_URL = 'https://graphql.anilist.co';

export type AniListMedia = {
  id:number; type:'ANIME'|'MANGA'; format?:string|null;
  title:{romaji?:string|null;english?:string|null;native?:string|null;userPreferred?:string|null};
  synonyms?:string[]; description?:string|null; coverImage?:{extraLarge?:string|null}|null; bannerImage?:string|null;
  genres?:string[]; tags?:{name:string}[]; season?:string|null; seasonYear?:number|null; averageScore?:number|null;
  studios?:{nodes:{name:string}[]}; source?:string|null; episodes?:number|null; duration?:number|null;
  startDate?:{year?:number|null;month?:number|null;day?:number|null}|null;
  endDate?:{year?:number|null;month?:number|null;day?:number|null}|null;
};
export const SEARCH_QUERY=`query ($search:String,$page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){media(search:$search,sort:[SEARCH_MATCH]){id type format title{romaji english native userPreferred} coverImage{extraLarge} bannerImage genres season seasonYear averageScore}}}`;
export const DETAIL_QUERY=`query ($id:Int!){Media(id:$id){id type format title{romaji english native userPreferred} synonyms description coverImage{extraLarge} bannerImage genres tags{name} season seasonYear averageScore studios{nodes{name}} source episodes duration startDate{year month day} endDate{year month day}}}`;
export function titleOf(m:AniListMedia){return m.title.userPreferred||m.title.english||m.title.romaji||m.title.native||'Untitled'}
export function cleanDescription(v?:string|null){return(v||'').replace(/<br\\s*\\/?>(\\s*)/gi,' ').replace(/<[^>]+>/g,'').trim()}
export async function aniList<T>(query:string,variables:Record<string,unknown>):Promise<T>{const r=await fetch(ANILIST_URL,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query,variables})});const j=await r.json();if(!r.ok||j.errors?.length)throw new Error(j.errors?.[0]?.message||'AniList request failed.');return j.data as T}

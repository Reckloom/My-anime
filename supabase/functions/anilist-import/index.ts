import { withSupabase } from 'npm:@supabase/server@^1';
import { createClient } from 'npm:@supabase/supabase-js@^2';

const ANILIST_URL = 'https://graphql.anilist.co';
const DETAIL_QUERY = `query ($id:Int!){
  Media(id:$id){
    id type format title{romaji english native userPreferred} synonyms description
    coverImage{extraLarge} bannerImage genres tags{name} season seasonYear averageScore
    studios{nodes{name}} source episodes duration startDate{year month day} endDate{year month day}
  }
}`;

type AniMedia = {
  id:number; type:'ANIME'|'MANGA'; format?:string|null;
  title:{romaji?:string|null;english?:string|null;native?:string|null;userPreferred?:string|null};
  synonyms?:string[]; description?:string|null; coverImage?:{extraLarge?:string|null}|null; bannerImage?:string|null;
  genres?:string[]; tags?:{name:string}[]; season?:string|null; seasonYear?:number|null; averageScore?:number|null;
  studios?:{nodes:{name:string}[]}; source?:string|null; episodes?:number|null; duration?:number|null;
  startDate?:{year?:number|null;month?:number|null;day?:number|null}|null;
  endDate?:{year?:number|null;month?:number|null;day?:number|null}|null;
};

function clean(value?:string|null){return(value||'').replace(/<br\s*\/?>(\s*)/gi,' ').replace(/<[^>]+>/g,'').trim()}
function date(value:AniMedia['startDate']){if(!value?.year)return null;return [value.year,value.month,value.day].filter(Boolean).join('-')}
function titleOf(m:AniMedia){return m.title.userPreferred||m.title.english||m.title.romaji||m.title.native||'Untitled'}
function mediumOf(m:AniMedia){
  if(m.type==='MANGA') return m.format==='NOVEL' ? 'light-novel' : 'manga';
  return m.format==='MOVIE' ? 'movie' : 'anime';
}
async function fetchAniList(id:number){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(ANILIST_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:DETAIL_QUERY,variables:{id}}),signal:controller.signal});
    let json:any;
    try{json=await response.json()}catch{throw new Error('AniList returned an invalid response.')}
    if(!response.ok||json.errors?.length) throw new Error(json.errors?.[0]?.message||'AniList request failed.');
    if(!json.data?.Media) throw new Error('AniList returned no media data.');
    return json.data.Media as AniMedia;
  }catch(e){
    if(e instanceof DOMException&&e.name==='AbortError') throw new Error('AniList request timed out.');
    throw e;
  }finally{clearTimeout(timer)}
}
function metadataRow(m:AniMedia){
  const title=titleOf(m);
  const alternatives=[m.title.english,m.title.romaji,m.title.native,...(m.synonyms||[])].filter((x):x is string=>Boolean(x&&x!==title));
  return {
    anilist_id:m.id,title,alternative_titles:[...new Set(alternatives)],description:clean(m.description),
    poster:m.coverImage?.extraLarge||'',backdrop:m.bannerImage||'',genres:m.genres||[],
    themes:(m.tags||[]).map(x=>x.name),year:m.seasonYear??null,season:m.season??null,
    score:m.averageScore==null?null:m.averageScore/10,studio:m.studios?.nodes?.map(x=>x.name).join(', ')||null,
    source:m.source||null,episodes:m.episodes??null,duration:m.duration??null,air_start:date(m.startDate),air_end:date(m.endDate),
    updated_at:new Date().toISOString()
  };
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if(req.method!=='POST') return Response.json({error:'POST required'},{status:405});
    const body=await req.json();
    const action=body?.action==='refresh'?'refresh':'import';
    const anilistId=Number(body?.anilistId);
    if(!Number.isInteger(anilistId)||anilistId<=0) return Response.json({error:'A valid AniList ID is required.'},{status:400});
    const userId=ctx.userClaims?.sub;
    if(!userId) return Response.json({error:'Authenticated user required.'},{status:401});

    const scoped=ctx.supabase;
    const admin=ctx.supabaseAdmin;
    const {data:existing,error:existingError}=await scoped.from('media_items').select('*,media_metadata(*)').eq('user_id',userId).eq('anilist_id',anilistId).maybeSingle();
    if(existingError) return Response.json({error:existingError.message},{status:400});
    if(action==='import'&&existing) return Response.json({existing:true,media:existing});

    try{
      const media=await fetchAniList(anilistId);
      const meta=metadataRow(media);
      const {data:metadata,error:metaError}=await admin.from('media_metadata').upsert(meta,{onConflict:'anilist_id'}).select().single();
      if(metaError) throw metaError;

      if(action==='refresh'){
        if(!existing) return Response.json({error:'That title is not in your library.'},{status:404});
        const {data:updated,error:updateError}=await scoped.from('media_items').update({metadata_id:metadata.id,anilist_id:anilistId}).eq('id',existing.id).select('*,media_metadata(*)').single();
        if(updateError) throw updateError;
        return Response.json({media:updated,refreshed:true});
      }

      const {data:created,error:createError}=await scoped.from('media_items').insert({
        user_id:userId,metadata_id:metadata.id,anilist_id:anilistId,title:meta.title,description:'',poster:'',backdrop:'',
        medium:mediumOf(media),status:'planned',progress:0,total:null,year:null,score:null,genres:[],themes:[],
        favorite:false
      }).select('*,media_metadata(*)').single();
      if(createError) throw createError;
      return Response.json({media:created,imported:true});
    }catch(error){
      return Response.json({error:error instanceof Error?error.message:String(error)},{status:400});
    }
  })
};

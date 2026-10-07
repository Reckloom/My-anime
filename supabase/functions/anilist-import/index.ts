import { withSupabase } from 'npm:@supabase/server@^1';

const ANILIST_URL = 'https://graphql.anilist.co';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SEARCH_QUERY = `query ($search:String!,$page:Int!,$perPage:Int!,$type:MediaType!){
  Page(page:$page,perPage:$perPage){
    media(search:$search,type:$type){
      id
      type
      format
      title{romaji english native userPreferred}
      coverImage{extraLarge}
      bannerImage
      genres
      season
      seasonYear
      averageScore
    }
  }
}`;

const DETAIL_QUERY = `query ($id:Int!){
  Media(id:$id){
    id
    type
    format
    title{romaji english native userPreferred}
    synonyms
    description
    coverImage{extraLarge}
    bannerImage
    genres
    tags{name}
    season
    seasonYear
    averageScore
    studios{nodes{name}}
    source
    episodes
    duration
    startDate{year month day}
    endDate{year month day}
  }
}`;

type AniMedia = {
  id:number;
  type:'ANIME'|'MANGA';
  format?:string|null;
  title:{romaji?:string|null;english?:string|null;native?:string|null;userPreferred?:string|null};
  synonyms?:string[];
  description?:string|null;
  coverImage?:{extraLarge?:string|null}|null;
  bannerImage?:string|null;
  genres?:string[];
  tags?:{name:string}[];
  season?:string|null;
  seasonYear?:number|null;
  averageScore?:number|null;
  studios?:{nodes:{name:string}[]};
  source?:string|null;
  episodes?:number|null;
  duration?:number|null;
  startDate?:{year?:number|null;month?:number|null;day?:number|null}|null;
  endDate?:{year?:number|null;month?:number|null;day?:number|null}|null;
};

function clean(value?:string|null){
  return (value||'').replace(/<br\s*\/?>(\s*)/gi,' ').replace(/<[^>]+>/g,'').trim();
}

function date(value:AniMedia['startDate']){
  if(!value?.year) return null;
  return [value.year,value.month,value.day].filter(Boolean).join('-');
}

function titleOf(m:AniMedia){
  return m.title.userPreferred||m.title.english||m.title.romaji||m.title.native||'Untitled';
}

function mediumOf(m:AniMedia){
  if(m.type==='MANGA') return m.format==='NOVEL' ? 'light-novel' : 'manga';
  return m.format==='MOVIE' ? 'movie' : 'anime';
}

async function postAniList(query:string,variables:Record<string,unknown>){
  let lastError='AniList request failed.';
  for(let attempt=0;attempt<3;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(ANILIST_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json','User-Agent':'FRAME/1.0'},
        body:JSON.stringify({query,variables}),
        signal:controller.signal
      });
      const text=await response.text();
      let json:any;
      try{json=JSON.parse(text)}catch{json=null}
      if(response.status===429){
        lastError='AniList is temporarily rate-limiting requests. Please wait a moment and try again.';
        if(attempt<2){ await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1))); continue; }
        throw new Error(lastError);
      }
      if(!response.ok||json?.errors?.length){
        lastError=json?.errors?.[0]?.message||`AniList request failed (HTTP ${response.status}).`;
        throw new Error(lastError);
      }
      if(!json?.data) throw new Error('AniList returned no data.');
      return json.data;
    }catch(e){
      if(e instanceof DOMException&&e.name==='AbortError') lastError='AniList request timed out.';
      else if(e instanceof Error) lastError=e.message;
      if(attempt===2) throw new Error(lastError);
    }finally{
      clearTimeout(timer);
    }
  }
  throw new Error(lastError);
}

function metadataRow(m:AniMedia){
  const title=titleOf(m);
  const alternatives=[
    m.title.english,
    m.title.romaji,
    m.title.native,
    ...(m.synonyms||[])
  ].filter((x):x is string=>Boolean(x&&x!==title));

  return {
    anilist_id:m.id,
    title,
    alternative_titles:[...new Set(alternatives)],
    description:clean(m.description),
    poster:m.coverImage?.extraLarge||'',
    backdrop:m.bannerImage||'',
    genres:m.genres||[],
    themes:(m.tags||[]).map(x=>x.name),
    year:m.seasonYear??null,
    season:m.season??null,
    score:m.averageScore==null?null:m.averageScore/10,
    studio:m.studios?.nodes?.map(x=>x.name).join(', ')||null,
    source:m.source||null,
    episodes:m.episodes??null,
    duration:m.duration??null,
    air_start:date(m.startDate),
    air_end:date(m.endDate),
    updated_at:new Date().toISOString()
  };
}

function searchRow(m:AniMedia){
  return {
    id:m.id,
    type:m.type,
    format:m.format??null,
    title:m.title,
    coverImage:m.coverImage??null,
    bannerImage:m.bannerImage??null,
    genres:m.genres??[],
    season:m.season??null,
    seasonYear:m.seasonYear??null,
    averageScore:m.averageScore??null
  };
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if(req.method==='OPTIONS') return new Response('ok',{headers:CORS_HEADERS});
    const json=(body:Record<string,unknown>,status=200)=>Response.json(body,{status,headers:CORS_HEADERS});
    if(req.method!=='POST') return json({error:'POST required'},405);

    let body:any;
    try{
      body=await req.json();
    }catch{
      return json({error:'Invalid JSON request.'},400);
    }

    const userId=ctx.userClaims?.id;
    if(!userId) return json({error:'Authenticated user required.'},401);

    const action=String(body?.action||'import');

    try{
      if(action==='search'){
        const search=String(body?.query||'').trim();
        if(search.length<2) return json({results:[]});

        const requestedType=String(body?.mediaType||'ANIME').toUpperCase();
        const type=requestedType==='MANGA'?'MANGA':'ANIME';
        const data=await postAniList(SEARCH_QUERY,{
          search,
          page:1,
          perPage:12,
          type
        });
        const results=Array.isArray(data?.Page?.media)
          ? data.Page.media.map((x:AniMedia)=>searchRow(x))
          : [];
        return json({results});
      }

      const anilistId=Number(body?.anilistId);
      if(!Number.isInteger(anilistId)||anilistId<=0){
        return json({error:'A valid AniList ID is required.'},400);
      }

      const scoped=ctx.supabase;
      const admin=ctx.supabaseAdmin;
      const {data:existing,error:existingError}=await scoped
        .from('media_items')
        .select('*,media_metadata(*)')
        .eq('user_id',userId)
        .eq('anilist_id',anilistId)
        .maybeSingle();

      if(existingError) return json({error:existingError.message},400);

      if(action==='import'&&existing){
        return json({existing:true,media:existing});
      }

      const data=await postAniList(DETAIL_QUERY,{id:anilistId});
      const media=data?.Media as AniMedia|undefined;
      if(!media) return json({error:'AniList returned no media data.'},404);

      const meta=metadataRow(media);

      const {data:metadata,error:metaError}=await admin
        .from('media_metadata')
        .upsert(meta,{onConflict:'anilist_id'})
        .select()
        .single();

      if(metaError) throw metaError;

      if(action==='refresh'){
        if(!existing) return json({error:'That title is not in your library.'},404);

        const {data:updated,error:updateError}=await scoped
          .from('media_items')
          .update({metadata_id:metadata.id,anilist_id:anilistId})
          .eq('id',existing.id)
          .select('*,media_metadata(*)')
          .single();

        if(updateError) throw updateError;
        return json({media:updated,refreshed:true});
      }

      const {data:created,error:createError}=await scoped
        .from('media_items')
        .insert({
          user_id:userId,
          metadata_id:metadata.id,
          anilist_id:anilistId,
          title:meta.title,
          description:meta.description,
          poster:meta.poster,
          backdrop:meta.backdrop,
          medium:mediumOf(media),
          status:'planned',
          progress:0,
          total:meta.episodes,
          year:meta.year,
          score:meta.score,
          genres:meta.genres,
          themes:meta.themes,
          studio:meta.studio,
          source:meta.source,
          favorite:false,
          data:{
            source:'anilist',
            anilistId,
            importedAt:new Date().toISOString()
          }
        })
        .select('*,media_metadata(*)')
        .single();

      if(createError) throw createError;
      return json({media:created,imported:true});
    }catch(error){
      return json({
        error:error instanceof Error?error.message:String(error)
      },400);
    }
  })
};

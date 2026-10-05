import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@^2';

const ANILIST_URL = 'https://graphql.anilist.co';
const WINDOW_DAYS = 45;
const QUERY = `query ($ids:[Int!]!, $from:Int!, $to:Int!) {
  Page(page:1, perPage:50) {
    airingSchedules(mediaId_in:$ids, airingAt_greater:$from, airingAt_lesser:$to, sort:TIME) {
      id airingAt episode timeUntilAiring mediaId
      media { id title { userPreferred english romaji native } format type status }
    }
  }
}`;

type Schedule = { id:number; airingAt:number; episode:number; timeUntilAiring:number; mediaId:number; media?:{id:number; title:{userPreferred?:string|null;english?:string|null;romaji?:string|null;native?:string|null};format?:string|null;type?:string|null;status?:string|null} };
function titleOf(m:NonNullable<Schedule['media']>){return m.title.userPreferred||m.title.english||m.title.romaji||m.title.native||'Untitled'}

async function aniList(ids:number[],from:number,to:number){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const r=await fetch(ANILIST_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:QUERY,variables:{ids,from,to}}),signal:controller.signal});
    let j:any;
    try{j=await r.json()}catch{throw new Error('AniList returned an invalid response.')}
    if(!r.ok||j.errors?.length) throw new Error(j.errors?.[0]?.message||'AniList release lookup failed.');
    return (j.data?.Page?.airingSchedules||[]) as Schedule[];
  }catch(e){
    if(e instanceof DOMException&&e.name==='AbortError') throw new Error('AniList release lookup timed out.');
    throw e;
  }finally{clearTimeout(timer)}
}

Deno.serve(async (req)=>{
  if(req.method!=='POST') return Response.json({error:'POST required'},{status:405});
  const cronSecret=Deno.env.get('RELEASE_TRACKER_CRON_SECRET');
  const supplied=req.headers.get('x-release-tracker-secret');
  if(!cronSecret || supplied!==cronSecret) return Response.json({error:'Unauthorized'},{status:401});

  const url=Deno.env.get('SUPABASE_URL');
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!serviceKey) return Response.json({error:'Server configuration incomplete'},{status:500});

  const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:tracked,error:trackedError}=await admin.from('media_metadata').select('id,anilist_id').not('anilist_id','is',null);
  if(trackedError) return Response.json({error:trackedError.message},{status:500});
  const ids=(tracked||[]).map(x=>Number(x.anilist_id)).filter(Number.isInteger);
  if(!ids.length) return Response.json({ok:true,checked:0,upserted:0});

  const now=Math.floor(Date.now()/1000);
  const to=now+WINDOW_DAYS*86400;
  let schedules:Schedule[]=[];
  try{
    for(let i=0;i<ids.length;i+=50){
      schedules.push(...await aniList(ids.slice(i,i+50),now-7*86400,to));
    }
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:'Release lookup failed.'},{status:502});
  }

  const metadataByAni=new Map((tracked||[]).map(x=>[Number(x.anilist_id),x.id]));
  const rows=schedules.map(s=>({
    media_metadata_id:metadataByAni.get(s.mediaId),
    anilist_id:s.mediaId,
    release_type:'episode',
    release_number:s.episode,
    title:s.media?.title ? titleOf(s.media) : null,
    scheduled_at:new Date(s.airingAt*1000).toISOString(),
    date_precision:'exact',
    status:s.airingAt<=now?'released':'scheduled',
    source:'anilist',
    source_key:'airing:'+s.id,
    raw:s,
    last_seen_at:new Date().toISOString()
  })).filter(x=>x.media_metadata_id);

  let upserted=0;
  let notifications=0;
  if(rows.length){
    const {error:e}=await admin.from('media_releases').upsert(rows,{onConflict:'source,source_key',ignoreDuplicates:false});
    if(e) return Response.json({error:e.message},{status:500});
    upserted=rows.length;
  }

  // Reconcile scheduled rows before creating notifications so scheduled -> released
  // transitions are eligible in the same tracker run.
  await admin.from('media_releases').update({status:'released',last_seen_at:new Date().toISOString()}).eq('status','scheduled').lt('scheduled_at',new Date().toISOString());

  // Notification creation is idempotent and therefore safe to replay.
  if(rows.length){
    for (const row of rows) {
      const { data: release } = await admin.from('media_releases').select('id').eq('source', row.source).eq('source_key', row.source_key).single();
      if (release) {
        const { data: created } = await admin.rpc('create_release_notifications', { p_release_id: release.id });
        notifications += Number(created || 0);
      }
    }
  }

  return Response.json({ok:true,checked:ids.length,upserted,notifications});
});

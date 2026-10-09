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

type Schedule = {
  id:number;
  airingAt:number;
  episode:number;
  timeUntilAiring:number;
  mediaId:number;
  media?:{id:number;title:{userPreferred?:string|null;english?:string|null;romaji?:string|null;native?:string|null};format?:string|null;type?:string|null;status?:string|null}
};

const json=(body:unknown,status=200)=>Response.json(body,{headers:{'Content-Type':'application/json'},status});

function titleOf(m:NonNullable<Schedule['media']>){
  return m.title.userPreferred||m.title.english||m.title.romaji||m.title.native||'Untitled';
}

async function aniList(ids:number[],from:number,to:number){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const r=await fetch(ANILIST_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json','User-Agent':'FRAME/1.0'},
      body:JSON.stringify({query:QUERY,variables:{ids,from,to}}),
      signal:controller.signal
    });
    let j:any;
    try{j=await r.json()}catch{throw new Error('AniList returned an invalid response.')}
    if(!r.ok||j.errors?.length) throw new Error(j.errors?.[0]?.message||'AniList release lookup failed.');
    return (j.data?.Page?.airingSchedules||[]) as Schedule[];
  }catch(e){
    if(e instanceof DOMException&&e.name==='AbortError') throw new Error('AniList release lookup timed out.');
    throw e;
  }finally{clearTimeout(timer)}
}

function secretKeyFromEnv(){
  const legacy=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(legacy)return legacy;
  const raw=Deno.env.get('SUPABASE_SECRET_KEYS');
  if(raw){
    try{
      const parsed=JSON.parse(raw);
      if(typeof parsed?.default==='string'&&parsed.default)return parsed.default;
    }catch{}
  }
  return '';
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok');
  if(req.method!=='POST')return json({error:'POST required'},405);

  const supplied=req.headers.get('x-frame-cron-key')||req.headers.get('x-release-tracker-secret')||'';
  const url=Deno.env.get('SUPABASE_URL');
  const serviceKey=secretKeyFromEnv();
  if(!url||!serviceKey)return json({error:'Server configuration incomplete.'},500);

  const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:valid,error:validationError}=await admin.rpc('validate_frame_release_tracker_key',{p_key:supplied});
  if(validationError||valid!==true)return json({error:'Unauthorized'},401);

  const {data:tracked,error:trackedError}=await admin
    .from('media_items')
    .select('id,user_id,metadata_id,anilist_id,title,progress,total,data')
    .not('anilist_id','is',null);
  if(trackedError)return json({error:trackedError.message},500);

  const items=(tracked||[]) as Array<{id:string;user_id:string;metadata_id:string|null;anilist_id:number;title:string;progress:number;total:number|null;data?:{frameReleaseRadar?:{enabled?:boolean}}|null}>;
  const ids=[...new Set(items.map(x=>Number(x.anilist_id)).filter(x=>Number.isInteger(x)&&x>0))];
  if(!ids.length)return json({ok:true,checked:0,upserted:0,notifications:0,reminders:0});

  const now=Math.floor(Date.now()/1000);
  const to=now+WINDOW_DAYS*86400;
  let schedules:Schedule[]=[];
  try{
    for(let i=0;i<ids.length;i+=50)schedules.push(...await aniList(ids.slice(i,i+50),now-7*86400,to));
  }catch(error){
    return json({error:error instanceof Error?error.message:'Release lookup failed.'},502);
  }

  const metadataByAni=new Map<number,string>();
  for(const item of items)if(item.metadata_id&&!metadataByAni.has(Number(item.anilist_id)))metadataByAni.set(Number(item.anilist_id),item.metadata_id);

  const nowIso=new Date().toISOString();
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
    last_seen_at:nowIso
  }));

  let upserted=0;
  if(rows.length){
    const {error}=await admin.from('media_releases').upsert(rows,{onConflict:'source,source_key',ignoreDuplicates:false});
    if(error)return json({error:error.message},500);
    upserted=rows.length;
  }

  // Reconcile any scheduled row that has now passed.
  await admin.from('media_releases')
    .update({status:'released',last_seen_at:nowIso})
    .eq('status','scheduled')
    .lt('scheduled_at',nowIso);

  // Keep each user's "next release" fields current.
  for(const item of items){
    const matching=schedules.filter(s=>s.mediaId===Number(item.anilist_id));
    const next=matching.filter(s=>s.airingAt>now).sort((a,b)=>a.airingAt-b.airingAt)[0];
    const latestReleased=matching.filter(s=>s.airingAt<=now).reduce((max,s)=>Math.max(max,Number(s.episode||0)),0);
    const update:{next_release:string|null;next_release_number:number|null;updated_at:string;total?:number}={
      next_release:next?new Date(next.airingAt*1000).toISOString():null,
      next_release_number:next?Number(next.episode):null,
      updated_at:nowIso
    };
    // Keep the episode total in sync when a newly aired episode is detected.
    if(latestReleased>Number(item.total||0))update.total=latestReleased;
    await admin.from('media_items')
      .update(update)
      .eq('id',item.id)
      .eq('user_id',item.user_id);
    if(latestReleased>Number(item.total||0)){
      // Mirror the refreshed episode count into episode subparts beneath the main entry.
      await admin.from('media_items')
        .update({total:latestReleased,updated_at:nowIso})
        .eq('parent_id',item.id)
        .eq('user_id',item.user_id);
      // Make meaningful catalogue changes visible in FRAME's Updates tab.
      if(item.data?.frameReleaseRadar?.enabled!==false){
        await admin.from('frame_notifications').insert({
          user_id:item.user_id,
          type:'update',
          title:item.title+' · Episode total updated',
          body:'AniList now lists '+latestReleased+' aired episodes. FRAME updated this title and its episode sub-entry automatically.',
          href:'media:'+item.id,
          dedupe_key:'catalogue-total:'+item.anilist_id+':'+latestReleased
        },{onConflict:'user_id,dedupe_key',ignoreDuplicates:true});
      }
    }
  }

  let notifications=0;
  let reminders=0;
  const byAni=new Map<number,Array<typeof items[number]>>();
  for(const item of items){
    const list=byAni.get(Number(item.anilist_id))||[];
    list.push(item);
    byAni.set(Number(item.anilist_id),list);
  }

  for(const schedule of schedules){
    const users=byAni.get(Number(schedule.mediaId))||[];
    if(!users.length)continue;
    const releaseTitle=schedule.media?.title?titleOf(schedule.media):users[0].title;
        for(const item of users){
      if(item.data?.frameReleaseRadar?.enabled===false)continue;
      const episode=Number(schedule.episode||0);
      if(schedule.airingAt<=now && episode>Number(item.progress||0)){
        const {error}=await admin.from('frame_notifications').insert({
          user_id:item.user_id,
          type:'release',
          title:releaseTitle+' · Episode '+episode,
          body:'A new tracked episode is available now.',
          href:'media:'+item.id,
          dedupe_key:'release:'+schedule.mediaId+':'+episode
        },{onConflict:'user_id,dedupe_key',ignoreDuplicates:true});
        if(!error)notifications++;
      }else{
        const secondsUntil=schedule.airingAt-now;
        if(secondsUntil>0&&secondsUntil<=24*3600){
          const {error}=await admin.from('frame_notifications').insert({
            user_id:item.user_id,
            type:'release',
            title:releaseTitle+' · Episode '+episode+' tomorrow',
            body:'Tracked episode scheduled for '+new Date(schedule.airingAt*1000).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}),
            href:'media:'+item.id,
            dedupe_key:'upcoming:'+schedule.mediaId+':'+episode+':24h'
          },{onConflict:'user_id,dedupe_key',ignoreDuplicates:true});
          if(!error)reminders++;
        }
      }
    }
  }

  return json({ok:true,checked:ids.length,upserted,notifications,reminders});
});

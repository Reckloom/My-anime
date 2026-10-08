import { withSupabase } from 'npm:@supabase/server@1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ANILIST_URL='https://graphql.anilist.co';
const HEADERS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-frame-cron',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};

const MEDIA_QUERY='query ($ids:[Int!]!) { Page(page:1, perPage:50) { media(id_in:$ids) { id type format status chapters episodes updatedAt title { userPreferred english romaji native } coverImage { extraLarge } siteUrl startDate { year month day } endDate { year month day } relations { edges { relationType node { id type format status chapters episodes title { userPreferred english romaji native } coverImage { extraLarge } siteUrl startDate { year month day } endDate { year month day } } } } } } }';
const SCHEDULE_QUERY='query ($ids:[Int!]!, $from:Int!, $to:Int!) { Page(page:1, perPage:50) { airingSchedules(mediaId_in:$ids, airingAt_greater:$from, airingAt_lesser:$to, sort:TIME) { id airingAt episode mediaId media { id title { userPreferred english romaji native } } } } }';

function json(body:Record<string,unknown>,status=200){ return Response.json(body,{status,headers:HEADERS}); }
function titleOf(m:any){ return m?.title?.userPreferred||m?.title?.english||m?.title?.romaji||m?.title?.native||'Untitled'; }
function fuzzyDate(d:any){
  if(!d?.year)return null;
  const ts=Date.UTC(Number(d.year),Math.max(0,Number(d.month||1)-1),Number(d.day||1));
  return new Date(ts).toISOString();
}
async function graph(query:string,variables:Record<string,unknown>){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const r=await fetch(ANILIST_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query,variables}),signal:controller.signal});
    const raw=await r.text();
    let j:any;
    try{j=JSON.parse(raw)}catch{throw new Error('AniList returned an invalid response.')}
    if(!r.ok||j?.errors?.length)throw new Error(j?.errors?.[0]?.message||'AniList request failed.');
    return j?.data||{};
  }catch(e){
    if(e instanceof DOMException&&e.name==='AbortError')throw new Error('AniList request timed out.');
    throw e;
  }finally{clearTimeout(timer)}
}
async function fetchMedia(ids:number[]){
  const media:any[]=[];
  for(let i=0;i<ids.length;i+=50){
    const data=await graph(MEDIA_QUERY,{ids:ids.slice(i,i+50)});
    const rows=Array.isArray(data?.Page?.media)?data.Page.media:[];
    media.push(...rows);
  }
  return media;
}
async function fetchSchedules(ids:number[],from:number,to:number){
  const schedules:any[]=[];
  for(let i=0;i<ids.length;i+=50){
    const data=await graph(SCHEDULE_QUERY,{ids:ids.slice(i,i+50),from,to});
    const rows=Array.isArray(data?.Page?.airingSchedules)?data.Page.airingSchedules:[];
    schedules.push(...rows);
  }
  return schedules;
}
function secretKey(){
  const raw=Deno.env.get('SUPABASE_SECRET_KEYS')||'{}';
  try{const keys=JSON.parse(raw);return String(keys.default||Object.values(keys)[0]||'')}catch{return ''}
}
async function adminClient(){
  const url=Deno.env.get('SUPABASE_URL')||'';
  const key=secretKey();
  if(!url||!key)throw new Error('Supabase secret key is unavailable.');
  return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
}
async function verifyCron(req:Request,admin:any){
  const supplied=req.headers.get('x-frame-cron')||'';
  if(!supplied)return false;
  const {data,error}=await admin.rpc('frame_get_release_radar_cron_secret');
  return !error&&typeof data==='string'&&data.length>0&&supplied===data;
}
async function runRadar(admin:any){
  const {data:rows,error}=await admin.from('media_items')
    .select('id,user_id,title,medium,status,progress,total,anilist_id,next_release,next_release_number,data,poster')
    .not('anilist_id','is',null);
  if(error)throw error;

  const tracked=(rows||[])
    .map((r:any)=>({...r,id:String(r.id),user_id:String(r.user_id),title:String(r.title||''),medium:String(r.medium),status:String(r.status),progress:Number(r.progress||0),total:r.total==null?null:Number(r.total),anilist_id:Number(r.anilist_id),data:r.data&&typeof r.data==='object'?r.data:{}}))
    .filter((r:any)=>Number.isInteger(r.anilist_id));
  if(!tracked.length)return {users:0,checked:0,notifications:0,animeReleases:0,related:0,chapters:0};

  const uniqueIds=[...new Set(tracked.map((r:any)=>r.anilist_id))];
  const now=Math.floor(Date.now()/1000);
  const from=now-48*3600;
  const to=now+45*86400;
  const [media,schedules]=await Promise.all([fetchMedia(uniqueIds),fetchSchedules(uniqueIds,from,to)]);
  const mediaById=new Map<number,any>(media.map((m:any)=>[Number(m.id),m]));
  const schedulesById=new Map<number,any[]>();
  for(const s of schedules){
    const id=Number(s.mediaId);
    const list=schedulesById.get(id)||[];
    list.push(s);
    schedulesById.set(id,list);
  }
  const rowsByUser=new Map<string,any[]>();
  for(const r of tracked){
    const list=rowsByUser.get(r.user_id)||[];
    list.push(r);
    rowsByUser.set(r.user_id,list);
  }

  const allNotices:any[]=[];
  let animeReleases=0,related=0,chapters=0;

  for(const [userId,userRows] of rowsByUser){
    const ownedIds=new Set(userRows.map((r:any)=>r.anilist_id));
    for(const row of userRows){
      const m=mediaById.get(row.anilist_id);
      const rowSchedules=(schedulesById.get(row.anilist_id)||[])
        .filter((s:any)=>Number.isFinite(Number(s.airingAt))&&Number.isFinite(Number(s.episode)))
        .sort((a:any,b:any)=>Number(a.airingAt)-Number(b.airingAt));

      const future=rowSchedules.find((s:any)=>Number(s.airingAt)>now);
      const update:any={
        next_release:future?new Date(Number(future.airingAt)*1000).toISOString():null,
        next_release_number:future?Number(future.episode):null,
        updated_at:new Date().toISOString()
      };

      const radarState={...(row.data?.frameReleaseRadar&&typeof row.data.frameReleaseRadar==='object'?row.data.frameReleaseRadar:{})};

      if((row.medium==='manga'||row.medium==='manhwa')&&m?.chapters!=null){
        const currentChapters=Number(m.chapters);
        const lastSeen=radarState.lastChapterCount==null?null:Number(radarState.lastChapterCount);
        if(lastSeen!=null&&currentChapters>lastSeen){
          allNotices.push({
            user_id:userId,type:'release',
            title:row.title+' · New chapters',
            body:'AniList now lists chapters through '+currentChapters+'; your progress is '+row.progress+'.',
            href:'radar',
            dedupe_key:'release:chapter:'+row.anilist_id+':'+currentChapters
          });
          chapters++;
        }
        radarState.lastChapterCount=currentChapters;
        radarState.lastCheckedAt=new Date().toISOString();
      }

      if(row.medium==='anime'){
        for(const s of rowSchedules){
          const airing=Number(s.airingAt);
          const episode=Number(s.episode);
          if(airing<=now&&airing>=from&&episode>row.progress){
            allNotices.push({
              user_id:userId,type:'release',
              title:titleOf(s.media||m)+' · Episode '+episode,
              body:'A tracked episode is available now.',
              href:'radar',
              dedupe_key:'release:available:'+row.anilist_id+':'+episode
            });
            animeReleases++;
          }else if(airing>now&&airing<=now+24*3600&&episode>row.progress){
            allNotices.push({
              user_id:userId,type:'release',
              title:titleOf(s.media||m)+' · Episode '+episode,
              body:'A tracked episode is scheduled within 24 hours.',
              href:'radar',
              dedupe_key:'release:upcoming:'+row.anilist_id+':'+episode
            });
            animeReleases++;
          }
        }
      }

      if(m?.relations?.edges){
        for(const edge of m.relations.edges){
          const n=edge?.node;
          if(!n||!Number.isInteger(Number(n.id))||ownedIds.has(Number(n.id)))continue;
          const format=String(n.format||'');
          const type=String(n.type||'');
          const status=String(n.status||'');
          const relevant=type==='ANIME'&&['TV','TV_SHORT','MOVIE','OVA','ONA','SPECIAL'].includes(format);
          if(!relevant)continue;
          const start=fuzzyDate(n.startDate);
          const startTs=start?new Date(start).getTime():null;
          const within=startTs!=null&&startTs>=Date.now()-24*3600*1000&&startTs<=Date.now()+365*86400*1000;
          const undated=status==='NOT_YET_RELEASED';
          if(!within&&!undated)continue;
          if(within){
            const label=format==='MOVIE'?'movie':format==='OVA'?'OVA':format==='ONA'?'ONA':format==='SPECIAL'?'special':'new anime release';
            allNotices.push({
              user_id:userId,type:'release',
              title:titleOf(n)+' · '+label,
              body:'A related release is scheduled for '+new Date(start!).toLocaleDateString('en-IN',{year:'numeric',month:'short',day:'numeric'})+'.',
              href:'radar',
              dedupe_key:'release:related:'+row.anilist_id+':'+Number(n.id)+':scheduled:'+start
            });
            related++;
          }else{
            allNotices.push({
              user_id:userId,type:'release',
              title:titleOf(n)+' · New related release',
              body:'A related anime release has been announced; the release date is not known yet.',
              href:'radar',
              dedupe_key:'release:related:'+row.anilist_id+':'+Number(n.id)+':announced'
            });
            related++;
          }
        }
      }

      update.data={...row.data,frameReleaseRadar:radarState};
      const {error:updateError}=await admin.from('media_items').update(update).eq('id',row.id).eq('user_id',userId);
      if(updateError)throw updateError;
    }
  }

  let inserted=0;
  if(allNotices.length){
    for(let i=0;i<allNotices.length;i+=200){
      const chunk=allNotices.slice(i,i+200);
      const {data,error}=await admin.from('frame_notifications')
        .upsert(chunk,{onConflict:'user_id,dedupe_key',ignoreDuplicates:true})
        .select('id');
      if(error)throw error;
      inserted+=(data||[]).length;
    }
  }
  return {users:rowsByUser.size,checked:tracked.length,notifications:inserted,animeReleases,related,chapters};
}

export default {
  fetch: withSupabase({auth:'publishable'},async(req)=>{
    if(req.method==='OPTIONS')return new Response('ok',{headers:HEADERS});
    if(req.method!=='POST')return json({error:'POST required'},405);
    try{
      const admin=await adminClient();
      if(!await verifyCron(req,admin))return json({error:'Unauthorized'},401);
      return json({ok:true,...await runRadar(admin)});
    }catch(error){
      return json({error:error instanceof Error?error.message:String(error)},400);
    }
  })
};

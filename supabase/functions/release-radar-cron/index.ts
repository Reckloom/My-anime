import { withSupabase } from 'npm:@supabase/server@1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ANILIST_URL='https://graphql.anilist.co';
const HEADERS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-frame-cron',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};

const MEDIA_QUERY='query ($ids:[Int!]!) { Page(page:1, perPage:50) { media(id_in:$ids) { id type format status chapters episodes title { userPreferred english romaji native } description coverImage { extraLarge } bannerImage genres tags { name } season seasonYear averageScore meanScore popularity favorites studios { nodes { name } } source duration startDate { year month day } endDate { year month day } relations { edges { relationType node { id type format status chapters episodes title { userPreferred english romaji native } coverImage { extraLarge } siteUrl startDate { year month day } } } } } } }';
const SCHEDULE_QUERY='query ($ids:[Int!]!, $from:Int!, $to:Int!) { Page(page:1, perPage:50) { airingSchedules(mediaId_in:$ids, airingAt_greater:$from, airingAt_lesser:$to, sort:TIME) { id airingAt episode mediaId media { id title { userPreferred english romaji native } } } } }';

function json(body:Record<string,unknown>,status=200){ return Response.json(body,{status,headers:HEADERS}); }
function titleOf(m:any){ return m?.title?.userPreferred||m?.title?.english||m?.title?.romaji||m?.title?.native||'Untitled'; }
function clean(v:any){ return String(v||'').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,'').trim(); }
function dateIso(d:any){
  if(!d?.year)return null;
  return new Date(Date.UTC(Number(d.year),Math.max(0,Number(d.month||1)-1),Number(d.day||1))).toISOString();
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
  const out:any[]=[];
  for(let i=0;i<ids.length;i+=50){
    const data=await graph(MEDIA_QUERY,{ids:ids.slice(i,i+50)});
    out.push(...(Array.isArray(data?.Page?.media)?data.Page.media:[]));
  }
  return out;
}
async function fetchSchedules(ids:number[],from:number,to:number){
  const out:any[]=[];
  for(let i=0;i<ids.length;i+=50){
    const data=await graph(SCHEDULE_QUERY,{ids:ids.slice(i,i+50),from,to});
    out.push(...(Array.isArray(data?.Page?.airingSchedules)?data.Page.airingSchedules:[]));
  }
  return out;
}
function secretKey(){
  try{
    const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
    return String(keys.default||Object.values(keys)[0]||'');
  }catch{return ''}
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
    .select('id,user_id,title,medium,status,progress,total,anilist_id,next_release,next_release_number,data,poster,backdrop,description,genres,themes,studio,source,year,score')
    .not('anilist_id','is',null);
  if(error)throw error;

  const tracked=(rows||[]).map((r:any)=>({
    ...r,
    id:String(r.id),user_id:String(r.user_id),title:String(r.title||''),medium:String(r.medium),
    status:String(r.status),progress:Number(r.progress||0),total:r.total==null?null:Number(r.total),
    anilist_id:Number(r.anilist_id),data:r.data&&typeof r.data==='object'?r.data:{}
  })).filter((r:any)=>Number.isInteger(r.anilist_id));

  if(!tracked.length)return {users:0,checked:0,notifications:0,animeReleases:0,related:0,chapters:0,metadataUpdates:0};

  const ids=[...new Set(tracked.map((r:any)=>r.anilist_id))];
  const now=Math.floor(Date.now()/1000),from=now-48*3600,to=now+45*86400;
  const [media,schedules]=await Promise.all([fetchMedia(ids),fetchSchedules(ids,from,to)]);
  const byId=new Map<number,any>(media.map((m:any)=>[Number(m.id),m]));
  const schedulesById=new Map<number,any[]>();
  for(const s of schedules){
    const id=Number(s.mediaId),list=schedulesById.get(id)||[];
    list.push(s);schedulesById.set(id,list);
  }

  const users=new Map<string,any[]>();
  for(const row of tracked){
    const list=users.get(row.user_id)||[];list.push(row);users.set(row.user_id,list);
  }

  const notices:any[]=[];
  let animeReleases=0,related=0,chapters=0,metadataUpdates=0;

  for(const [userId,userRows] of users){
    const ownedIds=new Set(userRows.map((r:any)=>r.anilist_id));

    for(const row of userRows){
      const m=byId.get(row.anilist_id);
      if(!m)continue;

      const state={...(row.data?.frameReleaseRadar&&typeof row.data.frameReleaseRadar==='object'?row.data.frameReleaseRadar:{})};

      const liveScore=m.averageScore==null?null:Number(m.averageScore)/10;
      const liveTotal=m.episodes!=null?Number(m.episodes):m.chapters!=null?Number(m.chapters):m.total!=null?Number(m.total):row.total;
      const oldScore=row.score==null?null:Number(row.score);
      const oldTotal=row.total==null?null:Number(row.total);

      const update:any={
        title:titleOf(m),
        description:clean(m.description)||row.description,
        poster:m.coverImage?.extraLarge||row.poster,
        backdrop:m.bannerImage||row.backdrop||'',
        genres:Array.isArray(m.genres)?m.genres.map(String):row.genres,
        themes:Array.isArray(m.tags)?m.tags.slice(0,12).map((x:any)=>String(x.name)).filter(Boolean):row.themes,
        studio:m.studios?.nodes?.[0]?.name||row.studio||null,
        source:m.source||row.source||null,
        year:m.startDate?.year?Number(m.startDate.year):row.year||null,
        score:liveScore==null?row.score:liveScore,
        total:liveTotal==null?row.total:liveTotal,
        updated_at:new Date().toISOString()
      };

      if(liveScore!=null&&oldScore!=null&&Math.abs(liveScore-oldScore)>=0.1&&state.lastScoreNotified!==liveScore){
        notices.push({
          user_id:userId,type:'update',
          title:titleOf(m)+' · Rating updated',
          body:'AniList changed the average rating to '+liveScore.toFixed(1)+'/10.',
          href:'radar',
          dedupe_key:'update:score:'+row.anilist_id+':'+liveScore.toFixed(1)
        });
        state.lastScoreNotified=liveScore;
      }
      if(liveTotal!=null&&oldTotal!=null&&liveTotal>oldTotal&&state.lastTotalNotified!==liveTotal){
        const unit=row.medium==='anime'?'episodes':'chapters';
        notices.push({
          user_id:userId,type:'update',
          title:titleOf(m)+' · More '+unit,
          body:'AniList now lists '+liveTotal+' '+unit+'.',
          href:'radar',
          dedupe_key:'update:count:'+row.anilist_id+':'+liveTotal
        });
        state.lastTotalNotified=liveTotal;
      }

      const rowSchedules=(schedulesById.get(row.anilist_id)||[])
        .filter((s:any)=>Number.isFinite(Number(s.airingAt))&&Number.isFinite(Number(s.episode)))
        .sort((a:any,b:any)=>Number(a.airingAt)-Number(b.airingAt));

      const future=rowSchedules.find((s:any)=>Number(s.airingAt)>now);
      update.next_release=future?new Date(Number(future.airingAt)*1000).toISOString():null;
      update.next_release_number=future?Number(future.episode):null;

      if((row.medium==='manga'||row.medium==='manhwa')&&m.chapters!=null){
        const currentChapters=Number(m.chapters);
        const lastSeen=state.lastChapterCount==null?null:Number(state.lastChapterCount);
        if(lastSeen!=null&&currentChapters>lastSeen){
          notices.push({
            user_id:userId,type:'release',
            title:titleOf(m)+' · New chapters',
            body:'AniList now lists chapters through '+currentChapters+'; your progress is '+row.progress+'.',
            href:'radar',
            dedupe_key:'release:chapter:'+row.anilist_id+':'+currentChapters
          });
          chapters++;
        }
        state.lastChapterCount=currentChapters;
      }

      if(row.medium==='anime'||row.medium==='series'){
        for(const s of rowSchedules){
          const airing=Number(s.airingAt),episode=Number(s.episode);
          if(airing<=now&&airing>=from&&episode>row.progress){
            notices.push({
              user_id:userId,type:'release',
              title:titleOf(s.media||m)+' · Episode '+episode,
              body:'A tracked episode is available now.',
              href:'radar',
              dedupe_key:'release:available:'+row.anilist_id+':'+episode
            });
            animeReleases++;
          }else if(airing>now&&airing<=now+24*3600&&episode>row.progress){
            notices.push({
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

      if(m.relations?.edges){
        for(const edge of m.relations.edges){
          const n=edge?.node;
          if(!n||!Number.isInteger(Number(n.id))||ownedIds.has(Number(n.id)))continue;
          const format=String(n.format||''),type=String(n.type||''),status=String(n.status||'');
          const relevant=(type==='ANIME'&&['TV','TV_SHORT','MOVIE','OVA','ONA','SPECIAL'].includes(format))
            ||(type==='MANGA'&&['MANGA','ONE_SHOT','NOVEL'].includes(format));
          if(!relevant)continue;
          const start=dateIso(n.startDate);
          const startTs=start?new Date(start).getTime():null;
          const scheduled=startTs!=null&&startTs>=Date.now()-24*3600*1000&&startTs<=Date.now()+365*86400*1000;
          const announced=status==='NOT_YET_RELEASED';
          if(!scheduled&&!announced)continue;
          const label=format==='MOVIE'?'movie':format==='OVA'?'OVA':format==='ONA'?'ONA':format==='SPECIAL'?'special':type==='MANGA'?'manga':'anime release';
          if(scheduled){
            notices.push({
              user_id:userId,type:'release',
              title:titleOf(n)+' · '+label,
              body:'A related release is scheduled for '+new Date(start!).toLocaleDateString('en-IN',{year:'numeric',month:'short',day:'numeric'})+'.',
              href:'radar',
              dedupe_key:'release:related:'+row.anilist_id+':'+Number(n.id)+':scheduled:'+start
            });
          }else{
            notices.push({
              user_id:userId,type:'release',
              title:titleOf(n)+' · New related release',
              body:'A related '+type.toLowerCase()+' release has been announced; the release date is not known yet.',
              href:'radar',
              dedupe_key:'release:related:'+row.anilist_id+':'+Number(n.id)+':announced'
            });
          }
          related++;
        }
      }

      update.data={...row.data,frameReleaseRadar:{...state,lastCheckedAt:new Date().toISOString()}};
      const {error:e}=await admin.from('media_items').update(update).eq('id',row.id).eq('user_id',userId);
      if(e)throw e;
      metadataUpdates++;
    }
  }

  let inserted=0;
  if(notices.length){
    for(let i=0;i<notices.length;i+=200){
      const {data,error}=await admin.from('frame_notifications')
        .upsert(notices.slice(i,i+200),{onConflict:'user_id,dedupe_key',ignoreDuplicates:true})
        .select('id');
      if(error)throw error;
      inserted+=(data||[]).length;
    }
  }
  return {users:users.size,checked:tracked.length,notifications:inserted,animeReleases,related,chapters,metadataUpdates};
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

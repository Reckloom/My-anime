import { withSupabase } from 'npm:@supabase/server@^1';

const ANILIST_URL='https://graphql.anilist.co';
const HEADERS={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const QUERY=`query ($ids:[Int!]!, $from:Int!, $to:Int!) {
  Page(page:1, perPage:50) {
    airingSchedules(mediaId_in:$ids, airingAt_greater:$from, airingAt_lesser:$to, sort:TIME) {
      id airingAt episode timeUntilAiring mediaId
      media { id title { userPreferred english romaji native } format type status }
    }
  }
}`;

function titleOf(m:any){
 return m?.title?.userPreferred||m?.title?.english||m?.title?.romaji||m?.title?.native||'Untitled';
}
function json(body:Record<string,unknown>,status=200){
 return Response.json(body,{status,headers:HEADERS});
}
async function aniList(ids:number[],from:number,to:number){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),20000);
 try{
  const r=await fetch(ANILIST_URL,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({query:QUERY,variables:{ids,from,to}}),signal:controller.signal});
  const text=await r.text();let j:any;
  try{j=JSON.parse(text)}catch{throw new Error('AniList returned an invalid response.');}
  if(!r.ok||j?.errors?.length)throw new Error(j?.errors?.[0]?.message||'AniList release lookup failed.');
  return Array.isArray(j?.data?.Page?.airingSchedules)?j.data.Page.airingSchedules:[];
 }catch(e){
  if(e instanceof DOMException&&e.name==='AbortError')throw new Error('AniList release lookup timed out.');
  throw e;
 }finally{clearTimeout(timer);}
}
export default {
 fetch: withSupabase({auth:'user'},async(req,ctx)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:HEADERS});
  if(req.method!=='POST')return json({error:'POST required'},405);
  const userId=ctx.userClaims?.id;
  if(!userId)return json({error:'Authenticated user required.'},401);
  try{
   const scoped=ctx.supabase;
   const {data:items,error:itemError}=await scoped.from('media_items')
     .select('id,title,poster,anilist_id,progress,total,next_release,next_release_number')
     .eq('user_id',userId).not('anilist_id','is',null);
   if(itemError)throw itemError;
   const tracked=(items||[]).map(x=>({id:String(x.id),title:String(x.title),poster:String(x.poster||''),anilistId:Number(x.anilist_id),progress:Number(x.progress||0),total:x.total==null?null:Number(x.total)}))
     .filter(x=>Number.isInteger(x.anilistId));
   if(!tracked.length)return json({ok:true,checked:0,releases:[],alerts:[]});
   const now=Math.floor(Date.now()/1000);
   const to=now+45*86400;
   const schedules:any[]=[];
   for(let i=0;i<tracked.length;i+=50)schedules.push(...await aniList(tracked.slice(i,i+50).map(x=>x.anilistId),now-48*3600,to));
   const byId=new Map(tracked.map(x=>[x.anilistId,x]));
   const releases=schedules.map((s:any)=>({
     mediaId:String(byId.get(Number(s.mediaId))?.id||''),
     anilistId:Number(s.mediaId),title:titleOf(s.media)||byId.get(Number(s.mediaId))?.title||'Untitled',
     episode:Number(s.episode||0),airingAt:new Date(Number(s.airingAt)*1000).toISOString(),
     released:Number(s.airingAt)<=now,status:Number(s.airingAt)<=now?'released':'scheduled'
   })).filter(x=>x.mediaId);
   const nextByItem=new Map<string,any>();
   for(const r of releases){
     if(r.status==='scheduled'&&!nextByItem.has(r.mediaId))nextByItem.set(r.mediaId,r);
   }
   for(const item of tracked){
     const next=nextByItem.get(item.id);
     await scoped.from('media_items').update({
       next_release:next?.airingAt||null,
       next_release_number:next?.episode||null,
       updated_at:new Date().toISOString()
     }).eq('id',item.id).eq('user_id',userId);
   }
   const alerts=releases.filter(r=>{
     const ms=new Date(r.airingAt).getTime()-Date.now();
     const item=byId.get(r.anilistId);
     return r.status==='released' ? (Number(r.episode)>Number(item?.progress||0)) : (ms>=0&&ms<=24*3600*1000);
   });
   return json({ok:true,checked:tracked.length,releases,alerts});
  }catch(error){
   return json({error:error instanceof Error?error.message:String(error)},400);
  }
 })
};

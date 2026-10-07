import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization")||"";
  const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
  const client=createClient(supabaseUrl,anon,{global:{headers:{Authorization:auth}}});
  const {data:userData,error:userError}=await client.auth.getUser();
  if(userError||!userData.user)return new Response(JSON.stringify({error:"Authentication required"}),{status:401,headers:{...cors,"Content-Type":"application/json"}});
  const body=await req.json().catch(()=>({}));
  const steamId=String(body.steamId||"").trim();
  if(!/^(\\d{17}|[A-Za-z0-9_-]{3,64})$/.test(steamId))return new Response(JSON.stringify({error:"Enter a valid SteamID64 or profile identifier."}),{status:400,headers:{...cors,"Content-Type":"application/json"}});
  const key=Deno.env.get("STEAM_WEB_API_KEY");
  if(!key)return new Response(JSON.stringify({error:"Steam library sync needs the server-side Steam Web API key."}),{status:503,headers:{...cors,"Content-Type":"application/json"}});
  const url="https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key="+encodeURIComponent(key)+"&steamid="+encodeURIComponent(steamId)+"&format=json&include_appinfo=1&include_played_free_games=1";
  const res=await fetch(url);
  if(!res.ok)return new Response(JSON.stringify({error:"Steam did not return a library for this account. Make sure the profile and games list are public."}),{status:502,headers:{...cors,"Content-Type":"application/json"}});
  const data=await res.json();
  const games=(data?.response?.games||[]).map((g:any)=>({appId:String(g.appid),name:String(g.name||"Unknown game"),playtimeMinutes:Number(g.playtime_forever||0),playtimeRecentMinutes:Number(g.playtime_2weeks||0),logo:g.img_logo_url?"https://media.steampowered.com/steamcommunity/public/images/apps/"+g.appid+"/"+g.img_logo_url+".jpg":undefined,header:"https://cdn.cloudflare.steamstatic.com/steam/apps/"+g.appid+"/header.jpg",storeUrl:"https://store.steampowered.com/app/"+g.appid+"/"})).sort((a:any,b:any)=>b.playtimeMinutes-a.playtimeMinutes);
  return new Response(JSON.stringify({steamId,games,gameCount:games.length}),{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){
  return new Response(JSON.stringify({error:e instanceof Error?e.message:"Steam library sync failed."}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
 }
});

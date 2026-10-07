const cors={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
 "Access-Control-Allow-Methods":"POST,OPTIONS"
};

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const body=await req.json().catch(()=>({}));
  const query=String(body.query||"").trim().slice(0,180);
  if(query.length<2)return new Response(JSON.stringify({error:"Enter at least two characters."}),{status:400,headers:{...cors,"Content-Type":"application/json"}});
  const key=Deno.env.get("GOOGLE_SEARCH_API_KEY");
  const cx=Deno.env.get("GOOGLE_SEARCH_ENGINE_ID");
  if(!key||!cx){
   return new Response(JSON.stringify({
    configured:false,
    results:[],
    fallbackUrl:"https://www.google.com/search?q="+encodeURIComponent(query)
   }),{headers:{...cors,"Content-Type":"application/json"}});
  }
  const url=new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key",key);
  url.searchParams.set("cx",cx);
  url.searchParams.set("q",query);
  url.searchParams.set("num","10");
  url.searchParams.set("safe","active");
  url.searchParams.set("gl","in");
  url.searchParams.set("hl","en");
  const res=await fetch(url);
  const data=await res.json();
  if(!res.ok)return new Response(JSON.stringify({error:String(data?.error?.message||"Google Search API request failed.")}),{status:502,headers:{...cors,"Content-Type":"application/json"}});
  const results=(data.items||[]).map((x:any)=>({
   title:String(x.title||""),
   link:String(x.link||""),
   snippet:String(x.snippet||""),
   displayLink:String(x.displayLink||"")
  })).filter((x:any)=>x.title&&x.link);
  return new Response(JSON.stringify({configured:true,results,fallbackUrl:"https://www.google.com/search?q="+encodeURIComponent(query)}),{headers:{...cors,"Content-Type":"application/json"}});
 }catch(e){
  return new Response(JSON.stringify({error:e instanceof Error?e.message:"Google Search failed."}),{status:500,headers:{...cors,"Content-Type":"application/json"}});
 }
});

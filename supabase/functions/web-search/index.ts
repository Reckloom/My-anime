const cors={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Content-Type":"application/json; charset=utf-8"
};

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});

function googleUrl(query:string){return "https://www.google.com/search?q="+encodeURIComponent(query)}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"POST required."},405);
 try{
  const body=await req.json().catch(()=>({}));
  const query=String(body.query||"").trim().slice(0,180);
  if(query.length<2)return json({error:"Enter at least two characters."},400);

  const key=Deno.env.get("GOOGLE_SEARCH_API_KEY");
  const cx=Deno.env.get("GOOGLE_SEARCH_ENGINE_ID");
  if(key&&cx){
   const url=new URL("https://www.googleapis.com/customsearch/v1");
   url.searchParams.set("key",key);url.searchParams.set("cx",cx);url.searchParams.set("q",query);
   url.searchParams.set("num","10");url.searchParams.set("safe","active");url.searchParams.set("gl","in");url.searchParams.set("hl","en");
   const res=await fetch(url); const data=await res.json().catch(()=>({}));
   if(res.ok){
    const results=(data.items||[]).map((x:any)=>({title:String(x.title||""),link:String(x.link||""),snippet:String(x.snippet||""),displayLink:String(x.displayLink||"")})).filter((x:any)=>x.title&&x.link);
    if(results.length)return json({provider:"google",results,fallbackUrl:googleUrl(query)});
   }
  }

  // Keyless fallback: DuckDuckGo Instant Answers/related topics. Google remains available as the full-results fallback.
  const ddg=new URL("https://api.duckduckgo.com/");
  ddg.searchParams.set("q",query);ddg.searchParams.set("format","json");ddg.searchParams.set("no_html","1");ddg.searchParams.set("skip_disambig","0");
  const dres=await fetch(ddg,{headers:{"User-Agent":"FRAME/1.0"}});
  const d=await dres.json().catch(()=>({}));
  const results:any[]=[];
  if(d?.AbstractText&&d?.AbstractURL)results.push({title:String(d.Heading||query),link:String(d.AbstractURL),snippet:String(d.AbstractText),displayLink:"duckduckgo.com"});
  for(const topic of Array.isArray(d?.RelatedTopics)?d.RelatedTopics:[]){
   if(topic?.FirstURL&&topic?.Text)results.push({title:String(topic.Text).slice(0,120),link:String(topic.FirstURL),snippet:String(topic.Text),displayLink:"duckduckgo.com"});
   if(results.length>=10)break;
  }
  return json({provider:"duckduckgo",results:results.slice(0,10),fallbackUrl:googleUrl(query)});
 }catch(e){
  return json({provider:"fallback",results:[],fallbackUrl:googleUrl(""),error:e instanceof Error?e.message:"Web search failed."},500);
 }
});
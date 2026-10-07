import { withSupabase } from 'npm:@supabase/server@^1';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Provider = 'game'|'series'|'movie'|'book';

function response(body:Record<string,unknown>, status=200){
  return Response.json(body,{status,headers:HEADERS});
}

function clean(value?:string|null){
  return (value||'').replace(/<br\s*\/?>(\s*)/gi,' ').replace(/<[^>]+>/g,'').trim();
}

async function getJson(url:string){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch(url,{
      headers:{Accept:'application/json','User-Agent':'FRAME/1.0'},
      signal:controller.signal
    });
    const text=await r.text();
    let json:any;
    try{json=JSON.parse(text)}catch{throw new Error('Source returned an invalid response.')}
    if(!r.ok) throw new Error(`Source request failed (HTTP ${r.status}).`);
    return json;
  }catch(e){
    if(e instanceof DOMException&&e.name==='AbortError') throw new Error('Source request timed out.');
    throw e;
  }finally{clearTimeout(timer);}
}

async function postJson(url:string,body:unknown){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json','User-Agent':'FRAME/1.0'},
      body:JSON.stringify(body),
      signal:controller.signal
    });
    const text=await r.text();
    let json:any;
    try{json=JSON.parse(text)}catch{throw new Error('Source returned an invalid response.')}
    if(!r.ok) throw new Error(`Source request failed (HTTP ${r.status}).`);
    return json;
  }catch(e){
    if(e instanceof DOMException&&e.name==='AbortError') throw new Error('Source request timed out.');
    throw e;
  }finally{clearTimeout(timer);}
}

async function searchGames(q:string){
  const url=`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&cc=in&l=english&category1=998`;
  const data=await getJson(url);
  const items=Array.isArray(data?.items)?data.items:[];
  return items.slice(0,12).map((x:any)=>({
    provider:'steam',externalId:String(x.id),title:String(x.name||'Untitled'),medium:'game',
    poster:x.tiny_image||x.large_capsule_image||'',score:null,year:null,description:'',
    genres:[],themes:[],sourceUrl:`https://store.steampowered.com/app/${x.id}/`
  }));
}

async function detailGame(id:string){
  const data=await getJson(`https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(id)}&cc=in&l=english`);
  const game=data?.[id]?.data;
  if(!game) throw new Error('Game details were not available.');
  const genres=Array.isArray(game.genres)?game.genres.map((x:any)=>String(x.description)):[];
  const categories=Array.isArray(game.categories)?game.categories.map((x:any)=>String(x.description)):[];
  const developers=Array.isArray(game.developers)?game.developers.map(String):[];
  const publishers=Array.isArray(game.publishers)?game.publishers.map(String):[];
  return {
    provider:'steam',externalId:id,title:String(game.name||'Untitled'),
    medium:genres.some((x:string)=>x.toLowerCase()==='visual novel')?'visual-novel':'game',
    poster:String(game.header_image||game.capsule_image||''),backdrop:String(game.background||''),
    description:clean(String(game.short_description||game.detailed_description||'')),
    genres, themes:categories, studio:developers.join(', ')||undefined,
    source:publishers.join(', ')||'Steam',year:game.release_date?.date?Number(String(game.release_date.date).match(/(19|20)\d{2}/)?.[0]):undefined,
    score:game.metacritic?.score?Number(game.metacritic.score)/10:undefined,
    sourceUrl:`https://store.steampowered.com/app/${id}/`,
    game:{
      developer:developers.join(', ')||undefined,
      publisher:publishers.join(', ')||undefined,
      releaseDate:game.release_date?.date||undefined,
      platforms:Array.isArray(game.platforms)?Object.entries(game.platforms).filter(([,v])=>Boolean(v)).map(([k])=>k):[],
      gameModes:categories.filter((x:string)=>/single-player|multi-player|co-op/i.test(x)),
    },
    meta:{website:game.website||undefined}
  };
}

async function searchSeries(q:string){
  const data=await getJson(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
  return (Array.isArray(data)?data:[]).slice(0,12).map((x:any)=>({
    provider:'tvmaze',externalId:String(x.show?.id),title:String(x.show?.name||'Untitled'),medium:'series',
    poster:x.show?.image?.original||x.show?.image?.medium||'',backdrop:'',score:x.show?.rating?.average??null,
    year:x.show?.premiered?Number(String(x.show.premiered).slice(0,4)):null,
    description:clean(x.show?.summary),genres:x.show?.genres||[],themes:[],
    status:x.show?.status,sourceUrl:x.show?.url||`https://www.tvmaze.com/shows/${x.show?.id}`
  }));
}

async function detailSeries(id:string){
  const data=await getJson(`https://api.tvmaze.com/shows/${encodeURIComponent(id)}`);
  return {
    provider:'tvmaze',externalId:String(data.id),title:String(data.name||'Untitled'),medium:'series',
    poster:data.image?.original||data.image?.medium||'',backdrop:data.image?.original||'',
    description:clean(data.summary),genres:data.genres||[],themes:[],year:data.premiered?Number(String(data.premiered).slice(0,4)):undefined,
    score:data.rating?.average??undefined,source:data.network?.name||data.webChannel?.name||'TVmaze',
    sourceUrl:data.url,airStart:data.premiered||undefined,airEnd:data.ended||undefined
  };
}

async function searchMovies(q:string){
  const url=`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q+' film')}&gsrnamespace=0&gsrlimit=12&prop=pageimages|extracts|info&exintro=1&explaintext=1&inprop=url&piprop=thumbnail&pithumbsize=500&format=json&origin=*`;
  const data=await getJson(url);
  const pages=Object.values(data?.query?.pages||{}) as any[];
  return pages.map((x:any)=>({
    provider:'wikipedia',externalId:String(x.pageid),title:String(x.title||'Untitled'),medium:'movie',
    poster:x.thumbnail?.source||'',backdrop:'',score:null,
    year:extractYear(x.extract),description:clean(x.extract),genres:[],themes:[],
    sourceUrl:x.fullurl||`https://en.wikipedia.org/wiki/${encodeURIComponent(String(x.title||''))}`
  }));
}

async function detailMovie(id:string){
  const data=await getJson(`https://en.wikipedia.org/w/api.php?action=query&pageids=${encodeURIComponent(id)}&prop=pageimages|extracts|info&exintro=1&explaintext=1&inprop=url&piprop=thumbnail&pithumbsize=700&format=json&origin=*`);
  const page=Object.values(data?.query?.pages||{})[0] as any;
  if(!page) throw new Error('Movie details were not available.');
  return {
    provider:'wikipedia',externalId:String(page.pageid),title:String(page.title||'Untitled'),medium:'movie',
    poster:page.thumbnail?.source||'',backdrop:'',score:undefined,year:extractYear(page.extract),
    description:clean(page.extract),genres:[],themes:[],source:'Wikipedia',
    sourceUrl:page.fullurl||`https://en.wikipedia.org/wiki/${encodeURIComponent(String(page.title||''))}`
  };
}

async function searchBooks(q:string){
  const fields='key,title,author_name,first_publish_year,cover_i,subject';
  const data=await getJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=12&fields=${encodeURIComponent(fields)}`);
  const docs=Array.isArray(data?.docs)?data.docs:[];
  return docs.slice(0,12).map((x:any)=>({
    provider:'openlibrary',externalId:String(x.key||''),title:String(x.title||'Untitled'),medium:'book',
    poster:x.cover_i?`https://covers.openlibrary.org/b/id/${x.cover_i}-L.jpg`:'',
    backdrop:'',score:null,year:x.first_publish_year??null,description:'',
    genres:[],themes:Array.isArray(x.subject)?x.subject.slice(0,8):[],
    studio:Array.isArray(x.author_name)?x.author_name.join(', '):undefined,
    sourceUrl:x.key?`https://openlibrary.org${x.key}`:'https://openlibrary.org/'
  }));
}

async function detailBook(key:string){
  const cleanKey=key.startsWith('/')?key:`/works/${key}`;
  const data=await getJson(`https://openlibrary.org${cleanKey}.json`);
  const cover=data?.covers?.[0];
  return {
    provider:'openlibrary',externalId:cleanKey,title:String(data?.title||'Untitled'),medium:'book',
    poster:cover?`https://covers.openlibrary.org/b/id/${cover}-L.jpg`:'',
    backdrop:'',score:undefined,year:data?.first_publish_date?extractYear(String(data.first_publish_date)):undefined,
    description:typeof data?.description==='string'?data.description:typeof data?.description?.value==='string'?data.description.value:'',
    genres:[],themes:Array.isArray(data?.subjects)?data.subjects.slice(0,12):[],
    source:'Open Library',sourceUrl:`https://openlibrary.org${cleanKey}`
  };
}

function extractYear(value?:string|null){
  const m=String(value||'').match(/(?:18|19|20)\d{2}/);
  return m?Number(m[0]):undefined;
}

export default {
  fetch: withSupabase({auth:'user'},async(req,ctx)=>{
    if(req.method==='OPTIONS') return new Response('ok',{headers:HEADERS});
    if(req.method!=='POST') return response({error:'POST required'},405);
    if(!ctx.userClaims?.id) return response({error:'Authenticated user required.'},401);
    try{
      const body=await req.json();
      const action=String(body?.action||'search');
      const provider=String(body?.provider||'');
      if(!(['game','series','movie','book'].includes(provider))) return response({error:'Unsupported provider.'},400);
      if(action==='search'){
        const query=String(body?.query||'').trim();
        if(query.length<2) return response({results:[]});
        const fn=provider==='game'?searchGames:provider==='series'?searchSeries:provider==='movie'?searchMovies:searchBooks;
        return response({results:await fn(query)});
      }
      const id=String(body?.externalId||'').trim();
      if(!id) return response({error:'A valid external ID is required.'},400);
      const fn=provider==='game'?detailGame:provider==='series'?detailSeries:provider==='movie'?detailMovie:detailBook;
      return response({result:await fn(id)});
    }catch(error){
      return response({error:error instanceof Error?error.message:String(error)},400);
    }
  })
};
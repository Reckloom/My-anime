const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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


function mobyGamesUrl(path:string,key:string){
  const url=new URL('https://api.mobygames.com/v1'+path);
  url.searchParams.set('api_key',key);
  return url.toString();
}
function mobyImage(value:unknown){
  const url=String(value||'').trim();
  return url?url.replace(/^http:/,'https:'):'';
}
function mobyKey(){
  const key=Deno.env.get('MOBYGAMES_API_KEY')?.trim();
  if(!key)throw new Error('MobyGames API key is not configured for FRAME.');
  return key;
}
async function searchGames(q:string){
  const key=mobyKey();
  const data=await getJson(mobyGamesUrl('/games?'+new URLSearchParams({title:q.trim(),limit:'12',format:'normal'}).toString(),key));
  const games=Array.isArray(data?.games)?data.games:[];
  return games.slice(0,12).map((game:any)=>{
    const platforms=Array.isArray(game?.platforms)?game.platforms.map((x:any)=>String(x?.platform_name||'')).filter(Boolean):[];
    const genres=Array.isArray(game?.genres)?game.genres.map((x:any)=>String(x?.genre_name||'')).filter(Boolean):[];
    const alternatives=Array.isArray(game?.alternate_titles)?game.alternate_titles.map((x:any)=>String(x?.title||'')).filter(Boolean):[];
    const url=mobyImage(game?.moby_url)||('https://www.mobygames.com/game/'+String(game?.game_id||''));
    const poster=mobyImage(game?.sample_cover?.image||game?.sample_cover?.thumbnail_image);
    const year=extractYear(game?.platforms?.[0]?.first_release_date);
    return {
      provider:'mobygames',externalId:String(game?.game_id),title:String(game?.title||'Untitled'),medium:'game',
      poster,backdrop:'',score:game?.moby_score==null?null:Number(game.moby_score),year,
      description:clean(game?.description),genres,themes:platforms,alternativeTitles:[...new Set(alternatives)],
      source:'MobyGames',sourceUrl:url,
      game:{isFree:false,platforms,releaseDate:game?.platforms?.[0]?.first_release_date,gameModes:[],storeUrl:url}
    };
  });
}

async function detailGame(id:string){
  const key=mobyKey();
  const gameData=await getJson(mobyGamesUrl('/games/'+encodeURIComponent(id)+'?format=normal',key));
  const game=Array.isArray(gameData?.games)?gameData.games[0]:gameData?.game;
  if(!game) throw new Error('Game details were not available.');
  const platforms=Array.isArray(game?.platforms)?game.platforms.map((x:any)=>String(x?.platform_name||'')).filter(Boolean):[];
  const genres=Array.isArray(game?.genres)?game.genres.map((x:any)=>String(x?.genre_name||'')).filter(Boolean):[];
  const alternatives=Array.isArray(game?.alternate_titles)?game.alternate_titles.map((x:any)=>String(x?.title||'')).filter(Boolean):[];
  const url=mobyImage(game?.moby_url)||('https://www.mobygames.com/game/'+encodeURIComponent(id));
  return {
    provider:'mobygames',externalId:String(game?.game_id||id),title:String(game?.title||'Untitled'),medium:'game',
    poster:mobyImage(game?.sample_cover?.image||game?.sample_cover?.thumbnail_image),backdrop:'',
    score:game?.moby_score==null?null:Number(game.moby_score),year:extractYear(game?.platforms?.[0]?.first_release_date),
    description:clean(game?.description),genres,themes:platforms,alternativeTitles:[...new Set(alternatives)],
    source:'MobyGames',sourceUrl:url,
    game:{isFree:false,platforms,releaseDate:game?.platforms?.[0]?.first_release_date,gameModes:[],storeUrl:url}
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
  const data=await getJson(`https://api.tvmaze.com/shows/${encodeURIComponent(id)}?embed=episodes`);
  return {
    provider:'tvmaze',externalId:String(data.id),title:String(data.name||'Untitled'),medium:'series',
    poster:data.image?.original||data.image?.medium||'',backdrop:data.image?.original||'',
    description:clean(data.summary),genres:data.genres||[],themes:[],year:data.premiered?Number(String(data.premiered).slice(0,4)):undefined,
    score:data.rating?.average??undefined,source:data.network?.name||data.webChannel?.name||'TVmaze',
    sourceUrl:data.url,airStart:data.premiered||undefined,airEnd:data.ended||undefined,total:Array.isArray(data?._embedded?.episodes)?data._embedded.episodes.length:undefined
  };
}

async function searchMovies(q:string){
  const url=`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q+' film')}&gsrnamespace=0&gsrlimit=20&prop=pageimages|extracts|info&exintro=1&explaintext=1&inprop=url&piprop=thumbnail&pithumbsize=500&format=json&origin=*`;
  const data=await getJson(url);
  const pages=Object.values(data?.query?.pages||{}) as any[];
  const summaries=await Promise.all(pages.slice(0,8).map(async(page:any)=>{
    const title=String(page?.title||'').replace(/#/g,'%23');
    try{return await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g,'_'))}`)}catch{return null}
  }));
  const posterById=new Map<string,string>();
  summaries.forEach((summary:any)=>{
    if(summary?.pageid&&summary?.thumbnail?.source)posterById.set(String(summary.pageid),String(summary.thumbnail.source));
  });
  const ranked=pages.map((x:any)=>{
    const title=String(x.title||'Untitled');
    const hay=title.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const needle=q.trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const tokens=needle.split(/\s+/).filter(Boolean);
    let relevance=0;
    if(hay===needle)relevance+=100;
    if(hay.includes(needle))relevance+=45;
    relevance+=tokens.filter((t:string)=>hay.includes(t)).length*7;
    const extract=clean(x.extract);
    if(/\b(film|movie|cinema|feature film)\b/i.test(extract))relevance+=8;
    if(/\b(actor|actress|producer)\b/i.test(extract)&&!/\bfilm\b/i.test(hay))relevance-=18;
    const poster=x.thumbnail?.source||posterById.get(String(x.pageid))||'';
    return {provider:'wikipedia',externalId:String(x.pageid),title,medium:'movie',poster,backdrop:'',score:null,year:extractYear(extract),description:extract,genres:[],themes:[],sourceUrl:x.fullurl||`https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,_relevance:relevance};
  }).sort((a:any,b:any)=>b._relevance-a._relevance).slice(0,12);
  return ranked.map(({_relevance,...x}:any)=>x);
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

async function searchVisualNovels(q:string){
  const data=await postJson('https://api.vndb.org/kana/vn',{
    filters:['search','=',q],
    fields:'id,title,alttitle,image.url,description,rating,released',
    sort:'searchrank',
    results:12
  });
  const rows=Array.isArray(data?.results)?data.results:[];
  return rows.map((x:any)=>({
    provider:'vndb',externalId:String(x.id),title:String(x.title||'Untitled'),medium:'visual-novel',
    poster:x.image?.url||'',backdrop:'',score:x.rating==null?null:Number(x.rating)/10,
    year:extractYear(x.released),description:clean(x.description),genres:[],themes:[],
    alternativeTitles:x.alttitle?[String(x.alttitle)]:[],source:'VNDB',
    sourceUrl:`https://vndb.org/${x.id}`
  }));
}
async function detailVisualNovel(id:string){
  const data=await postJson('https://api.vndb.org/kana/vn',{
    filters:['id','=',id],
    fields:'id,title,alttitle,image.url,description,rating,released',
    results:1
  });
  const x=data?.results?.[0];
  if(!x) throw new Error('Visual novel details were not available.');
  return {
    provider:'vndb',externalId:String(x.id),title:String(x.title||'Untitled'),medium:'visual-novel',
    poster:x.image?.url||'',backdrop:'',score:x.rating==null?undefined:Number(x.rating)/10,
    year:extractYear(x.released),description:clean(x.description),genres:[],themes:[],
    alternativeTitles:x.alttitle?[String(x.alttitle)]:[],source:'VNDB',
    sourceUrl:`https://vndb.org/${x.id}`
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

Deno.serve(async(req:Request)=>{
    if(req.method==='OPTIONS') return new Response('ok',{headers:HEADERS});
    let body:any={};
    if(req.method==='GET'){
      const url=new URL(req.url);body={action:url.searchParams.get('action')||'search',provider:url.searchParams.get('provider')||'',query:url.searchParams.get('query')||'',externalId:url.searchParams.get('externalId')||''};
    }else if(req.method==='POST'){
      try{body=await req.json()}catch{return response({error:'Invalid JSON request.'},400)}
    }else return response({error:'POST or GET required'},405);
    try{
      const action=String(body?.action||'search');
      const provider=String(body?.provider||'');
      if(!(['game','series','movie','book','visual-novel'].includes(provider))) return response({error:'Unsupported provider.'},400);
      if(action==='search'){
        const query=String(body?.query||'').trim();
        if(query.length<2) return response({results:[]});
        const fn=provider==='game'?searchGames:provider==='series'?searchSeries:provider==='movie'?searchMovies:provider==='book'?searchBooks:searchVisualNovels;
        return response({results:await fn(query)});
      }
      const id=String(body?.externalId||'').trim();
      if(!id) return response({error:'A valid external ID is required.'},400);
      const fn=provider==='game'?detailGame:provider==='series'?detailSeries:provider==='movie'?detailMovie:provider==='book'?detailBook:detailVisualNovel;
      return response({result:await fn(id)});
    }catch(error){
      return response({error:error instanceof Error?error.message:String(error)},400);
    }
});

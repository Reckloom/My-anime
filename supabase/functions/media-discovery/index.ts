const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function response(body:Record<string,unknown>,status=200){
  return Response.json(body,{status,headers:HEADERS});
}

function clean(value?:string|null){
  return (value||'').replace(/<br\s*\/?>(\s*)/gi,' ').replace(/<[^>]+>/g,'').trim();
}

function extractYear(value?:string|null){
  const m=String(value||'').match(/(?:18|19|20)\d{2}/);
  return m?Number(m[0]):undefined;
}

function cleanSearch(value:string,max=160){
  return value.trim().replace(/[\r\n]+/g,' ').slice(0,max);
}

async function getJson(url:string,headers:Record<string,string>={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const r=await fetch(url,{
      headers:{Accept:'application/json',...headers},
      signal:controller.signal
    });
    const text=await r.text();
    let json:any;
    try{json=JSON.parse(text)}catch{throw new Error('Source returned an invalid response.')}
    if(!r.ok)throw new Error('Source request failed (HTTP '+r.status+').');
    return json;
  }catch(e){
    if(e instanceof DOMException&&e.name==='AbortError')throw new Error('Source request timed out.');
    throw e;
  }finally{clearTimeout(timer)}
}

async function postJson(url:string,body:unknown,headers:Record<string,string>={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const r=await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json',Accept:'application/json',...headers},
      body:JSON.stringify(body),
      signal:controller.signal
    });
    const text=await r.text();
    let json:any;
    try{json=JSON.parse(text)}catch{throw new Error('Source returned an invalid response.')}
    if(!r.ok)throw new Error('Source request failed (HTTP '+r.status+').');
    return json;
  }catch(e){
    if(e instanceof DOMException&&e.name==='AbortError')throw new Error('Source request timed out.');
    throw e;
  }finally{clearTimeout(timer)}
}

async function postForm(url:string,params:Record<string,string>){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const r=await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
      body:new URLSearchParams(params).toString(),
      signal:controller.signal
    });
    const text=await r.text();
    let json:any;
    try{json=JSON.parse(text)}catch{throw new Error('Source returned an invalid response.')}
    if(!r.ok)throw new Error('Source request failed (HTTP '+r.status+').');
    return json;
  }catch(e){
    if(e instanceof DOMException&&e.name==='AbortError')throw new Error('Source request timed out.');
    throw e;
  }finally{clearTimeout(timer)}
}

function firstError(errors:unknown[]){
  for(const error of errors){
    if(error instanceof Error&&error.message)return error.message;
  }
  return 'No provider returned usable results.';
}

/* ---------------- Games: IGDB -> RAWG -> Wikipedia fallback ---------------- */

let igdbTokenCache:{token:string;expiresAt:number}|null=null;

async function getIgdbToken(){
  const clientId=Deno.env.get('IGDB_CLIENT_ID')?.trim();
  const clientSecret=Deno.env.get('IGDB_CLIENT_SECRET')?.trim();
  if(!clientId||!clientSecret)throw new Error('IGDB credentials are not configured for FRAME.');
  if(igdbTokenCache&&igdbTokenCache.expiresAt>Date.now()+60000)return{clientId,token:igdbTokenCache.token};
  const data=await postForm('https://id.twitch.tv/oauth2/token',{
    client_id:clientId,client_secret:clientSecret,grant_type:'client_credentials'
  });
  const token=String(data?.access_token||'');
  if(!token)throw new Error('IGDB authentication returned no access token.');
  igdbTokenCache={token,expiresAt:Date.now()+Math.max(60,Number(data?.expires_in||3600)-60)*1000};
  return{clientId,token};
}

function igdbImage(imageId:unknown,size='t_cover_big'){
  const id=String(imageId||'').trim();
  return id?'https://images.igdb.com/igdb/image/upload/'+size+'/'+id+'.jpg':'';
}

async function igdbQuery(query:string){
  const {clientId,token}=await getIgdbToken();
  const r=await fetch('https://api.igdb.com/v4/games',{
    method:'POST',
    headers:{
      Accept:'application/json',
      'Client-ID':clientId,
      Authorization:'Bearer '+token,
      'Content-Type':'text/plain'
    },
    body:query
  });
  const text=await r.text();
  let json:any;
  try{json=JSON.parse(text)}catch{throw new Error('IGDB returned an invalid response.')}
  if(!r.ok)throw new Error('IGDB request failed (HTTP '+r.status+').');
  return json;
}

function mapIgdbGame(game:any){
  const platforms=Array.isArray(game?.platforms)?game.platforms.map((x:any)=>String(x?.name||'')).filter(Boolean):[];
  const genres=Array.isArray(game?.genres)?game.genres.map((x:any)=>String(x?.name||'')).filter(Boolean):[];
  const alternatives=Array.isArray(game?.alternative_names)?game.alternative_names.map((x:any)=>String(x?.name||'')).filter(Boolean):[];
  const url=String(game?.url||'https://www.igdb.com/games/'+String(game?.slug||game?.id||''));
  return{
    provider:'igdb',externalId:String(game?.id),title:String(game?.name||'Untitled'),medium:'game',
    poster:igdbImage(game?.cover?.image_id),backdrop:igdbImage(game?.artworks?.[0]?.image_id,'t_1080p'),
    score:game?.aggregated_rating==null?(game?.rating==null?null:Number(game.rating)):Number(game.aggregated_rating),
    year:game?.first_release_date?new Date(Number(game.first_release_date)*1000).getUTCFullYear():undefined,
    description:clean(game?.summary||''),genres,themes:[...platforms],
    alternativeTitles:[...new Set(alternatives)],source:'IGDB',sourceUrl:url,
    game:{
      isFree:false,platforms,releaseDate:game?.first_release_date?new Date(Number(game.first_release_date)*1000).toISOString():undefined,
      gameModes:Array.isArray(game?.game_modes)?game.game_modes.map((x:any)=>String(x?.name||'')).filter(Boolean):[],
      storeUrl:url
    }
  };
}

async function searchIgdb(query:string){
  const term=cleanSearch(query).replaceAll('"',' ');
  const data=await igdbQuery(
    'search "'+term+'"; fields id,name,slug,summary,cover.image_id,artworks.image_id,first_release_date,genres.name,platforms.name,alternative_names.name,rating,aggregated_rating,url,game_modes.name; limit 12;'
  );
  return(Array.isArray(data)?data:[]).slice(0,12).map(mapIgdbGame);
}

async function detailIgdb(id:string){
  const numeric=Number(id);
  if(!Number.isInteger(numeric)||numeric<1)throw new Error('A valid IGDB game ID is required.');
  const data=await igdbQuery(
    'where id = '+numeric+'; fields id,name,slug,summary,cover.image_id,artworks.image_id,first_release_date,genres.name,platforms.name,alternative_names.name,rating,aggregated_rating,url,game_modes.name; limit 1;'
  );
  const game=Array.isArray(data)?data[0]:null;
  if(!game)throw new Error('IGDB game details were not found.');
  return mapIgdbGame(game);
}

function rawgImage(value:unknown){
  const url=String(value||'').trim();
  return url?url.replace(/^http:/,'https:'):'';
}

function mapRawgGame(game:any){
  const platforms=Array.isArray(game?.platforms)?game.platforms.map((x:any)=>String(x?.platform?.name||'')).filter(Boolean):[];
  const genres=Array.isArray(game?.genres)?game.genres.map((x:any)=>String(x?.name||'')).filter(Boolean):[];
  const url=String(game?.website||('https://rawg.io/games/'+String(game?.slug||game?.id||'')));
  return{
    provider:'rawg',externalId:String(game?.id),title:String(game?.name||'Untitled'),medium:'game',
    poster:rawgImage(game?.background_image||game?.background_image_additional),backdrop:rawgImage(game?.background_image_additional||game?.background_image),
    score:game?.rating==null?null:Number(game.rating),year:extractYear(game?.released),
    description:clean(game?.description_raw||game?.description||''),genres,themes:platforms,source:'RAWG',sourceUrl:url,
    game:{isFree:false,platforms,releaseDate:game?.released,gameModes:Array.isArray(game?.game_modes)?game.game_modes.map(String):[],storeUrl:url}
  };
}

async function searchRawg(query:string){
  const key=Deno.env.get('RAWG_API_KEY')?.trim();
  if(!key)throw new Error('RAWG credentials are not configured for FRAME.');
  const url=new URL('https://api.rawg.io/api/games');
  url.searchParams.set('key',key);
  url.searchParams.set('search',cleanSearch(query));
  url.searchParams.set('page_size','12');
  const data=await getJson(url.toString());
  return(Array.isArray(data?.results)?data.results:[]).slice(0,12).map(mapRawgGame);
}

async function detailRawg(id:string){
  const key=Deno.env.get('RAWG_API_KEY')?.trim();
  if(!key)throw new Error('RAWG credentials are not configured for FRAME.');
  const data=await getJson('https://api.rawg.io/api/games/'+encodeURIComponent(id)+'?key='+encodeURIComponent(key));
  return mapRawgGame(data);
}


function wikipediaGameImage(images:unknown[]){
  const files=Array.isArray(images)?images.map((x:any)=>String(x?.title||'')).filter(Boolean):[];
  const candidates=files.filter((name:string)=>{
    if(!/^File:/i.test(name))return false;
    if(!/\.(jpe?g|png|webp)$/i.test(name))return false;
    const lower=name.toLowerCase();
    return !/logo|icon|screenshot|diagram|photo|portrait|sound|audio|edit-|featured|wikidata|wikiquote|commons|symbol|flag|map|sprite|interface/.test(lower);
  });
  candidates.sort((a:string,b:string)=>{
    const score=(name:string)=>{
      const lower=name.toLowerCase();
      let n=0;
      if(/box|cover|poster|artwork|key.?art|package/.test(lower))n+=100;
      if(/game/.test(lower))n+=20;
      if(/front/.test(lower))n+=10;
      return n;
    };
    return score(b)-score(a);
  });
  const file=candidates[0];
  return file?'https://en.wikipedia.org/wiki/Special:Redirect/file/'+encodeURIComponent(file.replace(/^File:/i,'')):'';
}

async function searchWikipediaGames(query:string){
  const search=cleanSearch(query)+' video game';
  const url='https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent(search)+'&gsrnamespace=0&gsrlimit=12&prop=pageimages|images|extracts|info&imlimit=50&exintro=1&explaintext=1&inprop=url&piprop=thumbnail&pithumbsize=700&format=json&origin=*';
  const data=await getJson(url);
  const pages=Object.values(data?.query?.pages||{}).map((x:any)=>{
    const poster=String(x.thumbnail?.source||'')||wikipediaGameImage(x.images);
    return{
      provider:'wikipedia-game',externalId:String(x.pageid),title:String(x.title||'Untitled'),medium:'game',
      poster,backdrop:'',score:null,year:extractYear(x.extract),description:clean(x.extract),
      genres:[],themes:[],source:'Wikipedia',sourceUrl:x.fullurl||'https://en.wikipedia.org/?curid='+x.pageid,
      game:{isFree:false,platforms:[],releaseDate:undefined,gameModes:[],storeUrl:x.fullurl||('https://en.wikipedia.org/?curid='+x.pageid)}
    };
  });
  const withArtwork=pages.filter((x:any)=>x.poster);
  return [...withArtwork,...pages.filter((x:any)=>!x.poster)].slice(0,12);
}

async function detailWikipediaGame(id:string){
  const data=await getJson('https://en.wikipedia.org/w/api.php?action=query&pageids='+encodeURIComponent(id)+'&prop=pageimages|extracts|info&exintro=1&explaintext=1&inprop=url&piprop=thumbnail&pithumbsize=900&format=json&origin=*');
  const page=Object.values(data?.query?.pages||{})[0] as any;
  if(!page)throw new Error('Game details were not available.');
  const url=page.fullurl||('https://en.wikipedia.org/?curid='+page.pageid);
  return{
    provider:'wikipedia-game',externalId:String(page.pageid),title:String(page.title||'Untitled'),medium:'game',
    poster:String(page.thumbnail?.source||''),backdrop:'',score:null,year:extractYear(page.extract),description:clean(page.extract),
    genres:[],themes:[],source:'Wikipedia',sourceUrl:url,
    game:{isFree:false,platforms:[],releaseDate:undefined,gameModes:[],storeUrl:url}
  };
}

async function searchGames(query:string){
  const errors:unknown[]=[];
  try{const found=await searchIgdb(query);if(found.length)return found;}catch(e){errors.push(e)}
  try{const found=await searchRawg(query);if(found.length)return found;}catch(e){errors.push(e)}
  try{const found=await searchWikipediaGames(query);if(found.length)return found;}catch(e){errors.push(e)}
  if(errors.length){
    return [];
  }
  return [];
}

async function detailGame(provider:string,id:string){
  if(provider==='igdb')return detailIgdb(id);
  if(provider==='rawg')return detailRawg(id);
  if(provider==='wikipedia-game')return detailWikipediaGame(id);
  throw new Error('Unsupported game source.');
}

/* ---------------- Movies / Series: TMDB -> Wikipedia / TVMaze ---------------- */

function tmdbImage(path:unknown,size='w500'){
  const p=String(path||'').trim();
  return p?'https://image.tmdb.org/t/p/'+size+p:'';
}

function tmdbHeaders(){
  const token=Deno.env.get('TMDB_API_TOKEN')?.trim();
  if(!token)throw new Error('TMDB credentials are not configured for FRAME.');
  return{Authorization:'Bearer '+token};
}

async function searchTmdbMovies(query:string){
  const url=new URL('https://api.themoviedb.org/3/search/movie');
  url.searchParams.set('query',cleanSearch(query));
  url.searchParams.set('include_adult','false');
  url.searchParams.set('language','en-US');
  url.searchParams.set('page','1');
  const data=await getJson(url.toString(),tmdbHeaders());
  return(Array.isArray(data?.results)?data.results:[]).slice(0,12).map((x:any)=>({
    provider:'tmdb-movie',externalId:String(x.id),title:String(x.title||x.original_title||'Untitled'),medium:'movie',
    poster:tmdbImage(x.poster_path),backdrop:tmdbImage(x.backdrop_path,'w1280'),score:x.vote_average==null?null:Number(x.vote_average),
    year:extractYear(x.release_date),description:clean(x.overview),genres:[],themes:[],
    source:'TMDB',sourceUrl:'https://www.themoviedb.org/movie/'+x.id
  }));
}

async function detailTmdbMovie(id:string){
  const data=await getJson('https://api.themoviedb.org/3/movie/'+encodeURIComponent(id)+'?language=en-US',tmdbHeaders());
  return{
    provider:'tmdb-movie',externalId:String(data.id),title:String(data.title||data.original_title||'Untitled'),medium:'movie',
    poster:tmdbImage(data.poster_path),backdrop:tmdbImage(data.backdrop_path,'w1280'),score:data.vote_average==null?null:Number(data.vote_average),
    year:extractYear(data.release_date),description:clean(data.overview),genres:Array.isArray(data.genres)?data.genres.map((x:any)=>String(x.name||'')).filter(Boolean):[],themes:[],
    source:'TMDB',sourceUrl:'https://www.themoviedb.org/movie/'+data.id
  };
}

async function searchTmdbSeries(query:string){
  const url=new URL('https://api.themoviedb.org/3/search/tv');
  url.searchParams.set('query',cleanSearch(query));
  url.searchParams.set('include_adult','false');
  url.searchParams.set('language','en-US');
  url.searchParams.set('page','1');
  const data=await getJson(url.toString(),tmdbHeaders());
  return(Array.isArray(data?.results)?data.results:[]).slice(0,12).map((x:any)=>({
    provider:'tmdb-tv',externalId:String(x.id),title:String(x.name||x.original_name||'Untitled'),medium:'series',
    poster:tmdbImage(x.poster_path),backdrop:tmdbImage(x.backdrop_path,'w1280'),score:x.vote_average==null?null:Number(x.vote_average),
    year:extractYear(x.first_air_date),description:clean(x.overview),genres:[],themes:[],
    source:'TMDB',sourceUrl:'https://www.themoviedb.org/tv/'+x.id
  }));
}

async function onePieceEpisodeCatalogue(id:string){
  const series=await getJson('https://api.themoviedb.org/3/tv/'+encodeURIComponent(id)+'?language=en-US',tmdbHeaders());
  const seasons=Array.isArray(series?.seasons)?series.seasons.filter((s:any)=>Number(s?.season_number)>=0).sort((a:any,b:any)=>{const an=Number(a.season_number),bn=Number(b.season_number);return (an===0?9999:an)-(bn===0?9999:bn)}):[];
  const all:any[]=[];
  // Keep the request burst small to respect the metadata provider's rate limits.
  for(let i=0;i<seasons.length;i+=4){
    const batch=seasons.slice(i,i+4);
    const results=await Promise.all(batch.map(async(s:any)=>{
      const data=await getJson('https://api.themoviedb.org/3/tv/'+encodeURIComponent(id)+'/season/'+encodeURIComponent(String(s.season_number))+'?language=en-US',tmdbHeaders());
      return Array.isArray(data?.episodes)?data.episodes:[];
    }));
    for(const episodes of results)all.push(...episodes);
  }
  const episodes=all.filter((e:any)=>Number(e?.episode_number)>0).sort((a:any,b:any)=>
    (Number(a.season_number)===0?9999:Number(a.season_number))-(Number(b.season_number)===0?9999:Number(b.season_number))||Number(a.episode_number)-Number(b.episode_number)
  );
  return {
    provider:'tmdb-tv-episodes',externalId:String(series.id),title:String(series.name||series.original_name||'One Piece'),
    seriesPoster:tmdbImage(series.poster_path),seriesBackdrop:tmdbImage(series.backdrop_path,'w1280'),
    source:'TMDB',seriesUrl:'https://www.themoviedb.org/tv/'+series.id,
    episodes:episodes.map((e:any,index:number)=>({
      absoluteEpisode:index+1,tmdbId:String(e.id),title:String(e.name||('Episode '+(index+1))),
      seasonNumber:Number(e.season_number),episodeNumber:Number(e.episode_number)||index+1,special:Number(e.season_number)===0,
      airDate:e.air_date?String(e.air_date):undefined,poster:tmdbImage(e.still_path,'w500'),
      backdrop:tmdbImage(e.still_path,'original'),score:e.vote_average==null?null:Number(e.vote_average),
      ratingCount:e.vote_count==null?0:Number(e.vote_count),ratingSource:'TMDB',
      runtimeMinutes:e.runtime==null?undefined:Number(e.runtime),synopsis:clean(e.overview||''),
      imdbEpisodeUrl:'https://www.imdb.com/find/?q='+encodeURIComponent('One Piece anime episode '+(index+1)+' '+String(e.name||'')),
      sourceUrl:'https://www.themoviedb.org/tv/'+series.id+'/season/'+Number(e.season_number)+'/episode/'+Number(e.episode_number)
    }))
  };
}

async function detailTmdbSeries(id:string){
  const data=await getJson('https://api.themoviedb.org/3/tv/'+encodeURIComponent(id)+'?language=en-US',tmdbHeaders());
  const seasons=Array.isArray(data?.seasons)?data.seasons.reduce((n:number,x:any)=>n+Number(x?.episode_count||0),0):undefined;
  return{
    provider:'tmdb-tv',externalId:String(data.id),title:String(data.name||data.original_name||'Untitled'),medium:'series',
    poster:tmdbImage(data.poster_path),backdrop:tmdbImage(data.backdrop_path,'w1280'),score:data.vote_average==null?null:Number(data.vote_average),
    year:extractYear(data.first_air_date),description:clean(data.overview),genres:Array.isArray(data.genres)?data.genres.map((x:any)=>String(x.name||'')).filter(Boolean):[],themes:[],
    source:'TMDB',sourceUrl:'https://www.themoviedb.org/tv/'+data.id,total:seasons
  };
}

async function searchWikipediaMovies(query:string){
  const url='https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent(cleanSearch(query)+' film')+'&gsrnamespace=0&gsrlimit=12&prop=pageimages|extracts|info&exintro=1&explaintext=1&inprop=url&piprop=thumbnail&pithumbsize=500&format=json&origin=*';
  const data=await getJson(url);
  return Object.values(data?.query?.pages||{}).map((x:any)=>({
    provider:'wikipedia',externalId:String(x.pageid),title:String(x.title||'Untitled'),medium:'movie',
    poster:String(x.thumbnail?.source||''),backdrop:'',score:null,year:extractYear(x.extract),description:clean(x.extract),
    genres:[],themes:[],source:'Wikipedia',sourceUrl:x.fullurl||'https://en.wikipedia.org/?curid='+x.pageid
  })).slice(0,12);
}

async function searchTvmaze(query:string){
  const data=await getJson('https://api.tvmaze.com/search/shows?q='+encodeURIComponent(cleanSearch(query)));
  return(Array.isArray(data)?data:[]).slice(0,12).map((x:any)=>({
    provider:'tvmaze',externalId:String(x.show?.id),title:String(x.show?.name||'Untitled'),medium:'series',
    poster:x.show?.image?.original||x.show?.image?.medium||'',backdrop:'',score:x.show?.rating?.average??null,
    year:extractYear(x.show?.premiered),description:clean(x.show?.summary),genres:Array.isArray(x.show?.genres)?x.show.genres:[],themes:[],
    source:'TVmaze',sourceUrl:x.show?.officialSite||x.show?.url||('https://www.tvmaze.com/shows/'+x.show?.id)
  }));
}

async function searchSeries(query:string){
  try{const found=await searchTmdbSeries(query);if(found.length)return found;}catch{}
  return searchTvmaze(query);
}

async function detailSeries(provider:string,id:string){
  if(provider==='tmdb-tv')return detailTmdbSeries(id);
  if(provider==='tvmaze'){
    const x=await getJson('https://api.tvmaze.com/shows/'+encodeURIComponent(id)+'?embed=episodes');
    return{
      provider:'tvmaze',externalId:String(x.id),title:String(x.name||'Untitled'),medium:'series',
      poster:x.image?.original||x.image?.medium||'',backdrop:x.image?.original||'',score:x.rating?.average??null,
      year:extractYear(x.premiered),description:clean(x.summary),genres:x.genres||[],themes:[],source:'TVmaze',
      sourceUrl:x.url,total:Array.isArray(x._embedded?.episodes)?x._embedded.episodes.length:undefined
    };
  }
  throw new Error('Unsupported series source.');
}

async function detailWikipediaMovie(id:string){
  const data=await getJson('https://en.wikipedia.org/w/api.php?action=query&pageids='+encodeURIComponent(id)+'&prop=pageimages|extracts|info&exintro=1&explaintext=1&inprop=url&piprop=thumbnail&pithumbsize=700&format=json&origin=*');
  const page=Object.values(data?.query?.pages||{})[0] as any;
  if(!page)throw new Error('Movie details were not available.');
  return{provider:'wikipedia',externalId:String(page.pageid),title:String(page.title||'Untitled'),medium:'movie',poster:page.thumbnail?.source||'',backdrop:'',score:null,year:extractYear(page.extract),description:clean(page.extract),genres:[],themes:[],source:'Wikipedia',sourceUrl:page.fullurl||''};
}

async function searchMovies(query:string){
  try{const found=await searchTmdbMovies(query);if(found.length)return found;}catch{}
  return searchWikipediaMovies(query);
}

async function detailMovie(provider:string,id:string){
  if(provider==='tmdb-movie')return detailTmdbMovie(id);
  if(provider==='wikipedia')return detailWikipediaMovie(id);
  throw new Error('Unsupported movie source.');
}

/* ---------------- Visual Novels: VNDB ---------------- */

async function searchVisualNovels(query:string){
  const data=await postJson('https://api.vndb.org/kana/vn',{
    filters:['search','=',cleanSearch(query)],
    fields:'id,title,alttitle,image.url,description,rating,released',
    sort:'searchrank',results:12
  });
  return(Array.isArray(data?.results)?data.results:[]).map((x:any)=>({
    provider:'vndb',externalId:String(x.id),title:String(x.title||'Untitled'),medium:'visual-novel',
    poster:x.image?.url||'',backdrop:'',score:x.rating==null?null:Number(x.rating)/10,
    year:extractYear(x.released),description:clean(x.description),genres:[],themes:[],
    alternativeTitles:x.alttitle?[String(x.alttitle)]:[],source:'VNDB',sourceUrl:'https://vndb.org/'+x.id
  }));
}

async function detailVisualNovel(id:string){
  const data=await postJson('https://api.vndb.org/kana/vn',{
    filters:['id','=',id],fields:'id,title,alttitle,image.url,description,rating,released',results:1
  });
  const x=data?.results?.[0];
  if(!x)throw new Error('Visual novel details were not available.');
  return{
    provider:'vndb',externalId:String(x.id),title:String(x.title||'Untitled'),medium:'visual-novel',
    poster:x.image?.url||'',backdrop:'',score:x.rating==null?null:Number(x.rating)/10,
    year:extractYear(x.released),description:clean(x.description),genres:[],themes:[],
    alternativeTitles:x.alttitle?[String(x.alttitle)]:[],source:'VNDB',sourceUrl:'https://vndb.org/'+x.id
  };
}

/* ---------------- Books: Open Library + Google Books ---------------- */

function mapOpenLibrary(x:any){
  return{
    provider:'openlibrary',externalId:String(x.key||''),title:String(x.title||'Untitled'),medium:'book',
    poster:x.cover_i?'https://covers.openlibrary.org/b/id/'+x.cover_i+'-L.jpg':'',backdrop:'',score:null,
    year:x.first_publish_year?Number(x.first_publish_year):undefined,description:'',
    genres:[],themes:Array.isArray(x.subject)?x.subject.slice(0,8).map(String):[],
    studio:Array.isArray(x.author_name)?x.author_name.slice(0,4).map(String).join(', '):undefined,
    source:'Open Library',sourceUrl:x.key?'https://openlibrary.org'+x.key:'https://openlibrary.org/'
  };
}

async function searchOpenLibrary(query:string){
  const fields='key,title,author_name,first_publish_year,cover_i,subject';
  const url='https://openlibrary.org/search.json?q='+encodeURIComponent(cleanSearch(query))+'&limit=12&fields='+encodeURIComponent(fields);
  const data=await getJson(url);
  return(Array.isArray(data?.docs)?data.docs:[]).slice(0,12).map(mapOpenLibrary);
}

function mapGoogleBook(item:any){
  const v=item?.volumeInfo||{};
  return{
    provider:'googlebooks',externalId:String(item?.id||''),title:String(v.title||'Untitled'),medium:'book',
    poster:v.imageLinks?.thumbnail?String(v.imageLinks.thumbnail).replace(/^http:/,'https:'):'',backdrop:'',score:v.averageRating==null?null:Number(v.averageRating),
    year:extractYear(v.publishedDate),description:clean(v.description),genres:Array.isArray(v.categories)?v.categories.slice(0,6).map(String):[],themes:[],
    studio:Array.isArray(v.authors)?v.authors.slice(0,4).map(String).join(', '):undefined,source:'Google Books',
    sourceUrl:v.infoLink||('https://books.google.com/books?id='+item?.id)
  };
}

async function searchGoogleBooks(query:string){
  const url=new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q',cleanSearch(query));
  url.searchParams.set('maxResults','12');
  const key=Deno.env.get('GOOGLE_BOOKS_API_KEY')?.trim();
  if(key)url.searchParams.set('key',key);
  const data=await getJson(url.toString());
  return(Array.isArray(data?.items)?data.items:[]).slice(0,12).map(mapGoogleBook);
}

async function detailOpenLibrary(key:string){
  const cleanKey=key.startsWith('/')?key:'/works/'+key;
  const data=await getJson('https://openlibrary.org'+cleanKey+'.json');
  const cover=data?.covers?.[0];
  return{
    provider:'openlibrary',externalId:cleanKey,title:String(data?.title||'Untitled'),medium:'book',
    poster:cover?'https://covers.openlibrary.org/b/id/'+cover+'-L.jpg':'',backdrop:'',score:null,
    year:data?.first_publish_date?extractYear(String(data.first_publish_date)):undefined,
    description:typeof data?.description==='string'?clean(data.description):typeof data?.description?.value==='string'?clean(data.description.value):'',
    genres:[],themes:Array.isArray(data?.subjects)?data.subjects.slice(0,12).map(String):[],
    source:'Open Library',sourceUrl:'https://openlibrary.org'+cleanKey
  };
}

async function detailGoogleBooks(id:string){
  const key=Deno.env.get('GOOGLE_BOOKS_API_KEY')?.trim();
  const url='https://www.googleapis.com/books/v1/volumes/'+encodeURIComponent(id)+(key?'?key='+encodeURIComponent(key):'');
  return mapGoogleBook(await getJson(url));
}

async function searchBooks(query:string){
  const results:DiscoveryResultLike[]=[];
  const errors:unknown[]=[];
  const [openRes,googleRes]=await Promise.allSettled([searchOpenLibrary(query),searchGoogleBooks(query)]);
  if(openRes.status==='fulfilled')results.push(...openRes.value);
  else errors.push(openRes.reason);
  if(googleRes.status==='fulfilled')results.push(...googleRes.value);
  else errors.push(googleRes.reason);
  const seen=new Set<string>();
  const merged=[] as any[];
  for(const row of results){
    const key=String(row.title).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    if(!key||seen.has(key))continue;
    seen.add(key);merged.push(row);
    if(merged.length>=12)break;
  }
  if(merged.length)return merged;
  throw new Error(firstError(errors).replace('No provider returned usable results.','Open Library and Google Books did not return usable book results.'));
}

async function detailBook(provider:string,id:string){
  if(provider==='openlibrary')return detailOpenLibrary(id);
  if(provider==='googlebooks')return detailGoogleBooks(id);
  throw new Error('Unsupported book source.');
}

let onePieceOfficialPosterCache:{expiresAt:number;posters:Record<string,string>;count:number;uniqueImages:number}|null=null;

function addOfficialOnePiecePosterRows(html:string,posters:Record<string,string>){
 const anchors=html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi)||[];
 for(const card of anchors){
  const opening=card.match(/^<a\b[^>]*>/i)?.[0]||'';
  if(!/el-card-block__container/.test(opening))continue;
  const src=card.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1]||'';
  if(!src)continue;
  const heading=(card.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&');
  const episodePart=heading.match(/第\s*([^話]{1,30})話/)?.[1]||'';
  const normalized=episodePart.replace(/[０-９]/g,(char)=>String.fromCharCode(char.charCodeAt(0)-0xFEE0));
  const numbers=(normalized.match(/\d+/g)||[]).map(Number).filter((n)=>n>0&&n<=1180);
  if(!numbers.length)continue;
  const imageUrl=new URL(src,'https://one-piece.com').toString();
  for(const number of numbers)if(!posters[String(number)])posters[String(number)]=imageUrl;
 }
}

async function fetchOnePieceOfficialArchivePage(page:number){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const url='https://one-piece.com/anime/index.html?category=&page='+page+'&sort=asc';
  const result=await fetch(url,{headers:{Accept:'text/html'},signal:controller.signal});
  if(!result.ok)throw new Error('Official One Piece archive returned HTTP '+result.status+'.');
  return await result.text();
 }finally{clearTimeout(timer)}
}

async function fetchEpisodeThumbnailPage(url:string){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),10000);
 try{
  const result=await fetch(url,{headers:{Accept:'text/html'},signal:controller.signal});
  if(!result.ok)return '';
  const html=await result.text();
  const match=html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const image=String(match?.[1]||'').replace(/&amp;/g,'&').trim();
  return /^https:\/\//i.test(image)&&/\.(?:jpe?g|png|webp)(?:\?|$)/i.test(image)?image:'';
 }catch(error){
  console.warn('[FRAME One Piece episode thumbnail]',url,error);
  return '';
 }finally{clearTimeout(timer)}
}

async function onePieceOfficialPosterCatalogue(){
 if(onePieceOfficialPosterCache&&onePieceOfficialPosterCache.expiresAt>Date.now())return {
  posters:onePieceOfficialPosterCache.posters,count:onePieceOfficialPosterCache.count,
  uniqueImages:onePieceOfficialPosterCache.uniqueImages,source:'ONE PIECE.com + episode thumbnail sources'
 };
 const posters:Record<string,string>={};
 const first=await fetchOnePieceOfficialArchivePage(1);
 addOfficialOnePiecePosterRows(first,posters);
 const linkedPages=[...first.matchAll(/page=(\d+)/g)].map((match)=>Number(match[1])).filter((n)=>n>1&&n<=60);
 const maxPage=Math.max(1,...linkedPages);
 for(let start=2;start<=maxPage;start+=8){
  const batch=Array.from({length:Math.min(8,maxPage-start+1)},(_,index)=>start+index);
  const pages=await Promise.all(batch.map(async(page)=>{
   try{return await fetchOnePieceOfficialArchivePage(page)}catch(error){console.warn('[FRAME One Piece poster page '+page+']',error);return ''}
  }));
  for(const html of pages)if(html)addOfficialOnePiecePosterRows(html,posters);
 }

 // Some official archive entries combine episodes 6–8 into one special card.
 // Use separate episode stills for those numbered entries so they remain distinct.
 const thumbnailOverrides:Record<number,string>={
  1179:'https://image.idn.media/post/20260921/asdasdasd_efed0e41-f61b-494e-b39d-3c1691fab779.jpg',
  1180:'https://image.idn.media/post/20260928/asasadqwadaqwd_7c4ba1d5-9169-4c9a-b684-bffbe4346f26.jpg'
 };
 const fetchNumbers=[6,7,8,1172,1173,1174,1175,1176,1177,1178];
 const fetched=await Promise.all(fetchNumbers.map(async(number)=>{
  const url='https://www.vodanime.com/anime/xtkqbcxbez/one-piece/episode/'+number;
  return [number,await fetchEpisodeThumbnailPage(url)] as const;
 }));
 for(const [number,url] of fetched)if(url)posters[String(number)]=url;
 for(const [number,url] of Object.entries(thumbnailOverrides))posters[number]=url;

 const result={posters,count:Object.keys(posters).length,uniqueImages:new Set(Object.values(posters)).size};
 onePieceOfficialPosterCache={...result,expiresAt:Date.now()+6*60*60*1000};
 return {...result,source:'ONE PIECE.com + episode thumbnail sources'};
}

type DiscoveryResultLike=Record<string,unknown>;

/* ---------------- Router ---------------- */

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:HEADERS});
  let body:any={};
  if(req.method==='GET'){
    const url=new URL(req.url);
    body={
      action:url.searchParams.get('action')||'search',
      provider:url.searchParams.get('provider')||'',
      query:url.searchParams.get('query')||'',
      externalId:url.searchParams.get('externalId')||'',
      source:url.searchParams.get('source')||''
    };
  }else if(req.method==='POST'){
    try{body=await req.json()}catch{return response({error:'Invalid JSON request.'},400)}
  }else return response({error:'GET, POST or OPTIONS required'},405);

  try{
    const action=String(body?.action||'search');
    const provider=String(body?.provider||'');
    if(!(['game','series','movie','book','visual-novel'].includes(provider)))return response({error:'Unsupported provider.'},400);

    if(action==='episodes'&&provider==='series'&&String(body?.source||'')==='tmdb-tv'){
      return response(await onePieceEpisodeCatalogue(String(body?.externalId||'37854')));
    }

    if(action==='episode-posters'&&provider==='series'&&String(body?.source||'')==='one-piece-official'){
      return response(await onePieceOfficialPosterCatalogue());
    }

    if(action==='search'){
      const query=String(body?.query||'').trim();
      if(query.length<2)return response({results:[]});
      if(provider==='game')return response({results:await searchGames(query)});
      if(provider==='series')return response({results:await searchSeries(query)});
      if(provider==='movie')return response({results:await searchMovies(query)});
      if(provider==='book')return response({results:await searchBooks(query)});
      return response({results:await searchVisualNovels(query)});
    }

    const id=String(body?.externalId||'').trim();
    if(!id)return response({error:'A valid external ID is required.'},400);

    if(provider==='game'){
      return response({result:await detailGame(String(body?.source||'igdb'),id)});
    }
    if(provider==='series'){
      return response({result:await detailSeries(String(body?.source||'tmdb-tv'),id)});
    }
    if(provider==='movie'){
      return response({result:await detailMovie(String(body?.source||'tmdb-movie'),id)});
    }
    if(provider==='book'){
      return response({result:await detailBook(String(body?.source||'openlibrary'),id)});
    }
    return response({result:await detailVisualNovel(id)});
  }catch(error){
    return response({error:error instanceof Error?error.message:String(error)},400);
  }
});
import {useEffect,useMemo,useState} from 'react';
import {Bot,CalendarDays,ChevronRight,CirclePlus,Compass,ExternalLink,Gamepad2,Globe,Home as HomeIcon,Library,Link2,LogOut,Menu,MessageCircle,Phone,RefreshCw,Search,Settings,Star,Users,X} from 'lucide-react';
import {signOut,useAuth} from './auth/Auth';
import type {MediaItem,Medium} from './types';
import {AniListSearch} from './components/AniListSearch';
import {FrameAI} from './components/FrameAI';
import {FrameGlobalChat} from './components/FrameGlobalChat';
import {FrameDetail} from './components/FrameDetail';
import {FrameSocial} from './components/FrameSocial';
import {CallsPage} from './components/FrameCalls';
import {FrameDirectCall} from './components/FrameDirectCall';
import {FrameWebSearch} from './components/FrameWebSearch';
import {FramePopupHub} from './components/FramePopupHub';
import {FrameSpotifyControls} from './components/FrameSpotify';
import {supabase} from './lib/supabase';

const poster='https://cdn.myanimelist.net/images/anime/10/47347.jpg';
const types:Record<Medium,string>={anime:'Anime',manga:'Manga',manhwa:'Manhwa','light-novel':'Light Novel','visual-novel':'Visual Novel',movie:'Movie',series:'Series',game:'Game',book:'Book'};
const unitFor=(m:Medium)=>({anime:'episodes',manga:'chapters',manhwa:'chapters','light-novel':'chapters','visual-novel':'%',movie:'watch state',series:'episodes',game:'%',book:'pages'} as Record<Medium,string>)[m];
type Profile={id:string;username:string;display_name:string;avatar_url?:string|null;bio?:string};
type Radar={mediaId:string;anilistId:number;title:string;poster:string;episode:number;airingAt:string;released:boolean};

function normalise(item:MediaItem):MediaItem{
 const total=item.total&&item.total>0?item.total:(item.medium==='game'||item.medium==='visual-novel'?100:item.medium==='movie'?1:500);
 return {...item,poster:item.poster||poster,total,progress:Math.max(0,Math.min(item.progress||0,total)),progressUnit:item.progressUnit||unitFor(item.medium)};
}
function dbToMedia(raw:unknown):MediaItem{
 const r=raw as any;
 const meta=r.media_metadata&&typeof r.media_metadata==='object'?r.media_metadata:{};
 const data=r.data&&typeof r.data==='object'?r.data:{};
 const v=(key:string)=>meta[key]??r[key];
 return normalise({
  id:String(r.id),parentId:r.parent_id?String(r.parent_id):undefined,metadataId:r.metadata_id?String(r.metadata_id):undefined,
  anilistId:r.anilist_id==null?undefined:Number(r.anilist_id),sourceProvider:data.provider?String(data.provider):r.anilist_id?'anilist':undefined,
  externalId:data.externalId?String(data.externalId):r.anilist_id?String(r.anilist_id):undefined,
  title:String(v('title')??''),alternativeTitles:Array.isArray(meta.alternative_titles)?meta.alternative_titles.map(String):[],
  description:String(v('description')??''),poster:String(v('poster')??''),backdrop:String(v('backdrop')??''),
  medium:String(r.medium) as Medium,status:String(r.status) as MediaItem['status'],progress:Number(r.progress??0),
  total:v('episodes')==null?(r.total==null?undefined:Number(r.total)):Number(v('episodes')),
  year:v('year')==null?undefined:Number(v('year')),score:v('score')==null?undefined:Number(v('score')),
  personalRating:data.personalRating==null?undefined:Number(data.personalRating),progressUnit:data.progressUnit?String(data.progressUnit):undefined,
  customTotal:data.customTotal==null?undefined:Number(data.customTotal),
  genres:Array.isArray(v('genres'))?v('genres').map(String):[],themes:Array.isArray(v('themes'))?v('themes').map(String):[],
  studio:v('studio')?String(v('studio')):undefined,source:v('source')?String(v('source')):undefined,
  season:meta.season?String(meta.season):undefined,duration:meta.duration==null?undefined:Number(meta.duration),
  airStart:meta.air_start?String(meta.air_start):undefined,airEnd:meta.air_end?String(meta.air_end):undefined,
  favorite:Boolean(r.favorite),notes:r.notes?String(r.notes):undefined,
  nextRelease:r.next_release?String(r.next_release):undefined,nextReleaseNumber:r.next_release_number==null?undefined:Number(r.next_release_number),
  availability:data.availability as MediaItem['availability'],game:data.game as MediaItem['game']
 });
}
function toRow(item:MediaItem,userId:string){
 return {id:item.id,user_id:userId,parent_id:item.parentId??null,metadata_id:item.metadataId??null,anilist_id:item.anilistId??null,title:item.title,description:item.description,poster:item.poster,backdrop:item.backdrop,medium:item.medium,status:item.status,progress:item.progress,total:item.medium==='movie'?1:(item.total??null),year:item.year??null,score:item.score??null,genres:item.genres,themes:item.themes,studio:item.studio??null,source:item.source??null,favorite:item.favorite,notes:item.notes??null,data:{provider:item.sourceProvider??null,externalId:item.externalId??null,personalRating:item.personalRating??null,progressUnit:item.progressUnit??unitFor(item.medium),customTotal:item.customTotal??item.total??null,availability:item.availability??null,game:item.game??null}};
}
function sortMedia(items:MediaItem[],mode:string){
 return [...items].sort((a,b)=>{
  if(mode==='personal')return(b.personalRating??-1)-(a.personalRating??-1);
  if(mode==='recent')return(b.year??0)-(a.year??0);
  if(mode==='progress')return b.progress/(b.total||1)-a.progress/(a.total||1);
  if(mode==='title')return a.title.localeCompare(b.title);
  return(b.score??0)-(a.score??0);
 });
}

export default function App(){
 const {user}=useAuth(),guest=localStorage.getItem('frame-guest')==='1',uid=user?.id||'guest';
 const storageKey=guest?'frame-library:guest':`frame-library:${uid}`;
 const [items,setItems]=useState<MediaItem[]>(()=>{
  try{
   const scoped=localStorage.getItem(storageKey);
   if(scoped)return JSON.parse(scoped).map(normalise);
   if(uid!=='guest'){
    const legacy=localStorage.getItem('frame-library');
    if(legacy){
     const migrated=JSON.parse(legacy).map(normalise);
     localStorage.setItem(storageKey,JSON.stringify(migrated));
     return migrated;
    }
   }
   return[];
  }catch{return[]}
 });
 const [page,setPage]=useState('home'),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[sortMode,setSortMode]=useState('rating');
 const [finder,setFinder]=useState(false),[selected,setSelected]=useState<MediaItem|null>(null),[menu,setMenu]=useState(false),[profile,setProfile]=useState<Profile|null>(null);
 const [directCall,setDirectCall]=useState<Profile|null>(null),[friendLibrary,setFriendLibrary]=useState<string|null>(null);
 const [radar,setRadar]=useState<Radar[]>([]),[radarBusy,setRadarBusy]=useState(false),[radarError,setRadarError]=useState('');
 const [aiProvider,setAiProvider]=useState('frame'),[density,setDensity]=useState('comfortable'),[theme,setTheme]=useState('sky'),[appearanceMode,setAppearanceMode]=useState<'light'|'dark'|'system'>('light');
 const [connections,setConnections]=useState<Record<string,boolean>>({anilist:true,steam:true,tvmaze:true,vndb:true,openlibrary:true,imdb:true,justwatch:true});

 useEffect(()=>{document.documentElement.dataset.density=density;document.documentElement.dataset.frameTheme=theme;document.documentElement.dataset.frameMode=appearanceMode},[density,theme,appearanceMode]);

 useEffect(()=>{
  try{localStorage.setItem(storageKey,JSON.stringify(items))}catch{}
 },[items,storageKey]);

 useEffect(()=>{
  const client=supabase;
  if(!client||!user?.id)return;
  let active=true;
  const load=async()=>{
   const {data}=await client.from('media_items').select('*,media_metadata(*)').eq('user_id',user.id).order('score',{ascending:false});
   if(active&&data){const next=data.map(dbToMedia);setItems(next);try{localStorage.setItem(storageKey,JSON.stringify(next))}catch{}}
   const {data:p}=await client.from('profiles').select('*').eq('id',user.id).maybeSingle();
   if(p)setProfile(p as Profile);
   else{
    const base=(user.email?.split('@')[0]||'frameuser').replace(/[^A-Za-z0-9_]/g,'').slice(0,18)||'frameuser';
    const username=base+'_'+user.id.replace(/-/g,'').slice(0,6);
    const {data:created}=await client.from('profiles').upsert({id:user.id,username,display_name:user.email?.split('@')[0]||'FRAME User',bio:''},{onConflict:'id'}).select().maybeSingle();
    if(created)setProfile(created as Profile);
   }
   const {data:prefs}=await client.from('user_preferences').select('*').eq('user_id',user.id).maybeSingle();
   if(prefs){setSortMode(String(prefs.default_sort||'rating'));setDensity(String(prefs.density||'comfortable'));setAiProvider(String(prefs.ai_provider||'frame'));const savedTheme=String(prefs.theme||'sky');setTheme((['sky','samsung','apple','oneplus','nothing','amoled','pixel','material','retro'].includes(savedTheme)?savedTheme:'sky'));setAppearanceMode((['light','dark','system'].includes(String(prefs.appearance_mode))?String(prefs.appearance_mode):'light') as 'light'|'dark'|'system')}
  };
  void load();
  return()=>{active=false};
 },[user?.id]);

 useEffect(()=>{
  const client=supabase;
  if(!client||!user?.id)return;
  const load=async()=>{
   const {data}=await client.from('connected_apps').select('provider,enabled').eq('user_id',user.id);
   if(data){const next={...connections};for(const row of data)next[String(row.provider)]=Boolean(row.enabled);setConnections(next)}
  };
  void load();
 },[user?.id]);

 const save=(list:MediaItem[])=>{
  const next=list.map(normalise);setItems(next);try{localStorage.setItem(storageKey,JSON.stringify(next))}catch{}
  const client=supabase;if(client&&user?.id)void Promise.all(next.map(item=>client.from('media_items').upsert(toRow(item,user.id),{onConflict:'id'}))).catch(()=>{});
 };
 const importItem=(raw:MediaItem)=>{
  const item=normalise(raw);
  const duplicate=items.find(x=>(item.anilistId&&x.anilistId===item.anilistId)||(item.sourceProvider&&item.externalId&&x.sourceProvider===item.sourceProvider&&x.externalId===item.externalId));
  if(duplicate){setSelected(duplicate);setFinder(false);return}
  save([item,...items]);setSelected(item);setFinder(false);
 };
 const addSteamGame=(game:{appId?:string;name:string;header?:string;storeUrl?:string})=>{
  if(!game.name.trim())return;
  importItem({id:crypto.randomUUID(),sourceProvider:'steam',externalId:game.appId,title:game.name,description:'Imported from your Steam library.',poster:game.header||'',backdrop:game.header||'',medium:'game',status:'planned',progress:0,total:100,progressUnit:'%',year:undefined,score:undefined,genres:[],themes:[],favorite:false,game:{storeUrl:game.storeUrl||undefined}});
 };
 const refreshRadar=async()=>{
  const client=supabase;if(!client||!user?.id)return;
  setRadarBusy(true);setRadarError('');
  try{const {data,error}=await client.functions.invoke('release-radar',{body:{action:'refresh'}});if(error)throw error;setRadar(Array.isArray((data as any)?.releases)?(data as any).releases:[])}
  catch(e){setRadarError(e instanceof Error?e.message:'Release Radar unavailable.')}
  finally{setRadarBusy(false)}
 };
 useEffect(()=>{if(!supabase||!user?.id)return;void refreshRadar();const timer=window.setInterval(()=>void refreshRadar(),30*60*1000);return()=>window.clearInterval(timer)},[user?.id]);
 const persist=async(key:string,value:string)=>{const client=supabase;if(client&&user?.id)await client.from('user_preferences').upsert({user_id:user.id,[key]:value,updated_at:new Date().toISOString()},{onConflict:'user_id'})};
 const updateConnection=async(id:string)=>{const enabled=!connections[id];setConnections({...connections,[id]:enabled});const client=supabase;if(client&&user?.id)await client.from('connected_apps').upsert({user_id:user.id,provider:id,enabled,config:{}},{onConflict:'user_id,provider'})};
 const shown=useMemo(()=>{
  const normalized=query.trim().toLowerCase();
  const matches=(x:MediaItem)=>{
   const text=[x.title,...(x.alternativeTitles||[]),x.medium,x.status,x.description||'',...(x.genres||[])].join(' ').toLowerCase();
   const textMatch=!normalized||text.includes(normalized);
   const filterMatch=filter==='all'||x.status===filter||x.medium===filter;
   return textMatch&&filterMatch;
  };
  return sortMedia(items,sortMode).filter(x=>{
   if(matches(x))return true;
   if(x.parentId){
    const parent=items.find(y=>y.id===x.parentId);
    return Boolean(parent&&matches(parent));
   }
   return items.some(child=>child.parentId===x.id&&matches(child));
  });
 },[items,sortMode,query,filter]);
 const go=(next:string)=>{setPage(next);setMenu(false);setSelected(null);if(next!=='friend-library')setFriendLibrary(null)};

 return <div className="frame-app">
  <header className="frame-topbar">
   <button className="frame-brand" onClick={()=>go('home')}><span>F</span><b>FRAME</b></button>
   <nav className="frame-nav">
    {[[['home','Home'],HomeIcon],[['library','Library'],Library],[['discover','Discover'],Compass],[['web','Web'],Globe],[['radar','Radar'],CalendarDays],[['ai','AI'],Bot],[['friends','Friends'],Users],[['chat','Chat'],MessageCircle],[['calls','Calls'],Phone]].map(([pair,I])=>{const[id,label]=pair as string[],Icon=I as typeof HomeIcon;return <button key={id} className={page===id?'active':''} onClick={()=>go(id)}><Icon size={16}/>{label}</button>})}
   </nav>
   <div className="frame-actions">
    <div className="global-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&setFinder(true)} placeholder="Search your library…"/></div>
    <button className="primary top-find" onClick={()=>setFinder(true)}><Search size={16}/>Search</button>
    <button className="top-icon" title="Connections" onClick={()=>go('connections')}><Link2 size={18}/></button>
    <button className="top-icon" title="Settings" onClick={()=>go('settings')}><Settings size={18}/></button>
    <button className="top-avatar" onClick={()=>go('settings')}>{(profile?.display_name||user?.email||'G')[0].toUpperCase()}</button>
    <button className="top-icon mobile-only" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button>
   </div>
  </header>
  {menu&&<div className="frame-mobile-menu">{[['home','Home'],['library','Library'],['discover','Discover'],['web','Google Search'],['radar','Release Radar'],['ai','AI'],['friends','Friends'],['chat','Global Chat'],['calls','Calls'],['connections','Connections'],['settings','Settings']].map(([id,label])=><button key={id} onClick={()=>go(id)}>{label}</button>)}</div>}
  <main className="frame-main">
   {page==='home'&&<Home items={shown} total={items.length} open={setSelected} finder={()=>setFinder(true)} go={go}/>}
   {page==='library'&&<LibraryPage items={shown} filter={filter} setFilter={setFilter} sort={sortMode} setSort={x=>{setSortMode(x);void persist('default_sort',x)}} open={setSelected} add={()=>setFinder(true)}/>}
   {page==='discover'&&<Discover finder={()=>setFinder(true)} ai={()=>go('ai')}/>} 
   {page==='web'&&<FrameWebSearch/>}
   {page==='radar'&&<RadarPage releases={radar} busy={radarBusy} error={radarError} refresh={()=>void refreshRadar()}/>}
   {page==='ai'&&<FrameAI items={items} provider={aiProvider} setProvider={x=>{setAiProvider(x);void persist('ai_provider',x)}}/>}
   {page==='friends'&&<FrameSocial uid={uid} guest={guest} onOpenLibrary={id=>{setFriendLibrary(id);setPage('friend-library')}} onCall={setDirectCall}/>}
   {page==='chat'&&<FrameGlobalChat uid={uid} guest={guest}/>} 
   {page==='calls'&&<CallsPage uid={uid} profile={profile} onCloseCall={()=>{}}/>}
   {page==='connections'&&<Connections connections={connections} toggle={updateConnection} onImportSteamGame={addSteamGame}/>}
   {page==='settings'&&<SettingsPage user={user} profile={profile} setProfile={setProfile} guest={guest} density={density} setDensity={x=>{setDensity(x);void persist('density',x)}} theme={theme} setTheme={x=>{setTheme(x);void persist('theme',x)}} appearanceMode={appearanceMode} setAppearanceMode={x=>{setAppearanceMode(x);void persist('appearance_mode',x)}}/>}
   {page==='friend-library'&&friendLibrary&&<FriendLibrary id={friendLibrary} onBack={()=>go('friends')}/>}
  </main>
  <nav className="mobile-bottom">
   {[[['home','Home'],HomeIcon],[['library','Library'],Library],[['search','Search'],Search],[['chat','Chat'],MessageCircle],[['friends','Friends'],Users],[['settings','Settings'],Settings]].map(([pair,I])=>{const[id,label]=pair as string[],Icon=I as typeof Search;return <button key={id} className={page===id?'active':''} onClick={()=>id==='search'?setFinder(true):go(id)}><Icon size={19}/><span>{label}</span></button>})}
  </nav>
  {selected&&<FrameDetail item={selected} library={items} close={()=>setSelected(null)} save={x=>save(items.map(i=>i.id===x.id?x:i))}/>}
  {finder&&<AniListSearch initialQuery={query} close={()=>setFinder(false)} onImported={importItem} onManual={()=>setFinder(false)} onAi={()=>{setFinder(false);go('ai')}}/>}
  {!guest&&<FrameDirectCall uid={uid} target={directCall} onClear={()=>setDirectCall(null)}/>} 
  <FramePopupHub uid={uid} onFind={()=>setFinder(true)} onOpenCalls={()=>go('calls')} onCall={setDirectCall}/>
 </div>;
}

function Home({items,total,open,finder,go}:{items:MediaItem[];total:number;open:(x:MediaItem)=>void;finder:()=>void;go:(x:string)=>void}){
 const stats=[items.length,items.filter(x=>['watching','reading','playing'].includes(x.status)).length,items.filter(x=>x.status==='completed').length,items.filter(x=>x.favorite).length];
 return <div className="page">
  <section className="search-hero"><div className="search-hero-copy"><small>PERSONAL MEDIA LIBRARY</small><h1>Your universe.<br/><em>Your rules.</em></h1><p>Search every supported catalogue, track any medium with an editable total, rate everything yourself and use AI when you need it.</p></div><button className="universal-search-box" onClick={finder}><Search size={21}/><span>Search anime, manga, manhwa, novels, visual novels, games, movies, series, books…</span><kbd>ENTER</kbd></button></section>
  <section className="stat-strip"><Stat value={stats[0]} label="In library"/><Stat value={stats[1]} label="In progress"/><Stat value={stats[2]} label="Completed"/><Stat value={stats[3]} label="Favorites"/></section>
  <section className="quick-panel"><div><small>FRAME</small><h2>{total?total+' titles in your universe':'Build your universe'}</h2></div><div className="quick-actions"><button onClick={()=>go('library')}><Library size={15}/>Library</button><button onClick={()=>go('discover')}><Compass size={15}/>Discover</button><button onClick={()=>go('ai')}><Bot size={15}/>AI</button></div></section>
  <section className="library-section"><div className="section-title"><div><small>UNIVERSAL RANKING</small><h2>Your media</h2></div><span>{items.length} shown · rating first</span></div><div className="media-grid">{items.map(x=><Card key={x.id} item={x} open={open}/>)}</div>{!items.length&&<Empty text="Search a catalogue above to start building your library."/ >}</section>
 </div>;
}
function Stat({value,label}:{value:number;label:string}){return <div className="stat-card"><b>{value}</b><span>{label}</span></div>}
function Card({item,open}:{item:MediaItem;open:(x:MediaItem)=>void}){
 const pct=item.medium==='game'||item.medium==='visual-novel'?item.progress:item.progress/(item.total||1)*100;
 return <button className="media-card" onClick={()=>open(item)}><div className="media-poster"><img src={item.poster||poster} alt="" loading="lazy"/><span className="medium-pill">{types[item.medium]}</span><span className="score-pill"><Star size={10} fill="currentColor"/>{item.score==null?'—':item.score.toFixed(1)}</span></div><div className="media-copy"><b>{item.title}</b><small>{item.status==='completed'?'Completed':item.progress+' / '+(item.total||500)} {item.progressUnit||unitFor(item.medium)}</small><div className="card-progress"><i style={{width:Math.min(100,Math.max(0,pct))+'%'}}/></div><span className="personal-line">{item.personalRating!=null?'Your '+item.personalRating.toFixed(1):'Rate it yourself'}</span></div></button>;
}

function LibraryPage({items,filter,setFilter,sort,setSort,open,add}:{items:MediaItem[];filter:string;setFilter:(x:string)=>void;sort:string;setSort:(x:string)=>void;open:(x:MediaItem)=>void;add:()=>void}){
 const fs:[string,string][]=[['all','All'],['watching','Watching'],['reading','Reading'],['playing','Playing'],['completed','Completed'],['planned','Planned'],['paused','Paused'],['dropped','Dropped'],...Object.entries(types)];
 return <div className="page"><div className="page-heading"><div><small>YOUR COLLECTION</small><h1>Library</h1><p>Every media type is equal. Sort by rating, your rating, progress, newest or title.</p></div><button className="primary" onClick={add}><CirclePlus size={17}/>Add media</button></div><div className="library-controls"><div className="filter-scroll">{fs.map(([id,label])=><button className={filter===id?'active':''} key={id} onClick={()=>setFilter(id)}>{label}</button>)}</div><label className="sort-select"><span>Sort</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="rating">Rating</option><option value="personal">My rating</option><option value="recent">Newest</option><option value="progress">Progress</option><option value="title">Title</option></select></label></div><div className="media-grid">{items.map(x=><Card key={x.id} item={x} open={open}/>)}</div>{!items.length&&<Empty text="Nothing matches these filters."/ >}</div>;
}
function Discover({finder,ai}:{finder:()=>void;ai:()=>void}){return <div className="page"><div className="page-heading"><div><small>UNIVERSAL DISCOVERY</small><h1>Explore everything.</h1><p>One consistent interface for media, metadata, availability, AI and connected services.</p></div></div><div className="feature-grid"><button className="feature-card" onClick={finder}><Search size={22}/><h3>Universal search</h3><p>AniList, Steam, TVMaze, VNDB, Open Library and more.</p><ChevronRight/></button><button className="feature-card" onClick={ai}><Bot size={22}/><h3>AI search</h3><p>Describe a story, mood, genre or similarity in plain language.</p><ChevronRight/></button><div className="feature-card"><ExternalLink size={22}/><h3>Where to find it</h3><p>Open legal watch, read, play and buying destinations.</p></div><div className="feature-card"><Link2 size={22}/><h3>Connections</h3><p>Control the catalogues and services FRAME uses.</p></div></div></div>}
function RadarPage({releases,busy,error,refresh}:{releases:Radar[];busy:boolean;error:string;refresh:()=>void}){const up=releases.filter(x=>!x.released).sort((a,b)=>Date.parse(a.airingAt)-Date.parse(b.airingAt));return <div className="page"><div className="page-heading"><div><small>RELEASE INTELLIGENCE</small><h1>Release Radar</h1><p>Upcoming releases for tracked AniList titles.</p></div><button className="secondary" disabled={busy} onClick={refresh}>{busy?<RefreshCw className="spin"/>:<RefreshCw/>}Refresh</button></div>{error&&<div className="inline-error">{error}</div>}<section className="radar-panel"><div className="section-title"><div><small>UP NEXT</small><h2>Upcoming</h2></div><span>{up.length}</span></div>{up.length?<div className="release-list">{up.slice(0,30).map(x=><div key={x.anilistId+'-'+x.episode}><img src={x.poster||poster} alt=""/><section><b>{x.title}</b><small>Episode {x.episode}</small><span>{new Date(x.airingAt).toLocaleString()}</span></section></div>)}</div>:<Empty text="No upcoming tracked releases."/ >}</section></div>}

function Connections({connections,toggle:_toggle,onImportSteamGame}:{connections:Record<string,boolean>;toggle:(id:string)=>void;onImportSteamGame:(game:{appId?:string;name:string;header?:string;storeUrl?:string})=>void}){
 const [linkMessage,setLinkMessage]=useState('');
 const [steamId,setSteamId]=useState('');
 const [steamGames,setSteamGames]=useState<Array<{appId:string;name:string;playtimeMinutes:number;header?:string;storeUrl?:string}>>([]);
 const [identityProviders,setIdentityProviders]=useState<string[]>([]);
 const {user}=useAuth();
 useEffect(()=>{setIdentityProviders((user?.identities||[]).map(x=>String(x.provider)))},[user?.id,user?.identities?.length]);
 useEffect(()=>{
  if(!supabase||!user?.id)return;
  void (async()=>{
   const {data}=await supabase.from('connected_apps').select('config').eq('user_id',user.id).eq('provider','steam').maybeSingle();
   const value=data?.config&&typeof data.config==='object'?(data.config as {steamId?:unknown}).steamId:undefined;
   if(typeof value==='string'&&value.trim()){setSteamId(value);localStorage.setItem('frame-steam-id:'+user.id,value)}
   else setSteamId(localStorage.getItem('frame-steam-id:'+user.id)||'');
  })();
 },[user?.id]);
 const socialConnect=async(provider:'spotify'|'discord')=>{
  const client=supabase;if(!client||!user){setLinkMessage('Log in to connect external accounts.');return}
  setLinkMessage('');
  try{
   const scopes=provider==='spotify'?'user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-private':'identify email';
   const {error}=await client.auth.linkIdentity({provider,options:{redirectTo:window.location.origin,scopes}} as any);
   if(error)throw error;
  }catch(e){setLinkMessage(e instanceof Error?e.message:'That connection could not be started.')}
 };
 const disconnect=async(provider:string)=>{
  const client=supabase;if(!client||!user)return;
  const identity=(user.identities||[]).find(x=>x.provider===provider);
  if(!identity){return}
  const {error}=await client.auth.unlinkIdentity(identity);
  if(error)setLinkMessage(error.message);
  else setIdentityProviders((user.identities||[]).filter(x=>x.provider!==provider).map(x=>String(x.provider)));
 };
 const syncSteam=async()=>{
  const client=supabase;if(!client||!user){setLinkMessage('Log in to sync your Steam library.');return}
  if(!steamId.trim()){setLinkMessage('Enter your SteamID64 or public profile identifier first.');return}
  setLinkMessage('');
  const {data,error}=await client.functions.invoke('steam-library',{body:{steamId:steamId.trim()}});
  if(error){setLinkMessage(error.message);return}
  const games=((data as {games?:Array<{appId:string;name:string;playtimeMinutes:number;header?:string;storeUrl?:string}>})?.games||[]);
  localStorage.setItem('frame-steam-id:'+user.id,steamId.trim());setSteamGames(games);
  setLinkMessage(games.length+' Steam games synced.');
  await client.from('connected_apps').upsert({user_id:user.id,provider:'steam',enabled:true,config:{steamId:steamId.trim()}},{onConflict:'user_id,provider'});
 };
 const catalogueRows=[
  ['AniList','Anime, manga, manhwa and light novels'],['TVMaze','Series and episode metadata'],['VNDB','Visual novels'],['Open Library','Books and novels'],['Steam Store','Game discovery and store metadata'],['Wikipedia','Movie discovery']
 ] as const;
 return <div className="page">
  <div className="page-heading"><div><small>SERVICE CONTROL</small><h1>Connections</h1><p>Keep catalogues, account identities and media libraries connected without mixing credentials into the browser.</p></div></div>
  <section className="connections-section"><div className="connections-section-head"><div><small>BUILT-IN CATALOGUES</small><h2>Ready to use</h2></div><span>{catalogueRows.length} sources</span></div><div className="connections-grid">{catalogueRows.map(([name,description])=><div className="connection-card" key={name}><div className="connection-icon"><Link2 size={19}/></div><div><b>{name}</b><p>{description}</p><small>Built in · no account connection</small></div><span className="connection-status built-in">Available</span></div>)}</div></section>

  <section className="connections-section"><div className="connections-section-head"><div><small>ACCOUNT CONNECTIONS</small><h2>Your services</h2></div><span>Secure OAuth / server sync</span></div><div className="connections-grid">
   {(['spotify','discord'] as const).map(provider=>{
    const name=provider[0].toUpperCase()+provider.slice(1),connected=identityProviders.includes(provider);
    return <div className="connection-card" key={provider}><div className="connection-icon"><Link2 size={19}/></div><div><b>{name}</b><p>{provider==='spotify'?'Link Spotify for identity, music-aware features and optional playback controls. Playback control requires the Spotify permissions and Premium requirements.':'Link Discord for identity, friend/community workflows and future presence features.'}</p><small>{connected?'OAuth · connected':'OAuth · not connected'}</small></div>{connected?<button className="secondary" onClick={()=>void disconnect(provider)}>Disconnect</button>:<button className="secondary" onClick={()=>void socialConnect(provider)}>Connect</button>}</div>;
   })}
   <div className="connection-card"><div className="connection-icon"><Gamepad2 size={19}/></div><div><b>Steam account</b><p>Import your owned games and use FRAME as the tracking layer for your Steam library.</p><small>{steamGames.length?'Synced '+steamGames.length+' games':'Not synced'} · server-side Web API</small></div><div className="call-form"><input value={steamId} onChange={e=>setSteamId(e.target.value)} placeholder="SteamID64 / public profile ID"/><button className="secondary" onClick={()=>void syncSteam()}>Sync Steam</button></div></div>
  </div></section>

  {linkMessage&&<div className="inline-error" style={{marginTop:12}}>{linkMessage}</div>}
  <FrameSpotifyControls connected={identityProviders.includes('spotify')} />
  {steamGames.length>0&&<section className="calls-panel" style={{marginTop:14}}><div className="section-title"><div><small>STEAM LIBRARY</small><h2>Import and play</h2></div><span>{steamGames.length} synced</span></div><div className="media-grid">{steamGames.slice(0,30).map(g=><div key={g.appId} className="media-card steam-library-card"><div className="media-poster"><img src={g.header||''} alt="" loading="lazy"/></div><div className="media-copy"><b>{g.name}</b><small>{Math.round(g.playtimeMinutes/60)}h played</small><div className="steam-actions"><button className="secondary" onClick={()=>onImportSteamGame(g)}>Add to FRAME</button><a className="secondary" href={'steam://run/'+g.appId}>Play</a><a className="secondary" href={g.storeUrl||'#'} target="_blank" rel="noreferrer">Store</a></div></div></div>)}</div></section>}

  <section className="connections-section"><div className="connections-section-head"><div><small>AI CONNECTIONS</small><h2>Secure providers</h2></div><span>Browser never holds provider secrets</span></div><div className="connections-grid ai-provider-grid">
   <div className="connection-card"><div className="connection-icon"><Bot size={19}/></div><div><b>FRAME AI</b><p>Built-in library-aware assistant routed through the secure server function.</p><small>Built in · ready</small></div><span className="connection-status built-in">Ready</span></div>
   {['OpenAI','Gemini','Claude'].map(name=><div className="connection-card" key={name}><div className="connection-icon"><Bot size={19}/></div><div><b>{name}</b><p>Optional server-side provider. Configure its secret only on the backend before enabling it.</p><small>Server connector · not configured</small></div><span className="connection-status not-configured">Not configured</span></div>)}
  </div></section>
 </div>;
}

function SettingsPage({user,profile,setProfile,guest,density,setDensity,theme,setTheme,appearanceMode,setAppearanceMode}:{user:any;profile:Profile|null;setProfile:(p:Profile)=>void;guest:boolean;density:string;setDensity:(x:string)=>void;theme:string;setTheme:(x:string)=>void;appearanceMode:'light'|'dark'|'system';setAppearanceMode:(x:'light'|'dark'|'system')=>void}){
 const[name,setName]=useState(profile?.display_name||''),[username,setUsername]=useState(profile?.username||''),[saved,setSaved]=useState(false);
 useEffect(()=>{setName(profile?.display_name||'');setUsername(profile?.username||'')},[profile?.id,profile?.display_name,profile?.username]);
 const save=async()=>{const client=supabase;if(!client||!user?.id)return;const clean=username.trim();if(clean.length<3)return;const p={id:user.id,username:clean,display_name:name.trim()||clean,avatar_url:profile?.avatar_url||null,bio:profile?.bio||''};const {error}=await client.from('profiles').upsert(p,{onConflict:'id'});if(!error){setProfile(p);setSaved(true);setTimeout(()=>setSaved(false),1400)}};
 const themes=[['sky','Sky','Blue sky · FRAME'],['samsung','Samsung appearance','One UI · soft panels'],['apple','Apple','Minimal · glassy'],['oneplus','OnePlus','Bold · fast · warm'],['nothing','Nothing','Dot-matrix · industrial'],['amoled','AMOLED','Pure black · OLED'],['pixel','Pixel','Material You · clean'],['material','Material','Cards · expressive'],['retro','Retro','Classic desktop · playful']] as const;
 return <div className="page"><div className="page-heading"><div><small>YOUR FRAME</small><h1>Settings</h1><p>Profile, appearance, account connections and privacy controls. Appearance never changes library data.</p></div></div>
  <section className="settings-grid">
   <div className="settings-panel"><div className="section-title"><div><small>PROFILE</small><h2>Identity</h2></div></div>{guest?<p className="muted">Guest mode stays local to this device.</p>:<><label>Username<input value={username} onChange={e=>setUsername(e.target.value.replace(/[^A-Za-z0-9_]/g,''))}/></label><label>Display name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Email<input value={user?.email||''} disabled/></label><button className="primary" onClick={()=>void save()}>{saved?'Saved':'Save profile'}</button></>}</div>
   <div className="settings-panel appearance-panel"><div className="section-title"><div><small>APPEARANCE</small><h2>Appearance</h2></div></div>
    <div className="appearance-control"><b>Theme</b><span>Choose the visual language. Your media stays exactly where it is.</span><div className="theme-picker">{themes.map(([id,label,sub])=><button key={id} className={'theme-choice '+(theme===id?'selected':'')} onClick={()=>setTheme(id)}><i className={'theme-preview '+id}><span/></i><strong>{label}</strong><small>{sub}</small></button>)}</div></div>
    <div className="appearance-control"><b>Appearance mode</b><span>Light, dark or follow your device.</span><div className="segmented-control">{(['light','dark','system'] as const).map(mode=><button key={mode} className={appearanceMode===mode?'active':''} onClick={()=>setAppearanceMode(mode)}>{mode[0].toUpperCase()+mode.slice(1)}</button>)}</div></div>
    <div className="setting-row compact-row"><span>Card density<small>Control how much media fits on screen.</small></span><select value={density} onChange={e=>setDensity(e.target.value)}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select></div>
    <div className="appearance-live"><span>Live preview</span><div><b>Sky / Dark / Apple / Nothing</b><small>Every page, chat and call overlay follows these settings.</small></div></div>
   </div>
   <div className="settings-panel"><div className="section-title"><div><small>ACCOUNT</small><h2>Security</h2></div></div><button className="danger" onClick={()=>void signOut()}><LogOut size={16}/>Log out</button><p className="muted">Forgot-password recovery is available at the FRAME entrance.</p></div>
  </section>
 </div>;
}
function FriendLibrary({id,onBack}:{id:string;onBack:()=>void}){
 const[items,setItems]=useState<MediaItem[]>([]);
 useEffect(()=>{if(!supabase)return;void(async()=>{const client=supabase;if(!client)return;const {data}=await client.from('media_items').select('*,media_metadata(*)').eq('user_id',id).order('score',{ascending:false});setItems((data||[]).map(dbToMedia))})()},[id]);
 return <div className="page"><button className="breadcrumb" onClick={onBack}>← Back to friends</button><div className="page-heading"><div><small>PERMISSION GRANTED</small><h1>Shared library</h1><p>This library is visible because your friend explicitly allowed access.</p></div></div><div className="media-grid">{items.map(x=><Card key={x.id} item={x} open={()=>{}}/>)}</div>{!items.length&&<Empty text="Nothing has been shared yet."/ >}</div>;
}
function Empty({text}:{text:string}){return <div className="empty-state"><Library size={25}/><p>{text}</p></div>}

import {useEffect,useMemo,useState} from 'react';
import {Bot,CalendarDays,ChevronRight,CirclePlus,Compass,ExternalLink,Home as HomeIcon,Library,Link2,LogOut,Menu,RefreshCw,Search,Settings,Star,Users,X} from 'lucide-react';
import {signOut,useAuth} from './auth/Auth';
import type {MediaItem,Medium} from './types';
import {AniListSearch} from './components/AniListSearch';
import {FrameAI} from './components/FrameAI';
import {FrameDetail} from './components/FrameDetail';
import {FrameSocial,VoiceCall} from './components/FrameSocial';
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
 return {id:item.id,user_id:userId,parent_id:item.parentId??null,metadata_id:item.metadataId??null,anilist_id:item.anilistId??null,title:item.title,description:item.description,poster:item.poster,backdrop:item.backdrop,medium:item.medium,status:item.status,progress:item.progress,total:item.total??500,year:item.year??null,score:item.score??null,genres:item.genres,themes:item.themes,studio:item.studio??null,source:item.source??null,favorite:item.favorite,notes:item.notes??null,data:{provider:item.sourceProvider??null,externalId:item.externalId??null,personalRating:item.personalRating??null,progressUnit:item.progressUnit??unitFor(item.medium),customTotal:item.customTotal??item.total??null,availability:item.availability??null,game:item.game??null}};
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
 const [items,setItems]=useState<MediaItem[]>(()=>{
  try{const raw=JSON.parse(localStorage.getItem('frame-library')||'null');return(raw||[]).map(normalise)}catch{return[]}
 });
 const [page,setPage]=useState('home'),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[sortMode,setSortMode]=useState('rating');
 const [finder,setFinder]=useState(false),[selected,setSelected]=useState<MediaItem|null>(null),[menu,setMenu]=useState(false),[profile,setProfile]=useState<Profile|null>(null);
 const [call,setCall]=useState<Profile|null>(null),[friendLibrary,setFriendLibrary]=useState<string|null>(null);
 const [radar,setRadar]=useState<Radar[]>([]),[radarBusy,setRadarBusy]=useState(false),[radarError,setRadarError]=useState('');
 const [aiProvider,setAiProvider]=useState('frame'),[density,setDensity]=useState('comfortable');
 const [connections,setConnections]=useState<Record<string,boolean>>({anilist:true,steam:true,tvmaze:true,vndb:true,openlibrary:true,imdb:true,justwatch:true});

 useEffect(()=>{document.documentElement.dataset.density=density},[density]);

 useEffect(()=>{
  const client=supabase;
  if(!client||!user?.id)return;
  let active=true;
  const load=async()=>{
   const {data}=await client.from('media_items').select('*,media_metadata(*)').eq('user_id',user.id).order('score',{ascending:false});
   if(active&&data){const next=data.map(dbToMedia);setItems(next);try{localStorage.setItem('frame-library',JSON.stringify(next))}catch{}}
   const {data:p}=await client.from('profiles').select('*').eq('id',user.id).maybeSingle();
   if(p)setProfile(p as Profile);
   else{
    const base=(user.email?.split('@')[0]||'frameuser').replace(/[^A-Za-z0-9_]/g,'').slice(0,18)||'frameuser';
    const username=base+'_'+user.id.replace(/-/g,'').slice(0,6);
    const {data:created}=await client.from('profiles').upsert({id:user.id,username,display_name:user.email?.split('@')[0]||'FRAME User',bio:''},{onConflict:'id'}).select().maybeSingle();
    if(created)setProfile(created as Profile);
   }
   const {data:prefs}=await client.from('user_preferences').select('*').eq('user_id',user.id).maybeSingle();
   if(prefs){setSortMode(String(prefs.default_sort||'rating'));setDensity(String(prefs.density||'comfortable'));setAiProvider(String(prefs.ai_provider||'frame'))}
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
  const next=list.map(normalise);setItems(next);try{localStorage.setItem('frame-library',JSON.stringify(next))}catch{}
  const client=supabase;if(client&&user?.id)void Promise.all(next.map(item=>client.from('media_items').upsert(toRow(item,user.id),{onConflict:'id'}))).catch(()=>{});
 };
 const importItem=(raw:MediaItem)=>{
  const item=normalise(raw);
  const duplicate=items.find(x=>(item.anilistId&&x.anilistId===item.anilistId)||(item.sourceProvider&&item.externalId&&x.sourceProvider===item.sourceProvider&&x.externalId===item.externalId));
  if(duplicate){setSelected(duplicate);setFinder(false);return}
  save([item,...items]);setSelected(item);setFinder(false);
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
 const shown=useMemo(()=>sortMedia(items,sortMode).filter(x=>x.title.toLowerCase().includes(query.toLowerCase())&&(filter==='all'||x.status===filter||x.medium===filter)),[items,sortMode,query,filter]);
 const go=(next:string)=>{setPage(next);setMenu(false);setSelected(null);if(next!=='friend-library')setFriendLibrary(null)};

 return <div className="frame-app">
  <header className="frame-topbar">
   <button className="frame-brand" onClick={()=>go('home')}><span>F</span><b>FRAME</b></button>
   <nav className="frame-nav">
    {[[['home','Home'],HomeIcon],[['library','Library'],Library],[['discover','Discover'],Compass],[['radar','Radar'],CalendarDays],[['ai','AI'],Bot],[['friends','Friends'],Users]].map(([pair,I])=>{const[id,label]=pair as string[],Icon=I as typeof HomeIcon;return <button key={id} className={page===id?'active':''} onClick={()=>go(id)}><Icon size={16}/>{label}</button>})}
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
  {menu&&<div className="frame-mobile-menu">{[['home','Home'],['library','Library'],['discover','Discover'],['radar','Release Radar'],['ai','AI'],['friends','Friends'],['connections','Connections'],['settings','Settings']].map(([id,label])=><button key={id} onClick={()=>go(id)}>{label}</button>)}</div>}
  <main className="frame-main">
   {page==='home'&&<Home items={shown} total={items.length} open={setSelected} finder={()=>setFinder(true)} go={go}/>}
   {page==='library'&&<LibraryPage items={shown} filter={filter} setFilter={setFilter} sort={sortMode} setSort={x=>{setSortMode(x);void persist('default_sort',x)}} open={setSelected} add={()=>setFinder(true)}/>}
   {page==='discover'&&<Discover finder={()=>setFinder(true)} ai={()=>go('ai')}/>}
   {page==='radar'&&<RadarPage releases={radar} busy={radarBusy} error={radarError} refresh={()=>void refreshRadar()}/>}
   {page==='ai'&&<FrameAI items={items} provider={aiProvider} setProvider={x=>{setAiProvider(x);void persist('ai_provider',x)}}/>}
   {page==='friends'&&<FrameSocial uid={uid} guest={guest} onOpenLibrary={id=>{setFriendLibrary(id);setPage('friend-library')}} onCall={setCall}/>}
   {page==='connections'&&<Connections connections={connections} toggle={updateConnection}/>}
   {page==='settings'&&<SettingsPage user={user} profile={profile} setProfile={setProfile} guest={guest} density={density} setDensity={x=>{setDensity(x);void persist('density',x)}}/>}
   {page==='friend-library'&&friendLibrary&&<FriendLibrary id={friendLibrary} onBack={()=>go('friends')}/>}
  </main>
  <nav className="mobile-bottom">
   {[[['home','Home'],HomeIcon],[['library','Library'],Library],[['search','Search'],Search],[['friends','Friends'],Users],[['settings','Settings'],Settings]].map(([pair,I])=>{const[id,label]=pair as string[],Icon=I as typeof Search;return <button key={id} className={page===id?'active':''} onClick={()=>id==='search'?setFinder(true):go(id)}><Icon size={19}/><span>{label}</span></button>})}
  </nav>
  {selected&&<FrameDetail item={selected} library={items} close={()=>setSelected(null)} save={x=>save(items.map(i=>i.id===x.id?x:i))}/>}
  {finder&&<AniListSearch close={()=>setFinder(false)} onImported={importItem} onManual={()=>setFinder(false)}/>}
  {call&&<VoiceCall uid={uid} friend={call} close={()=>setCall(null)}/>}
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

function Connections({connections,toggle}:{connections:Record<string,boolean>;toggle:(id:string)=>void}){
 const rows=[['anilist','AniList','Anime, manga and light novels','Built-in'],['steam','Steam','Games, platforms, prices and free status','Built-in'],['tvmaze','TVMaze','Series and episode data','Built-in'],['vndb','VNDB','Visual novels','Built-in'],['openlibrary','Open Library','Books and novels','Built-in'],['imdb','IMDb search','Web title discovery','Search'],['justwatch','JustWatch','Legal watch/buy discovery','Search']];
 return <div className="page"><div className="page-heading"><div><small>SERVICE CONTROL</small><h1>Connections</h1><p>Choose which catalogues and services FRAME is allowed to use.</p></div></div><div className="connections-grid">{rows.map(r=><div className="connection-card" key={r[0]}><div className="connection-icon"><Link2 size={19}/></div><div><b>{r[1]}</b><p>{r[2]}</p><small>{r[3]}</small></div><button className={connections[r[0]]?'secondary active':'secondary'} onClick={()=>toggle(r[0])}>{connections[r[0]]?'Enabled':'Disabled'}</button></div>)}</div><section className="ai-connect-card"><Bot size={22}/><div><h2>AI providers</h2><p>FRAME AI is wired into this build. Other provider slots can be connected later without exposing keys in the browser.</p></div></section></div>;
}

function SettingsPage({user,profile,setProfile,guest,density,setDensity}:{user:any;profile:Profile|null;setProfile:(p:Profile)=>void;guest:boolean;density:string;setDensity:(x:string)=>void}){
 const[name,setName]=useState(profile?.display_name||''),[username,setUsername]=useState(profile?.username||''),[saved,setSaved]=useState(false);
 useEffect(()=>{setName(profile?.display_name||'');setUsername(profile?.username||'')},[profile?.id,profile?.display_name,profile?.username]);
 const save=async()=>{if(!supabase||!user?.id)return;const clean=username.trim();if(clean.length<3)return;const p={id:user.id,username:clean,display_name:name.trim()||clean,avatar_url:profile?.avatar_url||null,bio:profile?.bio||''};const {error}=await client.from('profiles').upsert(p,{onConflict:'id'});if(!error){setProfile(p);setSaved(true);setTimeout(()=>setSaved(false),1400)}};
 return <div className="page"><div className="page-heading"><div><small>YOUR FRAME</small><h1>Settings</h1><p>Profile, appearance and account controls.</p></div></div><section className="settings-grid"><div className="settings-panel"><div className="section-title"><div><small>PROFILE</small><h2>Identity</h2></div></div>{guest?<p className="muted">Guest mode stays local to this device.</p>:<><label>Username<input value={username} onChange={e=>setUsername(e.target.value.replace(/[^A-Za-z0-9_]/g,''))}/></label><label>Display name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Email<input value={user?.email||''} disabled/></label><button className="primary" onClick={()=>void save()}>{saved?'Saved':'Save profile'}</button></>}</div><div className="settings-panel"><div className="section-title"><div><small>APPEARANCE</small><h2>Samsung-style</h2></div></div><div className="setting-row"><span>Card density<small>Control how much media fits on screen.</small></span><select value={density} onChange={e=>setDensity(e.target.value)}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select></div><div className="setting-row"><span>Theme<small>Premium dark glass is the current FRAME theme.</small></span><b>Dark</b></div></div><div className="settings-panel"><div className="section-title"><div><small>ACCOUNT</small><h2>Security</h2></div></div><button className="danger" onClick={()=>void signOut()}><LogOut size={16}/>Log out</button><p className="muted">Forgot-password recovery is available at the FRAME entrance.</p></div></section></div>;
}
function FriendLibrary({id,onBack}:{id:string;onBack:()=>void}){
 const[items,setItems]=useState<MediaItem[]>([]);
 useEffect(()=>{if(!supabase)return;void(async()=>{const client=supabase;if(!client)return;const {data}=await client.from('media_items').select('*,media_metadata(*)').eq('user_id',id).order('score',{ascending:false});setItems((data||[]).map(dbToMedia))})()},[id]);
 return <div className="page"><button className="breadcrumb" onClick={onBack}>← Back to friends</button><div className="page-heading"><div><small>PERMISSION GRANTED</small><h1>Shared library</h1><p>This library is visible because your friend explicitly allowed access.</p></div></div><div className="media-grid">{items.map(x=><Card key={x.id} item={x} open={()=>{}}/>)}</div>{!items.length&&<Empty text="Nothing has been shared yet."/ >}</div>;
}
function Empty({text}:{text:string}){return <div className="empty-state"><Library size={25}/><p>{text}</p></div>}

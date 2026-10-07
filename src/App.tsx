import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {
  AlertCircle,ArrowLeft,BookOpen,Bot,CalendarDays,Check,ChevronRight,CirclePlus,Compass,Film,Gamepad2,
  Heart,Home as HomeIcon,Library,Link2,LogOut,Menu,MessageCircle,Mic,MicOff,Phone,PhoneOff,Play,
  RefreshCw,Search,Send,Settings,Shield,SlidersHorizontal,Star,Tv,UserPlus,Users,Volume2,VolumeX,X,ExternalLink
} from 'lucide-react';
import {signOut,useAuth} from './auth/Auth';
import type {MediaItem,Medium,Status} from './types';
import {AniListSearch} from './components/AniListSearch';
import {supabase} from './lib/supabase';

const FALLBACK_POSTER='https://cdn.myanimelist.net/images/anime/10/47347.jpg';
const mediaTypes:Record<Medium,string>={
 anime:'Anime',manga:'Manga',manhwa:'Manhwa','light-novel':'Light Novel',
 'visual-novel':'Visual Novel',movie:'Movie',series:'Series',game:'Game',book:'Book'
};
const units:Record<Medium,string>={
 anime:'episodes',manga:'chapters',manhwa:'chapters','light-novel':'chapters',
 'visual-novel':'% complete',movie:'watch state',series:'episodes',game:'% complete',book:'pages'
};
const labels:Record<Status,string>={
 watching:'Watching',reading:'Reading',playing:'Playing',completed:'Completed',
 planned:'Planned',paused:'Paused',dropped:'Dropped'
};
const statusForMedium=(m:Medium):Status=>m==='game'?'playing':(['manga','manhwa','light-novel','book'].includes(m)?'reading':'watching');

type Profile={id:string;username:string;display_name:string;avatar_url?:string|null;bio?:string};
type Friendship={id:string;requester_id:string;addressee_id:string;status:string;created_at:string};
type FriendMessage={id:string;sender_id:string;recipient_id:string;body:string;created_at:string};
type Permission={id:string;owner_id:string;viewer_id:string;status:string};
type RadarRelease={mediaId:string;anilistId:number;title:string;poster:string;episode:number;airingAt:string;released:boolean;status:'released'|'scheduled'};

const fallbackItems:MediaItem[]=[
 {id:'aot',title:'Attack on Titan',description:'A complete franchise entry with seasons, parts and specials.',poster:FALLBACK_POSTER,backdrop:'',status:'completed',progress:89,total:89,year:2013,score:9.2,genres:['Action','Dark Fantasy','Mystery'],themes:[],medium:'anime',favorite:true,personalRating:10,progressUnit:'episodes'},
 {id:'sg',title:'Steins;Gate',description:'A fully watched classic tracked as the parent entry for related releases.',poster:FALLBACK_POSTER,backdrop:'',status:'completed',progress:24,total:24,year:2011,score:9.1,genres:['Sci-Fi','Thriller','Drama'],themes:[],medium:'anime',favorite:true,personalRating:10,progressUnit:'episodes'},
 {id:'mushoku',title:'Mushoku Tensei',description:'Your current watch list entry.',poster:FALLBACK_POSTER,backdrop:'',status:'watching',progress:24,total:24,year:2021,score:8.7,genres:['Adventure','Fantasy'],themes:[],medium:'anime',favorite:false,progressUnit:'episodes'},
 {id:'gta3',title:'Grand Theft Auto III',description:'Classic open-world game set in Liberty City.',poster:'https://upload.wikimedia.org/wikipedia/en/8/8f/GTA3boxcover.jpg',backdrop:'',status:'planned',progress:0,total:100,year:2001,score:8.5,genres:['Action','Adventure','Open World'],themes:['Single-player'],medium:'game',favorite:false,progressUnit:'%',game:{developer:'DMA Design / Rockstar North',publisher:'Rockstar Games',releaseDate:'2001-10-22',platforms:['PC','PlayStation 2','Xbox','Mac'],gameModes:['Single-player'],storyProgress:0,completionProgress:0,isFree:false,storeUrl:'https://store.steampowered.com/search/?term=Grand%20Theft%20Auto%20III'}}
];

function dbRowToMedia(row:unknown):MediaItem{
 const r=row as Record<string,unknown>;
 const meta=(r.media_metadata&&typeof r.media_metadata==='object'?r.media_metadata:{}) as Record<string,unknown>;
 const raw=(r.data&&typeof r.data==='object'?r.data:{}) as Record<string,unknown>;
 const value=(k:string)=>meta[k]??r[k];
 return {
  id:String(r.id),parentId:r.parent_id?String(r.parent_id):undefined,metadataId:r.metadata_id?String(r.metadata_id):undefined,
  anilistId:r.anilist_id==null?undefined:Number(r.anilist_id),
  sourceProvider:raw.provider?String(raw.provider):(r.anilist_id?'anilist':undefined),
  externalId:raw.externalId?String(raw.externalId):(r.anilist_id?String(r.anilist_id):undefined),
  title:String(value('title')??''),alternativeTitles:Array.isArray(meta.alternative_titles)?meta.alternative_titles.map(String):[],
  description:String(value('description')??''),poster:String(value('poster')??''),backdrop:String(value('backdrop')??''),
  medium:String(r.medium) as Medium,status:String(r.status) as Status,progress:Number(r.progress??0),
  total:value('episodes')==null?(r.total==null?undefined:Number(r.total)):Number(value('episodes')),
  year:value('year')==null?undefined:Number(value('year')),score:value('score')==null?undefined:Number(value('score')),
  personalRating:raw.personalRating==null?undefined:Number(raw.personalRating),
  progressUnit:raw.progressUnit?String(raw.progressUnit):units[String(r.medium) as Medium],
  customTotal:raw.customTotal==null?undefined:Number(raw.customTotal),
  genres:Array.isArray(value('genres'))?(value('genres') as unknown[]).map(String):[],
  themes:Array.isArray(value('themes'))?(value('themes') as unknown[]).map(String):[],
  studio:value('studio')?String(value('studio')):undefined,source:value('source')?String(value('source')):undefined,
  season:meta.season?String(meta.season):undefined,duration:meta.duration==null?undefined:Number(meta.duration),
  airStart:meta.air_start?String(meta.air_start):undefined,airEnd:meta.air_end?String(meta.air_end):undefined,
  favorite:Boolean(r.favorite),notes:r.notes?String(r.notes):undefined,
  availability:raw.availability as MediaItem['availability'],
  game:raw.game&&typeof raw.game==='object'?raw.game as MediaItem['game']:undefined,
  nextRelease:r.next_release?String(r.next_release):undefined,nextReleaseNumber:r.next_release_number==null?undefined:Number(r.next_release_number)
 };
}
function mediaToDbRow(item:MediaItem,userId:string){
 return {
  id:item.id,user_id:userId,parent_id:item.parentId??null,metadata_id:item.metadataId??null,anilist_id:item.anilistId??null,
  title:item.title,description:item.description,poster:item.poster,backdrop:item.backdrop,medium:item.medium,status:item.status,
  progress:item.progress,total:item.total??null,year:item.year??null,score:item.score??null,genres:item.genres,themes:item.themes,
  studio:item.studio??null,source:item.source??null,favorite:item.favorite,notes:item.notes??null,
  data:{
   source:item.anilistId?'anilist':'frame',provider:item.sourceProvider??null,externalId:item.externalId??null,
   personalRating:item.personalRating??null,progressUnit:item.progressUnit??units[item.medium],customTotal:item.customTotal??item.total??null,
   availability:item.availability??null,game:item.game??null
  }
 };
}
function defaultTotal(m:Medium,source?:number){
 if(source&&source>0)return Math.min(2000,source);
 if(m==='movie')return 1;
 if(m==='game'||m==='visual-novel')return 100;
 return 500;
}
function normaliseItem(item:MediaItem):MediaItem{
 const total=defaultTotal(item.medium,item.total);
 return {...item,total,progress:Math.max(0,Math.min(item.progress,total)),progressUnit:item.progressUnit||units[item.medium],status:item.status||statusForMedium(item.medium),poster:item.poster||FALLBACK_POSTER};
}
function sourceLinks(item:MediaItem){
 const q=encodeURIComponent(item.title);
 return [
  item.anilistId?{label:'AniList',url:'https://anilist.co/'+(item.medium==='manga'||item.medium==='manhwa'||item.medium==='light-novel'?'manga':'anime')+'/'+item.anilistId}:null,
  item.game?.storeUrl?{label:'Steam',url:item.game.storeUrl}:null,
  {label:'IMDb',url:'https://www.imdb.com/find/?q='+q},
  {label:'JustWatch',url:'https://www.justwatch.com/in/search?q='+q},
  {label:'Google',url:'https://www.google.com/search?q='+q+' official watch buy'}
 ].filter(Boolean) as {label:string;url:string}[];
}
function sortItems(xs:MediaItem[],sort:string){
 return [...xs].sort((a,b)=>{
  if(sort==='rating')return (b.score??0)-(a.score??0);
  if(sort==='personal')return (b.personalRating??-1)-(a.personalRating??-1);
  if(sort==='recent')return Number(b.year??0)-Number(a.year??0);
  if(sort==='progress')return (b.total?b.progress/b.total:0)-(a.total?a.progress/a.total:0);
  return a.title.localeCompare(b.title);
 });
}

export default function App(){
 const {user}=useAuth();
 const guest=localStorage.getItem('frame-guest')==='1';
 const [items,setItems]=useState<MediaItem[]>(()=>{try{return (JSON.parse(localStorage.getItem('frame-library')||'null')||fallbackItems).map(normaliseItem)}catch{return fallbackItems}});
 const [page,setPage]=useState('home'),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[sort,setSort]=useState('rating');
 const [selected,setSelected]=useState<MediaItem|null>(null),[finder,setFinder]=useState(false),[menu,setMenu]=useState(false),[settings,setSettings]=useState(false);
 const [radar,setRadar]=useState<RadarRelease[]>([]),[radarLoading,setRadarLoading]=useState(false),[radarError,setRadarError]=useState('');
 const [profile,setProfile]=useState<Profile|null>(null),[friends,setFriends]=useState<Friendship[]>([]),[callFriend,setCallFriend]=useState<Profile|null>(null),[friendProfiles,setFriendProfiles]=useState<Record<string,Profile>>({});
 const [permissions,setPermissions]=useState<Permission[]>([]),[selectedFriend,setSelectedFriend]=useState<Profile|null>(null),[friendLibraryId,setFriendLibraryId]=useState<string|null>(null);
 const [connections,setConnections]=useState<Record<string,boolean>>({anilist:true,steam:true,tvmaze:true,vndb:true,openlibrary:true,imdb:true,justwatch:true});
 const [aiProvider,setAiProvider]=useState('frame'),[density,setDensity]=useState('comfortable');
 const currentUserId=user?.id||'guest';
 useEffect(()=>{
  const onCall=(event:Event)=>{const friend=(event as CustomEvent<{friend:Profile}>).detail?.friend;if(friend)setCallFriend(friend)};
  const onLibrary=(event:Event)=>{const id=(event as CustomEvent<{id:string}>).detail?.id;if(id){setFriendLibraryId(id);setPage('friend-library')}};
  window.addEventListener('frame-voice-call',onCall);
  window.addEventListener('frame-open-friend-library',onLibrary);
  return()=>{window.removeEventListener('frame-voice-call',onCall);window.removeEventListener('frame-open-friend-library',onLibrary)};
 },[]);

 useEffect(()=>{
  document.documentElement.dataset.density=density;
  document.documentElement.dataset.theme='dark';
 },[density]);

 useEffect(()=>{
  let cancelled=false;
  const load=async()=>{
   if(!supabase||!user?.id)return;
   const {data,error}=await supabase.from('media_items').select('*,media_metadata(*)').eq('user_id',user.id).order('created_at',{ascending:false});
   if(!cancelled&&!error){
    const loaded=(data||[]).map(dbRowToMedia).map(normaliseItem);
    setItems(loaded);try{localStorage.setItem('frame-library',JSON.stringify(loaded))}catch{}
   }
   const {data:p}=await supabase.from('profiles').select('id,username,display_name,avatar_url,bio').eq('id',user.id).maybeSingle();
   if(p&&!cancelled)setProfile(p as Profile);
   if(!p&&!cancelled){const base=(user.email?.split('@')[0]||'frameuser').replace(/[^A-Za-z0-9_]/g,'').slice(0,18)||'frameuser';const generated=base+'_'+user.id.replace(/-/g,'').slice(0,6);const {data:created}=await supabase.from('profiles').upsert({id:user.id,username:generated,display_name:user.email?.split('@')[0]||'FRAME User',bio:''},{onConflict:'id'}).select('id,username,display_name,avatar_url,bio').maybeSingle();if(created)setProfile(created as Profile);await supabase.from('user_preferences').upsert({user_id:user.id},{onConflict:'user_id'})}
   const {data:pref}=await supabase.from('user_preferences').select('*').eq('user_id',user.id).maybeSingle();
   if(pref&&!cancelled){setSort(String(pref.default_sort||'rating'));setDensity(String(pref.density||'comfortable'));setAiProvider(String(pref.ai_provider||'frame'))}
   const {data:apps}=await supabase.from('connected_apps').select('provider,enabled').eq('user_id',user.id);
   if(Array.isArray(apps)&&!cancelled){
    const next={...connections};for(const a of apps)next[String(a.provider)]=Boolean(a.enabled);setConnections(next);
   }
  };
  void load();return()=>{cancelled=true};
 },[user?.id]);

 useEffect(()=>{
  if(!supabase||!user?.id)return;
  const loadSocial=async()=>{
   const {data:f}=await supabase.from('friendships').select('*').or('requester_id.eq.'+user.id+',addressee_id.eq.'+user.id).order('created_at',{ascending:false});
   const list=(f||[]) as Friendship[];setFriends(list);
   const ids=[...new Set(list.flatMap(x=>[x.requester_id,x.addressee_id]).filter(x=>x!==user.id))];
   if(ids.length){
    const {data:p}=await supabase.from('profiles').select('id,username,display_name,avatar_url,bio').in('id',ids);
    setFriendProfiles(Object.fromEntries(((p||[]) as Profile[]).map(x=>[x.id,x])));
   }
   const {data:perms}=await supabase.from('library_permissions').select('*').or('owner_id.eq.'+user.id+',viewer_id.eq.'+user.id);
   setPermissions((perms||[]) as Permission[]);
  };
  void loadSocial();
  const id=window.setInterval(()=>void loadSocial(),5000);return()=>window.clearInterval(id);
 },[user?.id]);

 const save=(xs:MediaItem[])=>{
  const clean=xs.map(normaliseItem);setItems(clean);try{localStorage.setItem('frame-library',JSON.stringify(clean))}catch{}
  if(supabase&&user?.id)void Promise.all(clean.map(item=>supabase.from('media_items').upsert(mediaToDbRow(item,user.id),{onConflict:'id'}))).catch(()=>{});
 };
 const importMediaItem=(raw:MediaItem)=>{
  const item=normaliseItem(raw);
  const duplicate=items.find(x=>(item.anilistId&&x.anilistId===item.anilistId)||(item.sourceProvider&&item.externalId&&x.sourceProvider===item.sourceProvider&&x.externalId===item.externalId));
  if(duplicate){setSelected(duplicate);setFinder(false);return}
  save([item,...items]);setSelected(item);setFinder(false);
 };
 const refreshRadar=async()=>{
  if(!supabase||!user?.id)return;
  setRadarLoading(true);setRadarError('');
  try{const {data,error}=await supabase.functions.invoke('release-radar',{body:{action:'refresh'}});if(error)throw error;setRadar(Array.isArray((data as {releases?:RadarRelease[]}|null)?.releases)?((data as {releases?:RadarRelease[]}).releases||[]):[])}
  catch(e){setRadarError(e instanceof Error?e.message:'Release Radar could not refresh.')}finally{setRadarLoading(false)}
 };
 useEffect(()=>{if(!supabase||!user?.id)return;void refreshRadar();const id=window.setInterval(()=>void refreshRadar(),30*60*1000);return()=>window.clearInterval(id)},[user?.id]);

 const persistPreference=async(key:string,value:unknown)=>{
  if(supabase&&user?.id)await supabase.from('user_preferences').upsert({user_id:user.id,[key]:value,updated_at:new Date().toISOString()},{onConflict:'user_id'});
 };
 const toggleConnection=async(id:string)=>{
  const value=!connections[id];setConnections({...connections,[id]:value});
  if(supabase&&user?.id)await supabase.from('connected_apps').upsert({user_id:user.id,provider:id,enabled:value,label:id,config:{}},{onConflict:'user_id,provider'});
 };
 const displayed=useMemo(()=>{
  const s=sortItems(items,sort);
  return s.filter(x=>x.title.toLowerCase().includes(query.toLowerCase())&&(filter==='all'||x.status===filter||filter===x.medium));
 },[items,query,filter,sort]);
 const friendEntries=friends.filter(x=>x.status==='accepted').map(x=>friendProfiles[x.requester_id===currentUserId?x.addressee_id:x.requester_id]).filter(Boolean);
 const incoming=friends.filter(x=>x.status==='pending'&&x.addressee_id===currentUserId);
 const pendingOutgoing=friends.filter(x=>x.status==='pending'&&x.requester_id===currentUserId);
 const friendHasAccess=(id:string)=>permissions.some(x=>x.owner_id===id&&x.viewer_id===currentUserId&&x.status==='accepted');
 const friendRequested=(id:string)=>permissions.some(x=>x.owner_id===id&&x.viewer_id===currentUserId);
 const requestedFromMe=(id:string)=>permissions.some(x=>x.owner_id===currentUserId&&x.viewer_id===id&&x.status==='pending');

 const openPage=(p:string)=>{setPage(p);setMenu(false);setSelected(null)};
 return <div className="frame-app">
  <header className="frame-topbar">
   <button className="frame-brand" onClick={()=>openPage('home')}><span>F</span><b>FRAME</b></button>
   <nav className="frame-nav">{[['home','Home',HomeIcon],['library','Library',Library],['discover','Discover',Compass],['radar','Radar',CalendarDays],['ai','AI',Bot],['friends','Friends',Users]] .map(([id,label,Icon])=>{const I=Icon as typeof HomeIcon;return <button key={id as string} className={page===id?'active':''} onClick={()=>openPage(id as string)}><I size={16}/>{label as string}</button>})}</nav>
   <div className="frame-actions">
    <div className="global-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')setFinder(true)}} placeholder="Search your library or press Enter…"/></div>
    <button className="primary top-find" onClick={()=>setFinder(true)}><Search size={16}/>Search</button>
    <button className="top-icon" onClick={()=>openPage('connections')} title="Connections"><Link2 size={18}/></button>
    <button className="top-icon" onClick={()=>openPage('settings')} title="Settings"><Settings size={18}/></button>
    <button className="top-avatar" onClick={()=>openPage('settings')}>{(profile?.display_name?.[0]||user?.email?.[0]||'G').toUpperCase()}</button>
    <button className="top-icon mobile-only" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button>
   </div>
  </header>
  {menu&&<div className="frame-mobile-menu">{[['home','Home'],['library','Library'],['discover','Discover'],['radar','Release Radar'],['ai','AI'],['friends','Friends'],['connections','Connections'],['settings','Settings']].map(([id,l])=><button key={id} onClick={()=>openPage(id)}>{l}</button>)}</div>}
  <main className="frame-main">
   {page==='home'&&<HomePage items={displayed} all={items} open={setSelected} openFinder={()=>setFinder(true)} setPage={openPage} stats={{all:items.length,watching:items.filter(x=>x.status==='watching'||x.status==='reading'||x.status==='playing').length,favorites:items.filter(x=>x.favorite).length,completed:items.filter(x=>x.status==='completed').length}}/>}
   {page==='library'&&<LibraryPage items={displayed} query={query} filter={filter} setFilter={setFilter} sort={sort} setSort={(x)=>{setSort(x);void persistPreference('default_sort',x)}} open={setSelected} add={()=>setFinder(true)} />}
   {page==='discover'&&<DiscoverPage openFinder={()=>setFinder(true)} openAi={()=>openPage('ai')}/>}
   {page==='radar'&&<RadarPage releases={radar} loading={radarLoading} error={radarError} refresh={()=>void refreshRadar()}/>}
   {page==='ai'&&<AIPage items={items} provider={aiProvider} setProvider={(x)=>{setAiProvider(x);void persistPreference('ai_provider',x)}}/>}
   {page==='friends'&&<FriendsPage userId={currentUserId} guest={guest} friends={friendEntries} incoming={incoming} outgoing={pendingOutgoing} profiles={friendProfiles} selected={selectedFriend} setSelected={setSelectedFriend} messages={[]} permissions={permissions} hasAccess={friendHasAccess} requested={friendRequested} requestedFromMe={requestedFromMe} onRefresh={async()=>{}}/>}
   {page==='connections'&&<ConnectionsPage connections={connections} toggle={toggleConnection}/>}
   {page==='settings'&&<SettingsPage user={user} profile={profile} setProfile={setProfile} guest={guest} density={density} setDensity={(x)=>{setDensity(x);void persistPreference('density',x)}} signOut={()=>void signOut()}/>}
   {page==='friend-library'&&friendLibraryId&&<FriendLibraryPage ownerId={friendLibraryId} owner={friendProfiles[friendLibraryId]} back={()=>openPage('friends')}/>}
  </main>
  <nav className="mobile-bottom">{[['home','Home',HomeIcon],['library','Library',Library],['search','Search',Search],['friends','Friends',Users],['settings','Settings',Settings]].map(([id,l,I])=><button key={id as string} className={page===id?'active':''} onClick={()=>id==='search'?setFinder(true):openPage(id as string)}>{(()=>{const Icon=I as typeof Search;return <Icon size={19}/>})()}<span>{l as string}</span></button>)}</nav>
  {selected&&<Detail item={selected} library={items} close={()=>setSelected(null)} save={x=>save(items.map(i=>i.id===x.id?x:i))}/>}
  {finder&&<AniListSearch close={()=>setFinder(false)} onImported={importMediaItem} onManual={()=>setFinder(false)}/>}
 </div>;
}

function HomePage({items,all,open,openFinder,setPage,stats}:{items:MediaItem[];all:MediaItem[];open:(x:MediaItem)=>void;openFinder:()=>void;setPage:(x:string)=>void;stats:{all:number;watching:number;favorites:number;completed:number}}){
 return <div className="dashboard page">
  <section className="search-hero">
   <div className="search-hero-copy"><small>FRAME PERSONAL MEDIA LIBRARY</small><h1>Everything you love.<br/><em>One place.</em></h1><p>Track it, find it, rate it, discover where to watch or buy it, and let AI help you decide what comes next.</p></div>
   <button className="universal-search-box" onClick={openFinder}><Search size={20}/><span>Search anime, manga, manhwa, novels, games, movies, series, books…</span><kbd>ENTER</kbd></button>
  </section>
  <section className="stat-strip"><Stat label="In library" value={stats.all}/><Stat label="In progress" value={stats.watching}/><Stat label="Completed" value={stats.completed}/><Stat label="Favorites" value={stats.favorites}/></section>
  <section className="quick-panel"><div><small>QUICK CONTROL</small><h2>Your library, your rules.</h2></div><div className="quick-actions"><button onClick={()=>setPage('library')}><Library size={16}/> Open library</button><button onClick={()=>setPage('discover')}><Compass size={16}/> Discover</button><button onClick={()=>setPage('ai')}><Bot size={16}/> Ask FRAME AI</button></div></section>
  <section className="library-section"><div className="section-title"><div><small>RATED & ORGANIZED</small><h2>Everything in your library</h2></div><span>{all.length} items</span></div><div className="media-grid">{items.map(x=><MediaCard key={x.id} item={x} open={open}/>)}</div>{!items.length&&<EmptyState text="Your library is empty. Search any catalogue above to start building it."/ >}</section>
 </div>;
}
function Stat({label,value}:{label:string;value:number}){return <div className="stat-card"><b>{value}</b><span>{label}</span></div>}

function LibraryPage({items,query,filter,setFilter,sort,setSort,open,add}:{items:MediaItem[];query:string;filter:string;setFilter:(x:string)=>void;sort:string;setSort:(x:string)=>void;open:(x:MediaItem)=>void;add:()=>void}){
 const fs=[['all','All'],['watching','Watching'],['reading','Reading'],['playing','Playing'],['completed','Completed'],['planned','Planned'],['paused','Paused'],['dropped','Dropped'],['anime','Anime'],['manga','Manga'],['manhwa','Manhwa'],['light-novel','Light Novels'],['visual-novel','Visual Novels'],['movie','Movies'],['series','Series'],['game','Games'],['book','Books']];
 return <div className="page">
  <div className="page-heading"><div><small>YOUR COLLECTION</small><h1>Library</h1><p>{query?'Results for “'+query+'”':'Every title, treated equally and sorted your way.'}</p></div><button className="primary" onClick={add}><CirclePlus size={17}/>Add media</button></div>
  <div className="library-controls"><div className="filter-scroll">{fs.map(([id,l])=><button className={filter===id?'active':''} key={id} onClick={()=>setFilter(id)}>{l}</button>)}</div><label className="sort-select"><SlidersHorizontal size={15}/><span>Sort</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="rating">Rating</option><option value="personal">My rating</option><option value="recent">Newest</option><option value="progress">Progress</option><option value="title">Title</option></select></label></div>
  <div className="media-grid library-grid">{items.map(x=><MediaCard key={x.id} item={x} open={open}/>)}</div>
  {!items.length&&<EmptyState text="No titles match these filters."/>}
 </div>;
}

function MediaCard({item,open}:{item:MediaItem;open:(x:MediaItem)=>void}){
 const percent=item.medium==='game'&&item.game?.completionProgress!=null?item.game.completionProgress:(item.total?item.progress/item.total*100:0);
 return <button className="media-card" onClick={()=>open(item)}>
  <div className="media-poster"><img src={item.poster||FALLBACK_POSTER} alt="" loading="lazy"/><span className="medium-pill">{mediaTypes[item.medium]}</span><span className="score-pill"><Star size={10} fill="currentColor"/>{item.score==null?'—':item.score.toFixed(1)}</span></div>
  <div className="media-copy"><b>{item.title}</b><small>{item.status==='completed'?'Completed':item.progress+' / '+(item.total??'500')} {item.progressUnit||units[item.medium]}</small><div className="card-progress"><i style={{width:Math.min(100,Math.max(0,percent))+'%'}}/></div><span className="personal-line">{item.personalRating!=null?'Your rating '+item.personalRating.toFixed(1):'Not personally rated'}</span></div>
 </button>;
}

function DiscoverPage({openFinder,openAi}:{openFinder:()=>void;openAi:()=>void}){
 const items=[['Search everything','Search AniList, Steam, TVMaze, VNDB, Open Library and more in one place.',Search],['Ask AI','Describe the story you want and let FRAME reason over your library.',Bot],['Watch / buy','Find legitimate viewing, reading, playing and buying options.',ExternalLink],['Connect services','Control which catalogues and AI services FRAME uses.',Link2]];
 return <div className="page"><div className="page-heading"><div><small>DISCOVER</small><h1>Explore everything.</h1><p>One search system for your whole media universe.</p></div></div><div className="feature-grid">{items.map(([t,p,I],i)=>{const Icon=I as typeof Search;return <button key={String(t)} className="feature-card" onClick={i===0?openFinder:i===1?openAi:undefined}><Icon size={22}/><h3>{String(t)}</h3><p>{String(p)}</p><ChevronRight/></button>})}</div><div className="provider-row"><span>Built-in sources</span><b>AniList</b><b>Steam</b><b>TVMaze</b><b>VNDB</b><b>Open Library</b><b>IMDb search</b><b>JustWatch search</b></div></div>;
}

function RadarPage({releases,loading,error,refresh}:{releases:RadarRelease[];loading:boolean;error:string;refresh:()=>void}){
 const upcoming=releases.filter(x=>!x.released).sort((a,b)=>Date.parse(a.airingAt)-Date.parse(b.airingAt));const released=releases.filter(x=>x.released).sort((a,b)=>Date.parse(b.airingAt)-Date.parse(a.airingAt));
 const fmt=(x:string)=>new Date(x).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 return <div className="page"><div className="page-heading"><div><small>AUTOMATIC TRACKING</small><h1>Release Radar</h1><p>Tracked AniList releases, with progress-aware reminders.</p></div><button className="secondary" onClick={refresh} disabled={loading}>{loading?<RefreshCw className="spin"/>:<RefreshCw/>}Refresh</button></div>{error&&<div className="inline-error"><AlertCircle size={16}/>{error}</div>}<section className="radar-panel"><div className="section-title"><div><small>UP NEXT</small><h2>Upcoming</h2></div><span>{upcoming.length}</span></div>{upcoming.length?<div className="release-list">{upcoming.slice(0,30).map(r=><div key={r.anilistId+'-'+r.episode}><img src={r.poster||FALLBACK_POSTER} alt=""/><section><b>{r.title}</b><small>Episode {r.episode}</small><span>{fmt(r.airingAt)}</span></section></div>)}</div>:<EmptyState text="No upcoming tracked releases found."/ >}</section>{released.length>0&&<section className="radar-panel"><div className="section-title"><div><small>RECENT</small><h2>Recently released</h2></div><span>{released.length}</span></div><div className="release-list">{released.slice(0,20).map(r=><div key={r.anilistId+'-'+r.episode}><img src={r.poster||FALLBACK_POSTER} alt=""/><section><b>{r.title}</b><small>Episode {r.episode} released</small><span>{fmt(r.airingAt)}</span></section></div>)}</div></section>}</div>;
}

function Detail({item,library,close,save}:{item:MediaItem;library:MediaItem[];close:()=>void;save:(x:MediaItem)=>void}){
 const [d,setD]=useState(normaliseItem(item));
 const [total,setTotal]=useState(String(d.total??500));
 const percent=d.medium==='game'&&d.game?.completionProgress!=null?d.game.completionProgress:(d.total?d.progress/d.total*100:0);
 const setProgress=(n:number)=>d.medium==='game'?setD({...d,progress:n,game:{...(d.game||{}),storyProgress:n,completionProgress:d.game?.completionProgress??n}}):setD({...d,progress:n});
 const source=sourceLinks(d);
 return <div className="overlay"><aside className="detail-drawer">
  <button className="close-btn" onClick={close}><X/></button><div className="detail-cover"><img src={d.backdrop||d.poster||FALLBACK_POSTER} alt=""/><div/></div>
  <div className="detail-body"><img className="detail-poster" src={d.poster||FALLBACK_POSTER} alt=""/><div className="detail-main"><small>{mediaTypes[d.medium]} · {labels[d.status]}</small><h2>{d.title}</h2><div className="detail-rating"><span><Star size={13} fill="currentColor"/>Source {d.score==null?'—':d.score.toFixed(1)}</span><span>Your {d.personalRating==null?'—':d.personalRating.toFixed(1)}</span></div><p>{d.description||'No description available.'}</p><div className="tags">{d.genres.slice(0,8).map(x=><span key={x}>{x}</span>)}</div></div></div>
  <section className="detail-section"><div className="detail-section-head"><h3>Progress</h3><span>{Math.round(percent)}%</span></div><input className="progress-slider" type="range" min="0" max={d.medium==='game'||d.medium==='visual-novel'?100:Number(d.total||500)} value={d.medium==='game'||d.medium==='visual-novel'?d.progress:d.progress} onChange={e=>setProgress(Number(e.target.value))}/><div className="progress-edit"><input value={d.progress} type="number" min="0" max={d.total??2000} onChange={e=>setProgress(Math.max(0,Math.min(Number(d.total??2000),Number(e.target.value)||0)))}/><span>{d.progressUnit||units[d.medium]}</span><span>/</span><input value={total} type="number" min="1" max="2000" onChange={e=>{setTotal(e.target.value);const n=Math.max(1,Math.min(2000,Number(e.target.value)||1));setD({...d,total:n,progress:Math.min(d.progress,n)})}}/><span>total</span></div><small className="hint">The catalogue total is only a starting value. Change it whenever the source is wrong or you track a different edition.</small></section>
  <section className="detail-section two-col"><label>Status<select value={d.status} onChange={e=>setD({...d,status:e.target.value as Status})}>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Your rating<input type="number" min="0" max="10" step=".1" value={d.personalRating??''} placeholder="0–10" onChange={e=>setD({...d,personalRating:e.target.value===''?undefined:Number(e.target.value)})}/></label><label>Parent entry<select value={d.parentId||''} onChange={e=>setD({...d,parentId:e.target.value||undefined})}><option value="">None — standalone</option>{library.filter(x=>x.id!==d.id).map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label><label>Custom total<input type="number" min="1" max="2000" value={d.total??500} onChange={e=>setD({...d,total:Math.max(1,Math.min(2000,Number(e.target.value)||1)),customTotal:Math.max(1,Math.min(2000,Number(e.target.value)||1))})}/></label></section>
  {d.game&&<section className="detail-section game-box"><h3>Game information</h3><div><span>Developer</span><b>{d.game.developer||'—'}</b></div><div><span>Publisher</span><b>{d.game.publisher||'—'}</b></div><div><span>Platforms</span><b>{d.game.platforms?.join(', ')||'—'}</b></div><div><span>Price</span><b>{d.game.isFree?'Free':d.game.priceText||'Check store'}</b></div></section>}
  <section className="detail-section"><h3>Where to find it</h3><div className="source-links">{source.map(x=><a key={x.url} href={x.url} target="_blank" rel="noreferrer"><ExternalLink size={13}/>{x.label}</a>)}</div></section>
  <section className="detail-section"><label>Private notes<textarea value={d.notes||''} onChange={e=>setD({...d,notes:e.target.value})} placeholder="Add anything you want to remember…"/></label></section>
  <div className="detail-actions"><button className="primary" onClick={()=>save(d)}><Check size={16}/>Save changes</button><button className={d.favorite?'secondary active':'secondary'} onClick={()=>setD({...d,favorite:!d.favorite})}><Heart size={16} fill={d.favorite?'currentColor':'none'}/>{d.favorite?'Favorited':'Favorite'}</button></div>
 </div></aside></div>;
}

function AIPageDummy(){return null}

function AIPage({items,provider,setProvider}:{items:MediaItem[];provider:string;setProvider:(x:string)=>void}){
 const [input,setInput]=useState(''),[answer,setAnswer]=useState(''),[busy,setBusy]=useState(false),[voice,setVoice]=useState(false),[listening,setListening]=useState(false);
 const recognitionRef=useRef<any>(null);
 const ask=async(text:string)=>{
  const q=text.trim();if(!q||busy)return;setBusy(true);setAnswer('');
  try{
   if(!supabase)throw new Error('AI is available after connecting Supabase.');
   const {data,error}=await supabase.functions.invoke('frame-ai',{body:{message:q}});if(error)throw error;
   const a=String((data as {answer?:string}|null)?.answer||'No answer returned.');setAnswer(a);
   if(voice&&'speechSynthesis' in window){window.speechSynthesis.cancel();window.speechSynthesis.speak(new SpeechSynthesisUtterance(a))}
  }catch(e){setAnswer(e instanceof Error?e.message:'AI could not answer right now.')}finally{setBusy(false)}
 };
 const startVoice=()=>{
  const w=window as unknown as {SpeechRecognition?:new()=>any;webkitSpeechRecognition?:new()=>any};
  const C=w.SpeechRecognition||w.webkitSpeechRecognition;if(!C)return;
  const r=new C();recognitionRef.current=r;r.lang='en-IN';r.interimResults=false;r.maxAlternatives=1;
  r.onstart=()=>setListening(true);r.onend=()=>setListening(false);r.onerror=()=>setListening(false);
  r.onresult=(ev:any)=>{const t=ev.results?.[0]?.[0]?.transcript||'';setInput(t);void ask(t)};
  r.start();
 };
 return <div className="page"><div className="page-heading"><div><small>FRAME INTELLIGENCE</small><h1>AI Search</h1><p>Ask about your library, find what fits, compare titles, or describe exactly what you want to watch, read or play.</p></div></div>
  <div className="ai-provider-bar"><span>AI provider</span>{['frame','openai','gemini','claude'].map(x=><button key={x} className={provider===x?'active':''} onClick={()=>setProvider(x)}>{x==='frame'?'FRAME AI':x==='gemini'?'Gemini':x[0].toUpperCase()+x.slice(1)}{x!=='frame'&&<small>connector</small>}</button>)}</div>
  <section className="ai-shell"><div className="ai-prompts">{['What should I watch next?','Find my highest-rated unfinished titles.','Recommend something like Steins;Gate.','What genres do I seem to prefer?'].map(x=><button key={x} onClick={()=>{setInput(x);void ask(x)}}>{x}</button>)}</div><textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask FRAME anything about your media universe…"/><div className="ai-footer"><div><button className={voice?'voice-toggle active':'voice-toggle'} onClick={()=>setVoice(!voice)}>{voice?<Volume2 size={16}/>:<VolumeX size={16}/>}Voice answers</button><button className="secondary" onClick={startVoice} disabled={listening||busy}><>{listening?<MicOff size={16}/>:<Mic size={16}/>}</>{listening?'Listening…':'Talk to AI'}</button></div><button className="primary" onClick={()=>void ask(input)} disabled={busy||!input.trim()}>{busy?'Thinking…':'Ask FRAME'}<Bot size={16}/></button></div>{answer&&<div className="ai-answer"><small>FRAME AI</small><p>{answer}</p></div>}</section>
  <div className="ai-library-summary"><span>{items.length} titles are available to FRAME AI for personalized answers.</span><span>Voice uses your browser microphone and speech engine.</span></div>
 </div>;
}

function FriendsPage({userId,guest,friends,incoming,outgoing,profiles,selected,setSelected,permissions,hasAccess,requested,requestedFromMe}:{userId:string;guest:boolean;friends:Profile[];incoming:Friendship[];outgoing:Friendship[];profiles:Record<string,Profile>;selected:Profile|null;setSelected:(p:Profile|null)=>void;messages:FriendMessage[];permissions:Permission[];hasAccess:(id:string)=>boolean;requested:(id:string)=>boolean;requestedFromMe:(id:string)=>boolean;onRefresh:()=>Promise<void>}){
 const [q,setQ]=useState(''),[results,setResults]=useState<Profile[]>([]),[msgs,setMsgs]=useState<FriendMessage[]>([]),[draft,setDraft]=useState('');
 const search=async()=>{
  if(!supabase||!userId||guest||q.trim().length<2)return;
  const {data}=await supabase.from('profiles').select('id,username,display_name,avatar_url,bio').ilike('username','%'+q.trim()+'%').neq('id',userId).limit(10);setResults((data||[]) as Profile[]);
 };
 const selectedFriendId=selected?.id;
 useEffect(()=>{
  if(!supabase||guest||!selectedFriendId)return;
  const load=async()=>{const {data}=await supabase.from('friend_messages').select('*').or('and(sender_id.eq.'+userId+',recipient_id.eq.'+selectedFriendId+'),and(sender_id.eq.'+selectedFriendId+',recipient_id.eq.'+userId+')').order('created_at',{ascending:true}).limit(200);setMsgs((data||[]) as FriendMessage[])};
  void load();const id=window.setInterval(()=>void load(),3000);return()=>window.clearInterval(id);
 },[selectedFriendId,userId,guest]);
 const add=async(id:string)=>{
  if(!supabase)return;
  await supabase.from('friendships').insert({requester_id:userId,addressee_id:id,status:'pending'});setResults(results.filter(x=>x.id!==id));
 };
 const accept=async(id:string)=>{
  if(!supabase)return;await supabase.from('friendships').update({status:'accepted',updated_at:new Date().toISOString()}).eq('id',id).eq('addressee_id',userId);window.location.reload();
 };
 const send=async()=>{
  const body=draft.trim();if(!body||!selectedFriendId||!supabase)return;setDraft('');await supabase.from('friend_messages').insert({sender_id:userId,recipient_id:selectedFriendId,body});
 };
 const askLibrary=async()=>{
  if(!selectedFriendId||!supabase||requested(selectedFriendId))return;
  await supabase.from('library_permissions').upsert({owner_id:selectedFriendId,viewer_id:userId,status:'pending'},{onConflict:'owner_id,viewer_id'});
 };
 const permissionsForMe=permissions.filter(x=>x.owner_id===userId&&x.status==='pending');
 const acceptLibrary=async(p:Permission)=>{if(!supabase)return;await supabase.from('library_permissions').update({status:'accepted',updated_at:new Date().toISOString()}).eq('id',p.id).eq('owner_id',userId);window.location.reload()};
 return <div className="page"><div className="page-heading"><div><small>PRIVATE SOCIAL SPACE</small><h1>Friends</h1><p>Find friends by username, chat, and share your library only after permission.</p></div></div>{guest?<div className="social-lock"><Users size={26}/><h2>Guest mode</h2><p>Create or log into a FRAME account to use friends, private chat and library sharing.</p></div>:<><div className="friend-search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&void search()} placeholder="Search username…"/><button className="primary" onClick={()=>void search()}><Search size={15}/>Find</button></div>{results.length>0&&<div className="people-results">{results.map(p=><div key={p.id}><div className="person-avatar">{(p.display_name||p.username)[0]?.toUpperCase()}</div><section><b>{p.display_name||p.username}</b><small>@{p.username}</small></section><button className="secondary" onClick={()=>void add(p.id)}><UserPlus size={15}/>Add</button></div>)}</div>}<div className="social-grid"><section className="social-panel"><div className="section-title"><div><small>REQUESTS</small><h2>Incoming</h2></div><span>{incoming.length}</span></div>{incoming.length?incoming.map(f=><div className="request-row" key={f.id}><span>@{profiles[f.requester_id]?.username||'user'}</span><button className="primary" onClick={()=>void accept(f.id)}><Check size={14}/>Accept</button></div>):<p className="muted">No pending friend requests.</p>}</section><section className="social-panel"><div className="section-title"><div><small>YOUR PEOPLE</small><h2>Friends</h2></div><span>{friends.length}</span></div>{friends.length?friends.map(p=><button className={selected?.id===p.id?'friend-row active':'friend-row'} key={p.id} onClick={()=>setSelected(p)}><span className="person-avatar">{(p.display_name||p.username)[0]?.toUpperCase()}</span><span><b>{p.display_name||p.username}</b><small>@{p.username}</small></span><ChevronRight size={16}/></button>):<p className="muted">Add someone by username to get started.</p>}</section></div>{selected&&<section className="chat-panel"><header><div><b>{selected.display_name||selected.username}</b><small>@{selected.username}</small></div><div className="chat-actions"><button className="secondary" onClick={askLibrary}>{hasAccess(selected.id)?'Library shared':requested(selected.id)?'Request sent':'Ask to view library'}</button><button className="secondary" onClick={()=>window.dispatchEvent(new CustomEvent('frame-voice-call',{detail:{friend:selected}})}><Phone size={15}/>Voice</button></div></header><div className="chat-messages">{msgs.length?msgs.map(m=><div className={m.sender_id===userId?'mine':'theirs'} key={m.id}><span>{m.body}</span><small>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div>):<div className="chat-empty"><MessageCircle size={22}/>Start a conversation.</div>}</div><form className="chat-input" onSubmit={e=>{e.preventDefault();void send()}}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Message…"/><button className="primary"><Send size={16}/></button></form>{hasAccess(selected.id)&&<button className="view-library" onClick={()=>window.dispatchEvent(new CustomEvent('frame-open-friend-library',{detail:{id:selected.id}}))}>Open @{selected.username}'s shared library <ChevronRight size={15}/></button>}</section>}{permissionsForMe.length>0&&<section className="social-panel permission-panel"><div className="section-title"><div><small>LIBRARY ACCESS</small><h2>Requests to see yours</h2></div><span>{permissionsForMe.length}</span></div>{permissionsForMe.map(p=><div className="request-row" key={p.id}><span>{profiles[p.viewer_id]?.display_name||'A friend'} wants to view your library.</span><button className="primary" onClick={()=>void acceptLibrary(p)}><Shield size={14}/>Allow</button></div>)}</section>}</>}</div>;
}

function FriendLibraryPage({ownerId,owner,back}:{ownerId:string;owner?:Profile;back:()=>void}){
 const [items,setItems]=useState<MediaItem[]>([]),[busy,setBusy]=useState(true);
 useEffect(()=>{let active=true;const run=async()=>{if(!supabase){setBusy(false);return}const {data,error}=await supabase.from('media_items').select('*,media_metadata(*)').eq('user_id',ownerId).order('score',{ascending:false});if(active){setItems(error?[]:(data||[]).map(dbRowToMedia).map(normaliseItem));setBusy(false)}};void run();return()=>{active=false}},[ownerId]);
 return <div className="page"><button className="breadcrumb" onClick={back}><ArrowLeft size={15}/>Back to friends</button><div className="page-heading"><div><small>SHARED BY @{owner?.username||'friend'}</small><h1>{owner?.display_name||owner?.username||'Friend'}'s Library</h1><p>Visible because they granted FRAME permission.</p></div></div>{busy?<div className="state">Loading library…</div>:<div className="media-grid">{items.map(x=><MediaCard key={x.id} item={x} open={()=>{}}/>)}</div>}</div>;
}

function ConnectionsPage({connections,toggle}:{connections:Record<string,boolean>;toggle:(id:string)=>void}){
 const rows=[['anilist','AniList','Anime, manga and light-novel metadata','Built-in'],['steam','Steam','Games, platforms, prices and store availability','Built-in'],['tvmaze','TVMaze','TV series metadata and episode info','Built-in'],['vndb','VNDB','Visual novel catalogue','Built-in'],['openlibrary','Open Library','Books and novels','Built-in'],['imdb','IMDb search','Title discovery link','Web search'],['justwatch','JustWatch','Legal streaming / buying search','Web search']];
 return <div className="page"><div className="page-heading"><div><small>SERVICE CONTROL CENTER</small><h1>Connections</h1><p>Choose which sources FRAME is allowed to use. Account/API credentials stay outside the client.</p></div></div><div className="connections-grid">{rows.map(([id,name,desc,badge])=><div className="connection-card" key={id}><div className="connection-icon"><Link2 size={19}/></div><div><b>{name}</b><p>{desc}</p><small>{badge}</small></div><button className={connections[id]?'secondary active':'secondary'} onClick={()=>toggle(id)}>{connections[id]?'Enabled':'Disabled'}</button></div>)}</div><section className="ai-connect-card"><Bot size={22}/><div><h2>AI provider</h2><p>FRAME AI is the secure server-backed provider currently wired into this build. Provider selection is kept ready for OpenAI, Gemini and Claude connectors without putting API keys in browser code.</p></div></section></div>;
}

function SettingsPage({user,profile,setProfile,guest,density,setDensity,signOut}:{user:any;profile:Profile|null;setProfile:(x:Profile)=>void;guest:boolean;density:string;setDensity:(x:string)=>void;signOut:()=>void}){
 const [display,setDisplay]=useState(profile?.display_name||''),[username,setUsername]=useState(profile?.username||''),[saved,setSaved]=useState(false);
 useEffect(()=>{setDisplay(profile?.display_name||'');setUsername(profile?.username||'')},[profile?.id,profile?.display_name,profile?.username]);
 const saveProfile=async()=>{
  if(!supabase||!user?.id)return;
  const p={id:user.id,username:username.trim(),display_name:display.trim()||username.trim(),avatar_url:profile?.avatar_url||null,bio:profile?.bio||''};
  const {error}=await supabase.from('profiles').upsert(p,{onConflict:'id'});if(!error){setProfile(p);setSaved(true);setTimeout(()=>setSaved(false),1800)}
 };
 return <div className="page"><div className="page-heading"><div><small>PERSONALIZATION</small><h1>Settings</h1><p>Make FRAME yours on every device.</p></div></div><section className="settings-grid"><div className="settings-panel"><div className="section-title"><div><small>ACCOUNT</small><h2>Profile</h2></div></div>{guest?<p className="muted">Guest mode stores data locally. Log in to sync profile, friends and cloud library.</p>:<><label>Username<input value={username} onChange={e=>setUsername(e.target.value.replace(/[^A-Za-z0-9_]/g,''))}/></label><label>Display name<input value={display} onChange={e=>setDisplay(e.target.value)}/></label><label>Email<input value={user?.email||''} disabled/></label><button className="primary" onClick={()=>void saveProfile()}>{saved?<><Check size={15}/>Saved</>:'Save profile'}</button></>}</div><div className="settings-panel"><div className="section-title"><div><small>INTERFACE</small><h2>Appearance</h2></div></div><div className="setting-row"><span>Card density<small>Choose how much media fits on screen.</small></span><select value={density} onChange={e=>setDensity(e.target.value)}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select></div><div className="setting-row"><span>Theme<small>Samsung-inspired dark glass is the FRAME default.</small></span><b>Dark</b></div></div><div className="settings-panel"><div className="section-title"><div><small>SECURITY</small><h2>Account actions</h2></div></div><button className="danger" onClick={signOut}><LogOut size={16}/>Log out</button>{!guest&&<p className="muted">Use “Forgot password?” from the library entrance to recover your account.</p>}</div></section></div>;
}

function EmptyState({text}:{text:string}){return <div className="empty-state"><Library size={24}/><p>{text}</p></div>}
function VoiceCallOverlay({userId,friendId,friendName,close}:{userId:string;friendId:string;friendName:string;close:()=>void}){
 const [status,setStatus]=useState<'idle'|'connecting'|'ringing'|'in-call'>('idle');
 const [incoming,setIncoming]=useState(false);
 const [error,setError]=useState('');
 const pcRef=useRef<RTCPeerConnection|null>(null),streamRef=useRef<MediaStream|null>(null),channelRef=useRef<any>(null),pendingOffer=useRef<any>(null),pendingIce=useRef<any[]>([]);
 const audioRef=useRef<HTMLAudioElement|null>(null);
 const channelName='frame-voice-'+[userId,friendId].sort().join('-');
 const cleanup=(notify:boolean)=>{
  if(notify)void channelRef.current?.send({type:'broadcast',event:'voice',payload:{from:userId,type:'hangup'}});
  pcRef.current?.close();pcRef.current=null;streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;
  pendingOffer.current=null;pendingIce.current=[];setIncoming(false);setStatus('idle');
 };
 useEffect(()=>{
  if(!supabase)return;
  const channel=supabase.channel(channelName);
  channelRef.current=channel;
  channel.on('broadcast',{event:'voice'},async(message:{payload?:any})=>{
   const p=message.payload||{};if(p.from===userId)return;
   if(p.type==='offer'){pendingOffer.current=p.offer;setIncoming(true);setStatus('ringing')}
   else if(p.type==='answer'&&pcRef.current){try{await pcRef.current.setRemoteDescription(p.answer);for(const candidate of pendingIce.current)await pcRef.current.addIceCandidate(candidate);pendingIce.current=[];setStatus('in-call')}catch{}}
   else if(p.type==='ice'){if(pcRef.current?.remoteDescription)void pcRef.current.addIceCandidate(p.candidate);else pendingIce.current.push(p.candidate)}
   else if(p.type==='hangup')cleanup(false);
  }).subscribe();
  return()=>{void channel.unsubscribe();cleanup(false)};
 },[channelName,userId]);
 const makePeer=async()=>{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('This browser does not support microphone calls.');
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});streamRef.current=stream;
  const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  for(const track of stream.getTracks())pc.addTrack(track,stream);
  pc.onicecandidate=e=>{if(e.candidate)void channelRef.current?.send({type:'broadcast',event:'voice',payload:{from:userId,type:'ice',candidate:e.candidate}})};
  pc.ontrack=e=>{if(audioRef.current){audioRef.current.srcObject=e.streams[0]||new MediaStream([e.track]);void audioRef.current.play().catch(()=>{})}};
  pc.onconnectionstatechange=()=>{if(pc.connectionState==='connected')setStatus('in-call');if(['failed','disconnected','closed'].includes(pc.connectionState))setStatus('idle')};
  pcRef.current=pc;return pc;
 };
 const call=async()=>{
  try{setError('');setStatus('connecting');const pc=await makePeer();const offer=await pc.createOffer();await pc.setLocalDescription(offer);await channelRef.current?.send({type:'broadcast',event:'voice',payload:{from:userId,type:'offer',offer:pc.localDescription}});setStatus('ringing')}catch(e){setError(e instanceof Error?e.message:'Microphone access failed.');setStatus('idle');cleanup(false)}
 };
 const answer=async()=>{
  try{setError('');setStatus('connecting');const pc=await makePeer();await pc.setRemoteDescription(pendingOffer.current);for(const candidate of pendingIce.current)await pc.addIceCandidate(candidate);pendingIce.current=[];const ans=await pc.createAnswer();await pc.setLocalDescription(ans);await channelRef.current?.send({type:'broadcast',event:'voice',payload:{from:userId,type:'answer',answer:pc.localDescription}});setIncoming(false);setStatus('in-call')}catch(e){setError(e instanceof Error?e.message:'Could not answer the call.');cleanup(false)}
 };
 const end=()=>{cleanup(true);close()};
 return <div className="voice-overlay"><section className="voice-card"><div className="voice-orb"><Phone size={28}/></div><small>PRIVATE VOICE</small><h2>{friendName}</h2><p>{status==='ringing'&&incoming?'Incoming voice call':status==='ringing'?'Calling…':status==='in-call'?'Connected securely':'Voice chat'}</p>{error&&<div className="inline-error">{error}</div>}<audio ref={audioRef} autoPlay playsInline/><div className="voice-actions">{incoming?<><button className="primary" onClick={()=>void answer()}><Phone size={17}/>Answer</button><button className="secondary" onClick={()=>end()}><PhoneOff size={17}/>Decline</button></>:status==='in-call'||status==='ringing'?<button className="danger" onClick={end}><PhoneOff size={17}/>End call</button>:<><button className="primary" onClick={()=>void call()}><Phone size={17}/>Start voice call</button><button className="secondary" onClick={close}>Cancel</button></>}</div><small className="hint">Audio only. Your microphone is requested only when you start or answer a call.</small></section></div>;
}


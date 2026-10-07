import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {Bell,BookOpen,CalendarDays,ChevronRight,CirclePlus,Compass,Film,Gamepad2,Heart,Home as HomeIcon,Library,LogOut,Menu,Search,Settings,Star,Play,Tv,X} from 'lucide-react';
import {signOut,useAuth} from './auth/Auth';
import type {MediaItem,Medium,Status} from './types';
import {AniListSearch} from './components/AniListSearch';
import {supabase} from './lib/supabase';

const poster='https://cdn.myanimelist.net/images/anime/10/47347.jpg';
const mediaTypes:Record<Medium,string>={anime:'Anime',manga:'Manga',manhwa:'Manhwa','light-novel':'Light Novel','visual-novel':'Visual Novel',movie:'Movie',series:'Series',game:'Games',book:'Book'};
const labels:Record<Status,string>={watching:'Watching',completed:'Completed',planned:'Plan to Play/Watch',paused:'Paused',dropped:'Dropped'};
const starter:MediaItem[]=[
{id:'aot',title:'Attack on Titan',description:'A complete franchise entry with seasons, parts and specials.',poster,backdrop:'',status:'completed',progress:89,total:89,year:2013,score:9.8,genres:['Action','Dark Fantasy','Mystery'],themes:[],medium:'anime',favorite:true},
{id:'sg',title:'Steins;Gate',description:'A fully watched classic tracked as the parent entry for related releases.',poster,backdrop:'',status:'completed',progress:24,total:24,year:2011,score:10,genres:['Sci-Fi','Thriller','Drama'],themes:[],medium:'anime',favorite:true},
{id:'mushoku',title:'Mushoku Tensei',description:'Your current watch list entry.',poster,backdrop:'',status:'watching',progress:24,total:24,year:2021,score:8.7,genres:['Adventure','Fantasy'],themes:[],medium:'anime',favorite:false},
{id:'gta3',title:'Grand Theft Auto III',description:'Classic open-world game set in Liberty City. FRAME tracks story progress, overall completion and detailed game metadata.',poster:'https://upload.wikimedia.org/wikipedia/en/8/8f/GTA3boxcover.jpg',backdrop:'',status:'planned',progress:0,total:100,year:2001,score:9.7,genres:['Action','Adventure','Open World'],themes:['Single-player','Open World'],medium:'game',favorite:false,game:{developer:'DMA Design / Rockstar North',publisher:'Rockstar Games',releaseDate:'2001-10-22',platforms:['PlayStation 2','PC','Xbox','Mac','iOS','Android','PS4'],gameModes:['Single-player'],playtimeHours:37,storyProgress:0,completionProgress:0,difficulty:'Medium',complexity:{story:3,gameplay:3,systems:3,exploration:5},franchise:'Grand Theft Auto',edition:'Original release',dlc:[]}}
];

function dbRowToMedia(row:unknown):MediaItem{
 const r=row as Record<string,unknown>;
 const meta=(r.media_metadata&&typeof r.media_metadata==='object'?r.media_metadata:{}) as Record<string,unknown>;
 const value=(key:string)=>meta[key]??r[key];
 const rawData=(r.data&&typeof r.data==='object'?r.data:{}) as Record<string,unknown>;
 return {
   id:String(r.id), parentId:r.parent_id?String(r.parent_id):undefined, metadataId:r.metadata_id?String(r.metadata_id):undefined,
   anilistId:r.anilist_id==null?undefined:Number(r.anilist_id),
   sourceProvider:rawData.provider?String(rawData.provider):(r.anilist_id?'anilist':undefined),
   externalId:rawData.externalId?String(rawData.externalId):(r.anilist_id?String(r.anilist_id):undefined),
   title:String(value('title')??''),
   alternativeTitles:Array.isArray(meta.alternative_titles)?meta.alternative_titles.map(String):[],
   description:String(value('description')??''), poster:String(value('poster')??''), backdrop:String(value('backdrop')??''),
   medium:String(r.medium) as MediaItem['medium'], status:String(r.status) as MediaItem['status'], progress:Number(r.progress??0),
   total:value('episodes')==null?(r.total==null?undefined:Number(r.total)):Number(value('episodes')),
   year:value('year')==null?undefined:Number(value('year')), score:value('score')==null?undefined:Number(value('score')),
   genres:Array.isArray(value('genres'))?(value('genres') as unknown[]).map(String):[],
   themes:Array.isArray(value('themes'))?(value('themes') as unknown[]).map(String):[],
   studio:value('studio')?String(value('studio')):undefined, source:value('source')?String(value('source')):undefined,
   season:meta.season?String(meta.season):undefined, duration:meta.duration==null?undefined:Number(meta.duration),
   airStart:meta.air_start?String(meta.air_start):undefined, airEnd:meta.air_end?String(meta.air_end):undefined,
   favorite:Boolean(r.favorite), notes:r.notes?String(r.notes):undefined,
   game:rawData.game&&typeof rawData.game==='object'?rawData.game as MediaItem['game']:undefined
 };
}
function mediaToDbRow(item:MediaItem,userId:string){
 return {
   id:item.id,user_id:userId,parent_id:item.parentId??null,metadata_id:item.metadataId??null,anilist_id:item.anilistId??null,
   title:item.title,description:item.description,poster:item.poster,backdrop:item.backdrop,medium:item.medium,status:item.status,
   progress:item.progress,total:item.total??null,year:item.year??null,score:item.score??null,genres:item.genres,themes:item.themes,
   studio:item.studio??null,source:item.source??null,favorite:item.favorite,notes:item.notes??null,
   data:{source:item.anilistId?'anilist':'frame',provider:item.sourceProvider??null,externalId:item.externalId??null,game:item.game??null}
 };
}

export default function App(){
 const {user}=useAuth();
 const [items,setItems]=useState<MediaItem[]>(()=>{try{return JSON.parse(localStorage.getItem('frame-library')||'null')||starter}catch{return starter}});
 const [page,setPage]=useState('home'),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[selected,setSelected]=useState<MediaItem|null>(null),[add,setAdd]=useState(false),[aniSearch,setAniSearch]=useState(false),[menu,setMenu]=useState(false);
 useEffect(()=>{
   let cancelled=false;
   const load=async()=>{
     if(!supabase||!user?.id)return;
     const {data,error}=await supabase.from('media_items').select('*,media_metadata(*)').eq('user_id',user.id).order('created_at',{ascending:false});
     if(cancelled||error)return;
     const loaded=(data||[]).map(dbRowToMedia);
     setItems(loaded);
     try{localStorage.setItem('frame-library',JSON.stringify(loaded))}catch{}
   };
   void load();
   return()=>{cancelled=true};
 },[user?.id]);
 const save=(xs:MediaItem[])=>{
   setItems(xs);
   try{localStorage.setItem('frame-library',JSON.stringify(xs))}catch{}
   const client=supabase;
   if(client&&user?.id){
     void Promise.all(xs.map(item=>client.from('media_items').upsert(mediaToDbRow(item,user.id),{onConflict:'id'}))).catch(()=>{});
   }
 };
 const importMediaItem=(item:MediaItem)=>{
   const duplicate=items.find(x=>(item.anilistId&&x.anilistId===item.anilistId)||(item.sourceProvider&&item.externalId&&x.sourceProvider===item.sourceProvider&&x.externalId===item.externalId));
   if(duplicate){setSelected(duplicate);setAniSearch(false);return}
   const next=[item,...items];save(next);setSelected(item);setAniSearch(false);
 };
 const filtered=useMemo(()=>items.filter(x=>x.title.toLowerCase().includes(query.toLowerCase())&&(filter==='all'||x.status===filter||filter==='game'&&x.medium==='game'||filter==='book'&&x.medium==='book'||filter===x.medium)),[items,query,filter]);
 const watching=items.filter(x=>x.status==='watching'),games=items.filter(x=>x.medium==='game'),favorites=items.filter(x=>x.favorite);
 const nav=[['home','Home',HomeIcon],['library','Library',Library],['discover','Discover',Compass],['calendar','Release Radar',CalendarDays]] as const;
 return <div className="app"><header className="topbar"><button className="brand" onClick={()=>setPage('home')}><span>F</span>FRAME</button><nav className="desktop-nav">{nav.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={17}/>{label}</button>)}</nav><div className="top-actions"><label className="search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your library"/></label><button className="primary top-find" onClick={()=>setAniSearch(true)}><Search size={16}/> Find media</button><button className="icon-btn"><Bell size={18}/></button><button className="avatar" onClick={()=>setPage('settings')}>{(user?.email?.[0]||'F').toUpperCase()}</button><button className="mobile-menu-btn icon-btn" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></div></header>
 {menu&&<div className="mobile-nav">{nav.map(([id,label,Icon])=><button key={id} onClick={()=>{setPage(id);setMenu(false)}}><Icon size={18}/>{label}</button>)}</div>}
 <main>{page==='home'&&<Home items={items} watching={watching} games={games} favorites={favorites} open={setSelected} add={()=>setAniSearch(true)}/>}
 {page==='library'&&<LibraryPage items={filtered} query={query} filter={filter} setFilter={setFilter} open={setSelected} add={()=>setAdd(true)}/>}
 {page==='discover'&&<Discover add={()=>setAdd(true)}/>}
 {page==='calendar'&&<div className="page padded"><div className="page-title"><div><small>COMING UP</small><h1>Release Radar</h1><p>Episodes, chapters and game releases will appear here when automatic tracking is connected.</p></div></div></div>}
 {page==='settings'&&<div className="page padded"><div className="page-title"><div><small>ACCOUNT</small><h1>Settings</h1><p>{user?.email||'FRAME user'}</p></div></div><button className="danger" onClick={()=>signOut()}><LogOut size={17}/> Sign out</button></div>}</main>
 <div className="mobile-tabs">{nav.slice(0,3).map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={19}/><span>{label}</span></button>)}<button onClick={()=>setPage('settings')}><Settings size={19}/><span>Settings</span></button></div>
 {selected&&<Detail item={selected} close={()=>setSelected(null)} save={x=>save(items.map(i=>i.id===x.id?x:i))}/>} {add&&<Add close={()=>setAdd(false)} add={x=>save([x,...items])}/>} {aniSearch&&<AniListSearch close={()=>setAniSearch(false)} onImported={importMediaItem} onManual={()=>{setAniSearch(false);setAdd(true)}}/>}</div>
}
function Home({items,watching,games,favorites,open,add}:{items:MediaItem[];watching:MediaItem[];games:MediaItem[];favorites:MediaItem[];open:(x:MediaItem)=>void;add:()=>void}){const hero=items[0];return <div className="page"><section className="hero" style={{backgroundImage:'url('+hero.poster+')'}}><div className="hero-shade"/><div className="hero-content"><div className="eyebrow">YOUR MEDIA UNIVERSE</div><h1>{hero.title}</h1><p>{hero.description}</p><div className="hero-meta"><span><Star size={14} fill="currentColor"/> {hero.score}</span><span>{hero.year}</span><span>{hero.genres.join(' · ')}</span></div><button className="primary" onClick={()=>open(hero)}><Play size={17}/> Open title</button><button className="secondary" onClick={add}><CirclePlus size={17}/> Add media</button></div></section><section className="section stats-row"><Stat l="In library" n={items.length}/><Stat l="Watching" n={watching.length}/><Stat l="Games" n={games.length}/><Stat l="Favorites" n={favorites.length}/></section><Shelf title="Continue watching" items={watching} open={open}/><Shelf title="Games" items={games} open={open}/><Shelf title="Favorites" items={favorites} open={open}/></div>}
function Stat({l,n}:{l:string;n:number}){return <div className="stat"><b>{n}</b><span>{l}</span></div>}
function Shelf({title,items,open}:{title:string;items:MediaItem[];open:(x:MediaItem)=>void}){return <section className="section"><div className="section-head"><div><small>LIBRARY</small><h2>{title}</h2></div><ChevronRight/></div><div className="cards">{items.length?items.map(x=><Card key={x.id} item={x} open={open}/>):<div className="empty">Nothing here yet.</div>}</div></section>}
function Card({item,open}:{item:MediaItem;open:(x:MediaItem)=>void}){const p=item.medium==='game'?(item.game?.completionProgress||0):(item.total?item.progress/item.total*100:0);return <button className="media-card" onClick={()=>open(item)}><div className="poster"><img src={item.poster} alt=""/><span className="status">{item.medium==='game'?'GAME':labels[item.status]}</span><span className="score"><Star size={11} fill="currentColor"/> {item.score||'—'}</span></div><div className="card-copy"><b>{item.title}</b><span>{mediaTypes[item.medium]}</span><div className="progress"><i style={{width:p+'%'}}/></div><small>{item.medium==='game'?(item.game?.completionProgress||0)+'% complete':item.progress+(item.total?' / '+item.total:'')+' progress'}</small></div></button>}
function LibraryPage({items,query,filter,setFilter,open,add}:{items:MediaItem[];query:string;filter:string;setFilter:(x:string)=>void;open:(x:MediaItem)=>void;add:()=>void}){const fs:[string,string][]=[['All','all'],['Watching','watching'],['Completed','completed'],['Plan to Play/Watch','planned'],['Paused','paused'],['Dropped','dropped'],['Games','game'],['Books','book'],['Manhwa','manhwa'],['Light Novels','light-novel'],['Visual Novels','visual-novel']];return <div className="page padded"><div className="page-title"><div><small>YOUR COLLECTION</small><h1>Library</h1><p>{query?'Results for “'+query+'”':'Everything you follow, organized.'}</p></div><button className="primary" onClick={add}><CirclePlus size={17}/> Add media</button></div><div className="filter-row">{fs.map(f=><button className={filter===f[1]?'active':''} key={f[1]} onClick={()=>setFilter(f[1])}>{f[0]}</button>)}</div><div className="grid">{items.map(x=><Card key={x.id} item={x} open={open}/>)}</div></div>}
function Discover({add}:{add:()=>void}){return <div className="page padded"><div className="page-title"><div><small>EXPLORE</small><h1>Discover</h1><p>FRAME now supports games as a first-class media type.</p></div><button className="primary" onClick={add}><CirclePlus size={17}/> Add media</button></div><div className="discover-grid"><div><Tv/><h3>Anime</h3><p>Series, seasons, parts and specials.</p></div><div><BookOpen/><h3>Manga & Manhwa</h3><p>Track chapters and volumes.</p></div><div><Film/><h3>Movies & Series</h3><p>Keep every story together.</p></div><div><Gamepad2/><h3>Games</h3><p>Steam metadata, platforms, publishers, genres and cover art.</p></div><div><BookOpen/><h3>Books</h3><p>Open Library discovery for books and novels.</p></div></div></div>}
function Detail({item,close,save}:{item:MediaItem;close:()=>void;save:(x:MediaItem)=>void}){const [d,setD]=useState(item);const g=d.game;return <div className="overlay"><aside className="drawer"><button className="close" onClick={close}><X/></button><img className="detail-backdrop" src={d.poster} alt=""/><div className="detail"><div className="detail-poster"><img src={d.poster} alt=""/></div><div className="detail-main"><small>{mediaTypes[d.medium].toUpperCase()} · {d.medium==='game'?'GAME':labels[d.status]}</small><h2>{d.title}</h2><p>{d.description}</p><div className="chips">{d.genres.map(x=><span key={x}>{x}</span>)}</div>{g&&<div className="game-details"><b>Game details</b><span>Developer: {g.developer||'—'}</span><span>Publisher: {g.publisher||'—'}</span><span>Release: {g.releaseDate||'—'}</span><span>Platforms: {g.platforms?.join(', ')||'—'}</span><span>Mode: {g.gameModes?.join(', ')||'—'}</span><span>Playtime: {g.playtimeHours?g.playtimeHours+'h':'—'}</span><span>Difficulty: {g.difficulty||'—'}</span><span>Complexity: Story {g.complexity?.story||'—'}/5 · Gameplay {g.complexity?.gameplay||'—'}/5 · Systems {g.complexity?.systems||'—'}/5 · Exploration {g.complexity?.exploration||'—'}/5</span></div>}<div className="detail-progress"><div><b>{d.medium==='game'?'Story progress':'Progress'}</b><span>{d.medium==='game'?(g?.storyProgress||0)+'%':d.progress+(d.total?' / '+d.total:'')}</span></div><input type="range" min="0" max={d.medium==='game'?100:(d.total||2000)} value={d.medium==='game'?(g?.storyProgress||0):d.progress} onChange={e=>d.medium==='game'?setD({...d,game:{...g,storyProgress:Number(e.target.value)}}):setD({...d,progress:Number(e.target.value)})}/></div><button className="primary" onClick={()=>save(d)}><Play size={16}/> Save progress</button><button className="secondary" onClick={()=>setD({...d,favorite:!d.favorite})}><Heart size={16} fill={d.favorite?'currentColor':'none'}/></button></div></div></aside></div>}
function Add({close,add}:{close:()=>void;add:(x:MediaItem)=>void}){const [title,setTitle]=useState('');const [type,setType]=useState<Medium>('anime');const submit=(e:FormEvent)=>{e.preventDefault();if(!title.trim())return;const game=type==='game';add({id:crypto.randomUUID(),sourceProvider:'frame',title:title.trim(),description:'Added to FRAME.',poster,backdrop:'',status:'planned',progress:0,total:game?100:undefined,genres:[],themes:[],medium:type,favorite:false,...(game?{game:{storyProgress:0,completionProgress:0,complexity:{}}}: {})});close()};return <div className="modal-wrap"><div className="modal"><button className="close" onClick={close}><X/></button><small>ADD TO FRAME</small><h2>Start a new title</h2><form onSubmit={submit}><label>Title<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Grand Theft Auto III"/></label><label>Media type<select value={type} onChange={e=>setType(e.target.value as Medium)}>{Object.entries(mediaTypes).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><button className="primary full">Add to library</button></form></div></div>}

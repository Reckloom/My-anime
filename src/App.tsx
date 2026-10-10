import {useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,ChevronRight,CirclePlus,Compass,Gamepad2,Home as HomeIcon,Library,Link2,LogOut,Menu,MessageCircle,Radio,RefreshCw,Search,Star,Users,X} from 'lucide-react';
import {useAuth} from './auth/Auth';
import type {MediaItem,Medium} from './types';
import {AniListSearch} from './components/AniListSearch';
import {FrameGlobalChat} from './components/FrameGlobalChat';
import {FrameDetail} from './components/FrameDetail';
import {FrameSocial} from './components/FrameSocial';
import {CallsPage} from './components/FrameCalls';
import {FrameDirectCall} from './components/FrameDirectCall';
import {FramePopupHub} from './components/FramePopupHub';
import {FrameNotifications} from './components/FrameNotifications';
import {FrameCommandPalette} from './components/FrameCommandPalette';
import {FrameDataTools} from './components/FrameDataTools';
import {FrameLibraryImport} from './components/FrameLibraryImport';
import {FrameAnimeCatalogueImport} from './components/FrameAnimeCatalogueImport';
import {aniList,DETAIL_QUERY,SEARCH_QUERY,cleanDescription,titleOf} from './anilist';
import {FrameSpotifyControls} from './components/FrameSpotify';
import {supabase} from './lib/supabase';
import {FrameArtwork,artworkFallbackAncestor} from './components/FrameArtwork';

const poster='/frame-logo.svg';
const types:Record<Medium,string>={anime:'Anime',manga:'Manga',manhwa:'Manhwa','light-novel':'Light Novel','visual-novel':'Visual Novel',movie:'Movie',series:'Series',game:'Game',book:'Book'};
const unitFor=(m:Medium)=>({anime:'episodes',manga:'chapters',manhwa:'chapters','light-novel':'chapters','visual-novel':'%',movie:'watch state',series:'episodes',game:'%',book:'pages'} as Record<Medium,string>)[m];
type Profile={id:string;username:string;display_name:string;avatar_url?:string|null;bio?:string;frame_logo?:'ultra-instinct'|'classic-f'|'minimal-ring'|string|null};
type Radar={mediaId:string;anilistId:number;title:string;poster:string;episode:number;airingAt:string;released:boolean};

function normalise(item:MediaItem):MediaItem{
 const total=item.total&&item.total>0?item.total:(item.medium==='game'||item.medium==='visual-novel'?100:item.medium==='movie'?1:500);
 const cleanBackdrop=item.backdrop&&item.backdrop.trim()!==item.poster.trim()?item.backdrop:'';
 return {...item,poster:item.poster||poster,backdrop:cleanBackdrop,total,progress:Math.max(0,Math.min(item.progress||0,total)),progressUnit:item.progressUnit||unitFor(item.medium)};
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
  total:r.total==null?(data.customTotal==null?(v('episodes')==null?undefined:Number(v('episodes'))):Number(data.customTotal)):Number(r.total),
  year:v('year')==null?undefined:Number(v('year')),score:v('score')==null?undefined:Number(v('score')),
  personalRating:data.personalRating==null?undefined:Number(data.personalRating),progressUnit:data.progressUnit?String(data.progressUnit):undefined,
  customTotal:data.customTotal==null?undefined:Number(data.customTotal),
  genres:Array.isArray(v('genres'))?v('genres').map(String):[],themes:Array.isArray(v('themes'))?v('themes').map(String):[],
  studio:v('studio')?String(v('studio')):undefined,source:v('source')?String(v('source')):undefined,
  season:meta.season?String(meta.season):undefined,duration:meta.duration==null?undefined:Number(meta.duration),
  airStart:meta.air_start?String(meta.air_start):undefined,airEnd:meta.air_end?String(meta.air_end):undefined,
  favorite:Boolean(r.favorite),notes:r.notes?String(r.notes):undefined,
  nextRelease:r.next_release?String(r.next_release):undefined,nextReleaseNumber:r.next_release_number==null?undefined:Number(r.next_release_number),
  availability:data.availability as MediaItem['availability'],externalLinks:data.externalLinks&&typeof data.externalLinks==='object'?data.externalLinks as MediaItem['externalLinks']:undefined,game:data.game as MediaItem['game'],notificationsEnabled:data.frameReleaseRadar?.enabled!==false,releaseRadarState:data.frameReleaseRadar&&typeof data.frameReleaseRadar==='object'?data.frameReleaseRadar:undefined,
  episode:data.episode&&typeof data.episode==='object'?data.episode as MediaItem['episode']:undefined,
  characters:Array.isArray(data.characters)?data.characters as MediaItem['characters']:undefined
 });
}
function toRow(item:MediaItem,userId:string){
 return {id:item.id,user_id:userId,parent_id:item.parentId??null,metadata_id:item.metadataId??null,anilist_id:item.anilistId??null,title:item.title,description:item.description,poster:item.poster,backdrop:item.backdrop,medium:item.medium,status:item.status,progress:item.progress,total:item.medium==='movie'?1:(item.total??null),year:item.year??null,score:item.score??null,genres:item.genres,themes:item.themes,studio:item.studio??null,source:item.source??null,favorite:item.favorite,notes:item.notes??null,data:{provider:item.sourceProvider??null,externalId:item.externalId??null,personalRating:item.personalRating??null,progressUnit:item.progressUnit??unitFor(item.medium),customTotal:item.customTotal??item.total??null,availability:item.availability??null,externalLinks:item.externalLinks??null,game:item.game??null,frameReleaseRadar:{...(item.releaseRadarState||{}),enabled:item.notificationsEnabled!==false},episode:item.episode??null,characters:item.characters??null}};
}
function progressPercent(item:MediaItem){
 const total=item.total||item.customTotal||0;
 if(item.medium==='game'||item.medium==='visual-novel')return Math.max(0,Math.min(100,item.progress||0));
 if(item.medium==='movie')return item.progress>=1?100:0;
 if(total>0)return Math.max(0,Math.min(100,(item.progress/total)*100));
 return item.status==='completed'?100:0;
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

function FrameLogoMark({logo='frame-mark',small=false}:{logo?:string|null;small?:boolean}){ const mode=logo&&logo!=='ultra-instinct'?logo:'frame-mark'; if(mode.startsWith('http'))return <span className={'frame-logo-mark frame-mark '+(small?'small':'')}><img src={mode} alt="Custom FRAME logo"/></span>; if(mode==='classic-f')return <span className={'frame-logo-mark classic-f '+(small?'small':'')}>F</span>; if(mode==='minimal-ring')return <span className={'frame-logo-mark minimal-ring '+(small?'small':'')}><i/></span>; return <span className={'frame-logo-mark frame-mark '+(small?'small':'')}><img src="/frame-logo.svg" alt="FRAME logo"/></span>;}
function sameMedia(a:MediaItem,b:MediaItem){
 const aTitle=a.title.trim().toLowerCase().replace(/\\s+/g,' '),bTitle=b.title.trim().toLowerCase().replace(/\\s+/g,' ');
 if(a.anilistId&&b.anilistId)return a.anilistId===b.anilistId;
 if(a.sourceProvider&&a.externalId&&b.sourceProvider&&b.externalId)return a.sourceProvider===b.sourceProvider&&a.externalId===b.externalId;
 return a.medium===b.medium&&a.parentId===b.parentId&&aTitle===bTitle;
}
function dedupeMediaItems(items:MediaItem[]){
 const merged:MediaItem[]=[];
 for(const raw of items){
  const incoming=normalise(raw); const index=merged.findIndex(x=>sameMedia(x,incoming));
  if(index<0){merged.push(incoming);continue}
  const current=merged[index];
  merged[index]=normalise({...current,
   id:current.id,parentId:incoming.parentId??current.parentId,metadataId:current.metadataId??incoming.metadataId,
   status:incoming.status||current.status,progress:incoming.progress??current.progress,total:incoming.total??current.total,
   customTotal:incoming.customTotal??current.customTotal,personalRating:incoming.personalRating??current.personalRating,
   favorite:incoming.favorite??current.favorite,notes:incoming.notes??current.notes
  });
 }
 return merged;
}
function mergeMediaLists(primary:MediaItem[],secondary:MediaItem[]){
 const merged=dedupeMediaItems(primary);
 for(const incomingRaw of secondary){
  const incoming=normalise(incomingRaw);
  const index=merged.findIndex(x=>sameMedia(x,incoming));
  if(index<0){merged.push(incoming);continue}
  const current=merged[index];
  // One Piece episode-to-arc assignments are database-authoritative. Older
  // browser caches can hold stale parent links and make entire arcs look empty.
  const isOnePieceEpisode=String(current.externalId||current.id).startsWith('one-piece-episode-');
  const mergedParentId=isOnePieceEpisode?(current.parentId??incoming.parentId):(incoming.parentId??current.parentId);
  merged[index]=normalise({...current,id:current.id,parentId:mergedParentId,metadataId:current.metadataId??incoming.metadataId,status:incoming.status||current.status,progress:incoming.progress??current.progress,total:incoming.total??current.total,customTotal:incoming.customTotal??current.customTotal,personalRating:incoming.personalRating??current.personalRating,favorite:incoming.favorite??current.favorite,notes:incoming.notes??current.notes});
 }
 return dedupeMediaItems(merged);
}
export default function App(){
 const {user,signOut}=useAuth(),guest=!user&&localStorage.getItem('frame-guest')==='1',uid=user?.id||'guest';
 const storageKey=guest?'frame-library:guest':`frame-library:${uid}`;
 const [cloudLibraryReady,setCloudLibraryReady]=useState(false);
 const [items,setItems]=useState<MediaItem[]>(()=>{
  try{
   const scoped=localStorage.getItem(storageKey);
   if(scoped)return dedupeMediaItems(JSON.parse(scoped).map(normalise));
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
 const itemsRef=useRef<MediaItem[]>(items);
 useEffect(()=>{itemsRef.current=items},[items]);
 const [page,setPage]=useState('home'),[query,setQuery]=useState(''),[filters,setFilters]=useState<string[]>(['all']),[sortMode,setSortMode]=useState('rating');
 const [finder,setFinder]=useState(false),[manualEntry,setManualEntry]=useState(false),[selected,setSelected]=useState<MediaItem|null>(null),[menu,setMenu]=useState(false),[profile,setProfile]=useState<Profile|null>(null),[appMessage,setAppMessage]=useState('');
 const [directCall,setDirectCall]=useState<Profile|null>(null),[friendLibrary,setFriendLibrary]=useState<string|null>(null),[commandOpen,setCommandOpen]=useState(false);
 const [releaseNotificationsEnabled,setReleaseNotificationsEnabled]=useState(true);
 const [radar,setRadar]=useState<Radar[]>([]),[radarBusy,setRadarBusy]=useState(false),[radarError,setRadarError]=useState('');
 const [density,setDensity]=useState('comfortable'),[theme,setTheme]=useState('cinematic-archive'),[appearanceMode,setAppearanceMode]=useState<'light'|'dark'|'system'>('dark');
 const [connections,setConnections]=useState<Record<string,boolean>>({anilist:true,steam:true,tvmaze:true,vndb:true,openlibrary:true,imdb:true,justwatch:true});
 const saveQueue=useRef(Promise.resolve(true));
 const onePieceAutoRef=useRef('');
 const narutoAutoRef=useRef('');
 const narutoArtworkRef=useRef('');
 const onePieceArcArtworkRef=useRef('');
 const onePiecePosterCatalogueRef=useRef<Record<string,string>>({});

 useEffect(()=>{document.documentElement.dataset.density=density;document.documentElement.dataset.frameTheme=theme;document.documentElement.dataset.frameMode=appearanceMode},[density,theme,appearanceMode]); useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setCommandOpen(true);return}if(e.key==='Escape'){setCommandOpen(false);setFinder(false);setManualEntry(false);setSelected(null);setMenu(false)}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);

 useEffect(()=>{
  try{localStorage.setItem(storageKey,JSON.stringify(items))}catch{}
 },[items,storageKey]);
 useEffect(()=>{if(!guest)return;try{const raw=localStorage.getItem('frame-guest-preferences');const prefs=raw?JSON.parse(raw):{};if(typeof prefs.release_notifications_enabled==='boolean')setReleaseNotificationsEnabled(prefs.release_notifications_enabled);if(prefs.default_sort)setSortMode(String(prefs.default_sort));if(prefs.density)setDensity(String(prefs.density));if(prefs.theme&&['cinematic-archive','midnight-glass','clean-editorial','full-screen-epic','collectors-archive','modern-media-hub'].includes(String(prefs.theme)))setTheme(String(prefs.theme));if(prefs.appearance_mode&&['light','dark','system'].includes(String(prefs.appearance_mode)))setAppearanceMode(String(prefs.appearance_mode) as 'light'|'dark'|'system')}catch{}},[guest]);

 useEffect(()=>{
  const client=supabase;
  if(!client||!user?.id)return;
  let active=true;
  const load=async()=>{
   setCloudLibraryReady(false);
   const cleanStartKey=`frame-clean-start-2026-10-08:${user.id}`;
   if(!localStorage.getItem(cleanStartKey)){
    localStorage.removeItem('frame-library:guest');
    localStorage.removeItem('frame-library');
    localStorage.removeItem(`frame-library:${user.id}`);
    try{localStorage.setItem(cleanStartKey,'1')}catch{}
   }
   const guestRaw=localStorage.getItem('frame-library:guest');
   let guestItems:MediaItem[]=[];
   try{const parsed=guestRaw?JSON.parse(guestRaw):[];if(Array.isArray(parsed))guestItems=parsed.map(normalise)}catch{}
   const scopedRaw=localStorage.getItem(`frame-library:${user.id}`);
   let scopedItems:MediaItem[]=[];
   try{const parsed=scopedRaw?JSON.parse(scopedRaw):[];if(Array.isArray(parsed))scopedItems=parsed.map(normalise)}catch{}
   const guestPrefsRaw=localStorage.getItem('frame-guest-preferences');
   let guestPrefs:Record<string,string>={};
   try{const parsed=guestPrefsRaw?JSON.parse(guestPrefsRaw):{};if(parsed&&typeof parsed==='object')guestPrefs=parsed as Record<string,string>}catch{}
   // Supabase/PostgREST commonly caps each response at 1,000 rows. Page through
   // the full account library so lower-scored records are never silently omitted.
   const allCloudRows:any[]=[];
   const pageSize=500;
   let offset=0;
   while(true){
    const {data:pageData,error}=await client.from('media_items').select('*,media_metadata(*)')
     .eq('user_id',user.id).order('score',{ascending:false}).order('id',{ascending:true})
     .range(offset,offset+pageSize-1);
    if(error){
     console.warn('[FRAME cloud library load]',error);
     // Keep the local cache on transient failures; never replace a library with [].
     if(active)setCloudLibraryReady(true);
     return;
    }
    allCloudRows.push(...(pageData||[]));
    if(!pageData||pageData.length<pageSize)break;
    offset+=pageSize;
   }
   if(active){
    const cloudItems=dedupeMediaItems(allCloudRows.map(dbToMedia));
    // Authenticated cloud data is authoritative. Keep local values only when they
    // already correspond to a cloud record; never resurrect stale browser-only titles.
    const syncedLocal=scopedItems.filter(local=>cloudItems.some(cloud=>sameMedia(cloud,local)));
    const localOverrides=guestItems.length?mergeMediaLists(syncedLocal,guestItems):syncedLocal;
    const merged=localOverrides.length?mergeMediaLists(cloudItems,localOverrides):cloudItems;
    setItems(merged);setCloudLibraryReady(true);
    try{localStorage.setItem(`frame-library:${user.id}`,JSON.stringify(merged))}catch{}
    // Do not auto-import the guest cache after authentication; it can contain
    // obsolete browser-only records. The account library is the source of truth.
    if(guestItems.length)localStorage.removeItem('frame-library:guest');
const {data:prefs}=await client.from('user_preferences').select('*').eq('user_id',user.id).maybeSingle();if(prefs&&typeof prefs.release_notifications_enabled==='boolean')setReleaseNotificationsEnabled(prefs.release_notifications_enabled);
    const effectivePrefs={...(prefs||{}),...guestPrefs};
    if(Object.keys(effectivePrefs).length){
     setSortMode(String(effectivePrefs.default_sort||'rating'));setDensity(String(effectivePrefs.density||'comfortable'));
     const savedTheme=String(effectivePrefs.theme||'cinematic-archive');setTheme((['cinematic-archive','midnight-glass','clean-editorial','full-screen-epic','collectors-archive','modern-media-hub'].includes(savedTheme)?savedTheme:'cinematic-archive'));
     setAppearanceMode((['light','dark','system'].includes(String(effectivePrefs.appearance_mode))?String(effectivePrefs.appearance_mode):'light') as 'light'|'dark'|'system');
     if(Object.keys(guestPrefs).length){const {error}=await client.from('user_preferences').upsert({...guestPrefs,user_id:user.id,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(!error)localStorage.removeItem('frame-guest-preferences')}
    }
   }
   const {data:p}=await client.from('profiles').select('*').eq('id',user.id).maybeSingle();
   if(p)setProfile({...p,frame_logo:p.frame_logo||'ultra-instinct'} as Profile);
   else{
    const base=(user.email?.split('@')[0]||'frameuser').replace(/[^A-Za-z0-9_]/g,'').slice(0,18)||'frameuser';
    const username=base+'_'+user.id.replace(/-/g,'').slice(0,6);
    const {data:created}=await client.from('profiles').upsert({id:user.id,username,display_name:user.email?.split('@')[0]||'FRAME User',bio:'',frame_logo:'ultra-instinct'},{onConflict:'id'}).select().maybeSingle();
    if(created)setProfile({...created,frame_logo:created.frame_logo||'ultra-instinct'} as Profile);
   }
   
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

 const save=async(list:MediaItem[])=>{
  // Never run a destructive cloud reconciliation against a partially loaded library.
  if(supabase&&user?.id&&!cloudLibraryReady){
   setAppMessage('Your full library is still loading. Please try that change again in a moment.');
   window.setTimeout(()=>setAppMessage(''),4000);
   return false;
  }
  const next=dedupeMediaItems(list.map(normalise));itemsRef.current=next;setItems(next);try{localStorage.setItem(storageKey,JSON.stringify(next))}catch{}
  const client=supabase;
  if(!client||!user?.id)return true;
  const operation=saveQueue.current.then(async()=>{
  try{
   if(next.length===0){const {error}=await client.from('media_items').delete().eq('user_id',user.id);if(error){setAppMessage('Cloud save failed: '+error.message);window.setTimeout(()=>setAppMessage(''),5000);return false}return true}
   const {error}=await client.from('media_items').upsert(next.map(item=>toRow(item,user.id)),{onConflict:'id'});
   if(error){setAppMessage('Cloud save failed: '+error.message);window.setTimeout(()=>setAppMessage(''),5000);return false}
   // Verify all rows before cleanup; one select() would only see the first 1,000.
   const cloudRows:any[]=[];
   const verifyPageSize=500;
   let verifyOffset=0;
   while(true){
    const {data:pageData,error:cloudReadError}=await client.from('media_items').select('id')
     .eq('user_id',user.id).order('id',{ascending:true}).range(verifyOffset,verifyOffset+verifyPageSize-1);
    if(cloudReadError){setAppMessage('Cloud sync check failed: '+cloudReadError.message);window.setTimeout(()=>setAppMessage(''),5000);return false}
    cloudRows.push(...(pageData||[]));
    if(!pageData||pageData.length<verifyPageSize)break;
    verifyOffset+=verifyPageSize;
   }
   const keep=new Set(next.map(item=>item.id));
   const stale=cloudRows.map(row=>String(row.id)).filter(id=>!keep.has(id));
   if(stale.length){
    const {error:deleteError}=await client.from('media_items').delete().eq('user_id',user.id).in('id',stale);
    if(deleteError){setAppMessage('Cloud cleanup failed: '+deleteError.message);window.setTimeout(()=>setAppMessage(''),5000);return false}
   }
   return true;
  }catch(e){setAppMessage('Cloud save failed: '+(e instanceof Error?e.message:'Please try again.'));window.setTimeout(()=>setAppMessage(''),5000);return false}
  });
  saveQueue.current=operation.catch(()=>true);
  return operation;
 };


 const importAnimeBatch=async(incoming:MediaItem[])=>{
  const client=supabase;
  if(!client||!user?.id){setAppMessage('Sign in to import anime catalogue data.');return false}
  if(!cloudLibraryReady){setAppMessage('The full library is still loading. Please retry the import batch shortly.');return false}
  const merged=dedupeMediaItems(itemsRef.current);
  const changed=new Map<string,MediaItem>();
  for(const raw of incoming){
   const item=normalise(raw);
   const found=merged.findIndex(existing=>
    Boolean(item.anilistId&&existing.anilistId===item.anilistId&&existing.medium===item.medium)||
    Boolean(item.sourceProvider&&item.externalId&&existing.sourceProvider===item.sourceProvider&&existing.externalId===item.externalId)||
    existing.id===item.id||
    (item.sourceProvider!=='frame-anime-episode'&&existing.medium===item.medium&&existing.title.trim().toLocaleLowerCase()===item.title.trim().toLocaleLowerCase()&&existing.parentId===item.parentId)
   );
   if(found<0){merged.push(item);changed.set(item.id,item);continue}
   const current=merged[found];
   // Source refreshes may update catalogue metadata and totals, but the user's
   // progress/status are authoritative. Never mark episodes watched or rewind
   // progress just because an import batch contains different defaults.
   const customTotal=current.customTotal??item.customTotal;
   const total=customTotal!=null?customTotal:(item.total!=null?item.total:current.total);
   const progress=Math.max(0,Number(current.progress)||0);
   const next=normalise({
    ...current,...item,id:current.id,parentId:item.parentId??current.parentId,
    metadataId:current.metadataId??item.metadataId,total,
    customTotal,progress,
    status:current.status||item.status,personalRating:current.personalRating??item.personalRating,
    favorite:current.favorite,notes:current.notes??item.notes,
    poster:item.poster&&item.poster!=='/frame-logo.svg'?item.poster:current.poster||item.poster,
    backdrop:item.backdrop||current.backdrop,description:item.description||current.description,
    genres:item.genres?.length?item.genres:current.genres,themes:item.themes?.length?item.themes:current.themes,
    studio:item.studio||current.studio,characters:item.characters?.length?item.characters:current.characters,
    externalLinks:{...(current.externalLinks||{}),...(item.externalLinks||{})},game:current.game??item.game
   });
   merged[found]=next;changed.set(next.id,next);
  }
  const rows=[...changed.values()].map(item=>toRow(item,user.id));
  for(let offset=0;offset<rows.length;offset+=100){
   const batch=rows.slice(offset,offset+100);
   const {data,error}=await client.from('media_items').upsert(batch,{onConflict:'id'}).select('id');
   if(error){setAppMessage('Catalogue batch save failed: '+error.message+'. Completed batches remain safe to resume.');window.setTimeout(()=>setAppMessage(''),7000);return false}
   if((data||[]).length!==batch.length){setAppMessage('Catalogue batch verification returned '+(data||[]).length+' of '+batch.length+' records. Resume the import to verify again.');window.setTimeout(()=>setAppMessage(''),7000);return false}
  }
  itemsRef.current=merged;setItems(merged);
  try{localStorage.setItem(storageKey,JSON.stringify(merged))}catch{}
  return true;
 };

 const buildNarutoHierarchy=async(rawRoot:MediaItem,openAfterSave=false)=>{
  setAppMessage('Building the Naruto and Naruto Shippuden episode catalogue…');
  const rootId=rawRoot.id;
  const originalId='naruto-part-original-'+rootId;
  const shippudenId='naruto-part-shippuden-'+rootId;
  const previousOriginal=items.find(x=>x.id===originalId||(x.parentId===rootId&&x.sourceProvider==='frame-naruto-part'&&x.externalId==='naruto-part-original'));
  const previousShippuden=items.find(x=>x.id===shippudenId||(x.parentId===rootId&&x.sourceProvider==='frame-naruto-part'&&x.externalId==='naruto-part-shippuden'));
  const originalProgress=Math.max(0,Math.min(220,previousOriginal?.progress??220));
  const shippudenProgress=Math.max(0,Math.min(500,previousShippuden?.progress??500));
  const original:MediaItem={
   id:previousOriginal?.id||originalId,parentId:rootId,sourceProvider:'frame-naruto-part',externalId:'naruto-part-original',
   title:'Naruto',description:'The original Naruto TV anime — 220 numbered episodes, including filler and anime-original episodes. Story arcs and individual episode entries are organised below.',
   poster:'https://cdn.myanimelist.net/images/anime/13/17405.jpg',backdrop:'https://cdn.myanimelist.net/images/anime/13/17405.jpg',
   medium:'anime',status:originalProgress>=220?'completed':originalProgress>0?'watching':'planned',progress:originalProgress,total:220,customTotal:220,year:2002,
   score:previousOriginal?.score,personalRating:previousOriginal?.personalRating,genres:['Action','Adventure','Fantasy'],themes:['Ninja','Martial Arts'],favorite:previousOriginal?.favorite??false,
   notes:'FRAME_NARUTO_PART=original-v2. Episode catalogue: MyAnimeList / Jikan (MAL ID 20), enriched with Kitsu episode thumbnails when available.',
   availability:{watch:['https://www.crunchyroll.com/series/GY9PJ5KWR/naruto']},externalLinks:{malId:'20',officialUrl:'https://naruto-official.com/en'}
  };
  const shippuden:MediaItem={
   id:previousShippuden?.id||shippudenId,parentId:rootId,sourceProvider:'frame-naruto-part',externalId:'naruto-part-shippuden',
   title:'Naruto Shippuden',description:'Naruto’s return and the next stage of the ninja world — 500 numbered episodes, including filler and anime-original episodes. Story arcs and individual episode entries are organised below.',
   poster:'https://cdn.myanimelist.net/images/anime/5/17407.jpg',backdrop:'https://cdn.myanimelist.net/images/anime/5/17407.jpg',
   medium:'anime',status:shippudenProgress>=500?'completed':shippudenProgress>0?'watching':'planned',progress:shippudenProgress,total:500,customTotal:500,year:2007,
   score:previousShippuden?.score,personalRating:previousShippuden?.personalRating,genres:['Action','Adventure','Fantasy'],themes:['Ninja','Martial Arts'],favorite:previousShippuden?.favorite??false,
   notes:'FRAME_NARUTO_PART=shippuden-v2. Episode catalogue: MyAnimeList / Jikan (MAL ID 1735), enriched with Kitsu episode thumbnails when available.',
   availability:{watch:['https://www.crunchyroll.com/series/GYQ4MW246/naruto-shippuden']},externalLinks:{malId:'1735',officialUrl:'https://naruto-official.com/en'}
  };
  const priorRoot=items.find(x=>x.id===rootId)||rawRoot;
  const root=normalise({
   ...priorRoot,title:'Naruto',medium:'anime',total:720,customTotal:720,progress:originalProgress+shippudenProgress,
   status:originalProgress+shippudenProgress>=720?'completed':'watching',
   poster:'https://cdn.myanimelist.net/images/anime/13/17405.jpg',
   backdrop:'https://cdn.myanimelist.net/images/anime/13/17405.jpg',
   year:2002,genres:['Action','Adventure','Fantasy'],themes:['Ninja','Martial Arts'],
   description:'The complete Naruto anime library, organised into two direct subparts: Naruto (220 episodes) and Naruto Shippuden (500 episodes). Each subpart contains story-arc groups and individual episode entries.',
   externalLinks:{...(priorRoot.externalLinks||{}),officialUrl:'https://naruto-official.com/en'},
   notes:[priorRoot.notes,'FRAME_NARUTO_HIERARCHY=v2. Main entry: Naruto. Direct subparts: Naruto (220 episodes) and Naruto Shippuden (500 episodes). Each part is organised into story-arc groups with numbered episode records.'].filter(Boolean).join('\n\n')
  });
  const loadKitsuEpisodes=async(title:string,expected:number)=>{
   const response=await fetch('https://kitsu.io/api/edge/anime?filter[text]='+encodeURIComponent(title)+'&page[limit]=20');
   if(!response.ok)throw new Error('Kitsu search HTTP '+response.status);
   const search=await response.json() as any;
   const matches=Array.isArray(search.data)?search.data:[];
   const normalizedTitle=title.toLowerCase().replace(/[^a-z0-9]/g,'');
   const anime=matches.find((x:any)=>String(x?.attributes?.canonicalTitle||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'')===normalizedTitle)
 ;
   if(!anime?.id)throw new Error('Kitsu did not identify '+title);
   const result:any[]=[];
   const limit=20;
   const fetchPage=async(offset:number)=>{
    const r=await fetch('https://kitsu.io/api/edge/anime/'+encodeURIComponent(String(anime.id))+'/episodes?page[limit]='+limit+'&page[offset]='+offset);
    if(!r.ok)throw new Error('Kitsu episode page HTTP '+r.status);
    return await r.json() as any;
   };
   const first=await fetchPage(0);
   const total=Math.min(Number(first.meta?.count||expected),expected);
   const add=(page:any)=>{for(const row of Array.isArray(page.data)?page.data:[]){
    const a=row?.attributes||{},number=Number(a.number);
    if(!Number.isInteger(number)||number<1||number>expected)continue;
    result.push({number,title:String(a.canonicalTitle||a.titles?.en_us||a.titles?.en||a.titles?.en_jp||'').trim(),aired:String(a.airdate||a.airDate||''),synopsis:String(a.synopsis||a.description||''),poster:String(typeof a.thumbnail==='string'?a.thumbnail:(a.thumbnail?.original||a.thumbnail?.large||a.thumbnail?.medium||'')),source:'Kitsu'});
   }};
   add(first);
   const offsets:number[]=[];
   for(let offset=limit;offset<total;offset+=limit)offsets.push(offset);
   for(let i=0;i<offsets.length;i+=4){const pages=await Promise.all(offsets.slice(i,i+4).map(fetchPage));pages.forEach(add)}
   return result;
  };
  const loadJikanEpisodes=async(malId:string,expected:number)=>{
   const result:any[]=[];
   const pages=Math.ceil(expected/100);
   for(let page=1;page<=pages;page++){
    let lastError:unknown;
    for(let attempt=0;attempt<3;attempt++){
     try{
      const response=await fetch('https://api.jikan.moe/v4/anime/'+malId+'/episodes?page='+page+'&limit=100');
      if(!response.ok)throw new Error('Jikan HTTP '+response.status);
      const data=await response.json() as any;
      for(const row of Array.isArray(data.data)?data.data:[]){
       const number=Number(row.mal_id);
       if(Number.isInteger(number)&&number>=1&&number<=expected)result.push({number,title:String(row.title||''),aired:String(typeof row.aired==='string'?row.aired:(row.aired?.from||'')),synopsis:String(row.synopsis||''),poster:'',source:'MyAnimeList / Jikan'});
      }
      lastError=null;break;
     }catch(error){lastError=error;if(attempt<2)await new Promise(resolve=>window.setTimeout(resolve,1000*(attempt+1)))}
    }
    if(lastError)throw lastError;
    if(page<pages)await new Promise(resolve=>window.setTimeout(resolve,1100));
   }
   return result;
  };
  const loadEpisodes=async(title:string,malId:string,total:number)=>{
   let rows:any[]=[];
   try{rows=await loadKitsuEpisodes(title,total)}catch(error){console.warn('[FRAME Naruto Kitsu catalogue]',title,error)}
   if(rows.length<Math.min(total,Math.floor(total*.65))){
    try{const jikan=await loadJikanEpisodes(malId,total);if(jikan.length>rows.length)rows=jikan.map((j:any)=>({...j,poster:rows.find((k:any)=>k.number===j.number)?.poster||j.poster,source:rows.find((k:any)=>k.number===j.number)?.source||j.source,synopsis:rows.find((k:any)=>k.number===j.number)?.synopsis||j.synopsis}))}catch(error){console.warn('[FRAME Naruto Jikan catalogue]',title,error)}
   }
   const byNumber=new Map<number,any>();
   for(const row of rows){const old=byNumber.get(row.number);if(!old||(!old.title&&row.title)||(!old.poster&&row.poster))byNumber.set(row.number,{...old,...row,title:row.title||old?.title||''})}
   return Array.from({length:total},(_,i)=>{const number=i+1,found=byNumber.get(number)||{};return {...found,number,title:String(found.title||('Episode '+number)),poster:String(found.poster||''),source:String(found.source||'Episode metadata unavailable')}})
  };
  const originalEpisodes=await loadEpisodes('Naruto','20',220);
  const shippudenEpisodes=await loadEpisodes('Naruto Shippuden','1735',500);
  const originalArcs=[
   {name:'Land of Waves',start:1,end:19},{name:'Chunin Exams',start:20,end:67},{name:'Konoha Crush',start:68,end:80},
   {name:'Search for Tsunade',start:81,end:100},{name:'Kakashi’s Face / transition',start:101,end:106},
   {name:'Sasuke Recovery Mission',start:107,end:135},{name:'Anime-original & filler arcs',start:136,end:220}
  ];
  const shippudenArcs=[
   {name:'Kazekage Rescue',start:1,end:32},{name:'Tenchi Bridge Reconnaissance',start:33,end:53},
   {name:'Twelve Guardian Ninja (filler)',start:54,end:71},{name:'Akatsuki Suppression',start:72,end:88},
   {name:'Three-Tails Appearance (filler)',start:89,end:112},{name:'Itachi Pursuit',start:113,end:118},
   {name:'Tale of Jiraiya',start:119,end:133},{name:'Fated Battle Between Brothers',start:134,end:143},
   {name:'Six-Tails Unleashed (filler)',start:144,end:151},{name:'Pain’s Assault',start:152,end:175},
   {name:'Past Arc: The Locus of Konoha',start:176,end:196},{name:'Five Kage Summit',start:197,end:214},
   {name:'Fourth Shinobi War: Countdown',start:215,end:222},{name:'Paradise Life on a Boat (filler)',start:223,end:242},
   {name:'Nine-Tails Taming and Karmic Encounters',start:243,end:256},{name:'War preparations / flashback episodes',start:257,end:260},
   {name:'Fourth Shinobi War: Confrontation',start:261,end:289},{name:'Power (special arc)',start:290,end:295},
   {name:'Fourth Shinobi War: Climax',start:296,end:320},{name:'Fourth Shinobi War: Obito',start:321,end:348},
   {name:'Kakashi: Shadow of the ANBU Black Ops',start:349,end:361},{name:'Fourth Shinobi War: Return',start:362,end:375},
   {name:'Birth of the Ten-Tails’ Jinchuriki',start:376,end:393},{name:'In Naruto’s Footsteps: The Friends’ Paths',start:394,end:413},
   {name:'Origins of Ninshu',start:414,end:431},{name:'Jiraiya Shinobi Handbook',start:432,end:450},
   {name:'Itachi Shinden',start:451,end:458},{name:'Kaguya Otsutsuki Strikes',start:459,end:479},
   {name:'Childhood',start:480,end:483},{name:'Sasuke Shinden',start:484,end:488},
   {name:'Shikamaru Hiden',start:489,end:493},{name:'Konoha Hiden',start:494,end:500}
  ];
  const priorById=new Map(items.map(x=>[x.id,x]));
  const created:MediaItem[]=[root,original,shippuden];
  const usedPosters=new Set<string>([root.poster,original.poster,shippuden.poster].filter(Boolean));
  const makePartHierarchy=(part:MediaItem,partKey:'original'|'shippuden',episodes:any[],arcs:Array<{name:string;start:number;end:number}>,watchedThrough:number,malId:string)=>{
   for(const arc of arcs){
    const arcId='naruto-arc-'+partKey+'-'+arc.start+'-'+arc.end+'-'+rootId;
    const arcEpisodes=episodes.filter(e=>e.number>=arc.start&&e.number<=arc.end);
    const oldArc=priorById.get(arcId);
    const candidates=arcEpisodes.map(e=>String(e.poster||'').trim()).filter(url=>url&&!usedPosters.has(url));
    const arcPoster=candidates[0]||part.poster;
    if(arcPoster)usedPosters.add(arcPoster);
    const arcProgress=Math.max(0,Math.min(arc.end,watchedThrough)-arc.start+1);
    const arcItem:MediaItem={
     id:arcId,parentId:part.id,sourceProvider:'frame-naruto-arc',externalId:'naruto-arc-'+partKey+'-'+arc.start+'-'+arc.end,
     title:arc.name,description:arc.name+' · episodes '+arc.start+'–'+arc.end+' ('+arcEpisodes.length+' numbered episodes)',
     poster:arcPoster,backdrop:arcPoster,medium:'anime',status:arcProgress>=arcEpisodes.length?'completed':arcProgress>0?'watching':'planned',
     progress:Math.max(0,Math.min(arcEpisodes.length,arcProgress)),total:arcEpisodes.length,year:part.year,genres:part.genres,themes:part.themes,
     favorite:oldArc?.favorite??false,personalRating:oldArc?.personalRating,score:oldArc?.score,
     notes:'FRAME_NARUTO_ARC=v1. Grouped by the Naruto episode catalogue. Numbering is relative to '+part.title+'.'
    };
    created.push(arcItem);
    for(const e of arcEpisodes){
     const episodeId='naruto-episode-'+partKey+'-'+e.number+'-'+rootId;
     const prior=priorById.get(episodeId);
     let episodePoster=String(e.poster||'').trim();
     if(episodePoster&&usedPosters.has(episodePoster))episodePoster='';
     if(episodePoster)usedPosters.add(episodePoster);
     const aired=String(e.aired||'');
     const airDate=aired?aired.slice(0,10):undefined;
     const googleImageSearchUrl='https://www.google.com/search?tbm=isch&q='+encodeURIComponent(part.title+' episode '+e.number+' '+e.title+' official still');
     created.push({
      id:episodeId,parentId:arcId,sourceProvider:'frame-naruto-episode',externalId:'naruto-episode-'+partKey+'-'+e.number,
      title:String(e.number)+'. '+String(e.title||('Episode '+e.number)),description:cleanDescription(String(e.synopsis||''))||('Episode '+e.number+' of '+part.title+'.'),
      poster:episodePoster||part.poster,backdrop:episodePoster||part.poster,medium:'anime',
      status:e.number<=watchedThrough?'completed':(prior?.status||'planned'),progress:e.number<=watchedThrough?1:Math.min(prior?.progress??0,1),total:1,
      year:airDate?Number(airDate.slice(0,4))||part.year:part.year,score:prior?.score,personalRating:prior?.personalRating,
      genres:part.genres,themes:part.themes,favorite:prior?.favorite??false,season:arc.name,
      episode:{seasonNumber:1,episodeNumber:e.number,episodeCode:(partKey==='original'?'NARUTO':'SHIPPUDEN')+' EP '+String(e.number).padStart(3,'0'),airDate,ratingSource:e.source||'Episode metadata unavailable',googleImageSearchUrl,posterSource:episodePoster?'kitsu-episode-thumbnail':'not-available',posterVersion:'naruto-episodes-v1',synopsis:cleanDescription(String(e.synopsis||''))||undefined},
      externalLinks:{malId,officialUrl:'https://naruto-official.com/en',newsUrl:googleImageSearchUrl},
      notes:prior?.notes
     });
    }
   }
  };
  makePartHierarchy(original,'original',originalEpisodes,originalArcs,originalProgress,'20');
  makePartHierarchy(shippuden,'shippuden',shippudenEpisodes,shippudenArcs,shippudenProgress,'1735');
  const descendants=new Set<string>([rootId]);
  let changed=true;
  while(changed){changed=false;for(const entry of items){if(entry.parentId&&descendants.has(entry.parentId)&&!descendants.has(entry.id)){descendants.add(entry.id);changed=true}}}
  const remaining=items.filter(x=>!descendants.has(x.id));
  const ok=await save([...created,...remaining]);
  if(ok){
   narutoAutoRef.current=rootId+':ready';
   setAppMessage('Naruto library ready: 2 subparts, '+(originalArcs.length+shippudenArcs.length)+' story groups and 720 numbered episode entries.');
   window.setTimeout(()=>setAppMessage(''),8000);
   if(openAfterSave)setSelected(root);
  }
  return ok;
 };
 const ONE_PIECE_SERIES_POSTER='https://media.themoviedb.org/t/p/w500/dB4EDhre2dsC2kxYDavyKWqLQwi.jpg';
 const buildOnePieceHierarchy=async(rawRoot:MediaItem,existingRoot=false)=>{
  let root=normalise({...rawRoot,poster:ONE_PIECE_SERIES_POSTER,
   description:[rawRoot.description,'One Piece anime library: the main entry holds series-level details, while arc entries contain the episode catalogue with titles, synopses, air dates, available stills and episode scores. IMDb links are included for checking IMDb directly; scores displayed in FRAME are explicitly labelled with their actual source.'].filter(Boolean).join('\n\n'),
   availability:{watch:['https://www.crunchyroll.com/series/GRMG8ZQZR/one-piece','https://www.netflix.com/title/80107103'],read:['https://one-piece.com/']},
   externalLinks:{...(rawRoot.externalLinks||{}),imdbId:'tt0388629',officialUrl:'https://one-piece.com/anime/',newsUrl:'https://one-piece.com/news/',malId:'21'},
   notes:[rawRoot.notes,'Official site: https://one-piece.com/','Official anime catalogue: https://www.crunchyroll.com/series/GRMG8ZQZR/one-piece','Netflix catalogue: https://www.netflix.com/title/80107103','News: https://one-piece.com/news/','Episode titles, synopses, air dates, stills and available episode scores are fetched from TMDB, with a Jikan / MyAnimeList fallback. IMDb episode search links are included; FRAME does not mislabel TMDB scores as IMDb ratings.'].filter(Boolean).join('\n\n')
  });
  let episodes:Array<any>=[];
  let catalogueSeriesPoster='',catalogueSeriesBackdrop='';
  // Prefer FRAME's server-side TMDB catalogue for episode stills, summaries,
  // dates and episode-level community scores.
  if(supabase){
   try{
    const {data,error}=await supabase.functions.invoke('media-discovery',{body:{action:'episodes',provider:'series',source:'tmdb-tv',externalId:'37854'}});
    if(!error&&Array.isArray(data?.episodes)){
     catalogueSeriesPoster=String(data?.seriesPoster||'');catalogueSeriesBackdrop=String(data?.seriesBackdrop||'');
     episodes=data.episodes.map((e:any)=>({
      mal_id:Number(e.absoluteEpisode),title:e.title,aired:e.airDate,score:e.score,
      synopsis:e.synopsis,images:{jpg:{image_url:e.poster||'',large_image_url:e.backdrop||''}},
      ratingCount:e.ratingCount,ratingSource:e.ratingSource||'TMDB',runtimeMinutes:e.runtimeMinutes,
      tmdbId:e.tmdbId,seasonNumber:e.seasonNumber,episodeNumber:e.episodeNumber,special:e.special===true,
      imdbEpisodeUrl:e.imdbEpisodeUrl,sourceUrl:e.sourceUrl
     }));
    }
   }catch(error){console.warn('[FRAME One Piece TMDB episode catalogue]',error)}
  }
  // First fallback: Kitsu's public episode catalogue provides titles, synopses,
  // dates and thumbnails without a private API key.
  if(!episodes.length){
   try{
    const search=await fetch('https://kitsu.io/api/edge/anime?filter[text]=One%20Piece&page[limit]=20');
    if(!search.ok)throw new Error('Kitsu search HTTP '+search.status);
    const searchData=await search.json() as {data?:Array<any>};
    const matches=Array.isArray(searchData.data)?searchData.data:[];
    const anime=matches.find((x:any)=>String(x?.attributes?.canonicalTitle||'').trim().toLowerCase()==='one piece')
      ||matches.find((x:any)=>String(x?.attributes?.canonicalTitle||'').trim().toLowerCase().startsWith('one piece'));
    if(!anime?.id)throw new Error('Kitsu did not identify the One Piece TV anime.');
    const kitsuEpisodes:Array<any>=[];
    const limit=20;
    const fetchKitsuPage=async(offset:number)=>{
     const url='https://kitsu.io/api/edge/anime/'+encodeURIComponent(String(anime.id))+'/episodes?page[limit]='+limit+'&page[offset]='+offset;
     const pageResponse=await fetch(url);
     if(!pageResponse.ok)throw new Error('Kitsu episode page failed (HTTP '+pageResponse.status+').');
     return await pageResponse.json() as {data?:Array<any>;links?:{next?:string|null};meta?:{count?:number}};
    };
    const addKitsuRows=(pageData:{data?:Array<any>})=>{
     const rows=Array.isArray(pageData.data)?pageData.data:[];
     let meaningful=0;
     for(const row of rows){
      const a=row?.attributes||{};
      const number=Number(a.number);
      const title=String(a.canonicalTitle||a.titles?.en_us||a.titles?.en||a.titles?.en_jp||'').trim();
      const aired=String(a.airdate||a.airDate||'');
      // Kitsu currently contains future placeholder rows with no title/date.
      // Do not present those placeholders as real released episodes.
      if(!Number.isFinite(number)||number<=0||number>2000||(!title&&!aired))continue;
      meaningful++;
      kitsuEpisodes.push({
       mal_id:number,title:title||('Episode '+number),aired,synopsis:String(a.synopsis||a.description||''),
       images:{jpg:{image_url:String(typeof a.thumbnail==='string'?a.thumbnail:(a.thumbnail?.original||a.thumbnail?.large||a.thumbnail?.medium||''))}},
       ratingSource:'Kitsu',runtimeMinutes:Number(a.length)||undefined,sourceUrl:'https://kitsu.io/anime/'+String(anime.attributes?.slug||anime.id)
      });
     }
     return {rows:rows.length,meaningful};
    };
    const firstPage=await fetchKitsuPage(0);
    const firstStats=addKitsuRows(firstPage);
    const total=Math.min(Number(firstPage.meta?.count||1400),2000);
    let emptyPages=firstStats.meaningful===0?1:0;
    for(let offset=limit;offset<total&&offset<2000;){
     const offsets=[offset,offset+limit,offset+limit*2,offset+limit*3].filter(x=>x<total&&x<2000);
     const pages=await Promise.all(offsets.map(fetchKitsuPage));
     let shouldStop=false;
     for(let i=0;i<pages.length;i++){
      const stats=addKitsuRows(pages[i]);
      emptyPages=stats.meaningful===0?emptyPages+1:0;
      if(emptyPages>=3){shouldStop=true;break}
     }
     offset+=offsets.length*limit;
     if(shouldStop)break;
    }
    if(kitsuEpisodes.length)episodes=kitsuEpisodes;
   }catch(error){console.warn('[FRAME One Piece Kitsu episode catalogue]',error)}
  }
  // Second fallback: Jikan / MyAnimeList. Episode lists can be temporarily
  // rate-limited, so retry transient failures instead of abandoning the import.
  if(!episodes.length){
   try{
    const fetchJikanPage=async(page:number)=>{
     let lastError:unknown;
     for(let attempt=0;attempt<3;attempt++){
      try{
       const response=await fetch('https://api.jikan.moe/v4/anime/21/episodes?page='+page);
       if(!response.ok)throw new Error('Jikan HTTP '+response.status);
       return await response.json() as {data?:Array<any>;pagination?:{last_visible_page?:number}};
      }catch(error){
       lastError=error;
       if(attempt<2)await new Promise(resolve=>window.setTimeout(resolve,1200*(attempt+1)));
      }
     }
     throw lastError instanceof Error?lastError:new Error('Jikan episode catalogue unavailable.');
    };
    const first=await fetchJikanPage(1);
    const jikanEpisodes=[...(first.data||[])];
    const pages=Math.min(Number(first.pagination?.last_visible_page||1),20);
    for(let page=2;page<=pages;page++){
     await new Promise(resolve=>window.setTimeout(resolve,1150));
     const next=await fetchJikanPage(page);
     jikanEpisodes.push(...(next.data||[]));
    }
    if(jikanEpisodes.length)episodes=jikanEpisodes;
   }catch(error){episodes=[];console.warn('[FRAME One Piece Jikan episode catalogue]',error)}
  }
  // Enrich the catalogue with the official One Piece episode stills. The official archive
  // provides per-episode artwork when TMDB credentials are absent.
  if(supabase){
   try{
    const {data,error}=await supabase.functions.invoke('media-discovery',{body:{action:'episode-posters',provider:'series',source:'one-piece-official'}});
    const officialPosters=data?.posters&&typeof data.posters==='object'?data.posters as Record<string,string>:{};
    if(!error&&Object.keys(officialPosters).length)onePiecePosterCatalogueRef.current=officialPosters;
    if(!error&&Object.keys(officialPosters).length){
     // Keep source provenance separate: TMDB stills remain primary, and official
     // archive images are selected explicitly only when an episode has no still.
     console.info('[FRAME One Piece posters]',{archiveEntries:Object.keys(officialPosters).length,uniqueArchiveUrls:Number(data?.uniqueImages)||0});
    }else if(error)console.warn('[FRAME One Piece official poster catalogue]',error);
   }catch(error){console.warn('[FRAME One Piece official poster catalogue]',error)}
  }
  // Reuse verified episode records already stored in FRAME when remote providers fail.
  // Do not manufacture episode titles to make the catalogue appear complete.
  const savedOnePieceEpisodes=items.filter(x=>/^one-piece-episode-\d+$/.test(String(x.externalId||''))).map(x=>{
   const episodeNo=Number(String(x.externalId||'').match(/(\d+)$/)?.[1]||0);
   const title=String(x.title||'').replace(/^Episode\s+\d+\s*[—–-]\s*/i,'').replace(/^\d+\.\s*/,'').trim();
   if(!episodeNo||!title||/^episode\s*\d+$/i.test(title))return null;
   return {mal_id:episodeNo,title,aired:x.episode?.airDate||'',synopsis:x.episode?.synopsis||'',score:x.score,
    ratingSource:x.episode?.ratingSource||x.source||'Stored FRAME episode metadata',
    runtimeMinutes:x.episode?.runtimeMinutes,
    images:{jpg:{image_url:x.poster||'',large_image_url:x.backdrop||''}},
    sourceUrl:x.externalLinks?.officialUrl||'https://one-piece.com/anime/',
    imdbEpisodeUrl:x.episode?.imdbEpisodeUrl,
    seasonNumber:x.episode?.seasonNumber,episodeNumber:x.episode?.episodeNumber||episodeNo,
    posterSource:x.episode?.posterSource};
  }).filter(Boolean) as Array<any>;
  if(savedOnePieceEpisodes.length){
   const byNumber=new Map<number,any>(episodes.map(e=>[Number(e.mal_id),e]));
   for(const row of savedOnePieceEpisodes){
    const prior=byNumber.get(Number(row.mal_id));
    const priorTitle=String(prior?.title||'').replace(/^(?:(?:episode|ep)\s*\d+\s*[.:·—-]?\s*)+/i,'').replace(/^\d+\.\s*/,'').trim();
    if(!prior||!priorTitle||/^episode\s*\d+$/i.test(priorTitle))byNumber.set(Number(row.mal_id),row);
   }
   episodes=[...byNumber.values()];
  }
  root=normalise({...root,poster:ONE_PIECE_SERIES_POSTER,backdrop:catalogueSeriesBackdrop||root.backdrop});
  // Include every numbered episode, including filler and anime-original episodes.
  // Build a complete episode index from 1–1180, preserving real provider metadata wherever available.
  const catalogueByNumber=new Map<number,any>();
  const meaningfulEpisodeTitle=(value:unknown,number:number)=>{
   const title=String(value||'').trim().replace(/^(?:(?:episode|ep)\s*\d+\s*[.:·—-]?\s*)+/i,'').replace(/^\d+\.\s*/,'').trim();
   return Boolean(title)&&title!=='—'&&title.toLowerCase()!==('episode '+number).toLowerCase()&&!/^\d+\.?$/.test(title);
  };
  for(const e of episodes){
   const number=Number(e.mal_id);
   if(!Number.isInteger(number)||number<1||number>1180||!meaningfulEpisodeTitle(e.title,number))continue;
   const prior=catalogueByNumber.get(number);
   if(!prior||!meaningfulEpisodeTitle(prior.title,number))catalogueByNumber.set(number,{...e,title:String(e.title||'').trim().replace(/^(?:(?:episode|ep)\s*\d+\s*[.:·—-]?\s*)+/i,'').replace(/^\d+\.\s*/,'').trim()});
  }
  const included=Array.from({length:1180},(_,index)=>{
   const number=index+1,found=catalogueByNumber.get(number);
   return found&&meaningfulEpisodeTitle(found.title,number)?{...found,mal_id:number,title:String(found.title).trim()}:null;
  }).filter((e):e is any=>Boolean(e));
  const missingReleasedNumbers=1180-included.length;
  if(missingReleasedNumbers>0)console.warn('[FRAME One Piece catalogue] Verified titles unavailable for '+missingReleasedNumbers+' of 1180 released episodes; no placeholder titles were generated.');
  const arcs=[
   {name:'Romance Dawn',start:1,end:3},{name:'Orange Town',start:4,end:8},{name:'Syrup Village',start:9,end:18},
   {name:'Baratie',start:19,end:30},{name:'Arlong Park',start:31,end:44},{name:'Loguetown',start:45,end:53},
   {name:'Warship Island (Filler)',start:54,end:61},{name:'Reverse Mountain',start:62,end:63},{name:'Whisky Peak',start:64,end:67},
   {name:'Koby and Helmeppo',start:68,end:69},{name:'Little Garden',start:70,end:77},{name:'Drum Island',start:78,end:91},
   {name:'Arabasta',start:92,end:130},{name:'Post-Arabasta',start:131,end:135},{name:'Goat Island (Filler)',start:136,end:138},
   {name:'Ruluka Island (Filler)',start:139,end:143},{name:'Jaya',start:144,end:152},{name:'Skypiea',start:153,end:195},
   {name:'G-8 (Filler)',start:196,end:206},{name:'Long Ring Long Land',start:207,end:219},
   {name:'Ocean’s Dream (Filler)',start:220,end:224},{name:'Foxy’s Return (Filler)',start:225,end:226},
   {name:'Aokiji Encounter',start:227,end:228},{name:'Water 7',start:229,end:263},{name:'Enies Lobby',start:264,end:312},
   {name:'Post-Enies Lobby',start:313,end:325},{name:'Ice Hunter (Filler)',start:326,end:335},
   {name:'Chopper Man Special',start:336,end:336},{name:'Thriller Bark',start:337,end:381},
   {name:'Spa Island (Filler)',start:382,end:384},{name:'Sabaody Archipelago',start:385,end:405},
   {name:'Boss Luffy Historical Specials',start:406,end:407},{name:'Amazon Lily',start:408,end:417},
   {name:'Straw Hat Separation',start:418,end:421},{name:'Impel Down',start:422,end:425},
   {name:'Little East Blue (Filler)',start:426,end:429},{name:'Impel Down',start:430,end:452},
   {name:'Ace Flashback Specials',start:453,end:456},{name:'Marineford',start:457,end:489},
   {name:'Post-War',start:490,end:516},{name:'Return to Sabaody',start:517,end:522},
   {name:'Fish-Man Island',start:523,end:574},{name:'Z’s Ambition (Filler)',start:575,end:578},
   {name:'Punk Hazard',start:579,end:625},{name:'Caesar Retrieval (Filler)',start:626,end:628},
   {name:'Dressrosa',start:629,end:746},{name:'Silver Mine (Filler)',start:747,end:750},
   {name:'Zou',start:751,end:779},{name:'Marine Rookie (Filler)',start:780,end:782},
   {name:'Whole Cake Island',start:783,end:877},{name:'Levely / Reverie',start:878,end:889},
   {name:'Cidre Guild (Filler)',start:895,end:896},{name:'Romance Dawn Anniversary Special',start:907,end:907},
   {name:'Uta’s Past',start:1029,end:1030},{name:'Wano Country',start:890,end:1085},
   {name:'Egghead',start:1086,end:2000}

  ];
  const rootId=root.id;
  const watchedThrough=1180;
  const seriesTotal=1180;
  const created:MediaItem[]=[{...root,total:seriesTotal,customTotal:seriesTotal,progress:Math.min(watchedThrough,seriesTotal),status:'watching'}];
  const assigned=new Set<number>();
  const usedEpisodePosterUrls=new Set<string>();
  for(let index=0;index<arcs.length;index++){
   const arc=arcs[index];
   const arcEpisodes=included.filter((e:any)=>!assigned.has(Number(e.mal_id))&&Number(e.mal_id)>=arc.start&&Number(e.mal_id)<=arc.end);
   if(!arcEpisodes.length)continue;
   const arcId='one-piece-arc-'+arc.start;
   // Give each story arc a content-related still of its own and reserve it so
   // no episode in the hierarchy reuses that exact artwork.
   const arcCandidates=arcEpisodes.flatMap((episode:any)=>{
    const still=String(episode?.images?.jpg?.image_url||'').trim();
    const official=String(onePiecePosterCatalogueRef.current[String(Number(episode?.mal_id))]||'').trim();
    // Reserve archive artwork only when that same episode also has a separate
    // episode still available, so the episode never loses its own poster.
    return [still?official:'',still];
   }).filter((url:string,index:number,all:string[])=>Boolean(url)&&url!==root.poster&&all.indexOf(url)===index&&!usedEpisodePosterUrls.has(url));
   const existingArcArtwork=items.find(x=>x.id===arcId||x.externalId==='one-piece-arc-'+arc.start)?.poster;
   const arcPoster=arcCandidates[0]||existingArcArtwork||root.poster;
   if(arcPoster!==root.poster)usedEpisodePosterUrls.add(arcPoster);
   created.push({id:arcId,parentId:rootId,sourceProvider:'jikan',externalId:'one-piece-arc-'+arc.start,title:arc.name,description:arc.name+' · '+arcEpisodes.length+' episodes',poster:arcPoster,backdrop:root.backdrop,medium:'anime',status:arcEpisodes.every((e:any)=>Number(e.mal_id)<=watchedThrough)?'completed':'planned',progress:arcEpisodes.filter((e:any)=>Number(e.mal_id)<=watchedThrough).length,total:arcEpisodes.length,year:root.year,score:root.score,genres:root.genres,themes:root.themes,studio:root.studio,source:root.source,season:arc.name,favorite:false,notes:'FRAME_POSTER_VERSION=one-piece-stills-v3. Arc artwork is selected from distinct episode/archive stills. All numbered episodes in this arc are included, including filler and specials, and are marked completed per the library owner’s viewing status.'});
   for(const e of arcEpisodes){assigned.add(Number(e.mal_id));created.push(makeOnePieceEpisode(e,arc,index+1,arcId,root,usedEpisodePosterUrls));}
  }
  const ungrouped=included.filter((e:any)=>!assigned.has(Number(e.mal_id)));
  if(ungrouped.length){
   const arcId='one-piece-arc-other';
   created.push({id:arcId,parentId:rootId,sourceProvider:'jikan',externalId:'one-piece-arc-other',title:'Other episodes',description:'Episodes outside the predefined arc ranges.',poster:root.poster,backdrop:root.backdrop,medium:'anime',status:'completed',progress:ungrouped.length,total:ungrouped.length,genres:root.genres,themes:root.themes,favorite:false,notes:'Grouped here rather than silently omitted.'});
   for(const e of ungrouped)created.push(makeOnePieceEpisode(e,{name:'Other episodes',start:0,end:0},arcs.length+1,arcId,root,usedEpisodePosterUrls));
  }
  const descendantIds=new Set<string>([rootId]);
  let changed=true;
  while(changed){changed=false;for(const item of items){if(item.parentId&&descendantIds.has(item.parentId)&&!descendantIds.has(item.id)){descendantIds.add(item.id);changed=true}}}
  const remaining=items.filter(x=>!descendantIds.has(x.id));
  const existingByExternalId=new Map(items.filter(x=>x.externalId&&String(x.externalId).startsWith('one-piece-')).map(x=>[String(x.externalId),x] as const));
  const reconciled=created.map(next=>{
   const prior=next.externalId?existingByExternalId.get(String(next.externalId)):undefined;
   if(next.id===rootId)return {...next,total:1180,customTotal:1180,progress:1180,status:'watching' as MediaItem['status'],personalRating:prior?.personalRating??next.personalRating,favorite:prior?.favorite??next.favorite,notes:prior?.notes??next.notes};
   const episodeMatch=String(next.externalId||'').match(/^one-piece-episode-(\d+)$/);
   if(episodeMatch){
    const number=Number(episodeMatch[1]);
    return {...next,progress:number<=watchedThrough?1:Math.min(prior?.progress??next.progress,1),status:number<=watchedThrough?'completed':(prior?.status??next.status),personalRating:prior?.personalRating??next.personalRating,favorite:prior?.favorite??next.favorite,notes:prior?.notes??next.notes};
   }
   if(String(next.externalId||'').startsWith('one-piece-arc-')){
    return {...next,progress:next.progress,status:next.status,personalRating:prior?.personalRating??next.personalRating,favorite:prior?.favorite??next.favorite,notes:[prior?.notes,next.notes].filter(Boolean).join('\n\n')};
   }
   if(!prior)return next;
   return {...next,progress:Math.min(prior.progress,next.total??prior.total??0),status:prior.status,personalRating:prior.personalRating??next.personalRating,favorite:prior.favorite,notes:prior.notes??next.notes,customTotal:prior.customTotal??next.customTotal};
  });
  const ok=await save([...reconciled,...remaining]);
  if(ok){setAppMessage('One Piece updated: '+(created.length-1)+' arc and episode entries added.');window.setTimeout(()=>setAppMessage(''),7000);setSelected(created[0])}
  return ok;
 };
 const makeOnePieceEpisode=(e:any,arc:{name:string;start:number;end:number},arcNumber:number,parentId:string,root:MediaItem,usedPosters:Set<string>):MediaItem=>{
  const epNo=Number(e.mal_id);
  const score=Number(e.score);
  const aired=typeof e.aired==='string'?e.aired:(e.aired?.from||'');
  const synopsis=cleanDescription(String(e.synopsis||''))||'Synopsis not supplied by the catalogue.';
  const officialStill=String(onePiecePosterCatalogueRef.current[String(epNo)]||'').trim();
  const episodeStill=String(e.images?.jpg?.image_url||'').trim();
  const posterCandidates=[episodeStill,officialStill]
   .filter((url:string,index:number,all:string[])=>Boolean(url)&&url!==root.poster&&all.indexOf(url)===index);
  // Never fall back to an already-used image: a repeated poster is worse than
  // using a different episode-specific source from the catalogue.
  const poster=posterCandidates.find((url:string)=>!usedPosters.has(url))||'';
  if(poster)usedPosters.add(poster);
  const googleImageSearchUrl='https://www.google.com/search?tbm=isch&q='+encodeURIComponent('One Piece anime episode '+epNo+' '+String(e.title||'')+' official still');
  return {id:'one-piece-episode-'+epNo,parentId,sourceProvider:e.tmdbId?'tmdb-tv-episode':'jikan',externalId:'one-piece-episode-'+epNo,title:'Episode '+String(epNo).padStart(Math.max(3,String(epNo).length),'0')+' — '+String(e.title||'').replace(/^(?:(?:episode|ep)\s*\d+\s*[:·.—-]?\s*)+/i,'').replace(/^\d+\.\s*/,'').trim(),description:synopsis,poster,backdrop:String(e.images?.jpg?.large_image_url||''),medium:'anime',status:epNo<=1180?'completed':'planned',progress:epNo<=1180?1:0,total:1,year:aired?Number(String(aired).slice(0,4))||root.year:root.year,score:Number.isFinite(score)&&score>0?score:undefined,genres:root.genres,themes:root.themes,studio:root.studio,source:e.ratingSource||root.source,season:arc.name,favorite:false,episode:{seasonNumber:e.seasonNumber==null?arcNumber:Number(e.seasonNumber),episodeNumber:Number(e.episodeNumber)||epNo,episodeCode:'EP '+String(epNo).padStart(4,'0'),airDate:aired?String(aired).slice(0,10):undefined,ratingSource:Number.isFinite(score)&&score>0?(e.ratingSource||'MyAnimeList / Jikan'):'Rating unavailable',ratingCount:Number(e.ratingCount)>0?Number(e.ratingCount):undefined,runtimeMinutes:Number(e.runtimeMinutes)>0?Number(e.runtimeMinutes):undefined,imdbEpisodeUrl:String(e.imdbEpisodeUrl||('https://www.imdb.com/find/?q='+encodeURIComponent('One Piece anime episode '+epNo+' '+String(e.title||'')))),googleImageSearchUrl,posterSource:poster===episodeStill&&Boolean(episodeStill)?(e.tmdbId?'tmdb-episode-still-v3':'episode-catalogue-still-v3'):poster===officialStill&&Boolean(officialStill)?'one-piece-archive-v3':poster?'catalogue-still-v3':'missing-v3',posterVersion:'one-piece-stills-v3',synopsis},externalLinks:{officialUrl:String(e.sourceUrl||'https://one-piece.com/anime/'),newsUrl:googleImageSearchUrl}};
 };
 const importItem=async(raw:MediaItem)=>{
  const item=normalise(raw);
  if(item.medium==='anime'&&/^naruto$/i.test(item.title.trim())){
   const existing=items.find(x=>!x.parentId&&x.medium==='anime'&&/^naruto$/i.test(x.title.trim()));
   try{return await buildNarutoHierarchy(existing||item,true)}catch(error){setAppMessage('Could not load Naruto hierarchy: '+(error instanceof Error?error.message:'Please try again.'));window.setTimeout(()=>setAppMessage(''),6000);return false}
  }
  if(item.medium==='anime'&&/^(one piece|one piece \(tv\))$/i.test(item.title.trim())){
   const existing=items.find(x=>x.medium==='anime'&&/^(one piece|one piece \(tv\))$/i.test(x.title.trim()));
   if(existing)return await buildOnePieceHierarchy(existing,true);
   setAppMessage('Loading One Piece arcs and episode catalogue…');
   try{return await buildOnePieceHierarchy(item)}catch(error){setAppMessage('Could not load One Piece episodes: '+(error instanceof Error?error.message:'Please try again.'));window.setTimeout(()=>setAppMessage(''),6000);return false}
  }
  const duplicate=items.find(x=>(item.anilistId&&x.anilistId===item.anilistId)||(item.sourceProvider&&item.externalId&&x.sourceProvider===item.sourceProvider&&x.externalId===item.externalId));
  if(duplicate){setAppMessage('This title is already in your library.');window.setTimeout(()=>setAppMessage(''),3000);return false}
  return await save([item,...items]);
 };
 useEffect(()=>{
  if(!cloudLibraryReady||!items.length)return;
  const root=items.find(x=>!x.parentId&&x.medium==='anime'&&/^naruto$/i.test(x.title.trim()));
  if(!root)return;
  const parts=items.filter(x=>x.parentId===root.id&&x.sourceProvider==='frame-naruto-part');
  const partById=new Map(parts.map(x=>[x.id,x]));
  const arcs=items.filter(x=>partById.has(String(x.parentId||''))&&x.sourceProvider==='frame-naruto-arc');
  const stale=arcs.filter(x=>!String(x.notes||'').includes('FRAME_NARUTO_ARTWORK=v1'));
  if(!stale.length)return;
  const runKey=root.id+':'+stale.map(x=>x.id).sort().join('|');
  if(narutoArtworkRef.current===runKey)return;
  narutoArtworkRef.current=runKey;
  void (async()=>{
   const found=new Map<string,string>();
   const normalized=(value:string)=>value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
   const meaningful=(value:string)=>normalized(value).split(' ').filter(word=>word.length>2&&!['naruto','shippuden','arc','the','and','for','episode','filler'].includes(word));
   for(let offset=0;offset<stale.length;offset+=4){
    const batch=stale.slice(offset,offset+4);
    const results=await Promise.all(batch.map(async arc=>{
     try{
      const query=encodeURIComponent('File:'+arc.title+' Naruto');
      const url='https://naruto.fandom.com/api.php?action=query&generator=search&gsrsearch='+query+'&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url&iiurlwidth=900&format=json&origin=*';
      const response=await fetch(url,{headers:{Accept:'application/json'}});
      if(!response.ok)return [arc.id,''] as const;
      const data=await response.json() as any;
      const pages=Object.values(data?.query?.pages||{}) as any[];
      const words=meaningful(arc.title);
      const candidates=pages.map(page=>{
       const title=String(page?.title||'');
       const image=String(page?.imageinfo?.[0]?.thumburl||page?.imageinfo?.[0]?.url||'');
       const key=normalized(title);
       const score=words.reduce((sum,word)=>sum+(key.includes(word)?1:0),0);
       return {image,score,title};
      }).filter(x=>/^https:\/\//i.test(x.image)&&x.score>0&&!/logo|icon|flag|symbol/i.test(x.title))
       .sort((a,b)=>b.score-a.score);
      return [arc.id,candidates[0]?.image||''] as const;
     }catch(error){console.warn('[FRAME Naruto arc artwork]',arc.title,error);return [arc.id,''] as const}
    }));
    for(const [id,image] of results)if(image)found.set(id,image);
   }
   if(!found.size)return;
   const updated=items.map(item=>{
    const arcImage=found.get(item.id);
    if(arcImage){
     return {...item,poster:arcImage,backdrop:arcImage,notes:[item.notes,'FRAME_NARUTO_ARTWORK=v1'].filter(Boolean).join(String.fromCharCode(10))};
    }
    if(item.sourceProvider!=='frame-naruto-episode')return item;
    const arc=arcs.find(x=>x.id===item.parentId);
    const arcPoster=arc?found.get(arc.id):'';
    if(!arcPoster)return item;
    const part=arc?partById.get(String(arc.parentId||'')):undefined;
    const current=String(item.poster||'');
    const sameAsPart=!current||current===part?.poster||current.toLowerCase().includes('frame-logo.svg');
    return sameAsPart?{...item,poster:arcPoster,backdrop:arcPoster,episode:{...item.episode,posterSource:'naruto-arc-artwork-fallback',posterVersion:'naruto-episodes-v2'}}:item;
   });
   const ok=await save(updated);
   if(!ok)narutoArtworkRef.current='';
   else setAppMessage('Naruto artwork refreshed: distinct story-arc posters applied without changing episode progress.');
   window.setTimeout(()=>setAppMessage(''),6000);
  })().catch(error=>{narutoArtworkRef.current='';console.warn('[FRAME Naruto artwork refresh]',error)});
 },[cloudLibraryReady,items]);
 useEffect(()=>{
  if(!cloudLibraryReady||!items.length)return;
  const root=items.find(x=>!x.parentId&&x.medium==='anime'&&/^naruto$/i.test(x.title.trim()));
  if(!root)return;
  const parts=items.filter(x=>x.parentId===root.id&&x.sourceProvider==='frame-naruto-part');
  const originalPart=parts.find(x=>x.externalId==='naruto-part-original');
  const shippudenPart=parts.find(x=>x.externalId==='naruto-part-shippuden');
  const originalArcs=items.filter(arc=>arc.parentId===originalPart?.id&&arc.sourceProvider==='frame-naruto-arc');
  const shippudenArcs=items.filter(arc=>arc.parentId===shippudenPart?.id&&arc.sourceProvider==='frame-naruto-arc');
  const originalEpisodeCount=originalArcs.reduce((sum,arc)=>sum+items.filter(ep=>ep.parentId===arc.id&&ep.sourceProvider==='frame-naruto-episode').length,0);
  const shippudenEpisodeCount=shippudenArcs.reduce((sum,arc)=>sum+items.filter(ep=>ep.parentId===arc.id&&ep.sourceProvider==='frame-naruto-episode').length,0);
  const originalComplete=Boolean(originalPart&&originalArcs.length===7&&originalEpisodeCount===220);
  const shippudenComplete=Boolean(shippudenPart&&shippudenArcs.length===32&&shippudenEpisodeCount===500);
  if(originalComplete&&shippudenComplete)return;
  const key=root.id+':'+parts.length;
  if(narutoAutoRef.current===key||narutoAutoRef.current===root.id+':ready')return;
  narutoAutoRef.current=key;
  void buildNarutoHierarchy(root).then(ok=>{if(!ok)narutoAutoRef.current=''}).catch(error=>{narutoAutoRef.current='';console.warn('[FRAME Naruto hierarchy]',error)});
 },[cloudLibraryReady,items]);
 useEffect(()=>{
  if(!user?.id||!cloudLibraryReady||!items.length||!supabase)return;
  const root=items.find(x=>x.medium==='anime'&&/^(one piece|one piece \(tv\))$/i.test(x.title.trim()));
  if(!root)return;
  const arcs=items.filter(x=>x.parentId===root.id&&String(x.externalId||'').startsWith('one-piece-arc-'));
  const arcsNeedingArtwork=arcs.filter(x=>!String(x.notes||'').includes('FRAME_POSTER_VERSION=one-piece-arc-wiki-v1'));
  if(!arcsNeedingArtwork.length)return;
  const runKey=user.id+':'+root.id+':'+arcsNeedingArtwork.length;
  if(onePieceArcArtworkRef.current===runKey)return;
  const episodeItems=items.filter(x=>String(x.externalId||'').startsWith('one-piece-episode-'));
  const ranges=arcsNeedingArtwork.map(arc=>{
   const children=episodeItems.filter(x=>x.parentId===arc.id);
   const numbers=children.map(x=>Number(String(x.externalId||'').match(/^one-piece-episode-(\d+)$/)?.[1]||0)).filter(n=>n>0);
   if(!numbers.length)return null;
   const midpoint=Math.floor((Math.min(...numbers)+Math.max(...numbers))/2);
   const candidates=children.map(child=>{
    const number=Number(String(child.externalId||'').match(/^one-piece-episode-(\d+)$/)?.[1]||0);
    return {absoluteEpisode:number,seasonNumber:Number(child.episode?.seasonNumber)||0,episodeNumber:Number(child.episode?.episodeNumber)||0,title:child.title,poster:child.poster||'',backdrop:child.backdrop||'',tmdbEpisode:String(child.sourceProvider||'').startsWith('tmdb')};
   }).filter(candidate=>candidate.absoluteEpisode>0).sort((a,b)=>Number(Boolean(b.poster||b.backdrop))-Number(Boolean(a.poster||a.backdrop))||Math.abs(a.absoluteEpisode-midpoint)-Math.abs(b.absoluteEpisode-midpoint)).slice(0,6);
   return {id:arc.id,title:arc.title,currentPoster:arc.poster||'',candidates};
  }).filter((x):x is NonNullable<typeof x>=>Boolean(x));
  if(!ranges.length)return;
  onePieceArcArtworkRef.current=runKey;
  void (async()=>{
   try{
    const posters:Record<string,{poster?:string;backdrop?:string;episodeNumber?:number;episodeTitle?:string;sourceUrl?:string;artworkSource?:string;kind?:string;title?:string}>={};
    let failedBatches=0;
    // Keep each request small: sending every arc and all its episode metadata at
    // once can exceed edge-function/proxy request limits and abort the whole refresh.
    for(let offset=0;offset<ranges.length;offset+=4){
     const batch=ranges.slice(offset,offset+4).map(arc=>({...arc,candidates:arc.candidates.slice(0,4)}));
     try{
      const {data,error}=await supabase.functions.invoke('media-discovery',{body:{action:'arc-posters',provider:'series',source:'tmdb-tv',externalId:'37854',arcs:batch}});
      if(error)throw error;
      const found=(data?.posters&&typeof data.posters==='object'?data.posters:{}) as Record<string,{poster?:string;backdrop?:string;episodeNumber?:number;episodeTitle?:string;sourceUrl?:string;artworkSource?:string;kind?:string;title?:string}>;
      Object.assign(posters,found);
     }catch(error){
      failedBatches++;
      console.warn('[FRAME One Piece arc artwork batch]',offset/4+1,error);
     }
    }
    const reserved=new Set<string>([String(root.poster||''),...arcs.map(x=>String(x.poster||''))].filter(Boolean));
    const updates=new Map<string,MediaItem>();
    for(const arc of arcs){
     const art=posters[arc.id];
     const arcRange=ranges.find(x=>x.id===arc.id);
     const fallback=(arcRange?.candidates||[]).flatMap(candidate=>[
      {url:String(candidate.poster||'').trim(),episodeNumber:candidate.absoluteEpisode,title:candidate.title,sourceUrl:'https://www.imdb.com/find/?q='+encodeURIComponent('One Piece anime episode '+candidate.absoluteEpisode+' '+candidate.title),kind:'related-episode-poster'},
      {url:String(candidate.backdrop||'').trim(),episodeNumber:candidate.absoluteEpisode,title:candidate.title,sourceUrl:'https://www.imdb.com/find/?q='+encodeURIComponent('One Piece anime episode '+candidate.absoluteEpisode+' '+candidate.title),kind:'related-episode-still'}
     ]).find(candidate=>candidate.url&&candidate.url!==String(arc.poster||'').trim()&&candidate.url!==String(root.poster||'').trim()&&!reserved.has(candidate.url));
     let poster=String(art?.poster||'').trim();
     let chosen=art;
     if(!poster||poster===String(arc.poster||'').trim()||reserved.has(poster)){poster=String(fallback?.url||'').trim();chosen=fallback as any;}
     if(!poster||poster===String(arc.poster||'').trim()||reserved.has(poster))continue;
     reserved.add(poster);
     const isDedicatedArcArtwork=chosen?.kind==='arc-artwork'||String(chosen?.artworkSource||'').toLowerCase().includes('arc-specific');
     const sourceNote='FRAME_ARC_ARTWORK='+(chosen?.artworkSource||chosen?.kind||'related-episode-still')+(isDedicatedArcArtwork?'; dedicated artwork for '+arc.title:'; representative episode '+String(chosen?.episodeNumber||'')+': '+String(chosen?.episodeTitle||chosen?.title||arc.title))+(chosen?.sourceUrl?'; '+chosen.sourceUrl:'');
     const baseNotes=String(arc.notes||'').split('\n\nFRAME_ARC_ARTWORK=')[0].replace('FRAME_POSTER_VERSION=one-piece-stills-v3','FRAME_POSTER_VERSION=one-piece-arc-wiki-v1');
     updates.set(arc.id,{...arc,poster,backdrop:String(chosen?.backdrop||poster),notes:[baseNotes,sourceNote].filter(Boolean).join('\n\n')});
    }
    if(!updates.size){
     setAppMessage('No different usable image was found for these sub-parts. Episode entries and progress remain unchanged.');
     window.setTimeout(()=>setAppMessage(''),7000);
     return;
    }
    const next=items.map(x=>updates.get(x.id)||x);
    const ok=await save(next);
    if(ok){
     setAppMessage('Updated '+updates.size+' One Piece sub-part posters'+(failedBatches?' ('+failedBatches+' batch(es) could not refresh; retry to catch the rest)':'')+'. Episode posters and completion progress were left unchanged.');
     window.setTimeout(()=>setAppMessage(''),7000);
    }else onePieceArcArtworkRef.current='';
   }catch(error){
    onePieceArcArtworkRef.current='';
    console.warn('[FRAME One Piece arc artwork]',error);
    setAppMessage('Sub-part artwork refresh failed: '+(error instanceof Error?error.message:'please try again')+'. Episode progress was not changed.');
    window.setTimeout(()=>setAppMessage(''),8000);
   }
  })();
 },[user?.id,cloudLibraryReady,items]);
 const addSteamGame=(game:{appId?:string;name:string;header?:string;storeUrl?:string})=>{
  if(!game.name.trim())return;
  importItem({id:crypto.randomUUID(),sourceProvider:'steam',externalId:game.appId,title:game.name,description:'Imported from your Steam library.',poster:game.header||'',backdrop:game.header||'',medium:'game',status:'planned',progress:0,total:100,progressUnit:'%',year:undefined,score:undefined,genres:[],themes:[],favorite:false,game:{storeUrl:game.storeUrl||undefined}});
 };
 const mergeImported= (incoming:MediaItem[])=>{  const merged=[...items];let added=0,updated=0;  const seen=new Set<string>();  for(const raw of incoming){   const item=normalise(raw);   const fingerprint=item.anilistId?`anilist:${item.anilistId}`:item.sourceProvider&&item.externalId?`${item.sourceProvider}:${item.externalId}`:`title:${item.medium}:${item.title.trim().toLowerCase()}`;   if(seen.has(fingerprint))continue;   seen.add(fingerprint);   const index=merged.findIndex(x=>(item.anilistId&&x.anilistId===item.anilistId)||(item.sourceProvider&&item.externalId&&x.sourceProvider===item.sourceProvider&&x.externalId===item.externalId)||((x.title||'').trim().toLowerCase()===(item.title||'').trim().toLowerCase()&&x.medium===item.medium));   if(index<0){merged.unshift(item);added++;continue}   const current=merged[index];   merged[index]=normalise({...item,id:current.id,parentId:current.parentId||item.parentId,progress:current.progress??item.progress,total:current.customTotal??current.total??item.total, status:current.status==='planned'&&item.status!=='planned'?item.status:current.status, personalRating:current.personalRating??item.personalRating, favorite:current.favorite,notes:current.notes,customTotal:current.customTotal});   updated++;  }  save(merged);  const noticeClient=supabase;if(noticeClient&&user?.id)void noticeClient.from('frame_notifications').insert({user_id:user.id,type:'system',title:'Library import complete',body:`FRAME merged ${added} new and ${updated} existing entries.`,href:'library',dedupe_key:'import:'+new Date().toISOString().slice(0,19)}); }; const refreshMetadata=async(item:MediaItem)=>{  if(item.sourceProvider!=='anilist'&&!item.anilistId)return item;  try{   const data=await aniList<any>(DETAIL_QUERY,{id:Number(item.anilistId||item.externalId)});   const m=data?.Media;if(!m)return item;   return normalise({...item,title:titleOf(m),alternativeTitles:[m.title?.english,m.title?.romaji,m.title?.native].filter(Boolean).map(String),description:cleanDescription(m.description),poster:m.coverImage?.extraLarge||item.poster,backdrop:m.bannerImage||item.backdrop,genres:Array.isArray(m.genres)?m.genres.map(String):item.genres,themes:Array.isArray(m.tags)?m.tags.slice(0,12).map((x:any)=>String(x.name)).filter(Boolean):item.themes,studio:m.studios?.nodes?.[0]?.name||item.studio,score:m.averageScore==null?item.score:Number(m.averageScore)/10,total:item.customTotal??(m.episodes||m.chapters||m.volumes||item.total),year:m.startDate?.year?Number(m.startDate.year):item.year,season:m.season||item.season,duration:m.duration==null?item.duration:Number(m.duration)});  }catch{return item} }; const refreshRadar=async()=>{
  const client=supabase;if(!client||!user?.id)return;
  setRadarBusy(true);setRadarError('');
  try{const {data,error}=await client.functions.invoke('release-radar',{body:{action:'refresh'}});if(error)throw error;const releases=Array.isArray((data as any)?.releases)?(data as any).releases:[];setRadar(releases);if(user?.id){const current=releases.filter((x:any)=>x?.released).slice(0,30);if(current.length){
     const rows=current.map((x:any)=>({user_id:user.id,type:'release',title:x.title+' · Episode '+x.episode,body:'A tracked release is available now.',href:'media:'+x.mediaId,dedupe_key:'release:'+x.anilistId+':'+x.episode}));
     const keys=rows.map((x:any)=>x.dedupe_key);
     const {data:existing}=await client.from('frame_notifications').select('dedupe_key').eq('user_id',user.id).in('dedupe_key',keys);
     const seen=new Set((existing||[]).map((x:any)=>String(x.dedupe_key)));
     const fresh=rows.filter((x:any)=>!seen.has(x.dedupe_key));
     if(fresh.length)await client.from('frame_notifications').insert(fresh);
    }}}
  catch(e){setRadarError(e instanceof Error?e.message:'Release Radar unavailable.')}
  finally{setRadarBusy(false)}
 };
 useEffect(()=>{if(!supabase||!user?.id)return;void refreshRadar();const timer=window.setInterval(()=>void refreshRadar(),30*60*1000);return()=>window.clearInterval(timer)},[user?.id]);
 const persist=async(key:string,value:string)=>{const client=supabase;if(client&&user?.id){const defaults={user_id:user.id,theme:'cinematic-archive',density:'comfortable',accent:'gold',default_sort:'rating',default_media_filter:'all',voice_enabled:true,compact_nav:false,appearance_mode:'dark',updated_at:new Date().toISOString(),[key]:value};const {error}=await client.from('user_preferences').upsert(defaults,{onConflict:'user_id'});if(error)console.warn('[FRAME preferences]',error.message);return}if(guest){try{const raw=localStorage.getItem('frame-guest-preferences');const prefs=raw?JSON.parse(raw):{};prefs[key]=value;localStorage.setItem('frame-guest-preferences',JSON.stringify(prefs))}catch{}}};
 const updateReleaseNotifications=async(enabled:boolean)=>{setReleaseNotificationsEnabled(enabled);const client=supabase;if(client&&user?.id){const {error}=await client.from('user_preferences').upsert({user_id:user.id,theme:'cinematic-archive',density:'comfortable',accent:'gold',default_sort:'rating',default_media_filter:'all',voice_enabled:true,compact_nav:false,appearance_mode:'dark',release_notifications_enabled:enabled,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error){setReleaseNotificationsEnabled(!enabled);setAppMessage('Notification setting could not be saved: '+error.message);window.setTimeout(()=>setAppMessage(''),5000)}return}if(guest){try{const raw=localStorage.getItem('frame-guest-preferences');const prefs=raw?JSON.parse(raw):{};prefs.release_notifications_enabled=enabled;localStorage.setItem('frame-guest-preferences',JSON.stringify(prefs))}catch{}}};
 const removeOwnedArtwork=async(url?:string)=>{const client=supabase;if(!client||!user?.id||!url)return;try{const parsed=new URL(url);const prefix='/storage/v1/object/public/frame-media-art/';if(!parsed.pathname.startsWith(prefix))return;const path=decodeURIComponent(parsed.pathname.slice(prefix.length));if(path.startsWith(user.id+'/'))await client.storage.from('frame-media-art').remove([path]);}catch{}};
 const updateConnection=async(id:string)=>{const enabled=!connections[id];setConnections({...connections,[id]:enabled});const client=supabase;if(client&&user?.id)await client.from('connected_apps').upsert({user_id:user.id,provider:id,enabled,config:{}},{onConflict:'user_id,provider'})};
 const shown=useMemo(()=>{
 const normalized=query.trim().toLowerCase();
 const activeFilters=filters.filter(x=>x!=='all');
 const mediaFilterIds=Object.keys(types);
 const statusFilterIds=['incomplete','watching','reading','playing','completed','planned','paused','dropped'];
 const activeMedia=activeFilters.filter(x=>mediaFilterIds.includes(x));
 const activeStatus=activeFilters.filter(x=>statusFilterIds.includes(x));
 const textMatches=(x:MediaItem)=>{
  const text=[x.title,...(x.alternativeTitles||[]),x.medium,x.status,x.description||'',...(x.genres||[])].join(' ').toLowerCase();
  return !normalized||text.includes(normalized);
 };
 const facetMatches=(x:MediaItem)=>{
  const mediaMatch=!activeMedia.length||activeMedia.includes(x.medium);
  const statusMatch=!activeStatus.length||activeStatus.some(f=>f==='incomplete'?progressPercent(x)<100:x.status===f);
  return mediaMatch&&statusMatch;
 };
 const hasStatusFilter=activeStatus.length>0;
 const sorted=sortMedia(items,sortMode);
 if(!hasStatusFilter){
  const roots=sorted.filter(x=>{
   if(x.parentId)return false;
   if(!textMatches(x)||!facetMatches(x))return false;
   return true;
  });
  const result:MediaItem[]=[];
  for(const root of roots){
   result.push(root);
   // Multi-part anime get a paired Season 1 card immediately beside the main
   // aggregate entry. Keep single-season anime and One Piece unchanged.
   if(root.medium==='anime' && root.title.trim().toLowerCase()!=='one piece'){
    const children=items.filter(x=>x.parentId===root.id);
    const season1=children.find(x=>/\\bseason\\s*1\\b/i.test(x.title));
    if(children.length>1 && season1 && textMatches(season1) && facetMatches(season1)) result.push({...season1,poster:root.poster,backdrop:''});
   }
  }
  return result;
 }
 return sorted.filter(x=>{
  if(x.parentId)return false;
  if(!textMatches(x))return false;
  if(!facetMatches(x))return false;
  return true;
 });
},[items,sortMode,query,filters]);
 const pageHistoryReady=useRef(false);
 useEffect(()=>{
  if(!pageHistoryReady.current){
   if(history.state?.framePage!==page)history.replaceState({framePage:page},'',window.location.href);
   pageHistoryReady.current=true;
   return;
  }
  if(history.state?.framePage!==page)history.pushState({framePage:page},'',window.location.href);
 },[page]);
 useEffect(()=>{
  const onPopState=()=>{
   setFinder(false);setManualEntry(false);setSelected(null);setMenu(false);setCommandOpen(false);
   const next=typeof history.state?.framePage==='string'?history.state.framePage:'home';
   setPage(next);
  };
  window.addEventListener('popstate',onPopState);
  return()=>window.removeEventListener('popstate',onPopState);
 },[]);
 const go=(next:string)=>{
  if(next===page){setMenu(false);setSelected(null);return}
  setPage(next);setMenu(false);setSelected(null);if(next!=='friend-library')setFriendLibrary(null);
 };

 return <div className="frame-app">
  {appMessage&&<div className="frame-app-message" role="status">{appMessage}<button onClick={()=>setAppMessage('')} aria-label="Dismiss">×</button></div>}
  <header className="frame-topbar" role="banner">
   <button className="frame-brand" aria-label="Go to FRAME home" onClick={()=>go('home')}><FrameLogoMark logo={profile?.frame_logo}/><b>FRAME</b></button>
   <nav className="frame-nav">
    {[[['home','Home'],HomeIcon],[['library','Library'],Library],[['discover','Discover'],Compass]].map(([pair,I])=>{const[id,label]=pair as string[],Icon=I as typeof HomeIcon;return <button key={id} className={page===id?'active':''} onClick={()=>go(id)}><Icon size={16}/>{label}</button>})}
   </nav>
   <div className="frame-actions">
    <div className="global-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&setFinder(true)} placeholder="Search your library…"/></div>
    <button className="primary top-find" onClick={()=>setFinder(true)}><Search size={16}/>Search</button>
    <button className="top-icon" title="Connections" aria-label="Connections" onClick={()=>go('connections')}><Link2 size={18}/></button>
    <FrameNotifications uid={uid} mediaItems={items} onNavigate={href=>{if(!href)return;if(href.startsWith('media:')){const match=items.find(x=>x.id===href.slice(6));if(match){setSelected(match);return}}go(href)}}/>
    {guest&&<button className="secondary guest-signin" type="button" onClick={()=>{localStorage.removeItem('frame-guest');window.location.reload()}}>Sign in</button>}
    <button className="top-account" type="button" title="Open Settings" aria-label="Open Settings" onClick={()=>go('settings')}>
      <span className="top-avatar">{profile?.avatar_url?<img src={profile.avatar_url} alt={(profile.display_name||user?.email||'Account')+' avatar'} onError={e=>{e.currentTarget.src='/frame-logo.svg';e.currentTarget.classList.add('image-fallback')}}/>:(profile?.display_name||user?.email||'G')[0].toUpperCase()}</span>
      <span className="top-account-name">{profile?.display_name||user?.email?.split('@')[0]||'Account'}</span>
    </button>
    <button className="top-icon mobile-only" aria-label={menu?'Close navigation menu':'Open navigation menu'} title={menu?'Close navigation menu':'Open navigation menu'} onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button>
   </div>
  </header>
  {menu&&<div className="frame-mobile-menu">{[['home','Home'],['library','Library'],['discover','Discover'],['radar','Release Radar'],['friends','Friends'],['connections','Connections'],['settings','Settings']].map(([id,label])=><button key={id} onClick={()=>go(id)}>{label}</button>)}</div>}
  <main className="frame-main">
   {page==='home'&&<Home items={shown} total={items.filter(x=>!x.parentId).length} open={setSelected} finder={()=>setFinder(true)} go={go} name={profile?.display_name} />}
   {page==='library'&&<LibraryPage items={shown} library={items} filters={filters} setFilters={setFilters} sort={sortMode} setSort={x=>{setSortMode(x);void persist('default_sort',x)}} open={setSelected} add={()=>setFinder(true)} />}
   {page==='discover'&&<Discover finder={()=>setFinder(true)} go={go}/>} 
   {page==='radar'&&<RadarPage releases={radar} busy={radarBusy} error={radarError} refresh={()=>void refreshRadar()}/>}
   {page==='friends'&&<FrameSocial uid={uid} guest={guest} onOpenLibrary={id=>{setFriendLibrary(id);setPage('friend-library')}} onCall={setDirectCall}/>}
   {page==='chat'&&<FrameGlobalChat uid={uid} guest={guest}/>} 
   {page==='calls'&&<CallsPage uid={uid} profile={profile} onCloseCall={()=>{}}/>}
   {page==='connections'&&<><Connections connections={connections} toggle={updateConnection} onImportSteamGame={addSteamGame}/><FrameLibraryImport onImport={mergeImported}/></>}
   {page==='settings'&&<SettingsPage user={user} profile={profile} setProfile={setProfile} guest={guest} density={density} setDensity={x=>{setDensity(x);void persist('density',x)}} theme={theme} setTheme={x=>{setTheme(x);void persist('theme',x)}} appearanceMode={appearanceMode} setAppearanceMode={x=>{setAppearanceMode(x);void persist('appearance_mode',x)}} items={items} onImport={mergeImported} onImportAnimeBatch={importAnimeBatch} preferences={{default_sort:sortMode,density,theme,appearance_mode:appearanceMode,release_notifications_enabled:releaseNotificationsEnabled}} releaseNotificationsEnabled={releaseNotificationsEnabled} onReleaseNotificationsChange={updateReleaseNotifications} onSignOut={signOut}/>} 
   {page==='friend-library'&&friendLibrary&&<FriendLibrary id={friendLibrary} onBack={()=>go('friends')}/>}
  </main>
  <nav className="mobile-bottom">
   {[[['home','Home'],HomeIcon],[['library','Library'],Library],[['search','Search'],Search],[['chat','Chat'],MessageCircle],[['friends','Friends'],Users]].map(([pair,I])=>{const[id,label]=pair as string[],Icon=I as typeof Search;return <button key={id} className={page===id?'active':''} onClick={()=>id==='search'?setFinder(true):go(id)}><Icon size={19}/><span>{label}</span></button>})}
  </nav>
  {selected&&<FrameDetail item={selected} library={items} navigationItems={shown.length?shown:items.filter(x=>!x.parentId)} navigate={setSelected} close={()=>setSelected(null)} onRefreshMetadata={refreshMetadata} onDelete={async id=>{const target=items.find(i=>i.id===id);const children=items.filter(i=>i.parentId===id);const next=items.filter(i=>i.id!==id).map(i=>i.parentId===id?{...i,parentId:undefined}:i);const client=supabase;if(client&&user?.id){const {error}=await client.from('media_items').delete().eq('id',id).eq('user_id',user.id);if(error){setAppMessage('Delete failed: '+error.message);window.setTimeout(()=>setAppMessage(''),5000);return}}setSelected(null);await save(next);await removeOwnedArtwork(target?.poster);if(target?.backdrop&&target.backdrop!==target.poster)await removeOwnedArtwork(target.backdrop);if(children.length){setAppMessage('Entry deleted. Its child entries were kept and detached.');window.setTimeout(()=>setAppMessage(''),5000)}}} save={async x=>{const previous=items.find(i=>i.id===x.id);const ok=await save(items.map(i=>i.id===x.id?x:i));if(ok&&previous){if(previous.poster&&previous.poster!==x.poster)await removeOwnedArtwork(previous.poster);if(previous.backdrop&&previous.backdrop!==x.backdrop&&previous.backdrop!==previous.poster&&previous.backdrop!==x.poster)await removeOwnedArtwork(previous.backdrop)}return ok}}/>}
  {finder&&<AniListSearch initialQuery={query} guest={guest} library={items} close={()=>setFinder(false)} onImported={importItem} onManual={()=>{setFinder(false);setManualEntry(true)}} />}
  {manualEntry&&<ManualEntryForm library={items} close={()=>setManualEntry(false)} onCreate={async raw=>{const item=normalise({...raw,id:crypto.randomUUID()});const ok=await save([item,...items]);if(!ok)return;setSelected(item);setManualEntry(false);}}/>}
  {!guest&&<FrameDirectCall uid={uid} target={directCall} onClear={()=>setDirectCall(null)}/>} 
  <FramePopupHub uid={uid} hidden={finder||manualEntry||selected!==null||commandOpen} onFind={()=>setFinder(true)} onOpenCalls={()=>go('calls')} onCall={setDirectCall}/>
  {commandOpen&&<FrameCommandPalette onGo={go} onFind={()=>setFinder(true)} onClose={()=>setCommandOpen(false)}/>}
 </div>;
}

function ManualEntryForm({close,onCreate,library}:{close:()=>void;onCreate:(item:MediaItem)=>void|Promise<void>;library:MediaItem[]}){
 const [title,setTitle]=useState(''),[medium,setMedium]=useState<Medium>('anime'),[status,setStatus]=useState<MediaItem['status']>('planned'),[progress,setProgress]=useState(0),[total,setTotal]=useState(0),[posterUrl,setPosterUrl]=useState(''),[description,setDescription]=useState(''),[personalRating,setPersonalRating]=useState<number|undefined>(undefined),[favorite,setFavorite]=useState(false),[notes,setNotes]=useState(''),[parentId,setParentId]=useState(''),[busy,setBusy]=useState(false);
 const units:Record<Medium,string>={anime:'episodes',manga:'chapters',manhwa:'chapters','light-novel':'chapters','visual-novel':'%',movie:'watch state',series:'episodes',game:'%',book:'pages'};
 const submit=async()=>{if(!title.trim()||busy)return;const t=total>0?Math.min(2000,total):undefined;const max=medium==='movie'?1:(medium==='game'||medium==='visual-novel'?100:(t||2000));setBusy(true);try{await onCreate({id:crypto.randomUUID(),title:title.trim(),description,poster:posterUrl.trim(),backdrop:'',medium,status,progress:status==='completed'?(t||max):Math.max(0,Math.min(max,progress)),total:t,progressUnit:units[medium],genres:[],themes:[],favorite,personalRating,notes:notes.trim()||undefined,parentId:parentId||undefined})}finally{setBusy(false)}};
 return <div className="overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><aside className="detail-drawer manual-entry-drawer" onMouseDown={e=>e.stopPropagation()}><button className="close-btn" onClick={close} aria-label="Close"><X/></button><div className="manual-entry-head"><small>MANUAL ENTRY</small><h2>Add anything to FRAME.</h2><p>Use this for media that no catalogue can identify. You can edit all of it later.</p></div><div className="call-form manual-entry-form"><label>Title<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. a local series, book, game…" /></label><label>Media type<select value={medium} onChange={e=>setMedium(e.target.value as Medium)}>{Object.entries(types).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value as MediaItem['status'])}>{[['planned','Planned'],['watching','Watching'],['reading','Reading'],['playing','Playing'],['completed','Completed'],['paused','Paused'],['dropped','Dropped']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><div className="manual-two-col"><label>Progress<input type="number" min="0" max="2000" value={progress} onChange={e=>setProgress(Number(e.target.value)||0)}/></label><label>Total<input type="number" min="0" max="2000" value={total||''} onChange={e=>setTotal(Number(e.target.value)||0)} placeholder="Optional" /></label></div><label>Poster URL<input value={posterUrl} onChange={e=>setPosterUrl(e.target.value)} placeholder="https://…" /></label><label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Optional description…" /></label><label>Your rating<input type="number" min="0" max="10" step=".1" value={personalRating??''} onChange={e=>setPersonalRating(e.target.value===''?undefined:Number(e.target.value)||0)} /></label><label>Parent entry<select value={parentId} onChange={e=>setParentId(e.target.value)}><option value="">None — top level</option>{library.slice().sort((a,b)=>a.title.localeCompare(b.title)).map(x=><option key={x.id} value={x.id}>{x.parentId?'↳ ':''}{x.title}</option>)}</select></label><label>Favorite<select value={favorite?'yes':'no'} onChange={e=>setFavorite(e.target.value==='yes')}><option value="no">No</option><option value="yes">Yes</option></select></label><label>Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Anything you want to remember…" /></label><button className="primary" disabled={!title.trim()||busy} onClick={()=>void submit()}>{busy?<RefreshCw size={16} className="spin"/>:<CirclePlus size={16}/>} {busy?'Adding…':'Add to my library'}</button></div></aside></div>;
}
function Home({items,total,open,finder,go,name}:{items:MediaItem[];total:number;open:(x:MediaItem)=>void;finder:()=>void;go:(x:string)=>void;name?:string}){
 const active=items.filter(x=>['watching','reading','playing'].includes(x.status));
 const favorites=items.filter(x=>x.favorite);
 const topRated=[...items].sort((a,b)=>(b.personalRating??b.score??0)-(a.personalRating??a.score??0));
 return <div className="page home-page">
  <section className="home-intro"><div className="home-intro-copy"><small>FRAME HOME</small><h1>{'Welcome back'+(name?', '+name:'')+'.'}</h1><p>{total?'You have '+total+' '+(total===1?'title':'titles')+' in your library.':'Your library is empty. Add your first title to get started.'}</p></div><div className="home-intro-actions"><button className="primary" onClick={finder}><Search size={16}/>Add media</button><button className="secondary" onClick={()=>go('library')}><Library size={16}/>Open library</button><button className="secondary" onClick={()=>go('calls')}><Radio size={16}/>Global Call</button></div></section>
<section className="home-overview" aria-label="Library overview"><div><b>{total}</b><span>Library</span></div><div><b>{active.length}</b><span>In progress</span></div><div><b>{items.filter(x=>x.status==='completed').length}</b><span>Completed</span></div><div><b>{favorites.length}</b><span>Favorites</span></div></section>
  {active.length>0&&<section className="home-shelf home-continue"><div className="section-title"><div><small>KEEP GOING</small><h2>Continue</h2></div><button className="text-action" onClick={()=>go('library')}>View library <ChevronRight size={14}/></button></div><div className="media-grid">{active.slice(0,5).map(x=><Card key={x.id} item={x} library={items} open={open}/>)}</div></section>}
  {favorites.length>0&&<section className="home-shelf home-favorites"><div className="section-title"><div><small>PINNED</small><h2>Favorites</h2></div><span>{favorites.length}</span></div><div className="media-grid">{favorites.slice(0,5).map(x=><Card key={x.id} item={x} library={items} open={open}/>)}</div></section>}
  <section className="home-tools"><div className="home-tools-head"><small>SHORTCUTS</small><h2>Go somewhere</h2></div><div className="home-tool-grid"><button onClick={finder}><Search size={19}/><span><b>Find media</b><small>Search every connected catalogue</small></span><ChevronRight size={15}/></button><button onClick={()=>go('discover')}><Compass size={19}/><span><b>Discover</b><small>Explore new titles and sources</small></span><ChevronRight size={15}/></button><button onClick={()=>go('radar')}><CalendarDays size={19}/><span><b>Release Radar</b><small>See tracked releases</small></span><ChevronRight size={15}/></button><button onClick={()=>go('calls')}><Radio size={19}/><span><b>Global Call</b><small>Join or start the public FRAME voice room</small></span><ChevronRight size={15}/></button></div></section>
  {total>0&&<section className="home-shelf home-top-rated"><div className="section-title"><div><small>YOUR SCORES</small><h2>Top rated</h2></div><span>{topRated.length}</span></div><div className="media-grid">{topRated.slice(0,6).map(x=><Card key={x.id} item={x} library={items} open={open}/>)}</div></section>}
  {!total&&<section className="home-empty"><div className="home-empty-mark"><img src="/frame-logo.svg" alt=""/></div><div><small>NO TITLES YET</small><h2>Start with something you already watch, read or play.</h2><p>Use the finder to pull in metadata, then set the status and progress you want.</p><button className="primary" onClick={finder}><Search size={15}/>Find your first title</button></div></section>}
 </div>;
}
function Stat({value,label}:{value:number;label:string}){return <div className="stat-card"><b>{value}</b><span>{label}</span></div>}
function Card({item,open,library=[]}:{item:MediaItem;open:(x:MediaItem)=>void;library?:MediaItem[]}){
 const pct=progressPercent(item);
 const parent=library.find(x=>x.id===item.parentId);
 const artworkParent=artworkFallbackAncestor(item,library);
 const childCount=library.filter(x=>x.parentId===item.id).length;
 return <button className="media-card" onClick={()=>open(item)}><div className="media-poster"><FrameArtwork title={item.title} medium={item.medium} poster={item.poster} anilistId={item.anilistId} parentPoster={artworkParent.id!==item.id?artworkParent.poster:undefined} parentTitle={artworkParent.id!==item.id?artworkParent.title:undefined} parentMedium={artworkParent.id!==item.id?artworkParent.medium:undefined} parentAnilistId={artworkParent.id!==item.id?artworkParent.anilistId:undefined} sourceProvider={item.sourceProvider} externalId={item.externalId} alt={item.title} loading="lazy"/><span className="medium-pill">{types[item.medium]}</span><span className="score-pill"><Star size={10} fill="currentColor"/>{item.score==null?'—':item.score.toFixed(1)}</span></div><div className="media-copy"><b>{item.title}</b><small>{item.status==='completed'?'Completed':item.progress+' / '+(item.total||500)} {item.progressUnit||unitFor(item.medium)}</small><div className="card-progress"><i style={{width:Math.min(100,Math.max(0,pct))+'%'}}/></div><span className="personal-line">{item.personalRating!=null?'Your '+item.personalRating.toFixed(1):'Rate it yourself'}</span>{parent&&<span className="hierarchy-line">Part of {parent.title}</span>}{!parent&&childCount>0&&<span className="hierarchy-line">{childCount} {childCount===1?'sub-part':'sub-parts'}</span>}</div></button>;
}

function LibraryPage({items,library,filters,setFilters,sort,setSort,open,add}:{items:MediaItem[];library:MediaItem[];filters:string[];setFilters:(x:string[])=>void;sort:string;setSort:(x:string)=>void;open:(x:MediaItem)=>void;add:()=>void}){
 const statusFilters:[string,string][]=[['incomplete','Not 100%'],['watching','Watching'],['reading','Reading'],['playing','Playing'],['completed','Completed'],['planned','Planned'],['paused','Paused'],['dropped','Dropped']];
 const mediaFilters:[string,string][]=[['all','All Media'],...Object.entries(types)];
 const toggleMedia=(id:string)=>{
  const mediaIds=mediaFilters.slice(1).map(([key])=>key);
  const statusOnly=filters.filter(x=>x!=='all'&&!mediaIds.includes(x));
  if(id==='all'){setFilters(statusOnly.length?['all',...statusOnly]:['all']);return}
  const base=filters.filter(x=>x!=='all');
  const next=base.includes(id)?base.filter(x=>x!==id):[...base,id];
  const nextHasMedia=next.some(x=>mediaIds.includes(x));
  setFilters(nextHasMedia?next:['all',...statusOnly]);
 };
 const toggleStatus=(id:string)=>{
  const mediaIds=mediaFilters.slice(1).map(([key])=>key);
  const base=filters.filter(x=>x!=='all');
  const next=base.includes(id)?base.filter(x=>x!==id):[...base,id];
  const hasMedia=next.some(x=>mediaIds.includes(x));
  setFilters(next.length?(hasMedia?next:['all',...next]):['all']);
 };
 const allMediaActive=!mediaFilters.slice(1).some(([key])=>filters.includes(key));
 return <div className="page library-page">
  <div className="page-heading"><div><small>YOUR COLLECTION</small><h1>Library</h1><p>Top-level entries are shown normally. Use filters to drill into matching seasons, parts and sub-items.</p></div><div className="library-heading-actions"><button className="primary" onClick={add}><CirclePlus size={17}/>Add media</button></div></div>
  <div className="library-controls">
   <div className="filter-groups">
    <div className="filter-group">
     <span className="filter-group-label">Media</span>
     <div className="filter-scroll media-filter-scroll">{mediaFilters.map(([id,label])=><button type="button" className={(id==='all'?allMediaActive:filters.includes(id))?'active':''} key={id} onClick={()=>toggleMedia(id)} aria-pressed={id==='all'?allMediaActive:filters.includes(id)}>{label}</button>)}</div>
    </div>
    <div className="filter-group">
     <span className="filter-group-label">Status</span>
     <div className="filter-scroll status-filter-scroll">{statusFilters.map(([id,label])=><button type="button" className={filters.includes(id)?'active':''} key={id} onClick={()=>toggleStatus(id)} aria-pressed={filters.includes(id)}>{label}</button>)}</div>
    </div>
   </div>
   <label className="sort-select"><span>Sort</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="rating">Rating</option><option value="personal">My rating</option><option value="recent">Newest</option><option value="progress">Progress</option><option value="title">Title</option></select></label>
  </div>
  <div className="media-grid">{items.map(x=><Card key={x.id} item={x} library={library} open={open}/>)}</div>{!items.length&&<Empty text="Nothing matches these filters."/>}
 </div>;
}
function Discover({finder,go}:{finder:()=>void;go:(x:string)=>void}){return <div className="page"><div className="page-heading"><div><small>UNIVERSAL DISCOVERY</small><h1>Explore everything.</h1><p>One consistent interface for media, metadata and connected services.</p></div></div><div className="feature-grid"><button className="feature-card" onClick={finder}><Search size={22}/><h3>Universal search</h3><p>AniList + Jikan, IGDB + RAWG, TMDB, VNDB, Open Library + Google Books and more.</p><ChevronRight/></button><button className="feature-card" onClick={()=>go('connections')}><Link2 size={22}/><h3>Connections</h3><p>Control the catalogues and services FRAME uses.</p><ChevronRight/></button></div></div>}
function RadarPage({releases,busy,error,refresh}:{releases:Radar[];busy:boolean;error:string;refresh:()=>void}){const up=releases.filter(x=>!x.released).sort((a,b)=>Date.parse(a.airingAt)-Date.parse(b.airingAt));return <div className="page radar-page"><div className="page-heading"><div><small>RELEASE INTELLIGENCE</small><h1>Release Radar</h1><p>Upcoming releases for tracked AniList titles.</p></div><button className="secondary" disabled={busy} onClick={refresh}>{busy?<RefreshCw className="spin"/>:<RefreshCw/>}Refresh</button></div>{error&&<div className="inline-error">{error}</div>}<section className="radar-panel"><div className="section-title"><div><small>UP NEXT</small><h2>Upcoming</h2></div><span>{up.length}</span></div>{up.length?<div className="release-list">{up.slice(0,30).map(x=><div key={x.anilistId+'-'+x.episode}><FrameArtwork title={x.title} medium="anime" poster={x.poster} anilistId={x.anilistId} alt="" loading="lazy"/><section><b>{x.title}</b><small>Episode {x.episode}</small><span>{new Date(x.airingAt).toLocaleString()}</span></section></div>)}</div>:<Empty text="No upcoming tracked releases."/ >}</section></div>}

function Connections({connections:_,toggle:_toggle,onImportSteamGame}:{connections:Record<string,boolean>;toggle:(id:string)=>void;onImportSteamGame:(game:{appId?:string;name:string;header?:string;storeUrl?:string})=>void}){ const [linkMessage,setLinkMessage]=useState(''); const [steamId,setSteamId]=useState(''); const [steamGames,setSteamGames]=useState<Array<{appId:string;name:string;playtimeMinutes:number;header?:string;storeUrl?:string}>>([]); const [identityProviders,setIdentityProviders]=useState<string[]>([]); const [profileLinks,setProfileLinks]=useState<Record<string,string>>({}); const [busyProfile,setBusyProfile]=useState(''); const {user}=useAuth(); useEffect(()=>{setIdentityProviders((user?.identities||[]).map(x=>String(x.provider)))},[user?.id,user?.identities?.length]); useEffect(()=>{  if(!supabase||!user?.id)return;  void (async()=>{   const {data}=await supabase.from('connected_apps').select('provider,config').eq('user_id',user.id);   const next:Record<string,string>={};   (data||[]).forEach((row:any)=>{    const provider=String(row.provider||'');    const cfg=row.config&&typeof row.config==='object'?row.config as Record<string,unknown>:{};    if(provider==='steam'&&typeof cfg.steamId==='string'&&cfg.steamId.trim()){setSteamId(cfg.steamId);localStorage.setItem('frame-steam-id:'+user.id,cfg.steamId)}    if(provider.startsWith('profile:')&&typeof cfg.url==='string'&&cfg.url.trim())next[provider.slice(8)]=cfg.url;   });   if(!steamId)setSteamId(localStorage.getItem('frame-steam-id:'+user.id)||'');   setProfileLinks(next);  })(); },[user?.id]); const socialProviders=[  ['google','Google','Sign in identity and account recovery.'],  ['github','GitHub','Developer identity and account access.'],  ['discord','Discord','Identity plus FRAME community workflows.'],  ['spotify','Spotify','Identity, music-aware features and optional playback controls.'],  ['twitch','Twitch','Gaming/creator identity and future community features.'] ] as const; const profileServices=[  ['anilist','AniList','Anime / manga profile'],  ['myanimelist','MyAnimeList','Anime / manga profile'],  ['crunchyroll','Crunchyroll','Watchlist / profile link'],  ['mangadex','MangaDex','Manga / manhwa profile'],  ['imdb','IMDb','Movie / series profile'],  ['letterboxd','Letterboxd','Film diary / profile'] ] as const; useEffect(()=>{  if(!supabase||!user?.id)return;  void (async()=>{   const steamLocal=localStorage.getItem('frame-steam-id:'+user.id);   if(steamLocal&&!steamId)setSteamId(steamLocal);  })(); },[user?.id]); const socialConnect=async(provider:'google'|'github'|'discord'|'spotify'|'twitch')=>{  const client=supabase;if(!client||!user){setLinkMessage('Log in to connect external accounts.');return}  setLinkMessage('');  try{   const scopes=provider==='spotify'?'user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-private':provider==='discord'?'identify email':undefined;   const options:any={redirectTo:window.location.origin};   if(scopes)options.scopes=scopes;   const {error}=await client.auth.linkIdentity({provider,options});   if(error)throw error;  }catch(e){setLinkMessage(e instanceof Error?e.message:'That OAuth connection could not be started. Make sure the provider is enabled in Supabase Auth.')} }; const disconnect=async(provider:string)=>{  const client=supabase;if(!client||!user)return;  const identity=(user.identities||[]).find(x=>x.provider===provider);  if(!identity)return;  const {error}=await client.auth.unlinkIdentity(identity);  if(error)setLinkMessage(error.message);  else setIdentityProviders((user.identities||[]).filter(x=>x.provider!==provider).map(x=>String(x.provider))); }; const saveProfileLink=async(service:string,url:string)=>{  const client=supabase;if(!client||!user){setLinkMessage('Log in to save account links.');return}  const clean=url.trim();  if(clean){   try{const parsed=new URL(clean);if(!['http:','https:'].includes(parsed.protocol))throw new Error('Use a normal https:// or http:// profile URL.')}catch{setLinkMessage('Enter a valid profile URL beginning with https://');return}  }  setBusyProfile(service);setLinkMessage('');  const provider='profile:'+service;  const op=clean   ?client.from('connected_apps').upsert({user_id:user.id,provider,enabled:true,config:{url:clean}},{onConflict:'user_id,provider'})   :client.from('connected_apps').delete().eq('user_id',user.id).eq('provider',provider);  const {error}=await op;  if(error)setLinkMessage(error.message);else setProfileLinks(prev=>{const next={...prev};if(clean)next[service]=clean;else delete next[service];return next});  setBusyProfile(''); }; const syncSteam=async()=>{  const client=supabase;if(!client||!user){setLinkMessage('Log in to sync your Steam library.');return}  if(!steamId.trim()){setLinkMessage('Enter your SteamID64 or public profile identifier first.');return}  setLinkMessage('');  const {data,error}=await client.functions.invoke('steam-library',{body:{steamId:steamId.trim()}});  if(error){setLinkMessage(error.message);return}  const games=((data as {games?:Array<{appId:string;name:string;playtimeMinutes:number;header?:string;storeUrl?:string}>})?.games||[]);  localStorage.setItem('frame-steam-id:'+user.id,steamId.trim());setSteamGames(games);  setLinkMessage(games.length+' Steam games synced.');  await client.from('connected_apps').upsert({user_id:user.id,provider:'steam',enabled:true,config:{steamId:steamId.trim()}},{onConflict:'user_id,provider'}); }; const catalogueRows=[  ['AniList + Jikan','Anime, manga, manhwa and light novels'],['TMDB + TVMaze','Movies and series'],['VNDB','Visual novels'],['Open Library + Google Books','Books and novels'],['IGDB + RAWG','Game discovery, artwork and game metadata'] ] as const; return <div className="page connections-page">  <div className="page-heading"><div><small>SERVICE CONTROL</small><h1>Connections</h1><p>Connect real identities where OAuth is supported, or save safe profile links for services that do not expose a FRAME-ready OAuth flow. FRAME never asks for those service passwords.</p></div></div>  <section className="connections-section"><div className="connections-section-head"><div><small>BUILT-IN CATALOGUES</small><h2>Ready to use</h2></div><span>{catalogueRows.length} sources</span></div><div className="connections-grid">{catalogueRows.map(([name,description])=><div className="connection-card" key={name}><div className="connection-icon"><Link2 size={19}/></div><div><b>{name}</b><p>{description}</p><small>Built in · no account connection</small></div><span className="connection-status built-in">Available</span></div>)}</div></section>  <section className="connections-section"><div className="connections-section-head"><div><small>ACCOUNT IDENTITIES</small><h2>OAuth accounts</h2></div><span>Supabase Auth · secure redirect</span></div><div className="connections-grid">   {socialProviders.map(([provider,name,description])=>{const connected=identityProviders.includes(provider);return <div className="connection-card" key={provider}><div className="connection-icon"><Link2 size={19}/></div><div><b>{name}</b><p>{description}</p><small>{connected?'OAuth · connected':'OAuth · connect when enabled'}</small></div>{connected?<button className="secondary" onClick={()=>void disconnect(provider)}>Disconnect</button>:<button className="secondary" onClick={()=>void socialConnect(provider)}>Connect</button>}</div>})}   <div className="connection-card"><div className="connection-icon"><Gamepad2 size={19}/></div><div><b>Steam account</b><p>Import owned games and use FRAME as the tracking layer for your Steam library.</p><small>{steamGames.length?'Synced '+steamGames.length+' games':'Not synced'} · server-side Web API</small></div><div className="call-form"><input value={steamId} onChange={e=>setSteamId(e.target.value)} placeholder="SteamID64 / public profile ID"/><button className="secondary" onClick={()=>void syncSteam()}>Sync Steam</button></div></div>  </div></section>  <section className="connections-section"><div className="connections-section-head"><div><small>PROFILE LINKS</small><h2>Other services</h2></div><span>Safe URL links · no passwords</span></div><div className="connections-grid profile-links-grid">   {profileServices.map(([id,name,description])=><div className="connection-card profile-link-card" key={id}><div className="connection-icon"><Link2 size={19}/></div><div><b>{name}</b><p>{description}</p><small>{profileLinks[id]?'Linked account':'Not linked'}</small></div><div className="profile-link-editor"><input value={profileLinks[id]||''} onChange={e=>setProfileLinks(prev=>({...prev,[id]:e.target.value}))} placeholder="https://…"/><div><button className="secondary" disabled={busyProfile===id} onClick={()=>void saveProfileLink(id,profileLinks[id]||'')}>{busyProfile===id?'Saving…':profileLinks[id]?'Save':'Link'}</button>{profileLinks[id]&&<a className="secondary" href={profileLinks[id]} target="_blank" rel="noreferrer">Open</a>}</div></div></div>)}  </div></section>  {linkMessage&&<div className="inline-error" style={{marginTop:12}}>{linkMessage}</div>}  <FrameSpotifyControls connected={identityProviders.includes('spotify')} />  {steamGames.length>0&&<section className="calls-panel" style={{marginTop:14}}><div className="section-title"><div><small>STEAM LIBRARY</small><h2>Import and play</h2></div><span>{steamGames.length} synced</span></div><div className="media-grid">{steamGames.slice(0,30).map(g=><div key={g.appId} className="media-card steam-library-card"><div className="media-poster"><img src={g.header||''} alt="" loading="lazy"/></div><div className="media-copy"><b>{g.name}</b><small>{Math.round(g.playtimeMinutes/60)}h played</small><div className="steam-actions"><button className="secondary" onClick={()=>onImportSteamGame(g)}>Add to FRAME</button><a className="secondary" href={'steam://run/'+g.appId}>Play</a><a className="secondary" href={g.storeUrl||'#'} target="_blank" rel="noreferrer">Store</a></div></div></div>)}</div></section>} </div>;}function SettingsPage({user,profile,setProfile,guest,density,setDensity,theme,setTheme,appearanceMode,setAppearanceMode,items,onImport,onImportAnimeBatch,preferences,releaseNotificationsEnabled,onReleaseNotificationsChange,onSignOut}:{user:any;profile:Profile|null;setProfile:(p:Profile)=>void;guest:boolean;density:string;setDensity:(x:string)=>void;theme:string;setTheme:(x:string)=>void;appearanceMode:'light'|'dark'|'system';setAppearanceMode:(x:'light'|'dark'|'system')=>void;items:MediaItem[];onImport:(items:MediaItem[])=>void;onImportAnimeBatch:(items:MediaItem[])=>Promise<boolean>;preferences:Record<string,unknown>;releaseNotificationsEnabled:boolean;onReleaseNotificationsChange:(enabled:boolean)=>void|Promise<void>;onSignOut:()=>Promise<void>}){
 const[name,setName]=useState(profile?.display_name||''),[username,setUsername]=useState(profile?.username||''),[email,setEmail]=useState(user?.email||''),[logo,setLogo]=useState(profile?.frame_logo||'ultra-instinct'),[avatar,setAvatar]=useState(profile?.avatar_url||''),[saved,setSaved]=useState(false),[emailBusy,setEmailBusy]=useState(false),[logoBusy,setLogoBusy]=useState(false),[avatarBusy,setAvatarBusy]=useState(false),[logoMessage,setLogoMessage]=useState(''),[avatarMessage,setAvatarMessage]=useState(''),[emailMessage,setEmailMessage]=useState(''),[securityBusy,setSecurityBusy]=useState(false),[securityMessage,setSecurityMessage]=useState('');
 useEffect(()=>{setName(profile?.display_name||'');setUsername(profile?.username||'');setLogo(profile?.frame_logo||'ultra-instinct');setAvatar(profile?.avatar_url||'')},[profile?.id,profile?.display_name,profile?.username,profile?.frame_logo,profile?.avatar_url]);useEffect(()=>setEmail(user?.email||''),[user?.id,user?.email]);
 const persistSetting=async(key:string,value:string)=>{if(supabase&&user?.id){const defaults={user_id:user.id,theme:'cinematic-archive',density:'comfortable',accent:'gold',default_sort:'rating',default_media_filter:'all',voice_enabled:true,compact_nav:false,appearance_mode:'dark',updated_at:new Date().toISOString(),[key]:value};const {error}=await supabase.from('user_preferences').upsert(defaults,{onConflict:'user_id'});if(error)setLogoMessage('Could not save setting: '+error.message);return}if(guest){try{const raw=localStorage.getItem('frame-guest-preferences');const prefs=raw?JSON.parse(raw):{};prefs[key]=value;localStorage.setItem('frame-guest-preferences',JSON.stringify(prefs))}catch{}}};
 const save=async(logoOverride?:string,avatarOverride?:string)=>{const client=supabase;if(!client||!user?.id){setLogoMessage('Sign in to save account settings.');return false}const clean=username.trim().slice(0,30);if(clean.length<3){setLogoMessage('Username must be at least 3 characters.');return false}const p={id:user.id,username:clean,display_name:name.trim()||clean,avatar_url:(avatarOverride??avatar)||profile?.avatar_url||null,bio:profile?.bio||'',frame_logo:logoOverride??logo};const {data:savedProfile,error}=await client.from('profiles').upsert(p,{onConflict:'id'}).select('*').maybeSingle();if(error){setLogoMessage(error.message);return false}setProfile((savedProfile||p) as Profile);setSaved(true);setLogoMessage('');setTimeout(()=>setSaved(false),1400);return true};const saveEmail=async()=>{const client=supabase;if(!client||!user?.id){setEmailMessage('Sign in to change your email.');return}const clean=email.trim().toLowerCase();if(!/^\\S+@\\S+\\.\\S+$/.test(clean)){setEmailMessage('Enter a valid email address.');return}if(clean===String(user.email||'').toLowerCase()){setEmailMessage('That is already your account email.');return}setEmailBusy(true);setEmailMessage('Sending confirmation links…');try{const {error}=await client.auth.updateUser({email:clean});if(error)throw error;setEmailMessage('Confirmation links sent to your current and new email. Your new address activates after confirmation.')}catch(e){setEmailMessage(e instanceof Error?e.message:'Email update failed.')}finally{setEmailBusy(false)}};
 const uploadLogo=async(file:File)=>{if(!supabase||!user?.id){setLogoMessage('Sign in to upload a personal FRAME logo.');return}if(!file.type.startsWith('image/')){setLogoMessage('Choose an image file.');return}if(file.size>2*1024*1024){setLogoMessage('Logo must be 2 MB or smaller.');return}setLogoBusy(true);setLogoMessage('Uploading logo…');try{const ext=(file.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'')||'png';const path=user.id+'/frame-logo-'+Date.now()+'.'+ext;const {error}=await supabase.storage.from('frame-logos').upload(path,file,{upsert:true,contentType:file.type});if(error)throw error;const {data}=supabase.storage.from('frame-logos').getPublicUrl(path);if(!data.publicUrl)throw new Error('Could not create a public logo URL.');setLogo(data.publicUrl);await save(data.publicUrl);setLogoMessage('Custom logo saved.')}catch(e){setLogoMessage(e instanceof Error?e.message:'Logo upload failed.')}finally{setLogoBusy(false)}}; const uploadAvatar=async(file:File)=>{if(!supabase||!user?.id){setAvatarMessage('Sign in to upload a profile avatar.');return}if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)){setAvatarMessage('Choose a PNG, JPEG, WebP, or GIF image.');return}if(file.size>2*1024*1024){setAvatarMessage('Avatar must be 2 MB or smaller.');return}setAvatarBusy(true);setAvatarMessage('Uploading avatar…');try{const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';const path=user.id+'/avatar-'+Date.now()+'.'+ext;const {error}=await supabase.storage.from('frame-avatars').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});if(error)throw error;const {data}=supabase.storage.from('frame-avatars').getPublicUrl(path);if(!data.publicUrl)throw new Error('Could not create an avatar URL.');setAvatar(data.publicUrl);const saved=await save(undefined,data.publicUrl);if(!saved)throw new Error('Avatar uploaded, but the profile could not be saved. Please try again.');setAvatarMessage('Profile avatar saved.')}catch(e){setAvatarMessage(e instanceof Error?e.message:'Avatar upload failed.')}finally{setAvatarBusy(false)}};
 const themes=[['cinematic-archive','1 · Cinematic Archive','Immersive hero · black & gold'],['midnight-glass','2 · Midnight Glass','Layered panels · soft glow'],['clean-editorial','3 · Clean Editorial','Spacious editorial layout'],['full-screen-epic','4 · Full-Screen Epic','Oversized artwork · bold type'],['collectors-archive','5 · Collector’s Archive','Artwork with rich details'],['modern-media-hub','6 · Modern Media Hub','Sidebar · quick filters · dense library']] as const;
 const logos=[['ultra-instinct','FRAME mark','Primary geometric symbol'],['classic-f','Classic F','Simple letter mark'],['minimal-ring','Minimal ring','Quiet circular mark']] as const;
 const resetAppearance=()=>{setTheme('cinematic-archive');setAppearanceMode('dark');setDensity('comfortable');void persistSetting('theme','cinematic-archive');void persistSetting('appearance_mode','dark');void persistSetting('density','comfortable')};
 return <div className="page settings-page">
  <section className="settings-hero"><div><small>FRAME CONTROL</small><h1>Settings</h1><p>Manage how FRAME looks and how your account is stored.</p></div><div className="settings-hero-status"><FrameLogoMark logo={logo} small/><div><b>{themes.find(x=>x[0]===theme)?.[1]||theme}</b><span>{appearanceMode[0].toUpperCase()+appearanceMode.slice(1)} mode · {density} density</span></div></div></section>
  
  <section id="settings-appearance" className="settings-panel settings-panel-wide"><div className="section-title"><div><small>LOOK & FEEL</small><h2>Appearance</h2><p>Each choice changes the interface shape, spacing and visual language.</p></div><button type="button" className="secondary settings-reset" onClick={resetAppearance}>Reset appearance</button></div><div className="appearance-control"><b>Theme</b><span>Pick a complete interface style.</span><div className="theme-picker">{themes.map(([id,label,sub])=><button type="button" key={id} className={'theme-choice '+(theme===id?'selected':'')} onClick={()=>{setTheme(id);void persistSetting('theme',id)}}><i className={'theme-preview '+id}><span/></i><strong>{label}</strong><small>{sub}</small>{theme===id&&<em>On</em>}</button>)}</div></div><div className="appearance-bottom-grid"><div className="appearance-control"><b>FRAME colour system</b><span>The active theme has its own background, surfaces, text and accent colours.</span><div className="frame-palette-swatches" aria-label="Current theme palette"><i/><i/><i/></div></div><div className="appearance-control"><b>Content density</b><span>Choose how much media fits on screen.</span><select className="settings-density-select" value={density} onChange={e=>{setDensity(e.target.value);void persistSetting('density',e.target.value)}}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select></div></div><div className="appearance-live"><span>LIVE</span><div><b>{themes.find(x=>x[0]===theme)?.[1]||theme} is active.</b><small>Changes are applied immediately.</small></div></div></section>
  <section id="settings-profile" className="settings-panel"><div className="section-title"><div><small>ACCOUNT</small><h2>Profile & logo</h2><p>Set the name shown in FRAME, choose your avatar, and choose the symbol used in the header.</p></div></div>{guest?<p className="muted">Guest mode keeps this information on the current device.</p>:<><div className="settings-form-grid"><label>Username<input value={username} onChange={e=>setUsername(e.target.value.replace(/[^A-Za-z0-9_]/g,''))}/></label><label>Display name<input value={name} onChange={e=>setName(e.target.value)}/></label></div><div className="settings-email-row"><label>Account email<input type="email" autoComplete="email" value={email} onChange={e=>{setEmail(e.target.value);setEmailMessage('')}}/></label><button type="button" className="secondary" disabled={emailBusy} onClick={()=>void saveEmail()}>{emailBusy?'Sending…':'Change email'}</button></div>{emailMessage&&<small className="data-tools-message">{emailMessage}</small>}<div className="avatar-setting"><div className="avatar-setting-preview">{avatar?<img src={avatar} alt={(name||username||'Account')+' avatar'} onError={e=>{e.currentTarget.src='/frame-logo.svg'}}/>:<span>{(name||username||user?.email||'G').trim().charAt(0).toUpperCase()}</span>}</div><div className="avatar-setting-copy"><b>Profile avatar</b><small>Shown in your account bubble and social areas.</small><label className="logo-upload"><span>Upload avatar</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={avatarBusy} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadAvatar(f);e.currentTarget.value='' }}/></label>{avatarMessage&&<small className="data-tools-message">{avatarMessage}</small>}</div></div><div className="logo-setting"><div><b>FRAME symbol</b><small>Your chosen mark appears in the top-left of the app.</small></div><div className="logo-picker">{logos.map(([id,label,sub])=><button type="button" key={id} className={'logo-choice '+(logo===id?'selected':'')} onClick={()=>{setLogo(id);void save(id)}}><FrameLogoMark logo={id} small/><span><strong>{label}</strong><small>{sub}</small></span></button>)}{logo.startsWith('http')&&<div className="logo-choice selected"><FrameLogoMark logo={logo} small/><span><strong>Custom</strong><small>Uploaded for this account</small></span></div>}</div><label className="logo-upload"><span>Upload a personal logo</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" disabled={logoBusy} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadLogo(f);e.currentTarget.value='' }}/></label>{logoMessage&&<small className="data-tools-message">{logoMessage}</small>}<button type="button" className="primary" onClick={()=>void save()}>{saved?'Saved':'Save profile'}</button></div></>}</section>
  <section id="settings-notifications" className="settings-panel settings-panel-wide"><div className="section-title"><div><small>RELEASE INTELLIGENCE</small><h2>Media notifications</h2><p>Choose whether FRAME should monitor your AniList-linked library for upcoming episodes, related releases and catalogue changes.</p></div></div><label className="release-notifications-setting"><span className="release-notifications-setting-copy"><b>Enable notifications for all media</b><small>When enabled, FRAME checks every AniList-linked title in your library every 30 minutes. Individual titles can still be opted out from the Add to Library menu.</small></span><input type="checkbox" checked={releaseNotificationsEnabled} onChange={e=>void onReleaseNotificationsChange(e.target.checked)} aria-label="Enable notifications for all media"/></label></section>
  <div className="settings-bottom-grid"><section id="settings-data" className="settings-panel"><div className="section-title"><div><small>PORTABILITY</small><h2>Backup</h2><p>Export a copy of your library or import one on another device.</p></div></div><FrameAnimeCatalogueImport userId={user?.id} enabled={!guest&&Boolean(user?.id)} library={items} onImportBatch={onImportAnimeBatch}/><FrameDataTools items={items} profile={profile} preferences={preferences} onImport={onImport}/></section><section id="settings-security" className="settings-panel settings-security-panel"><div className="section-title"><div><small>ACCOUNT ACCESS</small><h2>Security</h2><p>Manage the account active on this device.</p></div></div>{guest?<><p className="muted">Guest changes are saved on this device. Sign in to attach them to your FRAME account.</p><button type="button" className="secondary" onClick={()=>{localStorage.removeItem('frame-guest');window.location.reload()}}>Sign in to FRAME</button></>:<><div className="account-access-actions"><button type="button" className="danger" disabled={securityBusy} onClick={async()=>{setSecurityBusy(true);setSecurityMessage('Signing out…');try{await onSignOut()}catch(e){setSecurityMessage(e instanceof Error?e.message:'Could not sign out. Please try again.');setSecurityBusy(false)}}}><LogOut size={16}/>{securityBusy?'Signing out…':'Log out'}</button><button type="button" className="secondary" disabled={securityBusy} onClick={async()=>{setSecurityBusy(true);setSecurityMessage('Opening account switcher…');try{await onSignOut()}catch(e){setSecurityMessage(e instanceof Error?e.message:'Could not switch accounts. Please try again.');setSecurityBusy(false)}}}>Add / switch account</button></div><p className="muted">FRAME uses one active account per browser. “Add / switch account” signs out this account and opens the secure sign-in screen, where you can enter another existing account or create a new one.</p>{securityMessage&&<small className="data-tools-message">{securityMessage}</small>}</>}</section></div>
 </div>;
}
function FriendLibrary({id,onBack}:{id:string;onBack:()=>void}){
 const[items,setItems]=useState<MediaItem[]>([]);
 useEffect(()=>{if(!supabase)return;void(async()=>{const client=supabase;if(!client)return;const {data}=await client.from('media_items').select('*,media_metadata(*)').eq('user_id',id).order('score',{ascending:false});setItems((data||[]).map(dbToMedia))})()},[id]);
 return <div className="page"><button className="breadcrumb" onClick={onBack}>← Back to friends</button><div className="page-heading"><div><small>PERMISSION GRANTED</small><h1>Shared library</h1><p>This library is visible because your friend explicitly allowed access.</p></div></div><div className="media-grid">{items.map(x=><SharedCard key={x.id} item={x} library={items}/>)}</div>{!items.length&&<Empty text="Nothing has been shared yet."/>}</div>;
}
function SharedCard({item,library}:{item:MediaItem;library:MediaItem[]}){
 const pct=item.medium==='game'||item.medium==='visual-novel'?item.progress:item.progress/(item.total||1)*100;
 const artworkParent=artworkFallbackAncestor(item,library);
 return <article className="media-card shared-media-card"><div className="media-poster"><FrameArtwork title={item.title} medium={item.medium} poster={item.poster} anilistId={item.anilistId} parentPoster={artworkParent.id!==item.id?artworkParent.poster:undefined} parentTitle={artworkParent.id!==item.id?artworkParent.title:undefined} parentMedium={artworkParent.id!==item.id?artworkParent.medium:undefined} parentAnilistId={artworkParent.id!==item.id?artworkParent.anilistId:undefined} sourceProvider={item.sourceProvider} externalId={item.externalId} alt={item.title} loading="lazy"/><span className="medium-pill">{types[item.medium]}</span><span className="score-pill"><Star size={10} fill="currentColor"/>{item.score==null?'—':item.score.toFixed(1)}</span></div><div className="media-copy"><b>{item.title}</b><small>{item.status==='completed'?'Completed':item.progress+' / '+(item.total||500)} {item.progressUnit||unitFor(item.medium)}</small><div className="card-progress"><i style={{width:Math.min(100,Math.max(0,pct))+'%'}}/></div><span className="personal-line">Shared view · read only</span></div></article>;
}
function Empty({text}:{text:string}){return <div className="empty-state"><Library size={25}/><p>{text}</p></div>}

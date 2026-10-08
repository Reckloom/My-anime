import {useEffect,useMemo,useRef,useState} from 'react';
import {Bot,CalendarDays,ChevronRight,CirclePlus,Compass,ExternalLink,Gamepad2,Globe,Home as HomeIcon,Library,Link2,LogOut,Menu,MessageCircle,Phone,RefreshCw,Search,Star,Users,X,Settings} from 'lucide-react';
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
import {FrameNotifications} from './components/FrameNotifications';
import {FrameCommandPalette} from './components/FrameCommandPalette';
import {FrameDataTools} from './components/FrameDataTools';
import {FrameLibraryImport} from './components/FrameLibraryImport';
import {aniList,DETAIL_QUERY,cleanDescription,titleOf} from './anilist';
import {FrameSpotifyControls} from './components/FrameSpotify';
import {supabase} from './lib/supabase';

const poster='https://cdn.myanimelist.net/images/anime/10/47347.jpg';
const types:Record<Medium,string>={anime:'Anime',manga:'Manga',manhwa:'Manhwa','light-novel':'Light Novel','visual-novel':'Visual Novel',movie:'Movie',series:'Series',game:'Game',book:'Book'};
const unitFor=(m:Medium)=>({anime:'episodes',manga:'chapters',manhwa:'chapters','light-novel':'chapters','visual-novel':'%',movie:'watch state',series:'episodes',game:'%',book:'pages'} as Record<Medium,string>)[m];
type Profile={id:string;username:string;display_name:string;avatar_url?:string|null;bio?:string;frame_logo?:'ultra-instinct'|'classic-f'|'minimal-ring'|string|null};
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

function FrameLogoMark({logo='frame-mark',small=false}:{logo?:string|null;small?:boolean}){ const mode=logo&&logo!=='ultra-instinct'?logo:'frame-mark'; if(mode.startsWith('http'))return <span className={'frame-logo-mark frame-mark '+(small?'small':'')}><img src={mode} alt="Custom FRAME logo"/></span>; if(mode==='classic-f')return <span className={'frame-logo-mark classic-f '+(small?'small':'')}>F</span>; if(mode==='minimal-ring')return <span className={'frame-logo-mark minimal-ring '+(small?'small':'')}><i/></span>; return <span className={'frame-logo-mark frame-mark '+(small?'small':'')}><img src="/frame-logo.svg" alt="FRAME logo"/></span>;}
function mergeMediaLists(primary:MediaItem[],secondary:MediaItem[]){ const merged=[...primary]; for(const incomingRaw of secondary){ const incoming=normalise(incomingRaw); const index=merged.findIndex(x=>(incoming.anilistId&&x.anilistId===incoming.anilistId)||(incoming.sourceProvider&&incoming.externalId&&x.sourceProvider===incoming.sourceProvider&&x.externalId===incoming.externalId)||((x.title||'').trim().toLowerCase()===(incoming.title||'').trim().toLowerCase()&&x.medium===incoming.medium)); if(index<0){merged.push(incoming);continue} const current=merged[index]; merged[index]=normalise({...current,...incoming,id:current.id,parentId:incoming.parentId??current.parentId,metadataId:incoming.metadataId??current.metadataId}); } return merged; }
export default function App(){
 const {user}=useAuth(),guest=!user&&localStorage.getItem('frame-guest')==='1',uid=user?.id||'guest';
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
 const [finder,setFinder]=useState(false),[manualEntry,setManualEntry]=useState(false),[selected,setSelected]=useState<MediaItem|null>(null),[menu,setMenu]=useState(false),[profile,setProfile]=useState<Profile|null>(null),[appMessage,setAppMessage]=useState('');
 const [directCall,setDirectCall]=useState<Profile|null>(null),[friendLibrary,setFriendLibrary]=useState<string|null>(null),[commandOpen,setCommandOpen]=useState(false);
 const [radar,setRadar]=useState<Radar[]>([]),[radarBusy,setRadarBusy]=useState(false),[radarError,setRadarError]=useState('');
 const [aiProvider,setAiProvider]=useState('frame'),[density,setDensity]=useState('comfortable'),[theme,setTheme]=useState('sky'),[appearanceMode,setAppearanceMode]=useState<'light'|'dark'|'system'>('light');
 const [connections,setConnections]=useState<Record<string,boolean>>({anilist:true,steam:true,tvmaze:true,vndb:true,openlibrary:true,imdb:true,justwatch:true});
 const saveQueue=useRef(Promise.resolve(true));

 useEffect(()=>{document.documentElement.dataset.density=density;document.documentElement.dataset.frameTheme=theme;document.documentElement.dataset.frameMode=appearanceMode},[density,theme,appearanceMode]); useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setCommandOpen(true);return}if(e.key==='Escape'){setCommandOpen(false);setFinder(false);setManualEntry(false);setSelected(null);setMenu(false)}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);

 useEffect(()=>{
  try{localStorage.setItem(storageKey,JSON.stringify(items))}catch{}
 },[items,storageKey]);
 useEffect(()=>{if(!guest)return;try{const raw=localStorage.getItem('frame-guest-preferences');const prefs=raw?JSON.parse(raw):{};if(prefs.default_sort)setSortMode(String(prefs.default_sort));if(prefs.density)setDensity(String(prefs.density));if(prefs.ai_provider)setAiProvider(String(prefs.ai_provider));if(prefs.theme&&['sky','samsung','apple','oneplus','nothing','amoled','pixel','material','retro'].includes(String(prefs.theme)))setTheme(String(prefs.theme));if(prefs.appearance_mode&&['light','dark','system'].includes(String(prefs.appearance_mode)))setAppearanceMode(String(prefs.appearance_mode) as 'light'|'dark'|'system')}catch{}},[guest]);

 useEffect(()=>{
  const client=supabase;
  if(!client||!user?.id)return;
  let active=true;
  const load=async()=>{
   const guestRaw=localStorage.getItem('frame-library:guest');
   let guestItems:MediaItem[]=[];
   try{const parsed=guestRaw?JSON.parse(guestRaw):[];if(Array.isArray(parsed))guestItems=parsed.map(normalise)}catch{}
   const guestPrefsRaw=localStorage.getItem('frame-guest-preferences');
   let guestPrefs:Record<string,string>={};
   try{const parsed=guestPrefsRaw?JSON.parse(guestPrefsRaw):{};if(parsed&&typeof parsed==='object')guestPrefs=parsed as Record<string,string>}catch{}
   const {data}=await client.from('media_items').select('*,media_metadata(*)').eq('user_id',user.id).order('score',{ascending:false});
   if(active&&data){
    const cloudItems=data.map(dbToMedia);
    const merged=guestItems.length?mergeMediaLists(cloudItems,guestItems):cloudItems;
    if(merged.length){
     setItems(merged);try{localStorage.setItem(`frame-library:${user.id}`,JSON.stringify(merged))}catch{}
     if(guestItems.length){const {error}=await client.from('media_items').upsert(merged.map(item=>toRow(item,user.id)),{onConflict:'id'});if(!error)localStorage.removeItem('frame-library:guest');else console.warn('[FRAME guest migration]',error)}
    }
    else{
     try{
      const raw=localStorage.getItem(`frame-library:${user.id}`);const local=raw?JSON.parse(raw):[];
      if(Array.isArray(local)&&local.length){const next=local.map(normalise);setItems(next);const {error}=await client.from('media_items').upsert(next.map(item=>toRow(item,user.id)),{onConflict:'id'});if(error)console.warn('[FRAME cloud seed]',error)}
     }catch(e){console.warn('[FRAME local library recovery]',e)}
    }
    const {data:prefs}=await client.from('user_preferences').select('*').eq('user_id',user.id).maybeSingle();
    const effectivePrefs={...(prefs||{}),...guestPrefs};
    if(Object.keys(effectivePrefs).length){
     setSortMode(String(effectivePrefs.default_sort||'rating'));setDensity(String(effectivePrefs.density||'comfortable'));setAiProvider(String(effectivePrefs.ai_provider||'frame'));
     const savedTheme=String(effectivePrefs.theme||'sky');setTheme((['sky','samsung','apple','oneplus','nothing','amoled','pixel','material','retro'].includes(savedTheme)?savedTheme:'sky'));
     setAppearanceMode((['light','dark','system'].includes(String(effectivePrefs.appearance_mode))?String(effectivePrefs.appearance_mode):'light') as 'light'|'dark'|'system');
     if(Object.keys(guestPrefs).length){const {error}=await client.from('user_preferences').upsert({...guestPrefs,user_id:user.id,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(!error)localStorage.removeItem('frame-guest-preferences')}
    }
   }
   const {data:p}=await client.from('profiles').select('*').eq('id',user.id).maybeSingle();
   if(p)setProfile({...p,frame_logo:p.frame_logo&&p.frame_logo!=='ultra-instinct'?p.frame_logo:'frame-mark'} as Profile);
   else{
    const base=(user.email?.split('@')[0]||'frameuser').replace(/[^A-Za-z0-9_]/g,'').slice(0,18)||'frameuser';
    const username=base+'_'+user.id.replace(/-/g,'').slice(0,6);
    const {data:created}=await client.from('profiles').upsert({id:user.id,username,display_name:user.email?.split('@')[0]||'FRAME User',bio:'',frame_logo:'frame-mark'},{onConflict:'id'}).select().maybeSingle();
    if(created)setProfile({...created,frame_logo:created.frame_logo||'ultra-instinct'} as Profile);
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

 const save=async(list:MediaItem[])=>{
  const next=list.map(normalise);setItems(next);try{localStorage.setItem(storageKey,JSON.stringify(next))}catch{}
  const client=supabase;
  if(!client||!user?.id)return true;
  const operation=saveQueue.current.then(async()=>{
  try{
   if(next.length===0){const {error}=await client.from('media_items').delete().eq('user_id',user.id);if(error){setAppMessage('Cloud save failed: '+error.message);window.setTimeout(()=>setAppMessage(''),5000);return false}return true}
   const {error}=await client.from('media_items').upsert(next.map(item=>toRow(item,user.id)),{onConflict:'id'});
   if(error){setAppMessage('Cloud save failed: '+error.message);window.setTimeout(()=>setAppMessage(''),5000);return false}
   const {data:cloudRows,error:cloudReadError}=await client.from('media_items').select('id').eq('user_id',user.id);
   if(cloudReadError){setAppMessage('Cloud sync check failed: '+cloudReadError.message);window.setTimeout(()=>setAppMessage(''),5000);return false}
   const keep=new Set(next.map(item=>item.id));
   const stale=(cloudRows||[]).map(row=>String(row.id)).filter(id=>!keep.has(id));
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
 const mergeImported= (incoming:MediaItem[])=>{  const merged=[...items];let added=0,updated=0;  const seen=new Set<string>();  for(const raw of incoming){   const item=normalise(raw);   const fingerprint=item.anilistId?`anilist:${item.anilistId}`:item.sourceProvider&&item.externalId?`${item.sourceProvider}:${item.externalId}`:`title:${item.medium}:${item.title.trim().toLowerCase()}`;   if(seen.has(fingerprint))continue;   seen.add(fingerprint);   const index=merged.findIndex(x=>(item.anilistId&&x.anilistId===item.anilistId)||(item.sourceProvider&&item.externalId&&x.sourceProvider===item.sourceProvider&&x.externalId===item.externalId)||((x.title||'').trim().toLowerCase()===(item.title||'').trim().toLowerCase()&&x.medium===item.medium));   if(index<0){merged.unshift(item);added++;continue}   const current=merged[index];   merged[index]=normalise({...item,id:current.id,parentId:current.parentId||item.parentId,progress:current.progress??item.progress,total:current.customTotal??current.total??item.total, status:current.status==='planned'&&item.status!=='planned'?item.status:current.status, personalRating:current.personalRating??item.personalRating, favorite:current.favorite,notes:current.notes,customTotal:current.customTotal});   updated++;  }  save(merged);  const noticeClient=supabase;if(noticeClient&&user?.id)void noticeClient.from('frame_notifications').insert({user_id:user.id,type:'system',title:'Library import complete',body:`FRAME merged ${added} new and ${updated} existing entries.`,href:'library',dedupe_key:'import:'+new Date().toISOString().slice(0,19)}); }; const refreshMetadata=async(item:MediaItem)=>{  if(item.sourceProvider!=='anilist'&&!item.anilistId)return item;  try{   const data=await aniList<any>(DETAIL_QUERY,{id:Number(item.anilistId||item.externalId)});   const m=data?.Media;if(!m)return item;   return normalise({...item,title:titleOf(m),alternativeTitles:[m.title?.english,m.title?.romaji,m.title?.native].filter(Boolean).map(String),description:cleanDescription(m.description),poster:m.coverImage?.extraLarge||item.poster,backdrop:m.bannerImage||item.backdrop,genres:Array.isArray(m.genres)?m.genres.map(String):item.genres,themes:Array.isArray(m.tags)?m.tags.slice(0,12).map((x:any)=>String(x.name)).filter(Boolean):item.themes,studio:m.studios?.nodes?.[0]?.name||item.studio,score:m.averageScore==null?item.score:Number(m.averageScore)/10,total:item.customTotal??(m.episodes||m.chapters||m.volumes||item.total),year:m.startDate?.year?Number(m.startDate.year):item.year,season:m.season||item.season,duration:m.duration==null?item.duration:Number(m.duration)});  }catch{return item} }; const refreshRadar=async()=>{
  const client=supabase;if(!client||!user?.id)return;
  setRadarBusy(true);setRadarError('');
  try{const {data,error}=await client.functions.invoke('release-radar',{body:{action:'refresh'}});if(error)throw error;const releases=Array.isArray((data as any)?.releases)?(data as any).releases:[];setRadar(releases);if(user?.id){const current=releases.filter((x:any)=>x?.released).slice(0,30);if(current.length){
     const rows=current.map((x:any)=>({user_id:user.id,type:'release',title:x.title+' · Episode '+x.episode,body:'A tracked release is available now.',href:'radar',dedupe_key:'release:'+x.anilistId+':'+x.episode}));
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
 const persist=async(key:string,value:string)=>{const client=supabase;if(client&&user?.id){await client.from('user_preferences').upsert({user_id:user.id,[key]:value,updated_at:new Date().toISOString()},{onConflict:'user_id'});return}if(guest){try{const raw=localStorage.getItem('frame-guest-preferences');const prefs=raw?JSON.parse(raw):{};prefs[key]=value;localStorage.setItem('frame-guest-preferences',JSON.stringify(prefs))}catch{}}};
 const removeOwnedArtwork=async(url?:string)=>{const client=supabase;if(!client||!user?.id||!url)return;try{const parsed=new URL(url);const prefix='/storage/v1/object/public/frame-media-art/';if(!parsed.pathname.startsWith(prefix))return;const path=decodeURIComponent(parsed.pathname.slice(prefix.length));if(path.startsWith(user.id+'/'))await client.storage.from('frame-media-art').remove([path]);}catch{}};
 const updateConnection=async(id:string)=>{const enabled=!connections[id];setConnections({...connections,[id]:enabled});const client=supabase;if(client&&user?.id)await client.from('connected_apps').upsert({user_id:user.id,provider:id,enabled,config:{}},{onConflict:'user_id,provider'})};
 const shown=useMemo(()=>{
  const normalized=query.trim().toLowerCase();
  const matches=(x:MediaItem)=>{
   const text=[x.title,...(x.alternativeTitles||[]),x.medium,x.status,x.description||'',...(x.genres||[])].join(' ').toLowerCase();
   const textMatch=!normalized||text.includes(normalized);
   const filterMatch=filter==='all'||x.status===filter||x.medium===filter;
   return textMatch&&filterMatch;
  };
  const statusFilter=['watching','reading','playing','completed','planned','paused','dropped'].includes(filter);
  const childrenByParent=new Map<string,MediaItem[]>();
  for(const item of items){
   if(!item.parentId)continue;
   const bucket=childrenByParent.get(item.parentId)||[];
   bucket.push(item);
   childrenByParent.set(item.parentId,bucket);
  }
  const hasMatchingDescendant=(rootId:string)=>{
   const visited=new Set<string>([rootId]);
   const stack=[...(childrenByParent.get(rootId)||[])];
   while(stack.length){
    const child=stack.pop()!;
    if(visited.has(child.id))continue;
    visited.add(child.id);
    if(matches(child))return true;
    for(const nested of childrenByParent.get(child.id)||[])if(!visited.has(nested.id))stack.push(nested);
   }
   return false;
  };
  return sortMedia(items,sortMode).filter(x=>{
   if(matches(x))return true;
   if(statusFilter)return !x.parentId&&hasMatchingDescendant(x.id);
   if(x.parentId){
    const parent=items.find(y=>y.id===x.parentId);
    return Boolean(parent&&matches(parent));
   }
   return hasMatchingDescendant(x.id);
  });
 },[items,sortMode,query,filter]);
 const go=(next:string)=>{setPage(next);setMenu(false);setSelected(null);if(next!=='friend-library')setFriendLibrary(null)};

 return <div className="frame-app">
  {appMessage&&<div className="frame-app-message" role="status">{appMessage}<button onClick={()=>setAppMessage('')} aria-label="Dismiss">×</button></div>}
  <header className="frame-topbar">
   <button className="frame-brand" title="Open FRAME home" onClick={()=>go('home')}><FrameLogoMark logo={profile?.frame_logo}/><b>FRAME</b></button>
   <nav className="frame-nav">
    {[[['home','Home'],HomeIcon],[['library','Library'],Library],[['discover','Discover'],Compass],[['web','Web'],Globe],[['radar','Radar'],CalendarDays],[['ai','AI'],Bot],[['friends','Friends'],Users],[['chat','Chat'],MessageCircle],[['calls','Calls'],Phone],[['settings','Settings'],Settings]].map(([pair,I])=>{const[id,label]=pair as string[],Icon=I as typeof HomeIcon;return <button key={id} className={page===id?'active':''} onClick={()=>go(id)}><Icon size={16}/>{label}</button>})}
   </nav>
   <div className="frame-actions">
    <div className="global-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&setFinder(true)} placeholder="Search your library…"/></div>
    <button className="primary top-find" onClick={()=>setFinder(true)}><Search size={16}/>Search</button>
    <button className="top-icon" title="Connections" aria-label="Connections" onClick={()=>go('connections')}><Link2 size={18}/></button>
    <FrameNotifications uid={uid} onNavigate={href=>href&&go(href)}/>
    {guest&&<button className="secondary guest-signin" type="button" onClick={()=>{localStorage.removeItem('frame-guest');window.location.reload()}}>Sign in</button>}
    <span className="top-avatar" title={profile?.display_name||user?.email||'FRAME account'} aria-label={profile?.display_name||user?.email||'FRAME account'}>{(profile?.display_name||user?.email||'G')[0].toUpperCase()}</span>
    <button className="top-icon mobile-only" onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button>
   </div>
  </header>
  {menu&&<div className="frame-mobile-menu">{[['home','Home'],['library','Library'],['discover','Discover'],['web','Google Search'],['radar','Release Radar'],['ai','AI'],['friends','Friends'],['chat','Global Chat'],['calls','Calls'],['connections','Connections'],['settings','Settings']].map(([id,label])=><button key={id} onClick={()=>go(id)}>{label}</button>)}</div>}
  <main className="frame-main">
   {page==='home'&&<Home items={shown} total={items.length} open={setSelected} finder={()=>setFinder(true)} go={go} name={profile?.display_name}/>}
   {page==='library'&&<LibraryPage items={shown} filter={filter} setFilter={setFilter} sort={sortMode} setSort={x=>{setSortMode(x);void persist('default_sort',x)}} open={setSelected} add={()=>setFinder(true)}/>}
   {page==='discover'&&<Discover finder={()=>setFinder(true)} ai={()=>go('ai')}/>} 
   {page==='web'&&<FrameWebSearch/>}
   {page==='radar'&&<RadarPage releases={radar} busy={radarBusy} error={radarError} refresh={()=>void refreshRadar()}/>}
   {page==='ai'&&<FrameAI items={items} provider={aiProvider} setProvider={x=>{setAiProvider(x);void persist('ai_provider',x)}}/>}
   {page==='friends'&&<FrameSocial uid={uid} guest={guest} onOpenLibrary={id=>{setFriendLibrary(id);setPage('friend-library')}} onCall={setDirectCall}/>}
   {page==='chat'&&<FrameGlobalChat uid={uid} guest={guest}/>} 
   {page==='calls'&&<CallsPage uid={uid} profile={profile} onCloseCall={()=>{}}/>}
   {page==='connections'&&<><Connections connections={connections} toggle={updateConnection} onImportSteamGame={addSteamGame}/><FrameLibraryImport onImport={mergeImported}/></>}
   {page==='settings'&&<SettingsPage user={user} profile={profile} setProfile={setProfile} guest={guest} density={density} setDensity={x=>{setDensity(x);void persist('density',x)}} theme={theme} setTheme={x=>{setTheme(x);void persist('theme',x)}} appearanceMode={appearanceMode} setAppearanceMode={x=>{setAppearanceMode(x);void persist('appearance_mode',x)}} items={items} onImport={mergeImported} preferences={{default_sort:sortMode,density,theme,appearance_mode:appearanceMode,ai_provider:aiProvider}}/>}
   {page==='friend-library'&&friendLibrary&&<FriendLibrary id={friendLibrary} onBack={()=>go('friends')}/>}
  </main>
  <nav className="mobile-bottom">
   {[[['home','Home'],HomeIcon],[['library','Library'],Library],[['search','Search'],Search],[['chat','Chat'],MessageCircle],[['friends','Friends'],Users]].map(([pair,I])=>{const[id,label]=pair as string[],Icon=I as typeof Search;return <button key={id} className={page===id?'active':''} onClick={()=>id==='search'?setFinder(true):go(id)}><Icon size={19}/><span>{label}</span></button>})}
  </nav>
  {selected&&<FrameDetail item={selected} library={items} close={()=>setSelected(null)} onRefreshMetadata={refreshMetadata} onDelete={async id=>{const target=items.find(i=>i.id===id);const children=items.filter(i=>i.parentId===id);const next=items.filter(i=>i.id!==id).map(i=>i.parentId===id?{...i,parentId:undefined}:i);const client=supabase;if(client&&user?.id){const {error}=await client.from('media_items').delete().eq('id',id).eq('user_id',user.id);if(error){setAppMessage('Delete failed: '+error.message);window.setTimeout(()=>setAppMessage(''),5000);return}}setSelected(null);await save(next);await removeOwnedArtwork(target?.poster);if(target?.backdrop&&target.backdrop!==target.poster)await removeOwnedArtwork(target.backdrop);if(children.length){setAppMessage('Entry deleted. Its child entries were kept and detached.');window.setTimeout(()=>setAppMessage(''),5000)}}} save={async x=>{const previous=items.find(i=>i.id===x.id);const ok=await save(items.map(i=>i.id===x.id?x:i));if(ok&&previous){if(previous.poster&&previous.poster!==x.poster)await removeOwnedArtwork(previous.poster);if(previous.backdrop&&previous.backdrop!==x.backdrop&&previous.backdrop!==previous.poster&&previous.backdrop!==x.poster)await removeOwnedArtwork(previous.backdrop)}return ok}}/>}
  {finder&&<AniListSearch initialQuery={query} close={()=>setFinder(false)} onImported={importItem} onManual={()=>{setFinder(false);setManualEntry(true)}} onAi={()=>{setFinder(false);go('ai')}}/>}
  {manualEntry&&<ManualEntryForm close={()=>setManualEntry(false)} onCreate={raw=>{const item=normalise({...raw,id:crypto.randomUUID()});save([item,...items]);setSelected(item);setManualEntry(false);}}/>}
  {!guest&&<FrameDirectCall uid={uid} target={directCall} onClear={()=>setDirectCall(null)}/>} 
  <FramePopupHub uid={uid} onFind={()=>setFinder(true)} onOpenCalls={()=>go('calls')} onCall={setDirectCall}/>
  {commandOpen&&<FrameCommandPalette onGo={go} onFind={()=>setFinder(true)} onClose={()=>setCommandOpen(false)}/>}
 </div>;
}

function ManualEntryForm({close,onCreate}:{close:()=>void;onCreate:(item:MediaItem)=>void}){
 const [title,setTitle]=useState(''),[medium,setMedium]=useState<Medium>('anime'),[status,setStatus]=useState<MediaItem['status']>('planned'),[progress,setProgress]=useState(0),[total,setTotal]=useState(0),[posterUrl,setPosterUrl]=useState(''),[description,setDescription]=useState('');
 const units:Record<Medium,string>={anime:'episodes',manga:'chapters',manhwa:'chapters','light-novel':'chapters','visual-novel':'%',movie:'watch state',series:'episodes',game:'%',book:'pages'};
 const submit=()=>{if(!title.trim())return;const t=total>0?Math.min(2000,total):undefined;const max=medium==='movie'?1:(medium==='game'||medium==='visual-novel'?100:(t||2000));onCreate({id:crypto.randomUUID(),title:title.trim(),description,poster:posterUrl.trim(),backdrop:posterUrl.trim(),medium,status,progress:Math.max(0,Math.min(max,progress)),total:t,progressUnit:units[medium],genres:[],themes:[],favorite:false})};
 return <div className="overlay"><aside className="detail-drawer manual-entry-drawer"><button className="close-btn" onClick={close} aria-label="Close"><X/></button><div className="manual-entry-head"><small>MANUAL ENTRY</small><h2>Add anything to FRAME.</h2><p>Use this for media that no catalogue can identify. You can edit all of it later.</p></div><div className="call-form manual-entry-form"><label>Title<input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. a local series, book, game…" /></label><label>Media type<select value={medium} onChange={e=>setMedium(e.target.value as Medium)}>{Object.entries(types).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value as MediaItem['status'])}>{[['planned','Planned'],['watching','Watching'],['reading','Reading'],['playing','Playing'],['completed','Completed'],['paused','Paused'],['dropped','Dropped']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><div className="manual-two-col"><label>Progress<input type="number" min="0" max="2000" value={progress} onChange={e=>setProgress(Number(e.target.value)||0)}/></label><label>Total<input type="number" min="0" max="2000" value={total||''} onChange={e=>setTotal(Number(e.target.value)||0)} placeholder="Optional" /></label></div><label>Poster URL<input value={posterUrl} onChange={e=>setPosterUrl(e.target.value)} placeholder="https://…" /></label><label>Description<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Optional description…" /></label><button className="primary" disabled={!title.trim()} onClick={submit}><CirclePlus size={16}/>Add to my library</button></div></aside></div>;
}
function Home({items,total,open,finder,go,name}:{items:MediaItem[];total:number;open:(x:MediaItem)=>void;finder:()=>void;go:(x:string)=>void;name?:string}){
 const active=items.filter(x=>['watching','reading','playing'].includes(x.status));
 const favorites=items.filter(x=>x.favorite);
 const topRated=[...items].sort((a,b)=>(b.personalRating??b.score??0)-(a.personalRating??a.score??0));
 return <div className="page home-page">
  <section className="home-intro"><div className="home-intro-copy"><small>FRAME HOME</small><h1>{'Welcome back'+(name?', '+name:'')+'.'}</h1><p>{total?'You have '+total+' '+(total===1?'title':'titles')+' in your library.':'Your library is empty. Add your first title to get started.'}</p></div><div className="home-intro-actions"><button className="primary" onClick={finder}><Search size={16}/>Add media</button><button className="secondary" onClick={()=>go('library')}><Library size={16}/>Open library</button></div></section>
  <section className="home-overview" aria-label="Library overview"><div><b>{total}</b><span>Library</span></div><div><b>{active.length}</b><span>In progress</span></div><div><b>{items.filter(x=>x.status==='completed').length}</b><span>Completed</span></div><div><b>{favorites.length}</b><span>Favorites</span></div></section>
  {active.length>0&&<section className="home-shelf home-continue"><div className="section-title"><div><small>KEEP GOING</small><h2>Continue</h2></div><button className="text-action" onClick={()=>go('library')}>View library <ChevronRight size={14}/></button></div><div className="media-grid">{active.slice(0,5).map(x=><Card key={x.id} item={x} open={open}/>)}</div></section>}
  {favorites.length>0&&<section className="home-shelf home-favorites"><div className="section-title"><div><small>PINNED</small><h2>Favorites</h2></div><span>{favorites.length}</span></div><div className="media-grid">{favorites.slice(0,5).map(x=><Card key={x.id} item={x} open={open}/>)}</div></section>}
  <section className="home-tools"><div className="home-tools-head"><small>SHORTCUTS</small><h2>Go somewhere</h2></div><div className="home-tool-grid"><button onClick={finder}><Search size={19}/><span><b>Find media</b><small>Search every connected catalogue</small></span><ChevronRight size={15}/></button><button onClick={()=>go('discover')}><Compass size={19}/><span><b>Discover</b><small>Explore new titles and sources</small></span><ChevronRight size={15}/></button><button onClick={()=>go('radar')}><CalendarDays size={19}/><span><b>Release Radar</b><small>See tracked releases</small></span><ChevronRight size={15}/></button></div></section>
  {total>0&&<section className="home-shelf home-top-rated"><div className="section-title"><div><small>YOUR SCORES</small><h2>Top rated</h2></div><span>{topRated.length}</span></div><div className="media-grid">{topRated.slice(0,6).map(x=><Card key={x.id} item={x} open={open}/>)}</div></section>}
  {!total&&<section className="home-empty"><div className="home-empty-mark"><img src="/frame-logo.svg" alt=""/></div><div><small>NO TITLES YET</small><h2>Start with something you already watch, read or play.</h2><p>Use the finder to pull in metadata, then set the status and progress you want.</p><button className="primary" onClick={finder}><Search size={15}/>Find your first title</button></div></section>}
 </div>;
}
function Stat({value,label}:{value:number;label:string}){return <div className="stat-card"><b>{value}</b><span>{label}</span></div>}
function Card({item,open}:{item:MediaItem;open:(x:MediaItem)=>void}){
 const pct=item.medium==='game'||item.medium==='visual-novel'?item.progress:item.progress/(item.total||1)*100;
 return <button className="media-card" onClick={()=>open(item)}><div className="media-poster"><img src={item.poster||poster} alt="" loading="lazy"/><span className="medium-pill">{types[item.medium]}</span><span className="score-pill"><Star size={10} fill="currentColor"/>{item.score==null?'—':item.score.toFixed(1)}</span></div><div className="media-copy"><b>{item.title}</b><small>{item.status==='completed'?'Completed':item.progress+' / '+(item.total||500)} {item.progressUnit||unitFor(item.medium)}</small><div className="card-progress"><i style={{width:Math.min(100,Math.max(0,pct))+'%'}}/></div><span className="personal-line">{item.personalRating!=null?'Your '+item.personalRating.toFixed(1):'Rate it yourself'}</span></div></button>;
}

function LibraryPage({items,filter,setFilter,sort,setSort,open,add}:{items:MediaItem[];filter:string;setFilter:(x:string)=>void;sort:string;setSort:(x:string)=>void;open:(x:MediaItem)=>void;add:()=>void}){
 const fs:[string,string][]=[['all','All'],['watching','Watching'],['reading','Reading'],['playing','Playing'],['completed','Completed'],['planned','Planned'],['paused','Paused'],['dropped','Dropped'],...Object.entries(types)];
 return <div className="page library-page"><div className="page-heading"><div><small>YOUR COLLECTION</small><h1>Library</h1><p>Every media type is equal. Sort by rating, your rating, progress, newest or title.</p></div><button className="primary" onClick={add}><CirclePlus size={17}/>Add media</button></div><div className="library-controls"><div className="filter-scroll">{fs.map(([id,label])=><button className={filter===id?'active':''} key={id} onClick={()=>setFilter(id)}>{label}</button>)}</div><label className="sort-select"><span>Sort</span><select value={sort} onChange={e=>setSort(e.target.value)}><option value="rating">Rating</option><option value="personal">My rating</option><option value="recent">Newest</option><option value="progress">Progress</option><option value="title">Title</option></select></label></div><div className="media-grid">{items.map(x=><Card key={x.id} item={x} open={open}/>)}</div>{!items.length&&<Empty text="Nothing matches these filters."/ >}</div>;
}
function Discover({finder,ai}:{finder:()=>void;ai:()=>void}){return <div className="page"><div className="page-heading"><div><small>UNIVERSAL DISCOVERY</small><h1>Explore everything.</h1><p>One consistent interface for media, metadata, availability, AI and connected services.</p></div></div><div className="feature-grid"><button className="feature-card" onClick={finder}><Search size={22}/><h3>Universal search</h3><p>AniList, Steam, TVMaze, VNDB, Open Library and more.</p><ChevronRight/></button><button className="feature-card" onClick={ai}><Bot size={22}/><h3>AI search</h3><p>Describe a story, mood, genre or similarity in plain language.</p><ChevronRight/></button><div className="feature-card"><ExternalLink size={22}/><h3>Where to find it</h3><p>Open legal watch, read, play and buying destinations.</p></div><div className="feature-card"><Link2 size={22}/><h3>Connections</h3><p>Control the catalogues and services FRAME uses.</p></div></div></div>}
function RadarPage({releases,busy,error,refresh}:{releases:Radar[];busy:boolean;error:string;refresh:()=>void}){const up=releases.filter(x=>!x.released).sort((a,b)=>Date.parse(a.airingAt)-Date.parse(b.airingAt));return <div className="page radar-page"><div className="page-heading"><div><small>RELEASE INTELLIGENCE</small><h1>Release Radar</h1><p>Upcoming releases for tracked AniList titles.</p></div><button className="secondary" disabled={busy} onClick={refresh}>{busy?<RefreshCw className="spin"/>:<RefreshCw/>}Refresh</button></div>{error&&<div className="inline-error">{error}</div>}<section className="radar-panel"><div className="section-title"><div><small>UP NEXT</small><h2>Upcoming</h2></div><span>{up.length}</span></div>{up.length?<div className="release-list">{up.slice(0,30).map(x=><div key={x.anilistId+'-'+x.episode}><img src={x.poster||poster} alt=""/><section><b>{x.title}</b><small>Episode {x.episode}</small><span>{new Date(x.airingAt).toLocaleString()}</span></section></div>)}</div>:<Empty text="No upcoming tracked releases."/ >}</section></div>}

function Connections({connections:_,toggle:_toggle,onImportSteamGame}:{connections:Record<string,boolean>;toggle:(id:string)=>void;onImportSteamGame:(game:{appId?:string;name:string;header?:string;storeUrl?:string})=>void}){ const [linkMessage,setLinkMessage]=useState(''); const [steamId,setSteamId]=useState(''); const [steamGames,setSteamGames]=useState<Array<{appId:string;name:string;playtimeMinutes:number;header?:string;storeUrl?:string}>>([]); const [identityProviders,setIdentityProviders]=useState<string[]>([]); const [profileLinks,setProfileLinks]=useState<Record<string,string>>({}); const [busyProfile,setBusyProfile]=useState(''); const {user}=useAuth(); useEffect(()=>{setIdentityProviders((user?.identities||[]).map(x=>String(x.provider)))},[user?.id,user?.identities?.length]); useEffect(()=>{  if(!supabase||!user?.id)return;  void (async()=>{   const {data}=await supabase.from('connected_apps').select('provider,config').eq('user_id',user.id);   const next:Record<string,string>={};   (data||[]).forEach((row:any)=>{    const provider=String(row.provider||'');    const cfg=row.config&&typeof row.config==='object'?row.config as Record<string,unknown>:{};    if(provider==='steam'&&typeof cfg.steamId==='string'&&cfg.steamId.trim()){setSteamId(cfg.steamId);localStorage.setItem('frame-steam-id:'+user.id,cfg.steamId)}    if(provider.startsWith('profile:')&&typeof cfg.url==='string'&&cfg.url.trim())next[provider.slice(8)]=cfg.url;   });   if(!steamId)setSteamId(localStorage.getItem('frame-steam-id:'+user.id)||'');   setProfileLinks(next);  })(); },[user?.id]); const socialProviders=[  ['google','Google','Sign in identity and account recovery.'],  ['github','GitHub','Developer identity and account access.'],  ['discord','Discord','Identity plus FRAME community workflows.'],  ['spotify','Spotify','Identity, music-aware features and optional playback controls.'],  ['twitch','Twitch','Gaming/creator identity and future community features.'] ] as const; const profileServices=[  ['anilist','AniList','Anime / manga profile'],  ['myanimelist','MyAnimeList','Anime / manga profile'],  ['crunchyroll','Crunchyroll','Watchlist / profile link'],  ['mangadex','MangaDex','Manga / manhwa profile'],  ['imdb','IMDb','Movie / series profile'],  ['letterboxd','Letterboxd','Film diary / profile'] ] as const; useEffect(()=>{  if(!supabase||!user?.id)return;  void (async()=>{   const steamLocal=localStorage.getItem('frame-steam-id:'+user.id);   if(steamLocal&&!steamId)setSteamId(steamLocal);  })(); },[user?.id]); const socialConnect=async(provider:'google'|'github'|'discord'|'spotify'|'twitch')=>{  const client=supabase;if(!client||!user){setLinkMessage('Log in to connect external accounts.');return}  setLinkMessage('');  try{   const scopes=provider==='spotify'?'user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-private':provider==='discord'?'identify email':undefined;   const options:any={redirectTo:window.location.origin};   if(scopes)options.scopes=scopes;   const {error}=await client.auth.linkIdentity({provider,options});   if(error)throw error;  }catch(e){setLinkMessage(e instanceof Error?e.message:'That OAuth connection could not be started. Make sure the provider is enabled in Supabase Auth.')} }; const disconnect=async(provider:string)=>{  const client=supabase;if(!client||!user)return;  const identity=(user.identities||[]).find(x=>x.provider===provider);  if(!identity)return;  const {error}=await client.auth.unlinkIdentity(identity);  if(error)setLinkMessage(error.message);  else setIdentityProviders((user.identities||[]).filter(x=>x.provider!==provider).map(x=>String(x.provider))); }; const saveProfileLink=async(service:string,url:string)=>{  const client=supabase;if(!client||!user){setLinkMessage('Log in to save account links.');return}  const clean=url.trim();  if(clean){   try{const parsed=new URL(clean);if(!['http:','https:'].includes(parsed.protocol))throw new Error('Use a normal https:// or http:// profile URL.')}catch{setLinkMessage('Enter a valid profile URL beginning with https://');return}  }  setBusyProfile(service);setLinkMessage('');  const provider='profile:'+service;  const op=clean   ?client.from('connected_apps').upsert({user_id:user.id,provider,enabled:true,config:{url:clean}},{onConflict:'user_id,provider'})   :client.from('connected_apps').delete().eq('user_id',user.id).eq('provider',provider);  const {error}=await op;  if(error)setLinkMessage(error.message);else setProfileLinks(prev=>{const next={...prev};if(clean)next[service]=clean;else delete next[service];return next});  setBusyProfile(''); }; const syncSteam=async()=>{  const client=supabase;if(!client||!user){setLinkMessage('Log in to sync your Steam library.');return}  if(!steamId.trim()){setLinkMessage('Enter your SteamID64 or public profile identifier first.');return}  setLinkMessage('');  const {data,error}=await client.functions.invoke('steam-library',{body:{steamId:steamId.trim()}});  if(error){setLinkMessage(error.message);return}  const games=((data as {games?:Array<{appId:string;name:string;playtimeMinutes:number;header?:string;storeUrl?:string}>})?.games||[]);  localStorage.setItem('frame-steam-id:'+user.id,steamId.trim());setSteamGames(games);  setLinkMessage(games.length+' Steam games synced.');  await client.from('connected_apps').upsert({user_id:user.id,provider:'steam',enabled:true,config:{steamId:steamId.trim()}},{onConflict:'user_id,provider'}); }; const catalogueRows=[  ['AniList','Anime, manga, manhwa and light novels'],['TVMaze','Series and episode metadata'],['VNDB','Visual novels'],['Open Library','Books and novels'],['Steam Store','Game discovery and store metadata'],['Wikipedia','Movie discovery'] ] as const; return <div className="page connections-page">  <div className="page-heading"><div><small>SERVICE CONTROL</small><h1>Connections</h1><p>Connect real identities where OAuth is supported, or save safe profile links for services that do not expose a FRAME-ready OAuth flow. FRAME never asks for those service passwords.</p></div></div>  <section className="connections-section"><div className="connections-section-head"><div><small>BUILT-IN CATALOGUES</small><h2>Ready to use</h2></div><span>{catalogueRows.length} sources</span></div><div className="connections-grid">{catalogueRows.map(([name,description])=><div className="connection-card" key={name}><div className="connection-icon"><Link2 size={19}/></div><div><b>{name}</b><p>{description}</p><small>Built in · no account connection</small></div><span className="connection-status built-in">Available</span></div>)}</div></section>  <section className="connections-section"><div className="connections-section-head"><div><small>ACCOUNT IDENTITIES</small><h2>OAuth accounts</h2></div><span>Supabase Auth · secure redirect</span></div><div className="connections-grid">   {socialProviders.map(([provider,name,description])=>{const connected=identityProviders.includes(provider);return <div className="connection-card" key={provider}><div className="connection-icon"><Link2 size={19}/></div><div><b>{name}</b><p>{description}</p><small>{connected?'OAuth · connected':'OAuth · connect when enabled'}</small></div>{connected?<button className="secondary" onClick={()=>void disconnect(provider)}>Disconnect</button>:<button className="secondary" onClick={()=>void socialConnect(provider)}>Connect</button>}</div>})}   <div className="connection-card"><div className="connection-icon"><Gamepad2 size={19}/></div><div><b>Steam account</b><p>Import owned games and use FRAME as the tracking layer for your Steam library.</p><small>{steamGames.length?'Synced '+steamGames.length+' games':'Not synced'} · server-side Web API</small></div><div className="call-form"><input value={steamId} onChange={e=>setSteamId(e.target.value)} placeholder="SteamID64 / public profile ID"/><button className="secondary" onClick={()=>void syncSteam()}>Sync Steam</button></div></div>  </div></section>  <section className="connections-section"><div className="connections-section-head"><div><small>PROFILE LINKS</small><h2>Other services</h2></div><span>Safe URL links · no passwords</span></div><div className="connections-grid profile-links-grid">   {profileServices.map(([id,name,description])=><div className="connection-card profile-link-card" key={id}><div className="connection-icon"><Link2 size={19}/></div><div><b>{name}</b><p>{description}</p><small>{profileLinks[id]?'Linked account':'Not linked'}</small></div><div className="profile-link-editor"><input value={profileLinks[id]||''} onChange={e=>setProfileLinks(prev=>({...prev,[id]:e.target.value}))} placeholder="https://…"/><div><button className="secondary" disabled={busyProfile===id} onClick={()=>void saveProfileLink(id,profileLinks[id]||'')}>{busyProfile===id?'Saving…':profileLinks[id]?'Save':'Link'}</button>{profileLinks[id]&&<a className="secondary" href={profileLinks[id]} target="_blank" rel="noreferrer">Open</a>}</div></div></div>)}  </div></section>  {linkMessage&&<div className="inline-error" style={{marginTop:12}}>{linkMessage}</div>}  <FrameSpotifyControls connected={identityProviders.includes('spotify')} />  {steamGames.length>0&&<section className="calls-panel" style={{marginTop:14}}><div className="section-title"><div><small>STEAM LIBRARY</small><h2>Import and play</h2></div><span>{steamGames.length} synced</span></div><div className="media-grid">{steamGames.slice(0,30).map(g=><div key={g.appId} className="media-card steam-library-card"><div className="media-poster"><img src={g.header||''} alt="" loading="lazy"/></div><div className="media-copy"><b>{g.name}</b><small>{Math.round(g.playtimeMinutes/60)}h played</small><div className="steam-actions"><button className="secondary" onClick={()=>onImportSteamGame(g)}>Add to FRAME</button><a className="secondary" href={'steam://run/'+g.appId}>Play</a><a className="secondary" href={g.storeUrl||'#'} target="_blank" rel="noreferrer">Store</a></div></div></div>)}</div></section>}  <section className="connections-section"><div className="connections-section-head"><div><small>AI CONNECTIONS</small><h2>Secure providers</h2></div><span>Browser never holds provider secrets</span></div><div className="connections-grid ai-provider-grid">   <div className="connection-card"><div className="connection-icon"><Bot size={19}/></div><div><b>FRAME AI</b><p>Built-in library-aware assistant routed through the secure server function.</p><small>Built in · ready</small></div><span className="connection-status built-in">Ready</span></div>   {['OpenAI','Gemini','Claude'].map(name=><div className="connection-card" key={name}><div className="connection-icon"><Bot size={19}/></div><div><b>{name}</b><p>Optional server-side provider. Configure its secret only on the backend before enabling it.</p><small>Server connector · not configured</small></div><span className="connection-status not-configured">Not configured</span></div>)}  </div></section> </div>;}function SettingsPage({user,profile,setProfile,guest,density,setDensity,theme,setTheme,appearanceMode,setAppearanceMode,items,onImport,preferences}:{user:any;profile:Profile|null;setProfile:(p:Profile)=>void;guest:boolean;density:string;setDensity:(x:string)=>void;theme:string;setTheme:(x:string)=>void;appearanceMode:'light'|'dark'|'system';setAppearanceMode:(x:'light'|'dark'|'system')=>void;items:MediaItem[];onImport:(items:MediaItem[])=>void;preferences:Record<string,unknown>}){
 const[name,setName]=useState(profile?.display_name||''),[username,setUsername]=useState(profile?.username||''),[email,setEmail]=useState(user?.email||''),[logo,setLogo]=useState(profile?.frame_logo&&profile.frame_logo!=='ultra-instinct'?profile.frame_logo:'frame-mark'),[saved,setSaved]=useState(false),[emailBusy,setEmailBusy]=useState(false),[logoBusy,setLogoBusy]=useState(false),[logoMessage,setLogoMessage]=useState(''),[emailMessage,setEmailMessage]=useState(''),[securityBusy,setSecurityBusy]=useState(false),[securityMessage,setSecurityMessage]=useState('');
 useEffect(()=>{setName(profile?.display_name||'');setUsername(profile?.username||'');setLogo(profile?.frame_logo&&profile.frame_logo!=='ultra-instinct'?profile.frame_logo:'frame-mark')},[profile?.id,profile?.display_name,profile?.username,profile?.frame_logo]);useEffect(()=>setEmail(user?.email||''),[user?.id,user?.email]);
 const persistSetting=async(key:string,value:string)=>{if(supabase&&user?.id)await supabase.from('user_preferences').upsert({user_id:user.id,[key]:value,updated_at:new Date().toISOString()},{onConflict:'user_id'})};
 const save=async(logoOverride?:string)=>{const client=supabase;if(!client||!user?.id){setLogoMessage('Sign in to save account settings.');return}const clean=username.trim();if(clean.length<3){setLogoMessage('Username must be at least 3 characters.');return}const p={id:user.id,username:clean,display_name:name.trim()||clean,avatar_url:profile?.avatar_url||null,bio:profile?.bio||'',frame_logo:logoOverride??logo};const {error}=await client.from('profiles').upsert(p,{onConflict:'id'});if(!error){setProfile(p);setSaved(true);setTimeout(()=>setSaved(false),1400)}else setLogoMessage(error.message)};const saveEmail=async()=>{const client=supabase;if(!client||!user?.id){setEmailMessage('Sign in to change your email.');return}const clean=email.trim().toLowerCase();if(!/^\\S+@\\S+\\.\\S+$/.test(clean)){setEmailMessage('Enter a valid email address.');return}if(clean===String(user.email||'').toLowerCase()){setEmailMessage('That is already your account email.');return}setEmailBusy(true);setEmailMessage('Sending confirmation links…');try{const {error}=await client.auth.updateUser({email:clean});if(error)throw error;setEmailMessage('Confirmation links sent to your current and new email. Your new address activates after confirmation.')}catch(e){setEmailMessage(e instanceof Error?e.message:'Email update failed.')}finally{setEmailBusy(false)}};
 const uploadLogo=async(file:File)=>{if(!supabase||!user?.id){setLogoMessage('Sign in to upload a personal FRAME logo.');return}if(!file.type.startsWith('image/')){setLogoMessage('Choose an image file.');return}if(file.size>2*1024*1024){setLogoMessage('Logo must be 2 MB or smaller.');return}setLogoBusy(true);setLogoMessage('Uploading logo…');try{const ext=(file.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'')||'png';const path=user.id+'/frame-logo-'+Date.now()+'.'+ext;const {error}=await supabase.storage.from('frame-logos').upload(path,file,{upsert:true,contentType:file.type});if(error)throw error;const {data}=supabase.storage.from('frame-logos').getPublicUrl(path);if(!data.publicUrl)throw new Error('Could not create a public logo URL.');setLogo(data.publicUrl);await save(data.publicUrl);setLogoMessage('Custom logo saved.')}catch(e){setLogoMessage(e instanceof Error?e.message:'Logo upload failed.')}finally{setLogoBusy(false)}};
 const themes=[['sky','Sky','Airy glass'],['samsung','Samsung','Large touch surfaces'],['apple','Apple','Quiet and minimal'],['oneplus','OnePlus','Bold and focused'],['nothing','Nothing','Dot-matrix industrial'],['amoled','AMOLED','Edge-to-edge black'],['pixel','Pixel','Material blocks'],['material','Material','Expressive shapes'],['retro','Retro','CRT terminal']] as const;
 const logos=[['frame-mark','FRAME mark','Primary geometric symbol'],['classic-f','Classic F','Simple letter mark'],['minimal-ring','Minimal ring','Quiet circular mark']] as const;
 const resetAppearance=()=>{setTheme('sky');setAppearanceMode('light');setDensity('comfortable');void persistSetting('theme','sky');void persistSetting('appearance_mode','light');void persistSetting('density','comfortable')};
 return <div className="page settings-page">
  <section className="settings-hero"><div><small>FRAME CONTROL</small><h1>Settings</h1><p>Manage how FRAME looks and how your account is stored.</p></div><div className="settings-hero-status"><FrameLogoMark logo={logo} small/><div><b>{themes.find(x=>x[0]===theme)?.[1]||theme}</b><span>{appearanceMode[0].toUpperCase()+appearanceMode.slice(1)} mode · {density} density</span></div></div></section>
  
  <section id="settings-appearance" className="settings-panel settings-panel-wide"><div className="section-title"><div><small>LOOK & FEEL</small><h2>Appearance</h2><p>Each choice changes the interface shape, spacing and visual language.</p></div><button type="button" className="secondary settings-reset" onClick={resetAppearance}>Reset appearance</button></div><div className="appearance-control"><b>Theme</b><span>Pick a complete interface style.</span><div className="theme-picker">{themes.map(([id,label,sub])=><button type="button" key={id} className={'theme-choice '+(theme===id?'selected':'')} onClick={()=>{setTheme(id);void persistSetting('theme',id)}}><i className={'theme-preview '+id}><span/></i><strong>{label}</strong><small>{sub}</small>{theme===id&&<em>On</em>}</button>)}</div></div><div className="appearance-bottom-grid"><div className="appearance-control"><b>Mode</b><span>Choose the light/dark surface treatment.</span><div className="segmented-control">{(['light','dark','system'] as const).map(mode=><button type="button" key={mode} className={appearanceMode===mode?'active':''} onClick={()=>{setAppearanceMode(mode);void persistSetting('appearance_mode',mode)}}>{mode[0].toUpperCase()+mode.slice(1)}</button>)}</div></div><div className="appearance-control"><b>Density</b><span>Choose how much content fits on screen.</span><select className="settings-density-select" value={density} onChange={e=>{setDensity(e.target.value);void persistSetting('density',e.target.value)}}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select></div></div><div className="appearance-live"><span>LIVE</span><div><b>{themes.find(x=>x[0]===theme)?.[1]||theme} is active.</b><small>Changes are applied immediately.</small></div></div></section>
  <section id="settings-profile" className="settings-panel"><div className="section-title"><div><small>ACCOUNT</small><h2>Profile & logo</h2><p>Set the name shown in FRAME and choose the symbol used in the header.</p></div></div>{guest?<p className="muted">Guest mode keeps this information on the current device.</p>:<><div className="settings-form-grid"><label>Username<input value={username} onChange={e=>setUsername(e.target.value.replace(/[^A-Za-z0-9_]/g,''))}/></label><label>Display name<input value={name} onChange={e=>setName(e.target.value)}/></label></div><div className="settings-email-row"><label>Account email<input type="email" autoComplete="email" value={email} onChange={e=>{setEmail(e.target.value);setEmailMessage('')}}/></label><button type="button" className="secondary" disabled={emailBusy} onClick={()=>void saveEmail()}>{emailBusy?'Sending…':'Change email'}</button></div>{emailMessage&&<small className="data-tools-message">{emailMessage}</small>}<div className="logo-setting"><div><b>FRAME symbol</b><small>Your chosen mark appears in the top-left of the app.</small></div><div className="logo-picker">{logos.map(([id,label,sub])=><button type="button" key={id} className={'logo-choice '+(logo===id?'selected':'')} onClick={()=>{setLogo(id);void save(id)}}><FrameLogoMark logo={id} small/><span><strong>{label}</strong><small>{sub}</small></span></button>)}{logo.startsWith('http')&&<div className="logo-choice selected"><FrameLogoMark logo={logo} small/><span><strong>Custom</strong><small>Uploaded for this account</small></span></div>}</div><label className="logo-upload"><span>Upload a personal logo</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" disabled={logoBusy} onChange={e=>{const f=e.target.files?.[0];if(f)void uploadLogo(f);e.currentTarget.value='' }}/></label>{logoMessage&&<small className="data-tools-message">{logoMessage}</small>}<button type="button" className="primary" onClick={()=>void save()}>{saved?'Saved':'Save profile'}</button></div></>}</section>
  <div className="settings-bottom-grid"><section id="settings-data" className="settings-panel"><div className="section-title"><div><small>PORTABILITY</small><h2>Backup</h2><p>Export a copy of your library or import one on another device.</p></div></div><FrameDataTools items={items} profile={profile} preferences={preferences} onImport={onImport}/></section><section id="settings-security" className="settings-panel settings-security-panel"><div className="section-title"><div><small>ACCOUNT ACCESS</small><h2>Security</h2><p>Sign out from this device and return to the secure sign-in screen.</p></div></div>{guest?<><p className="muted">Guest changes are saved on this device. Sign in to attach them to your FRAME account.</p><button type="button" className="secondary" onClick={()=>{localStorage.removeItem('frame-guest');window.location.reload()}}>Sign in to FRAME</button></>:<><button type="button" className="danger" disabled={securityBusy} onClick={async()=>{setSecurityBusy(true);setSecurityMessage('Signing out…');try{await signOut()}catch(e){setSecurityMessage(e instanceof Error?e.message:'Could not sign out. Please try again.');setSecurityBusy(false)}}}><LogOut size={16}/>{securityBusy?'Signing out…':'Log out'}</button>{securityMessage&&<small className="data-tools-message">{securityMessage}</small>}</>}</section></div>
 </div>;
}
function FriendLibrary({id,onBack}:{id:string;onBack:()=>void}){
 const[items,setItems]=useState<MediaItem[]>([]);
 useEffect(()=>{if(!supabase)return;void(async()=>{const client=supabase;if(!client)return;const {data}=await client.from('media_items').select('*,media_metadata(*)').eq('user_id',id).order('score',{ascending:false});setItems((data||[]).map(dbToMedia))})()},[id]);
 return <div className="page"><button className="breadcrumb" onClick={onBack}>← Back to friends</button><div className="page-heading"><div><small>PERMISSION GRANTED</small><h1>Shared library</h1><p>This library is visible because your friend explicitly allowed access.</p></div></div><div className="media-grid">{items.map(x=><Card key={x.id} item={x} open={()=>{}}/>)}</div>{!items.length&&<Empty text="Nothing has been shared yet."/ >}</div>;
}
function Empty({text}:{text:string}){return <div className="empty-state"><Library size={25}/><p>{text}</p></div>}

import {useEffect,useMemo,useState} from 'react';
import {ArrowDownLeft,ArrowLeft,BookOpen,Check,ChevronDown,ChevronRight,CirclePlus,Clapperboard,FolderTree,Layers3,LogOut,Plus,RefreshCw,Search,Settings2,Trash2,X} from 'lucide-react';
import {useAuth} from './auth/Auth';
import {supabase} from './lib/supabase';
import {AniListSearch} from './components/AniListSearch';
import type {MediaItem,Status} from './types';

const statuses:Status[]=['watching','reading','playing','completed','planned','paused','dropped'];
const label=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
const fresh=(item:MediaItem):MediaItem=>({...item,poster:item.poster||'',backdrop:item.backdrop||'',genres:item.genres||[],themes:item.themes||[],favorite:Boolean(item.favorite)});
function toRow(item:MediaItem,userId:string){
 return {id:item.id,user_id:userId,parent_id:item.parentId??null,metadata_id:item.metadataId??null,anilist_id:item.anilistId??null,title:item.title,description:item.description,poster:item.poster,backdrop:item.backdrop,medium:item.medium,status:item.status,progress:item.progress,total:item.total??null,year:item.year??null,score:item.score??null,genres:item.genres,themes:item.themes,studio:item.studio??null,source:item.source??null,favorite:item.favorite,notes:item.notes??null,data:{provider:item.sourceProvider??null,externalId:item.externalId??null,personalRating:item.personalRating??null,progressUnit:item.progressUnit??'episodes',customTotal:item.customTotal??item.total??null,frameReleaseRadar:{enabled:item.notificationsEnabled!==false}}};
}
function fromRow(raw:any):MediaItem{
 const data=raw.data||{},meta=raw.media_metadata||{};
 return fresh({id:String(raw.id),parentId:raw.parent_id||undefined,metadataId:raw.metadata_id||undefined,anilistId:raw.anilist_id==null?undefined:Number(raw.anilist_id),sourceProvider:data.provider||(raw.anilist_id?'anilist':undefined),externalId:data.externalId||(raw.anilist_id?String(raw.anilist_id):undefined),title:String(meta.title??raw.title??''),description:String(meta.description??raw.description??''),poster:String(meta.poster??raw.poster??''),backdrop:String(meta.backdrop??raw.backdrop??''),medium:raw.medium,status:raw.status,progress:Number(raw.progress||0),total:raw.total==null?undefined:Number(raw.total),year:raw.year==null?undefined:Number(raw.year),score:raw.score==null?undefined:Number(raw.score),genres:meta.genres||raw.genres||[],themes:meta.themes||raw.themes||[],studio:raw.studio||undefined,source:raw.source||undefined,favorite:Boolean(raw.favorite),notes:raw.notes||undefined,notificationsEnabled:data.frameReleaseRadar?.enabled!==false});
}
export default function App(){
 const {user,signOut}=useAuth();
 const uid=user?.id||'guest';
 const [items,setItems]=useState<MediaItem[]>([]);
 const [busy,setBusy]=useState(true),[message,setMessage]=useState(''),[query,setQuery]=useState('');
 const [page,setPage]=useState<'library'|'search'|'settings'>('library');
 const [selected,setSelected]=useState<string|null>(null),[showTree,setShowTree]=useState(true),[resetBusy,setResetBusy]=useState(false);
 const [manual,setManual]=useState(false),[newTitle,setNewTitle]=useState('');
 const [newTotal,setNewTotal]=useState('');
 const guest=uid==='guest';
 const selectedItem=items.find(x=>x.id===selected)||null;
 const childrenOf=(id:string)=>items.filter(x=>x.parentId===id).sort((a,b)=>a.title.localeCompare(b.title,undefined,{numeric:true}));
 const roots=useMemo(()=>items.filter(x=>!x.parentId).filter(x=>x.title.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.title.localeCompare(b.title)),[items,query]);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   setBusy(true);
   if(!supabase||guest){try{const raw=localStorage.getItem(guest?'frame-library:guest':'frame-library:'+uid);if(active)setItems(raw?JSON.parse(raw).map(fresh):[])}catch{if(active)setItems([])}setBusy(false);return}
   const {data,error}=await supabase.from('media_items').select('*,media_metadata(*)').eq('user_id',uid).order('title');
   if(error){setMessage('Could not load your library: '+error.message);if(active)setItems([])}
   else if(active){setItems((data||[]).map(fromRow));}
   if(active)setBusy(false);
  };
  void load();return()=>{active=false};
 },[uid,guest]);
 const save=async(nextRaw:MediaItem[])=>{
  const next=nextRaw.map(fresh);setItems(next);
  try{localStorage.setItem(guest?'frame-library:guest':'frame-library:'+uid,JSON.stringify(next))}catch{}
  if(!supabase||guest)return true;
  const {data:oldRows,error:readError}=await supabase.from('media_items').select('id').eq('user_id',uid);
  if(readError){setMessage('Could not check cloud records: '+readError.message);return false}
  if(next.length){const {error}=await supabase.from('media_items').upsert(next.map(x=>toRow(x,uid)),{onConflict:'id'});if(error){setMessage('Save failed: '+error.message);return false}}
  const keep=new Set(next.map(x=>x.id));const stale=(oldRows||[]).map(x=>String(x.id)).filter(id=>!keep.has(id));
  if(stale.length){const {error}=await supabase.from('media_items').delete().eq('user_id',uid).in('id',stale);if(error){setMessage('Cleanup failed: '+error.message);return false}}
  setMessage('Saved');window.setTimeout(()=>setMessage(''),2200);return true;
 };
 const importItem=async(item:MediaItem)=>{
  const duplicate=items.some(x=>(item.anilistId&&x.anilistId===item.anilistId)||x.id===item.id);
  if(duplicate){setMessage('That AniList entry is already in your library.');return}
  const next={...fresh(item),parentId:item.parentId||undefined};
  const ok=await save([next,...items]);if(ok){setPage('library');setSelected(next.id)}
 };
 const addManual=async()=>{
  if(!newTitle.trim()||!selectedItem)return;
  const child:MediaItem={id:crypto.randomUUID(),parentId:selectedItem.id,title:newTitle.trim(),description:'',poster:'',backdrop:'',medium:selectedItem.medium,status:'planned',progress:0,total:newTotal?Number(newTotal):undefined,genres:[],themes:[],favorite:false,sourceProvider:'manual'};
  await save([...items,child]);setNewTitle('');setNewTotal('');setManual(false);
 };
 const updateItem=async(id:string,patch:Partial<MediaItem>)=>save(items.map(x=>x.id===id?{...x,...patch}:x));
 const removeItem=async(id:string)=>{
  const descendants=new Set<string>([id]);let changed=true;while(changed){changed=false;for(const x of items)if(x.parentId&&descendants.has(x.parentId)&&!descendants.has(x.id)){descendants.add(x.id);changed=true}}
  if(!window.confirm('Delete this entry and '+(descendants.size-1)+' nested part(s) from your library?'))return;
  await save(items.filter(x=>!descendants.has(x.id)));setSelected(null);
 };
 const resetLibrary=async()=>{
  if(guest||!supabase)return;
  if(!window.confirm('Permanently clear your own FRAME media library and its parts? Other users’ libraries will not be changed. This cannot be undone.'))return;
  setResetBusy(true);
  try{
   const {error:mediaError}=await supabase.from('media_items').delete().eq('user_id',uid);
   if(mediaError)throw mediaError;
   const {data:legacy,error:legacyRead}=await supabase.from('anime').select('id').eq('user_id',uid);
   if(legacyRead&&legacyRead.code!=='42P01')throw legacyRead;
   const legacyIds=(legacy||[]).map((x:any)=>x.id);
   if(legacyIds.length){const {error:partsError}=await supabase.from('parts').delete().in('anime_id',legacyIds);if(partsError)throw partsError;const {error:animeError}=await supabase.from('anime').delete().eq('user_id',uid);if(animeError)throw animeError}
   for(const key of ['frame-library','frame-library:guest','frame-library:'+uid])localStorage.removeItem(key);
   setItems([]);setSelected(null);setMessage('Your library is now empty. Your account and other users’ data are preserved.');
  }catch(e){setMessage('Reset did not fully complete: '+(e instanceof Error?e.message:'unknown error'))}
  finally{setResetBusy(false)}
 };
 const renderChildren=(parent:MediaItem,depth=0)=>childrenOf(parent.id).map(child=><div className="tree-node" key={child.id} style={{'--depth':depth} as React.CSSProperties}><button className={'tree-entry '+(selected===child.id?'active':'')} onClick={()=>setSelected(child.id)}><span className="tree-stem"/><span className="tree-title">{child.title}</span><span className="tree-progress">{child.progress}{child.total?'/'+child.total:''}</span><ChevronRight size={14}/></button>{renderChildren(child,depth+1)}</div>);
 return <main className="frame-app">
  <header className="frame-topbar"><button className="wordmark" onClick={()=>{setPage('library');setSelected(null)}} aria-label="FRAME home"><span className="wordmark-glyph">F</span><span>FRAME</span></button><div className="topbar-spacer"/><span className="account-label">{user?.email||'Local library'}</span><button className="icon-button" title="Settings" onClick={()=>setPage('settings')}><Settings2 size={18}/></button>{user&&<button className="icon-button" title="Sign out" onClick={()=>void signOut()}><LogOut size={18}/></button>}</header>
  <div className="frame-layout"><aside className="frame-sidebar"><div className="side-caption">WORKSPACE</div><button className={page==='library'?'side-link active':'side-link'} onClick={()=>{setPage('library');setSelected(null)}}><BookOpen size={17}/>My library<span>{items.filter(x=>!x.parentId).length}</span></button><button className={page==='search'?'side-link active':'side-link'} onClick={()=>setPage('search')}><Search size={17}/>Discover</button><div className="side-bottom"><div className="side-caption">STRUCTURE</div><p>Every title gets its own AniList ID. Seasons and parts nest beneath it, with episodes or chapters inside each part.</p><button className="side-link" onClick={()=>setShowTree(v=>!v)}><FolderTree size={17}/>{showTree?'Collapse hierarchy':'Expand hierarchy'}</button></div></aside>
   <section className="frame-main">
    {page==='library'&&<><div className="page-intro"><div><div className="eyebrow">YOUR PERSONAL ARCHIVE</div><h1>Library<span className="heading-dot">.</span></h1><p>A clean home for every story you follow.</p></div><button className="primary-action" onClick={()=>setPage('search')}><Plus size={17}/>Add title</button></div><div className="library-tools"><div className="search-field"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your library"/></div><div className="library-count">{roots.length} TITLES</div></div>
     {busy?<div className="empty-state"><RefreshCw className="spin"/><h2>Opening your library</h2></div>:roots.length===0?<div className="empty-state"><div className="empty-symbol"><Layers3 size={25}/></div><h2>Your library starts here.</h2><p>Search AniList to add a main title. Its seasons, parts, and episodes can live neatly inside it.</p><button className="primary-action" onClick={()=>setPage('search')}><Plus size={16}/>Find your first title</button></div>:<div className="title-grid">{roots.map(item=><button key={item.id} className={'title-card '+(selected===item.id?'selected':'')} onClick={()=>setSelected(item.id)}><div className="card-art">{item.poster?<img src={item.poster} alt="" loading="lazy"/>:<div className="art-placeholder"><Clapperboard size={23}/></div>}<span className="card-id">AL · {item.anilistId||'CUSTOM'}</span></div><div className="card-copy"><span className="item-kind">{label(item.medium)}</span><strong>{item.title}</strong><span className="card-meta">{childrenOf(item.id).length} parts <i/> {label(item.status)}</span><div className="mini-progress"><i style={{width:Math.min(100,item.total?item.progress/item.total*100:0)+'%'}}/></div></div></button>)}</div>}
    </>}
    {page==='search'&&<><div className="page-intro"><div><div className="eyebrow">CATALOGUE</div><h1>Find a title<span className="heading-dot">.</span></h1><p>Choose a result, then organize it into your own hierarchy.</p></div><button className="quiet-action" onClick={()=>setPage('library')}><ArrowLeft size={16}/>Back to library</button></div><AniListSearch close={()=>setPage('library')} guest={guest} library={items} onImported={importItem} onManual={()=>setMessage('Search AniList first, then add a custom season or part from a title’s detail panel.')}/></>}
    {page==='settings'&&<><div className="page-intro"><div><div className="eyebrow">PREFERENCES</div><h1>Settings<span className="heading-dot">.</span></h1><p>Account-level controls for your FRAME library.</p></div><button className="quiet-action" onClick={()=>setPage('library')}><ArrowLeft size={16}/>Back</button></div><section className="settings-panel"><div><h3>Reset my library</h3><p>Remove only your media entries and their seasons/parts. Your login, profile, and other users’ libraries stay untouched.</p></div><button className="danger-action" disabled={guest||resetBusy} onClick={()=>void resetLibrary()}><Trash2 size={16}/>{resetBusy?'Resetting…':'Clear my library'}</button>{guest&&<small>Sign in to reset your cloud library.</small>}</section></>}
    {message&&<div className="status-message" role="status">{message}<button onClick={()=>setMessage('')}><X size={14}/></button></div>}
   </section>
   {selectedItem&&page==='library'&&<aside className="detail-panel"><div className="detail-panel-top"><span className="eyebrow">TITLE DETAILS</span><button className="icon-button" aria-label="Close details" onClick={()=>setSelected(null)}><X size={17}/></button></div><div className="detail-art">{selectedItem.backdrop?<img src={selectedItem.backdrop} alt=""/>:selectedItem.poster?<img src={selectedItem.poster} alt=""/>:<div className="art-placeholder"><Clapperboard size={28}/></div>}</div><div className="detail-heading"><span className="item-kind">{label(selectedItem.medium)} · {selectedItem.anilistId?'ANILIST ID '+selectedItem.anilistId:'CUSTOM ID'}</span><h2>{selectedItem.title}</h2><p>{selectedItem.description||'No description added.'}</p></div><div className="detail-stats"><label>Progress<input type="number" min="0" max={selectedItem.total||2000} value={selectedItem.progress} onChange={e=>void updateItem(selectedItem.id,{progress:Math.max(0,Number(e.target.value)||0)})}/></label><label>Total episodes / chapters<input type="number" min="1" max="2000" value={selectedItem.total||''} placeholder="Unknown" onChange={e=>void updateItem(selectedItem.id,{total:e.target.value?Math.max(1,Number(e.target.value)):undefined})}/></label><label>Status<select value={selectedItem.status} onChange={e=>void updateItem(selectedItem.id,{status:e.target.value as Status})}>{statuses.map(s=><option key={s} value={s}>{label(s)}</option>)}</select></label></div><div className="hierarchy-section"><div className="hierarchy-heading"><div><h3>Hierarchy</h3><span>{childrenOf(selectedItem.id).length} direct parts</span></div><button className="icon-button" onClick={()=>setShowTree(v=>!v)}><ChevronDown size={16}/></button></div><button className="add-part-button" onClick={()=>{setManual(true)}}><CirclePlus size={16}/>Add season or part</button>{showTree&&<div className="tree-list">{renderChildren(selectedItem)}</div>}</div><div className="detail-actions">{selectedItem.anilistId&&<a href={'https://anilist.co/'+(['manga','manhwa','light-novel'].includes(selectedItem.medium)?'manga':'anime')+'/'+selectedItem.anilistId} target="_blank" rel="noreferrer">Open AniList <ArrowDownLeft size={14}/></a>}<button className="danger-action" onClick={()=>void removeItem(selectedItem.id)}><Trash2 size={15}/>Delete title</button></div></aside>}
  </div>
  {manual&&selectedItem&&<div className="modal-shade" onMouseDown={e=>{if(e.target===e.currentTarget)setManual(false)}}><section className="part-modal"><div className="modal-title"><div><span className="eyebrow">BUILD YOUR HIERARCHY</span><h2>Add a season or part</h2></div><button className="icon-button" onClick={()=>setManual(false)}><X size={17}/></button></div><p>Parent title: <b>{selectedItem.title}</b></p><label>Part name<input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="e.g. Season 1, Final Season Part 2"/></label><div className="part-fields"><label>Total episodes / chapters<input type="number" min="1" max="2000" value={newTotal} onChange={e=>setNewTotal(e.target.value)} placeholder="Optional"/></label></div><button className="primary-action full" onClick={()=>void addManual()} disabled={!newTitle.trim()}><Check size={16}/>Create part</button><small>To add episodes or chapters, open a season/part first, then add its children.</small></section></div>}
 </main>;
}

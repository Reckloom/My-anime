import {useEffect,useMemo,useState} from 'react';
import {Bell,Check,CheckCheck,ExternalLink,Search,X} from 'lucide-react';
import {supabase} from '../lib/supabase';
import type {MediaItem} from '../types';

type Notice={id:string;type:string;title:string;body:string;href?:string|null;read_at?:string|null;created_at:string;dedupe_key?:string};
type Filter='all'|'release'|'update';
type NoticeGroup={key:string;title:string;items:Notice[];unread:number};

export function FrameNotifications({uid,onNavigate,mediaItems=[]}:{uid:string;onNavigate:(href?:string|null)=>void;mediaItems?:MediaItem[]}){
 const[open,setOpen]=useState(false),[items,setItems]=useState<Notice[]>([]),[filter,setFilter]=useState<Filter>('all'),[search,setSearch]=useState(''),[error,setError]=useState('');
 const load=async()=>{if(!supabase||uid==='guest')return;const {data,error:e}=await supabase.from('frame_notifications').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(300);if(e){setError('Notifications could not be loaded.');return}setError('');if(data)setItems(data as Notice[])};
 useEffect(()=>{void load()},[uid]);
 useEffect(()=>{if(!supabase||uid==='guest')return;const ch=supabase.channel('frame-notifications:'+uid).on('postgres_changes',{event:'*',schema:'public',table:'frame_notifications',filter:'user_id=eq.'+uid},()=>void load()).subscribe();return()=>{void supabase?.removeChannel(ch)}},[uid]);
 const unread=useMemo(()=>items.filter(x=>!x.read_at).length,[items]);
 const counts=useMemo(()=>({all:items.length,release:items.filter(x=>x.type==='release').length,update:items.filter(x=>x.type==='update').length}),[items]);
 const groups=useMemo<NoticeGroup[]>(()=>{const map=new Map<string,NoticeGroup>();const roots=mediaItems.filter(m=>!m.parentId);for(const media of roots){const key=media.title.trim().toLocaleLowerCase();map.set(key,{key,title:media.title,items:[],unread:0})}for(const n of items){const title=(n.title.split(/\s+[·|—-]\s+(?:episode|chapter|volume|part|season|new release|update)\b/i)[0]||n.title).trim()||'Other notifications';const normalized=title.toLocaleLowerCase();const match=roots.find(m=>normalized===m.title.toLocaleLowerCase()||(m.alternativeTitles||[]).some(t=>t.toLocaleLowerCase()===normalized));const key=match?match.title.trim().toLocaleLowerCase():normalized;const g=map.get(key)||{key,title:match?.title||title,items:[],unread:0};if(!g.items.some(x=>x.id===n.id))g.items.push(n);if(!n.read_at)g.unread++;map.set(key,g)}const term=search.trim().toLocaleLowerCase();return [...map.values()].filter(g=>(!term||[g.title,...g.items.flatMap(n=>[n.title,n.body,n.type,n.href||'',new Date(n.created_at).toLocaleString()])].join(' ').toLocaleLowerCase().includes(term))).map(g=>({...g,items:g.items.filter(n=>filter==='all'||n.type===filter).filter(n=>!term||[n.title,n.body,n.type,n.href||'',new Date(n.created_at).toLocaleString()].join(' ').toLocaleLowerCase().includes(term))})).sort((a,b)=>{const ad=a.items[0]?.created_at||'';const bd=b.items[0]?.created_at||'';return Date.parse(bd)-Date.parse(ad)})},[items,mediaItems,filter,search]);
 const readAll=async()=>{if(!supabase||uid==='guest'||!unread)return;const {error:e}=await supabase.from('frame_notifications').update({read_at:new Date().toISOString()}).eq('user_id',uid).is('read_at',null);if(e){setError('Could not mark notifications as read.');return}await load()};
 const readOne=async(n:Notice)=>{if(!supabase||uid==='guest'||n.read_at)return;const {error:e}=await supabase.from('frame_notifications').update({read_at:new Date().toISOString()}).eq('user_id',uid).eq('id',n.id);if(e){setError('Could not mark this notification as read.');return}await load()};
 const dismiss=async(n:Notice)=>{if(!supabase||uid==='guest')return;const {error:e}=await supabase.from('frame_notifications').delete().eq('user_id',uid).eq('id',n.id);if(e){setError('Could not dismiss this notification.');return}setItems(prev=>prev.filter(x=>x.id!==n.id))};
 const dismissGroup=async(g:NoticeGroup)=>{for(const n of g.items)await dismiss(n)};
 const iconFor=(type:string)=>type==='release'?'◷':type==='update'?'↻':type==='social'?'◎':'•';
 if(uid==='guest')return null;
 return <div className="frame-notification-wrap">
  <button className={'top-icon frame-notification-button '+(unread?'has-unread':'')} title="Notifications" aria-label={unread?'Notifications, '+unread+' unread':'Notifications'} aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Bell size={18}/>{unread>0&&<i>{unread>99?'99+':unread}</i>}</button>
  {open&&<div className="frame-notification-panel" role="dialog" aria-modal="true" aria-label="Notifications">
   <header><div><small>FRAME</small><b>Notifications</b><span className="frame-notification-subtitle">{unread} unread · stays here until read or dismissed</span></div><div><button title="Mark all read" aria-label="Mark all notifications as read" onClick={()=>void readAll()}><CheckCheck size={15}/></button><button title="Close" aria-label="Close notifications" onClick={()=>setOpen(false)}><X size={15}/></button></div></header>
   <label className="frame-notification-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notification words…" aria-label="Search notifications"/>{search&&<button type="button" title="Clear search" onClick={()=>setSearch('')}><X size={13}/></button>}</label>
   <div className="frame-notification-tabs" role="tablist" aria-label="Notification types">
    {(['all','release','update'] as Filter[]).map(x=><button key={x} type="button" className={filter===x?'active':''} onClick={()=>setFilter(x)} role="tab" aria-selected={filter===x}>{x==='all'?'All':x==='release'?'Releases':'Updates'}<span>{counts[x]}</span></button>)}
   </div>
   <div className="frame-notification-list">{error&&<div className="inline-error" role="alert">{error}<button type="button" onClick={()=>void load()}>Retry</button></div>}
    {groups.length?groups.map(g=><section key={g.key} className={'frame-notification-media-bubble '+(!g.items.length?'empty-media-bubble':'')}>
      <header className="frame-notification-media-head"><div><b>{g.title}</b><small>{g.items.length?g.items.length+' '+(g.items.length===1?'notification':'notifications')+(g.unread?' · '+g.unread+' unread':''):'No notifications yet'}</small></div>{g.items.length>0&&<button type="button" title={'Dismiss all notifications for '+g.title} aria-label={'Dismiss all notifications for '+g.title} onClick={()=>void dismissGroup(g)}><X size={14}/></button>}</header>
      {g.items.length===0?<div className="frame-notification-media-empty">No notifications for this media yet.</div>:g.items.map(n=><article key={n.id} className={'frame-notification-item '+(!n.read_at?'unread':'')}>
       <button type="button" className="frame-notification-open" onClick={()=>{if(n.href)onNavigate(n.href);setOpen(false)}}><span className="frame-notification-type-icon">{iconFor(n.type)}</span><span className="frame-notification-copy"><b>{n.title}</b><span>{n.body}</span><small>{new Date(n.created_at).toLocaleString()}</small></span>{n.href&&<ExternalLink size={13}/>}</button>
       <div className="frame-notification-item-actions">{!n.read_at&&<button type="button" title="Mark as read" aria-label={'Mark as read: '+n.title} onClick={()=>void readOne(n)}><Check size={14}/><span>Read</span></button>}<button type="button" className="frame-notification-dismiss" title="Dismiss notification" aria-label={'Dismiss: '+n.title} onClick={()=>void dismiss(n)}><X size={14}/></button></div>
      </article>)}
     </section>):<div className="frame-notification-empty"><Bell size={18}/><span>{search?'No notifications match your search.':filter==='update'?'No updates yet.':filter==='release'?'No releases yet.':'No notifications yet.'}</span></div>}
   </div>
  </div>}
 </div>;
}

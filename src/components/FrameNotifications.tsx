import {useEffect,useMemo,useState} from 'react';
import {Bell,CheckCheck,ExternalLink,X} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Notice={id:string;type:string;title:string;body:string;href?:string|null;read_at?:string|null;created_at:string};
type Filter='all'|'release'|'update';

export function FrameNotifications({uid,onNavigate}:{uid:string;onNavigate:(href?:string|null)=>void}){
 const[open,setOpen]=useState(false),[items,setItems]=useState<Notice[]>([]),[filter,setFilter]=useState<Filter>('all'),[error,setError]=useState('');
 const load=async()=>{if(!supabase||uid==='guest')return;const {data,error:e}=await supabase.from('frame_notifications').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(200);if(e){setError('Notifications could not be loaded.');return}setError('');if(data)setItems(data as Notice[])};
 useEffect(()=>{void load()},[uid]);
 useEffect(()=>{if(!supabase||uid==='guest')return;const ch=supabase.channel('frame-notifications:'+uid).on('postgres_changes',{event:'*',schema:'public',table:'frame_notifications',filter:'user_id=eq.'+uid},()=>void load()).subscribe();return()=>{void supabase?.removeChannel(ch)}},[uid]);
 const unread=useMemo(()=>items.filter(x=>!x.read_at).length,[items]);
 const counts=useMemo(()=>({all:items.length,release:items.filter(x=>x.type==='release').length,update:items.filter(x=>x.type==='update').length}),[items]);
 const visible=useMemo(()=>filter==='all'?items:items.filter(x=>x.type===filter),[items,filter]);
 const readAll=async()=>{if(!supabase||uid==='guest'||!unread)return;const {error:e}=await supabase.from('frame_notifications').update({read_at:new Date().toISOString()}).eq('user_id',uid).is('read_at',null);if(e){setError('Could not mark notifications as read.');return}await load()};
 const readOne=async(n:Notice)=>{if(!supabase||uid==='guest')return;if(!n.read_at){const {error:e}=await supabase.from('frame_notifications').update({read_at:new Date().toISOString()}).eq('id',n.id);if(e){setError('Could not mark this notification as read.');return}}setOpen(false);onNavigate(n.href);void load()};
 const iconFor=(type:string)=>type==='release'?'◷':type==='update'?'↻':type==='social'?'◎':'•';
 if(uid==='guest')return null;
 return <div className="frame-notification-wrap">
  <button className={'top-icon frame-notification-button '+(unread?'has-unread':'')} title="Notifications" aria-label={unread?'Notifications, '+unread+' unread':'Notifications'} aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Bell size={18}/>{unread>0&&<i>{unread>99?'99+':unread}</i>}</button>
  {open&&<div className="frame-notification-panel" role="dialog" aria-modal="true" aria-label="Notifications">
   <header><div><small>FRAME</small><b>Notifications</b></div><div><button title="Mark all read" onClick={()=>void readAll()}><CheckCheck size={15}/></button><button title="Close" onClick={()=>setOpen(false)}><X size={15}/></button></div></header>
   <div className="frame-notification-tabs" role="tablist" aria-label="Notification types">
    {(['all','release','update'] as Filter[]).map(x=><button key={x} type="button" className={filter===x?'active':''} onClick={()=>setFilter(x)} role="tab" aria-selected={filter===x}>{x==='all'?'All':x==='release'?'Releases':'Updates'}<span>{counts[x]}</span></button>)}
   </div>
   <div className="frame-notification-list">{error&&<div className="inline-error" role="alert">{error}<button type="button" onClick={()=>void load()}>Retry</button></div>}
    {visible.length?visible.map(n=><button key={n.id} className={'frame-notification-item '+(!n.read_at?'unread':'')} onClick={()=>void readOne(n)}>
      <span>{iconFor(n.type)}</span><div><b>{n.title}</b><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString()}</small></div>{n.href&&<ExternalLink size={13}/>}
    </button>):<div className="frame-notification-empty"><Bell size={18}/><span>{filter==='update'?'No updates yet.':filter==='release'?'No releases yet.':'Nothing new yet.'}</span></div>}
   </div>
  </div>}
 </div>;
}

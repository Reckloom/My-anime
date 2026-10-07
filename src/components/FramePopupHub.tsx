import {useEffect,useState} from 'react';
import {MessageCircle,Phone,Search,Send,Users,X,Minimize2} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Profile={id:string;username:string;display_name:string};
type Msg={id:string;user_id:string;body:string;created_at:string;profiles?:{display_name?:string;username?:string}|null};

export function FramePopupHub({uid,onFind,onOpenCalls,onCall}:{uid:string;onFind:()=>void;onOpenCalls:()=>void;onCall:(friend:Profile)=>void}){
 if(uid==='guest')return null;
 const [open,setOpen]=useState(false),[panel,setPanel]=useState<'chat'|'call'|null>(null);
 const [messages,setMessages]=useState<Msg[]>([]),[draft,setDraft]=useState(''),[friends,setFriends]=useState<Profile[]>([]),[error,setError]=useState('');
 const loadChat=async()=>{
  if(!supabase)return;
  const {data}=await supabase.from('global_messages').select('id,user_id,body,created_at,profiles(display_name,username)').order('created_at',{ascending:true}).limit(60);
  if(data)setMessages(data as Msg[]);else setError('Chat is temporarily unavailable.');
 };
 const loadFriends=async()=>{
  if(!supabase)return;
  const {data:f}=await supabase.from('friendships').select('requester_id,addressee_id').eq('status','accepted').or('requester_id.eq.'+uid+',addressee_id.eq.'+uid);
  const ids=[...new Set((f||[]).flatMap((x:any)=>[x.requester_id,x.addressee_id]).filter((x:string)=>x!==uid))];
  if(!ids.length){setFriends([]);return}
  const {data:p}=await supabase.from('profiles').select('id,username,display_name').in('id',ids);
  setFriends((p||[]) as Profile[]);
 };
 useEffect(()=>{void loadChat();void loadFriends();const t=window.setInterval(()=>{void loadChat();void loadFriends()},5000);return()=>window.clearInterval(t)},[uid]);
 const send=async()=>{
  if(!supabase||!draft.trim())return;
  const body=draft.trim().slice(0,2000);
  const {data}=await supabase.from('global_messages').insert({user_id:uid,body}).select('id,user_id,body,created_at').single();
  if(data){setMessages(prev=>[...prev,{...(data as Msg),profiles:{display_name:'You'}}].slice(-60));setDraft('');setError('')}else setError('Message could not be sent.');
 };
 const choose=(next:'chat'|'call')=>{setOpen(true);setPanel(next)};
 return <div className="frame-popup-system">
  <div className={'frame-popup-panel '+(open&&panel?'visible':'')} role="dialog" aria-label="FRAME quick panel">
   <header><div><small>FRAME QUICK</small><b>{panel==='chat'?'Global chat':'Voice calls'}</b></div><button aria-label="Minimize quick panel" onClick={()=>setPanel(null)}><Minimize2 size={15}/></button></header>
   {panel==='chat'&&<div className="frame-popup-chat">
    <div className="frame-popup-messages">{error&&<small className="inline-error" role="alert">{error}</small>}{messages.map(m=><div key={m.id}><b>{m.user_id===uid?'You':m.profiles?.display_name||m.profiles?.username||'FRAME user'}</b><span>{m.body}</span></div>)}</div>
    <form onSubmit={e=>{e.preventDefault();void send()}}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Message everyone…"/><button disabled={!draft.trim()}><Send size={14}/></button></form>
    <button className="frame-popup-link" onClick={onOpenCalls}>Open call center</button>
   </div>}
   {panel==='call'&&<div className="frame-popup-calls">
    <div className="frame-popup-call-top"><span><Users size={14}/> Friends available</span><b>{friends.length}</b></div>
    {friends.length?friends.map(f=><button key={f.id} className="frame-popup-friend" onClick={()=>onCall(f)}><span>{(f.display_name||f.username)[0].toUpperCase()}</span><div><b>{f.display_name||f.username}</b><small>@{f.username}</small></div><Phone size={14}/></button>):<p>No accepted friends yet.</p>}
    <button className="frame-popup-link" onClick={onOpenCalls}>Open call center</button>
   </div>}
  </div>
  <div className={'frame-popup-actions '+(open?'expanded':'')}>
   {open&&<><button className={panel==='chat'?'chosen':''} title="Chat" onClick={()=>choose('chat')}><MessageCircle size={19}/><span>Chat</span></button><button className={panel==='call'?'chosen':''} title="Call" onClick={()=>choose('call')}><Phone size={19}/><span>Call</span></button><button title="Find media" onClick={onFind}><Search size={19}/><span>Find</span></button></>}
   <button className="frame-popup-main" title={open?'Close quick actions':'Open quick actions'} onClick={()=>{setOpen(!open);if(open)setPanel(null)}}>{open?<X size={20}/>:<MessageCircle size={20}/>}</button>
  </div>
 </div>;
}

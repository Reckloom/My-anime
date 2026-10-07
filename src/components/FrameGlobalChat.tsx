import {useEffect,useRef,useState} from 'react';
import {MessageCircle,Send,Trash2,Users} from 'lucide-react';
import {supabase} from '../lib/supabase';

type GlobalMessage={
 id:string;user_id:string;body:string;created_at:string;
 profiles?:{username?:string;display_name?:string;avatar_url?:string|null}|null;
};

export function FrameGlobalChat({uid,guest}:{uid:string;guest:boolean}){
 const [messages,setMessages]=useState<GlobalMessage[]>([]);
 const [draft,setDraft]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const endRef=useRef<HTMLDivElement|null>(null),channelRef=useRef<any>(null);

 useEffect(()=>{
  if(guest||!supabase)return;
  const client=supabase;
  let active=true;
  const load=async()=>{
   const {data,error:e}=await client
    .from('global_messages')
    .select('id,user_id,body,created_at,profiles(username,display_name,avatar_url)')
    .order('created_at',{ascending:true})
    .limit(200);
   if(active){
    if(e)setError(e.message);
    else setMessages((data||[]) as GlobalMessage[]);
   }
  };
  void load();
  const channel=client.channel('frame-global-chat',{config:{private:true,broadcast:{ack:true}}})
   .on('broadcast',{event:'message'},({payload}:any)=>{
    const row=payload?.row as GlobalMessage|undefined;
    if(!active||!row)return;
    void client.from('profiles').select('username,display_name,avatar_url').eq('id',row.user_id).maybeSingle()
      .then(({data})=>{if(active)setMessages(prev=>prev.some(x=>x.id===row.id)?prev:[...prev,{...row,profiles:data||null}].slice(-200));});
   });
  channelRef.current=channel;
  channel.subscribe((status:string,err?:any)=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')setError(err?.message||'Live chat connection was interrupted; messages are still saved.');});
  const fallback=window.setInterval(()=>void load(),5000);
  return()=>{active=false;window.clearInterval(fallback);void channel.unsubscribe();channelRef.current=null};
 },[guest]);

 useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[messages.length]);

 const send=async()=>{
  if(guest||!supabase||!draft.trim()||busy)return;
  setBusy(true);setError('');
  try{
   const body=draft.trim().slice(0,2000);
   const {data:row,error:e}=await supabase.from('global_messages').insert({user_id:uid,body}).select('id,user_id,body,created_at').single();
   if(e||!row)throw e||new Error('Message could not be saved.');
   const {data:profile}=await supabase.from('profiles').select('username,display_name,avatar_url').eq('id',uid).maybeSingle();
   setMessages(prev=>prev.some(x=>x.id===row.id)?prev:[...prev,{...(row as GlobalMessage),profiles:profile||null}].slice(-200));
   const result=await channelRef.current?.send({type:'broadcast',event:'message',payload:{row}}).catch(()=>null);
   void result;
   setDraft('');
  }catch(e){setError(e instanceof Error?e.message:'Message could not be sent.')}
  finally{setBusy(false)}
 };

 const remove=async(id:string)=>{
  if(!supabase)return;
  const {error:e}=await supabase.from('global_messages').delete().eq('id',id).eq('user_id',uid);
  if(e)setError(e.message);
 };

 if(guest)return <div className="page"><div className="social-lock"><Users size={28}/><h2>Global chat is account-only</h2><p>Sign in to join the FRAME community chat. Your media library stays separate from chat data.</p></div></div>;

 return <div className="page chat-page">
  <div className="page-heading"><div><small>FRAME COMMUNITY</small><h1>Global Chat</h1><p>One live room for everyone using FRAME, with private conversations still available in Friends.</p></div></div>
  <section className="global-chat-panel">
   <header className="global-chat-head"><div><MessageCircle size={18}/><div><b>FRAME lobby</b><small>Live chat · authenticated users</small></div></div><span>{messages.length} visible</span></header>
   <div className="global-chat-messages">
    {messages.length?messages.map(m=>{
      const name=m.user_id===uid?'You':m.profiles?.display_name||m.profiles?.username||'FRAME user';
      return <div className={m.user_id===uid?'global-message mine':'global-message'} key={m.id}>
       <div className="global-avatar">{name[0].toUpperCase()}</div>
       <div className="global-bubble"><div><b>{name}</b><small>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div><p>{m.body}</p></div>
       {m.user_id===uid&&<button className="icon-button global-delete" title="Delete message" onClick={()=>void remove(m.id)}><Trash2 size={13}/></button>}
      </div>;
    }):<div className="chat-empty"><MessageCircle size={22}/>Start the global conversation.</div>}
    <div ref={endRef}/>
   </div>
   {error&&<div className="inline-error">{error}</div>}
   <form className="global-chat-input" onSubmit={e=>{e.preventDefault();void send()}}>
    <input maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Write to everyone…"/>
    <button className="primary" disabled={!draft.trim()||busy}><Send size={16}/>{busy?'Sending…':'Send'}</button>
   </form>
  </section>
 </div>;
}

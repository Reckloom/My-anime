import {useEffect,useState} from 'react';
import {Check,ChevronRight,MessageCircle,Phone,Search,Send,Shield,UserPlus,Users} from 'lucide-react';
import {supabase} from '../lib/supabase';
import type {MediaItem} from '../types';

type Profile={id:string;username:string;display_name:string;avatar_url?:string|null};
type Friendship={id:string;requester_id:string;addressee_id:string;status:string};
type Permission={id:string;owner_id:string;viewer_id:string;status:string};
type Message={id:string;sender_id:string;recipient_id:string;body:string;created_at:string};

export function FrameSocial({uid,guest,onOpenLibrary,onCall}:{uid:string;guest:boolean;onOpenLibrary:(id:string)=>void;onCall:(friend:Profile)=>void}){
 const [friends,setFriends]=useState<Friendship[]>([]),[profiles,setProfiles]=useState<Record<string,Profile>>({}),[permissions,setPermissions]=useState<Permission[]>([]);
 const [selected,setSelected]=useState<Profile|null>(null),[query,setQuery]=useState(''),[results,setResults]=useState<Profile[]>([]),[messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[socialMessage,setSocialMessage]=useState('');
 const load=async()=>{
  const client=supabase;if(!client||guest)return;
  const {data:f}=await client.from('friendships').select('*').or('requester_id.eq.'+uid+',addressee_id.eq.'+uid);
  const fs=(f||[]) as Friendship[];setFriends(fs);
  const ids=[...new Set(fs.flatMap(x=>[x.requester_id,x.addressee_id]).filter(x=>x!==uid))];
  if(ids.length){const {data:p}=await client.from('profiles').select('id,username,display_name,avatar_url').in('id',ids);setProfiles(Object.fromEntries(((p||[]) as Profile[]).map(p=>[p.id,p])))}
  const {data:p}=await client.from('library_permissions').select('*').or('owner_id.eq.'+uid+',viewer_id.eq.'+uid);setPermissions((p||[]) as Permission[]);
 };
 useEffect(()=>{void load();if(guest)return;const t=window.setInterval(()=>void load(),5000);return()=>window.clearInterval(t)},[uid,guest]);
 useEffect(()=>{
  if(!supabase||guest||!selected)return;
  let active=true;
  const client=supabase;
  const loadMessages=async()=>{
   const {data}=await client.from('friend_messages').select('*').or('and(sender_id.eq.'+uid+',recipient_id.eq.'+selected.id+'),and(sender_id.eq.'+selected.id+',recipient_id.eq.'+uid+')').order('created_at',{ascending:true});
   if(active&&data)setMessages(data as Message[]);
  };
  void loadMessages();
  const room='frame-friend-chat:'+([uid,selected.id].sort().join(':'));
  const channel=client.channel(room);
  channel.on('postgres_changes',{event:'INSERT',schema:'public',table:'friend_messages'},payload=>{
   const row=payload.new as Message;
   if(!row||!((row.sender_id===uid&&row.recipient_id===selected.id)||(row.sender_id===selected.id&&row.recipient_id===uid)))return;
   setMessages(prev=>prev.some(x=>x.id===row.id)?prev:[...prev,row].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)));
  });
  channel.subscribe((status:string,err?:any)=>{if((status==='CHANNEL_ERROR'||status==='TIMED_OUT')&&active)void loadMessages().catch(()=>{});});
  const t=window.setInterval(()=>void loadMessages(),5000);
  return()=>{active=false;window.clearInterval(t);void channel.unsubscribe()};
 },[selected?.id,uid,guest]);
 if(guest)return <div className="page"><div className="social-lock"><Users size={28}/><h2>Friends is account-only</h2><p>Sign in to use usernames, private chat, permission-based library sharing and voice calls.</p></div></div>;
 const accepted=friends.filter(x=>x.status==='accepted').map(x=>profiles[x.requester_id===uid?x.addressee_id:x.requester_id]).filter(Boolean);
 const incoming=friends.filter(x=>x.status==='pending'&&x.addressee_id===uid);
 const search=async()=>{const client=supabase;if(query.trim().length<2||!client)return;setSocialMessage('');const {data}=await client.from('profiles').select('id,username,display_name,avatar_url').ilike('username','%'+query.trim()+'%').neq('id',uid).limit(10);setResults((data||[]) as Profile[])};
 const add=async(id:string)=>{const client=supabase;if(!client)return;setSocialMessage('');const {data:existing,error:checkError}=await client.from('friendships').select('id,status').or('and(requester_id.eq.'+uid+',addressee_id.eq.'+id+'),and(requester_id.eq.'+id+',addressee_id.eq.'+uid+')').limit(1);if(checkError){setSocialMessage(checkError.message);return}if(existing?.length){setSocialMessage(existing[0].status==='accepted'?'You are already friends with this person.':'A friend request already exists.');setResults(results.filter(x=>x.id!==id));return}const {error}=await client.from('friendships').insert({requester_id:uid,addressee_id:id,status:'pending'});if(error)setSocialMessage(error.message);else setResults(results.filter(x=>x.id!==id))};
 const accept=async(id:string)=>{const client=supabase;if(!client)return;const {error}=await client.from('friendships').update({status:'accepted'}).eq('id',id).eq('addressee_id',uid);if(error)setSocialMessage(error.message);else await load()};
 const send=async()=>{const client=supabase;if(!client||!selected||!draft.trim())return;const body=draft.trim().slice(0,2000);setDraft('');const {data,error}=await client.from('friend_messages').insert({sender_id:uid,recipient_id:selected.id,body}).select('*').single();if(!error&&data)setMessages(prev=>prev.some(x=>x.id===data.id)?prev:[...prev,data as Message].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)));if(error)setDraft(body)};
 const shareState=(id:string)=>permissions.find(p=>p.owner_id===id&&p.viewer_id===uid)?.status||'none';
 const currentShare=selected?shareState(selected.id):'none';
 const askLibrary=async()=>{const client=supabase;if(!client||!selected)return;setSocialMessage('');const {error}=await client.from('library_permissions').upsert({owner_id:selected.id,viewer_id:uid,status:'pending'},{onConflict:'owner_id,viewer_id'});if(error)setSocialMessage(error.message);else await load()};
 const incomingShares=permissions.filter(p=>p.owner_id===uid&&p.status==='pending');
 const allow=async(id:string)=>{const client=supabase;if(!client)return;const {error}=await client.from('library_permissions').update({status:'accepted'}).eq('id',id).eq('owner_id',uid);if(error)setSocialMessage(error.message);else await load()};
 return <div className="page social-page"><div className="page-heading"><div><small>PRIVATE SOCIAL SPACE</small><h1>Friends</h1><p>Find people by username, chat, call and share your library only with permission.</p></div></div>
  <div className="friend-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&void search()} placeholder="Search username…"/><button className="primary" onClick={()=>void search()}><Search size={15}/>Find</button></div>
  {socialMessage&&<div className="inline-error">{socialMessage}</div>}
  {results.length>0&&<div className="people-results">{results.map(p=><div key={p.id}><span className="person-avatar">{(p.display_name||p.username)[0].toUpperCase()}</span><section><b>{p.display_name||p.username}</b><small>@{p.username}</small></section><button className="secondary" onClick={()=>void add(p.id)}><UserPlus size={15}/>Add</button></div>)}</div>}
  <div className="social-grid"><section className="social-panel"><div className="section-title"><div><small>REQUESTS</small><h2>Incoming</h2></div><span>{incoming.length}</span></div>{incoming.length?incoming.map(x=><div className="request-row" key={x.id}><span>@{profiles[x.requester_id]?.username||'user'}</span><button className="primary" onClick={()=>void accept(x.id)}><Check size={14}/>Accept</button></div>):<p className="muted">No pending requests.</p>}</section><section className="social-panel"><div className="section-title"><div><small>YOUR PEOPLE</small><h2>Friends</h2></div><span>{accepted.length}</span></div>{accepted.length?accepted.map(p=><button className={selected?.id===p.id?'friend-row active':'friend-row'} key={p.id} onClick={()=>setSelected(p)}><span className="person-avatar">{(p.display_name||p.username)[0].toUpperCase()}</span><span><b>{p.display_name||p.username}</b><small>@{p.username}</small></span><ChevronRight size={16}/></button>):<p className="muted">Add friends by username.</p>}</section></div>
  {selected&&<section className="chat-panel"><header><div><b>{selected.display_name||selected.username}</b><small>@{selected.username}</small></div><div className="chat-actions"><button className="secondary" disabled={currentShare!=='none'} onClick={()=>void askLibrary()}>{currentShare==='accepted'?'Library shared':currentShare==='pending'?'Request sent':'Ask to view library'}</button><button className="secondary" onClick={()=>onCall(selected)}><Phone size={15}/>Voice</button></div></header><div className="chat-messages">{messages.length?messages.map(m=><div key={m.id} className={m.sender_id===uid?'mine':'theirs'}><span>{m.body}</span><small>{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div>):<div className="chat-empty"><MessageCircle size={22}/>Start the conversation.</div>}</div><form className="chat-input" onSubmit={e=>{e.preventDefault();void send()}}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Message…"/><button className="primary"><Send size={16}/></button></form>{shareState(selected.id)==='accepted'&&<button className="view-library" onClick={()=>onOpenLibrary(selected.id)}>Open shared library <ChevronRight size={15}/></button>}</section>}
  {incomingShares.length>0&&<section className="social-panel permission-panel"><div className="section-title"><div><small>LIBRARY ACCESS</small><h2>Requests to see yours</h2></div><span>{incomingShares.length}</span></div>{incomingShares.map(p=><div className="request-row" key={p.id}><span>@{profiles[p.viewer_id]?.username||'friend'} wants access.</span><button className="primary" onClick={()=>void allow(p.id)}><Shield size={14}/>Allow</button></div>)}</section>}
 </div>;
}

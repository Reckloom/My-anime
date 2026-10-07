import {useEffect,useRef,useState} from 'react';
import {Mic,MicOff,Phone,PhoneOff,PhoneCall,Radio,User} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Profile={id:string;username:string;display_name:string;avatar_url?:string|null};
type DirectTarget=Profile|null;
type Incoming={callId:string;caller:Profile};

function avatarText(p:Profile){return (p.display_name||p.username||'F').trim().slice(0,1).toUpperCase();}

export function FrameDirectCall({uid,target,onClear}:{uid:string;target:DirectTarget;onClear:()=>void}){
 const [incoming,setIncoming]=useState<Incoming|null>(null);
 const [peer,setPeer]=useState<Profile|null>(target);
 const [phase,setPhase]=useState<'idle'|'ringing'|'connecting'|'connected'>('idle');
 const [muted,setMuted]=useState(false);
 const [error,setError]=useState('');
 const [elapsed,setElapsed]=useState(0);
 const inbox=useRef<any>(null);
 const callChannel=useRef<any>(null);
 const callReady=useRef<Promise<void>|null>(null);
 const callId=useRef<string|null>(null),inboxReady=useRef<Promise<void>|null>(null);
 const pc=useRef<RTCPeerConnection|null>(null);
 const local=useRef<MediaStream|null>(null);
 const remoteAudio=useRef<HTMLAudioElement|null>(null);
 const pendingIce=useRef<RTCIceCandidateInit[]>([]);
 const activeRef=useRef(true),phaseRef=useRef<'idle'|'ringing'|'connecting'|'connected'>('idle');

 useEffect(()=>{
  if(!supabase||!uid)return;
  activeRef.current=true;
  let disposed=false;
  const client=supabase;
  const channel=client.channel('frame-direct-inbox:'+uid,{config:{private:true,broadcast:{ack:true}}});
  inbox.current=channel;
  channel.on('broadcast',{event:'ring'},async({payload}:any)=>{
   if(disposed||!payload?.callId||payload.from===uid||phaseRef.current!=='idle')return;
   const callerId=String(payload.from||'');
   const {data}=await client.from('profiles').select('id,username,display_name,avatar_url').eq('id',callerId).maybeSingle();
   if(!activeRef.current)return;
   if(data){
    setIncoming({callId:String(payload.callId),caller:data as Profile});
    setPhase('ringing');
    setError('');
   }
  });
  inboxReady.current=new Promise<void>((resolve,reject)=>{
   channel.subscribe((status:string,err?:any)=>{
    if(status==='SUBSCRIBED')resolve();
    else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')reject(new Error(err?.message||'Incoming call service could not connect. Reload FRAME and try again.'));
   });
  }).catch(()=>{});
  return()=>{
   disposed=true;
   void channel.unsubscribe();
   inbox.current=null;
  };
 },[uid,phase]);

 useEffect(()=>{setPeer(target)},[target?.id]);

 useEffect(()=>{
  if(phase==='connected'){setElapsed(0);const t=window.setInterval(()=>setElapsed(v=>v+1),1000);return()=>window.clearInterval(t)}
  setElapsed(0);
 },[phase]);

 const waitForChannel=async()=>{
  await callReady.current;
  if(!callChannel.current)throw new Error('Call channel is not ready.');
 };

 const sendCall=async(payload:any)=>{
  await waitForChannel();
  const result=await callChannel.current.send({type:'broadcast',event:'signal',payload:{...payload,from:uid}});
  if(result!=='ok')throw new Error('Call signal was not delivered.');
 };

 const flushIce=async()=>{
  const p=pc.current;if(!p?.remoteDescription)return;
  for(const c of pendingIce.current){try{await p.addIceCandidate(c)}catch{}}
  pendingIce.current=[];
 };

 const setupPeer=async()=>{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Your browser does not expose microphone access.');
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
  local.current=stream;
  const connection=new RTCPeerConnection({iceServers:[
   {urls:'stun:stun.l.google.com:19302'},
   {urls:'stun:stun1.l.google.com:19302'},
   {urls:'stun:stun.cloudflare.com:3478'}
  ]});
  stream.getTracks().forEach(track=>connection.addTrack(track,stream));
  connection.onicecandidate=e=>{if(e.candidate)void sendCall({type:'ice',candidate:e.candidate})};
  connection.ontrack=e=>{
   const s=e.streams[0]||new MediaStream([e.track]);
   if(remoteAudio.current){
    remoteAudio.current.srcObject=s;
    void remoteAudio.current.play().catch(()=>{});
   }
  };
  connection.onconnectionstatechange=()=>{
   if(!activeRef.current)return;
   if(connection.connectionState==='connected')setPhase('connected');
   if(['failed','disconnected'].includes(connection.connectionState))setError('The peer connection was interrupted. Check both devices and try again.');
  };
  pc.current=connection;
  return connection;
 };

 const openCallChannel=async(id:string)=>{
  if(!supabase)throw new Error('Supabase is required for calls.');
  const client=supabase;
  callId.current=id;
  const channel=client.channel('frame-direct-call:'+id,{config:{private:true,broadcast:{ack:true}}});
  callChannel.current=channel;
  channel.on('broadcast',{event:'signal'},async({payload}:any)=>{
   if(!payload||payload.from===uid||payload.to&&payload.to!==uid)return;
   try{
    if(payload.type==='ready'&&peer?.id===String(payload.from)){
     const p=pc.current||await setupPeer();
     const offer=await p.createOffer();
     await p.setLocalDescription(offer);
     await sendCall({type:'offer',to:payload.from,sdp:p.localDescription});
     setPhase('connecting');
    }else if(payload.type==='offer'){
     const p=pc.current||await setupPeer();
     await p.setRemoteDescription(payload.sdp);
     await flushIce();
     const answer=await p.createAnswer();
     await p.setLocalDescription(answer);
     await sendCall({type:'answer',to:payload.from,sdp:p.localDescription});
     await client.from('direct_call_sessions').update({status:'connected'}).eq('id',id);
     setPhase('connected');
    }else if(payload.type==='answer'&&pc.current){
     await pc.current.setRemoteDescription(payload.sdp);
     await flushIce();
     await client.from('direct_call_sessions').update({status:'connected'}).eq('id',id);
     setPhase('connected');
    }else if(payload.type==='ice'){
     const p=pc.current;
     if(p?.remoteDescription){try{await p.addIceCandidate(payload.candidate)}catch{}}
     else pendingIce.current.push(payload.candidate);
    }else if(payload.type==='decline'){
     setError('The call was declined.');
     await finish(false,'declined');
    }else if(payload.type==='hangup'){
     await finish(false,'ended');
    }
   }catch(e){setError(e instanceof Error?e.message:'The call connection failed.')}
  });
  callReady.current=new Promise((resolve,reject)=>{
   channel.subscribe((status:string,err?:any)=>{
    if(status==='SUBSCRIBED')resolve();
    else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){const msg=err?.message||'The secure call channel could not connect.';setError(msg);reject(new Error(msg));}
   });
  });
  await callReady.current;
 };

 const finish=async(notify=true,status:'ended'|'declined'|'missed'='ended')=>{
  const id=callId.current;
  try{
   if(notify&&callChannel.current)await sendCall({type:'hangup'});
   if(supabase&&id)await supabase.from('direct_call_sessions').update({status,ended_at:new Date().toISOString()}).eq('id',id);
  }catch{}
  pc.current?.close();pc.current=null;
  local.current?.getTracks().forEach(t=>t.stop());local.current=null;
  pendingIce.current=[];
  if(callChannel.current)void callChannel.current.unsubscribe();
  callChannel.current=null;callReady.current=null;callId.current=null;
  setIncoming(null);setPhase('idle');setMuted(false);setPeer(target);setError('');
  if(notify||target)onClear();
 };

 const startOutgoing=async()=>{
  if(!target||!supabase)return;
  try{
   setError('');setPeer(target);setPhase('connecting');
   const id=crypto.randomUUID();
   const {error:e}=await supabase.from('direct_call_sessions').insert({id,caller_id:uid,callee_id:target.id,status:'ringing'});
   if(e)throw e;
   await openCallChannel(id);
   await inboxReady.current;
   await inboxReady.current;
   const {error:re}=await inbox.current.send({type:'broadcast',event:'ring',payload:{callId:id,from:uid}});
   if(re)throw new Error('The other person could not be reached.');
   await setupPeer();
   setPhase('connecting');
  }catch(e){setError(e instanceof Error?e.message:'Could not start the call.');await finish(false,'ended')}
 };

 const acceptIncoming=async()=>{
  if(!incoming||!supabase)return;
  try{
   setError('');setPeer(incoming.caller);callId.current=incoming.callId;
   await openCallChannel(incoming.callId);
   await setupPeer();
   await sendCall({type:'ready',to:incoming.caller.id});
   await supabase.from('direct_call_sessions').update({status:'connected'}).eq('id',incoming.callId);
   setIncoming(null);setPhase('connecting');
  }catch(e){setError(e instanceof Error?e.message:'Could not answer the call.');await finish(false,'ended')}
 };

 const declineIncoming=async()=>{
  if(!incoming)return;
  try{
   await openCallChannel(incoming.callId);
   await sendCall({type:'decline',to:incoming.caller.id});
   await supabase?.from('direct_call_sessions').update({status:'declined',ended_at:new Date().toISOString()}).eq('id',incoming.callId);
  }catch{}
  if(callChannel.current)void callChannel.current.unsubscribe();
  callChannel.current=null;callReady.current=null;callId.current=null;
  setIncoming(null);setPhase('idle');
 };

 const toggleMute=()=>{
  const next=!muted;
  local.current?.getAudioTracks().forEach(track=>track.enabled=!next);
  setMuted(next);
 };

 if(!target&&!incoming)return null;
 const shown=peer||incoming?.caller;
 const mm=Math.floor(elapsed/60).toString().padStart(2,'0');
 const ss=(elapsed%60).toString().padStart(2,'0');

 return <div className="direct-call-overlay">
  <section className="direct-call-card">
   <div className="direct-call-top"><span className="direct-call-status"><Radio size={12}/> {incoming?'INCOMING CALL':phase==='connected'?'CONNECTED':'FRAME VOICE'}</span><button className="icon-button" onClick={()=>void finish(true)} aria-label="Close call"><PhoneOff size={16}/></button></div>
   <div className="direct-call-avatar">{shown?<img src={shown.avatar_url||''} alt="" onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none'}}/>:<User size={30}/>}<span>{shown?avatarText(shown):'F'}</span></div>
   <small>{incoming?'Incoming voice call from':phase==='connected'?mm+':'+ss:'Voice call with'}</small>
   <h2>{shown?.display_name||shown?.username||'FRAME user'}</h2>
   <p>{incoming?'They are calling you now.':phase==='connected'?'Encrypted peer connection · audio only':phase==='connecting'?'Connecting securely…':'Ready for a voice call.'}</p>
   {error&&<div className="inline-error">{error}</div>}
   <audio ref={remoteAudio} autoPlay playsInline/>
   <div className="direct-call-actions">
    {incoming?<><button className="primary call-answer" onClick={()=>void acceptIncoming()}><PhoneCall size={18}/>Answer</button><button className="danger" onClick={()=>void declineIncoming()}><PhoneOff size={18}/>Decline</button></>
     :phase==='idle'?<><button className="primary" onClick={()=>void startOutgoing()}><Phone size={18}/>Start call</button><button className="secondary" onClick={()=>finish(false)}>Cancel</button></>
     :<><button className="secondary" onClick={toggleMute}>{muted?<MicOff size={18}/>:<Mic size={18}/>} {muted?'Unmute':'Mute'}</button><button className="danger" onClick={()=>void finish(true)}><PhoneOff size={18}/>End</button></>}
   </div>
  </section>
 </div>;
}

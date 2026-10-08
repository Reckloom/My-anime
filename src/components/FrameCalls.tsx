import {useEffect,useRef,useState} from 'react';
import {LogOut,Mic,MicOff,Phone,Radio,Users,Volume2} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Profile={id:string;username:string;display_name:string;avatar_url?:string|null};
type Remote={id:string;stream:MediaStream};

const GLOBAL_TOPIC='frame-global-voice-v1';
const MAX_PEERS=8;

function guestId(){
  const key='frame-global-call-guest-id';
  const existing=localStorage.getItem(key);
  if(existing)return existing;
  const id='guest-'+crypto.randomUUID();
  localStorage.setItem(key,id);
  return id;
}

export function CallsPage({uid,profile,onCloseCall:_onCloseCall}:{uid:string;profile:Profile|null;onCloseCall:()=>void}){
  const client=supabase;
  const [joined,setJoined]=useState(false);
  const [joining,setJoining]=useState(false);
  const [muted,setMuted]=useState(false);
  const [error,setError]=useState('');
  const [participants,setParticipants]=useState(0);
  const [remotes,setRemotes]=useState<Remote[]>([]);
  const channelRef=useRef<any>(null);
  const localRef=useRef<MediaStream|null>(null);
  const peers=useRef<Map<string,RTCPeerConnection>>(new Map());
  const pendingIce=useRef<Map<string,RTCIceCandidateInit[]>>(new Map());
  const audioRefs=useRef<Map<string,HTMLAudioElement>>(new Map());
  const mounted=useRef(true);
  const clientIdRef=useRef(uid==='guest'?guestId():uid);
  const displayName=profile?.display_name||profile?.username||(uid==='guest'?'Guest':'FRAME user');

  useEffect(()=>()=>{mounted.current=false;void leave();},[]);

  const send=async(payload:any)=>{
    const channel=channelRef.current;
    if(!channel)return;
    await channel.send({type:'broadcast',event:'signal',payload:{...payload,from:clientIdRef.current}});
  };

  const closePeer=(id:string)=>{
    const pc=peers.current.get(id);
    pc?.close();
    peers.current.delete(id);
    pendingIce.current.delete(id);
    setRemotes(prev=>prev.filter(x=>x.id!==id));
  };

  const makePeer=async(id:string,initiator:boolean)=>{
    if(id===clientIdRef.current)return null;
    if(!peers.current.has(id)&&peers.current.size>=MAX_PEERS-1){
      await send({type:'busy',to:id});
      if(mounted.current)setError('Global Call supports up to '+MAX_PEERS+' people at once. Wait for a place to open.');
      return null;
    }
    const existing=peers.current.get(id);
    if(existing)return existing;
    const stream=localRef.current;
    if(!stream)throw new Error('Microphone is not ready.');
    const pc=new RTCPeerConnection({iceServers:[
      {urls:'stun:stun.l.google.com:19302'},
      {urls:'stun:stun1.l.google.com:19302'},
      {urls:'stun:stun.cloudflare.com:3478'}
    ]});
    peers.current.set(id,pc);
    stream.getTracks().forEach(track=>pc.addTrack(track,stream));
    pc.onicecandidate=e=>{if(e.candidate)void send({type:'ice',to:id,candidate:e.candidate.toJSON()});};
    pc.ontrack=e=>{
      const stream=e.streams[0]||new MediaStream([e.track]);
      setRemotes(prev=>prev.some(x=>x.id===id)?prev.map(x=>x.id===id?{...x,stream}:x):[...prev,{id,stream}]);
    };
    pc.onconnectionstatechange=()=>{
      if(['failed','closed'].includes(pc.connectionState))closePeer(id);
    };
    if(initiator){
      const offer=await pc.createOffer();
      await pc.setLocalDescription(offer);
      await send({type:'offer',to:id,sdp:pc.localDescription});
    }
    return pc;
  };

  const handleSignal=async(payload:any)=>{
    if(!payload||payload.from===clientIdRef.current)return;
    if(payload.to&&payload.to!==clientIdRef.current)return;
    const id=String(payload.from);
    try{
      if(payload.type==='offer'){
        const pc=await makePeer(id,false);
        if(!pc)return;
        await pc.setRemoteDescription(payload.sdp);
        const queued=pendingIce.current.get(id)||[];
        for(const candidate of queued)await pc.addIceCandidate(candidate).catch(()=>{});
        pendingIce.current.delete(id);
        const answer=await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await send({type:'answer',to:id,sdp:pc.localDescription});
      }else if(payload.type==='answer'){
        const pc=peers.current.get(id);
        if(pc){
          await pc.setRemoteDescription(payload.sdp);
          const queued=pendingIce.current.get(id)||[];
          for(const candidate of queued)await pc.addIceCandidate(candidate).catch(()=>{});
          pendingIce.current.delete(id);
        }
      }else if(payload.type==='ice'){
        const pc=peers.current.get(id);
        if(pc?.remoteDescription)await pc.addIceCandidate(payload.candidate).catch(()=>{});
        else{
          const list=pendingIce.current.get(id)||[];
          list.push(payload.candidate);
          pendingIce.current.set(id,list);
        }
      }else if(payload.type==='bye'){
        closePeer(id);
      }else if(payload.type==='hello'){
        if(clientIdRef.current<id)await makePeer(id,true);
      }else if(payload.type==='busy'){
        closePeer(id);
        if(mounted.current)setError('Global Call is currently full ('+MAX_PEERS+' people).');
      }
    }catch(e){
      if(mounted.current)setError(e instanceof Error?e.message:'Voice connection failed.');
    }
  };

  const updatePresence=()=>{
    const ch=channelRef.current;
    if(!ch)return;
    const state=ch.presenceState();
    const count=Object.keys(state||{}).length;
    if(mounted.current)setParticipants(count);
  };

  const join=async()=>{
    if(!client||joined||joining)return;
    setJoining(true);setError('');
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('This browser does not provide microphone access.');
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
      localRef.current=stream;
      const channel=client.channel(GLOBAL_TOPIC,{config:{private:false,broadcast:{ack:true},presence:{key:clientIdRef.current}}});
      channelRef.current=channel;
      channel.on('broadcast',{event:'signal'},({payload}:any)=>{void handleSignal(payload);});
      channel.on('presence',{event:'sync'},updatePresence);
      channel.on('presence',{event:'join'},updatePresence);
      channel.on('presence',{event:'leave'},({key}:any)=>{closePeer(String(key));updatePresence();});
      await new Promise<void>((resolve,reject)=>{
        channel.subscribe((status:string,err?:any)=>{
          if(status==='SUBSCRIBED')resolve();
          else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')reject(new Error(err?.message||'Global voice is unavailable right now.'));
        });
      });
      const preJoinCount=Object.keys(channel.presenceState()||{}).length;
      if(preJoinCount>=MAX_PEERS)throw new Error('Global Call is currently full ('+MAX_PEERS+' people).');
      await channel.track({name:displayName,joinedAt:Date.now()});
      setJoined(true);
      updatePresence();
      await send({type:'hello'});
      // Presence sync may have arrived before track completed; proactively inspect current peers.
      const state=channel.presenceState() as Record<string,any[]>;
      for(const id of Object.keys(state||{})){
        if(id!==clientIdRef.current&&clientIdRef.current<id)await makePeer(id,true);
      }
    }catch(e){
      localRef.current?.getTracks().forEach(t=>t.stop());localRef.current=null;
      if(channelRef.current){void channelRef.current.unsubscribe();channelRef.current=null;}
      setError(e instanceof Error?e.message:'Could not join the global call.');
    }finally{if(mounted.current)setJoining(false);}
  };

  async function leave(){
    if(!channelRef.current&&!localRef.current)return;
    try{await send({type:'bye'});}catch{}
    for(const id of Array.from(peers.current.keys()))closePeer(id);
    localRef.current?.getTracks().forEach(t=>t.stop());localRef.current=null;
    const ch=channelRef.current;
    channelRef.current=null;
    if(ch){try{await ch.untrack();}catch{};try{await ch.unsubscribe();}catch{}}
    if(mounted.current){setJoined(false);setMuted(false);setParticipants(0);setRemotes([]);}
  }

  const toggleMute=()=>{
    const next=!muted;
    localRef.current?.getAudioTracks().forEach(track=>{track.enabled=!next;});
    setMuted(next);
  };

  useEffect(()=>{
    for(const remote of remotes){
      const audio=audioRefs.current.get(remote.id);
      if(audio&&audio.srcObject!==remote.stream){audio.srcObject=remote.stream;void audio.play().catch(()=>{});}
    }
  },[remotes]);

  return <div className="page global-call-page">
    <div className="page-heading">
      <div><small>FRAME VOICE</small><h1>Global Call</h1><p>One public voice room for FRAME. Anyone using the site can join, including guests.</p></div>
      {joined?<span className="call-live-badge"><i/>LIVE · {participants} {participants===1?'person':'people'}</span>:null}
    </div>
    <section className="global-call-panel">
      <div className="global-call-visual"><div className="global-call-orbit"><Radio size={38}/></div><small>PUBLIC ROOM</small><h2>{joined?'You are in the FRAME global call.':'The room is ready.'}</h2><p>{joined?'Your microphone is active until you leave. Mute is instant and leaving immediately closes your connections.':'No room setup, passwords or invitations. Press one button to enter the shared voice room.'}</p></div>
      <div className="global-call-stats"><div><Users size={17}/><b>{participants}</b><span>Connected</span></div><div><Volume2 size={17}/><b>{remotes.length}</b><span>Audio peers</span></div><div><Radio size={17}/><b>Public</b><span>Room type</span></div></div>
      {error&&<div className="inline-error">{error}</div>}
      {joined?<div className="global-call-actions"><button className="secondary call-control" onClick={toggleMute}>{muted?<MicOff size={18}/>:<Mic size={18}/>} {muted?'Unmute':'Mute'}</button><button className="danger call-control" onClick={()=>void leave()}><LogOut size={18}/>Leave call</button></div>:<button className="primary global-call-join" disabled={joining} onClick={()=>void join()}><Phone size={18}/>{joining?'Joining…':'Join global call'}</button>}
      <div className="global-call-note">Public global calls are separate from private one-to-one calls. This browser-to-browser room supports up to {MAX_PEERS} participants. Your microphone permission is requested only when you join.</div>
      {remotes.map(remote=><audio key={remote.id} ref={el=>{if(el)audioRefs.current.set(remote.id,el);else audioRefs.current.delete(remote.id)}} autoPlay playsInline/> )}
    </section>
  </div>;
}

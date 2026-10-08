import {useEffect,useMemo,useRef,useState} from 'react';
import {Copy,LogOut,Mic,MicOff,Phone,RefreshCw,Users} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Profile={id:string;username:string;display_name:string;avatar_url?:string|null};
type Remote={id:string;stream:MediaStream};
type Participant={id:string;name:string};

const MAX_PEERS=8;
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function sessionId(uid:string){
  const key='frame-private-call-session:'+uid;
  const existing=sessionStorage.getItem(key);
  if(existing)return existing;
  const value=(uid==='guest'?'guest':'user')+'-'+crypto.randomUUID();
  sessionStorage.setItem(key,value);
  return value;
}

function makeRoomCode(){
  const bytes=new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>CODE_CHARS[b%CODE_CHARS.length]).join('');
}

export function PrivateCallRoom({uid,profile}:{uid:string;profile:Profile|null}){
  const client=supabase;
  const [code,setCode]=useState('');
  const [joinedCode,setJoinedCode]=useState('');
  const [joined,setJoined]=useState(false);
  const [joining,setJoining]=useState(false);
  const [muted,setMuted]=useState(false);
  const [error,setError]=useState('');
  const [participants,setParticipants]=useState<Participant[]>([]);
  const [remotes,setRemotes]=useState<Remote[]>([]);
  const channelRef=useRef<any>(null);
  const localRef=useRef<MediaStream|null>(null);
  const peers=useRef<Map<string,RTCPeerConnection>>(new Map());
  const pendingIce=useRef<Map<string,RTCIceCandidateInit[]>>(new Map());
  const audioRefs=useRef<Map<string,HTMLAudioElement>>(new Map());
  const mounted=useRef(true);
  const clientId=useMemo(()=>sessionId(uid),[uid]);
  const displayName=profile?.display_name||profile?.username||(uid==='guest'?'Guest':'FRAME user');

  const updatePresence=()=>{
    const ch=channelRef.current;
    if(!ch)return;
    const state=ch.presenceState() as Record<string,any[]>;
    const list=Object.entries(state||{}).map(([id,entries])=>({
      id,
      name:String(entries?.[0]?.name||'FRAME user')
    }));
    if(mounted.current)setParticipants(list.slice(0,MAX_PEERS));
  };

  const send=async(payload:any)=>{
    const ch=channelRef.current;
    if(!ch)return;
    await ch.send({type:'broadcast',event:'signal',payload:{...payload,from:clientId}});
  };

  const closePeer=(id:string)=>{
    peers.current.get(id)?.close();
    peers.current.delete(id);
    pendingIce.current.delete(id);
    setRemotes(prev=>prev.filter(x=>x.id!==id));
  };

  const makePeer=async(id:string,initiator:boolean)=>{
    if(id===clientId)return null;
    if(!peers.current.has(id)&&peers.current.size>=MAX_PEERS-1){
      await send({type:'busy',to:id});
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
    if(!payload||payload.from===clientId)return;
    if(payload.to&&payload.to!==clientId)return;
    const id=String(payload.from);
    try{
      if(payload.type==='hello'){
        if(clientId<id)await makePeer(id,true);
      }else if(payload.type==='offer'){
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
      }else if(payload.type==='busy'){
        closePeer(id);
        if(mounted.current)setError('This private room is full.');
      }
    }catch(e){
      if(mounted.current)setError(e instanceof Error?e.message:'Private voice connection failed.');
    }
  };

  useEffect(()=>{
    for(const remote of remotes){
      const audio=audioRefs.current.get(remote.id);
      if(audio&&audio.srcObject!==remote.stream){audio.srcObject=remote.stream;void audio.play().catch(()=>{});}
    }
  },[remotes]);

  useEffect(()=>()=>{mounted.current=false;void leave();},[]);

  const joinRoom=async(requestedCode:string)=>{
    const room=requestedCode.trim().toUpperCase();
    if(!client||joined||joining)return;
    if(!/^[A-HJ-NP-Z2-9]{6}$/.test(room)){setError('Enter a 6-character room code.');return;}
    setJoining(true);setError('');
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('This browser does not provide microphone access.');
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
      localRef.current=stream;
      const channel=client.channel('frame-private-voice-'+room,{config:{private:false,broadcast:{ack:true},presence:{key:clientId}}});
      channelRef.current=channel;
      channel.on('broadcast',{event:'signal'},({payload}:any)=>{void handleSignal(payload);});
      channel.on('presence',{event:'sync'},updatePresence);
      channel.on('presence',{event:'join'},updatePresence);
      channel.on('presence',{event:'leave'},({key}:any)=>{closePeer(String(key));updatePresence();});
      await new Promise<void>((resolve,reject)=>{
        channel.subscribe((status:string,err?:any)=>{
          if(status==='SUBSCRIBED')resolve();
          else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')reject(new Error(err?.message||'Private room is unavailable right now.'));
        });
      });
      const current=channel.presenceState() as Record<string,any[]>;
      if(Object.keys(current||{}).length>=MAX_PEERS)throw new Error('This private room is full.');
      await channel.track({name:displayName,joinedAt:Date.now()});
      setJoinedCode(room);
      setJoined(true);
      updatePresence();
      await send({type:'hello'});
      for(const id of Object.keys((channel.presenceState() as Record<string,any[]>)||{})){
        if(id!==clientId&&clientId<id)await makePeer(id,true);
      }
    }catch(e){
      localRef.current?.getTracks().forEach(t=>t.stop());localRef.current=null;
      if(channelRef.current){void channelRef.current.unsubscribe();channelRef.current=null;}
      setError(e instanceof Error?e.message:'Could not join the private room.');
    }finally{if(mounted.current)setJoining(false);}
  };

  async function leave(){
    if(!channelRef.current&&!localRef.current)return;
    try{await send({type:'bye'});}catch{}
    for(const id of Array.from(peers.current.keys()))closePeer(id);
    localRef.current?.getTracks().forEach(t=>t.stop());localRef.current=null;
    const ch=channelRef.current;channelRef.current=null;
    if(ch){try{await ch.untrack()}catch{};try{await ch.unsubscribe()}catch{}}
    if(mounted.current){setJoined(false);setJoinedCode('');setMuted(false);setParticipants([]);setRemotes([]);}
  }

  const toggleMute=()=>{
    const next=!muted;
    localRef.current?.getAudioTracks().forEach(track=>{track.enabled=!next;});
    setMuted(next);
  };

  const create=async()=>{
    const next=makeRoomCode();
    setCode(next);
    await joinRoom(next);
  };

  const copyCode=async()=>{
    if(!joinedCode)return;
    try{await navigator.clipboard.writeText(joinedCode);setError('Room code copied.');setTimeout(()=>setError(''),1800);}catch{setError('Copy is unavailable. Select the code manually.');}
  };

  return <section className="private-call-section">
    <div className="private-call-hero">
      <div><small>PRIVATE ROOMS</small><h2>{joined?'Room '+joinedCode:'Create a room with a code'}</h2><p>{joined?'Share the code with the people you trust. Only people who know it can attempt to join this room.':'Like an Among Us room code: create one, send the 6-character code to friends, and everyone joins the same voice room.'}</p></div>
      <span className="private-call-cap"><Users size={14}/> Up to {MAX_PEERS}</span>
    </div>
    {error&&<div className={error==='Room code copied.'?'private-call-copied':'inline-error'}>{error}</div>}
    {!joined?<div className="private-call-options">
      <div className="private-call-option">
        <div className="private-call-option-icon"><Phone size={18}/></div>
        <div><b>Create private room</b><p>Generate a fresh room code and enter immediately.</p></div>
        <button className="primary" disabled={joining} onClick={()=>void create()}><RefreshCw size={15}/>{joining?'Creating…':'Create room'}</button>
      </div>
      <div className="private-call-option">
        <div className="private-call-option-icon"><Users size={18}/></div>
        <div><b>Join with code</b><p>Enter a code shared by a friend.</p></div>
        <div className="private-call-join-form"><input aria-label="Private room code" value={code} maxLength={6} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,'').slice(0,6))} placeholder="ABC234"/><button className="secondary" disabled={joining||code.length!==6} onClick={()=>void joinRoom(code)}>Join room</button></div>
      </div>
    </div>:<div className="private-call-live">
      <div className="private-call-code"><small>SHARE THIS CODE</small><strong>{joinedCode}</strong><button className="secondary" onClick={()=>void copyCode()}><Copy size={15}/>Copy code</button></div>
      <div className="private-call-participants">{participants.map(p=><div key={p.id}><span>{p.name.slice(0,1).toUpperCase()}</span><b>{p.id===clientId?'You':p.name}</b></div>)}</div>
      <div className="global-call-actions"><button className="secondary call-control" onClick={toggleMute}>{muted?<MicOff size={18}/>:<Mic size={18}/>} {muted?'Unmute':'Mute'}</button><button className="danger call-control" onClick={()=>void leave()}><LogOut size={18}/>Leave room</button></div>
      {remotes.map(remote=><audio key={remote.id} ref={el=>{if(el)audioRefs.current.set(remote.id,el);else audioRefs.current.delete(remote.id)}} autoPlay playsInline/>)}
    </div>}
    <div className="private-call-note">The room is not listed in FRAME. The join code is the invitation. Voice stays browser-to-browser.</div>
  </section>;
}

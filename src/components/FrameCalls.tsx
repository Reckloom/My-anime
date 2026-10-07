import {useEffect,useMemo,useRef,useState} from 'react';
import {Check,Copy,Lock,Mic,MicOff,Phone,PhoneOff,Plus,Radio,ShieldCheck,UserMinus,Users,Volume2,VolumeX,X} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Profile={id:string;username:string;display_name:string};
type Room={id:string;room_code:string;host_id:string;title:string;visibility:'public'|'private';password_hash:string|null;approval_required:boolean;max_participants:number;active:boolean;created_at:string};
type Participant={id:string;room_id:string;user_id:string;status:'requested'|'approved'|'rejected'|'left';is_muted:boolean};
type Remote={id:string;stream:MediaStream};

async function hashPassword(password:string){
 const bytes=new TextEncoder().encode(password);
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
}
function makeCode(){return crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase()}

export function CallsPage({uid,profile,onCloseCall}:{uid:string;profile:Profile|null;onCloseCall:()=>void}){
 const [rooms,setRooms]=useState<Room[]>([]),[myRooms,setMyRooms]=useState<Room[]>([]),[busy,setBusy]=useState(false);
 const [showCreate,setShowCreate]=useState(false),[joinRoom,setJoinRoom]=useState<Room|null>(null),[joinCode,setJoinCode]=useState(''),[joinPassword,setJoinPassword]=useState('');
 const [title,setTitle]=useState('FRAME Voice Room'),[visibility,setVisibility]=useState<'public'|'private'>('public'),[approval,setApproval]=useState(true),[roomPassword,setRoomPassword]=useState(''),[maxParticipants,setMaxParticipants]=useState(6);
 const [message,setMessage]=useState(''),[activeRoom,setActiveRoom]=useState<Room|null>(null);
 const [pending,setPending]=useState<Participant[]>([]),[participantProfiles,setParticipantProfiles]=useState<Record<string,Profile>>({});
 const [joinStatus,setJoinStatus]=useState<string|null>(null),[awaitingRoom,setAwaitingRoom]=useState<Room|null>(null);

 const loadRooms=async()=>{
  const client=supabase;if(!client)return;
  const {data}=await client.from('call_rooms').select('*').eq('active',true).order('created_at',{ascending:false});
  const all=(data||[]) as Room[];
  setRooms(all.filter(r=>r.visibility==='public'));setMyRooms(all.filter(r=>r.host_id===uid));
  if(activeRoom){
   const {data:p}=await client.from('call_participants').select('*').eq('room_id',activeRoom.id);
   const ps=(p||[]) as Participant[];
   setPending(ps.filter(x=>x.status==='requested'));
   const ids=[...new Set(ps.map(x=>x.user_id))].filter(x=>x!==uid);
   if(ids.length){
    const {data:pp}=await client.from('profiles').select('id,username,display_name').in('id',ids);
    setParticipantProfiles(Object.fromEntries(((pp||[]) as Profile[]).map(x=>[x.id,x])));
   }
  }
 };
 useEffect(()=>{void loadRooms();const t=window.setInterval(()=>void loadRooms(),5000);return()=>window.clearInterval(t)},[uid,activeRoom?.id]);

 useEffect(()=>{
  const client=supabase;
  if(!client||!awaitingRoom)return;
  let active=true;
  const check=async()=>{
   const {data,error}=await client.from('call_participants').select('status').eq('room_id',awaitingRoom.id).eq('user_id',uid).maybeSingle();
   if(!active||error)return;
   const status=data?.status;
   if(status==='approved'){
    setActiveRoom(awaitingRoom);setAwaitingRoom(null);setJoinStatus(null);setJoinCode('');setJoinPassword('');
   }else if(status==='rejected'){
    setAwaitingRoom(null);setJoinStatus(null);setMessage('The host declined your request to join this room.');
   }
  };
  void check();
  const t=window.setInterval(()=>void check(),2000);
  return()=>{active=false;window.clearInterval(t)};
 },[uid,awaitingRoom?.id]);

 const createRoom=async()=>{
  const client=supabase;if(!client)return;
  setBusy(true);setMessage('');
  try{
   const password_hash=roomPassword.trim()?await hashPassword(roomPassword):null;
   const {data,error}=await client.from('call_rooms').insert({
    room_code:makeCode(),host_id:uid,title:title.trim()||'FRAME Voice Room',visibility,password_hash,
    approval_required:approval,max_participants:maxParticipants,active:true
   }).select('*').single();
   if(error||!data)throw error||new Error('Could not create the call room.');
   const {error:participantError}=await client.from('call_participants').insert({room_id:data.id,user_id:uid,status:'approved'});
   if(participantError)throw participantError;
   setActiveRoom(data as Room);setShowCreate(false);setMessage('Room created.');setRoomPassword('');
  }catch(e){setMessage(e instanceof Error?e.message:'Could not create the call room.')}finally{setBusy(false)}
 };

 const request=async(room:Room,overrideCode?:string)=>{
  const client=supabase;if(!client)return;
  setBusy(true);setMessage('');
  try{
   const code=(overrideCode||room.room_code).trim().toUpperCase();
   if(code!==room.room_code.toUpperCase()){setMessage('That room code is not valid.');return}
   let passwordHash:string|null=null;
   if(room.visibility==='private'){
    const entered=joinPassword.trim();
    if(!entered){setMessage('This private call needs its password.');return}
    passwordHash=await hashPassword(entered);
   }
   const {data,error}=await client.rpc('join_frame_call',{p_room_code:code,p_password_hash:passwordHash});
   if(error||!Array.isArray(data)||!data.length){
    setMessage(error?.message||room.visibility==='private'?'The private call password is incorrect, the room is unavailable, or it is full.':'The room is unavailable or already full.');
    return;
   }
   const result=data[0] as Room&{participant_status?:string};
   const joinedRoom={...result} as Room;
   if(result.participant_status==='approved'){
    setActiveRoom(joinedRoom);setAwaitingRoom(null);setJoinRoom(null);setJoinStatus(null);setJoinCode('');setJoinPassword('');
   }else{
    setAwaitingRoom(joinedRoom);setJoinStatus('Request sent. Waiting for the host to approve you…');setJoinRoom(null);
   }
  }catch(e){setMessage(e instanceof Error?e.message:'Could not join the call.')}finally{setBusy(false)}
 };

 const approve=async(p:Participant,status:'approved'|'rejected')=>{
  const client=supabase;if(!client||!activeRoom)return;
  const {error}=await client.from('call_participants').update({status}).eq('id',p.id).eq('room_id',activeRoom.id);
  if(error)setMessage(error.message);
  await loadRooms();
 };

 const leave=async()=>{
  const client=supabase;
  if(client&&activeRoom){
   await client.from('call_participants').update({status:'left'}).eq('room_id',activeRoom.id).eq('user_id',uid);
   if(activeRoom.host_id===uid)await client.from('call_rooms').update({active:false}).eq('id',activeRoom.id);
  }
  setActiveRoom(null);setPending([]);setJoinStatus(null);setAwaitingRoom(null);onCloseCall();
 };

 if(activeRoom)return <GroupVoiceCall uid={uid} room={activeRoom} profile={profile} host={activeRoom.host_id===uid} onExit={leave} pending={pending} profiles={participantProfiles} approve={approve}/>;

 return <div className="page calls-page">
  <div className="page-heading"><div><small>FRAME VOICE</small><h1>Calls</h1><p>Join a public room, create a private room, or host a low-latency peer-to-peer voice space.</p></div><button className="primary" onClick={()=>setShowCreate(true)}><Plus size={16}/>Create call</button></div>
  {message&&<div className="inline-error">{message}</div>}
  {joinStatus&&<div className="call-waiting"><ShieldCheck size={18}/><span>{joinStatus}</span></div>}
  <div className="calls-grid">
   <section className="calls-panel"><div className="section-title"><div><small>PUBLIC LOBBY</small><h2>Open calls</h2></div><span>{rooms.length}</span></div><div className="call-list">{rooms.length?rooms.map(r=><div className="call-room" key={r.id}><section><b>{r.title}</b><small>Host: @{r.host_id===uid?(profile?.username||'you'):'FRAME user'} · up to {r.max_participants}</small><div className="call-badges"><span className="call-badge"><Radio size={10}/>Public</span>{r.approval_required&&<span className="call-badge"><ShieldCheck size={10}/>Host approval</span>}</div></section><button className="primary" onClick={()=>{setJoinRoom(r);setMessage('');setJoinPassword('')}}><Phone size={15}/>Join</button></div>):<p className="muted">No public calls are active right now.</p>}</div></section>
   <section className="calls-panel"><div className="section-title"><div><small>YOUR ROOMS</small><h2>Hosted by you</h2></div><span>{myRooms.length}</span></div><div className="call-list">{myRooms.length?myRooms.map(r=><div className="call-room" key={r.id}><section><b>{r.title}</b><small>Code: {r.room_code} · {r.visibility} · up to {r.max_participants}</small></section><button className="secondary" onClick={()=>setActiveRoom(r)}>Open</button></div>):<p className="muted">Create a room to host one.</p>}</div><div className="call-form" style={{marginTop:18}}><label>Join a room by code<input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="8-character room code"/></label><label>Password <input type="password" value={joinPassword} onChange={e=>setJoinPassword(e.target.value)} placeholder="Required for private rooms"/></label><button className="secondary" disabled={!joinCode.trim()||busy} onClick={async()=>{const client=supabase;if(!client)return;const {data:publicRoom}=await client.from('call_rooms').select('*').eq('room_code',joinCode.trim()).eq('active',true).eq('visibility','public').maybeSingle();if(publicRoom){await request(publicRoom as Room,joinCode.trim());return}const placeholder={id:'',room_code:joinCode.trim().toUpperCase(),host_id:'',title:'Private room',visibility:'private',password_hash:null,approval_required:true,max_participants:6,active:true,created_at:''} as Room;await request(placeholder,joinCode.trim())}}><Lock size={15}/>Join by code</button></div></section>
  </div>
  {joinRoom&&<div className="overlay"><aside className="detail-drawer" style={{paddingTop:28}}><button className="close-btn" onClick={()=>setJoinRoom(null)}><X/></button><div className="detail-section" style={{borderTop:0}}><small>{joinRoom.visibility==='private'?'PRIVATE ROOM':'PUBLIC ROOM'}</small><h2 style={{fontSize:30,margin:'8px 0 8px'}}>{joinRoom.title}</h2><p className="muted">Up to {joinRoom.max_participants} participants{joinRoom.approval_required?' · host approval required':''}.</p><div className="call-form"><label>{joinRoom.visibility==='private'?'Room password':'Password (not required)' }<input type="password" value={joinPassword} onChange={e=>setJoinPassword(e.target.value)} placeholder={joinRoom.visibility==='private'?'Enter room password':'Leave blank for public room'}/></label><button className="primary" disabled={busy||(joinRoom.visibility==='private'&&!joinPassword.trim())} onClick={()=>void request(joinRoom)}>{busy?'Joining…':'Request to join'}</button></div></div></aside></div>}
  {showCreate&&<div className="overlay"><aside className="detail-drawer" style={{paddingTop:28}}><button className="close-btn" onClick={()=>setShowCreate(false)}><X/></button><div className="detail-section" style={{borderTop:0}}><small>CREATE CALL</small><h2 style={{fontSize:34,margin:'8px 0 18px'}}>Start a voice room.</h2><div className="call-form"><label>Room name<input value={title} onChange={e=>setTitle(e.target.value)} /></label><label>Visibility<select value={visibility} onChange={e=>setVisibility(e.target.value as 'public'|'private')}><option value="public">Public — visible to FRAME users</option><option value="private">Private — join by code + password</option></select></label><label>Require host approval<select value={approval?'yes':'no'} onChange={e=>setApproval(e.target.value==='yes')}><option value="yes">Yes</option><option value="no">No</option></select></label><label>Maximum participants<select value={maxParticipants} onChange={e=>setMaxParticipants(Number(e.target.value))}>{[2,3,4,5,6,8,10].map(n=><option key={n} value={n}>{n} participants</option>)}</select></label>{visibility==='private'&&<label>Room password<input type="password" value={roomPassword} onChange={e=>setRoomPassword(e.target.value)} placeholder="Choose a password"/></label>}<button className="primary" disabled={busy||(visibility==='private'&&!roomPassword.trim())} onClick={()=>void createRoom()}>{busy?'Creating…':'Create voice room'}</button></div></div></aside></div>}
 </div>;
}

function GroupVoiceCall({uid,room,profile,host,onExit,pending,profiles,approve}:{uid:string;room:Room;profile:Profile|null;host:boolean;onExit:()=>Promise<void>;pending:Participant[];profiles:Record<string,Profile>;approve:(p:Participant,status:'approved'|'rejected')=>Promise<void>}){
 const [muted,setMuted]=useState(false),[hostMuted,setHostMuted]=useState(false),[remotes,setRemotes]=useState<Remote[]>([]),[members,setMembers]=useState<Participant[]>([]),[copy,setCopy]=useState(false),[status,setStatus]=useState('Connecting microphone…'),[error,setError]=useState('');
 const local=useRef<MediaStream|null>(null),channel=useRef<any>(null),peers=useRef<Map<string,RTCPeerConnection>>(new Map());
 const audioRefs=useRef<Record<string,HTMLAudioElement|null>>({});
 const roomChannel='frame-call-'+room.id;

 const send=async(payload:any)=>{await channel.current?.send({type:'broadcast',event:'signal',payload:{...payload,from:uid}})};

 const makePeer=async(peerId:string,initiator:boolean)=>{
  const existing=peers.current.get(peerId);if(existing)return existing;
  const pc=new RTCPeerConnection({iceServers:[
   {urls:'stun:stun.l.google.com:19302'},
   {urls:'stun:stun1.l.google.com:19302'},
   {urls:'stun:stun.cloudflare.com:3478'}
  ]});
  local.current?.getTracks().forEach(t=>pc.addTrack(t,local.current!));
  pc.onicecandidate=e=>{if(e.candidate)void send({type:'ice',to:peerId,candidate:e.candidate})};
  pc.ontrack=e=>{const stream=e.streams[0]||new MediaStream([e.track]);setRemotes(prev=>{const found=prev.find(x=>x.id===peerId);return found?prev.map(x=>x.id===peerId?{id:peerId,stream}:x):[...prev,{id:peerId,stream}]})};
  pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(pc.connectionState)){pc.close();peers.current.delete(peerId);setRemotes(prev=>prev.filter(x=>x.id!==peerId))}};
  peers.current.set(peerId,pc);
  if(initiator){const offer=await pc.createOffer();await pc.setLocalDescription(offer);await send({type:'offer',to:peerId,sdp:pc.localDescription})}
  return pc;
 };

 useEffect(()=>{
  let active=true;
  const start=async()=>{
   const client=supabase;if(!client){setError('Supabase is required for live calls.');return}
   if(!navigator.mediaDevices?.getUserMedia){setError('This browser does not expose microphone access.');return}
   try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
    if(!active){stream.getTracks().forEach(t=>t.stop());return}
    local.current=stream;setStatus('Live · low-latency direct peer-to-peer audio');
    const {data,error:participantError}=await client.from('call_participants').select('*').eq('room_id',room.id).eq('status','approved');
    if(participantError){setError(participantError.message);return}
    setMembers((data||[]) as Participant[]);
    const ch=client.channel(roomChannel);channel.current=ch;
    ch.on('broadcast',{event:'signal'},async({payload}:any)=>{
      if(!payload||payload.from===uid||payload.to&&payload.to!==uid)return;
      if(payload.type==='hello'){
       await send({type:'hello-ack',to:String(payload.from)})
      }
      if(payload.type==='hello-ack'){
       const id=String(payload.from);if(uid<id)await makePeer(id,true)
      }
      if(payload.type==='offer'){const pc=await makePeer(String(payload.from),false);await pc.setRemoteDescription(payload.sdp);const ans=await pc.createAnswer();await pc.setLocalDescription(ans);await send({type:'answer',to:payload.from,sdp:pc.localDescription})}
      if(payload.type==='answer'){const pc=peers.current.get(String(payload.from));if(pc){await pc.setRemoteDescription(payload.sdp)}}
      if(payload.type==='ice'){const pc=peers.current.get(String(payload.from));if(pc?.remoteDescription)await pc.addIceCandidate(payload.candidate)}
      if(payload.type==='host-mute'){const next=Boolean(payload.muted);local.current?.getAudioTracks().forEach(t=>t.enabled=!next);setHostMuted(next);if(next)setMuted(true)}
      if(payload.type==='kick'){setError('The host removed you from this room.');setTimeout(()=>{void onExit()},250)}
      if(payload.type==='left'){const id=String(payload.from);const pc=peers.current.get(id);pc?.close();peers.current.delete(id);setRemotes(prev=>prev.filter(x=>x.id!==id))}
    }).subscribe(async()=>{await send({type:'hello'})});
    return()=>{void ch.unsubscribe()};
   }catch(e){
    if(e instanceof DOMException&&e.name==='NotAllowedError')setError('Microphone permission was denied. Allow microphone access in your browser settings and rejoin.');
    else if(e instanceof DOMException&&e.name==='NotFoundError')setError('No microphone was found on this device.');
    else setError(e instanceof Error?e.message:'Microphone access was not available.');
   }
  };
  void start();
  return()=>{active=false;local.current?.getTracks().forEach(t=>t.stop());peers.current.forEach(p=>p.close());peers.current.clear()};
 },[room.id,roomChannel,uid]);

 useEffect(()=>{for(const x of remotes){const node=audioRefs.current[x.id];if(node)node.srcObject=x.stream}},[remotes]);

 useEffect(()=>{
  const client=supabase;if(!client)return;
  let active=true;
  const refreshMembers=async()=>{
   const {data}=await client.from('call_participants').select('*').eq('room_id',room.id).eq('status','approved');
   if(active&&data)setMembers(data as Participant[]);
  };
  void refreshMembers();
  const timer=window.setInterval(()=>void refreshMembers(),3000);
  return()=>{active=false;window.clearInterval(timer)};
 },[room.id]);

 const toggleMute=()=>{
  if(hostMuted)return;
  const next=!muted;local.current?.getAudioTracks().forEach(t=>t.enabled=!next);setMuted(next)
 };
 const hostMute=async(peerId:string)=>{
  if(!host)return;
  const target=members.find(x=>x.user_id===peerId);if(!target)return;
  await send({type:'host-mute',to:peerId,muted:true});
 };
 const removeParticipant=async(peerId:string)=>{
  if(!host)return;
  const client=supabase;if(!client)return;
  await client.from('call_participants').update({status:'left'}).eq('room_id',room.id).eq('user_id',peerId);
  await send({type:'kick',to:peerId});
  const pc=peers.current.get(peerId);pc?.close();peers.current.delete(peerId);
  setRemotes(prev=>prev.filter(x=>x.id!==peerId));setMembers(prev=>prev.filter(x=>x.user_id!==peerId));
 };

 const invite=()=>{navigator.clipboard?.writeText(room.room_code).then(()=>setCopy(true)).catch(()=>{});setTimeout(()=>setCopy(false),1300)};

 const memberName=(id:string)=>profiles[id]?.display_name||profiles[id]?.username||id.slice(0,6);

 return <div className="group-call-overlay"><section className="group-call">
  <header className="group-call-head"><div><small>FRAME VOICE ROOM</small><h2>{room.title}</h2><small>Code {room.room_code} · {room.visibility==='public'?'Public':'Private'} · max {room.max_participants}</small></div><button className="close-btn" style={{position:'relative',right:'auto',top:'auto'}} onClick={()=>void onExit()}><PhoneOff size={17}/></button></header>
  <div className="call-self"><b>{profile?.display_name||profile?.username||'You'}</b><span> · {status}{hostMuted?' · Host muted your microphone':''}</span></div>
  {error&&<div className="inline-error">{error}</div>}
  <div className="participant-list">
   <div className="participant-row"><span>You</span><span>{host?<><Users size={12}/> Host</>:hostMuted?'Muted by host':muted?'Muted':'Live'}</span></div>
   {members.filter(x=>x.user_id!==uid&&x.status==='approved').map(member=>{
    const remote=remotes.find(x=>x.id===member.user_id);
    return <div className="participant-row" key={member.user_id}>
      <span>@{memberName(member.user_id)}</span>
      <span className="participant-status-actions">{remote?<><Volume2 size={11}/> Live</>:<><Radio size={11}/> Connecting</>}{host&&<><button className="icon-button call-mini-action" title="Mute participant" onClick={()=>void hostMute(member.user_id)}><VolumeX size={13}/></button><button className="icon-button call-mini-action" title="Remove participant" onClick={()=>void removeParticipant(member.user_id)}><UserMinus size={13}/></button></>}</span>
      <audio className="remote-audio" ref={el=>{audioRefs.current[member.user_id]=el}} autoPlay playsInline/>
    </div>
   })}
  </div>
  {host&&pending.length>0&&<section className="calls-panel" style={{marginTop:12}}><div className="section-title"><div><small>HOST APPROVAL</small><h2>Join requests</h2></div><span>{pending.length}</span></div>{pending.map(p=><div className="request-row" key={p.id}><span>@{profiles[p.user_id]?.username||p.user_id.slice(0,6)}</span><div className="call-row"><button className="primary" onClick={()=>void approve(p,'approved')}><Check size={14}/>Approve</button><button className="secondary" onClick={()=>void approve(p,'rejected')}>Reject</button></div></div>)}</section>}
  <div className="call-controls"><button className="secondary" disabled={hostMuted} onClick={toggleMute}>{muted?<MicOff size={17}/>:<Mic size={17}/>} {hostMuted?'Muted by host':muted?'Unmute':'Mute'}</button><button className="secondary" onClick={invite}><Copy size={16}/>{copy?'Copied':'Copy room code'}</button>{host&&<span className="call-badge"><Users size={11}/>Host controls enabled</span>}<button className="danger" onClick={()=>void onExit()}><PhoneOff size={16}/>Leave</button></div>
 </section></div>;
}

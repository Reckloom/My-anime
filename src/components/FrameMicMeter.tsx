import {useEffect,useState} from 'react';
import {Mic,MicOff} from 'lucide-react';

export function FrameMicMeter({stream,muted=false}:{stream:MediaStream|null;muted?:boolean}){
 const [level,setLevel]=useState(0);
 useEffect(()=>{
  if(!stream||!stream.getAudioTracks().length){setLevel(0);return}
  const AudioContextClass=(window.AudioContext||(window as any).webkitAudioContext) as typeof AudioContext|undefined;
  if(!AudioContextClass){setLevel(0);return}
  const ctx=new AudioContextClass();
  const source=ctx.createMediaStreamSource(stream);
  const analyser=ctx.createAnalyser();
  analyser.fftSize=256;
  source.connect(analyser);
  const data=new Uint8Array(analyser.fftSize);
  let raf=0,active=true;
  const tick=()=>{
   if(!active)return;
   analyser.getByteTimeDomainData(data);
   let sum=0;
   for(const v of data){const n=(v-128)/128;sum+=n*n}
   const rms=Math.sqrt(sum/data.length);
   setLevel(Math.min(100,Math.max(0,rms*260)));
   raf=requestAnimationFrame(tick);
  };
  void ctx.resume().catch(()=>{});
  tick();
  return()=>{active=false;cancelAnimationFrame(raf);source.disconnect();analyser.disconnect();void ctx.close()};
 },[stream]);
 const shown=Math.round(level);
 return <div className="frame-mic-meter" aria-label={muted?'Microphone muted':'Microphone level'}>
  <div className="frame-mic-icon">{muted?<MicOff size={14}/>:<Mic size={14}/>}</div>
  <div className="frame-mic-bars">{[0,1,2,3,4,5,6,7].map(i=>{
    const height=muted?.35:Math.max(.2,Math.min(1,(level-i*9)/35));
    const opacity=muted?.22:level>(i+1)*11?.95:.22;
    return <i key={i} style={{opacity,transform:'scaleY('+height+')'}}/>;
  })}</div>
  <span>{muted?'Muted':shown<8?'Quiet':shown<55?'Good':'Loud'}</span>
 </div>;
}

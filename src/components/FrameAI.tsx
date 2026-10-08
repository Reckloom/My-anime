import {useRef,useState} from 'react';
import {Bot,Mic,MicOff,Volume2,VolumeX} from 'lucide-react';
import {supabase} from '../lib/supabase';
import type {MediaItem} from '../types';

export function FrameAI({items,provider,setProvider}:{items:MediaItem[];provider:string;setProvider:(x:string)=>void}){
 const [input,setInput]=useState(''),[answer,setAnswer]=useState(''),[busy,setBusy]=useState(false),[voice,setVoice]=useState(false),[listening,setListening]=useState(false);
 const rec=useRef<any>(null);
 const ask=async(q=input)=>{
  const text=q.trim();if(!text||busy)return;setBusy(true);setAnswer('');
  try{
   if(!supabase)throw new Error('Supabase is required for FRAME AI.');
   const {data,error}=await supabase.functions.invoke('frame-ai',{body:{message:text}});
   if(error)throw error;
   const out=String((data as {answer?:string}|null)?.answer||'No answer returned.');
   setAnswer(out);
   if(voice&&'speechSynthesis' in window){window.speechSynthesis.cancel();window.speechSynthesis.speak(new SpeechSynthesisUtterance(out))}
  }catch(e){setAnswer(e instanceof Error?e.message:'FRAME AI is unavailable right now.')}finally{setBusy(false)}
 };
 const talk=()=>{
  const w=window as any,C=w.SpeechRecognition||w.webkitSpeechRecognition;
  if(!C){setAnswer('Voice input is not supported by this browser.');return}
  const r=new C();rec.current=r;r.lang='en-IN';r.interimResults=false;r.maxAlternatives=1;
  r.onstart=()=>setListening(true);r.onend=()=>setListening(false);r.onerror=()=>setListening(false);
  r.onresult=(e:any)=>{const t=e.results?.[0]?.[0]?.transcript||'';setInput(t);void ask(t)};r.start();
 };
 return <div className="page ai-page"><div className="page-heading"><div><small>FRAME INTELLIGENCE</small><h1>AI Search</h1><p>Ask about your library, compare titles, discover what fits, or use your voice.</p></div></div>
  <div className="ai-provider-bar"><span>Provider</span><button type="button" className="active">FRAME AI<small>ready</small></button><span>Other provider connectors stay hidden until they are configured.</span></div>
  <section className="ai-shell"><div className="ai-prompts">{['What should I watch next?','Find my best unfinished titles.','Recommend something like Steins;Gate.','Analyze my taste.'].map(x=><button key={x} onClick={()=>{setInput(x);void ask(x)}}>{x}</button>)}</div>
   <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Describe exactly what you want…"/>
   <div className="ai-footer"><div><button className={voice?'voice-toggle active':'voice-toggle'} onClick={()=>setVoice(!voice)}>{voice?<Volume2 size={16}/>:<VolumeX size={16}/>}Voice answers</button><button className="secondary" onClick={talk} disabled={listening||busy}>{listening?<MicOff size={16}/>:<Mic size={16}/>} {listening?'Listening…':'Talk to AI'}</button></div><button className="primary" disabled={busy||!input.trim()} onClick={()=>void ask()}>{busy?'Thinking…':'Ask FRAME'}<Bot size={16}/></button></div>
   {answer&&<div className="ai-answer"><small>FRAME AI</small><p>{answer}</p></div>}
  </section><div className="ai-library-summary"><span>{items.length} library titles available for context.</span><span>Voice uses the browser microphone/speech engine.</span></div>
 </div>;
}

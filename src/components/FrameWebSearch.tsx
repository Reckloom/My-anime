import {useState} from 'react';
import {ExternalLink,Globe,Loader2,Search} from 'lucide-react';
import {supabase} from '../lib/supabase';

type WebResult={title:string;link:string;snippet?:string;displayLink?:string};

export function FrameWebSearch(){
 const [query,setQuery]=useState(''),[results,setResults]=useState<WebResult[]>([]),[loading,setLoading]=useState(false),[message,setMessage]=useState(''),[fallbackUrl,setFallbackUrl]=useState('');
 const run=async()=>{
  const q=query.trim();if(q.length<2)return;
  setLoading(true);setMessage('');setResults([]);
  try{
   if(supabase){
    const {data,error}=await supabase.functions.invoke('web-search',{body:{query:q}});
    if(!error&&Array.isArray((data as any)?.results)&&((data as any).results.length||((data as any)?.configured===true))){
      setResults(((data as any).results||[]) as WebResult[]);
      if(!(data as any).results?.length)setMessage('Google returned no matching pages.');
      return;
    }
    if((data as any)?.fallbackUrl){
      setFallbackUrl(String((data as any).fallbackUrl));
      setMessage('In-site Google results are not configured. Open the full Google results page below.');
      return;
    }
   }
   setFallbackUrl('https://www.google.com/search?q='+encodeURIComponent(q));
   setMessage('In-site search is not configured. Open the full Google results page below.');
  }catch{
   setFallbackUrl('https://www.google.com/search?q='+encodeURIComponent(q));
   setMessage('In-site search could not connect. Open the full Google results page below.');
  }finally{
   setLoading(false);
  }
 };
 return <div className="page web-search-page">
  <div className="page-heading"><div><small>WEB DISCOVERY</small><h1>Google Search</h1><p>Google results and media catalogue search are separate tools.</p></div></div>
  <section className="web-search-panel">
   <form onSubmit={e=>{e.preventDefault();void run()}} className="web-search-bar"><Globe size={19}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search Google for anything…"/><button className="primary" disabled={loading||query.trim().length<2}>{loading?<Loader2 className="spin"/>:<Search size={16}/>}Search</button></form>
   {message&&<div className="web-search-note">{message}{fallbackUrl&&<a className="secondary" href={fallbackUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/>Open Google results</a>}</div>}
   {loading&&<div className="search-state"><Loader2 className="spin"/>Searching Google…</div>}
   {!loading&&results.length>0&&<div className="web-results">{results.map((r,i)=><a key={r.link||i} className="web-result" href={r.link} target="_blank" rel="noreferrer"><div><small>{r.displayLink||r.link}</small><h3>{r.title}</h3><p>{r.snippet||'Open this result.'}</p></div><ExternalLink size={15}/></a>)}</div>}
   {!loading&&!results.length&&!message&&<div className="web-empty"><Globe size={25}/><b>Search Google</b><span>Use this page for anything outside your media library.</span></div>}
  </section>
 </div>;
}

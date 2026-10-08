import {useState} from 'react';
import {ExternalLink,Globe,Loader2,Search} from 'lucide-react';
import {supabase} from '../lib/supabase';

type WebResult={title:string;link:string;snippet?:string;displayLink?:string};

export function FrameWebSearch(){
 const [query,setQuery]=useState(''),[results,setResults]=useState<WebResult[]>([]),[loading,setLoading]=useState(false),[message,setMessage]=useState(''),[fallbackUrl,setFallbackUrl]=useState('');
 const run=async()=>{
  const q=query.trim();if(q.length<2)return;
  setLoading(true);setMessage('');setResults([]);setFallbackUrl('');
  const googleUrl='https://www.google.com/search?q='+encodeURIComponent(q);
  try{
   if(supabase){
    const {data,error}=await supabase.functions.invoke('web-search',{body:{query:q}});
    const payload=data as {results?:WebResult[];fallbackUrl?:string;provider?:string;error?:string}|null;
    if(!error&&Array.isArray(payload?.results)&&payload.results.length){
      setResults(payload.results.filter(x=>x?.title&&x?.link).slice(0,10));
      return;
    }
    if(payload?.fallbackUrl)setFallbackUrl(String(payload.fallbackUrl));
    else setFallbackUrl(googleUrl);
    setMessage(payload?.error||'No in-site results were found. You can open the full Google results page instead.');
    return;
   }
   setFallbackUrl(googleUrl);
   setMessage('No in-site results were found. You can open the full Google results page instead.');
  }catch{
   setFallbackUrl(googleUrl);
   setMessage('In-site search is temporarily unavailable. Open the full Google results page instead.');
  }finally{
   setLoading(false);
  }
 };
 const hasQuery=query.trim().length>=2;
 return <div className="page web-search-page">
  <div className="page-heading">
   <div><small>WEB DISCOVERY</small><h1>Web Search</h1><p>Search the web without mixing web results into your personal media library.</p></div>
  </div>
  <section className="web-search-panel">
   <form onSubmit={e=>{e.preventDefault();void run()}} className="web-search-bar">
    <Globe size={19}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search the web for anything…"/>
    <button className="primary" disabled={loading||!hasQuery}>{loading?<Loader2 className="spin"/>:<Search size={16}/>}Search</button>
   </form>
   {loading&&<div className="search-state"><Loader2 className="spin"/>Searching the web…</div>}
   {!loading&&message&&<div className="web-search-empty">
    <div className="web-search-empty-icon"><Globe size={22}/></div>
    <div><b>{message}</b><span>Your personal library stays separate from web results.</span></div>
    {fallbackUrl&&<a className="primary" href={fallbackUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/>Open Google results</a>}
   </div>}
   {!loading&&!results.length&&!message&&<div className="web-search-empty">
    <div className="web-search-empty-icon"><Search size={22}/></div>
    <div><b>Search the web</b><span>Type a query above and FRAME will show the available results here.</span></div>
   </div>}
   {!loading&&results.length>0&&<div className="web-results">{results.map((r,i)=><a key={r.link||i} className="web-result" href={r.link} target="_blank" rel="noreferrer">
    <div><small>{r.displayLink||new URL(r.link).hostname}</small><h3>{r.title}</h3><p>{r.snippet||'Open this result.'}</p></div><ExternalLink size={15}/>
   </a>)}</div>}
  </section>
 </div>;
}

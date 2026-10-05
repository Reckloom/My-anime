import {useEffect,useState} from 'react';
import {AlertCircle,Download,ExternalLink,Loader2,Search,X} from 'lucide-react';
import {aniList,cleanDescription,DETAIL_QUERY,SEARCH_QUERY,titleOf,type AniListMedia} from '../anilist';
import {supabase} from '../lib/supabase';

export function AniListSearch({close,onImported}:{close:()=>void;onImported:()=>void}){
 const[query,setQuery]=useState(''),[results,setResults]=useState<AniListMedia[]>([]),[selected,setSelected]=useState<AniListMedia|null>(null);
 const[loading,setLoading]=useState(false),[detailLoading,setDetailLoading]=useState(false),[importing,setImporting]=useState(false),[error,setError]=useState('');
 useEffect(()=>{const term=query.trim();if(term.length<2){setResults([]);setError('');return}const timer=window.setTimeout(async()=>{setLoading(true);setError('');try{const d=await aniList<{Page:{media:AniListMedia[]}}>(SEARCH_QUERY,{search:term,page:1,perPage:12});setResults(d.Page.media||[])}catch(e){setError(e instanceof Error?e.message:'Could not search AniList.')}finally{setLoading(false)}},350);return()=>window.clearTimeout(timer)},[query]);
 const choose=async(r:AniListMedia)=>{setSelected(r);setDetailLoading(true);setError('');try{const d=await aniList<{Media:AniListMedia}>(DETAIL_QUERY,{id:r.id});setSelected(d.Media)}catch(e){setError(e instanceof Error?e.message:'Could not load this title.')}finally{setDetailLoading(false)}};
 const importMedia=async()=>{if(!selected||!supabase)return;setImporting(true);setError('');try{const{data,error:e}=await supabase.functions.invoke('anilist-import',{body:{action:'import',anilistId:selected.id}});if(e)throw e;if(data?.existing){setError('This AniList title is already in your library.');return}onImported()}catch(e){setError(e instanceof Error?e.message:'Could not import this title.')}finally{setImporting(false)}};
 return <div className="modalwrap"><div className="modal search-modal"><div className="modalhead"><div><small>MEDIA DISCOVERY</small><h2>Search AniList</h2></div><button onClick={close}><X/></button></div>
 <div className="search-big"><Search size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search anime, manga, movies…"/></div>
 {error&&<div className="inline-error"><AlertCircle size={15}/>{error}</div>}{loading&&<div className="search-state"><Loader2 className="spin"/>Searching AniList…</div>}
 {!loading&&query.trim().length<2&&<div className="search-state">Type at least two characters to search the AniList catalogue.</div>}
 {!loading&&query.trim().length>=2&&!results.length&&!error&&<div className="search-state">No matches found.</div>}
 <div className="ani-results">{results.map(r=><button key={r.id} className={selected?.id===r.id?'ani-result selected':'ani-result'} onClick={()=>void choose(r)}><img src={r.coverImage?.extraLarge||'https://placehold.co/240x360/111116/777?text=FRAME'}/><span><b>{titleOf(r)}</b><small>{r.type} · {r.format||'Unknown format'}{r.seasonYear?' · '+r.seasonYear:''}</small><em>{r.genres?.slice(0,3).join(' · ')}</em></span></button>)}</div>
 {selected&&<div className="ani-detail"><img src={selected.coverImage?.extraLarge||'https://placehold.co/240x360/111116/777?text=FRAME'}/><div><small>{selected.type} · {selected.format||'Unknown format'}</small><h3>{titleOf(selected)}</h3>{detailLoading?<p><Loader2 className="spin"/> Loading metadata…</p>:<><p>{cleanDescription(selected.description)||'No description available.'}</p><div className="tags">{(selected.genres||[]).map(x=><span key={x}>{x}</span>)}</div></>}<div className="ani-actions"><button className="primary" disabled={importing||detailLoading||!supabase} onClick={()=>void importMedia()}>{importing?<Loader2 className="spin"/>:<Download/>}{importing?'Importing…':'Import to my library'}</button><a href={`https://anilist.co/${selected.type.toLowerCase()}/${selected.id}`} target="_blank" rel="noreferrer"><ExternalLink/>AniList</a></div></div></div>}
 </div></div>
}

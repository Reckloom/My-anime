import {useMemo,useState} from 'react';
import {Check,ChevronRight,Clock3,Pause,Play,Plus,Search,Star,RotateCcw,Minus} from 'lucide-react';
import type {MediaItem} from '../types';
import {FrameArtwork} from './FrameArtwork';

type Props={
 items:MediaItem[];
 open:(item:MediaItem)=>void;
 add:()=>void;
 update:(item:MediaItem)=>Promise<boolean>|boolean;
};

const statusLabel:Record<string,string>={
 watching:'Watching',planned:'Plan to Watch',completed:'Completed',paused:'Paused',dropped:'Dropped',
 reading:'Reading',playing:'Playing'
};

const pct=(item:MediaItem)=>{
 const total=item.total||item.customTotal||0;
 if(item.medium==='game'||item.medium==='visual-novel')return Math.min(100,Math.max(0,item.progress||0));
 if(item.medium==='movie')return item.progress>0?100:0;
 return total>0?Math.min(100,Math.max(0,(item.progress/total)*100)):item.status==='completed'?100:0;
};

export function FrameMyAnimeDashboard({items,open,add,update}:Props){
 const [tab,setTab]=useState('all');
 const [query,setQuery]=useState('');
 const [sort,setSort]=useState('updated');
 const [busy,setBusy]=useState<string|null>(null);
 const roots=useMemo(()=>items.filter(x=>!x.parentId&&x.medium==='anime'),[items]);
 const counts=useMemo(()=>({
  all:roots.length,
  watching:roots.filter(x=>x.status==='watching').length,
  planned:roots.filter(x=>x.status==='planned').length,
  completed:roots.filter(x=>x.status==='completed').length,
  paused:roots.filter(x=>x.status==='paused').length,
  dropped:roots.filter(x=>x.status==='dropped').length
 }),[roots]);

 const visible=useMemo(()=>{
  const q=query.trim().toLowerCase();
  let list=roots.filter(x=>!q||[x.title,x.description,...(x.genres||[])].join(' ').toLowerCase().includes(q));
  if(tab!=='all')list=list.filter(x=>x.status===tab);
  return [...list].sort((a,b)=>{
   if(sort==='progress')return pct(b)-pct(a);
   if(sort==='title')return a.title.localeCompare(b.title);
   if(sort==='score')return (b.score??0)-(a.score??0);
   if(sort==='year')return (b.year??0)-(a.year??0)||a.title.localeCompare(b.title);
   if(sort==='popularity')return (b.popularity??0)-(a.popularity??0)||a.title.localeCompare(b.title);
   if(sort==='release')return (b.nextRelease?Date.parse(b.nextRelease):0)-(a.nextRelease?Date.parse(a.nextRelease):0)||(b.year??0)-(a.year??0);
   return (b.nextRelease?Date.parse(b.nextRelease):0)-(a.nextRelease?Date.parse(a.nextRelease):0)||(b.year??0)-(a.year??0);
  });
 },[roots,query,tab,sort]);

 const active=useMemo(()=>roots.filter(x=>x.status==='watching'||x.status==='paused').sort((a,b)=>pct(a)-pct(b)),[roots]);
 const change=async(item:MediaItem,patch:Partial<MediaItem>)=>{
  if(busy)return;
  setBusy(item.id);
  try{await update({...item,...patch});}finally{setBusy(null)}
 };
 const nextEpisode=(item:MediaItem)=>Math.max(1,(item.progress||0)+1);
 const setProgress=async(item:MediaItem,value:number)=>{
  const total=item.total||item.customTotal;
  const progress=Math.max(0,total?Math.min(value,total):value);
  const status=total&&progress>=total?'completed':progress>0?(item.status==='planned'?'watching':item.status):item.status;
  await change(item,{progress,status});
 };

 const Card=({item}: {item:MediaItem})=>{
  const p=pct(item);
  const next=nextEpisode(item);
  return <article className="frame-my-card">
   <button className="frame-my-art" onClick={()=>open(item)} aria-label={'Open '+item.title}>
    <FrameArtwork title={item.title} medium={item.medium} poster={item.poster} anilistId={item.anilistId} alt="" loading="lazy"/>
    <span className="frame-my-status">{statusLabel[item.status]||item.status}</span>
    {item.score!=null&&<span className="frame-my-score"><Star size={10} fill="currentColor"/>{item.score.toFixed(1)}</span>}
   </button>
   <div className="frame-my-copy">
    <button className="frame-my-title" onClick={()=>open(item)}>{item.title}</button>
    <small>{item.progress||0}{item.total?' / '+item.total:''} {item.progressUnit||'episodes'} · {Math.round(p)}%</small>
    <div className="frame-my-progress"><i style={{width:p+'%'}}/></div>
    <div className="frame-my-actions">
      {item.status==='completed'
       ?<button disabled={busy===item.id} onClick={()=>void change(item,{status:'watching',progress:0})}><RotateCcw size={13}/> Rewatch</button>
       :item.status==='dropped'
       ?<button disabled={busy===item.id} onClick={()=>void change(item,{status:'planned'})}><Plus size={13}/> Restore</button>
       :<button disabled={busy===item.id} onClick={()=>void setProgress(item,next)}><Check size={13}/> EP {next}</button>}
      <button disabled={busy===item.id||!(item.progress>0)} aria-label={"Decrease "+item.title+" progress"} onClick={()=>void setProgress(item,(item.progress||0)-1)}><Minus size={13}/></button>
      <button disabled={busy===item.id||(Boolean(item.total)&&item.progress>=(item.total||0))} aria-label={"Increase "+item.title+" progress"} onClick={()=>void setProgress(item,(item.progress||0)+1)}><Plus size={13}/></button>
      {item.status!=='completed'&&item.status!=='dropped'&&<button disabled={busy===item.id} onClick={()=>void change(item,{status:item.status==='paused'?'watching':'paused'})}><Pause size={13}/>{item.status==='paused'?'Resume':'Pause'}</button>}
    </div>
   </div>
  </article>;
 };

 const tabs:[string,string,number][]=[
  ['all','All',counts.all],['watching','Watching',counts.watching],['planned','Plan to Watch',counts.planned],
  ['completed','Completed',counts.completed],['paused','Paused',counts.paused],['dropped','Dropped',counts.dropped]
 ];

 return <div className="frame-my-dashboard">
  <header className="frame-my-header">
   <div><span className="library-kicker">MY ANIME / PERSONAL TRACKER</span><h1>My Anime</h1><p>Your watch queue, progress and completed shows in one place.</p></div>
   <button className="library-add-v3" onClick={add}><Plus size={17}/> Add anime</button>
  </header>

  <section className="frame-my-stats">
   <div><b>{counts.all}</b><span>Total</span></div><div><b>{counts.watching}</b><span>Watching</span></div><div><b>{counts.planned}</b><span>Planned</span></div><div><b>{counts.completed}</b><span>Completed</span></div><div><b>{counts.paused}</b><span>Paused</span></div><div><b>{counts.dropped}</b><span>Dropped</span></div>
  </section>

  {active.length>0&&<section className="frame-my-continue">
   <div className="frame-my-section-head"><div><span>CONTINUE</span><h2>Pick up where you left off</h2></div><small>{active.length} active</small></div>
   <div className="frame-my-continue-row">{active.slice(0,4).map(item=><button key={item.id} onClick={()=>open(item)}>
    <FrameArtwork title={item.title} medium={item.medium} poster={item.poster} anilistId={item.anilistId} alt="" loading="lazy"/>
    <span><b>{item.title}</b><small>Episode {nextEpisode(item)} next</small><i><em style={{width:pct(item)+'%'}}/></i></span><ChevronRight size={15}/>
   </button>)}</div>
  </section>}

  <div className="frame-my-toolbar">
   <div className="frame-my-tabs">{tabs.map(([id,label,count])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}<b>{count}</b></button>)}</div>
   <div className="frame-my-tools"><label><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search my anime…"/></label><select value={sort} onChange={e=>setSort(e.target.value)}><option value="updated">Recent</option><option value="progress">Progress</option><option value="score">Score</option><option value="title">Title</option><option value="year">Year</option><option value="popularity">Popularity</option><option value="release">Release date</option></select></div>
  </div>

  <div className="frame-my-results-head"><span>{visible.length} {visible.length===1?'title':'titles'}</span>{tab!=='all'&&<button onClick={()=>setTab('all')}>Clear filter</button>}</div>
  {visible.length?<div className="frame-my-grid">{visible.map(item=><Card key={item.id} item={item}/>)}</div>:
   <div className="frame-my-empty"><Clock3 size={25}/><b>{query?'No anime found':'Nothing here yet'}</b><span>{query?'Try another title or genre.':tab==='planned'?'Add shows you want to watch next.':'Titles will appear here as you track them.'}</span>{tab==='all'&&<button onClick={add}><Plus size={15}/> Add anime</button>}</div>}
 </div>;
}

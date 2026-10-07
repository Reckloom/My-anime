import {useEffect,useMemo,useState} from 'react';
import {Bot,CalendarDays,Compass,Globe,Library,MessageCircle,Phone,Search,Settings,Users,X} from 'lucide-react';

type Command={id:string;label:string;sub:string;icon:any;run:()=>void};

export function FrameCommandPalette({onGo,onFind,onClose}:{onGo:(page:string)=>void;onFind:()=>void;onClose:()=>void}){
 const[q,setQ]=useState(''),[active,setActive]=useState(0);const commands:Command[]=[
  {id:'home',label:'Home',sub:'Open your dashboard',icon:Globe,run:()=>onGo('home')},
  {id:'library',label:'Library',sub:'Browse and filter your media',icon:Library,run:()=>onGo('library')},
  {id:'discover',label:'Discover',sub:'Find something new',icon:Compass,run:()=>onGo('discover')},
  {id:'search',label:'Universal search',sub:'Search every supported catalogue',icon:Search,run:onFind},
  {id:'radar',label:'Release Radar',sub:'Upcoming tracked releases',icon:CalendarDays,run:()=>onGo('radar')},
  {id:'ai',label:'FRAME AI',sub:'Ask for recommendations or identification',icon:Bot,run:()=>onGo('ai')},
  {id:'friends',label:'Friends',sub:'Social connections and shared libraries',icon:Users,run:()=>onGo('friends')},
  {id:'chat',label:'Global Chat',sub:'Open the live community chat',icon:MessageCircle,run:()=>onGo('chat')},
  {id:'calls',label:'Calls',sub:'Voice rooms and direct calls',icon:Phone,run:()=>onGo('calls')},
  {id:'connections',label:'Connections',sub:'Account links and imports',icon:Globe,run:()=>onGo('connections')},
  {id:'settings',label:'Settings',sub:'Profile, logo, appearance and backup',icon:Settings,run:()=>onGo('settings')}
 ];
 const filtered=useMemo(()=>commands.filter(x=>(x.label+' '+x.sub).toLowerCase().includes(q.trim().toLowerCase())),[q]);
 useEffect(()=>{setActive(0)},[q]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){onClose();return}if(e.key==='ArrowDown'){e.preventDefault();setActive(v=>Math.min(v+1,Math.max(0,filtered.length-1)));return}if(e.key==='ArrowUp'){e.preventDefault();setActive(v=>Math.max(v-1,0));return}if(e.key==='Enter'&&filtered[active]){filtered[active].run();onClose()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[filtered,active,onClose]);
 useEffect(()=>document.getElementById('frame-command-input')?.focus(),[]);
 return <div className="frame-command-overlay" onMouseDown={e=>{if(e.currentTarget===e.target)onClose()}}><section className="frame-command"><header><Search size={17}/><input id="frame-command-input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search FRAME commands…"/><kbd>ESC</kbd><button onClick={onClose}><X size={16}/></button></header><div className="frame-command-list">{filtered.map((x,i)=>{const Icon=x.icon;return <button key={x.id} className={i===active?'selected':''} onMouseEnter={()=>setActive(i)} onClick={()=>{x.run();onClose()}}><Icon size={16}/><span><b>{x.label}</b><small>{x.sub}</small></span><kbd>{i===active?'↵':''}</kbd></button>})}{!filtered.length&&<div className="frame-command-empty">No FRAME command matches that.</div>}</div><footer><span>↑↓ navigate · Enter open · Esc close</span><span>Ctrl / ⌘ + K to open</span></footer></section></div>;
}

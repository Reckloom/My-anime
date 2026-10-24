import {useRef,useState} from 'react';
import {Download,Upload} from 'lucide-react';
import type {MediaItem} from '../types';

type Profile={id:string;username:string;display_name:string;avatar_url?:string|null;bio?:string;frame_logo?:string|null};
export function FrameDataTools({items,profile,preferences,onImport}:{items:MediaItem[];profile:Profile|null;preferences:Record<string,unknown>;onImport:(items:MediaItem[])=>void}){
 const input=useRef<HTMLInputElement>(null);const[msg,setMsg]=useState('');const[busy,setBusy]=useState(false);const[preview,setPreview]=useState<{count:number;invalid:number;duplicates:number}|null>(null);
 const exportData=()=>{const payload={format:'FRAME backup',version:1,exportedAt:new Date().toISOString(),profile,preferences,library:items};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='frame-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();window.setTimeout(()=>URL.revokeObjectURL(a.href),1000);setMsg('Backup exported.')};
 const importFile=async(file:File)=>{
  setBusy(true);setPreview(null);
  try{
   if(file.size>10*1024*1024)throw new Error('FRAME backups must be 10 MB or smaller.');
   const raw=JSON.parse(await file.text()) as any;
   if(raw?.format&&raw.format!=='FRAME backup')throw new Error('That file is not a FRAME backup.');
   const list=Array.isArray(raw?.library)?raw.library:[];
   if(!list.length)throw new Error('No FRAME library was found in that file.');
   const mediaTypes=new Set(['anime','manga','manhwa','light-novel','visual-novel','movie','series','game','book']);
   const statuses=new Set(['watching','reading','playing','completed','planned','paused','dropped']);
   const valid=list.filter((x:any)=>{
     if(!x||typeof x.title!=='string'||!x.title.trim()||typeof x.medium!=='string'||!mediaTypes.has(x.medium)||typeof x.status!=='string'||!statuses.has(x.status)||typeof x.progress!=='number'||!Number.isFinite(x.progress)||x.progress<0||x.progress>2000)return false;
     if(x.total!=null&&(!Number.isFinite(Number(x.total))||Number(x.total)<1||Number(x.total)>2000))return false;
     return true;
   }).map((x:any)=>({...x,title:String(x.title).trim(),id:typeof x.id==='string'&&x.id?x.id:crypto.randomUUID()})) as MediaItem[];
   if(!valid.length)throw new Error('The backup contains no valid FRAME media entries.');
   const key=(x:MediaItem)=>x.anilistId?'anilist:'+x.anilistId:x.sourceProvider&&x.externalId?x.sourceProvider+':'+x.externalId:'title:'+x.title.trim().toLowerCase();
   const existing=new Set(items.map(key));const seen=new Set<string>();let duplicates=0;
   valid.forEach(x=>{const k=key(x);if(existing.has(k)||seen.has(k))duplicates++;seen.add(k)});
   setPreview({count:valid.length,invalid:list.length-valid.length,duplicates});
   onImport(valid);setMsg(valid.length+' media entries imported. '+duplicates+' matched existing entries and will be merged safely.');

  }catch(e){setMsg(e instanceof Error?e.message:'That backup could not be imported.')}finally{setBusy(false)}
 };
 return <div className="data-tools"><div><b>Backup & restore</b><small>Keep an offline copy of your library and restore it on another device.</small></div><div><button className="secondary" type="button" onClick={exportData}><Download size={14}/>Export JSON</button><button className="secondary" type="button" onClick={()=>input.current?.click()} disabled={busy}>{busy?'Checking…':<><Upload size={14}/>Import JSON</>}</button><input ref={input} type="file" accept="application/json,.json" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void importFile(file);e.currentTarget.value=''}}/></div>{preview&&<small className="data-tools-message">Validated {preview.count} entries · {preview.invalid} invalid skipped · {preview.duplicates} existing/duplicate matches.</small>}{msg&&<small className="data-tools-message">{msg}</small>}</div>;
}

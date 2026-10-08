import {useState} from 'react';
import {Download,RefreshCw} from 'lucide-react';
import type {MediaItem,Status} from '../types';
import {aniList} from '../anilist';

type ImportedProps={onImport:(items:MediaItem[])=>void};
const statusMap:Record<string,Status>={CURRENT:'watching',COMPLETED:'completed',PAUSED:'paused',DROPPED:'dropped',PLANNING:'planned',REPEATING:'watching'};
const malStatusMap:Record<string,Status>={watching:'watching',completed:'completed',on_hold:'paused',dropped:'dropped',plan_to_watch:'planned',reading:'reading',plan_to_read:'planned'};

export function FrameLibraryImport({onImport}:ImportedProps){
 const[source,setSource]=useState<'anilist'|'mal'>('anilist'),[username,setUsername]=useState(''),[kind,setKind]=useState<'anime'|'manga'>('anime'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const importAniList=async()=>{const name=username.trim();if(!name){setMessage('Enter your AniList username.');return}setBusy(true);setMessage('Reading the public AniList library…');try{
  const QUERY=`query($user:String!,$type:MediaType!){MediaListCollection(userName:$user,type:$type){lists{entries{status progress score media{id type title{userPreferred english romaji native}description(asHtml:false)coverImage{extraLarge}bannerImage genres seasonYear averageScore episodes chapters volumes startDate{year}}}}}}`;
  const data=await aniList<any>(QUERY,{user:name,type:kind==='anime'?'ANIME':'MANGA'});const entries=(data.MediaListCollection?.lists||[]).flatMap((x:any)=>x.entries||[]);
  const list:MediaItem[]=entries.filter((e:any)=>e?.media?.id).map((e:any)=>{const m=e.media;const medium=kind==='anime'?'anime':'manga';const total=medium==='anime'?m.episodes||0:m.chapters||m.volumes||0;return {id:crypto.randomUUID(),anilistId:Number(m.id),sourceProvider:'anilist',externalId:String(m.id),title:m.title?.userPreferred||m.title?.english||m.title?.romaji||m.title?.native||'Untitled',alternativeTitles:[m.title?.english,m.title?.romaji,m.title?.native].filter(Boolean).map(String),description:String(m.description||''),poster:m.coverImage?.extraLarge||'',backdrop:m.bannerImage||'',medium,status:statusMap[String(e.status)]||'planned',progress:Number(e.progress||0),total:Number(total||0),year:m.seasonYear?Number(m.seasonYear):undefined,score:m.averageScore?Number(m.averageScore)/10:undefined,personalRating:e.score?Number(e.score)/10:undefined,genres:Array.isArray(m.genres)?m.genres.map(String):[],themes:[],favorite:false,nextRelease:undefined,nextReleaseNumber:undefined}});onImport(list);setMessage('Imported '+list.length+' '+kind+' entries from AniList.');  }catch(e){setMessage(e instanceof Error?e.message:'AniList import failed.')}finally{setBusy(false)}}; const importMal=async()=>{const name=username.trim();if(!name){setMessage('Enter your MyAnimeList username.');return}setBusy(true);setMessage('Reading the public MyAnimeList library…');try{
  const url=`https://api.jikan.moe/v4/users/${encodeURIComponent(name)}/${kind==='anime'?'animelist':'mangalist'}?limit=300`;
  const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),15000);
  const r=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
  window.clearTimeout(timer);
  const j=await r.json().catch(()=>({}));
  if(r.status===429)throw new Error('MyAnimeList is rate-limiting this import. Wait a moment and try again.');
  if(!r.ok)throw new Error(j?.message||`MyAnimeList import failed (HTTP ${r.status}).`);const list:MediaItem[]=(j.data||[]).map((row:any)=>{const m=row.node||{};const s=String(row.status||'plan_to_watch');const medium=kind==='anime'?'anime':'manga';const total=medium==='anime'?Number(m.episodes||0):Number(m.chapters||0);return {id:crypto.randomUUID(),sourceProvider:'myanimelist',externalId:String(m.mal_id||''),title:String(m.title||'Untitled'),alternativeTitles:[],description:'Imported from MyAnimeList.',poster:m.images?.jpg?.large_image_url||m.images?.jpg?.image_url||'',backdrop:'',medium,status:malStatusMap[s]||'planned',progress:Number(row.progress||0),total,year:undefined,score:m.score==null?undefined:Number(m.score)/10,personalRating:row.score?Number(row.score)/10:undefined,genres:[],themes:[],favorite:false}});onImport(list);setMessage('Imported '+list.length+' '+kind+' entries from MyAnimeList.');  }catch(e){setMessage(e instanceof DOMException&&e.name==='AbortError'?'MyAnimeList import timed out.':e instanceof Error?e.message:'MyAnimeList import failed.')}finally{setBusy(false)}}; return <section className="connections-section import-section">
  <div className="connections-section-head">
    <div><small>LIBRARY MIGRATION</small><h2>Import an existing library</h2></div>
    <span>Non-destructive merge</span>
  </div>
  <div className="import-grid">
    <div className="import-form-grid">
      <label>
        <span>Source</span>
        <select value={source} onChange={e=>{setSource(e.target.value as 'anilist'|'mal');setMessage('')}}>
          <option value="anilist">AniList</option>
          <option value="mal">MyAnimeList</option>
        </select>
      </label>
      <label>
        <span>{source==='anilist'?'AniList username':'MyAnimeList username'}</span>
        <input value={username} onChange={e=>{setUsername(e.target.value);setMessage('')}} placeholder="Enter username" autoComplete="off"/>
      </label>
      <label>
        <span>Media type</span>
        <select value={kind} onChange={e=>{setKind(e.target.value as 'anime'|'manga');setMessage('')}}>
          <option value="anime">Anime</option>
          <option value="manga">Manga</option>
        </select>
      </label>
      <button className="primary import-submit" disabled={busy} onClick={()=>void (source==='anilist'?importAniList():importMal())}>
        {busy?<><RefreshCw className="spin"/>Importing…</>:<><Download size={15}/>Import library</>}
      </button>
      <p className="import-note">Your existing FRAME ratings, notes, progress and favorites stay in place when a matching title is found.</p>
    </div>
    <div className="import-benefits">
      <div className="import-benefits-head"><Download size={15}/><b>What FRAME imports</b></div>
      <span>Title, poster and source metadata</span>
      <span>Watching / completed / planned status</span>
      <span>Your external progress and ratings</span>
      <span>Duplicates merged instead of copied twice</span>
    </div>
  </div>
  {message&&<div className={'import-message '+(message.toLowerCase().includes('imported')?'success':'error')} role="status">{message}</div>}
 </section>;
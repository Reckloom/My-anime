import {useEffect,useState} from 'react';
import {ChevronLeft,ChevronRight,ExternalLink,Pause,Play,Search,SkipBack,SkipForward,Volume2} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Track={name:string;artists:{name:string}[];uri:string;album?:{images?:{url:string}[]}};
type Player={is_playing:boolean;item?:Track|null;progress_ms?:number;item_duration_ms?:number;device?:{name:string;volume_percent?:number}|null};

async function spotifyRequest(path:string,token:string,init?:RequestInit){
 const response=await fetch('https://api.spotify.com/v1'+path,{...init,headers:{...(init?.headers||{}),Authorization:'Bearer '+token,'Content-Type':'application/json'}});
 if(response.status===204)return null;
 const text=await response.text();
 let data:any=null;try{data=text?JSON.parse(text):null}catch{}
 if(!response.ok)throw new Error(String(data?.error?.message||('Spotify request failed (HTTP '+response.status+').')));
 return data;
}

export function FrameSpotifyControls({connected}:{connected:boolean}){
 const [token,setToken]=useState(''),[player,setPlayer]=useState<Player|null>(null),[query,setQuery]=useState(''),[tracks,setTracks]=useState<Track[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const getToken=async()=>{
  if(!supabase)return '';
  const {data}=await supabase.auth.getSession();
  return data.session?.provider_token||'';
 };
 const refresh=async()=>{
  try{
   const t=token||await getToken();if(!t){setError('Reconnect Spotify so FRAME can request playback access.');return}
   setToken(t);setPlayer(await spotifyRequest('/me/player',t));
  }catch(e){setError(e instanceof Error?e.message:'Spotify playback is unavailable.')}
 };
 useEffect(()=>{if(connected)void refresh();},[connected]);
 useEffect(()=>{if(!token)return;const t=window.setInterval(()=>void refresh(),6000);return()=>window.clearInterval(t)},[token]);
 const control=async(path:string,method='POST',body?:unknown)=>{
  try{setBusy(true);setError('');const t=token||await getToken();if(!t)throw new Error('Reconnect Spotify to enable playback controls.');setToken(t);await spotifyRequest(path,t,{method,body:body?JSON.stringify(body):undefined});await refresh();}catch(e){setError(e instanceof Error?e.message:'Spotify control failed.')}finally{setBusy(false)}
 };
 const search=async()=>{
  try{setError('');const q=query.trim();if(q.length<2)return;const t=token||await getToken();if(!t)throw new Error('Reconnect Spotify to search and play tracks.');setToken(t);const d=await spotifyRequest('/search?type=track&limit=8&q='+encodeURIComponent(q),t);setTracks((d?.tracks?.items||[]) as Track[]);}
  catch(e){setError(e instanceof Error?e.message:'Spotify search failed.')}
 };
 const play=(uri?:string)=>void control('/me/player/play','PUT',uri?{uris:[uri]}:undefined);
 if(!connected)return null;
 return <section className="spotify-control-panel">
  <header><div><small>SPOTIFY</small><h2>Playback</h2><span>Live controls for your active Spotify device.</span></div><a href="https://open.spotify.com/" target="_blank" rel="noreferrer"><ExternalLink size={14}/>Open Spotify</a></header>
  {error&&<div className="inline-error">{error}</div>}
  <div className="spotify-now"><div className="spotify-cover">{player?.item?.album?.images?.[0]?.url&&<img src={player.item.album.images[0].url} alt="" />}</div><div><b>{player?.item?.name||'Nothing playing'}</b><span>{player?.item?.artists?.map(x=>x.name).join(', ')||'Choose a track below'}</span><small>{player?.device?.name?player.device.name+' · '+(player.device.volume_percent??'—')+'% volume':'Spotify device not active'}</small></div></div>
  <div className="spotify-controls"><button className="secondary" disabled={busy} onClick={()=>void control('/me/player/previous')}><SkipBack size={16}/></button><button className="primary spotify-play" disabled={busy} onClick={()=>void control(player?.is_playing?'/me/player/pause':'/me/player/play','PUT')}>{player?.is_playing?<Pause size={17}/>:<Play size={17}/>}</button><button className="secondary" disabled={busy} onClick={()=>void control('/me/player/next')}><SkipForward size={16}/></button><label><Volume2 size={15}/><input type="range" min="0" max="100" value={player?.device?.volume_percent??50} onChange={e=>void control('/me/player/volume?volume_percent='+Number(e.target.value),'PUT')}/></label></div>
  <form className="spotify-search" onSubmit={e=>{e.preventDefault();void search()}}><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a Spotify track…"/><button className="secondary">Search</button></form>
  {tracks.length>0&&<div className="spotify-results">{tracks.map(t=><button className="spotify-result" key={t.uri} onClick={()=>void play(t.uri)}><span>{t.name}</span><small>{t.artists.map(a=>a.name).join(', ')}</small><Play size={13}/></button>)}</div>}
  <p className="spotify-note">Spotify playback controls require the OAuth playback scopes and an eligible Spotify Premium account/device. FRAME keeps the provider token in memory and never stores it in your library.</p>
 </section>;
}

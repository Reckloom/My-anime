import {useEffect,useMemo,useState} from 'react';
import {ExternalLink,Search,Users,X} from 'lucide-react';

type NarutoCharacter={name:string;role:string;affiliation:string;bio:string;ability:string;image?:string;description?:string};
const seed:Omit<NarutoCharacter,'image'|'description'>[]=[
 {name:'Naruto Uzumaki',role:'Seventh Hokage',affiliation:'Konohagakure',bio:'A determined ninja who grew from an isolated troublemaker into the village’s hero.',ability:'Shadow Clone Technique; Rasengan; Six Paths power'},
 {name:'Sasuke Uchiha',role:'Shinobi / protector',affiliation:'Uchiha clan; Konohagakure',bio:'A gifted survivor of the Uchiha clan whose pursuit of power shapes much of the story.',ability:'Sharingan; Rinnegan; Chidori'},
 {name:'Sakura Haruno',role:'Medical ninja',affiliation:'Team 7; Konohagakure',bio:'A highly skilled medical ninja with extraordinary chakra control and strength.',ability:'Medical ninjutsu; Strength of a Hundred Seal'},
 {name:'Kakashi Hatake',role:'Sixth Hokage',affiliation:'Team 7; Konohagakure',bio:'A renowned copy ninja and Team 7 mentor known for calm judgement and tactical skill.',ability:'Lightning Blade; Sharingan techniques'},
 {name:'Itachi Uchiha',role:'Shinobi; former ANBU',affiliation:'Uchiha clan; Akatsuki',bio:'A prodigy whose actions conceal a complicated history and painful loyalties.',ability:'Sharingan; Tsukuyomi; Amaterasu'},
 {name:'Minato Namikaze',role:'Fourth Hokage',affiliation:'Konohagakure',bio:'The Yellow Flash of the Leaf, famed for speed, sealing techniques and sacrifice.',ability:'Flying Thunder God; Rasengan'},
 {name:'Jiraiya',role:'Sannin; mentor',affiliation:'Konohagakure',bio:'A legendary ninja, writer and mentor who helps shape Naruto’s path.',ability:'Sage Mode; Rasengan; summoning'},
 {name:'Tsunade',role:'Fifth Hokage',affiliation:'Konohagakure; Senju clan',bio:'A legendary medical ninja whose leadership and strength protect the village.',ability:'Medical ninjutsu; Strength of a Hundred Seal'},
 {name:'Orochimaru',role:'Former Sannin',affiliation:'Sound Village; former Konoha',bio:'A brilliant but dangerous researcher obsessed with forbidden techniques and immortality.',ability:'Body modification; snake techniques'},
 {name:'Shikamaru Nara',role:'Strategist; adviser',affiliation:'Nara clan; Konohagakure',bio:'A gifted tactician whose shadow techniques and planning make him indispensable.',ability:'Shadow Possession techniques'},
 {name:'Hinata Hyuga',role:'Kunoichi',affiliation:'Hyuga clan; Konohagakure',bio:'A kind-hearted ninja who develops confidence and formidable close-combat skills.',ability:'Byakugan; Gentle Fist'},
 {name:'Rock Lee',role:'Taijutsu specialist',affiliation:'Team Guy; Konohagakure',bio:'A hard-working ninja who proves dedication can overcome a lack of ninjutsu talent.',ability:'Taijutsu; Eight Gates'},
 {name:'Might Guy',role:'Jonin',affiliation:'Team Guy; Konohagakure',bio:'An exuberant taijutsu master whose discipline and resolve make him legendary.',ability:'Eight Gates'},
 {name:'Gaara',role:'Fifth Kazekage',affiliation:'Sunagakure',bio:'Once feared as a weapon, he grows into a respected leader and Naruto’s ally.',ability:'Sand manipulation; sealing'},
 {name:'Shikaku Nara',role:'Strategist',affiliation:'Nara clan; Allied Shinobi Forces',bio:'A respected planner whose calm intelligence helps coordinate the shinobi alliance.',ability:'Shadow techniques; strategy'},
 {name:'Madara Uchiha',role:'Legendary shinobi',affiliation:'Uchiha clan',bio:'One of the founders of Konoha whose vision for peace turns into a world-changing conflict.',ability:'Eternal Mangekyo Sharingan; Susanoo'},
 {name:'Obito Uchiha',role:'Shinobi; masked figure',affiliation:'Uchiha clan; Akatsuki',bio:'A former idealistic ninja whose choices become central to the Fourth Shinobi World War.',ability:'Kamui; Sharingan techniques'},
 {name:'Pain (Nagato)',role:'Akatsuki leader',affiliation:'Amegakure; Akatsuki',bio:'A war-scarred leader who seeks peace through a severe and destructive philosophy.',ability:'Rinnegan; Six Paths of Pain'},
 {name:'Konan',role:'Akatsuki member',affiliation:'Amegakure; Akatsuki',bio:'A founding member of the original trio from Amegakure and a master of paper techniques.',ability:'Paper ninjutsu'},
 {name:'Killer B',role:'Jinchuriki; rapper',affiliation:'Kumogakure',bio:'The upbeat Eight-Tails jinchuriki and a powerful swordsman who helps Naruto.',ability:'Eight-Tails; seven-sword style'},
 {name:'Kurama',role:'Nine-Tailed Fox',affiliation:'Tailed beasts',bio:'The Nine-Tailed beast whose bond with Naruto changes both of their lives.',ability:'Tailed-beast chakra; Tailed Beast Ball'},
 {name:'Hashirama Senju',role:'First Hokage',affiliation:'Senju clan; Konohagakure',bio:'The First Hokage and co-founder of Konoha, remembered for immense vitality and Wood Release.',ability:'Wood Release; Sage Mode'},
 {name:'Tobirama Senju',role:'Second Hokage',affiliation:'Senju clan; Konohagakure',bio:'A pragmatic Hokage who developed influential techniques and institutions.',ability:'Flying Thunder God; Shadow Clone'},
 {name:'Hiruzen Sarutobi',role:'Third Hokage',affiliation:'Konohagakure',bio:'A veteran leader known as the Professor for his mastery of many techniques.',ability:'Five nature transformations; Enma'},
 {name:'Deidara',role:'Akatsuki member',affiliation:'Akatsuki; former Iwagakure',bio:'An explosive artist who views battle as a fleeting work of art.',ability:'Explosive clay'},
 {name:'Kisame Hoshigaki',role:'Akatsuki member',affiliation:'Akatsuki; former Kirigakure',bio:'A powerful swordsman known for enormous chakra reserves and Samehada.',ability:'Water Release; Samehada'},
 {name:'Shisui Uchiha',role:'Uchiha prodigy',affiliation:'Uchiha clan; ANBU',bio:'A gifted shinobi whose genjutsu and loyalty deeply affect Itachi’s story.',ability:'Body Flicker; Kotoamatsukami'},
 {name:'Temari',role:'Jonin; diplomat',affiliation:'Sunagakure; Kazekage family',bio:'A confident wind-style specialist and skilled strategist from the Sand Village.',ability:'Wind Release; giant fan'},
 {name:'Kaguya Otsutsuki',role:'Ancient chakra progenitor',affiliation:'Otsutsuki clan',bio:'An ancient figure whose arrival is tied to the origin of chakra on Earth.',ability:'Byakugan; Rinne Sharingan; dimensional techniques'},
 {name:'Kushina Uzumaki',role:'Former Nine-Tails jinchuriki',affiliation:'Uzumaki clan; Konohagakure',bio:'Naruto’s mother, remembered for fierce determination and powerful chakra chains.',ability:'Adamantine Sealing Chains'}
];
const queryFor=(name:string)=>'https://www.google.com/search?q='+encodeURIComponent(name+' Naruto character');
function NarutoPortrait({character,large=false}:{character:NarutoCharacter;large?:boolean}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[character.image,character.name]);
 const initials=character.name.split(/\\s+/).map(x=>x[0]).slice(0,2).join('');
 if(character.image&&!failed)return <img src={character.image} alt={character.name} loading="lazy" onError={()=>setFailed(true)}/>;
 return <span className={'naruto-character-initials'+(large?' large':'')} style={{display:'grid',placeItems:'center',width:large?150:'100%',height:large?190:'100%',minHeight:large?190:170,fontSize:large?'2.5rem':'2.1rem',fontWeight:800,letterSpacing:'.08em',background:'linear-gradient(145deg,#172a46,#30204b 58%,#0b111f)',color:'#f5f3ff'}}>{initials}</span>;
}
export function FrameNarutoCharacterArchive(){
 const [query,setQuery]=useState('');
 const [characters,setCharacters]=useState<NarutoCharacter[]>(()=>seed);
 const [selected,setSelected]=useState<NarutoCharacter|null>(null);
 useEffect(()=>{
  let active=true;
  const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  const request=async()=>{
   // Small independent batches prevent one rejected character query from
   // discarding every portrait in the archive.
   const resolved:Record<number,{image?:string;description?:string}>={};
   for(let start=0;start<seed.length;start+=5){
    if(!active)return;
    const batch=seed.slice(start,start+5);
    const aliases=batch.map((c,offset)=>'c'+(start+offset)+': Character(search: '+JSON.stringify(c.name)+', sort: SEARCH_MATCH) { name { full } image { large } description(asHtml: false) }').join('\n');
    try{
     const response=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:'query { '+aliases+' }'})});
     if(!response.ok)continue;
     const json=await response.json() as {data?:Record<string,{name?:{full?:string};image?:{large?:string};description?:string}|null>};
     for(let offset=0;offset<batch.length;offset++){
      const result=json.data?.['c'+(start+offset)];
      if(normalize(result?.name?.full||'')!==normalize(batch[offset].name))continue;
      resolved[start+offset]={
       image:result?.image?.large||undefined,
       description:String(result?.description||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()||undefined
      };
     }
    }catch{/* Preserve successful batches when AniList is temporarily unavailable. */}
   }
   if(!active)return;
   setCharacters(seed.map((c,i)=>({...c,...resolved[i]})));
  };
  void request();return()=>{active=false};
 },[]);
 const visible=useMemo(()=>{const q=query.trim().toLowerCase();return characters.filter(c=>!q||[c.name,c.role,c.affiliation,c.bio,c.ability].join(' ').toLowerCase().includes(q))},[characters,query]);
 return <section className="frame-character-archive">
  <div className="frame-character-head"><div><small>CHARACTER ARCHIVE</small><h3><Users size={18}/> Naruto characters</h3><p>Search the ninja world · tap any card for the character file</p></div><span className="frame-character-count">{visible.length} / {characters.length}</span></div>
  <label className="frame-character-search"><Search size={16}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search characters, villages, abilities…" aria-label="Search Naruto characters"/>{query&&<button type="button" onClick={()=>setQuery('')} aria-label="Clear character search"><X size={15}/></button>}</label>
  <div className="frame-character-rail" aria-label="Horizontally scrolling Naruto character profiles">{visible.map(c=><article className="frame-character-card" key={c.name} role="button" tabIndex={0} onClick={()=>setSelected(c)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(c)}}} aria-label={'Open details for '+c.name}>
   <div className="frame-character-portrait"><NarutoPortrait character={c}/><span className="frame-character-open"><Users size={13}/> View profile</span></div>
   <div className="frame-character-copy"><a className="frame-character-name" href={queryFor(c.name)} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>{c.name}<ExternalLink size={13}/></a><span className="frame-character-alias">{c.affiliation}</span><div className="frame-character-role">{c.role}</div><p>{c.bio}</p><span className="frame-character-tap">Tap card for facts <span>↗</span></span></div>
  </article>)}</div><div className="frame-character-rail-hint"><span>← Swipe to explore →</span><span>{visible.length} profiles</span></div>
  <p className="frame-character-source">Character portraits are matched by exact name through AniList; when artwork cannot be verified, FRAME shows a name monogram instead of an unrelated anime poster.</p>
  {selected&&<div className="frame-character-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><section className="frame-character-modal" role="dialog" aria-modal="true" aria-label={selected.name+' character details'}>
   <button className="frame-character-modal-close" type="button" onClick={()=>setSelected(null)} aria-label="Close character details"><X size={19}/></button>
   <div className="frame-character-modal-hero"><NarutoPortrait character={selected} large/><div><small>NARUTO · CHARACTER FILE</small><h2>{selected.name}</h2><p>{selected.role}</p><span className="frame-character-modal-affiliation">{selected.affiliation}</span><a className="frame-character-google" href={queryFor(selected.name)} target="_blank" rel="noreferrer">Search exact character name <ExternalLink size={13}/></a></div></div>
   <div className="frame-character-fact-grid"><div><span>Village / affiliation</span><b>{selected.affiliation}</b></div><div><span>Role</span><b>{selected.role}</b></div><div><span>Signature abilities</span><b>{selected.ability}</b></div><div><span>Character summary</span><b>{selected.bio}</b></div></div>
   {selected.description&&<p className="frame-character-modal-bio">{selected.description}</p>}
  </section></div>}
 </section>;
}

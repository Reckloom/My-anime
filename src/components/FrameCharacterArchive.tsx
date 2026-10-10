import {useEffect,useMemo,useState} from 'react';
import {ExternalLink,Search,Users,X,CalendarDays,Mic2} from 'lucide-react';

type Character={id:number;name:string;alias:string;role:string;crew:string;bio:string;goal:string};
const rows=[
[1,'Monkey D. Luffy','Straw Hat','Captain','Straw Hat Pirates','The upbeat captain who can stretch his body after eating a Devil Fruit. He values freedom and his friends above fame.','Become King of the Pirates'],
[2,'Roronoa Zoro','Pirate Hunter','Swordsman','Straw Hat Pirates','A focused swordsman known for his Three-Sword Style and unwavering loyalty.','Become the world’s greatest swordsman'],
[3,'Nami','Cat Burglar','Navigator','Straw Hat Pirates','A clever navigator, weather expert and cartographer who guides the crew across the seas.','Draw a map of the entire world'],
[4,'Usopp','God Usopp','Sniper and inventor','Straw Hat Pirates','A creative marksman who relies on clever tools, stories and improvisation.','Become a brave warrior of the sea'],
[5,'Sanji','Stealth Black / Soba Mask','Cook','Straw Hat Pirates','The crew’s cook, known for his culinary skill and kick-focused style.','Find the All Blue'],
[6,'Tony Tony Chopper','Cotton Candy Lover','Doctor','Straw Hat Pirates','A reindeer with human-like traits who combines medical knowledge with special transformations.','Become a doctor who can cure any disease'],
[7,'Nico Robin','Devil Child','Archaeologist','Straw Hat Pirates','A calm scholar who can read Poneglyphs and uncover fragments of lost history.','Discover the true history of the world'],
[8,'Franky','Cyborg','Shipwright','Straw Hat Pirates','A cyborg shipwright and inventor who built the Thousand Sunny.','Build a ship that reaches the end of the world'],
[9,'Brook','Soul King','Musician','Straw Hat Pirates','A living skeleton and musician whose Devil Fruit brought him back to life.','Reunite with Laboon'],
[10,'Jinbe','Knight of the Sea','Helmsman','Straw Hat Pirates','A fish-man and experienced helmsman known for calm judgement and honour.','Help humans and fish-men coexist'],
[11,'Nefertari Vivi','Princess Vivi','Princess','Alabasta; former Straw Hat companion','The compassionate princess who travelled with the Straw Hats to protect Alabasta.','Protect Alabasta and its people'],
[12,'Portgas D. Ace','Fire Fist','Pirate commander','Whitebeard Pirates; formerly Spade Pirates','Luffy’s sworn older brother, remembered for his warmth and devotion to family.','Live freely and honour his family'],
[13,'Sabo','Chief of Staff','Revolutionary leader','Revolutionary Army','Luffy and Ace’s sworn brother who works to challenge oppression.','Fight for freedom and protect his brothers’ legacy'],
[14,'Yamato','Oni Princess','Wano warrior','Wano','A powerful Wano native inspired by Kozuki Oden’s journals and ideals.','Follow Oden’s path and explore the world'],
[15,'Trafalgar D. Water Law','Surgeon of Death','Captain and doctor','Heart Pirates','A strategic pirate and surgeon whose Devil Fruit creates a space for precise operations.','Uncover the meaning of the Will of D.'],
[16,'Eustass Kid','Captain Kid','Pirate captain','Kid Pirates','An ambitious captain who uses magnetic abilities to manipulate metal.','Reach the top of the pirate world'],
[17,'Boa Hancock','Pirate Empress','Captain','Kuja Pirates; Amazon Lily','The ruler of Amazon Lily, known for confidence, Haki and a petrification ability.','Protect Amazon Lily and her loved ones'],
[18,'Carrot','Mink warrior','Scout','Mokomo Dukedom','An energetic rabbit mink with exceptional agility and sharp senses.','Carry Pedro’s hopes forward'],
[19,'Gol D. Roger','Pirate King','Pirate captain','Roger Pirates','The legendary pirate who reached the final island and began a new era of piracy.','Reach the end of the Grand Line'],
[20,'Edward Newgate','Whitebeard','Pirate captain','Whitebeard Pirates','A legendary pirate who treated his crew as family.','Have a family'],
[21,'Monkey D. Garp','Hero of the Marines','Vice admiral','Marines','A famously powerful Marine and Luffy’s grandfather with an unconventional attitude.','Serve his own idea of justice'],
[22,'Shanks','Red-Haired','Pirate captain','Red-Haired Pirates','The captain who inspired Luffy’s dream and entrusted him with the straw hat.','See the next generation shape the era'],
[23,'Kaido','Strongest Creature','Pirate emperor','Beasts Pirates','A fearsome emperor known for extraordinary durability and a dragon form.','Create a world where the strong can live freely'],
[24,'Charlotte Linlin (Big Mom / Olin)','Big Mom','Pirate emperor','Big Mom Pirates','The ruler of Totto Land who can manipulate souls and leads a vast family.','Build a kingdom for every race'],
[25,'Marshall D. Teach','Blackbeard','Pirate emperor','Blackbeard Pirates','A calculating pirate whose ambitions make him a major force in the New World.','Claim the freedom and power he seeks'],
[26,'Silvers Rayleigh','Dark King','Former first mate','Roger Pirates','Roger’s former right-hand man, now retired, renowned for his Haki and wisdom.','Live freely after the crew’s journey'],
[27,'Kozuki Oden','Lord of Kuri','Samurai and daimyo','Kozuki Family; Whitebeard and Roger Pirates','A bold samurai whose voyages shaped his vision for Wano’s future.','Open Wano’s borders'],
[28,'Marco','Phoenix','Doctor and commander','Whitebeard Pirates','A calm veteran who can transform into a phoenix and regenerate with blue flames.','Protect the Whitebeard family'],
[29,'Benn Beckman','Red-Haired first mate','First mate','Red-Haired Pirates','Shanks’s trusted first mate, known for intelligence and composure.','Support the Red-Haired crew'],
[30,'King','King the Wildfire','All-Star','Beasts Pirates; Lunarian','A powerful Lunarian known for flame, flight and remarkable durability.','Support Kaido’s ambition'],
[31,'Charlotte Katakuri','Sweet Commander','Commander','Big Mom Pirates','A disciplined fighter with advanced Observation Haki who cares deeply for his siblings.','Protect his family'],
[32,'Sakazuki','Akainu','Fleet Admiral','Marines','A hard-line Marine leader who follows an uncompromising idea of Absolute Justice.','Enforce his view of justice'],
[33,'Borsalino','Kizaru','Admiral','Marines','An enigmatic admiral whose Devil Fruit grants light-based abilities.','Carry out Marine orders'],
[34,'Issho','Fujitora','Admiral','Marines','A blind swordsman and admiral who controls gravity and prioritises civilian safety.','Reform the world’s justice systems'],
[35,'Sengoku','Buddha','Former Fleet Admiral','Marines','A veteran strategist who can transform into a giant golden Buddha-like form.','Maintain order'],
[36,'Koby','Hero of the Marines','Marine officer','Marines; SWORD','A former cabin boy who trained hard and grew into a courageous Marine.','Become an admiral and help people'],
[37,'Kuzan','Aokiji','Former admiral','Former Marines; Blackbeard Pirates','A laid-back former admiral who can create and control ice.','Follow his own sense of justice'],
[38,'Buggy','Star Clown','Pirate captain','Cross Guild','A theatrical pirate whose public reputation often grows beyond his own plans.','Become a great pirate'],
[39,'Crocodile','Desert King','Pirate strategist','Cross Guild; formerly Baroque Works','A calculating former Warlord who controls sand and favours long-term schemes.','Gain influence and power'],
[40,'Enel','God','Former ruler','Formerly Skypiea','A self-proclaimed god with lightning powers and exceptional awareness.','Reach Fairy Vearth'],
[41,'Rob Lucci','CP0 agent','Cipher Pol agent','World Government; CP0','A highly trained government agent known for his strict loyalty to orders.','Carry out government orders'],
[42,'Gecko Moria','Shadow Master','Pirate captain','Thriller Bark Pirates','A shadow-manipulating pirate who commands a crew aboard Thriller Bark.','Build a powerful crew'],
[43,'Donquixote Doflamingo','Heavenly Demon','Pirate captain and former king','Donquixote Pirates','A manipulative former ruler who controls strings and built an underworld network.','Control the world around him'],
[44,'Dracule Mihawk','Hawk-Eyes','Master swordsman','Cross Guild; formerly Warlord','Widely recognised as the world’s greatest swordsman, he values skill and worthy rivals.','Remain at the pinnacle of swordsmanship'],
[45,'Donquixote Rosinante','Corazon','Marine undercover agent','Marines; Donquixote Family undercover','Doflamingo’s younger brother, remembered for his compassion toward Law.','Save Law from a tragic future'],
[46,'Perona','Ghost Princess','Pirate','Formerly Thriller Bark Pirates','A gothic-styled pirate who creates ghostly projections and has a dramatic personality.','Live comfortably with trusted companions'],
[47,'Shiki','Golden Lion','Pirate captain','Golden Lion Pirates','A legendary pirate from Roger’s era who can make objects and islands float.','Reshape the world through his plan'],
[48,'Zephyr','Z','Former Marine instructor','Neo Marines; Film Z','A film-original former Marine instructor whose story examines his strict ideals.','Pursue his vision of justice'],
[49,'Gild Tesoro','Gold King','Casino magnate','Gran Tesoro; Film Gold','A film-original character who controls gold and rules a vast entertainment ship.','Gain wealth and control'],
[50,'Uta','World’s Most Beloved Singer','Singer','Film Red; connected to Red-Haired Pirates','A singer whose extraordinary voice and music are central to Film Red.','Create a happier world through music'],
[51,'Kung-Fu Dugong','Kung-Fu Dugong','Martial-arts animal','Alabasta and other adventures','A seal-like animal known for martial arts and for respecting those who defeat it.','Keep training and improving']
 ,
[52,'Loki','Accursed Prince / Sun God','Prince of Elbaph','Warland Kingdom; Elbaph royal family','A giant prince tied to Elbaph’s royal history and the legendary Devil Fruit. He idolizes Rocks D. Xebec.','Pursue his own idea of the Sun God'],
[53,'Rocks D. Xebec','Captain of the Rocks Pirates','Legendary pirate captain','Rocks Pirates','The infamous captain who gathered future emperors and other legendary pirates under one flag. His ambition made him a major threat to the world order.','Become King of the World'],
[54,'King Harald','King of Elbaph','Former king','Elbaph royal family','A giant king whose choices shaped Elbaph’s modern history and the lives of Loki and Hajrudin.','Secure a future for Elbaph'],
[55,'Joy Boy','The First Pirate','Ancient legendary figure','Ancient Great Kingdom; Void Century','A figure from the Void Century associated with the ancient kingdom, a promise to Fish-Man Island, and a treasure left at the end of the Grand Line.','Fulfil the promise he left behind'],
[56,'Imu','Sovereign of the World','Hidden world ruler','World Government','The secretive authority at the top of the World Government, surrounded by mysteries about the Void Century.','Unknown'],
[57,'Davy D. Jones','Legendary Davy figure','Legendary figure','Davy Family lore','A legendary name connected to the Davy family’s history and the mysteries surrounding Rocks D. Xebec. Many details remain unconfirmed.','Unknown'],
[58,'Figarland Garling','Supreme Commander','World Noble leader','Figarland family; God’s Knights','A powerful figure associated with the God’s Knights and the God Valley incident.','Unknown'],
[59,'Scopper Gaban','Roger Pirates veteran','Veteran pirate','Roger Pirates','A veteran member of Roger’s crew who helped the Pirate King reach the final island.','Live freely after the great voyage'],
[60,'Captain John','Captain John','Pirate captain','Rocks Pirates','A notorious member of the Rocks Pirates whose hidden treasure became famous long after his era.','Amass treasure'],
[61,'Ochoku','Wang Zhi','Pirate leader','Rocks Pirates; Hachinosu','A powerful pirate associated with the Rocks Pirates and the later struggle for control of Hachinosu.','Unknown'],
[62,'Buckingham Stussy','Miss Buckingham Stussy','Former Rocks Pirate','Rocks Pirates; MADS connections','A former member of the Rocks Pirates with a complicated history tied to scientific experiments and the underworld.','Secure her own interests'],
[63,'Gloriosa','Elder Nyon','Former Kuja empress','Kuja Pirates; Amazon Lily; formerly Rocks Pirates','A former empress of Amazon Lily who lived through the era of the Rocks Pirates.','Protect Amazon Lily'],
[64,'Streusen','Gourmet Knight','Chef and pirate','Big Mom Pirates; formerly Rocks Pirates','A chef and longtime associate of Big Mom who helped establish the crew’s early foundations.','Keep cooking and survive'],
[65,'Kong','Former Fleet Admiral','World Government commander','Marines; World Government','A senior military figure who served as Fleet Admiral before becoming Commander-in-Chief of the World Government’s armed forces.','Maintain military order'],
[66,'Shimotsuki Ryuma','Sword God','Legendary samurai','Wano; Shimotsuki family','A legendary samurai of Wano remembered as a national hero and an extraordinary swordsman.','Protect Wano’s honour'],
[67,'Fisher Tiger','Sun Pirates founder','Fish-man revolutionary','Sun Pirates','A fish-man who challenged slavery and founded the Sun Pirates. His actions inspired generations.','Free the oppressed'],
[68,'Kozuki Toki','Lady Toki','Kozuki family member','Kozuki family; Wano','A woman from the distant past whose ability to send people forward in time became crucial to Wano’s future.','Reach the future she believed in'],
[69,'Nefertari D. Lily','Queen Lily','Former queen','Nefertari family; Ancient World Government','The ancient queen of Alabasta whose choices are linked to the Poneglyphs and mysteries of the Void Century.','Unknown'],
[70,'Nika','Sun God','Mythic figure','Ancient legend','A liberating figure from legend associated with freedom, laughter, and the power later connected to the Hito Hito no Mi, Model: Nika.','Bring liberation to the oppressed'],
[71,'Zunesha','The Walking Elephant','Ancient giant elephant','Mokomo Dukedom; Zou','An enormous ancient elephant condemned to walk the seas, carrying the Mink homeland of Zou.','Continue its long journey'],
[72,'Neptune','King of the Ryugu Kingdom','King','Ryugu Kingdom; Fish-Man Island','The king of Fish-Man Island and father of Shirahoshi, involved in the long-standing promise tied to Joy Boy.','Protect his people and family']
] as const;
const characters:Character[]=rows.map(r=>({id:r[0],name:r[1],alias:r[2],role:r[3],crew:r[4],bio:r[5],goal:r[6]}));
const characterInitials=(name:string)=>name.split(/\s+/).map(x=>x[0]).slice(0,2).join('');
function CharacterPortrait({name,image,large=false}:{name:string;image?:string;large?:boolean}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[image,name]);
 if(image&&!failed)return <img src={image} alt={name} loading="lazy" onError={()=>setFailed(true)}/>;
 return <div className="character-art-fallback" aria-label={name+' portrait unavailable'} style={{display:'grid',placeItems:'center',width:large?150:'100%',height:large?190:'100%',minHeight:large?190:170,flexShrink:0,borderRadius:large?14:0,background:'linear-gradient(145deg,#172a46,#30204b 58%,#0b111f)',color:'#f5f3ff',fontSize:large?'2.3rem':'2rem',fontWeight:850,letterSpacing:'.08em',textShadow:'0 2px 14px #0008'}}>{characterInitials(name)}</div>;
}
const google=(name:string)=>'https://www.google.com/search?q='+encodeURIComponent(name);

export function FrameCharacterArchive(){
 const [query,setQuery]=useState('');
 const [selected,setSelected]=useState<Character|null>(null);
 const [portraits,setPortraits]=useState<Record<string,string>>({});
 useEffect(()=>{
  let active=true;
  const normalize=(value:string)=>value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'');
  const aliases:Record<string,string[]>={
   'Charlotte Linlin (Big Mom / Olin)':['Charlotte Linlin','Big Mom'],
   'Edward Newgate':['Edward Newgate','Whitebeard'],
   'Marshall D. Teach':['Marshall D. Teach','Blackbeard'],
   'Trafalgar D. Water Law':['Trafalgar D. Water Law','Trafalgar Law','Law'],
   'Donquixote Rosinante':['Donquixote Rosinante','Corazon'],
   'Monkey D. Garp':['Monkey D. Garp','Garp'],
   'Silvers Rayleigh':['Silvers Rayleigh','Rayleigh'],
   'Shimotsuki Ryuma':['Shimotsuki Ryuma','Ryuma'],
   'Figarland Garling':['Saint Figarland Garling','Figarland Garling'],
   'King Harald':['King Harald','Harald'],
   'Tony Tony Chopper':['Tony Tony Chopper','Chopper'],
   'Nefertari D. Lily':['Nefertari D. Lily','Nefertari Lily','Lily'],
   'Borsalino':['Borsalino','Kizaru'],
   'Sakazuki':['Sakazuki','Akainu'],
   'Kuzan':['Kuzan','Aokiji'],
   'Issho':['Issho','Fujitora'],
   'Charlotte Katakuri':['Charlotte Katakuri','Katakuri'],
   'Ochoku':['Ochoku','Wang Zhi'],
  };
  // Only query the character's own wiki page. Episode and technique pages
  // can return scene art, which is not a valid character portrait.
  const wikiTitle=(name:string)=>(aliases[name]?.[0]||name).replace(/ /g,'_');
  const load=async()=>{
   const result:Record<string,string>={};
   const titleOwners=new Map<string,string>();
   const requests=characters.map(character=>{
    const title=wikiTitle(character.name);
    titleOwners.set(normalize(title.replace(/_/g,' ')),character.name);
    return {character,title};
   });
   const wikiBatches=Array.from({length:Math.ceil(requests.length/35)},(_,i)=>requests.slice(i*35,(i+1)*35));
   const wikiResponses=await Promise.all(wikiBatches.map(async batch=>{
    try{
     const titles=batch.map(x=>x.title).join('|');
     const url='https://onepiece.fandom.com/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail%7Coriginal&pithumbsize=900&titles='+encodeURIComponent(titles)+'&origin=*';
     const response=await fetch(url,{headers:{Accept:'application/json'}});
     if(!response.ok)return null;
     return await response.json() as {query?:{normalized?:{from:string;to:string}[];redirects?:{from:string;to:string}[];pages?:Record<string,{title?:string;thumbnail?:{source?:string};original?:{source?:string}}>}};
    }catch{return null}
   }));
   const usedImages=new Set<string>();
   wikiResponses.forEach(json=>{
    if(!json)return;
    const canonicalOwners=new Map<string,string>(titleOwners);
    for(const entry of json.query?.normalized||[]){
     const owner=titleOwners.get(normalize(entry.from.replace(/_/g,' ')));
     if(owner)canonicalOwners.set(normalize(entry.to.replace(/_/g,' ')),owner);
    }
    for(const entry of json.query?.redirects||[]){
     const owner=canonicalOwners.get(normalize(entry.from.replace(/_/g,' ')))||titleOwners.get(normalize(entry.from.replace(/_/g,' ')));
     if(owner)canonicalOwners.set(normalize(entry.to.replace(/_/g,' ')),owner);
    }
    Object.values(json.query?.pages||{}).forEach(page=>{
     const owner=canonicalOwners.get(normalize((page.title||'').replace(/_/g,' ')));
     const image=(page.original?.source||page.thumbnail?.source)?.replace(/\\_/g,'_');
     if(owner&&image&&!usedImages.has(image)){
      result[owner]=image;
      usedImages.add(image);
     }
    });
   });
   // AniList is an independent fallback. Fetch the missing character portraits
   // concurrently and reject duplicate image URLs so one character never gets
   // another character's artwork merely because a search result was ambiguous.
   const missing=characters.filter(character=>!result[character.name]);
   const anilistBatches=Array.from({length:Math.ceil(missing.length/10)},(_,i)=>missing.slice(i*10,(i+1)*10));
   const anilistResults=await Promise.all(anilistBatches.map(async batch=>{
    if(!batch.length)return [] as {character:Character;image:string;foundName:string;allowed:string[]}[];
    const fields=batch.map((character,index)=>{
     const search=(aliases[character.name]?.[0]||character.name).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
     return 'c'+index+': Character(search: "'+search+'", sort: SEARCH_MATCH) { name { full } image { large } }';
    }).join('\n');
    try{
     const response=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:'query { '+fields+' }'})});
     if(!response.ok)return [];
     const json=await response.json() as {data?:Record<string,{name?:{full?:string};image?:{large?:string}}|null>};
     return batch.flatMap((character,index)=>{
      const found=json.data?.['c'+index];
      const foundName=normalize(found?.name?.full||'');
      const allowed=[character.name,...(aliases[character.name]||[]),character.alias].map(normalize);
      const exact=allowed.includes(foundName);
      // Reject approximate matches: similar names can resolve to a different character.
      return found?.image?.large&&foundName&&exact?[{character,image:found.image.large,foundName,allowed}]:[];
     });
    }catch{return []}
   }));
   anilistResults.flat().forEach(({character,image})=>{
    if(!result[character.name]&&!usedImages.has(image)){
     result[character.name]=image;
     usedImages.add(image);
    }
   });
   // Last-resort source lookup for uncommon characters whose main wiki page
   // and AniList profile have no portrait. Search only the One Piece Wiki file
   // namespace, prefer anime/infobox images, and exclude fan art and merchandise.
   const stillMissing=characters.filter(character=>!result[character.name]);
   const searched=await Promise.all(stillMissing.map(async character=>{
    try{
     const query=(aliases[character.name]?.[0]||character.name)+' anime';
     const url='https://onepiece.fandom.com/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent(query)+'&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url&iiurlwidth=900&format=json&origin=*';
     const response=await fetch(url,{headers:{Accept:'application/json'}});
     if(!response.ok)return {character,image:''};
     const json=await response.json() as {query?:{pages?:Record<string,{title?:string;imageinfo?:{url?:string;thumburl?:string}[]}>}};
     const words=[...new Set([character.name,...(aliases[character.name]||[])].flatMap(value=>value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(word=>word.length>2&&!['one','piece','the','anime','portrait','character'].includes(word))))];
     const candidates=Object.values(json.query?.pages||{}).map(page=>{
      const title=page.title||'';
      const key=normalize(title);
      const image=(page.imageinfo?.[0]?.thumburl||page.imageinfo?.[0]?.url||'').replace(/\\_/g,'_');
      const matches=words.filter(word=>key.includes(normalize(word))).length;
      const score=matches+( /anime/i.test(title)?3:0)+( /infobox|portrait/i.test(title)?5:0);
      return {title,image,score,matches,required:words.length};
     }).filter(candidate=>candidate.image.startsWith('https://')&&candidate.matches===candidate.required&&candidate.score>0&&!/fan.?art|figure|statue|toy|plush|card|logo|icon|symbol|wanted|merch|cosplay|wallpaper|collectible|compared|versus|vs|group|crew|family|confronts|attacks|size|diagram|concept/i.test(candidate.title))
       .sort((a,b)=>b.score-a.score);
     return {character,image:candidates[0]?.image||''};
    }catch{return {character,image:''}}
   }));
   searched.forEach(({character,image})=>{
    if(image&&!result[character.name]&&!usedImages.has(image)){
     result[character.name]=image;
     usedImages.add(image);
    }
   });
   if(active)setPortraits(result);
  };
  void load();
  return()=>{active=false};
 },[]);
 const popularityOrder=["Sanji","Monkey D. Luffy","Roronoa Zoro","Nami","Trafalgar D. Water Law","Nico Robin","Portgas D. Ace","Shanks","Dracule Mihawk","Crocodile","Donquixote Rosinante","Boa Hancock","Tony Tony Chopper","Sabo","Uta","Carrot","Rocks D. Xebec","Yamato","Usopp","Loki","Donquixote Doflamingo","Eustass Kid","Perona","Buggy","Marco","Brook","Nefertari Vivi","Franky","Jinbe","Charlotte Katakuri","Rob Lucci","Edward Newgate","Koby","Monkey D. Garp","Kuzan","Benn Beckman","Silvers Rayleigh","King","Borsalino","Enel","Imu","Sakazuki","Gol D. Roger","Joy Boy","Marshall D. Teach","Charlotte Linlin (Big Mom / Olin)","Kaido","Gecko Moria","Kozuki Oden","Issho","Scopper Gaban","Shiki","Figarland Garling","King Harald","Shimotsuki Ryuma","Fisher Tiger","Captain John","Gloriosa","Zunesha","Kozuki Toki","Nika","Ochoku","Nefertari D. Lily","Neptune","Streusen","Kong","Buckingham Stussy"] as const;
 const visible=useMemo(()=>{const q=query.trim().toLowerCase();return characters.filter(c=>!q||[c.name,c.alias,c.role,c.crew,c.bio].join(' ').toLowerCase().includes(q)).sort((a,b)=>{const ai=popularityOrder.indexOf(a.name as typeof popularityOrder[number]),bi=popularityOrder.indexOf(b.name as typeof popularityOrder[number]);if(ai!==-1||bi!==-1)return (ai===-1?999:ai)-(bi===-1?999:bi);return a.id-b.id})},[query]);
 const displayRank=(name:string)=>{const rank=popularityOrder.indexOf(name as typeof popularityOrder[number]);return rank===-1?null:rank+1};
 const profiles:Record<string,{birthday:string;jp:string;en:string;age:string;height:string;fruit:string;first:string;facts:string[]}>={
 'Sanji':{birthday:'March 2',jp:'Hiroaki Hirata (adult); Ikue Ōtani (young)',en:'Eric Vale (Funimation); regional dubs vary',age:'21 after timeskip',height:'180 cm',fruit:'No confirmed Devil Fruit; kick-based Black Leg Style',first:'Episode 20 / manga chapter 43',facts:['Born Vinsmoke Sanji, third son of the Vinsmoke family.','Cook of the Straw Hat Pirates; trained by Zeff at the Baratie.','Dreams of finding the All Blue.','Keeps his hands for cooking and primarily fights with kicks.']},
 'Monkey D. Luffy':{birthday:'May 5',jp:'Mayumi Tanaka',en:'Colleen Clinkenbeard',age:'19 after timeskip',height:'174 cm',fruit:'Hito Hito no Mi, Model: Nika',first:'Episode 1 / manga chapter 1',facts:['Captain of the Straw Hat Pirates.','Shanks inspired his dream of becoming a pirate.','Wants to become King of the Pirates.']},
 'Roronoa Zoro':{birthday:'November 11',jp:'Kazuya Nakai',en:'Christopher R. Sabat',age:'21 after timeskip',height:'181 cm',fruit:'None',first:'Episode 2 / manga chapter 3',facts:['Swordsman of the Straw Hat Pirates.','Uses Three-Sword Style.','Aims to become the world’s greatest swordsman.']},
 'Nami':{birthday:'July 3',jp:'Akemi Okamura',en:'Luci Christian',age:'20 after timeskip',height:'170 cm',fruit:'None',first:'Episode 1 / manga chapter 8',facts:['Navigator of the Straw Hat Pirates.','Skilled cartographer and weather expert.','Dreams of mapping the entire world.']},
 'Usopp':{birthday:'April 1',jp:'Kappei Yamaguchi',en:'Sonny Strait',age:'19 after timeskip',height:'174 cm',fruit:'None',first:'Episode 8 / manga chapter 23',facts:['Sniper and inventive problem-solver.','Known for tall tales and improvisation.','Wants to become a brave warrior of the sea.']},
 'Tony Tony Chopper':{birthday:'December 24',jp:'Ikue Ōtani',en:'Brina Palencia',age:'17 after timeskip',height:'90 cm (standard form)',fruit:'Hito Hito no Mi',first:'Episode 81 / manga chapter 134',facts:['Reindeer and doctor of the crew.','Uses Rumble Balls for additional forms.','Dreams of curing every disease.']},
 'Nico Robin':{birthday:'February 6',jp:'Yuriko Yamaguchi',en:'Stephanie Young',age:'30 after timeskip',height:'188 cm',fruit:'Hana Hana no Mi',first:'Episode 67 / manga chapter 114',facts:['Archaeologist of the Straw Hat Pirates.','Can read Poneglyphs.','Seeks the true history of the world.']},
 'Franky':{birthday:'March 9',jp:'Kazuki Yao; Subaru Kimura in later episodes',en:'Patrick Seitz',age:'36 after timeskip',height:'240 cm',fruit:'None',first:'Episode 233 / manga chapter 329',facts:['Cyborg shipwright.','Built the Thousand Sunny.','Wants his ship to sail around the world.']},
 'Brook':{birthday:'April 3',jp:'Chō',en:'Ian Sinclair',age:'90 after timeskip',height:'277 cm',fruit:'Yomi Yomi no Mi',first:'Episode 337 / manga chapter 442',facts:['Musician and swordsman.','A living skeleton revived by his Devil Fruit.','Promises to reunite with Laboon.']},
 'Jinbe':{birthday:'April 2',jp:'Katsuhisa Hōki',en:'Daniel Baugh',age:'46 after timeskip',height:'301 cm',fruit:'None',first:'Episode 430 / manga chapter 528',facts:['Helmsman of the Straw Hat Pirates.','Master of Fish-Man Karate.','Former Warlord of the Sea.']},
 'Portgas D. Ace':{birthday:'January 1',jp:'Toshio Furukawa',en:'Travis Willingham',age:'20 at death',height:'185 cm',fruit:'Mera Mera no Mi (formerly)',first:'Episode 91 / manga chapter 154',facts:['Luffy’s sworn older brother.','Former commander of the Whitebeard Pirates.','Known as Fire Fist Ace.']},
 'Trafalgar D. Water Law':{birthday:'October 6',jp:'Hiroshi Kamiya',en:'Matthew Mercer',age:'26 after timeskip',height:'191 cm',fruit:'Ope Ope no Mi',first:'Episode 392 / manga chapter 498',facts:['Captain and doctor of the Heart Pirates.','Known as the Surgeon of Death.','Uses ROOM for spatial operations.']},
 'Shanks':{birthday:'March 9',jp:'Shūichi Ikeda',en:'Brandon Potter',age:'39',height:'199 cm',fruit:'None confirmed',first:'Episode 4 / manga chapter 1',facts:['Captain of the Red-Haired Pirates.','Inspired Luffy and entrusted him with his straw hat.','One of the Four Emperors.']},
 'Gol D. Roger':{birthday:'December 31',jp:'Chikao Ōtsuka; Masane Tsukayama in later portrayal',en:'Sean Hennigan',age:'53 at death',height:'274 cm',fruit:'None confirmed',first:'Episode 48 / manga chapter 96',facts:['Known as the Pirate King.','Reached the final island with his crew.','His execution began the Great Pirate Era.']},
 'Boa Hancock':{birthday:'September 2',jp:'Kotono Mitsuishi',en:'Lydia Mackay',age:'31 after timeskip',height:'191 cm',fruit:'Mero Mero no Mi',first:'Episode 409 / manga chapter 516',facts:['Empress of Amazon Lily.','Former Warlord of the Sea.','Known as the Pirate Empress.']},
 'Buggy':{birthday:'August 8',jp:'Shigeru Chiba',en:'Mike McFarland',age:'39',height:'192 cm',fruit:'Bara Bara no Mi',first:'Episode 4 / manga chapter 9',facts:['Flamboyant pirate with a long history around Shanks.','Associated with Cross Guild.','His reputation often exceeds his plans.']},
 'Dracule Mihawk':{birthday:'March 9',jp:'Hirohiko Kakegawa',en:'John Gremillion',age:'43',height:'198 cm',fruit:'None',first:'Episode 23 / manga chapter 49',facts:['Known as Hawk-Eyes.','Recognised as the world’s greatest swordsman.','A former Warlord of the Sea.']},
 'Koby':{birthday:'May 13',jp:'Mika Doi',en:'Micah Solusod',age:'18',height:'167 cm',fruit:'None',first:'Episode 1 / manga chapter 2',facts:['Started as a captive cabin boy.','Trained under Garp.','Aspires to become a great Marine.']},
 'Sakazuki':{birthday:'August 16',jp:'Fumihiko Tachiki',en:'Andrew Love',age:'55',height:'306 cm',fruit:'Magu Magu no Mi',first:'Episode 278 / manga chapter 397',facts:['Known as Akainu.','Fleet Admiral of the Marines.','Follows an uncompromising view of justice.']},
 'Borsalino':{birthday:'November 23',jp:'Ryōtarō Okiayu',en:'Ray Hurd',age:'58',height:'302 cm',fruit:'Pika Pika no Mi',first:'Episode 398 / manga chapter 504',facts:['Known as Kizaru.','Marine admiral.','Has light-based powers.']},
 'Kuzan':{birthday:'September 21',jp:'Takehito Koyasu',en:'Jason Douglas',age:'49',height:'298 cm',fruit:'Hie Hie no Mi',first:'Episode 225 / manga chapter 303',facts:['Known as Aokiji.','Former Marine admiral.','Can create and control ice.']},
 'Enel':{birthday:'May 6',jp:'Tōru Ōkawa',en:'J. Michael Tatum',age:'39',height:'266 cm',fruit:'Goro Goro no Mi',first:'Episode 167 / manga chapter 254',facts:['Former ruler of Skypiea.','Can generate and control lightning.','Intended to reach Fairy Vearth.']},
 'Donquixote Doflamingo':{birthday:'October 23',jp:'Hideyuki Tanaka',en:'Robert McCollum',age:'41',height:'305 cm',fruit:'Ito Ito no Mi',first:'Episode 151 / manga chapter 233',facts:['Former king of Dressrosa.','Known as the Heavenly Demon.','Operated a major underworld network.']},
 'Rob Lucci':{birthday:'June 2',jp:'Tomokazu Seki',en:'Jason Liebrecht',age:'30',height:'212 cm',fruit:'Neko Neko no Mi, Model: Leopard',first:'Episode 243 / manga chapter 323',facts:['Highly trained Cipher Pol agent.','Known for Rokushiki techniques.','Later associated with CP0.']} ,
 'Loki':{birthday:'Not officially confirmed',jp:'Yūichi Nakamura',en:'Not confirmed here',age:'63 (reported)',height:'Giant; exact value not confirmed here',fruit:'Legendary Devil Fruit associated with Elbaph; details treated cautiously',first:'Manga chapter 1130',facts:['Prince of Elbaph and son of King Harald.','Known as the Accursed Prince.','Has long admired Rocks D. Xebec.']},
 'Rocks D. Xebec':{birthday:'Not officially confirmed',jp:'Shinshū Fuji (anime credit)',en:'Paul St. Peter (Funimation credit)',age:'43, 38 years before the current story (reported)',height:'Not confirmed here',fruit:'No confirmed Devil Fruit entry',first:'Manga chapter 957 / anime episode 958',facts:['Captain of the Rocks Pirates.','His crew included future legends such as Whitebeard, Big Mom, Kaido and Shiki.','Sought to become King of the World.','His defeat is tied to the God Valley Incident.']},
 'Joy Boy':{birthday:'Unknown',jp:'Urara Takano (credited portrayal)',en:'Erica Schroeder (Funimation credit)',age:'Ancient figure; exact age uncertain',height:'Unknown',fruit:'Associated with Hito Hito no Mi, Model: Nika in story lore',first:'Void Century; later silhouette in the anime',facts:['Lived around 900 years ago.','Associated with the ancient kingdom and a promise to Fish-Man Island.','Left a treasure at the final island according to the story.']},
 'King Harald':{birthday:'Not confirmed',jp:'Not confirmed here',en:'Not confirmed here',age:'Not confirmed',height:'Giant',fruit:'Not confirmed',first:'Elbaph flashback material',facts:['Former king of Elbaph.','Father of Loki.','His relationship with Rocks shaped Elbaph’s history.']},
 'Imu':{birthday:'Unknown',jp:'Not confirmed here',en:'Not confirmed here',age:'Unknown',height:'Unknown',fruit:'Unknown',first:'Manga chapter 906 / anime episode 885',facts:['Secretive ruler at the top of the World Government.','Connected to mysteries surrounding the Void Century.','Many details remain deliberately unrevealed.']},
 'Davy D. Jones':{birthday:'Unknown',jp:'Not confirmed',en:'Not confirmed',age:'Legendary historical figure',height:'Unknown',fruit:'Unknown',first:'Mentioned in lore',facts:['Legendary name tied to Davy family lore.','Connection to Rocks is surrounded by mystery.','Details are not fully confirmed.']},
 'Figarland Garling':{birthday:'Not confirmed',jp:'Not confirmed here',en:'Not confirmed here',age:'Unknown',height:'Unknown',fruit:'Not confirmed',first:'Manga chapter 1086',facts:['Associated with the God’s Knights.','A key figure in the Figarland family.','Connected to God Valley events.']},
 'Scopper Gaban':{birthday:'Not confirmed here',jp:'Not confirmed here',en:'Not confirmed here',age:'Unknown',height:'Unknown',fruit:'Not confirmed',first:'Roger Pirates story material',facts:['Veteran of the Roger Pirates.','One of the notable members of Roger’s crew.','Helped the crew on its legendary voyage.']},
 'Captain John':{birthday:'Unknown',jp:'Not confirmed',en:'Not confirmed',age:'Unknown',height:'Unknown',fruit:'Unknown',first:'Thriller Bark references',facts:['Former member of the Rocks Pirates.','Known for a legendary treasure.','Personal details remain limited.']},
 'Ochoku':{birthday:'Unknown',jp:'Not confirmed',en:'Not confirmed',age:'Unknown',height:'Unknown',fruit:'Unknown',first:'Manga backstory references',facts:['Also known as Wang Zhi.','Associated with the Rocks Pirates.','Linked to the history of Hachinosu.']},
 'Buckingham Stussy':{birthday:'Not confirmed',jp:'Not confirmed here',en:'Not confirmed here',age:'Unknown',height:'Unknown',fruit:'Not confirmed',first:'Modern identity revealed in manga',facts:['Former member of the Rocks Pirates.','Connected to MADS and the underworld.','Distinct from the clone known as Stussy.']},
 'Gloriosa':{birthday:'Not confirmed here',jp:'Ako Mayama (reported)',en:'Not confirmed here',age:'Elder',height:'Unknown',fruit:'Not confirmed',first:'Amazon Lily flashback',facts:['Also called Elder Nyon.','Former empress of Amazon Lily.','Lived through the era of the Rocks Pirates.']},
 'Streusen':{birthday:'Not confirmed here',jp:'Haruhiko Jō (reported)',en:'Not confirmed here',age:'Unknown',height:'Unknown',fruit:'Kuku Kuku no Mi',first:'Whole Cake Island story',facts:['Chef and longtime associate of Big Mom.','Associated with the early history of her crew.','His Devil Fruit can turn objects into food.']},
 'Kong':{birthday:'Unknown',jp:'Not confirmed',en:'Not confirmed',age:'Unknown',height:'Unknown',fruit:'Not confirmed',first:'Marineford-era story material',facts:['Former Fleet Admiral.','Later Commander-in-Chief of the World Government’s armed forces.','A senior figure in the military structure.']},
 'Shimotsuki Ryuma':{birthday:'Not confirmed here',jp:'Not confirmed here',en:'Not confirmed here',age:'Historical figure',height:'Unknown',fruit:'None confirmed',first:'Thriller Bark / Monsters',facts:['Legendary samurai from Wano.','Remembered as a national hero.','Associated with the title Sword God.']},
 'Fisher Tiger':{birthday:'November 5 (commonly listed)',jp:'Kōji Ishii (reported)',en:'Not confirmed here',age:'Deceased',height:'Unknown',fruit:'None confirmed',first:'Fish-Man Island flashback',facts:['Founded the Sun Pirates.','Fought against slavery and oppression.','Inspired later generations.']},
 'Kozuki Toki':{birthday:'Not confirmed here',jp:'Keiko Han (reported)',en:'Not confirmed here',age:'Deceased; born centuries earlier',height:'Unknown',fruit:'Toki Toki no Mi',first:'Wano backstory',facts:['Born in the distant past.','Could send herself and others forward through time.','Her actions helped shape Wano’s future.']},
 'Nefertari D. Lily':{birthday:'Unknown',jp:'Not confirmed',en:'Not confirmed',age:'Historical figure',height:'Unknown',fruit:'Unknown',first:'Void Century revelations',facts:['Ancient queen of Alabasta.','Connected to the mystery of the Poneglyphs.','Her full history remains incompletely revealed.']},
 'Nika':{birthday:'Unknown; mythic figure',jp:'Not confirmed as a separate character voice',en:'Not confirmed',age:'Legendary',height:'Unknown',fruit:'Legend associated with the Hito Hito no Mi, Model: Nika',first:'Ancient lore references',facts:['Known as the Sun God in legend.','Symbolises liberation and joy.','Central to the meaning of Luffy’s awakened power.']},
 'Zunesha':{birthday:'Unknown',jp:'Not confirmed here',en:'Not confirmed here',age:'Ancient; exact age unknown',height:'Enormous; exact height not confirmed',fruit:'None confirmed',first:'Zou arc',facts:['Ancient elephant that carries Zou on its back.','Bound to continue walking as punishment.','Has a mysterious connection to Joy Boy.']},
 'Neptune':{birthday:'Not confirmed here',jp:'Minoru Inaba (reported)',en:'Not confirmed here',age:'Unknown',height:'Very large; exact value not listed',fruit:'None confirmed',first:'Fish-Man Island arc',facts:['King of the Ryugu Kingdom.','Father of Shirahoshi.','Connected to the promise left by Joy Boy.']}
 };
 const openProfile=(c:Character)=>setSelected(c);
 return <section className="frame-character-archive">
  <div className="frame-character-head"><div><small>CHARACTER ARCHIVE</small><h3><Users size={18}/> One Piece characters</h3><p>Swipe sideways to browse · tap any card for the full profile</p></div><span className="frame-character-count">{visible.length} / {characters.length}</span></div>
  <label className="frame-character-search"><Search size={16}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search names, crews, roles…" aria-label="Search One Piece characters"/>{query&&<button type="button" onClick={()=>setQuery('')} aria-label="Clear character search"><X size={15}/></button>}</label>
  <div className="frame-character-rail" aria-label="Horizontally scrolling One Piece character profiles">{visible.map(c=><article className={'frame-character-card'+(c.name==='Sanji'?' sanji-featured':'')} key={c.id} role="button" tabIndex={0} onClick={()=>openProfile(c)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openProfile(c)}}} aria-label={'Open details for '+c.name}>
   <div className="frame-character-portrait"><CharacterPortrait name={c.name} image={portraits[c.name]||(c.name==='Sanji'?'https://p325k7wa.twic.pics/high/one-piece/one-piece-odyssey/00-page-setup/OPOD_character_gallery/OPOD_Sanji.png?twic=v1%2Fcover%3D500%2Fstep%3D10%2Fquality%3D80%2Foutput%3Dpreview':undefined)}/><span style={{position:'absolute',top:8,left:8,zIndex:2,padding:'4px 8px',borderRadius:999,background:'rgba(10,15,28,.86)',color:'#fff',fontSize:12,fontWeight:800,border:'1px solid rgba(255,255,255,.25)'}}>{displayRank(c.name)===null?'Unranked':'#'+displayRank(c.name)}</span><span className="frame-character-open"><Users size={13}/> View profile</span></div>
   <div className="frame-character-copy"><a className="frame-character-name" href={google(c.name)} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>{c.name}<ExternalLink size={13}/></a><span className="frame-character-alias">{c.alias}</span><div className="frame-character-role">{c.role}</div><p>{c.bio}</p><span className="frame-character-tap">Tap card for facts <span>↗</span></span></div>
  </article>)}</div><div className="frame-character-rail-hint"><span>← Swipe to explore →</span><span>{visible.length} profiles</span></div>
  <p className="frame-character-source">Artwork uses individual character-page portraits first, with AniList character portraits as a fallback. Group episode stills are never substituted for individual character cards, and fan-art search results are not used. Japanese and English cast fields identify common anime dub credits where available; other regional dubs may differ. Unknown values are labelled rather than guessed.</p>
  {selected&&<div className="frame-character-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><section className="frame-character-modal" role="dialog" aria-modal="true" aria-label={selected.name+' character details'}>
   <button className="frame-character-modal-close" type="button" onClick={()=>setSelected(null)} aria-label="Close character details"><X size={19}/></button>
   <div className="frame-character-modal-hero"><CharacterPortrait name={selected.name} image={portraits[selected.name]||(selected.name==='Sanji'?'https://p325k7wa.twic.pics/high/one-piece/one-piece-odyssey/00-page-setup/OPOD_character_gallery/OPOD_Sanji.png?twic=v1%2Fcover%3D500%2Fstep%3D10%2Fquality%3D80%2Foutput%3Dpreview':undefined)} large/><div><small>ONE PIECE · CHARACTER FILE · {displayRank(selected.name)===null?'UNRANKED':'CUSTOM RANK #'+displayRank(selected.name)}</small><h2>{selected.name}</h2><p>{selected.alias} · {selected.role}</p><span className="frame-character-modal-affiliation">{selected.crew}</span><a className="frame-character-google" href={google(selected.name)} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>Search exact character name on Google <ExternalLink size={13}/></a></div></div>
   <div className="frame-character-fact-grid"><div><span><CalendarDays size={14}/> Birthday</span><b>{profiles[selected.name]?.birthday||'Not verified in this profile'}</b></div><div><span>Age</span><b>{profiles[selected.name]?.age||'Not verified / depends on story period'}</b></div><div><span>Height</span><b>{profiles[selected.name]?.height||'Not verified in this profile'}</b></div><div><span><Mic2 size={14}/> Japanese voice actor</span><b>{profiles[selected.name]?.jp||'Not yet verified for this profile'}</b></div><div><span><Mic2 size={14}/> English voice actor</span><b>{profiles[selected.name]?.en||'Dub-dependent / not yet verified'}</b></div><div><span>Devil Fruit / ability</span><b>{profiles[selected.name]?.fruit||'See character description; details not verified here'}</b></div><div><span>First appearance</span><b>{profiles[selected.name]?.first||'Not yet verified in this profile'}</b></div><div><span>Affiliation</span><b>{selected.crew}</b></div></div>
   <section className="frame-character-modal-section"><h3>About</h3><p>{selected.bio}</p><p><strong>Goal / dream:</strong> {selected.goal}</p><p><strong>Role:</strong> {selected.role}. <strong>Alias:</strong> {selected.alias}.</p></section>
   <section className="frame-character-modal-section"><h3>Facts</h3><ul>{(profiles[selected.name]?.facts||[selected.bio,'Affiliation: '+selected.crew,'Goal / dream: '+selected.goal]).map((fact,i)=><li key={i}>{fact}</li>)}</ul></section>
   <div className="frame-character-modal-footer"><span>Facts can vary by timeskip and dub. Missing data is marked instead of invented.</span><button type="button" onClick={()=>setSelected(null)}>Done</button></div>
  </section></div>}
 </section>
}

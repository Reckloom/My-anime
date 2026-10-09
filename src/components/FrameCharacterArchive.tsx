import {useMemo,useState} from 'react';
import {ExternalLink,Search,Users} from 'lucide-react';

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
[24,'Charlotte Linlin','Big Mom','Pirate emperor','Big Mom Pirates','The ruler of Totto Land who can manipulate souls and leads a vast family.','Build a kingdom for every race'],
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
] as const;
const characters:Character[]=rows.map(r=>({id:r[0],name:r[1],alias:r[2],role:r[3],crew:r[4],bio:r[5],goal:r[6]}));
const portrait=(id:number)=>'https://opbr-en.bn-ent.net/assets/data/webp/character/'+String(id).padStart(4,'0')+'_2d.png.webp';
const google=(name:string)=>'https://www.google.com/search?q='+encodeURIComponent(name+' One Piece character');

export function FrameCharacterArchive(){
 const [query,setQuery]=useState('');
 const visible=useMemo(()=>{const q=query.trim().toLowerCase();return characters.filter(c=>!q||[c.name,c.alias,c.role,c.crew,c.bio].join(' ').toLowerCase().includes(q))},[query]);
 return <section className="frame-character-archive">
  <div className="frame-character-head"><div><small>CHARACTER ARCHIVE</small><h3><Users size={18}/> One Piece characters</h3><p>Profiles, roles, affiliations and goals</p></div><span className="frame-character-count">{visible.length} / {characters.length}</span></div>
  <label className="frame-character-search"><Search size={16}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search names, crews, roles…" aria-label="Search One Piece characters"/></label>
  <div className="frame-character-grid">{visible.map(c=><article className="frame-character-card" key={c.id}>
   <a className="frame-character-portrait" href={google(c.name)} target="_blank" rel="noreferrer" aria-label={'Google search for '+c.name}><img src={portrait(c.id)} alt={c.name} loading="lazy" onError={e=>{e.currentTarget.style.visibility='hidden';e.currentTarget.parentElement?.classList.add('portrait-unavailable')}}/><span className="frame-character-open"><ExternalLink size={13}/> Google</span></a>
   <div className="frame-character-copy"><a className="frame-character-name" href={google(c.name)} target="_blank" rel="noreferrer">{c.name}<ExternalLink size={13}/></a><span className="frame-character-alias">{c.alias}</span><div className="frame-character-role">{c.role}</div><p>{c.bio}</p>
    <details className="frame-character-details"><summary>Full character details</summary><dl><dt>Affiliation</dt><dd>{c.crew}</dd><dt>Goal / dream</dt><dd>{c.goal}</dd><dt>Search the web</dt><dd><a href={google(c.name)} target="_blank" rel="noreferrer">Search “{c.name}” on Google <ExternalLink size={12}/></a></dd></dl></details>
   </div>
  </article>)}</div>
  <p className="frame-character-source">Portrait artwork is linked from the official ONE PIECE Bounty Rush character site. Some entries are movie-original characters.</p>
 </section>
}

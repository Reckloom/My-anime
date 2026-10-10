import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { MediaItem } from '../types';
import { FrameArtwork } from './FrameArtwork';

const PAGE_SIZE = 100;

type ArcRange = { name: string; start: number; end: number; summary: string };
const ARC_RANGES: Record<string, ArcRange[]> = {
  'erased': [
    {name:'Revival & the 1988 Kidnappings',start:1,end:6,summary:'Satoru is sent back to childhood and tries to prevent a classmate’s disappearance.'},
    {name:'Unmasking the Killer',start:7,end:12,summary:'The investigation moves toward identifying the killer and resolving the mystery.'}
  ],
  'hells paradise': [
    {name:'Island Arc',start:1,end:6,summary:'The condemned criminals and their executioners arrive on the mysterious island.'},
    {name:'Lord Tensen Arc',start:7,end:13,summary:'The survivors learn more about the island and face its powerful rulers.'}
  ],
  'hajime no ippo': [
    {name:'Early Days & Debut',start:1,end:12,summary:'Ippo begins boxing and takes his first steps into the sport.'},
    {name:'First Rounder',start:13,end:19,summary:'Ippo enters the Rookie King Tournament and faces stronger opponents.'},
    {name:'Finals',start:20,end:28,summary:'The Rookie King Tournament reaches its decisive matches.'},
    {name:'Rocky of Naniwa',start:29,end:34,summary:'Ippo faces a new challenger from Osaka.'},
    {name:'Two Rookie Kings',start:35,end:40,summary:'The rivalry between the season’s standout rookies develops.'},
    {name:'Speed Star',start:41,end:44,summary:'Ippo prepares for a technically demanding opponent.'},
    {name:'White Fang',start:45,end:50,summary:'Ippo faces the formidable Volg Zangief.'},
    {name:'Challenge for the Throne',start:51,end:57,summary:'The next stage of Ippo’s climb through the featherweight ranks begins.'},
    {name:'Road Back',start:58,end:64,summary:'Ippo and the gym prepare for new challenges.'},
    {name:'Mountain Training',start:65,end:70,summary:'Intense training prepares Ippo for the championship fight.'},
    {name:'Lallapallooza',start:71,end:75,summary:'Ippo and Sendo meet in a climactic rematch.'}
  ],
  'spy family': [
    {name:'Introduction',start:1,end:2,summary:'Loid begins Operation Strix and forms an unusual family.'},
    {name:'Admissions Interview',start:3,end:5,summary:'The Forger family faces Eden Academy’s admissions process.'},
    {name:'Eden Beginnings',start:6,end:7,summary:'Anya starts school and begins making connections.'},
    {name:'Secret Police',start:8,end:9,summary:'Yuri’s visit brings the family’s secrets closer to the surface.'},
    {name:'Stella Star',start:10,end:12,summary:'Anya tries to earn her first Stella Star at Eden Academy.'}
  ],
  'fullmetal alchemist brotherhood': [
    {name:'The Elric Brothers',start:1,end:14,summary:'The brothers search for the Philosopher’s Stone and uncover the cost of forbidden alchemy.'},
    {name:'The Homunculi’s Shadow',start:15,end:32,summary:'New allies and enemies reveal more about the conspiracy behind the Homunculi.'},
    {name:'The Promised Day',start:33,end:64,summary:'The country’s hidden plan comes to a head as the brothers fight for Amestris.'}
  ],
  'parasyte the maxim': [
    {name:'Migi Introduction & Mother’s Death',start:1,end:7,summary:'Shinichi and Migi form an uneasy partnership after the parasite invasion reaches his home.'},
    {name:'Kana',start:8,end:12,summary:'Kana senses that Shinichi has changed as his relationship with Migi evolves.'},
    {name:'Tamura Reiko',start:13,end:18,summary:'A highly intelligent parasite studies human society and Shinichi’s unusual nature.'},
    {name:'Gotou & the Finale',start:19,end:24,summary:'The conflict escalates as Shinichi faces the most dangerous parasites.'}
  ],
  'black clover': [
    {name:'Magic Knights Entrance',start:1,end:13,summary:'Asta and Yuno begin their journeys toward becoming Wizard King.'},
    {name:'Dungeon Exploration',start:14,end:19,summary:'The Black Bulls and Golden Dawn explore a dangerous dungeon.'},
    {name:'Royal Capital Assault',start:20,end:27,summary:'The Royal Capital comes under attack.'},
    {name:'Eye of the Midnight Sun Encounter',start:28,end:39,summary:'The Magic Knights confront the Eye of the Midnight Sun.'},
    {name:'Seabed Temple',start:40,end:51,summary:'The Black Bulls undertake a mission to the Seabed Temple.'},
    {name:'Witches’ Forest',start:52,end:65,summary:'Asta’s search for a cure leads to the Witches’ Forest.'},
    {name:'Royal Knights',start:66,end:96,summary:'Magic Knights compete for a place in the Royal Knights squad.'},
    {name:'Elf Reincarnation',start:97,end:129,summary:'The conflict with the elves reveals a deeper history.'},
    {name:'Heart Kingdom Joint Struggle',start:130,end:157,summary:'The Clover Kingdom prepares for a growing threat from the Spade Kingdom.'},
    {name:'Spade Kingdom Raid',start:158,end:170,summary:'The Magic Knights launch a dangerous operation against the Spade Kingdom.'}
  ],
  'bleach': [
    {name:'Agent of the Shinigami',start:1,end:20,summary:'Ichigo becomes a substitute Soul Reaper and begins protecting Karakura Town.'},
    {name:'Soul Society: The Sneak Entry',start:21,end:41,summary:'Ichigo and his friends enter Soul Society to rescue Rukia.'},
    {name:'Soul Society: The Rescue',start:42,end:63,summary:'The rescue mission reaches its turning point inside the Soul Society.'},
    {name:'The Bount',start:64,end:91,summary:'A new enemy group emerges in the human world.'},
    {name:'Bount Assault on Soul Society',start:92,end:109,summary:'The Bount conflict moves into Soul Society.'},
    {name:'Arrancar: The Arrival',start:110,end:131,summary:'The Arrancar threat reaches Karakura Town.'},
    {name:'Hueco Mundo: Sneak Entry',start:132,end:151,summary:'The rescue mission enters Hueco Mundo.'},
    {name:'Hueco Mundo: The Fierce Fight',start:152,end:167,summary:'The battles in Hueco Mundo intensify.'},
    {name:'The New Captain Shusuke Amagai',start:168,end:189,summary:'A new captain takes command of the Third Division.'},
    {name:'Arrancar vs. Shinigami',start:190,end:205,summary:'The conflict between the Arrancar and Soul Reapers escalates.'},
    {name:'The Past',start:206,end:212,summary:'A look back at the origins of the Visored and the Soul Reaper world.'},
    {name:'Decisive Battle of Karakura',start:213,end:229,summary:'The battle for Karakura Town reaches a critical stage.'},
    {name:'Zanpakuto: The Alternate Tale',start:230,end:265,summary:'The Zanpakuto spirits become central to a new conflict.'},
    {name:'Arrancar: Downfall',start:266,end:316,summary:'The Arrancar conflict approaches its conclusion.'},
    {name:'Gotei 13 Invading Army',start:317,end:342,summary:'A new threat targets the Gotei 13.'},
    {name:'The Lost Substitute Shinigami',start:343,end:366,summary:'Ichigo faces the consequences of losing his Soul Reaper powers.'}
  ],
  'death note': [
    {name:'L Arc',start:1,end:25,summary:'Light and L engage in a high-stakes battle of deduction.'},
    {name:'Near and Mello Arc',start:26,end:37,summary:'L’s successors continue the investigation into Kira.'}
  ],
  'jujutsu kaisen': [
    {name:'Fearsome Womb',start:1,end:8,summary:'Yuji enters the world of jujutsu sorcerers.'},
    {name:'Vs. Mahito',start:9,end:13,summary:'Yuji confronts a curse whose abilities challenge his understanding of people.'},
    {name:'Kyoto Goodwill Event',start:14,end:21,summary:'Tokyo and Kyoto students meet for their inter-school event.'},
    {name:'Death Painting',start:22,end:24,summary:'A new mission brings the students into conflict with cursed wombs.'}
  ],
  'attack on titan': [
    {name:'Fall of Shiganshina',start:1,end:2,summary:'Humanity’s fragile safety is shattered by a sudden attack.'},
    {name:'Battle of Trost',start:3,end:13,summary:'The cadets fight to reclaim Trost after the breach.'},
    {name:'57th Exterior Scouting Mission',start:14,end:21,summary:'The Scouts investigate a dangerous mission beyond the walls.'},
    {name:'Stohess District',start:22,end:25,summary:'A confrontation in Stohess raises new questions about the Titans.'}
  ],
  'dragon ball': [
    {name:'Emperor Pilaf Saga',start:1,end:13,summary:'Goku meets Bulma and begins the search for the Dragon Balls.'},
    {name:'21st Tenkaichi Budokai',start:14,end:28,summary:'Goku enters his first major martial arts tournament.'},
    {name:'Red Ribbon Army Saga',start:29,end:68,summary:'Goku confronts the Red Ribbon Army in pursuit of the Dragon Balls.'},
    {name:'Fortuneteller Baba Saga',start:69,end:83,summary:'Goku’s group faces a series of unusual fighters.'},
    {name:'22nd Tenkaichi Budokai',start:84,end:101,summary:'The next World Martial Arts Tournament brings new rivals.'},
    {name:'King Piccolo Saga',start:102,end:122,summary:'A dangerous new enemy threatens the world.'},
    {name:'Piccolo Jr. / 23rd Tenkaichi Budokai',start:123,end:153,summary:'Goku prepares for the next tournament and a decisive rematch.'}
  ],
  'my hero academia': [
    {name:'Entrance Exam',start:1,end:4,summary:'Izuku takes the first steps toward becoming a hero.'},
    {name:'Quirk Apprehension Test',start:5,end:6,summary:'Class 1-A faces its first test under Aizawa.'},
    {name:'Battle Trial',start:7,end:8,summary:'Students test their abilities in a hero-versus-villain exercise.'},
    {name:'USJ Incident',start:9,end:13,summary:'Class 1-A faces a real villain attack.'}
  ],
  'chainsaw man': [
    {name:'Introduction',start:1,end:3,summary:'Denji’s life changes when he becomes Chainsaw Man.'},
    {name:'Bat Devil',start:4,end:5,summary:'Denji takes on a dangerous devil-hunting mission.'},
    {name:'Eternity Devil',start:6,end:7,summary:'A mission traps the team in a seemingly endless space.'},
    {name:'Katana Man',start:8,end:12,summary:'A sudden attack forces Public Safety into a new conflict.'}
  ],
  'mashle magic and muscles': [
    {name:'Easton Entrance Exam',start:1,end:3,summary:'Mash enters a magic academy despite having no magic.'},
    {name:'Magia Lupus',start:4,end:12,summary:'Mash and his friends confront a powerful student group.'}
  ],
  'tokyo revengers': [
    {name:'Toman Introduction',start:1,end:5,summary:'Takemichi discovers time travel and becomes involved with Toman.'},
    {name:'Moebius',start:6,end:12,summary:'A clash with Moebius puts Toman’s future at risk.'},
    {name:'Valhalla',start:13,end:21,summary:'The Bloody Halloween conflict reshapes Toman.'},
    {name:'Black Dragon',start:22,end:24,summary:'A new gang conflict begins to emerge.'}
  ],
  're zero': [
    {name:'The Capital',start:1,end:3,summary:'Subaru discovers that his arrival in another world comes with a strange ability.'},
    {name:'The Mansion',start:4,end:11,summary:'Subaru settles into the mansion and tries to understand its inhabitants.'},
    {name:'Return to the Capital',start:12,end:25,summary:'The royal selection and a growing threat force Subaru into repeated crises.'}
  ],
  'one punch man': [
    {name:'Hero for Fun',start:1,end:2,summary:'Saitama and Genos establish their unusual partnership.'},
    {name:'House of Evolution',start:3,end:4,summary:'Saitama and Genos confront a laboratory creating powerful beings.'},
    {name:'Sea King',start:5,end:8,summary:'A growing threat puts the heroes of City Z to the test.'},
    {name:'Alien Conquerors',start:9,end:12,summary:'A powerful alien force attacks Earth.'}
  ],
  'solo leveling': [
    {name:'Double Dungeon',start:1,end:2,summary:'A dangerous dungeon raid changes Jinwoo’s life.'},
    {name:'Reawakening and New Quests',start:3,end:4,summary:'Jinwoo discovers a system that lets him grow stronger.'},
    {name:'Instant Dungeon',start:5,end:7,summary:'Jinwoo tests his new abilities in a private dungeon.'},
    {name:'Job Change Quest',start:8,end:10,summary:'Jinwoo faces a difficult quest that could redefine his role.'},
    {name:'Demon Castle',start:11,end:12,summary:'Jinwoo begins a dangerous challenge inside a towering dungeon.'}
  ]
};
const normalizeArcTitle = (value: string) => value.toLocaleLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const episodeNumber = (item: MediaItem) => {
  const externalId = String(item.externalId || '');
  const match = externalId.match(/:episode:(\d+)$/)
    || externalId.match(/^one-piece-episode-(\d+)$/i)
    || externalId.match(/^naruto-episode-(\d+)$/i)
    || externalId.match(/^frame-anime-episode-\d+-(\d+)-/i);
  if (match?.[1]) return Number(match[1]);
  if (item.episode?.episodeNumber) return Number(item.episode.episodeNumber);
  const titleNumber = item.title.match(/^Episode\s+(\d+)/i);
  return Number(titleNumber?.[1] || 0);
};

export function FrameAnimeEpisodeCatalogue({ title, episodes, onOpen }: {
  title: string;
  episodes: MediaItem[];
  onOpen: (item: MediaItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const sorted = useMemo(() => [...episodes].sort((a, b) => episodeNumber(a) - episodeNumber(b)), [episodes]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return sorted;
    return sorted.filter(item => [item.title, item.description, item.externalId, item.episode?.episodeCode, String(episodeNumber(item))].join(' ').toLocaleLowerCase().includes(q));
  }, [query, sorted]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const shown = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const arcRanges = ARC_RANGES[normalizeArcTitle(title)];
  const grouped = useMemo(() => {
    if (!arcRanges) return [{name:'Episodes',summary:'Episode details and artwork',start:1,end:Number.MAX_SAFE_INTEGER,items:shown}];
    const groups = arcRanges.map(arc => ({...arc,items:shown.filter(item => { const n=episodeNumber(item); return n>=arc.start && n<=arc.end; })})).filter(group=>group.items.length>0);
    const unassigned = shown.filter(item=>!arcRanges.some(arc=>episodeNumber(item)>=arc.start&&episodeNumber(item)<=arc.end));
    if(unassigned.length)groups.push({name:'Other episodes',summary:'Episodes outside the defined arc ranges.',start:0,end:0,items:unassigned});
    return groups;
  }, [arcRanges,shown]);
  if (!episodes.length) return null;
  return <section className="frame-anime-episode-catalogue detail-section" aria-label={title + ' episode catalogue'}>
    <div className="detail-section-head">
      <div><small>ARC EPISODES</small><h3>Episodes & details</h3></div>
      <span>{episodes.length.toLocaleString()} stored</span>
    </div>
    <div className="frame-anime-episode-tools">
      <label><Search size={15}/><input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Search episode number or title…" aria-label="Search episode number or title"/></label>
      <span>Showing {shown.length ? ((safePage - 1) * PAGE_SIZE + 1).toLocaleString() : '0'}–{Math.min(safePage * PAGE_SIZE, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}</span>
    </div>
    {shown.length ? <div className="frame-anime-arc-groups">
      {grouped.map(group=><details className="frame-anime-arc-group" key={group.name} open>
        <summary className="frame-anime-arc-heading">
          <span className="frame-anime-arc-cover">{group.items[0]&&<FrameArtwork title={group.items[0].title} medium={group.items[0].medium} poster={group.items[0].poster} sourceProvider={group.items[0].sourceProvider} externalId={group.items[0].externalId} className="frame-episode-artwork" alt="" loading="lazy"/>}</span>
          <span className="frame-anime-arc-copy"><b>{group.name}</b><small>{group.summary}</small><small>{group.items.length} episode{group.items.length===1?'':'s'} · {group.items.length?String(episodeNumber(group.items[0])).padStart(3,'0')+'–'+String(episodeNumber(group.items[group.items.length-1])).padStart(3,'0'):''}</small></span>
          <ChevronRight size={17}/>
        </summary>
        <div className="frame-anime-episode-rows" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:12}}>
          {group.items.map(item => <button type="button" className="frame-anime-episode-row" key={item.id} onClick={() => onOpen(item)} style={{display:'flex',flexDirection:'column',alignItems:'stretch',gap:8,textAlign:'left',padding:10,minWidth:0,height:'100%'}}>
            <span style={{position:'relative',display:'block',width:'100%',aspectRatio:'16 / 9',overflow:'hidden',borderRadius:10,background:'var(--surface, #171717)'}}>
              <FrameArtwork title={item.title} medium={item.medium} poster={item.poster} anilistId={item.anilistId} sourceProvider={item.sourceProvider} externalId={item.externalId} className="frame-episode-artwork" alt={item.title} loading="lazy" />
              <span className="frame-anime-episode-number" style={{position:'absolute',left:8,top:8}}>{String(episodeNumber(item)).padStart(3, '0')}</span>
            </span>
            <span className="frame-anime-episode-copy" style={{display:'flex',flexDirection:'column',gap:5,minWidth:0}}><b>{item.title.replace(/^Episode\s+\d+\s*[—–-]\s*/i, '')}</b><small>{item.episode?.airDate || 'Air date unavailable'} · {item.episode?.ratingSource || item.source || 'Episode details'}{item.episode?.episodeCode ? ' · ' + item.episode.episodeCode : ''}</small><small>{item.description || item.episode?.synopsis || 'Open episode details to view or edit its metadata.'}</small></span>
            <span className="frame-anime-episode-status">{item.status === 'completed' ? 'Watched' : 'Released'} <ChevronRight size={13}/></span>
          </button>)}
        </div>
      </details>)}
    </div> : <p className="muted frame-anime-episode-empty">No episodes match that search.</p>}
    {pageCount > 1 && <div className="frame-anime-episode-pagination">
      <button type="button" className="secondary" disabled={safePage <= 1} onClick={() => setPage(1)}>First</button>
      <button type="button" className="secondary" disabled={safePage <= 1} onClick={() => setPage(v => Math.max(1, v - 1))}><ChevronLeft size={14}/> Previous</button>
      <span>Page {safePage} of {pageCount}</span>
      <button type="button" className="secondary" disabled={safePage >= pageCount} onClick={() => setPage(v => Math.min(pageCount, v + 1))}>Next <ChevronRight size={14}/></button>
      <button type="button" className="secondary" disabled={safePage >= pageCount} onClick={() => setPage(pageCount)}>Last</button>
    </div>}
    <p className="frame-anime-episode-footnote">Episode titles were imported from the episode source shown in each row. Only rows with a source title are included.</p>
  </section>;
}

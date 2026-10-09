import type {MediaItem} from '../types';

type EpisodeRow={title:string;rating:number;date?:string;summary?:string;ratingCount?:number};
const seasonOne:EpisodeRow[]=[
 {title:'Somewhere Not Here',rating:8.2,date:'2019-07-06',summary:'Thorfinn longs for adventure in Iceland while his father becomes involved with a runaway slave.'},
 {title:'Sword',rating:8.2,date:'2019-07-08',summary:'Jomsvikings arrive in Thorfinn’s village and pressure Thors to return to battle.'},
 {title:'Troll',rating:8.6,date:'2019-07-08',summary:'Askeladd accepts a mission against Thors as Thorfinn joins the voyage.'},
 {title:'A True Warrior',rating:9.6,date:'2019-07-29',summary:'Surrounded by pirates, Thors acts to protect his crew and son.'},
 {title:"The Troll's Son",rating:8.5,date:'2019-08-05',summary:"Thorfinn pursues revenge while Leif carries news back to Thorfinn's family."},
 {title:'The Journey Begins',rating:9.4,date:'2019-08-12',summary:"After his first battle, Thorfinn is wounded and cared for by an English woman and her daughter."},
 {title:'Normanni',rating:8.7,date:'2019-08-19',summary:"Askeladd joins a Frankish conflict for treasure and sends Thorfinn to negotiate."},
 {title:'Beyond the Edge of the Sea',rating:8.4,date:'2019-08-26',summary:"After a raid, Thorfinn challenges Askeladd to a duel but finds himself outmatched."},
 {title:'The Battle of London Bridge',rating:9.1,date:'2019-09-02',summary:"The Danish campaign reaches London Bridge, where Thorkell's defection complicates the attack."},
 {title:'Ragnarok',rating:8.2,date:'2019-09-16',summary:"Thorfinn reflects on revenge as Askeladd discusses the old world's approaching end."},
 {title:'A Gamble',rating:8.6,date:'2019-09-23',summary:"Thorkell captures Canute, while Ragnar questions the danger of fighting Denmark's much larger force."},
 {title:'The Land on the Far Bank',rating:7.8,date:'2019-09-30',summary:"Askeladd's group tries to evade Thorkell and sends an urgent message across the river."},
 {title:'Child of a Hero',rating:7.9,date:'2019-10-07',summary:"Askeladd leads Canute through Wales, where an ambush tests his plans."},
 {title:'The Light of Dawn',rating:9.0,date:'2019-10-14',summary:"A blizzard forces the Vikings to seek shelter, revealing the cruelty within the group."},
 {title:'After Yule',rating:8.6,date:'2019-10-21',summary:"With the war nearing its end, Thorkell searches for a new reason to keep fighting."},
 {title:'History of Beasts',rating:8.5,date:'2019-10-28',summary:"An English attack exposes a leak in Askeladd's camp as Thorkell draws closer."},
 {title:'Servant',rating:9.4,date:'2019-11-04',summary:"A mutiny threatens Askeladd's group as Canute's position becomes increasingly precarious."},
 {title:'Out of the Cradle',rating:9.3,date:'2019-11-18',summary:"Thorfinn and Thorkell prepare to duel while Canute faces a life-changing dream."},
 {title:'United Front',rating:9.5,date:'2019-11-25',summary:"Askeladd and Thorfinn devise a plan to survive and give Thorfinn another chance to fight."},
 {title:'Crown',rating:8.8,date:'2019-12-02',summary:"Canute's understanding of love changes, and he begins to shape his own path to power."},
 {title:'Reunion',rating:9.4,date:'2019-12-09',summary:"Canute's party reaches York for a council where they intend to challenge King Sweyn."},
 {title:'Lone Wolf',rating:9.6,date:'2019-12-16',summary:"Thorfinn finally duels Askeladd, but the encounter takes an unexpected turn."},
 {title:'Miscalculation',rating:8.7,date:'2019-12-23',summary:"Rumours surrounding an attempt on Canute's life constrain the king's next moves."},
 {title:'End of the Prologue',rating:9.9,date:'2019-12-29',summary:"As the council continues, Askeladd makes a final stand after hearing troubling news about Wales."}
];
const seasonTwo:EpisodeRow[]=[
 {title:'Slave',rating:8.7,date:'2023-01-09',summary:"Einar's peaceful life is shattered by a Viking raid, sending him into slavery."},
 {title:"Ketil's Farm",rating:7.8,date:'2023-01-16',summary:"Thorfinn and Einar begin slave labour on Ketil's farm and meet the people who live there."},
 {title:'Snake',rating:8.4,date:'2023-01-23',summary:"Thorfinn is threatened by men claiming to be warriors, bringing him into conflict with Snake."},
 {title:'Awakening',rating:8.8,date:'2023-01-30',summary:"Einar challenges Thorfinn to confront the meaning of his past and his words."},
 {title:'The Path of Blood',rating:8.5,date:'2023-02-06',summary:"Canute must take responsibility for a weakened kingdom under attack."},
 {title:'I Want a Horse',rating:7.9,date:'2023-02-13',summary:"Thorfinn and Einar need a horse to move timber, but the stable workers refuse them."},
 {title:'Iron Fist Ketil',rating:8.0,date:'2023-02-20',summary:"Theft on the farm leads to trouble as Ketil's eldest son returns."},
 {title:'An Empty Man',rating:9.0,date:'2023-02-27',summary:"Thorfinn is troubled by recurring nightmares he cannot remember."},
 {title:'Oath',rating:9.6,date:'2023-03-06',summary:"A violent encounter leaves Thorfinn unconscious and leads to a dream about his father and enemy."},
 {title:'Cursed Head',rating:8.6,date:'2023-03-13',summary:"After years of work, Thorfinn and Einar finish clearing the forest as Canute visits Denmark."},
 {title:'The King and the Sword',rating:7.8,date:'2023-03-20',summary:"Canute looks for ways to fund his armies while Leif discovers Thorfinn is enslaved."},
 {title:'For the Love That Was Lost',rating:9.2,date:'2023-03-27',summary:"Olmar receives upsetting news as Canute's attention turns toward Ketil's farm."},
 {title:'Dark Clouds',rating:8.3,date:'2023-04-03',summary:"A runaway slave's actions bring a bounty, while an elderly farmer's health deteriorates."},
 {title:'Freedom',rating:8.5,date:'2023-04-10',summary:"Gardar arrives seeking Arnheid, while Thorfinn attempts to resolve the danger without violence."},
 {title:'Storm',rating:8.8,date:'2023-04-17',summary:"Arnheid visits the fortress where Gardar is held and asks to tend to his injuries."},
 {title:'Cause',rating:9.2,date:'2023-04-24',summary:"Thorfinn and Einar find Arnheid and decide to help her and Gardar escape."},
 {title:'Way Home',rating:9.5,date:'2023-05-01',summary:"Thorfinn breaks his oath to protect Gardar from Snake when circumstances leave him no alternative."},
 {title:'The First Measure',rating:9.0,date:'2023-05-08',summary:"Ketil returns to the farm and learns what has happened as Canute's forces approach."},
 {title:'War at Ketil’s Farm',rating:8.7,date:'2023-05-15',summary:"Ketil gathers men to defend the farm while Thorfinn and his companions try to leave."},
 {title:'Pain',rating:9.6,date:'2023-05-22',summary:"As Thorfinn and Einar plan their escape, Arnheid wakes and asks whether another land can be free of war."},
 {title:'Courage',rating:8.9,date:'2023-05-29',summary:"After the battle, Canute demands surrender even as others want to continue fighting."},
 {title:'The King of Rebellion',rating:9.7,date:'2023-06-05',summary:"Thorfinn endures a punishing challenge to earn a conversation with Canute."},
 {title:'Two Paths',rating:9.7,date:'2023-06-12',summary:"Thorfinn and Canute negotiate for peace, and Thorfinn and Einar decide to seek Vinland."},
 {title:'Hometown',rating:9.4,date:'2023-06-19',summary:"Thorfinn returns to Iceland and reunites with his family."}
];

const average=(rows:EpisodeRow[])=>Math.round(rows.reduce((sum,e)=>sum+e.rating,0)/rows.length*10)/10;
const makeId=(key:string)=>'vinland-demo-'+crypto.randomUUID()+'-'+key;
function episodeItem(rootId:string,seasonId:string,seasonNumber:number,row:EpisodeRow,index:number):MediaItem{
 const episodeNumber=index+1;
 return {
  id:makeId('s'+seasonNumber+'e'+episodeNumber),parentId:seasonId,
  sourceProvider:'imdb',externalId:'tt10233448',title:'E'+String(episodeNumber).padStart(2,'0')+' · '+row.title,
  description:row.summary||'Episode synopsis has not been imported into this demo record yet. Open IMDb for the current episode details.',
  poster:'https://cdn.myanimelist.net/images/anime/2/76662.jpg',backdrop:'',medium:'anime',status:'planned',progress:0,total:1,
  year:seasonNumber===1?2019:2023,score:row.rating,genres:['Adventure','Drama'],themes:[],studio:seasonNumber===1?'WIT Studio':'MAPPA',source:'IMDb episode rating',
  season:'Season '+seasonNumber,favorite:false,progressUnit:'episodes',
  episode:{seasonNumber,episodeNumber,episodeCode:'S'+seasonNumber+'.E'+episodeNumber,airDate:row.date,runtimeMinutes:seasonNumber===1?(episodeNumber===1?28:24):26,ratingSource:'IMDb',ratingCount:row.ratingCount,imdbEpisodeUrl:'https://www.imdb.com/title/tt10233448/episodes/?season='+seasonNumber,imdbId:undefined}
 };
}
export function makeVinlandSagaDemo():MediaItem[]{
 const rootId=makeId('root'),s1Id=makeId('season-1'),s2Id=makeId('season-2');
 const root:MediaItem={id:rootId,title:'Vinland Saga — Episode Details Demo',description:'Sample hierarchy for FRAME episode-level details. Episode scores are sourced from IMDb search results and may change over time.',poster:'https://cdn.myanimelist.net/images/anime/2/76662.jpg',backdrop:'',medium:'anime',status:'planned',progress:0,total:48,year:2019,score:8.9,genres:['Adventure','Drama'],themes:['Historical'],studio:'WIT Studio / MAPPA',source:'IMDb',favorite:false,sourceProvider:'imdb',externalId:'tt10233448',progressUnit:'episodes'};
 const season=(id:string,title:string,number:number,rows:EpisodeRow[],studio:string):MediaItem=>({id,parentId:rootId,title,description:'Season-level sample record. Open it to explore all episode entries and their IMDb ratings.',poster:root.poster,backdrop:'',medium:'anime',status:'planned',progress:0,total:rows.length,year:number===1?2019:2023,score:average(rows),genres:root.genres,themes:root.themes,studio,source:'IMDb episode-rating average (computed from listed episode scores)',favorite:false,sourceProvider:'imdb',externalId:'tt10233448',progressUnit:'episodes'});
 const s1=season(s1Id,'Season 1',1,seasonOne,'WIT Studio');
 const s2=season(s2Id,'Season 2',2,seasonTwo,'MAPPA');
 return [root,s1,s2,...seasonOne.map((e,i)=>episodeItem(rootId,s1Id,1,e,i)),...seasonTwo.map((e,i)=>episodeItem(rootId,s2Id,2,e,i))];
}

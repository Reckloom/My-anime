import type {MediaItem} from '../types';

type EpisodeRow={title:string;rating:number;date?:string;summary?:string};
const seasonOne:EpisodeRow[]=[
 {title:'Somewhere Not Here',rating:8.2,date:'2019-07-07',summary:'Thorfinn longs for adventure in Iceland while his father becomes involved with a runaway slave.'},
 {title:'Sword',rating:8.2,date:'2019-07-08',summary:'Jomsvikings arrive in Thorfinn’s village and pressure Thors to return to battle.'},
 {title:'Troll',rating:8.6,date:'2019-07-08',summary:'Askeladd accepts a mission against Thors as Thorfinn joins the voyage.'},
 {title:'A True Warrior',rating:9.6,date:'2019-07-29',summary:'Surrounded by pirates, Thors acts to protect his crew and son.'},
 {title:"The Troll's Son",rating:8.5,date:'2019-08-05'},
 {title:'The Journey Begins',rating:9.4,date:'2019-08-12'},
 {title:'Normanni',rating:8.7,date:'2019-08-19'},
 {title:'Beyond the Edge of the Sea',rating:8.4,date:'2019-08-26'},
 {title:'The Battle of London Bridge',rating:9.1,date:'2019-09-02'},
 {title:'Ragnarok',rating:8.2,date:'2019-09-16'},
 {title:'A Gamble',rating:8.6,date:'2019-09-23'},
 {title:'The Land on the Far Bank',rating:7.8,date:'2019-09-30'},
 {title:'Child of a Hero',rating:7.9,date:'2019-10-07'},
 {title:'The Light of Dawn',rating:9.0,date:'2019-10-14'},
 {title:'After Yule',rating:8.6,date:'2019-10-21'},
 {title:'History of Beasts',rating:8.5,date:'2019-10-28'},
 {title:'Servant',rating:9.4,date:'2019-11-04'},
 {title:'Out of the Cradle',rating:9.3,date:'2019-11-18'},
 {title:'United Front',rating:9.5,date:'2019-11-25'},
 {title:'Crown',rating:8.8,date:'2019-12-02'},
 {title:'Reunion',rating:9.4,date:'2019-12-09'},
 {title:'Lone Wolf',rating:9.6,date:'2019-12-16'},
 {title:'Miscalculation',rating:8.7,date:'2019-12-23'},
 {title:'End of the Prologue',rating:9.9,date:'2019-12-29'}
];
const seasonTwo:EpisodeRow[]=[
 {title:'Slave',rating:8.7,date:'2023-01-10'},
 {title:"Ketil's Farm",rating:7.8,date:'2023-01-16'},
 {title:'Snake',rating:8.4,date:'2023-01-23'},
 {title:'Awakening',rating:8.8,date:'2023-01-30'},
 {title:'The Path of Blood',rating:8.5,date:'2023-02-06'},
 {title:'I Want a Horse',rating:7.9,date:'2023-02-13'},
 {title:'Iron Fist Ketil',rating:8.0,date:'2023-02-20'},
 {title:'An Empty Man',rating:9.0,date:'2023-02-27'},
 {title:'Oath',rating:9.6,date:'2023-03-06'},
 {title:'Cursed Head',rating:8.6,date:'2023-03-13'},
 {title:'The King and the Sword',rating:7.8,date:'2023-03-20'},
 {title:'For the Love That Was Lost',rating:9.2,date:'2023-03-27'},
 {title:'Dark Clouds',rating:8.3,date:'2023-04-03'},
 {title:'Freedom',rating:8.5,date:'2023-04-10'},
 {title:'Storm',rating:8.8,date:'2023-04-17'},
 {title:'Cause',rating:9.2,date:'2023-04-24'},
 {title:'Way Home',rating:9.5,date:'2023-05-01'},
 {title:'The First Measure',rating:9.0,date:'2023-05-08'},
 {title:'War at Ketil’s Farm',rating:8.7,date:'2023-05-15'},
 {title:'Pain',rating:9.6,date:'2023-05-22'},
 {title:'Courage',rating:8.9,date:'2023-05-29'},
 {title:'The King of Rebellion',rating:9.7,date:'2023-06-05'},
 {title:'Two Paths',rating:9.7,date:'2023-06-12'},
 {title:'Hometown',rating:9.4,date:'2023-06-19'}
];

const average=(rows:EpisodeRow[])=>Math.round(rows.reduce((sum,e)=>sum+e.rating,0)/rows.length*10)/10;
const makeId=(key:string)=>'vinland-demo-'+key;
function episodeItem(rootId:string,seasonId:string,seasonNumber:number,row:EpisodeRow,index:number):MediaItem{
 const episodeNumber=index+1;
 return {
  id:makeId('s'+seasonNumber+'e'+episodeNumber),parentId:seasonId,
  sourceProvider:'imdb',externalId:'tt10233448',title:'E'+String(episodeNumber).padStart(2,'0')+' · '+row.title,
  description:row.summary||'Episode synopsis has not been imported into this demo record yet. Open IMDb for the current episode details.',
  poster:'https://cdn.myanimelist.net/images/anime/2/76662.jpg',backdrop:'',medium:'anime',status:'planned',progress:0,total:1,
  year:seasonNumber===1?2019:2023,score:row.rating,genres:['Adventure','Drama'],themes:[],studio:seasonNumber===1?'WIT Studio':'MAPPA',source:'IMDb episode rating',
  season:'Season '+seasonNumber,favorite:false,progressUnit:'episodes',
  episode:{seasonNumber,episodeNumber,episodeCode:'S'+seasonNumber+'.E'+episodeNumber,airDate:row.date,ratingSource:'IMDb',imdbEpisodeUrl:'https://www.imdb.com/title/tt10233448/episodes/?season='+seasonNumber,imdbId:undefined}
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

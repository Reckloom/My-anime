export type Status='watching'|'completed'|'planned'|'paused'|'dropped';
export type Medium='anime'|'manga'|'manhwa'|'light-novel'|'visual-novel'|'movie'|'series';
export interface MediaItem{
 id:string; parentId?:string; metadataId?:string; anilistId?:number;
 title:string; alternativeTitles?:string[]; description:string; poster:string; backdrop:string;
 medium:Medium; status:Status; progress:number; total?:number; year?:number; score?:number;
 genres:string[]; themes:string[]; studio?:string; source?:string; season?:string; duration?:number;
 airStart?:string; airEnd?:string; favorite:boolean; notes?:string; nextRelease?:string; nextReleaseNumber?:number
}
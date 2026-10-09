export type Status='watching'|'reading'|'playing'|'completed'|'planned'|'paused'|'dropped';
export type Medium='anime'|'manga'|'manhwa'|'light-novel'|'visual-novel'|'movie'|'series'|'game'|'book';

export interface GameDetails{
 developer?:string;
 publisher?:string;
 releaseDate?:string;
 platforms?:string[];
 gameModes?:string[];
 playtimeHours?:number;
 storyProgress?:number;
 completionProgress?:number;
 difficulty?:string;
 complexity?:{story?:number;gameplay?:number;systems?:number;exploration?:number};
 franchise?:string;
 edition?:string;
 dlc?:string[];
 isFree?:boolean;
 priceText?:string;
 storeUrl?:string;
}

export interface MediaAvailability{
 watch?:string[];
 buy?:string[];
 read?:string[];
 play?:string[];
}

export interface EpisodeMetadata {
 seasonNumber:number;
 episodeNumber:number;
 episodeCode:string;
 airDate?:string;
 runtimeMinutes?:number;
 ratingSource?:string;
 ratingCount?:number;
 imdbEpisodeUrl?:string;
 imdbId?:string;
 directors?:string[];
 writers?:string[];
 cast?:string[];
 synopsis?:string;
}

export interface MediaItem{
 id:string; parentId?:string; metadataId?:string; anilistId?:number; sourceProvider?:string; externalId?:string;
 title:string; alternativeTitles?:string[]; description:string; poster:string; backdrop:string;
 medium:Medium; status:Status; progress:number; total?:number; year?:number; score?:number;
 personalRating?:number; progressUnit?:string; customTotal?:number;
 genres:string[]; themes:string[]; studio?:string; source?:string; season?:string; duration?:number;
 airStart?:string; airEnd?:string; favorite:boolean; notes?:string; nextRelease?:string; nextReleaseNumber?:number;
 availability?:MediaAvailability;
 notificationsEnabled?:boolean;
 releaseRadarState?:Record<string,unknown>;
 episode?:EpisodeMetadata;
 game?:GameDetails;
}

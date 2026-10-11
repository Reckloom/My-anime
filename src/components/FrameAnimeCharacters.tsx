import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Users } from 'lucide-react';
import type { AnimeCharacterProfile } from '../types';
import { aniList, CHARACTER_SEARCH_QUERY, CHARACTERS_QUERY } from '../anilist';
import { supabase } from '../lib/supabase';
import { posterImageSrc } from '../posterImage';

type AniListCharacterEdge = {
  role?: string | null;
  node?: {
    id?: number;
    name?: { full?: string | null; native?: string | null };
    image?: { large?: string | null };
    description?: string | null;
    siteUrl?: string | null;
    dateOfBirth?: { year?: number | null; month?: number | null; day?: number | null } | null;
    age?: string | null;
    bloodType?: string | null;
    gender?: string | null;
    voiceActors?: Array<{ name?: string | null; language?: string | null; image?: { large?: string | null } | null; siteUrl?: string | null }>;
  };
};
type AniListCharacterResponse = { Media?: { title?: { english?: string | null; romaji?: string | null; native?: string | null; userPreferred?: string | null }; characters?: { edges?: AniListCharacterEdge[] } } };

async function loadAnimeCharacters(anilistId: number, expectedTitle: string): Promise<AnimeCharacterProfile[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('anime-catalogue', {
        body: { action: 'anime-characters', anilistId, title: expectedTitle },
      });
      if (!error && Array.isArray(data?.characters) && data.characters.length > 0) {
        return data.characters.filter((character: any) => character?.name).map((character: any) => ({
          id: Number(character.id) || undefined,
          name: String(character.name),
          nativeName: character.nativeName ? String(character.nativeName) : undefined,
          role: character.role ? String(character.role) : undefined,
          image: character.image ? String(character.image) : undefined,
          description: character.description ? String(character.description) : undefined,
          sourceUrl: character.sourceUrl ? String(character.sourceUrl) : undefined,
          birthday: character.birthday ? String(character.birthday) : undefined,
          age: character.age ? String(character.age) : undefined,
          bloodType: character.bloodType ? String(character.bloodType) : undefined,
          gender: character.gender ? String(character.gender) : undefined,
          voiceActors: Array.isArray(character.voiceActors) ? character.voiceActors.filter((voice: any) => voice?.name).map((voice: any) => ({ name: String(voice.name), language: voice.language ? String(voice.language) : undefined })) : undefined,
        }));
      }
    } catch {
      // Use the public AniList endpoint as a fallback if the server proxy is unavailable.
    }
  }
  const pages = await Promise.all(
    [1, 2, 3, 4].map(page => aniList<AniListCharacterResponse>(CHARACTERS_QUERY, { id: anilistId, page }))
  );
  const media = pages[0].Media;
  const normalizeTitle = (value: string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const expected = normalizeTitle(expectedTitle);
  const allowSubtitlePrefix = /[:—–-]/.test(expectedTitle);
  const actual = [media?.title?.english, media?.title?.romaji, media?.title?.native, media?.title?.userPreferred].filter(Boolean).map(value => normalizeTitle(String(value)));
  if (!actual.some((value: string) => value === expected || (allowSubtitlePrefix && expected.length >= 5 && value.startsWith(expected)))) return [];
  const edges = pages.flatMap(page => page.Media?.characters?.edges || []);
  return edges.filter(edge => edge.node?.name?.full).map(edge => ({
    id: edge.node!.id,
    name: String(edge.node!.name!.full),
    nativeName: edge.node!.name!.native || undefined,
    role: edge.role || undefined,
    image: edge.node!.image?.large || undefined,
    description: edge.node!.description || undefined,
    sourceUrl: edge.node!.siteUrl || undefined,
    birthday: edge.node!.dateOfBirth?.year && edge.node!.dateOfBirth?.month && edge.node!.dateOfBirth?.day ? `${edge.node!.dateOfBirth.year}-${String(edge.node!.dateOfBirth.month).padStart(2,'0')}-${String(edge.node!.dateOfBirth.day).padStart(2,'0')}` : undefined,
    age: edge.node!.age || undefined,
    bloodType: edge.node!.bloodType || undefined,
    gender: edge.node!.gender || undefined,
    voiceActors: edge.node!.voiceActors?.filter(voice => voice.name).map(voice => ({ name: String(voice.name), language: voice.language || undefined })),
  }));
}

const characterCache = new Map<string, { expiresAt: number; profiles: AnimeCharacterProfile[] }>();
const characterRequests = new Map<string, Promise<AnimeCharacterProfile[]>>();

async function fetchAnimeCharacters(anilistId: number, expectedTitle: string): Promise<AnimeCharacterProfile[]> {
  const key = anilistId + ':' + expectedTitle.toLocaleLowerCase();
  const cached = characterCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.profiles;
  const pending = characterRequests.get(key);
  if (pending) return pending;
  const request = loadAnimeCharacters(anilistId, expectedTitle);
  characterRequests.set(key, request);
  try {
    const profiles = await request;
    if (profiles.length) characterCache.set(key, { expiresAt: Date.now() + 15 * 60 * 1000, profiles });
    return profiles;
  } finally {
    if (characterRequests.get(key) === request) characterRequests.delete(key);
  }
}

function CharacterPortrait({character}:{character:AnimeCharacterProfile}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[character.image,character.name]);
  if(character.image&&!failed)return <img src={posterImageSrc(character.image)} alt={character.name + ' portrait'} loading="lazy" onError={()=>setFailed(true)} />;
  return <span aria-label={character.name + ' portrait unavailable'}><Users size={21}/></span>;
}

function shortDescription(value?: string) {
  if (!value) return 'Character information was not supplied by the metadata source.';
  return value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export function FrameAnimeCharacters({ title, characters, anilistId, onCharactersLoaded }: { title: string; characters: AnimeCharacterProfile[]; anilistId?: number; onCharactersLoaded?: (profiles: AnimeCharacterProfile[]) => void | Promise<void> }) {
  const characterSignature = characters.map(character => [character.id || '', character.name, character.image || ''].join(':')).join('|');
  const stableCharacters = useMemo(() => characters, [characterSignature]);
  const isOnePieceTitle = /\bone piece\b/i.test(title);
  const isNarutoTitle = /\bnaruto\b/i.test(title);
  const isBleachTitle = /\bbleach\b/i.test(title);
  const isBlackCloverTitle = /\bblack\s+clover\b/i.test(title);
  const isAttackOnTitanTitle = /\battack\s+on\s+titan\b/i.test(title);
  const isVinlandSagaTitle = /\bvinland\s+saga\b/i.test(title);
  const isDragonBallTitle = /\bdragon\s+ball\b/i.test(title);
  const isRichArchive = isOnePieceTitle || isNarutoTitle || isBleachTitle || isBlackCloverTitle || isAttackOnTitanTitle || isVinlandSagaTitle || isDragonBallTitle;
  const [remoteCharacters,setRemoteCharacters] = useState<AnimeCharacterProfile[]>([]);
  const [loading,setLoading] = useState(false);
  const [failed,setFailed] = useState(false);
  const onCharactersLoadedRef = useRef(onCharactersLoaded);
  onCharactersLoadedRef.current = onCharactersLoaded;
  const lastPublishedSignature = useRef('');
  const publishCharacters = (profiles: AnimeCharacterProfile[]) => {
    setRemoteCharacters(profiles);
    const signature = profiles.map(character => [character.id || '', character.name, character.image || ''].join(':')).join('|');
    if (!signature || signature === lastPublishedSignature.current || !onCharactersLoadedRef.current) return;
    lastPublishedSignature.current = signature;
    void Promise.resolve(onCharactersLoadedRef.current(profiles)).catch(() => {
      if (lastPublishedSignature.current === signature) lastPublishedSignature.current = '';
    });
  };

  useEffect(() => {
    let active = true;
    setRemoteCharacters([]);
    setFailed(false);
    const profilesWithImages = stableCharacters.filter(character => Boolean(character.image)).length;
    // A saved archive of 40+ illustrated profiles is useful even when optional
    // bio fields are absent; don't block every detail-page opening on re-fetch.
    const needsRemote = isOnePieceTitle
      ? (profilesWithImages < 60 || stableCharacters.length < 60)
      : isNarutoTitle || isBleachTitle || isBlackCloverTitle || isAttackOnTitanTitle || isVinlandSagaTitle || isDragonBallTitle
        ? (stableCharacters.length < 20 || stableCharacters.some(character => !character.image || !character.birthday || !character.age || !character.gender || !character.bloodType || !character.voiceActors?.length))
        : (stableCharacters.length === 0 || stableCharacters.some(character => !character.image));
    if (!needsRemote || !anilistId) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    fetchAnimeCharacters(anilistId, title)
      .then(async mapped => {
        if (active) {
          const normalizeName = (value: string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
          const merged = stableCharacters.map(existing => {
            const match = mapped.find(remote => normalizeName(remote.name) === normalizeName(existing.name));
            return match ? {
              ...match,
              ...existing,
              image: existing.image || match.image,
              nativeName: existing.nativeName || match.nativeName,
              description: existing.description || match.description,
              sourceUrl: existing.sourceUrl || match.sourceUrl,
              role: existing.role || match.role,
              birthday: existing.birthday || match.birthday,
              age: existing.age || match.age,
              bloodType: existing.bloodType || match.bloodType,
              gender: existing.gender || match.gender,
              voiceActors: existing.voiceActors?.length ? existing.voiceActors : match.voiceActors,
            } : existing;
          });
          const names = new Set(merged.map(character => normalizeName(character.name)));
          const combined = [...merged, ...mapped.filter(character => !names.has(normalizeName(character.name)))];
          if (/\bone piece\b/i.test(title)) {
            if (!combined.some(character => normalizeName(character.name) === 'goingmerry')) {
              combined.push({
                id: 9000001,
                name: 'Going Merry',
                role: 'Straw Hat Pirates',
                image: 'https://one-piece.com/o/assets/uploads/a9d6b72240fd8ee5b856fa7a56e38ab7.jpg',
                birthday: 'January 22',
                description: 'The Straw Hat Pirates’ first ship and a beloved member of their crew.',
                sourceUrl: 'https://one-piece.com/character/Going_Merry/index.html',
              });
            }
          }
          publishCharacters(combined);
          setFailed(!combined.some(character => Boolean(character.image)));
        }
      })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  // Saving fetched profiles changes the parent prop; keep the original fetch alive.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anilistId, title, isOnePieceTitle, isNarutoTitle, isBleachTitle, isBlackCloverTitle, isAttackOnTitanTitle, isVinlandSagaTitle]);

  const rawProfiles = remoteCharacters.length ? remoteCharacters : stableCharacters;
  const isOnePiece = /\bone piece\b/i.test(title);
  const isNaruto = isNarutoTitle;
  const isBleach = isBleachTitle;
  const isBlackClover = isBlackCloverTitle;
  const isAttackOnTitan = isAttackOnTitanTitle;
  const isVinlandSaga = isVinlandSagaTitle;
  const famousOnePiece = new Set(['Monkey D. Luffy','Roronoa Zoro','Vinsmoke Sanji','Nami','Usopp','Tony Tony Chopper','Nico Robin','Franky','Brook','Jinbe','Portgas D. Ace','Sabo','Shanks','Trafalgar D. Water Law','Trafalgar Law','Marshall D. Teach','Blackbeard','Dracule Mihawk','Boa Hancock','Edward Newgate','Whitebeard','Kaido','Charlotte Linlin','Big Mom','Gol D. Roger','Monkey D. Garp','Sakazuki','Akainu','Kuzan','Aokiji','Borsalino','Kizaru','Issho','Fujitora','Aramaki','Ryokugyu','Smoker','Tashigi','Coby','Helmeppo']);
  const marineNames = new Set(['Monkey D. Garp','Garp','Sakazuki','Akainu','Kuzan','Aokiji','Borsalino','Kizaru','Issho','Fujitora','Aramaki','Ryokugyu','Smoker','Tashigi','Coby','Helmeppo','Hina','Tsuru']);
  const rankCharacters = (input: AnimeCharacterProfile[]) => {
    if (!isOnePiece) return input;
    const ranked = [...input];
    const sanji = ranked.findIndex(character => /\bsanji\b/i.test(character.name));
    const zoro = ranked.findIndex(character => /(?:roronoa\s+)?zoro/i.test(character.name));
    if (sanji >= 0 && zoro >= 0 && sanji > zoro) [ranked[sanji], ranked[zoro]] = [ranked[zoro], ranked[sanji]];
    return ranked;
  };
  const rankedProfiles = rankCharacters(rawProfiles);
  const bounties: Record<string,string> = {'Monkey D. Luffy':'3,000,000,000 B','Roronoa Zoro':'1,111,000,000 B','Vinsmoke Sanji':'1,032,000,000 B','Nami':'366,000,000 B','Usopp':'500,000,000 B','Tony Tony Chopper':'1,000 B','Nico Robin':'930,000,000 B','Franky':'394,000,000 B','Brook':'383,000,000 B','Jinbe':'1,100,000,000 B','Portgas D. Ace':'550,000,000 B','Sabo':'602,000,000 B','Shanks':'4,048,900,000 B','Marshall D. Teach':'3,996,000,000 B','Blackbeard':'3,996,000,000 B','Dracule Mihawk':'3,590,000,000 B','Boa Hancock':'1,659,000,000 B','Edward Newgate':'5,046,000,000 B','Whitebeard':'5,046,000,000 B','Kaido':'4,611,100,000 B','Charlotte Linlin':'4,388,000,000 B','Big Mom':'4,388,000,000 B','Gol D. Roger':'5,564,800,000 B','Monkey D. Garp':'3,000,000,000 B'};
  const onePiecePopularity = [
    'Monkey D. Luffy','Roronoa Zoro','Vinsmoke Sanji','Nami','Trafalgar D. Water Law','Nico Robin','Portgas D. Ace','Shanks','Dracule Mihawk','Crocodile',
    'Donquixote Rosinante','Boa Hancock','Tony Tony Chopper','Sabo','Uta','Carrot','Rocks D. Xebec','Yamato','Usopp','Loki',
    'Charlotte Cracker','Donquixote Doflamingo','Eustass Kid','Perona','Buggy','Marco','Brook','Nefertari Vivi','Franky','Jinbe',
    'Charlotte Katakuri','Bartholomew Kuma','Smoker','Bentham','Rob Lucci','Edward Newgate','Koby','Kaku','Cavendish','Monkey D. Garp',
    'Kuzan','Izo','Benn Beckman','Silvers Rayleigh','Going Merry','Jewelry Bonney','Alber','Borsalino','Enel','Lilith',
    'Charlotte Perospero','Killer','Imu','Sakazuki','Kuro','Bartolomeo','Namule','Gol D. Roger','Joy Boy','Marshall D. Teach'
  ];
  const onePieceAliases: Record<string,string> = {
    'Trafalgar Law':'Trafalgar D. Water Law','Sanji':'Vinsmoke Sanji','Luffy Monkey':'Monkey D. Luffy','Luffy':'Monkey D. Luffy','Zoro Roronoa':'Roronoa Zoro','Zoro':'Roronoa Zoro',
    'Donquixote Rosinante':'Donquixote Rosinante','Donquixote Doflamingo':'Donquixote Doflamingo','Eustass Kid':'Eustass Kid','Charlotte Cracker':'Charlotte Cracker','Rocks D. Xebec':'Rocks D. Xebec','Nefertari Vivi':'Nefertari Vivi','Charlotte Katakuri':'Charlotte Katakuri','Bartholomew Kuma':'Bartholomew Kuma','Rob Lucci':'Rob Lucci','Cavendish':'Cavendish','Silvers Rayleigh':'Silvers Rayleigh','Jewelry Bonney':'Jewelry Bonney','Charlotte Perospero':'Charlotte Perospero','Gol D. Roger':'Gol D. Roger','Namule':'Namur','Vegapunk Punk-02 Lilith':'Lilith','Marshall D. Teach':'Marshall D. Teach','Blackbeard':'Marshall D. Teach',
    'Whitebeard':'Edward Newgate','Charlotte Linlin':'Charlotte Linlin','Big Mom':'Charlotte Linlin','Coby':'Koby',
    'Dracule Mihawk':'Dracule Mihawk','Bentham (Mr. 2 / Bon Clay)':'Bentham',
    'Joyboy':'Joy Boy','Alber':'Alber','Kaku':'Kaku','Kuzan':'Kuzan','Borsalino':'Borsalino','Sakazuki':'Sakazuki'
  };
  const normalizeCharacterName = (value:string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'');
  const characterNameKeys = (value:string) => {
    const words=value.toLocaleLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(word=>word.length>1&&word!=='the');
    return new Set([normalizeCharacterName(value),words.join(''),[...words].reverse().join('')]);
  };
  const sameCharacterName = (left:string,right:string) => {
    const a=characterNameKeys(left),b=characterNameKeys(right);
    return [...a].some(key=>key&&b.has(key));
  };
  const vinlandSagaTop20 = [
    'Thorfinn Karlsefni','Askeladd','Canute Svensson','Thors Snorresson','Einar','Thorkell','Leif Erikson','Bjorn','Snake','Arnheid','Floki','Ketil','Hild','Gudrid','Ylva','Thorgil','Olmar','Sverkel','Helga','Halfdan'
  ];
  const dragonBallTopRanks: Record<string,string[]> = {
    'Dragon Ball':['Gokuu Son','Vegeta','Gohan Son','Piccolo','Kuririn','Bulma','Yamcha','Muten Roushi','Tien Shinhan','Chi-Chi','Trunks','Krillin','Videl','Android 18','Android 17','Majin Boo','Cell','Frieza','King Piccolo','Kami','Launch','Oolong','Puar','Chaozu','Ox-King','Tao Pai-Pai','Raditz','Nappa','Master Shen','Android 8','Yajirobe','Mr. Popo','Bora','Uranai Baba','General Blue','Commander Red','Mercenary Tao','King Furry','Pilaf','Mai','Shu','Giran','Nam','Jackie Chun','Chiaotzu','Tien','Piccolo Jr.','Tambourine','Drum','Cymbal'],
    'Dragon Ball Z':['Gokuu Son','Vegeta','Gohan Son','Piccolo','Trunks','Kuririn','Bulma','Frieza','Majin Boo','Cell','Android 18','Android 17','Goten','Videl','Mr. Satan','Tien Shinhan','Yamcha','Muten Roushi','Raditz','Nappa','Bardock','Future Gohan','Goku Black','Zamasu','Android 16','Android 19','Dr. Gero','King Cold','Cooler','Broly','Paragus','Dabura','Supreme Kai','Kibito','Yajirobe','Dende','Nail','Guru','Captain Ginyu','Recoome','Jeice','Burter','Dodoria','Zarbon','Guldo','Appule','Raditz','Nappa','Oolong','Puar'],
    'Dragon Ball Super':['Gokuu Son','Vegeta','Gohan Son','Piccolo','Bulma','Beerus','Whis','Future Trunks','Jiren','Frieza','Broly','Goku Black','Zamasu','Android 17','Android 18','Hit','Goten','Trunks','Champa','Vados','Grand Zeno','Future Mai','Kale','Caulifla','Cabba','Toppo','Dyspo','Ribrianne','Android 17','Master Roshi','Krillin','Tien Shinhan','Yamcha','Majin Boo','Frieza','Goku Black','Zamasu','Frost','Champa','Vados','Beerus','Whis','Jaco','Monaka','Bulma','Shenron','Shin','Gowasu','Sidra','Belmod'],
    'Dragon Ball GT':['Gokuu Son','Vegeta','Pan','Trunks','Bulma','Uub','Baby','Gogeta','Omega Shenron','Super 17','Piccolo','Gohan Son','Goten','Android 18','Mr. Satan','Chi-Chi','Muten Roushi','Dende','Shenron','Giru'],
    'Dragon Ball DAIMA':['Gokuu Son','Vegeta','Higashi no Kaioushin','Glorio','Panzy','Bulma','Gomah','Degesu','Dr. Arinsu','Piccolo','Majin Kuu','Majin Duu','Neva','Hybis','Marba','Tamagami Number One','Tamagami Number Two','Tamagami Number Three','Chi-Chi','Goten']
  };
  const profiles = isOnePiece ? (() => {
    const used=new Set<string>();
    const ordered: (AnimeCharacterProfile & {popularityRank?:number})[]=[];
    // Match the curated favourites first, including AniList's "family-name first"
    // display format and known aliases; then append the remaining real cast records.
    for(const rankedName of onePiecePopularity){
      const variants=[rankedName,...Object.entries(onePieceAliases)
        .filter(([,canonical])=>sameCharacterName(canonical,rankedName))
        .map(([aliasName])=>aliasName)];
      const match=rankedProfiles.find(character=>
        !used.has(String(character.id||character.name)) &&
        variants.some(variant=>sameCharacterName(character.name,variant))
      );
      if(match){
        const key=String(match.id||match.name);
        used.add(key);
        ordered.push({...match,bounty:match.bounty||bounties[match.name]||bounties[rankedName],popularityRank:ordered.length+1});
      }
    }
    for(const character of rankedProfiles){
      const key=String(character.id||character.name);
      if(used.has(key))continue;
      used.add(key);
      ordered.push({...character,bounty:character.bounty||bounties[character.name],popularityRank:ordered.length+1});
      if(ordered.length>=60)break;
    }
    return ordered.slice(0,60);
  })() : isNaruto ? (() => {
    const used=new Set<string>();
    const ordered: AnimeCharacterProfile[]=[];
    const wanted=[
      'Naruto Uzumaki','Sasuke Uchiha','Kakashi Hatake','Itachi Uchiha','Sakura Haruno',
      'Madara Uchiha','Jiraiya','Minato Namikaze','Pain','Obito Uchiha',
      'Gaara','Shikamaru Nara','Hinata Hyuga','Rock Lee','Might Guy',
      'Orochimaru','Tsunade','Killer B','Hashirama Senju','Kaguya Otsutsuki'
    ];
    for(const wantedName of wanted){
      const match=rankedProfiles.find(c=>!used.has(String(c.id||c.name))&&sameCharacterName(c.name,wantedName));
      if(match){used.add(String(match.id||match.name));ordered.push(match);}
    }
    for(const c of rankedProfiles){
      const key=String(c.id||c.name);
      if(!used.has(key)){used.add(key);ordered.push(c);}
      if(ordered.length>=20)break;
    }
    return ordered.slice(0,20);
  })() : isBleachTitle ? (() => {
    const used=new Set<string>();
    const ordered: AnimeCharacterProfile[]=[];
    const wanted=[
      'Ichigo Kurosaki','Rukia Kuchiki','Orihime Inoue','Uryu Ishida','Renji Abarai',
      'Byakuya Kuchiki','Kisuke Urahara','Yoruichi Shihouin','Toshiro Hitsugaya','Kenpachi Zaraki',
      'Sosuke Aizen','Shunsui Kyoraku','Mayuri Kurotsuchi','Ulquiorra Cifer','Grimmjow Jaegerjaquez',
      'Yhwach','Ichimaru Gin','Shinji Hirako','Retsu Unohana','Genryusai Shigekuni Yamamoto'
    ];
    for(const wantedName of wanted){
      const match=rankedProfiles.find(c=>!used.has(String(c.id||c.name))&&sameCharacterName(c.name,wantedName));
      if(match){used.add(String(match.id||match.name));ordered.push(match);}
    }
    for(const c of rankedProfiles){
      const key=String(c.id||c.name);
      if(!used.has(key)){used.add(key);ordered.push(c);}
      if(ordered.length>=20)break;
    }
    return ordered.slice(0,20);
  })() : isBlackCloverTitle ? (() => {
    const used=new Set<string>();
    const ordered: AnimeCharacterProfile[]=[];
    const wanted=[
      'Asta','Yuno','Noelle Silva','Yami Sukehiro','Mereoleona Vermillion',
      'Luck Voltia','Magna Swing','Finral Roulacase','Vanessa Enoteca','Charmy Pappitson',
      'Nacht Faust','Julius Novachrono','Fuegoleon Vermillion','William Vangeance','Mimosa Vermillion',
      'Gauche Adlai','Zora Ideale','Secre Swallowtail','Liebe','Zenon Zogratis'
    ];
    for(const wantedName of wanted){
      const match=rankedProfiles.find(c=>!used.has(String(c.id||c.name))&&sameCharacterName(c.name,wantedName));
      if(match){used.add(String(match.id||match.name));ordered.push(match);}
    }
    for(const c of rankedProfiles){
      const key=String(c.id||c.name);
      if(!used.has(key)){used.add(key);ordered.push(c);}
      if(ordered.length>=20)break;
    }
    return ordered.slice(0,20);
  })() : isAttackOnTitan ? (() => {
    const used=new Set<string>();
    const ordered: AnimeCharacterProfile[]=[];
    const wanted=[
      'Eren Yeager','Mikasa Ackerman','Armin Arlert','Levi','Erwin Smith',
      'Reiner Braun','Annie Leonhart','Jean Kirstein','Sasha Blouse','Hange Zoe',
      'Historia Reiss','Ymir','Zeke Yeager','Pieck Finger','Porco Galliard',
      'Connie Springer','Bertholdt Hoover','Gabi Braun','Falco Grice','Grisha Yeager'
    ];
    for(const wantedName of wanted){
      const match=rankedProfiles.find(c=>!used.has(String(c.id||c.name))&&sameCharacterName(c.name,wantedName));
      if(match){used.add(String(match.id||match.name));ordered.push(match);}
    }
    for(const c of rankedProfiles){
      const key=String(c.id||c.name);
      if(!used.has(key)){used.add(key);ordered.push(c);}
      if(ordered.length>=20)break;
    }
    return ordered.slice(0,20);
  })() : isDragonBallTitle ? (() => {
    const used=new Set<string>(); const ordered: AnimeCharacterProfile[]=[];
    const wanted=dragonBallTopRanks[title] || [];
    for(const wantedName of wanted){
      const match=rankedProfiles.find(c=>!used.has(String(c.id||c.name))&&sameCharacterName(c.name,wantedName));
      if(match){used.add(String(match.id||match.name));ordered.push(match);}
    }
    for(const c of rankedProfiles){const key=String(c.id||c.name);if(!used.has(key)){used.add(key);ordered.push(c);}if(ordered.length>=20)break;}
    return ordered.slice(0,20);
  })() : isVinlandSaga ? (() => {
    const used=new Set<string>();
    const ordered: AnimeCharacterProfile[]=[];
    for(const wantedName of vinlandSagaTop20){
      const match=rankedProfiles.find(c=>!used.has(String(c.id||c.name))&&sameCharacterName(c.name,wantedName));
      if(match){used.add(String(match.id||match.name));ordered.push(match);}
    }
    for(const c of rankedProfiles){const key=String(c.id||c.name);if(!used.has(key)){used.add(key);ordered.push(c);}if(ordered.length>=20)break;}
    return ordered.slice(0,20);
  })() : rankedProfiles;
  const characterFactStyles = '.frame-character-modal{grid-template-columns:minmax(0,1fr);width:min(560px,100%);max-height:88dvh;overflow:auto}.frame-character-modal-copy{min-width:0}.frame-character-modal-copy h4{overflow-wrap:anywhere}.frame-character-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.frame-character-modal-copy p{overflow-wrap:anywhere;word-break:normal}@media(max-width:600px){.frame-character-modal{width:calc(100vw - 20px);padding:13px;border-radius:16px}.frame-character-facts{gap:6px}.frame-character-facts span{padding:7px;font-size:.72rem}.frame-character-bounty{font-size:.62rem}.frame-character-bounty strong{font-size:.82rem}}.frame-character-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:12px 0}.frame-character-facts span,.frame-character-voices span{display:flex;flex-direction:column;min-width:0;gap:2px;padding:7px 9px;border-radius:9px;background:rgba(255,255,255,.06);overflow:hidden}.frame-character-facts strong,.frame-character-voices>strong{font-size:.62rem;text-transform:uppercase;letter-spacing:.07em;opacity:.65}.frame-character-facts span{font-size:.78rem;line-height:1.2;overflow-wrap:anywhere}.frame-character-voices{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}.frame-character-voices span{font-size:.76rem;line-height:1.2;overflow-wrap:anywhere}.frame-character-bounty{margin:10px 0;padding:8px 10px;border-radius:9px;background:rgba(160,120,40,.1);display:flex;align-items:center;justify-content:space-between;min-width:0;gap:8px;font-size:.68rem;letter-spacing:.05em}.frame-character-bounty strong{font-size:.9rem;white-space:nowrap}.frame-character-modal,.frame-character-modal-copy{min-width:0;overflow-wrap:anywhere}.frame-character-modal-copy p{font-size:.78rem;line-height:1.38;margin:9px 0;max-height:4.2em;overflow:hidden}.frame-character-modal-copy h4{line-height:1.05;overflow-wrap:anywhere}';
  const onePieceStyles = isRichArchive ? '.frame-one-piece-character-archive .frame-anime-character-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:18px;overflow:visible;padding:2px 0 8px}.frame-one-piece-character-archive .frame-anime-character-card{position:relative;display:flex;flex-direction:column;min-width:0;box-sizing:border-box;min-height:370px;padding:0;overflow:hidden;border-radius:18px;text-align:left;cursor:pointer;border:1px solid rgba(73,57,33,.35);background:linear-gradient(155deg,#f4ead0,#d9c29a);box-shadow:0 10px 28px rgba(0,0,0,.22);color:#241d14;transition:transform .2s ease,box-shadow .2s ease}.frame-one-piece-character-archive .frame-anime-character-card:hover{transform:translateY(-5px) rotate(-.3deg);box-shadow:0 18px 34px rgba(0,0,0,.3)}.frame-one-piece-character-archive .frame-anime-character-portrait{width:calc(100% - 20px);flex:0 0 auto;height:270px;margin:10px 10px 0;overflow:hidden;border:4px solid rgba(67,50,29,.48);background:linear-gradient(145deg,#c9b384,#eee0bd);box-shadow:inset 0 0 20px rgba(0,0,0,.18);display:grid;place-items:center}.frame-one-piece-character-archive .frame-anime-character-portrait img{width:100%;height:100%;display:block;object-fit:contain;object-position:center;background:rgba(255,255,255,.08)}.frame-one-piece-character-archive .frame-anime-character-copy{padding:10px 13px 14px;display:flex;flex:1;min-width:0;flex-direction:column;gap:5px}.frame-one-piece-character-archive .frame-anime-character-copy>b{font-family:Georgia,serif;font-size:1.05rem;line-height:1.12;min-height:2.24em;display:block;overflow-wrap:anywhere;word-break:normal}.frame-one-piece-character-archive .frame-anime-character-copy>span{font-size:.66rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase;opacity:1;color:#241d14;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}.frame-one-piece-character-archive .frame-one-piece-bounty{display:block;color:#241d14;opacity:1;font:900 .68rem/1 Georgia,serif;letter-spacing:.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:1em}.frame-one-piece-character-archive .frame-anime-character-copy p{display:none}.frame-one-piece-character-archive .frame-anime-character-open{margin-top:auto;font-weight:800;font-size:.66rem;opacity:.68}.frame-one-piece-character-archive .frame-one-piece-poster-label{position:absolute;left:18px;top:18px;z-index:2;padding:5px 8px;border:2px solid currentColor;border-radius:5px;background:rgba(244,234,208,.9);font:900 .68rem/1 Georgia,serif;letter-spacing:.08em;transform:rotate(-4deg)}.frame-one-piece-character-archive .frame-one-piece-rank{position:absolute;right:16px;top:16px;z-index:2;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#241d14;color:#f4ead0;font:900 .8rem Georgia,serif;box-shadow:0 3px 9px rgba(0,0,0,.28)}.frame-one-piece-character-archive .frame-anime-character-native{display:none}.frame-one-piece-character-archive .frame-character-modal-portrait{width:min(230px,42vw);height:300px}@media(max-width:600px){.frame-one-piece-character-archive .frame-anime-character-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;overflow:visible}.frame-one-piece-character-archive .frame-anime-character-card{min-height:300px}.frame-one-piece-character-archive .frame-anime-character-portrait{width:calc(100% - 20px);height:205px}.frame-one-piece-character-archive .frame-anime-character-copy{padding:8px 9px 11px}.frame-one-piece-character-archive .frame-anime-character-copy>b{font-size:.9rem}.frame-one-piece-character-archive .frame-one-piece-rank{width:29px;height:29px;right:10px;top:10px}.frame-one-piece-character-archive .frame-one-piece-poster-label{left:10px;top:10px}}' : '';
  const [selectedCharacter, setSelectedCharacter] = useState<AnimeCharacterProfile | null>(null);
  if (!profiles.length && !loading && !failed) return null;
  return <section className={'frame-anime-characters detail-section' + (isRichArchive ? ' frame-one-piece-character-archive' : '')} aria-label={title + ' character profiles'}><style>{characterFactStyles + onePieceStyles}</style>
    <div className="detail-section-head">
      <div><small>{isOnePiece ? 'WANTED • MARINE ARCHIVE' : isNaruto ? 'NINJA CHARACTER ARCHIVE' : isBleach ? 'SOUL REAPER CHARACTER ARCHIVE' : isBlackClover ? 'MAGIC KNIGHT CHARACTER ARCHIVE' : isAttackOnTitan ? 'SCOUT REGIMENT CHARACTER ARCHIVE' : isVinlandSaga ? 'VIKING CHARACTER ARCHIVE' : isDragonBallTitle ? 'DRAGON BALL CHARACTER ARCHIVE' : 'CHARACTER ARCHIVE'}</small><h3>{isRichArchive ? (isDragonBallTitle && (title === 'Dragon Ball' || title === 'Dragon Ball Super') ? 'Top 50 Characters' : 'Top 20 Characters') : 'Characters'}</h3></div>
      <span>{loading ? 'Loading…' : profiles.length ? profiles.length + (isRichArchive ? ' detailed profiles' : ' profiles') : 'Unavailable'}</span>
    </div>
    {profiles.length > 0 ? <div className="frame-anime-character-grid" role="list">
      {profiles.map((character, index) => {
        const marine = isOnePiece && [...marineNames].some(name => name.toLowerCase() === character.name.toLowerCase());
        return <button type="button" className="frame-anime-character-card" key={(character.id || character.name) + '-' + index} onClick={() => setSelectedCharacter(character)} aria-label={'Open details for ' + character.name}>
          {isOnePiece && <span className="frame-one-piece-poster-label">{marine ? 'MARINE' : 'WANTED'}</span>}
          {isNaruto && <span className="frame-one-piece-poster-label">NINJA</span>}
          {isBleach && <span className="frame-one-piece-poster-label">SOUL REAPER</span>}
          {isBlackClover && <span className="frame-one-piece-poster-label">MAGIC KNIGHT</span>}
          {isAttackOnTitan && <span className="frame-one-piece-poster-label">SCOUT</span>}
          {isVinlandSaga && <span className="frame-one-piece-poster-label">VIKING</span>}
          {isDragonBallTitle && <span className="frame-one-piece-poster-label">DRAGON BALL</span>}
          {isRichArchive && <span className="frame-one-piece-rank">#{index + 1}</span>}
          <div className="frame-anime-character-portrait"><CharacterPortrait character={character} /></div>
          <div className="frame-anime-character-copy">
            <b>{character.name}</b>
            <span>{marine ? 'Marine' : character.role ? character.role.charAt(0).toUpperCase() + character.role.slice(1).toLowerCase() : 'Character'}</span>
            {isOnePiece && <small className="frame-one-piece-bounty">{character.bounty ? 'BOUNTY ' + character.bounty : 'WANTED FILE'}</small>}
            <small className="frame-anime-character-open">Open character file</small>
          </div>
        </button>;
      })}
    </div> : <p className="frame-anime-character-footnote">{loading ? 'Loading verified character names and portraits from AniList…' : 'Character profiles could not be loaded right now. Try reopening this anime later.'}</p>}
    <p className="frame-anime-character-footnote">Character facts, portraits, birthdays, ages, blood types, genders and available voice-actor data are enriched from AniList. Missing fields stay marked as unavailable.</p>
    {selectedCharacter && <div className="frame-character-modal-backdrop" role="presentation" onClick={() => setSelectedCharacter(null)}>
      <div className="frame-character-modal" role="dialog" aria-modal="true" aria-label={selectedCharacter.name + ' character details'} onClick={event => event.stopPropagation()}>
        <button type="button" className="frame-character-modal-close" onClick={() => setSelectedCharacter(null)} aria-label="Close character details">×</button>
        <div className="frame-character-modal-copy">
          <small>{isOnePiece ? 'WANTED / MARINE FILE' : isNaruto ? 'NINJA CHARACTER FILE' : isBleach ? 'SOUL REAPER CHARACTER FILE' : isBlackClover ? 'MAGIC KNIGHT CHARACTER FILE' : isAttackOnTitan ? 'SCOUT CHARACTER FILE' : isVinlandSaga ? 'VIKING CHARACTER FILE' : isDragonBallTitle ? 'DRAGON BALL CHARACTER FILE' : 'CHARACTER PROFILE'}</small>
          <h4>{selectedCharacter.name}</h4>
          <b>{isOnePiece && [...marineNames].some(name => name.toLowerCase() === selectedCharacter.name.toLowerCase()) ? 'Marine' : selectedCharacter.role ? selectedCharacter.role.charAt(0).toUpperCase() + selectedCharacter.role.slice(1).toLowerCase() : 'Character'}</b>
          {isOnePiece && selectedCharacter.bounty && <div className="frame-character-bounty"><span>WANTED BOUNTY</span><strong>{selectedCharacter.bounty}</strong></div>}
          <div className="frame-character-facts"><span><strong>Birthday</strong>{selectedCharacter.birthday || 'Unknown'}</span><span><strong>Age</strong>{selectedCharacter.age || 'Unknown'}</span><span><strong>Gender</strong>{selectedCharacter.gender || 'Unknown'}</span><span><strong>Blood type</strong>{selectedCharacter.bloodType || 'Unknown'}</span></div>
          {selectedCharacter.voiceActors?.length ? <div className="frame-character-voices"><strong>Voice actors</strong>{selectedCharacter.voiceActors.slice(0, 2).map((voice,index) => <span key={voice.name+'-'+index}>{voice.name}{voice.language ? ` · ${voice.language}` : ''}</span>)}</div> : null}
          <p>{shortDescription(selectedCharacter.description)}</p>
          {selectedCharacter.sourceUrl && <a href={selectedCharacter.sourceUrl} target="_blank" rel="noreferrer">View source <ExternalLink size={12}/></a>}
        </div>
      </div>
    </div>}
  </section>;
}

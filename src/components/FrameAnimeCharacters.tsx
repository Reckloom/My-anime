import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Users } from 'lucide-react';
import type { AnimeCharacterProfile } from '../types';
import { aniList, CHARACTERS_QUERY } from '../anilist';
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
      if (!error && Array.isArray(data?.characters)) {
        return data.characters.filter((character: any) => character?.name).map((character: any) => ({
          id: Number(character.id) || undefined,
          name: String(character.name),
          nativeName: character.nativeName ? String(character.nativeName) : undefined,
          role: character.role ? String(character.role) : undefined,
          image: character.image ? String(character.image) : undefined,
          description: character.description ? String(character.description) : undefined,
          sourceUrl: character.sourceUrl ? String(character.sourceUrl) : undefined,
        }));
      }
    } catch {
      // Use the public AniList endpoint as a fallback if the server proxy is unavailable.
    }
  }
  const result = await aniList<AniListCharacterResponse>(CHARACTERS_QUERY, { id: anilistId });
  const media = result.Media;
  const normalizeTitle = (value: string) => value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const expected = normalizeTitle(expectedTitle);
  const allowSubtitlePrefix = /[:—–-]/.test(expectedTitle);
  const actual = [media?.title?.english, media?.title?.romaji, media?.title?.native, media?.title?.userPreferred].filter(Boolean).map(value => normalizeTitle(String(value)));
  if (!actual.some((value: string) => value === expected || (allowSubtitlePrefix && expected.length >= 5 && value.startsWith(expected)))) return [];
  const edges = media?.characters?.edges || [];
  return edges.filter(edge => edge.node?.name?.full).map(edge => ({
    id: edge.node!.id,
    name: String(edge.node!.name!.full),
    nativeName: edge.node!.name!.native || undefined,
    role: edge.role || undefined,
    image: edge.node!.image?.large || undefined,
    description: edge.node!.description || undefined,
    sourceUrl: edge.node!.siteUrl || undefined,
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

export function FrameAnimeCharacters({ title, characters, anilistId }: { title: string; characters: AnimeCharacterProfile[]; anilistId?: number }) {
  const characterSignature = characters.map(character => [character.id || '', character.name, character.image || ''].join(':')).join('|');
  const stableCharacters = useMemo(() => characters, [characterSignature]);
  const [remoteCharacters,setRemoteCharacters] = useState<AnimeCharacterProfile[]>([]);
  const [loading,setLoading] = useState(false);
  const [failed,setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setRemoteCharacters([]);
    setFailed(false);
    const needsRemote = stableCharacters.length === 0 || stableCharacters.some(character => !character.image);
    if (!needsRemote || !anilistId) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    fetchAnimeCharacters(anilistId, title)
      .then(mapped => {
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
            } : existing;
          });
          const names = new Set(merged.map(character => normalizeName(character.name)));
          const combined = [...merged, ...mapped.filter(character => !names.has(normalizeName(character.name)))];
          setRemoteCharacters(combined);
          setFailed(!combined.some(character => Boolean(character.image)));
        }
      })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [anilistId, stableCharacters, title]);

  const rawProfiles = remoteCharacters.length ? remoteCharacters : stableCharacters;
  const isOnePiece = /\bone piece\b/i.test(title);
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
  const profiles = isOnePiece ? rankedProfiles.filter((character, index) => index < 10 || famousOnePiece.has(character.name)) : rankedProfiles;
  const onePieceStyles = isOnePiece ? '.frame-one-piece-character-archive .frame-anime-character-grid{grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:18px}.frame-one-piece-character-archive .frame-anime-character-card{position:relative;display:flex;flex-direction:column;min-height:370px;padding:0;overflow:hidden;border-radius:18px;text-align:left;cursor:pointer;border:1px solid rgba(73,57,33,.35);background:linear-gradient(155deg,#f4ead0,#d9c29a);box-shadow:0 10px 28px rgba(0,0,0,.22);color:#241d14;transition:transform .2s ease,box-shadow .2s ease}.frame-one-piece-character-archive .frame-anime-character-card:hover{transform:translateY(-5px) rotate(-.3deg);box-shadow:0 18px 34px rgba(0,0,0,.3)}.frame-one-piece-character-archive .frame-anime-character-portrait{height:245px;margin:10px 10px 0;overflow:hidden;border:4px solid rgba(67,50,29,.48);background:#bca57b;box-shadow:inset 0 0 20px rgba(0,0,0,.18)}.frame-one-piece-character-archive .frame-anime-character-portrait img{width:100%;height:100%;display:block;object-fit:cover}.frame-one-piece-character-archive .frame-anime-character-copy{padding:10px 13px 14px;display:flex;flex:1;flex-direction:column;gap:5px}.frame-one-piece-character-archive .frame-anime-character-copy>b{font-family:Georgia,serif;font-size:1.05rem;line-height:1.12}.frame-one-piece-character-archive .frame-anime-character-copy>span{font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.72}.frame-one-piece-character-archive .frame-anime-character-copy p{display:none}.frame-one-piece-character-archive .frame-anime-character-open{margin-top:auto;font-weight:800;opacity:.78}.frame-one-piece-character-archive .frame-one-piece-poster-label{position:absolute;left:18px;top:18px;z-index:2;padding:5px 8px;border:2px solid currentColor;border-radius:5px;background:rgba(244,234,208,.9);font:900 .68rem/1 Georgia,serif;letter-spacing:.08em;transform:rotate(-4deg)}.frame-one-piece-character-archive .frame-one-piece-rank{position:absolute;right:16px;top:16px;z-index:2;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#241d14;color:#f4ead0;font:900 .8rem Georgia,serif;box-shadow:0 3px 9px rgba(0,0,0,.28)}.frame-one-piece-character-archive .frame-anime-character-native{display:none}.frame-one-piece-character-archive .frame-character-modal-portrait{width:min(230px,42vw);height:300px}@media(max-width:600px){.frame-one-piece-character-archive .frame-anime-character-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.frame-one-piece-character-archive .frame-anime-character-card{min-height:300px}.frame-one-piece-character-archive .frame-anime-character-portrait{height:185px}.frame-one-piece-character-archive .frame-anime-character-copy{padding:8px 9px 11px}.frame-one-piece-character-archive .frame-anime-character-copy>b{font-size:.9rem}.frame-one-piece-character-archive .frame-one-piece-rank{width:29px;height:29px;right:10px;top:10px}.frame-one-piece-character-archive .frame-one-piece-poster-label{left:10px;top:10px}}' : '';
  const [selectedCharacter, setSelectedCharacter] = useState<AnimeCharacterProfile | null>(null);
  if (!profiles.length && !loading && !failed) return null;
  return <section className={'frame-anime-characters detail-section' + (isOnePiece ? ' frame-one-piece-character-archive' : '')} aria-label={title + ' character profiles'}><style>{onePieceStyles}</style>
    <div className="detail-section-head">
      <div><small>{isOnePiece ? 'WANTED • MARINE ARCHIVE' : 'CHARACTER ARCHIVE'}</small><h3>{isOnePiece ? 'One Piece Characters' : 'Characters'}</h3></div>
      <span>{loading ? 'Loading…' : profiles.length ? profiles.length + (isOnePiece ? ' featured profiles' : ' profiles') : 'Unavailable'}</span>
    </div>
    {profiles.length > 0 ? <div className="frame-anime-character-grid" role="list">
      {profiles.map((character, index) => {
        const marine = isOnePiece && [...marineNames].some(name => name.toLowerCase() === character.name.toLowerCase());
        return <button type="button" className="frame-anime-character-card" key={(character.id || character.name) + '-' + index} onClick={() => setSelectedCharacter(character)} aria-label={'Open details for ' + character.name}>
          {isOnePiece && <span className="frame-one-piece-poster-label">{marine ? 'MARINE' : 'WANTED'}</span>}
          {isOnePiece && index < 10 && <span className="frame-one-piece-rank">#{index + 1}</span>}
          <div className="frame-anime-character-portrait"><CharacterPortrait character={character} /></div>
          <div className="frame-anime-character-copy">
            <b>{character.name}</b>
            <span>{marine ? 'Marine' : character.role ? character.role.charAt(0).toUpperCase() + character.role.slice(1).toLowerCase() : 'Character'}</span>
            <p>{shortDescription(character.description)}</p>
            <small className="frame-anime-character-open">Tap for details</small>
          </div>
        </button>;
      })}
    </div> : <p className="frame-anime-character-footnote">{loading ? 'Loading verified character names and portraits from AniList…' : 'Character profiles could not be loaded right now. Try reopening this anime later.'}</p>}
    <p className="frame-anime-character-footnote">Character names, roles and portraits are supplied by AniList. Missing portraits are shown as placeholders instead of unrelated artwork.</p>
    {selectedCharacter && <div className="frame-character-modal-backdrop" role="presentation" onClick={() => setSelectedCharacter(null)}>
      <div className="frame-character-modal" role="dialog" aria-modal="true" aria-label={selectedCharacter.name + ' character details'} onClick={event => event.stopPropagation()}>
        <button type="button" className="frame-character-modal-close" onClick={() => setSelectedCharacter(null)} aria-label="Close character details">×</button>
        <div className="frame-character-modal-portrait"><CharacterPortrait character={selectedCharacter} /></div>
        <div className="frame-character-modal-copy">
          <small>{isOnePiece ? 'WANTED / MARINE FILE' : 'CHARACTER PROFILE'}</small>
          <h4>{selectedCharacter.name}</h4>
          <b>{isOnePiece && [...marineNames].some(name => name.toLowerCase() === selectedCharacter.name.toLowerCase()) ? 'Marine' : selectedCharacter.role ? selectedCharacter.role.charAt(0).toUpperCase() + selectedCharacter.role.slice(1).toLowerCase() : 'Character'}</b>
          <p>{shortDescription(selectedCharacter.description)}</p>
          {selectedCharacter.sourceUrl && <a href={selectedCharacter.sourceUrl} target="_blank" rel="noreferrer">View source <ExternalLink size={12}/></a>}
        </div>
      </div>
    </div>}
  </section>;
}

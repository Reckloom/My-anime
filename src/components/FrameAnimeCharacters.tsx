import { useEffect, useState } from 'react';
import { ExternalLink, Users } from 'lucide-react';
import type { AnimeCharacterProfile } from '../types';
import { aniList, CHARACTERS_QUERY } from '../anilist';
import { posterImageSrc } from '../posterImage';

type AniListCharacterEdge = {
  role?: string | null;
  node?: {
    id?: number;
    name?: { full?: string | null; native?: string | null };
    image?: { large?: string | null };
    description?: string | null;
    siteUrl?: string | null;
  };
};
type AniListCharacterResponse = { Media?: { characters?: { edges?: AniListCharacterEdge[] } } };

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
  const [remoteCharacters,setRemoteCharacters] = useState<AnimeCharacterProfile[]>([]);
  const [loading,setLoading] = useState(false);
  const [failed,setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setRemoteCharacters([]);
    setFailed(false);
    const needsRemote = characters.length === 0 || characters.some(character => !character.image);
    if (!needsRemote || !anilistId) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    aniList<AniListCharacterResponse>(CHARACTERS_QUERY,{id:anilistId})
      .then(result => {
        const edges = result.Media?.characters?.edges || [];
        const mapped = edges.filter(edge => edge.node?.name?.full).map(edge => ({
          id: edge.node!.id,
          name: String(edge.node!.name!.full),
          nativeName: edge.node!.name!.native || undefined,
          role: edge.role || undefined,
          image: edge.node!.image?.large || undefined,
          description: edge.node!.description || undefined,
          sourceUrl: edge.node!.siteUrl || undefined
        }));
        if (active) {
          setRemoteCharacters(mapped);
          setFailed(mapped.length === 0);
        }
      })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [anilistId, characters.length]);

  const profiles = remoteCharacters.length ? remoteCharacters : characters;
  if (!profiles.length && !loading && !failed) return null;
  return <section className="frame-anime-characters detail-section" aria-label={title + ' character profiles'}>
    <div className="detail-section-head">
      <div><small>CHARACTER ARCHIVE</small><h3>Characters</h3></div>
      <span>{loading ? 'Loading…' : profiles.length ? profiles.length + ' profiles' : 'Unavailable'}</span>
    </div>
    {profiles.length > 0 ? <div className="frame-anime-character-grid">
      {profiles.map((character, index) => <article className="frame-anime-character-card" key={(character.id || character.name) + '-' + index}>
        <div className="frame-anime-character-portrait">
          <CharacterPortrait character={character} />
        </div>
        <div className="frame-anime-character-copy">
          <b>{character.name}</b>
          {character.nativeName && character.nativeName !== character.name && <small className="frame-anime-character-native">{character.nativeName}</small>}
          <span>{character.role ? character.role.charAt(0).toUpperCase() + character.role.slice(1).toLowerCase() : 'Character'}</span>
          <p>{shortDescription(character.description)}</p>
          {character.sourceUrl && <a href={character.sourceUrl} target="_blank" rel="noreferrer">Character source <ExternalLink size={11}/></a>}
        </div>
      </article>)}
    </div> : <p className="frame-anime-character-footnote">{loading ? 'Loading verified character names and portraits from AniList…' : 'Character profiles could not be loaded right now. Try reopening this anime later.'}</p>}
    <p className="frame-anime-character-footnote">Character names, roles and portraits are supplied by AniList. Missing portraits are shown as placeholders instead of unrelated artwork.</p>
  </section>;
}

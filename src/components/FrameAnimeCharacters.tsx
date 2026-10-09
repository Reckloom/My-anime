import { ExternalLink, Users } from 'lucide-react';
import type { AnimeCharacterProfile } from '../types';

function shortDescription(value?: string) {
  if (!value) return 'Character information was not supplied by the metadata source.';
  return value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

export function FrameAnimeCharacters({ title, characters }: { title: string; characters: AnimeCharacterProfile[] }) {
  if (!characters.length) return null;
  return <section className="frame-anime-characters detail-section" aria-label={title + ' character profiles'}>
    <div className="detail-section-head">
      <div><small>CHARACTER ARCHIVE</small><h3>Characters</h3></div>
      <span>{characters.length} profiles</span>
    </div>
    <div className="frame-anime-character-grid">
      {characters.map((character, index) => <article className="frame-anime-character-card" key={(character.id || character.name) + '-' + index}>
        <div className="frame-anime-character-portrait">
          {character.image ? <img src={character.image} alt={character.name + ' portrait'} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <span><Users size={21}/></span>}
        </div>
        <div className="frame-anime-character-copy">
          <b>{character.name}</b>
          {character.nativeName && character.nativeName !== character.name && <small className="frame-anime-character-native">{character.nativeName}</small>}
          <span>{character.role ? character.role.charAt(0).toUpperCase() + character.role.slice(1).toLowerCase() : 'Character'}</span>
          <p>{shortDescription(character.description)}</p>
          {character.sourceUrl && <a href={character.sourceUrl} target="_blank" rel="noreferrer">Character source <ExternalLink size={11}/></a>}
        </div>
      </article>)}
    </div>
    <p className="frame-anime-character-footnote">Profiles and portraits are linked to AniList character metadata. Missing portraits are left blank rather than substituted with unrelated artwork.</p>
  </section>;
}

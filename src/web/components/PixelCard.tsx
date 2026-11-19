import { useState, type KeyboardEvent } from 'react';
import type { Card } from '../../games/meowdeck/core/cards.js';
import { cardImage, SUIT_SYMBOL } from '../game/assets.js';
import type { T } from '../i18n.js';

export interface PixelCardProps {
  card: Card;
  t: T;
  playable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  onNavigate?: (direction: -1 | 1) => void;
}

const suitKey = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' } as const;
const rankKeys:Partial<Record<Card['rank'],'cardAce'|'cardJack'|'cardQueen'|'cardKing'>> = {
  A:'cardAce', J:'cardJack', Q:'cardQueen', K:'cardKing'
};
export function cardLabel(card: Card, t: T): string {
  const key=rankKeys[card.rank];
  return [key?t(key):card.rank,t('cardOf'),t(suitKey[card.suit])].filter(Boolean).join(' ');
}

export function PixelCard({ card, t, playable = false, selected = false, disabled = false, onSelect, onNavigate }: PixelCardProps) {
  const [failed, setFailed] = useState(false);
  const classes = ['card-tile', selected ? 'is-selected' : '', playable ? 'is-playable' : '', disabled ? 'is-disabled' : ''].filter(Boolean).join(' ');
  function handleKeys(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowLeft') { event.preventDefault(); onNavigate?.(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); onNavigate?.(1); }
  }
  return <button type="button" className={classes} disabled={disabled} aria-label={cardLabel(card, t)} aria-pressed={selected}
    data-testid={`card-${card.id}`} data-playable={playable ? 'true' : 'false'} onClick={onSelect} onKeyDown={handleKeys}>
    {failed ? <span className="card-fallback" role="img" aria-label={t('missingArt')}><b>{card.rank}</b><i>{SUIT_SYMBOL[card.suit]}</i></span>
      : <img className="pixel-art card-image" src={cardImage(card.id, true)} alt="" draggable={false} onError={() => setFailed(true)} />}
    {playable && <span className="playable-mark" aria-hidden="true">✦</span>}
  </button>;
}

export function CardBack({ small = false, label }: { small?: boolean; label: string }) {
  const [failed, setFailed] = useState(false);
  return <div className={`card-back ${small ? 'card-back-small' : ''}`} role="img" aria-label={label}>
    {failed ? <div className="back-fallback">✦</div> : <img className="pixel-art card-image" src={cardImage('card_back', true)} alt="" onError={() => setFailed(true)} />}
  </div>;
}

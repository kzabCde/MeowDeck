/** Stable identifiers from the v1.0.0 P0 Asset Contract (not image imports). */
export const SUITS = ['S', 'H', 'D', 'C'] as const;
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];
export type CardId = `${Rank}${Suit}`;
export type Actor = 'human' | 'ai';
export interface Card { readonly id: CardId; readonly rank: Rank; readonly suit: Suit; }
export type Deck = readonly Card[];

export const otherActor = (actor: Actor): Actor => actor === 'human' ? 'ai' : 'human';
export const isSuit = (value: unknown): value is Suit => SUITS.includes(value as Suit);

export function createStandardDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ id: `${rank}${suit}` as CardId, rank, suit })));
}

/** Engine-only utility. The renderer resolves image paths through the P0 card manifest. */
export function isCardId(value: string): value is CardId {
  return SUITS.some((suit) => RANKS.some((rank) => value === `${rank}${suit}`));
}

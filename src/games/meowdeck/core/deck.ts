import type { Card } from './cards.js';
import { randomIndex, secureRandomInt, type RandomInt } from './random.js';

/** Fisher–Yates: immutable input and a deterministic RNG boundary. */
export function shuffleDeck<T>(cards: readonly T[], rng: RandomInt): T[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(rng, i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function drawFromDeck<T>(deck: readonly T[]): { card: T | undefined; remaining: T[] } {
  if (!deck.length) return { card: undefined, remaining: [] };
  return { card: deck[deck.length - 1], remaining: deck.slice(0, -1) };
}

export function dealCards(deck: readonly Card[], count: number): { dealt: Card[]; remaining: Card[] } {
  if (!Number.isInteger(count) || count < 0 || count > deck.length) throw new RangeError('Invalid deal count');
  return { dealt: deck.slice(deck.length - count), remaining: deck.slice(0, -count || deck.length) };
}

/**
 * Deal a non-8 initial discard. An initial 8 returns to the pile, which is
 * reshuffled using the injected RNG. Fallback guarantees termination even for
 * a pathological deterministic RNG that repeatedly presents an eight.
 */
export function selectStarter(drawPile: readonly Card[], rng: RandomInt = secureRandomInt): { starter: Card; remaining: Card[] } {
  if (drawPile.every((card) => card.rank === '8')) throw new Error('Cannot start a round: only eights remain');
  let pile = [...drawPile];
  for (let attempt = 0; attempt < 16; attempt++) {
    const { card, remaining } = drawFromDeck(pile);
    if (card?.rank !== '8') {
      if (!card) throw new Error('Cannot start a round: no available starter');
      return { starter: card, remaining };
    }
    pile = shuffleDeck([...remaining, card], rng);
  }
  const index = pile.findLastIndex((card) => card.rank !== '8');
  return { starter: pile[index]!, remaining: [...pile.slice(0, index), ...pile.slice(index + 1)] };
}

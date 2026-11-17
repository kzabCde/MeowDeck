import type { Actor, Card } from '../../core/cards.js';
import type { RoundResult } from '../../core/game-types.js';

export function calculateHandPenalty(cards: readonly Card[]): number {
  return cards.reduce((total, card) => total + (card.rank === '8' ? 50 : card.rank === 'A' ? 1 : ['J', 'Q', 'K'].includes(card.rank) ? 10 : Number(card.rank)), 0);
}

export function resolveBlockedRound(roundNumber: number, humanHand: readonly Card[], aiHand: readonly Card[]): RoundResult {
  const penalties = { human: calculateHandPenalty(humanHand), ai: calculateHandPenalty(aiHand) };
  const winner: Actor | null = penalties.human === penalties.ai ? null : penalties.human < penalties.ai ? 'human' : 'ai';
  return { roundNumber, reason: 'blocked', winner, penalties, handCounts: { human: humanHand.length, ai: aiHand.length } };
}

export function resolveEmptyHandRound(roundNumber: number, winner: Actor, humanHand: readonly Card[], aiHand: readonly Card[]): RoundResult {
  return { roundNumber, reason: 'empty_hand', winner, penalties: { human: calculateHandPenalty(humanHand), ai: calculateHandPenalty(aiHand) }, handCounts: { human: humanHand.length, ai: aiHand.length } };
}

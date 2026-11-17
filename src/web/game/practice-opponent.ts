import type { Suit } from '../../games/meowdeck/core/cards.js';
import type { AIObservation } from '../../games/meowdeck/games/crazy-eights/ai-observation.js';
import type { LegalAction } from '../../games/meowdeck/core/game-types.js';

/** P2 legal-action driver only. Real Easy/Normal/Hard tactics belong to P3.
 * The input is the P1 sanitized observation; it cannot inspect human cards or deck identities.
 */
export function choosePracticeMove(observation: AIObservation): { action: LegalAction; selectedSuit?: Suit } {
  const legal = observation.legalActions;
  if (!legal.length) throw new Error('No legal actions for practice opponent');
  const selected = legal.find((action) => action.type === 'play_card' && !action.cardId.startsWith('8'))
    ?? legal.find((action) => action.type === 'play_card')
    ?? legal[0]!;
  if (selected.type !== 'play_card' || !selected.requiresSuit) return { action: selected };
  const remaining = observation.ownHand.filter((card) => card.id !== selected.cardId);
  const counts: Record<Suit, number> = { S: 0, H: 0, D: 0, C: 0 };
  for (const card of remaining) counts[card.suit] += 1;
  const best = (['S', 'H', 'D', 'C'] as const).reduce((choice, candidate) => counts[candidate] > counts[choice] ? candidate : choice);
  return { action: selected, selectedSuit: best };
}

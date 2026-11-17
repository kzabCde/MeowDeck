import type { Card } from '../../core/cards.js';
import type { GameState, LegalAction } from '../../core/game-types.js';
import { getLegalActions } from './rules.js';
import { getPublicGameState, type PublicGameState } from './selectors.js';

/** P3 strategy input: deliberately no humanHand, drawPile identities, RNG, or pending private card ID. */
export interface AIObservation extends PublicGameState {
  readonly ownHand: readonly Card[];
  readonly opponentHandCount: number;
  readonly legalActions: readonly LegalAction[];
}

export function createAIObservation(state: GameState): AIObservation {
  return {
    ...getPublicGameState(state),
    hasPendingDrawDecision: state.currentActor === 'ai' && state.pendingDrawnCardId !== null,
    ownHand: state.aiHand.map((card) => ({ ...card })),
    opponentHandCount: state.humanHand.length,
    legalActions: getLegalActions(state, 'ai')
  };
}

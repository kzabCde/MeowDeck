import type { Actor, Card, Suit } from '../../core/cards.js';
import type { GameState, LegalAction, Phase, PublicAction, RoundResult } from '../../core/game-types.js';
import { getLegalActions } from './rules.js';

export interface PublicGameState {
  readonly gameId: 'crazy-eights';
  readonly sessionId: string;
  readonly roundNumber: number;
  readonly phase: Phase;
  readonly currentActor: Actor;
  readonly turnId: number;
  readonly scores: Readonly<Record<Actor, number>>;
  readonly handCounts: Readonly<Record<Actor, number>>;
  readonly drawPileCount: number;
  readonly discardPileCount: number;
  readonly topDiscard: Card;
  readonly activeSuit: Suit;
  readonly hasPendingDrawDecision: boolean;
  readonly roundResult: RoundResult | null;
  readonly matchWinner: Actor | null;
  readonly publicHistory: readonly PublicAction[];
}

/** Whitelist public fields; never spread the authoritative state. */
export function getPublicGameState(state: GameState): PublicGameState {
  return {
    gameId: state.gameId, sessionId: state.sessionId, roundNumber: state.roundNumber,
    phase: state.phase, currentActor: state.currentActor, turnId: state.turnId,
    scores: { ...state.scores }, handCounts: { human: state.humanHand.length, ai: state.aiHand.length },
    drawPileCount: state.drawPile.length, discardPileCount: state.discardPile.length,
    topDiscard: { ...state.discardPile[state.discardPile.length - 1]! }, activeSuit: state.activeSuit,
    hasPendingDrawDecision: state.currentActor === 'human' && state.pendingDrawnCardId !== null,
    roundResult: state.roundResult ? { ...state.roundResult, penalties: { ...state.roundResult.penalties }, handCounts: { ...state.roundResult.handCounts } } : null,
    matchWinner: state.matchWinner,
    publicHistory: state.publicHistory.map((event) => ({ ...event }))
  };
}

/** P2 UI facade: human sees own hand and public match information, not Mochi's cards. */
export function getHumanView(state: GameState): PublicGameState & { readonly ownHand: readonly Card[]; readonly legalActions: readonly LegalAction[] } {
  return { ...getPublicGameState(state), ownHand: state.humanHand.map((card) => ({ ...card })), legalActions: getLegalActions(state, 'human') };
}
export const getCurrentActor = (state: GameState): Actor => state.currentActor;
export const getActiveSuit = (state: GameState): Suit => state.activeSuit;
export const getRoundStatus = (state: GameState): RoundResult | null => getPublicGameState(state).roundResult;
export const getMatchStatus = (state: GameState): Actor | null => state.matchWinner;

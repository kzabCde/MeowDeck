import { otherActor, isSuit, type Actor, type Card, type Suit } from '../../core/cards.js';
import type { GameAction, GameError, GameState, GameplayAction, LegalAction } from '../../core/game-types.js';

export function handOf(state: GameState, actor: Actor): readonly Card[] {
  return actor === 'human' ? state.humanHand : state.aiHand;
}

export function isPlayable(card: Card, topDiscard: Card, activeSuit: Suit): boolean {
  return card.rank === '8' || card.rank === topDiscard.rank || card.suit === activeSuit;
}

export function getPlayableCards(state: GameState, actor = state.currentActor): readonly Card[] {
  const hand = handOf(state, actor);
  const topDiscard = state.discardPile[state.discardPile.length - 1];
  if (!topDiscard || actor !== state.currentActor || !['human_turn', 'ai_thinking'].includes(state.phase)) return [];
  if (state.pendingDrawnCardId) {
    return hand.filter((card) => card.id === state.pendingDrawnCardId && isPlayable(card, topDiscard, state.activeSuit));
  }
  return hand.filter((card) => isPlayable(card, topDiscard, state.activeSuit));
}

export function canDraw(state: GameState): boolean {
  return state.drawPile.length > 0 || state.discardPile.length > 1;
}

export function getLegalActions(state: GameState, actor = state.currentActor): readonly LegalAction[] {
  if ((state.phase !== 'human_turn' && state.phase !== 'ai_thinking') || actor !== state.currentActor) return [];
  const playable = getPlayableCards(state, actor);
  const plays: LegalAction[] = playable.map((card) => ({
    type: 'play_card', cardId: card.id, requiresSuit: card.rank === '8' && handOf(state, actor).length > 1
  }));
  if (state.pendingDrawnCardId) return [...plays, { type: 'finish_turn' }];
  if (plays.length) return plays;
  return canDraw(state) ? [{ type: 'draw_card' }] : [{ type: 'pass_turn' }];
}

function err(code: GameError['code'], message: string): { ok: false; error: GameError } {
  return { ok: false, error: { code, message } };
}
export type ValidationResult = { readonly ok: true } | { readonly ok: false; readonly error: GameError };

/** Does not read RNG or mutate any part of state. */
export function validateAction(state: GameState, action: GameAction): ValidationResult {
  if (!action.actionId || typeof action.actionId !== 'string') return err('INVALID_ACTION', 'actionId is required');
  if (state.processedActionIds.includes(action.actionId)) return err('DUPLICATE_ACTION', 'actionId already committed');

  if (action.type === 'restart_match') {
    if (!action.newSessionId || typeof action.newSessionId !== 'string') return err('INVALID_SESSION_ID', 'newSessionId is required');
    if (state.sessionId === action.newSessionId) return err('INVALID_SESSION_ID', 'Restart requires a new session ID');
    return { ok: true };
  }
  if (action.type === 'start_next_round') {
    if (state.roundNumber !== action.expectedRoundNumber) return err('STALE_ACTION', 'Expected round number differs');
    return state.phase === 'round_end' ? { ok: true } : err('INVALID_PHASE', 'Only a completed nonterminal round may advance');
  }
  if (action.expectedTurnId !== state.turnId) return err('STALE_ACTION', 'Action was created for a previous turn');
  if (state.phase === 'match_end' || state.phase === 'round_end') return err('ROUND_FINISHED', 'Round no longer accepts actions');
  if (action.actor !== state.currentActor) return err('WRONG_TURN', 'Action belongs to the other actor');
  if ((state.phase === 'human_turn') !== (action.actor === 'human')) return err('INVALID_PHASE', 'Actor cannot play during this phase');
  const legal = getLegalActions(state, action.actor);
  if (action.type === 'play_card') {
    const card = handOf(state, action.actor).find((item) => item.id === action.cardId);
    if (!card) return err('CARD_NOT_OWNED', 'The submitted card is not in the actor hand');
    const play = legal.find((item) => item.type === 'play_card' && item.cardId === action.cardId);
    if (!play || play.type !== 'play_card') return err('ILLEGAL_CARD', 'Card is not legal in the current turn');
    if (play.requiresSuit && action.selectedSuit === undefined) return err('SUIT_REQUIRED', 'Wild card requires a selected suit');
    if (action.selectedSuit !== undefined && !isSuit(action.selectedSuit)) return err('INVALID_SUIT', 'Selected suit is invalid');
    if (card.rank !== '8' && action.selectedSuit !== undefined) return err('INVALID_SUIT', 'Only an eight can choose a suit');
    return { ok: true };
  }
  if (action.type === 'draw_card') return legal.some((item) => item.type === 'draw_card') ? { ok: true } : err('CANNOT_DRAW', 'Draw is not legal');
  if (action.type === 'finish_turn') return legal.some((item) => item.type === 'finish_turn') ? { ok: true } : err('CANNOT_FINISH_TURN', 'No pending draw decision');
  if (action.type === 'pass_turn') return legal.some((item) => item.type === 'pass_turn') ? { ok: true } : err('CANNOT_PASS', 'Passing is not legal');
  return err('INVALID_ACTION', 'Unknown action type');
}

export function nextActor(state: GameState): Actor { return otherActor(state.currentActor); }
export type { GameplayAction };

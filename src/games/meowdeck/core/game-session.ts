import { createStandardDeck, otherActor, type Actor, type Card, type Suit } from './cards.js';
import { dealCards, drawFromDeck, selectStarter, shuffleDeck } from './deck.js';
import { secureRandomInt, type RandomInt } from './random.js';
import type { ActionResult, DomainEvent, GameAction, GameState, RoundResult, PublicAction } from './game-types.js';
import { resolveBlockedRound, resolveEmptyHandRound } from '../games/crazy-eights/scoring.js';
import { isPlayable, validateAction } from '../games/crazy-eights/rules.js';

export interface NewMatchOptions { readonly sessionId: string; readonly rng?: RandomInt; }

function roundSetup(sessionId: string, roundNumber: number, scores: GameState['scores'], rng: RandomInt, processedActionIds: readonly string[] = [], turnId = 1): GameState {
  const cards = shuffleDeck(createStandardDeck(), rng);
  const human = dealCards(cards, 7);
  const ai = dealCards(human.remaining, 7);
  const { starter, remaining } = selectStarter(ai.remaining, rng);
  const currentActor: Actor = roundNumber % 2 === 1 ? 'human' : 'ai';
  return {
    schemaVersion: 1, gameId: 'crazy-eights', sessionId, roundNumber, scores: { ...scores },
    currentActor, phase: currentActor === 'human' ? 'human_turn' : 'ai_thinking', turnId,
    humanHand: human.dealt, aiHand: ai.dealt, drawPile: remaining, discardPile: [starter],
    activeSuit: starter.suit, pendingDrawnCardId: null, blockedTurns: 0,
    roundResult: null, matchWinner: null, publicHistory: [], processedActionIds: [...processedActionIds]
  };
}

export function createMatch({ sessionId, rng = secureRandomInt }: NewMatchOptions): GameState {
  if (!sessionId?.trim()) throw new Error('createMatch requires a nonempty sessionId');
  return roundSetup(sessionId, 1, { human: 0, ai: 0 }, rng);
}

/** Optional initial presentation events for P2/P3; createMatch remains state-only. */
export function createMatchWithEvents(options: NewMatchOptions): { state: GameState; events: readonly DomainEvent[] } {
  const state = createMatch(options);
  return { state, events: [
    { type: 'MATCH_STARTED', sessionId: state.sessionId, visibility: 'public' },
    { type: 'ROUND_STARTED', roundNumber: 1, starter: 'human', visibility: 'public' }
  ] };
}

function nextTurn(state: GameState): GameState {
  const currentActor = otherActor(state.currentActor);
  return { ...state, currentActor, phase: currentActor === 'human' ? 'human_turn' : 'ai_thinking', turnId: state.turnId + 1, pendingDrawnCardId: null };
}

function endRound(state: GameState, result: RoundResult): { state: GameState; events: DomainEvent[] } {
  const scores = { ...state.scores };
  if (result.winner) scores[result.winner] += 1;
  const matchWinner = scores.human >= 3 ? 'human' : scores.ai >= 3 ? 'ai' : null;
  const next: GameState = { ...state, roundResult: result, scores, matchWinner, phase: matchWinner ? 'match_end' : 'round_end', pendingDrawnCardId: null };
  const events: DomainEvent[] = [{ type: 'ROUND_ENDED', result: { ...result, penalties: { ...result.penalties }, handCounts: { ...result.handCounts } }, visibility: 'public' }];
  if (matchWinner) events.push({ type: 'MATCH_ENDED', winner: matchWinner, scores, visibility: 'public' });
  return { state: next, events };
}

function success(state: GameState, events: DomainEvent[]): ActionResult { return { ok: true, state, events }; }

/**
 * Pure, synchronous state machine. Pass an injectable RNG for deterministic tests.
 * The only default external dependency is WebCrypto when shuffling/recycling is necessary.
 */
export function applyAction(state: GameState, action: GameAction, rng: RandomInt = secureRandomInt): ActionResult {
  const validation = validateAction(state, action);
  if (!validation.ok) return { ok: false, state, events: [], error: validation.error };

  if (action.type === 'restart_match') {
    const restarted = roundSetup(action.newSessionId, 1, { human: 0, ai: 0 }, rng, [action.actionId]);
    return success(restarted, [
      { type: 'MATCH_STARTED', sessionId: restarted.sessionId, visibility: 'public' },
      { type: 'ROUND_STARTED', roundNumber: 1, starter: 'human', visibility: 'public' }
    ]);
  }
  if (action.type === 'start_next_round') {
    const next = roundSetup(state.sessionId, state.roundNumber + 1, state.scores, rng,
      [...state.processedActionIds, action.actionId], state.turnId + 1);
    return success(next, [
      { type: 'ROUND_STARTED', roundNumber: next.roundNumber, starter: next.currentActor, visibility: 'public' },
      { type: 'TURN_CHANGED', actor: next.currentActor, turnId: next.turnId, visibility: 'public' }
    ]);
  }

  const stamp = [...state.processedActionIds, action.actionId];
  const currentActor = action.actor;
  const publicEvent = (entry: PublicAction): readonly PublicAction[] => [...state.publicHistory, entry];

  if (action.type === 'play_card') {
    const hand = currentActor === 'human' ? state.humanHand : state.aiHand;
    const played = hand.find((card) => card.id === action.cardId)!;
    const reduced = hand.filter((card) => card.id !== played.id);
    const activeSuit: Suit = played.rank === '8' ? (action.selectedSuit ?? played.suit) : played.suit;
    const next: GameState = {
      ...state,
      humanHand: currentActor === 'human' ? reduced : state.humanHand,
      aiHand: currentActor === 'ai' ? reduced : state.aiHand,
      discardPile: [...state.discardPile, played], activeSuit, pendingDrawnCardId: null,
      blockedTurns: 0, processedActionIds: stamp,
      publicHistory: publicEvent({ type: 'CARD_PLAYED', actor: currentActor, cardId: played.id, roundNumber: state.roundNumber,
        ...(played.rank === '8' ? { chosenSuit: activeSuit } : {}) })
    };
    const events: DomainEvent[] = [{ type: 'CARD_PLAYED', actor: currentActor, cardId: played.id, visibility: 'public' }];
    if (played.rank === '8' || activeSuit !== state.activeSuit) events.push({ type: 'SUIT_CHANGED', actor: currentActor, suit: activeSuit, visibility: 'public' });
    if (!reduced.length) {
      const result = resolveEmptyHandRound(state.roundNumber, currentActor, next.humanHand, next.aiHand);
      const ended = endRound(next, result);
      return success(ended.state, [...events, ...ended.events]);
    }
    const advanced = nextTurn(next);
    events.push({ type: 'TURN_CHANGED', actor: advanced.currentActor, turnId: advanced.turnId, visibility: 'public' });
    return success(advanced, events);
  }

  if (action.type === 'draw_card') {
    let drawPile: readonly Card[] = state.drawPile;
    let discardPile: readonly Card[] = state.discardPile;
    const events: DomainEvent[] = [];
    if (drawPile.length === 0) {
      const top = discardPile[discardPile.length - 1]!;
      const recyclable = discardPile.slice(0, -1);
      drawPile = shuffleDeck(recyclable, rng);
      discardPile = [top];
      events.push({ type: 'DRAW_PILE_RECYCLED', count: recyclable.length, visibility: 'public' });
    }
    const { card: drawn, remaining } = drawFromDeck(drawPile);
    if (!drawn) throw new Error('Invariant violated: validated draw but no card is available');
    const hand = currentActor === 'human' ? state.humanHand : state.aiHand;
    const top = discardPile[discardPile.length - 1]!;
    const pendingDrawnCardId = isPlayable(drawn, top, state.activeSuit) ? drawn.id : null;
    let next: GameState = {
      ...state,
      humanHand: currentActor === 'human' ? [...hand, drawn] : state.humanHand,
      aiHand: currentActor === 'ai' ? [...hand, drawn] : state.aiHand,
      drawPile: remaining, discardPile, pendingDrawnCardId, blockedTurns: 0,
      processedActionIds: stamp,
      publicHistory: publicEvent({ type: 'CARD_DRAWN', actor: currentActor, count: 1, roundNumber: state.roundNumber })
    };
    events.push({ type: 'CARD_DRAWN', actor: currentActor, count: 1, visibility: 'public' });
    if (!pendingDrawnCardId) {
      next = nextTurn(next);
      events.push({ type: 'TURN_CHANGED', actor: next.currentActor, turnId: next.turnId, visibility: 'public' });
    }
    return success(next, events);
  }

  if (action.type === 'finish_turn') {
    const next = nextTurn({ ...state, processedActionIds: stamp });
    return success(next, [{ type: 'TURN_CHANGED', actor: next.currentActor, turnId: next.turnId, visibility: 'public' }]);
  }

  if (action.type === 'pass_turn') {
    const publicHistory = publicEvent({ type: 'TURN_PASSED', actor: currentActor, roundNumber: state.roundNumber });
    const stalled: GameState = { ...state, processedActionIds: stamp, publicHistory, blockedTurns: state.blockedTurns + 1 };
    const events: DomainEvent[] = [];
    if (stalled.blockedTurns >= 2) {
      const result = resolveBlockedRound(state.roundNumber, state.humanHand, state.aiHand);
      const ended = endRound(stalled, result);
      return success(ended.state, [...events, ...ended.events]);
    }
    const next = nextTurn(stalled);
    events.push({ type: 'TURN_CHANGED', actor: next.currentActor, turnId: next.turnId, visibility: 'public' });
    return success(next, events);
  }
  throw new Error('Unknown gameplay action');
}

/** Verify conservation at engine boundaries without depending on a renderer. */
export function assertCardConservation(state: GameState): void {
  const ids = [...state.humanHand, ...state.aiHand, ...state.drawPile, ...state.discardPile].map((card) => card.id);
  const required = new Set(createStandardDeck().map((card) => card.id));
  if (ids.length !== 52 || new Set(ids).size !== 52 || ids.some((id) => !required.has(id))) {
    throw new Error(`Card conservation violated: ${ids.length} cards / ${new Set(ids).size} unique`);
  }
  if (!state.discardPile.length || !state.discardPile[state.discardPile.length - 1]) throw new Error('Discard pile has no top card');
}

export function startNextRound(state: GameState, actionId: string, rng?: RandomInt): ActionResult {
  return applyAction(state, { type: 'start_next_round', expectedRoundNumber: state.roundNumber, actionId }, rng);
}

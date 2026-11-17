import type { Actor, Card, CardId, Suit } from './cards.js';

export type Phase = 'human_turn' | 'ai_thinking' | 'round_end' | 'match_end';
export type RoundEndReason = 'empty_hand' | 'blocked';
export type PublicAction =
  | { readonly type: 'CARD_PLAYED'; readonly actor: Actor; readonly cardId: CardId; readonly chosenSuit?: Suit; readonly roundNumber: number }
  | { readonly type: 'CARD_DRAWN'; readonly actor: Actor; readonly count: 1; readonly roundNumber: number }
  | { readonly type: 'TURN_PASSED'; readonly actor: Actor; readonly roundNumber: number };

export interface RoundResult {
  readonly roundNumber: number;
  readonly reason: RoundEndReason;
  readonly winner: Actor | null;
  readonly penalties: Readonly<Record<Actor, number>>;
  readonly handCounts: Readonly<Record<Actor, number>>;
}

/** The sole authoritative, serializable session state. Never pass to the AI adapter. */
export interface GameState {
  readonly schemaVersion: 1;
  readonly sessionId: string;
  readonly gameId: 'crazy-eights';
  readonly roundNumber: number;
  readonly scores: Readonly<Record<Actor, number>>;
  readonly phase: Phase;
  readonly currentActor: Actor;
  readonly turnId: number;
  readonly humanHand: readonly Card[];
  readonly aiHand: readonly Card[];
  readonly drawPile: readonly Card[];
  readonly discardPile: readonly Card[];
  readonly activeSuit: Suit;
  /** Only the newly drawn card is eligible while waiting for a draw-or-finish decision. */
  readonly pendingDrawnCardId: CardId | null;
  readonly blockedTurns: number;
  readonly roundResult: RoundResult | null;
  readonly matchWinner: Actor | null;
  readonly publicHistory: readonly PublicAction[];
  readonly processedActionIds: readonly string[];
}

export type GameplayAction =
  | { readonly type: 'play_card'; readonly actor: Actor; readonly cardId: CardId; readonly selectedSuit?: Suit; readonly expectedTurnId: number; readonly actionId: string }
  | { readonly type: 'draw_card'; readonly actor: Actor; readonly expectedTurnId: number; readonly actionId: string }
  | { readonly type: 'finish_turn'; readonly actor: Actor; readonly expectedTurnId: number; readonly actionId: string }
  | { readonly type: 'pass_turn'; readonly actor: Actor; readonly expectedTurnId: number; readonly actionId: string };

export type GameAction = GameplayAction
  | { readonly type: 'start_next_round'; readonly expectedRoundNumber: number; readonly actionId: string }
  | { readonly type: 'restart_match'; readonly newSessionId: string; readonly actionId: string };

export type LegalAction =
  | { readonly type: 'play_card'; readonly cardId: CardId; readonly requiresSuit: boolean }
  | { readonly type: 'draw_card' }
  | { readonly type: 'finish_turn' }
  | { readonly type: 'pass_turn' };

export type GameErrorCode =
  | 'INVALID_PHASE' | 'WRONG_TURN' | 'CARD_NOT_OWNED' | 'ILLEGAL_CARD'
  | 'SUIT_REQUIRED' | 'INVALID_SUIT' | 'CANNOT_DRAW' | 'CANNOT_PASS'
  | 'CANNOT_FINISH_TURN' | 'STALE_ACTION' | 'DUPLICATE_ACTION' | 'ROUND_FINISHED'
  | 'INVALID_ACTION' | 'INVALID_SESSION_ID';

export interface GameError { readonly code: GameErrorCode; readonly message: string; }

export type DomainEvent =
  | { readonly type: 'MATCH_STARTED'; readonly sessionId: string; readonly visibility: 'public' }
  | { readonly type: 'ROUND_STARTED'; readonly roundNumber: number; readonly starter: Actor; readonly visibility: 'public' }
  | { readonly type: 'CARD_PLAYED'; readonly actor: Actor; readonly cardId: CardId; readonly visibility: 'public' }
  | { readonly type: 'CARD_DRAWN'; readonly actor: Actor; readonly count: 1; readonly visibility: 'public' }
  | { readonly type: 'SUIT_CHANGED'; readonly actor: Actor; readonly suit: Suit; readonly visibility: 'public' }
  | { readonly type: 'TURN_CHANGED'; readonly actor: Actor; readonly turnId: number; readonly visibility: 'public' }
  | { readonly type: 'DRAW_PILE_RECYCLED'; readonly count: number; readonly visibility: 'public' }
  | { readonly type: 'ROUND_ENDED'; readonly result: RoundResult; readonly visibility: 'public' }
  | { readonly type: 'MATCH_ENDED'; readonly winner: Actor; readonly scores: Readonly<Record<Actor, number>>; readonly visibility: 'public' };

export type ActionResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly DomainEvent[] }
  | { readonly ok: false; readonly state: GameState; readonly events: readonly []; readonly error: GameError };

import { createStandardDeck, isCardId, isSuit, type Card, type Actor } from '../../games/meowdeck/core/cards.js';
import { assertCardConservation } from '../../games/meowdeck/core/game-session.js';
import type { GameState, PublicAction } from '../../games/meowdeck/core/game-types.js';
import type { Difficulty } from '../../games/meowdeck/ai/strategies.js';

export type StoredDifficulty = Difficulty;
export interface SavedMatchV1 {
  readonly schemaVersion: 1;
  readonly gameId: 'crazy-eights';
  readonly sessionId: string;
  readonly savedAt: string;
  readonly revision: number;
  readonly difficulty: StoredDifficulty;
  readonly nextActionSequence: number;
  readonly gameState: GameState;
}

export type SaveValidation = { readonly ok: true; readonly save: SavedMatchV1 } | { readonly ok: false; readonly reason: string };
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 4096;
const safeInt = (v: unknown, min=0): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const actor = (v: unknown): v is Actor => v === 'human' || v === 'ai';
const isDifficulty = (v: unknown): v is StoredDifficulty => v === 'practice' || v === 'easy' || v === 'normal' || v === 'hard';
const phases = new Set(['human_turn','ai_thinking','round_end','match_end']);
function card(v: unknown): v is Card {
  if (!isObject(v) || typeof v.id !== 'string' || !isCardId(v.id)) return false;
  const original = createStandardDeck().find(c=>c.id === v.id);
  return original?.rank === v.rank && original?.suit === v.suit;
}
function history(v: unknown, roundNumber: number): v is readonly PublicAction[] {
  if(!Array.isArray(v) || v.length > 5000)return false;
  return v.every(e=>isObject(e) && actor(e.actor) && safeInt(e.roundNumber,1) && e.roundNumber===roundNumber &&
    ((e.type==='CARD_PLAYED' && typeof e.cardId==='string' && isCardId(e.cardId) && (!('chosenSuit' in e) || isSuit(e.chosenSuit))) ||
    (e.type==='CARD_DRAWN' && e.count===1 && !('cardId' in e)) ||
    (e.type==='TURN_PASSED')));
}
function validateState(v: unknown): v is GameState {
  if(!isObject(v)||v.schemaVersion!==1||v.gameId!=='crazy-eights'||!nonempty(v.sessionId)||!safeInt(v.roundNumber,1)||!safeInt(v.turnId,1)||!safeInt(v.blockedTurns,0)||
    !phases.has(String(v.phase))||!actor(v.currentActor)||!isSuit(v.activeSuit))return false;
  if (!isObject(v.scores)||!safeInt(v.scores.human)||!safeInt(v.scores.ai)||v.scores.human>3||v.scores.ai>3 || v.scores.human+v.scores.ai>v.roundNumber)return false;
  const arrays = [v.humanHand,v.aiHand,v.drawPile,v.discardPile];
  if(arrays.some(x=>!Array.isArray(x)||x.length>52||!x.every(card)) || !(v.discardPile as unknown[]).length) return false;
  if(!history(v.publicHistory,v.roundNumber)||!Array.isArray(v.processedActionIds)||v.processedActionIds.length>10000||!v.processedActionIds.every(nonempty)||new Set(v.processedActionIds).size!==v.processedActionIds.length)return false;
  if(v.phase==='human_turn'&&v.currentActor!=='human' || v.phase==='ai_thinking'&&v.currentActor!=='ai')return false;
  if(v.pendingDrawnCardId!==null){
    if(typeof v.pendingDrawnCardId!=='string'||!isCardId(v.pendingDrawnCardId)||!['human_turn','ai_thinking'].includes(String(v.phase)))return false;
    const hand = v.currentActor==='human'?v.humanHand as Card[]:v.aiHand as Card[];
    const pending=hand.find(x=>x.id===v.pendingDrawnCardId);
    if(!pending)return false;
    const top=(v.discardPile as Card[]).at(-1)!;
    if(!(pending.rank==='8'||pending.rank===top.rank||pending.suit===v.activeSuit))return false;
  }
  if(v.phase==='round_end'||v.phase==='match_end'){
    if(!isObject(v.roundResult)||v.roundResult.roundNumber!==v.roundNumber||(!actor(v.roundResult.winner)&&v.roundResult.winner!==null)||
       !['empty_hand','blocked'].includes(String(v.roundResult.reason))||!isObject(v.roundResult.penalties)||!isObject(v.roundResult.handCounts))return false;
    if(![v.roundResult.penalties.human,v.roundResult.penalties.ai,v.roundResult.handCounts.human,v.roundResult.handCounts.ai].every(x=>safeInt(x)))return false;
    if(v.roundResult.handCounts.human!==(v.humanHand as Card[]).length||v.roundResult.handCounts.ai!==(v.aiHand as Card[]).length)return false;
    if(v.roundResult.winner==='human'&&v.scores.human<1 || v.roundResult.winner==='ai'&&v.scores.ai<1)return false;
  }else if(v.roundResult!==null) return false;
  if(v.phase==='match_end'){
    if(!actor(v.matchWinner)||v.scores[v.matchWinner]!==3)return false;
  }else if(v.matchWinner!==null)return false;
  try{assertCardConservation(v as unknown as GameState);}catch{return false;}
  return true;
}
/** Rejects unsupported versions rather than guessing the identities of private cards. */
export function validateSavedMatch(input:unknown):SaveValidation {
  if(!isObject(input))return {ok:false,reason:'not_an_object'};
  if(input.schemaVersion!==1)return {ok:false,reason:'unsupported_save_version'};
  if(input.gameId!=='crazy-eights'||!nonempty(input.sessionId)||!nonempty(input.savedAt)||!Number.isFinite(Date.parse(input.savedAt))||
    !safeInt(input.revision,0)||!isDifficulty(input.difficulty)||!safeInt(input.nextActionSequence,1)||!validateState(input.gameState))return {ok:false,reason:'corrupted_save'};
  if(input.sessionId!==input.gameState.sessionId||input.gameState.phase==='match_end')return {ok:false,reason:'not_active_match'};
  const actionSeq = input.nextActionSequence as number;
  const savedSessionId = input.sessionId as string;
  const reserved = (input.gameState.processedActionIds as string[]).some(id=>{
    const match = new RegExp(`^${savedSessionId.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}:ui:(\\d+)$`).exec(id);
    return match && Number(match[1]) >= actionSeq;
  });
  if(reserved)return {ok:false,reason:'action_sequence_conflict'};
  return {ok:true,save:input as unknown as SavedMatchV1};
}
export function makeSavedMatch(state:GameState,difficulty:StoredDifficulty,nextActionSequence:number,revision=0):SavedMatchV1{
  return {schemaVersion:1,gameId:'crazy-eights',sessionId:state.sessionId,savedAt:new Date().toISOString(),revision,difficulty,nextActionSequence,gameState:state};
}

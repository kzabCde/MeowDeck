/** P5 Blackjack: deterministic headless engine, separate from Crazy Eights.
 * 52-card fresh shuffle per round, no wagering, split, double-down or insurance.
 * Dealer stands on all 17s, including soft 17. */
import { createStandardDeck, isCardId, type Card, type CardId } from '../../core/cards.js';
import { shuffleDeck } from '../../core/deck.js';
import { secureRandomInt, type RandomInt } from '../../core/random.js';

export type BlackjackOutcome='human'|'dealer'|'push';
export type BlackjackPhase='player'|'finished';
export type BlackjackReason='player_natural'|'dealer_natural'|'both_natural'|'player_bust'|'dealer_bust'|'higher_total'|'equal_total';
export interface BlackjackScore { readonly human:number;readonly dealer:number;readonly pushes:number }
export interface BlackjackState {
 readonly game:'blackjack';
 readonly schemaVersion:1;
 readonly round:number;
 readonly revision:number;
 readonly deck:readonly Card[];
 readonly player:readonly Card[];
 readonly dealer:readonly Card[];
 readonly phase:BlackjackPhase;
 readonly outcome:BlackjackOutcome|null;
 readonly reason:BlackjackReason|null;
 readonly score:BlackjackScore;
}
export type BlackjackAction={readonly type:'hit'|'stand'|'next_round';readonly expectedRevision:number;readonly actionId:string};
export type BlackjackResult={readonly ok:true;readonly state:BlackjackState}|{readonly ok:false;readonly state:BlackjackState;readonly error:'STALE'|'ILLEGAL'};

export function blackjackValue(hand:readonly Card[]):{total:number;soft:boolean}{
 let total=0,aces=0;
 for(const card of hand){
   if(card.rank==='A'){aces++;total+=1;}
   else if(['J','Q','K'].includes(card.rank))total+=10;
   else total+=Number(card.rank);
 }
 const soft=aces>0&&total+10<=21;
 if(soft)total+=10;
 return {total,soft};
}
export const isNatural=(hand:readonly Card[]):boolean=>hand.length===2&&blackjackValue(hand).total===21;
function fromTop(cards:readonly Card[]):{card:Card;deck:Card[]}{
 const card=cards[cards.length-1];
 if(!card)throw Error('Blackjack deck exhausted');
 return {card,deck:cards.slice(0,-1)};
}
function tally(score:BlackjackScore,outcome:BlackjackOutcome):BlackjackScore{
 return {human:score.human+(outcome==='human'?1:0),dealer:score.dealer+(outcome==='dealer'?1:0),pushes:score.pushes+(outcome==='push'?1:0)};
}
function finish(state:BlackjackState,outcome:BlackjackOutcome,reason:BlackjackReason):BlackjackState{
 return {...state,phase:'finished',outcome,reason,score:tally(state.score,outcome)};
}
function deal(round:number,revision:number,score:BlackjackScore,rng:RandomInt):BlackjackState{
 let deck=shuffleDeck(createStandardDeck(),rng);
 const player:Card[]=[],dealer:Card[]=[];
 // Correct physical order: player, dealer up-card, player, dealer hole-card.
 for(const actor of ['human','dealer','human','dealer'] as const){
   const draw=fromTop(deck);deck=draw.deck;(actor==='human'?player:dealer).push(draw.card);
 }
 const state:BlackjackState={
  game:'blackjack',schemaVersion:1,round,revision,deck,player,dealer,
  phase:'player',outcome:null,reason:null,score
 };
 const humanNatural=isNatural(player),dealerNatural=isNatural(dealer);
 if(humanNatural&&dealerNatural)return finish(state,'push','both_natural');
 if(humanNatural)return finish(state,'human','player_natural');
 if(dealerNatural)return finish(state,'dealer','dealer_natural');
 return state;
}
export function startBlackjack(rng:RandomInt=secureRandomInt):BlackjackState{
 return deal(1,0,{human:0,dealer:0,pushes:0},rng);
}
function playDealer(state:BlackjackState):BlackjackState{
 let deck=[...state.deck],dealer=[...state.dealer];
 // Hard or soft 17 both stand. Exhaustion never reveals or fabricates new cards.
 while(blackjackValue(dealer).total<17&&deck.length){
   const drawn=fromTop(deck);deck=drawn.deck;dealer.push(drawn.card);
 }
 const updated={...state,deck,dealer};
 const player=blackjackValue(state.player).total,house=blackjackValue(dealer).total;
 if(house>21)return finish(updated,'human','dealer_bust');
 if(player>house)return finish(updated,'human','higher_total');
 if(player<house)return finish(updated,'dealer','higher_total');
 return finish(updated,'push','equal_total');
}
export function applyBlackjackAction(state:BlackjackState,action:BlackjackAction,rng:RandomInt=secureRandomInt):BlackjackResult{
 if(!Number.isInteger(action.expectedRevision)||action.expectedRevision!==state.revision||!action.actionId||action.actionId.length>128)
   return {ok:false,state,error:'STALE'};
 if(action.type==='next_round'){
   if(state.phase!=='finished')return {ok:false,state,error:'ILLEGAL'};
   return {ok:true,state:deal(state.round+1,state.revision+1,state.score,rng)};
 }
 if(state.phase!=='player')return {ok:false,state,error:'ILLEGAL'};
 if(action.type==='stand')return {ok:true,state:playDealer({...state,revision:state.revision+1})};
 if(action.type==='hit'){
   if(!state.deck.length)return {ok:false,state,error:'ILLEGAL'};
   const draw=fromTop(state.deck);
   const updated:BlackjackState={...state,revision:state.revision+1,deck:draw.deck,player:[...state.player,draw.card]};
   const total=blackjackValue(updated.player).total;
   if(total>21)return {ok:true,state:finish(updated,'dealer','player_bust')};
   if(total===21)return {ok:true,state:playDealer(updated)};
   return {ok:true,state:updated};
 }
 return {ok:false,state,error:'ILLEGAL'};
}
export interface BlackjackView {
 readonly round:number;readonly revision:number;readonly phase:BlackjackPhase;
 readonly player:readonly Card[];readonly dealerCards:readonly (Card|null)[];
 readonly playerTotal:number;readonly dealerTotal:number|null;readonly dealerUpcardTotal:number;
 readonly outcome:BlackjackOutcome|null;readonly reason:BlackjackReason|null;
 readonly score:BlackjackScore;readonly canHit:boolean;readonly canStand:boolean;readonly canNextRound:boolean;
}
export function getBlackjackView(state:BlackjackState):BlackjackView{
 const hidden=state.phase==='player';
 const dealerCards=state.dealer.map((card,index)=>hidden&&index===1?null:card);
 return {
  round:state.round,revision:state.revision,phase:state.phase,
  player:state.player,dealerCards,playerTotal:blackjackValue(state.player).total,
  dealerTotal:hidden?null:blackjackValue(state.dealer).total,
  dealerUpcardTotal:blackjackValue([state.dealer[0]!]).total,
  outcome:state.outcome,reason:state.reason,score:state.score,
  canHit:hidden&&state.deck.length>0,canStand:hidden,
  canNextRound:!hidden
 };
}
/** Full deck-conservation validation before restoring local progress. */
export function validateBlackjackSave(value:unknown):BlackjackState|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(v.game!=='blackjack'||v.schemaVersion!==1||!Number.isSafeInteger(v.round)||Number(v.round)<1||
  !Number.isSafeInteger(v.revision)||Number(v.revision)<0||
  (v.phase!=='player'&&v.phase!=='finished')||
  !Array.isArray(v.deck)||!Array.isArray(v.player)||!Array.isArray(v.dealer))return null;
 const deck=v.deck as unknown[],player=v.player as unknown[],dealer=v.dealer as unknown[];
 if(player.length<2||dealer.length<2||deck.length+player.length+dealer.length!==52)return null;
 const ids=new Set<CardId>();
 for(const item of [...deck,...player,...dealer]){
   if(!item||typeof item!=='object'||Array.isArray(item))return null;
   const card=item as Record<string,unknown>;
   if(typeof card.id!=='string'||!isCardId(card.id)||typeof card.rank!=='string'||typeof card.suit!=='string'||
      card.id!==`${card.rank}${card.suit}`||ids.has(card.id))return null;
   ids.add(card.id);
 }
 if(ids.size!==52)return null;
 if(!v.score||typeof v.score!=='object'||Array.isArray(v.score))return null;
 const score=v.score as Record<string,unknown>;
 if(!['human','dealer','pushes'].every(k=>Number.isSafeInteger(score[k])&&Number(score[k])>=0))return null;
 if(Number(score.human)+Number(score.dealer)+Number(score.pushes)!==Number(v.round)-(v.phase==='finished'?0:1))return null;
 if(v.phase==='player'&&(v.outcome!==null||v.reason!==null||dealer.length!==2))return null;
 if(v.phase==='finished'&&(!['human','dealer','push'].includes(String(v.outcome))||
 !['player_natural','dealer_natural','both_natural','player_bust','dealer_bust','higher_total','equal_total'].includes(String(v.reason))))return null;
 if(Number(v.revision)<Number(v.round)-1)return null;
 return value as BlackjackState;
}

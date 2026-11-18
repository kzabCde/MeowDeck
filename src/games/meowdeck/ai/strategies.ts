/** P3 fairness boundary: strategies receive ONLY the P1 whitelisted AIObservation. */
import { SUITS, createStandardDeck, type Card, type CardId, type Suit } from '../core/cards.js';
import { randomIndex, type RandomInt } from '../core/random.js';
import type { LegalAction } from '../core/game-types.js';
import type { AIObservation } from '../games/crazy-eights/ai-observation.js';

export type Difficulty = 'practice' | 'easy' | 'normal' | 'hard';
export interface AIDecision { readonly action: LegalAction; readonly selectedSuit?: Suit }
export interface AIStrategy { readonly id: Difficulty; chooseAction(observation: AIObservation, rng: RandomInt): AIDecision }
export interface HardBudget { readonly maxCandidateEvaluations: number }
const DEFAULT_HARD_BUDGET: HardBudget = { maxCandidateEvaluations: 52 };

function playedCard(hand: readonly Card[], action: LegalAction): Card | undefined {
  return action.type === 'play_card' ? hand.find((item) => item.id === action.cardId) : undefined;
}
function remainingHand(hand: readonly Card[], played?: Card): Card[] { return played ? hand.filter(c=>c.id!==played.id) : [...hand]; }
function countSuits(hand: readonly Card[]): Record<Suit,number> {
  const counts: Record<Suit,number> = {S:0,H:0,D:0,C:0};
  for(const card of hand) if(card.rank !== '8') counts[card.suit]++;
  return counts;
}
function dominantSuit(hand: readonly Card[], rng: RandomInt, randomize = false): Suit {
  const counts = countSuits(hand);
  const sorted = [...SUITS].sort((a,b)=>counts[b]-counts[a]);
  const best=counts[sorted[0]!];
  const choices=sorted.filter(s=>counts[s]===best);
  if(randomize && sorted.length>1 && randomIndex(rng,5)===0) return sorted[randomIndex(rng,Math.min(2,sorted.length))]!;
  return choices[randomIndex(rng,choices.length)]!;
}
function withSuit(action:LegalAction, observation:AIObservation, rng:RandomInt, randomize=false):AIDecision {
  if(action.type==='play_card' && action.requiresSuit) {
    return {action,selectedSuit:dominantSuit(remainingHand(observation.ownHand,playedCard(observation.ownHand,action)),rng,randomize)};
  }
  return {action};
}
function scoreCard(card:Card):number {return card.rank==='8'?50:card.rank==='A'?1:['J','Q','K'].includes(card.rank)?10:Number(card.rank);}
/** Pure structural check used by AI controller before converting a suggestion into a GameAction. */
export function isLegalDecision(observation: AIObservation, decision:AIDecision):boolean {
  const match=observation.legalActions.some(a=>a.type===decision.action.type && (a.type!=='play_card'|| (decision.action.type==='play_card'&&a.cardId===decision.action.cardId)));
  if(!match) return false;
  if(decision.action.type !== 'play_card') return decision.selectedSuit === undefined;
  const expected=observation.legalActions.find(a=>a.type==='play_card'&&a.cardId===(decision.action as Extract<LegalAction,{type:'play_card'}>).cardId);
  if(expected?.type!=='play_card')return false;
  return expected.requiresSuit ? decision.selectedSuit !== undefined && SUITS.includes(decision.selectedSuit) : decision.selectedSuit===undefined;
}
/** Always returns a choice from P1's legal actions; no state access or private deck model. */
export const easyStrategy:AIStrategy={id:'easy',chooseAction(observation,rng){
  const choices=observation.legalActions;
  if(!choices.length)throw Error('AI was asked to act without legal actions');
  // Weighted random choice; normal plays get 3 tickets, wilds 1, pending finish 1.
  const tickets=choices.flatMap(a=>Array.from({length:a.type==='play_card'&&!a.cardId.startsWith('8')?3:1},()=>a));
  const choice=tickets[randomIndex(rng,tickets.length)]!;
  return withSuit(choice,observation,rng,true);
}};

/** Normal: preserve flexible 8s, favor shedding costly cards and keeping suit options. */
function normalValue(o:AIObservation, a:LegalAction):number {
  if(a.type!=='play_card') return a.type==='finish_turn'?-25:0;
  const c=playedCard(o.ownHand,a)!;
  const remaining=remainingHand(o.ownHand,c);
  const suits=countSuits(remaining);
  const best=Math.max(...Object.values(suits));
  const same=suits[c.suit];
  const risk=o.opponentHandCount<=2?9:o.opponentHandCount<=4?4:0;
  // A playable 8 costs 50 if held in blocked scoring; spend it in imminent danger.
  const wild=c.rank==='8';
  return 25+Math.min(scoreCard(c),15)*.65 + (wild? best*1.5- (remaining.length>2?14-risk:0) : same*2.2) + (remaining.length===0?1000:0)
    + (o.hasPendingDrawDecision?4:0);
}
function bestByScore(o:AIObservation, rng:RandomInt, scorer:(a:LegalAction)=>number): AIDecision {
  const actions=o.legalActions;
  if(!actions.length) throw Error('AI was asked to act without legal actions');
  let max=-Infinity, best:LegalAction[]=[];
  for(const a of actions){const s=scorer(a);if(s>max+1e-8){max=s;best=[a]}else if(Math.abs(s-max)<=1e-8)best.push(a);}
  return withSuit(best[randomIndex(rng,best.length)]!,o,rng);
}
export const normalStrategy:AIStrategy={id:'normal',chooseAction(o,rng){return bestByScore(o,rng,a=>normalValue(o,a));}};

/**
 * Derive *possible* unseen cards only from cards known to this opponent:
 * own hand, current top, and recent public discards still represented by discardPileCount.
 * Previously revealed cards may be recycled into the draw pile, so old history is NOT a hard exclusion.
 */
export function estimateUnseenCards(o:AIObservation): readonly Card[] {
  const known=new Set<CardId>(o.ownHand.map(c=>c.id));
  known.add(o.topDiscard.id);
  const count=Math.max(0,o.discardPileCount-1);
  const recent=o.publicHistory.filter(e=>e.type==='CARD_PLAYED').slice(-count);
  for(const action of recent) if(action.type==='CARD_PLAYED') known.add(action.cardId);
  return createStandardDeck().filter(c=>!known.has(c.id));
}
/** Probability a sample of n uniformly unknown cards has >=1 card of a playable rank/suit/8.
 * A tractable information-set approximation, not a claim about the actual opponent hand.
 */
function hypergeomHit(population:readonly Card[],n:number,suit:Suit,rank:string):number {
  const total=population.length;
  if(!total)return 0;
  const hits=population.filter(c=>c.rank==='8'||c.suit===suit||c.rank===rank).length;
  let pMiss=1;
  for(let i=0;i<Math.min(n,total);i++)pMiss*=Math.max(0,(total-hits-i)/(total-i));
  return 1-pMiss;
}
/** Hard: bounded information-set evaluation, no actual opponent cards or future deck order. */
export function chooseHard(o:AIObservation,rng:RandomInt,budget:HardBudget=DEFAULT_HARD_BUDGET):AIDecision {
  const actions=o.legalActions;
  if(!actions.length)throw Error('AI was asked to act without legal actions');
  const limit=Math.max(1,Math.min(52,Math.floor(budget.maxCandidateEvaluations)));
  const unseen=estimateUnseenCards(o);
  let remainingBudget=limit;
  let bestScore=-Infinity;
  let best:{action:LegalAction;selectedSuit?:Suit}[]=[];
  for(const action of actions){
    const card=playedCard(o.ownHand,action);
    const suits=card?.rank==='8'&&action.type==='play_card'&&action.requiresSuit?SUITS:[undefined];
    for(const suit of suits){
      if(remainingBudget--<=0)break;
      const remaining=remainingHand(o.ownHand,card);
      const activeSuit=suit??card?.suit??o.activeSuit;
      const shownRank=card?.rank??o.topDiscard.rank;
      const suitCounts=countSuits(remaining);
      const wildCount=remaining.filter(x=>x.rank==='8').length;
      const potential=hypergeomHit(unseen,o.opponentHandCount,activeSuit,shownRank);
      const followups=remaining.filter(x=>x.rank==='8'||x.suit===activeSuit||x.rank===shownRank).length;
      const futureFlex=Math.max(...Object.values(suitCounts)) + wildCount;
      const urgency=o.opponentHandCount<=2?1.45:o.opponentHandCount<=4?1.2:1;
      // Penalize offering opponent an easily playable suit, favor own continuity,
      // retain emergency wilds until pressure rises, shed 50-point cards when urgent.
      const score=normalValue(o,action)
        // Stronger follow-up/suit control and probability-aware denial.
        // These are estimates from public cards, never the actual human hand.
        + followups*1.35
        + futureFlex*.4
        + (suitCounts[activeSuit]??0)*1.3
        - potential*5.5*urgency
        + ((1-potential)*2*urgency);
      if(score>bestScore+1e-8){bestScore=score;best=[{action,...(suit?{selectedSuit:suit}:{})}];}
      else if(Math.abs(score-bestScore)<=1e-8)best.push({action,...(suit?{selectedSuit:suit}:{})});
    }
    if(remainingBudget<=0)break;
  }
  const selected=best[randomIndex(rng,best.length)]!;
  if(selected.action.type==='play_card'&&selected.action.requiresSuit&&!selected.selectedSuit) return withSuit(selected.action,o,rng);
  return selected;
}
export const hardStrategy:AIStrategy={id:'hard',chooseAction(o,rng){return chooseHard(o,rng);}};
export const strategies:Record<Exclude<Difficulty,'practice'>,AIStrategy>={easy:easyStrategy,normal:normalStrategy,hard:hardStrategy};
export function chooseAIMove(difficulty:Exclude<Difficulty,'practice'>,observation:AIObservation,rng:RandomInt):AIDecision {
  const choice=strategies[difficulty].chooseAction(observation,rng);
  if(!isLegalDecision(observation,choice))throw Error(`Invalid ${difficulty} decision`);
  return choice;
}

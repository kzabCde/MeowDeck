/** Fair Gin Rummy AI: accepts an observation without opponent cards or stock identities. */
import type {Actor,Card,CardId} from '../../core/cards.js';
import {ginCardValue,evaluateGinHand,type GinActionType,type GinDifficulty,type GinHistory,type GinPhase,type GinState} from './rules.js';

export interface GinObservation{
 readonly ownHand:readonly Card[];readonly topDiscard:Card|null;readonly stockCount:number;
 readonly phase:GinPhase;readonly drawnFromDiscard:CardId|null;
 readonly publicHistory:readonly GinHistory[];readonly scores:Readonly<Record<Actor,number>>;
 readonly ownActor:Actor;readonly revision:number;
}
export interface GinDecision {readonly type:GinActionType;readonly cardId?:CardId}
/** Only public information and own cards cross the AI boundary. */
export function createGinObservation(state:GinState,actor:Actor='ai'):GinObservation{
 return {ownHand:state[actor],topDiscard:state.discard[state.discard.length-1]??null,
  stockCount:state.stock.length,phase:state.phase,drawnFromDiscard:state.drawnFromDiscard,
  publicHistory:state.history,scores:state.scores,ownActor:actor,revision:state.revision};
}
const numRank=(card:Card):number=>card.rank==='A'?1:card.rank==='J'?11:card.rank==='Q'?12:card.rank==='K'?13:Number(card.rank);
function pairPotential(cards:readonly Card[],history:readonly GinHistory[],mode:GinDifficulty):number{
 if(mode==='easy')return 0;
 const publiclyDead=new Set(history.filter(x=>x.type==='discard'&&x.cardId).map(x=>x.cardId!));
 let score=0;
 for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){
  const a=cards[i]!,b=cards[j]!;
  if(a.rank===b.rank){
   let available=0;
   for(const s of ['S','H','D','C'])if(s!==a.suit&&s!==b.suit&&!publiclyDead.has((a.rank+s) as CardId))available++;
   score+=available*(mode==='hard'?1.15:.8);
  }else if(a.suit===b.suit){
   const gap=Math.abs(numRank(a)-numRank(b));
   if(gap>2)continue;
   const wanted=gap===2?[Math.min(numRank(a),numRank(b))+1]:
    [Math.min(numRank(a),numRank(b))-1,Math.max(numRank(a),numRank(b))+1].filter(x=>x>=1&&x<=13);
   for(const n of wanted){
    const rank=n===1?'A':n===11?'J':n===12?'Q':n===13?'K':String(n);
    if(!publiclyDead.has((rank+a.suit) as CardId))score+=mode==='hard'?1.65:1.1;
   }
  }
 }
 return score;
}
function discardChoice(hand:readonly Card[],history:readonly GinHistory[],difficulty:GinDifficulty,blocked:CardId|null):{
 cardId:CardId;deadwood:number;score:number
}{
 const options=hand.filter(c=>c.id!==blocked);
 if(!options.length)throw new Error('Gin AI has no valid discard');
 let best={cardId:options[0]!.id,deadwood:1000,score:-Infinity};
 for(const card of options){
  const next=hand.filter(c=>c.id!==card.id);
  const analysis=evaluateGinHand(next);
  const unmatched=new Set(analysis.deadwood);
  const unused=next.filter(c=>unmatched.has(c.id));
  const promise=pairPotential(unused,history,difficulty);
  const score=-analysis.value+(difficulty==='hard'?.75:difficulty==='normal'?.5:0)*promise+
   (difficulty==='easy'?0:ginCardValue(card)*.015);
  if(score>best.score||(score===best.score&&analysis.value<best.deadwood)){
   best={cardId:card.id,deadwood:analysis.value,score};
  }
 }
 return best;
}
export function chooseGinMove(observation:GinObservation,difficulty:GinDifficulty):GinDecision{
 const {phase,ownHand,topDiscard,publicHistory,drawnFromDiscard}=observation;
 if(phase==='opening_non_dealer'||phase==='opening_dealer'||phase==='draw'){
  const action=phase==='draw'?'draw_discard':'take_open';
  if(topDiscard){
   const pickup=discardChoice([...ownHand,topDiscard],publicHistory,difficulty,topDiscard.id);
   const baseline=evaluateGinHand(ownHand).value;
   const advantage=baseline-pickup.deadwood;
   const threshold=difficulty==='easy'?5:difficulty==='normal'?2:0;
   if(advantage>=threshold&&(advantage>0||pickup.score>-baseline+1.2))return {type:action};
  }
  return {type:phase==='draw'?'draw_stock':'pass_open'};
 }
 if(phase!=='discard')throw new Error('Gin AI must only decide on its own active turn');
 const choice=discardChoice(ownHand,publicHistory,difficulty,drawnFromDiscard);
 if(choice.deadwood===0)return {type:'gin',cardId:choice.cardId};
 const threshold=difficulty==='easy'?4:difficulty==='normal'?7:10;
 if(choice.deadwood<=threshold)return {type:'knock',cardId:choice.cardId};
 return {type:'discard',cardId:choice.cardId};
}

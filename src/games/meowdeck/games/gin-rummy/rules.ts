/** Gin Rummy v1: isolated headless rules sharing MeowDeck card, deck and RNG primitives. */
import {createStandardDeck,isCardId,otherActor,type Actor,type Card,type CardId,type Rank} from '../../core/cards.js';
import {shuffleDeck} from '../../core/deck.js';
import {secureRandomInt,type RandomInt} from '../../core/random.js';

export type GinPhase='opening_non_dealer'|'opening_dealer'|'draw'|'discard'|'hand_result'|'match_result';
export type GinActionType='take_open'|'pass_open'|'draw_stock'|'draw_discard'|'discard'|'knock'|'gin'|'next_hand'|'new_match';
export type GinDifficulty='easy'|'normal'|'hard';
export interface GinMeld { readonly kind:'set'|'run'; readonly cards:readonly CardId[] }
export interface GinEvaluation { readonly melds:readonly GinMeld[]; readonly deadwood:readonly CardId[]; readonly value:number }
export interface GinResult {
 readonly kind:'knock'|'gin'|'undercut'|'stock';readonly winner:Actor|null;
 readonly points:number;readonly knocker:Actor|null;readonly knockerDeadwood:number;
 readonly opponentDeadwood:number;readonly opponentOriginalDeadwood:number;
 readonly laidOff:readonly CardId[];readonly melds:readonly GinMeld[];
}
export type GinHistory= {readonly actor:Actor;readonly type:'take_open'|'pass_open'|'draw_stock'|'draw_discard'|'discard';readonly cardId?:CardId};
export interface GinStats {readonly hands:number;readonly humanGin:number;readonly aiGin:number;readonly humanKnock:number;readonly aiKnock:number;readonly undercuts:number;readonly matches:number;readonly humanWins:number;readonly aiWins:number}
export interface GinState {
 readonly game:'gin-rummy';readonly schemaVersion:1;readonly revision:number;readonly handNumber:number;
 readonly dealer:Actor;readonly actor:Actor;readonly phase:GinPhase;readonly stock:readonly Card[];
 readonly discard:readonly Card[];readonly human:readonly Card[];readonly ai:readonly Card[];
 readonly drawnFromDiscard:CardId|null;readonly scores:Readonly<Record<Actor,number>>;
 readonly history:readonly GinHistory[];readonly processedActionIds:readonly string[];
 readonly result:GinResult|null;readonly stats:GinStats;
}
export interface GinAction {
 readonly type:GinActionType;readonly expectedRevision:number;readonly actionId:string;
 readonly actor?:Actor;readonly cardId?:CardId;
}
export type GinApplyResult={readonly ok:true;readonly state:GinState}|
 {readonly ok:false;readonly state:GinState;readonly error:'STALE'|'ILLEGAL'};
export const GIN_CONFIG={targetScore:100,knockLimit:10,ginBonus:20,undercutBonus:10} as const;
const EMPTY_STATS:GinStats={hands:0,humanGin:0,aiGin:0,humanKnock:0,aiKnock:0,undercuts:0,matches:0,humanWins:0,aiWins:0};
const RANK_VALUE:Readonly<Record<Rank,number>>={A:1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:11,Q:12,K:13};
export function ginCardValue(card:Card):number{return Math.min(10,RANK_VALUE[card.rank]);}
function sum(cards:readonly Card[]):number{return cards.reduce((n,c)=>n+ginCardValue(c),0);}
function pop(cards:readonly Card[]):{card:Card;rest:Card[]}{
 const card=cards[cards.length-1];if(!card)throw new Error('Empty gin stock');return {card,rest:cards.slice(0,-1)};
}
function meldOptions(cards:readonly Card[]):{mask:number;meld:GinMeld}[]{
 const options:{mask:number;meld:GinMeld}[]=[];
 const add=(group:Card[],kind:'run'|'set')=>{
  const mask=group.reduce((m,c)=>m|(1<<cards.findIndex(item=>item.id===c.id)),0);
  if(group.length>=3)options.push({mask,meld:{kind,cards:group.map(c=>c.id)}});
 };
 for(const rank of Object.keys(RANK_VALUE) as Rank[]){
  const group=cards.filter(c=>c.rank===rank);
  if(group.length>=3){
   for(let drop=-1;drop<group.length;drop++){
    if(group.length===3&&drop>=0)continue;
    const selected=drop===-1?group:group.filter((_,i)=>i!==drop);
    if(selected.length===3||selected.length===4)add(selected,'set');
   }
  }
 }
 for(const suit of ['S','H','D','C']){
  const ranked=cards.filter(c=>c.suit===suit).sort((a,b)=>RANK_VALUE[a.rank]-RANK_VALUE[b.rank]);
  for(let i=0;i<ranked.length;i++){
   for(let j=i+2;j<ranked.length;j++){
    if(RANK_VALUE[ranked[j]!.rank]-RANK_VALUE[ranked[i]!.rank]!==j-i)break;
    add(ranked.slice(i,j+1),'run');
   }
  }
 }
 return options;
}
interface Partition{melds:GinMeld[];unused:Card[];value:number}
/** Enumerate legal disjoint partitions; first uncovered card is either deadwood or in a meld containing it. */
function partitions(cards:readonly Card[]):Partition[]{
 if(cards.length>11)throw new Error('Gin hand exceeds 11 cards');
 const opts=meldOptions(cards),all=(1<<cards.length)-1;
 const byIndex=cards.map((_,i)=>opts.filter(o=>(o.mask&(1<<i))!==0));
 const result:Partition[]=[];
 function visit(remaining:number,unused:number,chosen:GinMeld[]):void{
  if(remaining===0){
   const rest=cards.filter((_,i)=>(unused&(1<<i))!==0);
   result.push({melds:chosen,unused:rest,value:sum(rest)});return;
  }
  const bit=remaining&-remaining,index=Math.log2(bit);
  visit(remaining^bit,unused|bit,chosen);
  for(const option of byIndex[index]!)if((remaining&option.mask)===option.mask)
   visit(remaining^option.mask,unused,[...chosen,option.meld]);
 }
 visit(all,0,[]);
 return result.sort((a,b)=>a.value-b.value||b.melds.length-a.melds.length);
}
export function evaluateGinHand(cards:readonly Card[]):GinEvaluation{
 const best=partitions(cards)[0];if(!best)throw new Error('Cannot evaluate empty hand');
 return {melds:best.melds,deadwood:best.unused.map(c=>c.id),value:best.value};
}
function canLay(card:Card,group:readonly Card[],kind:'set'|'run'):boolean{
 if(kind==='set')return group.length<4&&group.every(c=>c.rank===card.rank&&c.suit!==card.suit);
 if(!group.every(c=>c.suit===card.suit))return false;
 const ranks=group.map(c=>RANK_VALUE[c.rank]);
 return RANK_VALUE[card.rank]===Math.min(...ranks)-1||RANK_VALUE[card.rank]===Math.max(...ranks)+1;
}
/** Search all opponent meld combinations and legal chained layoffs. Returns minimum achievable deadwood. */
export function evaluateLayoffs(opponent:readonly Card[],knocker:readonly Card[],knockerMelds:readonly GinMeld[]):{
 deadwood:number;laidOff:CardId[];opponentMelds:GinMeld[];
}{
 const lookup=new Map(knocker.map(c=>[c.id,c]));
 const groups=knockerMelds.map(m=>({kind:m.kind,cards:m.cards.map(id=>lookup.get(id)!).filter(Boolean)}));
 let best={deadwood:sum(opponent),laidOff:[] as CardId[],opponentMelds:[] as GinMeld[]};
 for(const p of partitions(opponent)){
  if(p.value===0)return {deadwood:0,laidOff:[],opponentMelds:p.melds};
  const memo=new Map<string,{value:number;laidOff:CardId[]}>();
  function search(rest:readonly Card[],g:typeof groups):{value:number;laidOff:CardId[]}{
   const signature=rest.map(c=>c.id).sort().join('/')+'|'+g.map(m=>m.cards.map(c=>c.id).sort().join('.')).join('/');
   const cached=memo.get(signature);if(cached)return cached;
   let choice={value:sum(rest),laidOff:[] as CardId[]};
   for(const c of rest)for(let i=0;i<g.length;i++){
    if(!canLay(c,g[i]!.cards,g[i]!.kind))continue;
    const modified=g.map((part,j)=>j===i?{...part,cards:[...part.cards,c]}:part);
    const later=search(rest.filter(item=>item.id!==c.id),modified);
    if(later.value<choice.value)choice={value:later.value,laidOff:[c.id,...later.laidOff]};
   }
   memo.set(signature,choice);return choice;
  }
  const found=search(p.unused,groups);
  if(found.value<best.deadwood)best={deadwood:found.value,laidOff:found.laidOff,opponentMelds:p.melds};
  if(best.deadwood===0)break;
 }
 return best;
}
function hand(state:GinState,actor:Actor):readonly Card[]{return actor==='human'?state.human:state.ai;}
function replaceHand(state:GinState,actor:Actor,cards:readonly Card[]):GinState{
 return actor==='human'?{...state,human:cards}:{...state,ai:cards};
}
function initial(handNumber:number,dealer:Actor,scores:Readonly<Record<Actor,number>>,stats:GinStats,rng:RandomInt):GinState{
 let deck=shuffleDeck(createStandardDeck(),rng);const human:Card[]=[],ai:Card[]=[];
 for(let i=0;i<10;i++){let next=pop(deck);human.push(next.card);deck=next.rest;
  next=pop(deck);ai.push(next.card);deck=next.rest;}
 const starter=pop(deck);
 return {game:'gin-rummy',schemaVersion:1,revision:0,handNumber,dealer,actor:otherActor(dealer),phase:'opening_non_dealer',
 stock:starter.rest,discard:[starter.card],human,ai,drawnFromDiscard:null,scores,
 history:[],processedActionIds:[],result:null,stats};
}
export function startGinRummy(rng:RandomInt=secureRandomInt,dealer:Actor='ai',stats:GinStats=EMPTY_STATS):GinState{
 return initial(1,dealer,{human:0,ai:0},stats,rng);
}
function scoring(state:GinState,actor:Actor,kind:'knock'|'gin'):GinState{
 const own=hand(state,actor),other=hand(state,otherActor(actor)),mine=partitions(own),theirBase=evaluateGinHand(other).value;
 const valid=mine.filter(p=>kind==='gin'?p.value===0:p.value>0&&p.value<=GIN_CONFIG.knockLimit);
 if(!valid.length)throw new Error('Invalid Gin declaration');
 let best=valid[0]!,bestLay={deadwood:theirBase,laidOff:[] as CardId[]},optimalScore=-Infinity;
 if(kind==='knock'){
  for(const p of valid){
   const lay=evaluateLayoffs(other,own,p.melds);
   const advantage=lay.deadwood-p.value;
   if(advantage>optimalScore){optimalScore=advantage;best=p;bestLay={deadwood:lay.deadwood,laidOff:lay.laidOff};}
  }
 }else best=valid[0]!;
 const undercut=kind==='knock'&&bestLay.deadwood<=best.value;
 const winner=undercut?otherActor(actor):actor;
 const gained=kind==='gin'?GIN_CONFIG.ginBonus+theirBase:
   undercut?GIN_CONFIG.undercutBonus+best.value-bestLay.deadwood:
   bestLay.deadwood-best.value;
 const result:GinResult={kind:undercut?'undercut':kind,winner,points:gained,knocker:actor,
  knockerDeadwood:best.value,opponentDeadwood:kind==='gin'?theirBase:bestLay.deadwood,
  opponentOriginalDeadwood:theirBase,laidOff:kind==='gin'?[]:bestLay.laidOff,
  melds:best.melds};
 const scores={...state.scores,[winner]:state.scores[winner]+gained};
 const stats={...state.stats,hands:state.stats.hands+1,
  humanGin:state.stats.humanGin+(kind==='gin'&&actor==='human'?1:0),
  aiGin:state.stats.aiGin+(kind==='gin'&&actor==='ai'?1:0),
  humanKnock:state.stats.humanKnock+(kind==='knock'&&actor==='human'?1:0),
  aiKnock:state.stats.aiKnock+(kind==='knock'&&actor==='ai'?1:0),
  undercuts:state.stats.undercuts+(undercut?1:0)};
 const ended=scores[winner]>=GIN_CONFIG.targetScore;
 const lifetime={...stats,matches:stats.matches+(ended?1:0),humanWins:stats.humanWins+(ended&&winner==='human'?1:0),aiWins:stats.aiWins+(ended&&winner==='ai'?1:0)};
 return {...state,scores,result,stats:lifetime,phase:ended?'match_result':'hand_result'};
}
function blocked(state:GinState):GinState{
 return {...state,result:{kind:'stock',winner:null,points:0,knocker:null,knockerDeadwood:0,
  opponentDeadwood:0,opponentOriginalDeadwood:0,laidOff:[],melds:[]},
 phase:'hand_result',stats:{...state.stats,hands:state.stats.hands+1}};
}
export function applyGinAction(state:GinState,action:GinAction,rng:RandomInt=secureRandomInt):GinApplyResult{
 if(action.expectedRevision!==state.revision||!action.actionId||action.actionId.length>128||
  state.processedActionIds.includes(action.actionId))
  return {ok:false,state,error:'STALE'};
 const illegal=():GinApplyResult=>({ok:false,state,error:'ILLEGAL'});
 let next:GinState;
 if(action.type==='next_hand'){
  if(state.phase!=='hand_result')return illegal();
  next=initial(state.handNumber+1,otherActor(state.dealer),state.scores,state.stats,rng);
 }else if(action.type==='new_match'){
  if(state.phase!=='match_result')return illegal();
  next=initial(1,otherActor(state.dealer),{human:0,ai:0},state.stats,rng);
 }else{
  if(action.actor!==state.actor||state.phase==='hand_result'||state.phase==='match_result')return illegal();
  const actor=state.actor;
  const opening=state.phase==='opening_non_dealer'||state.phase==='opening_dealer';
  if(action.type==='pass_open'){
   if(!opening)return illegal();
   next=state.phase==='opening_non_dealer'
    ?{...state,actor:state.dealer,phase:'opening_dealer'}
    :{...state,actor:otherActor(state.dealer),phase:'draw'};
  }else if(action.type==='take_open'||action.type==='draw_discard'){
   if(action.type==='take_open'?!opening:state.phase!=='draw')return illegal();
   const drawn=pop(state.discard);
   next=replaceHand({...state,discard:drawn.rest,phase:'discard',drawnFromDiscard:drawn.card.id},actor,[...hand(state,actor),drawn.card]);
  }else if(action.type==='draw_stock'){
   if(state.phase!=='draw'||state.stock.length<=2)return illegal();
   const drawn=pop(state.stock);
   next=replaceHand({...state,stock:drawn.rest,phase:'discard',drawnFromDiscard:null},actor,[...hand(state,actor),drawn.card]);
  }else if(action.type==='discard'||action.type==='knock'||action.type==='gin'){
   if(state.phase!=='discard'||!action.cardId||action.cardId===state.drawnFromDiscard)return illegal();
   const own=hand(state,actor);
   if(own.length!==11||!own.some(c=>c.id===action.cardId))return illegal();
   const remains=own.filter(c=>c.id!==action.cardId);
   const value=evaluateGinHand(remains).value;
   if(action.type==='gin'&&value!==0)return illegal();
   if(action.type==='knock'&&(value===0||value>GIN_CONFIG.knockLimit))return illegal();
   const played=own.find(c=>c.id===action.cardId)!;
   next=replaceHand({...state,discard:[...state.discard,played],drawnFromDiscard:null,actor:otherActor(actor),phase:'draw'},actor,remains);
   if(action.type==='gin'||action.type==='knock')next=scoring(next,actor,action.type);
   else if(next.stock.length<=2)next=blocked(next);
  }else return illegal();
  const detail:GinHistory={actor,type:action.type==='knock'||action.type==='gin'?'discard':action.type,
   ...((action.type==='discard'||action.type==='knock'||action.type==='gin')&&action.cardId?{cardId:action.cardId}:{}),
   ...((action.type==='take_open'||action.type==='draw_discard')&&state.discard.length?{cardId:state.discard[state.discard.length-1]!.id}:{})};
  next={...next,history:[...state.history,detail].slice(-256)};
 }
 return {ok:true,state:{...next,revision:state.revision+1,processedActionIds:[...state.processedActionIds.slice(-127),action.actionId]}};
}
/** Restore only a structurally sound, card-conserving state; fail closed on tampering. */
export function validateGinSave(value:unknown):GinState|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 const validPhase=['opening_non_dealer','opening_dealer','draw','discard','hand_result','match_result'];
 if(v.game!=='gin-rummy'||v.schemaVersion!==1||!validPhase.includes(String(v.phase))||
  !Number.isSafeInteger(v.revision)||Number(v.revision)<0||
  !Number.isSafeInteger(v.handNumber)||Number(v.handNumber)<1||
  !['human','ai'].includes(String(v.actor))||!['human','ai'].includes(String(v.dealer)))return null;
 if(!Array.isArray(v.stock)||!Array.isArray(v.discard)||!Array.isArray(v.human)||!Array.isArray(v.ai))return null;
 const piles=[v.stock,v.discard,v.human,v.ai] as unknown[][];
 const ids=new Set<string>();
 for(const row of piles.flat()){
  if(!row||typeof row!=='object')return null;
  const c=row as Record<string,unknown>;
  if(typeof c.id!=='string'||!isCardId(c.id)||c.id!==String(c.rank)+String(c.suit)||ids.has(c.id))return null;
  ids.add(c.id);
 }
 if(ids.size!==52||((v.discard as unknown[]).length===0&&!(v.phase==='discard'&&v.drawnFromDiscard!==null))||
  ![10,11].includes((v.human as unknown[]).length)||![10,11].includes((v.ai as unknown[]).length))return null;
 if(v.phase==='discard'&&((v.actor==='human'?(v.human as unknown[]).length:(v.ai as unknown[]).length)!==11))return null;
 if(v.scores===null||typeof v.scores!=='object'||!['human','ai'].every(a=>{
  const n=(v.scores as Record<string,unknown>)[a];return Number.isSafeInteger(n)&&Number(n)>=0;
 }))return null;
 if(!Array.isArray(v.history)||!Array.isArray(v.processedActionIds)||v.processedActionIds.length>128||
  v.processedActionIds.some((id:unknown)=>typeof id!=='string'||!id||id.length>128)||
  new Set(v.processedActionIds).size!==v.processedActionIds.length)return null;
 if(v.drawnFromDiscard!==null&&(typeof v.drawnFromDiscard!=='string'||!isCardId(v.drawnFromDiscard)))return null;
 if(!v.stats||typeof v.stats!=='object'||!['hands','humanGin','aiGin','humanKnock','aiKnock','undercuts','matches','humanWins','aiWins'].every(k=>{
  const n=(v.stats as Record<string,unknown>)[k];return Number.isSafeInteger(n)&&Number(n)>=0;
 }))return null;
 return value as GinState;
}

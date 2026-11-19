import assert from 'node:assert/strict';
import test from 'node:test';
import {createStandardDeck} from '../dist/games/meowdeck/core/cards.js';
import {applyGinAction,evaluateGinHand,evaluateLayoffs,startGinRummy,validateGinSave} from '../dist/games/meowdeck/games/gin-rummy/rules.js';
import {chooseGinMove,createGinObservation} from '../dist/games/meowdeck/games/gin-rummy/ai.js';
const cards=createStandardDeck();
const byId=id=>{const card=cards.find(c=>c.id===id);assert.ok(card);return card;};
const pick=ids=>ids.map(byId);
const rng=max=>max-1;
const dispatch=(state,type,actor,cardId)=>applyGinAction(state,{
 type,actor,...(cardId?{cardId}:{}),actionId:'test-'+state.revision,expectedRevision:state.revision},rng);
test('Gin deck starts with 10 cards each and preserves all 52 cards',()=>{
 const state=startGinRummy(rng);
 assert.equal(state.human.length,10);assert.equal(state.ai.length,10);
 assert.equal(state.stock.length,31);assert.equal(state.discard.length,1);
 assert.equal(new Set([...state.stock,...state.discard,...state.human,...state.ai].map(c=>c.id)).size,52);
 assert.ok(validateGinSave(state));
});
test('meld evaluation finds disjoint sets and runs',()=>{
 const hand=pick(['7H','7S','7D','4C','5C','6C','9D','KD','AS','2H']);
 const evaluation=evaluateGinHand(hand);
 assert.equal(evaluation.value,22);
 assert.equal(evaluation.melds.length,2);
 assert.deepEqual(new Set(evaluation.deadwood),new Set(['9D','KD','AS','2H']));
});
test('low Ace run is valid while Q-K-A is invalid',()=>{
 assert.equal(evaluateGinHand(pick(['AH','2H','3H'])).value,0);
 assert.equal(evaluateGinHand(pick(['QH','KH','AH'])).value,21);
});
test('Gin 10-card hand is recognized with four-card run',()=>{
 assert.equal(evaluateGinHand(pick(['3H','4H','5H','7C','7D','7S','8S','9S','10S','JS'])).value,0);
});
test('opening offers pass to dealer, then return to nondealer to draw',()=>{
 let state=startGinRummy(rng,'ai');
 let result=dispatch(state,'pass_open','human');assert.ok(result.ok);state=result.state;
 assert.equal(state.actor,'ai');assert.equal(state.phase,'opening_dealer');
 result=dispatch(state,'pass_open','ai');assert.ok(result.ok);state=result.state;
 assert.equal(state.actor,'human');assert.equal(state.phase,'draw');
 result=dispatch(state,'draw_stock','human');assert.ok(result.ok);state=result.state;
 assert.equal(state.human.length,11);assert.equal(state.phase,'discard');
 result=dispatch(state,'discard','human',state.human[0].id);assert.ok(result.ok);state=result.state;
 assert.equal(state.actor,'ai');assert.equal(state.phase,'draw');
 assert.ok(validateGinSave(state));
});
test('taking initial upcard prevents discarding that card immediately',()=>{
 let state=startGinRummy(rng,'ai');
 const cardId=state.discard[0].id;
 const pickResult=dispatch(state,'take_open','human');assert.ok(pickResult.ok);state=pickResult.state;
 assert.equal(dispatch(state,'discard','human',cardId).ok,false);
});
test('layoff can extend an existing run',()=>{
 const knocker=pick(['3H','4H','5H','7C','7D','7S','AS','2D','9C','KC']);
 const opponent=pick(['6H','8H','AC','2C','4D','6S','8D','JD','QS','KS']);
 const lay=evaluateLayoffs(opponent,knocker,[{kind:'run',cards:['3H','4H','5H']},{kind:'set',cards:['7C','7D','7S']}]);
 assert.ok(lay.deadwood<opponent.reduce((n,c)=>n+(c.rank==='A'?1:['J','Q','K'].includes(c.rank)?10:Number(c.rank)),0));
 assert.ok(lay.laidOff.includes('6H'));
});
function arranged(humanIds,aiIds,discardId){
 const base=startGinRummy(rng,'ai');
 const human=pick(humanIds),ai=pick(aiIds),discard=pick([discardId]);
 const used=new Set([...human,...ai,...discard].map(c=>c.id));
 return {...base,actor:'human',phase:'discard',human,ai,discard,stock:cards.filter(c=>!used.has(c.id)),drawnFromDiscard:null};
}
test('valid Gin resolves score once and preserves card inventory',()=>{
 const state=arranged(['3H','4H','5H','7C','7D','7S','8S','9S','10S','JS','KH'],
 ['2C','3C','4C','5C','8D','9D','JD','QD','KS','AS'],'AH');
 const result=dispatch(state,'gin','human','KH');assert.ok(result.ok);
 assert.equal(result.state.result?.kind,'gin');
 assert.equal(result.state.result?.winner,'human');
 assert.equal(result.state.scores.human,20+evaluateGinHand(state.ai).value);
 assert.equal(result.state.human.length,10);
 assert.ok(validateGinSave(result.state));
 assert.equal(dispatch(result.state,'gin','human','KH').ok,false);
});
test('AI observation contains no private opponent hand or stock order',()=>{
 const state=startGinRummy(rng,'human');
 const obs=createGinObservation(state,'ai');
 assert.equal('human' in obs,false);assert.equal('stock' in obs,false);
 assert.equal('ai' in obs,false);
 const decision=chooseGinMove(obs,'hard');assert.ok(['take_open','pass_open'].includes(decision.type));
});
test('duplicate or stale actions cannot change the game',()=>{
 const state=startGinRummy(rng,'ai');
 const action={type:'pass_open',actor:'human',expectedRevision:0,actionId:'same'};
 const first=applyGinAction(state,action,rng);assert.ok(first.ok);
 const duplicate=applyGinAction(first.state,action,rng);assert.equal(duplicate.ok,false);
});

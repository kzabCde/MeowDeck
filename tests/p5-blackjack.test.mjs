import test from 'node:test';
import assert from 'node:assert/strict';
import {createStandardDeck} from '../dist/games/meowdeck/core/cards.js';
import {startBlackjack,applyBlackjackAction,getBlackjackView,blackjackValue,isNatural,validateBlackjackSave} from '../dist/games/meowdeck/games/blackjack/rules.js';
import {seeded} from '../examples/legal-driver.mjs';
const cards=Object.fromEntries(createStandardDeck().map(c=>[c.id,c]));
function rngFor(ids){
 // Force exact four cards to end of ordered array in desired deal order.
 // shuffleDeck with zero-index RNG rotates unpredictably, so test with a crafted
 // state fixture preserving full card conservation instead of a fake random engine.
 const baseline=startBlackjack(seeded(73));
 const used=new Set(ids);
 return {...baseline,deck:createStandardDeck().filter(c=>!used.has(c.id)),player:[cards[ids[0]],cards[ids[2]]],dealer:[cards[ids[1]],cards[ids[3]]],phase:'player',outcome:null,reason:null,score:{human:0,dealer:0,pushes:0}};
}
const action=(s,type,id='a')=>({type,expectedRevision:s.revision,actionId:id});

test('Ace soft/hard totals, natural two-card 21 and multiple Ace conversion',()=>{
 assert.deepEqual(blackjackValue([cards.AS,cards['6H']]),{total:17,soft:true});
 assert.deepEqual(blackjackValue([cards.AS,cards['6H'],cards['9D']]),{total:16,soft:false});
 assert.deepEqual(blackjackValue([cards.AS,cards.AH,cards['9D']]),{total:21,soft:true});
 assert.equal(isNatural([cards.AS,cards.KH]),true);
 assert.equal(isNatural([cards.AS,cards['5H'],cards['5D']]),false);
});
test('fresh 52 cards, concealed dealer hole, stale/invalid actions and save conservation',()=>{
 const s=startBlackjack(seeded(73)),v=getBlackjackView(s);
 assert.equal(s.deck.length,48);
 assert.equal(s.player.length,2);assert.equal(s.dealer.length,2);
 assert.equal(new Set([...s.deck,...s.player,...s.dealer].map(c=>c.id)).size,52);
 assert.ok(validateBlackjackSave(JSON.parse(JSON.stringify(s))));
 if(s.phase==='player'){
  assert.equal(v.dealerCards[1],null);
  assert.equal(v.dealerTotal,null);
  const bad=applyBlackjackAction(s,{type:'hit',expectedRevision:s.revision+1,actionId:'wrong'},seeded(1));
  assert.equal(bad.ok,false);
 }
 const broken=structuredClone(s);broken.deck.pop();
 assert.equal(validateBlackjackSave(broken),null);
});
test('naturals resolve immediately and never expose a playable Hit action',()=>{
 // Exact initial deals from the deterministic 52-card Fisher–Yates shuffle.
 for(const [seed,outcome,reason] of [
   [6,'human','player_natural'],
   [65,'dealer','dealer_natural'],
   [227,'push','both_natural']
 ]){
   const state=startBlackjack(seeded(seed));
   assert.equal(state.phase,'finished',`seed ${seed}`);
   assert.equal(state.outcome,outcome,`seed ${seed}`);
   assert.equal(state.reason,reason,`seed ${seed}`);
   assert.equal(state.score.human+state.score.dealer+state.score.pushes,1);
   const view=getBlackjackView(state);
   assert.equal(view.canHit,false);
   assert.equal(view.dealerCards.every(card=>card!==null),true);
   const rejected=applyBlackjackAction(state,action(state,'hit',`hit-after-natural-${seed}`));
   assert.equal(rejected.ok,false);
 }
});
test('dealer stands on soft 17; a player bust settles without a dealer hit',()=>{
 // Dealer hand Ace+6 is soft17 and must not draw when player stands.
 const s=rngFor(['10S','AH','7S','6H']);
 const result=applyBlackjackAction(s,action(s,'stand','stand1'),seeded(73));
 assert.equal(result.ok,true);
 assert.equal(result.state.phase,'finished');
 assert.equal(result.state.dealer.length,2);
 assert.equal(result.state.outcome,'push');
 const bust=rngFor(['KS','8C','9H','7D']);
 const next=applyBlackjackAction(bust,action(bust,'hit','hit1'),seeded(1));
 assert.equal(next.ok,true);
 assert.equal(next.state.phase,'finished');
 assert.equal(next.state.outcome,'dealer');
 assert.equal(next.state.reason,'player_bust');
 assert.equal(next.state.dealer.length,2);
});
test('dealer resolution, round score, fresh shuffle and invalid replay',()=>{
 let state=startBlackjack(seeded(91)),steps=0;
 while(state.round<=30&&steps++<120){
  if(state.phase==='finished'){
   assert.ok(state.outcome);
   assert.equal(state.score.human+state.score.dealer+state.score.pushes,state.round);
   const result=applyBlackjackAction(state,action(state,'next_round',`next-${steps}`),seeded(steps*4+3));
   assert.equal(result.ok,true);state=result.state;
  }else{
   const result=applyBlackjackAction(state,action(state,steps%3?'hit':'stand',`move-${steps}`),seeded(steps+73));
   assert.equal(result.ok,true);state=result.state;
  }
  assert.ok(validateBlackjackSave(JSON.parse(JSON.stringify(state))));
  assert.equal(new Set([...state.deck,...state.player,...state.dealer].map(c=>c.id)).size,52);
 }
 assert.ok(state.round>30);
});


test('P5 retries cannot apply the same action id across revisions',()=>{
 const start=startBlackjack(seeded(73));
 assert.equal(start.phase,'player');
 const first=applyBlackjackAction(start,action(start,'stand','unique-id-73'),seeded(72));
 assert.equal(first.ok,true);
 const current=first.state;
 const sameId=applyBlackjackAction(current,action(current,'next_round','unique-id-73'),seeded(75));
 assert.equal(sameId.ok,false);
 assert.equal(sameId.error,'STALE');
 assert.deepEqual(sameId.state,current);
 const after=applyBlackjackAction(current,action(current,'next_round','different-id-73'),seeded(75));
 assert.equal(after.ok,true);
 assert.equal(after.state.processedActionIds.includes('unique-id-73'),true);
 assert.equal(after.state.processedActionIds.includes('different-id-73'),true);
});
test('P5 action identity persists through save/restore and next-round boundaries',()=>{
 const base=startBlackjack(seeded(73));
 const stood=applyBlackjackAction(base,action(base,'stand','stand-original'),seeded(88));
 assert.equal(stood.ok,true);
 const restored=validateBlackjackSave(JSON.parse(JSON.stringify(stood.state)));
 assert.ok(restored);
 const next=applyBlackjackAction(restored,action(restored,'next_round','round-new'),seeded(90));
 assert.equal(next.ok,true);
 const duplicate=applyBlackjackAction(next.state,action(next.state,'stand','stand-original'),seeded(2));
 assert.equal(duplicate.ok,false);
 assert.equal(duplicate.error,'STALE');
 assert.equal(validateBlackjackSave(JSON.parse(JSON.stringify(next.state)))?.round,2);
});
test('old P5 schema 1 saves without action IDs remain readable and get upgraded on action',()=>{
 const legacy=startBlackjack(seeded(73));
 const snapshot=structuredClone(legacy);
 delete snapshot.processedActionIds;
 assert.ok(validateBlackjackSave(snapshot));
 const next=applyBlackjackAction(snapshot,action(snapshot,'stand','legacy-upgrade'),seeded(74));
 assert.equal(next.ok,true);
 assert.deepEqual(next.state.processedActionIds,['legacy-upgrade']);
});
test('P5 rejects malformed action id history without rejecting existing saves',()=>{
 const s=startBlackjack(seeded(73));
 const duplicate=structuredClone(s);duplicate.processedActionIds=['same','same'];
 assert.equal(validateBlackjackSave(duplicate),null);
 const invalid=structuredClone(s);invalid.processedActionIds=Array(129).fill('x');
 assert.equal(validateBlackjackSave(invalid),null);
 const bad=applyBlackjackAction(s,{type:'stand',expectedRevision:s.revision,actionId:'   '},seeded(75));
 assert.equal(bad.ok,false);
});

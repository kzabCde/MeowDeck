import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, createStandardDeck, applyAction, createAIObservation, getLegalActions, assertCardConservation } from '../dist/games/meowdeck/index.js';
import { chooseAIMove, chooseHard, estimateUnseenCards, isLegalDecision } from '../dist/games/meowdeck/ai/strategies.js';
import { seeded } from '../examples/legal-driver.mjs';
const cards=Object.fromEntries(createStandardDeck().map(c=>[c.id,c]));
function fixture(options={}){
  const start=createMatch({sessionId:'test',rng:seeded(1)});
  const ai=(options.ai??['8H','7S','10D','JS']).map(id=>cards[id]), human=(options.human??['5H','3C','4C']).map(id=>cards[id]);
  const top=cards[options.top??'5S'];
  const used=new Set([...ai,...human,top].map(x=>x.id));
  return {...start,aiHand:ai,humanHand:human,drawPile:createStandardDeck().filter(c=>!used.has(c.id)),discardPile:[top],activeSuit:options.activeSuit??top.suit,currentActor:'ai',phase:'ai_thinking',pendingDrawnCardId:options.pending??null};
}
const levels=['easy','normal','hard'];
test('strategies always return P1 legal actions, including forced draws and final 8s',()=>{
  for(const level of levels){
    for(const options of [{},{ai:['2C','3D'],top:'5S'},{ai:['8D'],top:'5S'},{ai:['8C','2S'],top:'5S'},{ai:['5H','5D','5C'],top:'5S'},{ai:['2S','3D'],top:'5S',pending:'2S'}]){
      const obs=createAIObservation(fixture(options));
      // The special pending fixture must be a P1-valid draw decision to make this meaningful.
      if(!obs.legalActions.length)continue;
      const decision=chooseAIMove(level,obs,seeded(73));
      assert.ok(isLegalDecision(obs,decision),level);
      assert.ok(obs.legalActions.find(a=>a.type===decision.action.type && (a.type!=='play_card'||a.cardId===decision.action.cardId)));
    }
  }
});
test('hidden human hand and draw pile changes do not affect strategies',()=>{
  const state=fixture({ai:['8C','4S','KH','9H','AC']});
  const changed={...state,humanHand:[...state.humanHand.slice(1),state.drawPile[0]],drawPile:[state.humanHand[0],...state.drawPile.slice(1)]};
  const a=createAIObservation(state),b=createAIObservation(changed);
  assert.deepEqual(a,b);
  for(const level of levels)assert.deepEqual(chooseAIMove(level,a,seeded(819)),chooseAIMove(level,b,seeded(819)));
  const str=JSON.stringify(a);assert.equal(str.includes('humanHand'),false);assert.equal(str.includes('drawPile:'),false);
  assert.equal('humanHand'in a,false);assert.equal('drawPile'in a,false);
});
test('probability pool contains only observable exclusions and bounded hard work always returns fallback',()=>{
  const o=createAIObservation(fixture());
  const pool=estimateUnseenCards(o);
  assert.ok(pool.length>30);assert.ok(pool.every(c=>!o.ownHand.some(x=>x.id===c.id)));
  assert.ok(pool.every(c=>c.id!==o.topDiscard.id));
  assert.ok(isLegalDecision(o,chooseHard(o,seeded(4),{maxCandidateEvaluations:1})));
});
test('same seeded input produces same decision; strategic policies are genuinely distinguishable',()=>{
  for(const level of levels)for(let seed=1;seed<=50;seed++){
    const o=createAIObservation(fixture());
    assert.deepEqual(chooseAIMove(level,o,seeded(seed)),chooseAIMove(level,o,seeded(seed)));
  }
  const signature=levels.map(level=>Array.from({length:200},(_,i)=>{
    const seed=i+1;
    const initial=createMatch({sessionId:`strategy-${seed}`,rng:seeded(seed)});
    const observation=createAIObservation({...initial,currentActor:'ai',phase:'ai_thinking'});
    return JSON.stringify(chooseAIMove(level,observation,seeded(seed*103+7)));
  }).join('|'));
  assert.equal(new Set(signature).size,3);
});
test('all difficulties can finish real matches through P1 engine without extra draws or illegal actions',()=>{
  for(const level of levels)for(let seed=1;seed<=25;seed++){
    const rng=seeded(seed*103);const aiRng=seeded(seed*103+13);
    let state=createMatch({sessionId:`p3-${seed}`,rng});let steps=0;
    while(state.phase!=='match_end'&&steps++<3000){
      assertCardConservation(state);
      let action;
      if(state.phase==='round_end')action={type:'start_next_round',expectedRoundNumber:state.roundNumber,actionId:`step-${steps}`};
      else {
        const actor=state.currentActor;
        const obs=actor==='ai'?createAIObservation(state):null;
        const decision=obs?chooseAIMove(level,obs,aiRng):null;
        const chosen=decision?.action??getLegalActions(state)[0];
        action={...chosen,type:chosen.type,actor,expectedTurnId:state.turnId,actionId:`step-${steps}`};
        if(action.type==='play_card'){
          delete action.requiresSuit;
          if(chosen.requiresSuit)action.selectedSuit=decision?.selectedSuit??'S';
        }
      }
      const result=applyAction(state,action,rng);
      assert.equal(result.ok,true,`mode=${level} seed=${seed} step=${steps}: ${result.ok?'':result.error.code}`);
      state=result.state;
    }
    assert.equal(state.phase,'match_end',`mode=${level} seed=${seed} steps=${steps}`);
  }
});

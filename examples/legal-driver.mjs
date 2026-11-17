import assert from 'node:assert/strict';
import {createMatch, applyAction, assertCardConservation, getLegalActions} from '../dist/games/meowdeck/index.js';

export function seeded(seed) {let s=seed>>>0||1;return n=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)%n;};}
/** Deterministic legal-action driver, not a P3 AI strategy. */
export function simulate(seed, verbose=false) {
  const rng=seeded(seed);let state=createMatch({sessionId:`sim-${seed}`,rng}),step=0,rounds=0;
  while(state.phase!=='match_end' && step<15000){
    assertCardConservation(state);
    const actionId=`${seed}-step-${step}`;
    let action;
    if(state.phase==='round_end'){
      action={type:'start_next_round',expectedRoundNumber:state.roundNumber,actionId};rounds++;
    } else {
      const legal=getLegalActions(state);
      assert.ok(legal.length>0,`No legal actions seed=${seed} step=${step}`);
      // Prefer an 8 only as a nonfinal card when available, otherwise play a matching card.
      const preferred=legal.find(x=>x.type==='play_card'&&x.cardId[0]!=='8')??legal[0];
      const selectedSuit=preferred.type==='play_card'&&preferred.requiresSuit ?
        ((state.currentActor==='human'?state.humanHand:state.aiHand).find(c=>c.id!==preferred.cardId)?.suit??'S') : undefined;
      action={...preferred,actor:state.currentActor,expectedTurnId:state.turnId,actionId};
      if(action.type==='play_card'){
        delete action.requiresSuit;
        if(selectedSuit)action.selectedSuit=selectedSuit;
      }
    }
    const before=JSON.stringify(state);
    const result=applyAction(state,action,rng);
    assert.equal(result.ok,true,`seed=${seed} step=${step}: ${result.ok?'':result.error.code}`);
    assert.equal(JSON.stringify(state),before,'Input state was mutated');
    state=result.state;step++;
    assertCardConservation(state);
    const scores=state.scores;assert.ok(scores.human<=3&&scores.ai<=3);
    if(verbose&&result.events.some(e=>e.type==='ROUND_ENDED')){
      console.log(`seed ${seed} round ${state.roundNumber}: winner=${state.roundResult.winner} score=${scores.human}-${scores.ai}`);
    }
  }
  assert.ok(step<15000,`Simulation stalled seed=${seed} at round=${state.roundNumber}`);
  assert.equal(state.phase,'match_end');assert.ok(state.matchWinner==='human'||state.matchWinner==='ai');
  assert.equal(state.scores[state.matchWinner],3);return {seed,steps:step,rounds:rounds+1,winner:state.matchWinner};
}


/** Deterministic P3 benchmark: AI against the same simple legal baseline on identical seeded decks. */
import { performance } from 'node:perf_hooks';
import { applyAction, assertCardConservation, createAIObservation, createMatch, getLegalActions } from '../dist/games/meowdeck/index.js';
import { chooseAIMove } from '../dist/games/meowdeck/ai/strategies.js';
import { seeded } from './legal-driver.mjs';

export function benchmark(level, matches=200, firstSeed=1, hooks={}) {
  const results={level,matches,wins:0,losses:0,draws:0,decisions:0,totalMs:0,maxMs:0,seeds:`${firstSeed}..${firstSeed+matches-1}`,errors:0};
  for(let seed=firstSeed;seed<firstSeed+matches;seed++){
    const shuffle=seeded(seed*31+7),selection=seeded(seed*31+13);
    let state=createMatch({sessionId:`benchmark-${seed}`,rng:shuffle});
    let steps=0;
    while(state.phase!=='match_end'&&steps++<3000){
      if(state.phase==='round_end'){
        const result=applyAction(state,{type:'start_next_round',expectedRoundNumber:state.roundNumber,actionId:`${seed}:round:${steps}`},shuffle);
        if(!result.ok)throw Error(result.error.message);state=result.state;continue;
      }
      const actor=state.currentActor;
      let chosen,selectedSuit;
      if(actor==='ai'){
        const begin=performance.now();const decision=chooseAIMove(level,createAIObservation(state),selection);
        const millis=performance.now()-begin;
        results.decisions++;results.totalMs+=millis;results.maxMs=Math.max(results.maxMs,millis);
        hooks.onDecision?.({seed,level,millis});
        chosen=decision.action;selectedSuit=decision.selectedSuit;
      }else{
        // The same simple non-8-first baseline as P1's legal driver.
        const legal=getLegalActions(state);chosen=legal.find(a=>a.type==='play_card'&&!a.cardId.startsWith('8'))??legal[0];
        if(chosen.type==='play_card'&&chosen.requiresSuit){
          const remaining=state.humanHand.filter(c=>c.id!==chosen.cardId);
          selectedSuit=remaining[0]?.suit??'S';
        }
      }
      const action={type:chosen.type,actor,expectedTurnId:state.turnId,actionId:`${seed}:action:${steps}`};
      if(chosen.type==='play_card') {action.cardId=chosen.cardId;if(selectedSuit)action.selectedSuit=selectedSuit;}
      const result=applyAction(state,action,shuffle);
      if(!result.ok)throw Error(`seed=${seed} ${level} ${result.error.code}`);
      state=result.state;assertCardConservation(state);
    }
    if(state.phase!=='match_end')throw Error(`Benchmark stalled seed ${seed}`);
    if(state.matchWinner==='ai')results.wins++;else if(state.matchWinner==='human')results.losses++;else results.draws++;
    hooks.onMatch?.({seed,level,winner:state.matchWinner});
  }
  return {...results,winRate:Number((results.wins/results.matches*100).toFixed(1)),meanDecisionsPerMatch:Number((results.decisions/results.matches).toFixed(1)),meanMsPerDecision:Number((results.totalMs/results.decisions).toFixed(3)),maxMsPerDecision:Number(results.maxMs.toFixed(3))};
}
if(import.meta.url===new URL(`file://${process.argv[1]}`).href){const count=Number(process.argv[2])||200;for(const level of ['easy','normal','hard'])console.log(JSON.stringify(benchmark(level,count)));}

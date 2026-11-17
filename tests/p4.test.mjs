import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createMatch,applyAction,getLegalActions,assertCardConservation} from '../dist-p4/games/meowdeck/index.js';
import {makeSavedMatch,validateSavedMatch} from '../dist-p4/web/storage/save-schema.js';
import {summarizeMatches,toMatchRecord} from '../dist-p4/web/statistics/statistics-service.js';
import {resolveReducedMotion,DEFAULT_SETTINGS} from '../dist-p4/web/settings/settings-store.js';
function rng(seed){let s=seed>>>0||1;return n=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)%n;};}
const copy=x=>JSON.parse(JSON.stringify(x));
function drive(seed=73){const random=rng(seed);let state=createMatch({sessionId:`session-${seed}`,rng:random}),steps=0;
  while(state.phase!=='match_end'&&steps<8000){
    const legal=getLegalActions(state);
    let action;
    if(state.phase==='round_end')action={type:'start_next_round',expectedRoundNumber:state.roundNumber,actionId:`${state.sessionId}:ui:${++steps}`};
    else{const move=legal.find(a=>a.type==='play_card'&&a.cardId[0]!=='8')??legal[0];
      action={...move,actor:state.currentActor,expectedTurnId:state.turnId,actionId:`${state.sessionId}:ui:${++steps}`};
      if(action.type==='play_card'){delete action.requiresSuit;if(move.requiresSuit)action.selectedSuit='S';}}
    const result=applyAction(state,action,random);assert.equal(result.ok,true);state=result.state;
    assertCardConservation(state);
  }assert.ok(steps<8000);return {state,steps};
}

test('P4 save envelope retains full authoritative 52-card state and unique action identity',()=>{
  const state=createMatch({sessionId:'session-safe',rng:rng(73)});
  const envelope=makeSavedMatch(state,'hard',1);
  const decoded=validateSavedMatch(copy(envelope));
  assert.equal(decoded.ok,true);
  assert.deepEqual(decoded.save.gameState,state);
  assert.equal(decoded.save.difficulty,'hard');
  assert.equal(decoded.save.nextActionSequence,1);
});
test('P4 validator rejects unsupported versions, removed cards, duplicate IDs and damaged metadata',()=>{
  const base=makeSavedMatch(createMatch({sessionId:'s',rng:rng(75)}),'easy',1);
  const mutate=[
    s=>{s.schemaVersion=99;},s=>{s.gameState.aiHand.pop();},
    s=>{s.gameState.aiHand[0]=s.gameState.humanHand[0];},
    s=>{s.gameState.activeSuit='INVALID';},
    s=>{s.gameState.currentActor='noone';},
    s=>{s.gameState.phase='ai_thinking';},
    s=>{s.gameState.processedActionIds=['bad','bad'];},
    s=>{s.gameState.pendingDrawnCardId='AS';},
    s=>{s.gameState.publicHistory=[{type:'CARD_DRAWN',actor:'ai',cardId:'AH',count:1,roundNumber:1}];},
    s=>{s.sessionId='DIFFERENT';},
    s=>{s.nextActionSequence=0;},
  ];
  for(const change of mutate){const broken=copy(base);change(broken);assert.equal(validateSavedMatch(broken).ok,false);}
  const duplicate=copy(base);duplicate.gameState.processedActionIds=['s:ui:7'];duplicate.nextActionSequence=7;
  assert.equal(validateSavedMatch(duplicate).ok,false,'sequence must advance beyond used action IDs');
});
test('P4 valid pending drawn card can restore without inventing a second draw',()=>{
  let state=createMatch({sessionId:'draw-pending',rng:rng(112)}),random=rng(999);let seq=0,found=false;
  for(;seq<2000;seq++){
    if(state.pendingDrawnCardId){found=true;break;}
    if(state.phase==='round_end'){const result=applyAction(state,{type:'start_next_round',expectedRoundNumber:state.roundNumber,actionId:`id-${seq}`},random);assert.equal(result.ok,true);state=result.state;continue;}
    const legal=getLegalActions(state);const move=legal.find(m=>m.type==='draw_card')??legal[0];
    const action={...move,actor:state.currentActor,expectedTurnId:state.turnId,actionId:`id-${seq}`};
    if(action.type==='play_card'){delete action.requiresSuit;if(move.requiresSuit)action.selectedSuit='H';}
    const result=applyAction(state,action,random);assert.equal(result.ok,true);state=result.state;
  }
  assert.equal(found,true);
  const save=makeSavedMatch(state,'normal',seq+10);const valid=validateSavedMatch(copy(save));
  assert.equal(valid.ok,true);
  assert.equal(valid.save.gameState.pendingDrawnCardId,state.pendingDrawnCardId);
});
test('P4 completed results are not eligible to Continue and statistics use immutable winner',()=>{
  const {state}=drive(73);assert.equal(state.phase,'match_end');
  assert.equal(validateSavedMatch(makeSavedMatch(state,'hard',9999)).ok,false);
  const record=toMatchRecord(state,'hard');const summary=summarizeMatches([record]);
  assert.equal(record.roundsPlayed,record.roundsWon+record.roundsLost+record.roundsDrawn);
  assert.equal(summary.matches,1);
  assert.equal(summary.wins,state.matchWinner==='human'?1:0);
  assert.equal(summary.winRate,summary.wins?100:0);
  assert.equal(summary.byDifficulty.hard.matches,1);
});
test('P4 statistics segregate difficulties and compute streaks by completion order',()=>{
  const make=(id,winner,difficulty,date)=>({matchId:id,winner,difficulty,completedAt:date,finalScore:{human:winner==='human'?3:1,ai:winner==='human'?1:3},roundsPlayed:4,roundsWon:winner==='human'?3:1,roundsLost:winner==='human'?1:3,roundsDrawn:0});
  const r=[make('a','human','easy','2026-01-01'),make('b','ai','normal','2026-01-02'),make('c','human','hard','2026-01-03'),make('d','human','hard','2026-01-04')];
  const x=summarizeMatches(r);assert.equal(x.matches,4);assert.equal(x.wins,3);assert.equal(x.losses,1);assert.equal(x.winRate,75);
  assert.equal(x.currentStreak,2);assert.equal(x.bestStreak,2);assert.equal(x.byDifficulty.hard.winRate,100);
  assert.equal(x.byDifficulty.normal.winRate,0);assert.equal(x.rounds,16);
});
test('P4 motion settings alter presentation only and have safe defaults',()=>{
  assert.equal(DEFAULT_SETTINGS.motion,'system');assert.equal(resolveReducedMotion('system',true),true);assert.equal(resolveReducedMotion('system',false),false);
  assert.equal(resolveReducedMotion('on',false),true);assert.equal(resolveReducedMotion('off',true),false);
});
test('P4 worker is versioned from Next.js production build, not unstable static chunks',()=>{
  const script=readFileSync('scripts/build-offline.mjs','utf8'),sw=readFileSync('scripts/sw.template.js','utf8');
  assert.match(script,/\.next\/BUILD_ID/);assert.match(script,/\.next\/static/);
  assert.match(sw,/OFFLINE_STATUS/);assert.match(sw,/ACTIVATE_AFTER_SAVE/);
  assert.match(sw,/request\.mode==='navigate'/);assert.match(sw,/cache\.put\('\/'/);
  for(const filename of ['public/icons/meowdeck-192.png','public/icons/meowdeck-512.png','public/icons/meowdeck-maskable-512.png','public/icons/apple-touch-icon.png'])assert.equal(existsSync(filename),true);
});

test('P4 restores round-ended state with its original scores and result',()=>{
  const random=rng(15);let state=createMatch({sessionId:'round-restore',rng:random});let i=0;
  while(state.phase!=='round_end'&&i<6000){
    const legal=getLegalActions(state);const move=legal.find(x=>x.type==='play_card'&&x.cardId[0]!=='8')??legal[0];
    const action={...move,actor:state.currentActor,expectedTurnId:state.turnId,actionId:`round-restore:ui:${++i}`};
    if(move.type==='play_card'){delete action.requiresSuit;if(move.requiresSuit)action.selectedSuit='C';}
    const result=applyAction(state,action,random);assert.equal(result.ok,true);state=result.state;
  }
  assert.equal(state.phase,'round_end');
  const validated=validateSavedMatch(copy(makeSavedMatch(state,'easy',i+1)));
  assert.equal(validated.ok,true);
  assert.deepEqual(validated.save.gameState.roundResult,state.roundResult);
  assert.deepEqual(validated.save.gameState.scores,state.scores);
});

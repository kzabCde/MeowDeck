import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUITS, RANKS, createStandardDeck, createMatch, isCardId, shuffleDeck, dealCards,
  getPlayableCards, getLegalActions, getCurrentActor, getActiveSuit, getRoundStatus,
  getMatchStatus, getPublicGameState, getHumanView, validateAction, applyAction,
  assertCardConservation, calculateHandPenalty, createAIObservation, selectStarter,
  secureRandomInt
} from '../dist/games/meowdeck/index.js';

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return (max) => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) % max; };
}
const index = Object.fromEntries(createStandardDeck().map(card => [card.id, card]));
const card = id => index[id];
function mock(options={}) {
  const state=createMatch({sessionId:'fixture',rng:seeded(7)});
  const h=(options.human ?? ['2H','3H']).map(card);
  const a=(options.ai ?? ['4C']).map(card);
  const top=card(options.top ?? '5S');
  const hidden=(options.discards ?? []).map(card);
  const used=new Set([...h,...a,top,...hidden].map(x=>x.id));
  let pile=createStandardDeck().filter(c=>!used.has(c.id));
  if (options.drawTop) {
    const draw=card(options.drawTop);
    assert.ok(pile.some(x=>x.id===draw.id));
    pile=[...pile.filter(c=>c.id!==draw.id),draw];
  }
  if (options.emptyDraw) pile=[];
  return {...state,
    humanHand:h, aiHand:a, drawPile:pile, discardPile:[...hidden,top], activeSuit:options.activeSuit??top.suit,
    currentActor:options.actor??'human', phase:(options.actor??'human')==='human'?'human_turn':'ai_thinking',
    scores:options.scores??{human:0,ai:0}, blockedTurns:options.blockedTurns??0,
    pendingDrawnCardId:options.pendingDrawnCardId??null
  };
}
let actionSequence=0;
function dispatch(state, action, rng=seeded(2)) {
  return applyAction(state, {actionId:`act-${++actionSequence}`, ...(action.expectedRoundNumber === undefined && action.type !== 'restart_match' ? {expectedTurnId: state.turnId} : {}), ...action},rng);
}
function ok(result) { assert.equal(result.ok,true, result.ok?undefined:result.error.message); return result.state; }
function reject(state,action,code) {
  const res=dispatch(state,action);assert.equal(res.ok,false); assert.equal(res.error.code,code);assert.equal(res.state,state);assert.deepEqual(res.events,[]);
}

test('standard deck has exactly 52 unique stable P0 IDs, never Joker',()=>{
  const d=createStandardDeck(); assert.equal(d.length,52);assert.equal(new Set(d.map(c=>c.id)).size,52);
  for(const s of SUITS) for(const r of RANKS) assert.ok(d.find(c=>c.id===`${r}${s}`));
  assert.ok(d.every(c=>isCardId(c.id)));assert.equal(isCardId('joker_red'),false);
  assert.notEqual(d,createStandardDeck());
});
test('Fisher–Yates is seeded, immutable, preserves inventory',()=>{
  const before=createStandardDeck();const snapshot=JSON.stringify(before);
  assert.deepEqual(shuffleDeck(before,seeded(73)),shuffleDeck(before,seeded(73)));
  assert.notDeepEqual(shuffleDeck(before,seeded(73)),shuffleDeck(before,seeded(74)));
  assert.deepEqual(shuffleDeck(before,seeded(73)).map(c=>c.id).sort(),before.map(c=>c.id).sort());
  assert.equal(JSON.stringify(before),snapshot);
});
test('deal is pure, selectStarter excludes eights and cannot spin forever',()=>{
  const d=createStandardDeck();const dealt=dealCards(d,7);assert.equal(dealt.dealt.length,7);assert.equal(dealt.remaining.length,45);
  assert.equal(dealCards(d,0).remaining.length,52);assert.throws(()=>dealCards(d,53));
  const starter=selectStarter([card('2S'),card('8H'),card('8S')]);assert.equal(starter.starter.id,'2S');assert.equal(starter.remaining.length,2);
  assert.throws(()=>selectStarter([card('8H'),card('8S')]));
});
test('first round deals 7 each, non-eight starter, 37 remaining, human starts',()=>{
  for(let seed=1;seed<=128;seed++){
    const state=createMatch({sessionId:`seed-${seed}`,rng:seeded(seed)});
    assertCardConservation(state); assert.equal(state.humanHand.length,7);assert.equal(state.aiHand.length,7);
    assert.equal(state.drawPile.length,37);assert.equal(state.discardPile.length,1);
    assert.notEqual(state.discardPile[0].rank,'8');assert.equal(state.currentActor,'human');
    assert.equal(state.phase,'human_turn');assert.deepEqual(state.scores,{human:0,ai:0});
  }
});
test('reject invalid session id and unusable/insecure RNG results',()=>{
  assert.throws(()=>createMatch({sessionId:' '}));
  assert.throws(()=>createMatch({sessionId:'invalid-rng',rng:()=>-1}),/RNG/);
  assert.throws(()=>secureRandomInt(0),RangeError);
});
test('matching suit, matching rank, eight legal; unrelated card illegal',()=>{
  const s=mock({human:['5H','2S','8C','3H'],top:'5S'});
  assert.deepEqual(getPlayableCards(s).map(c=>c.id),['5H','2S','8C']);
  assert.deepEqual(getLegalActions(s).map(a=>a.cardId),['5H','2S','8C']);
  reject(s,{type:'play_card',actor:'human',cardId:'3H'},'ILLEGAL_CARD');
  reject(s,{type:'play_card',actor:'human',cardId:'AS'},'CARD_NOT_OWNED');
  reject(s,{type:'draw_card',actor:'human'},'CANNOT_DRAW');
});
test('invalid action rejects without mutation and never calls RNG',()=>{
  const s=mock({human:['5H','2S']});const before=JSON.stringify(s);
  const res=applyAction(s,{type:'play_card',actor:'human',cardId:'2S',expectedTurnId:s.turnId+1,actionId:'stale'},()=>{throw Error('rng called');});
  assert.equal(res.ok,false);assert.equal(res.error.code,'STALE_ACTION');assert.equal(JSON.stringify(s),before);
  reject(s,{type:'play_card',actor:'ai',cardId:'4C'},'WRONG_TURN');
});
test('playing nonfinal wild eight requires valid suit and commits only on confirmation',()=>{
  const s=mock({human:['8H','2C'],top:'5S'});
  reject(s,{type:'play_card',actor:'human',cardId:'8H'},'SUIT_REQUIRED');
  reject(s,{type:'play_card',actor:'human',cardId:'8H',selectedSuit:'X'},'INVALID_SUIT');
  const res=dispatch(s,{type:'play_card',actor:'human',cardId:'8H',selectedSuit:'D'});const next=ok(res);
  assert.equal(next.activeSuit,'D');assert.equal(next.discardPile.at(-1).id,'8H');assert.equal(next.phase,'ai_thinking');
  assert.ok(res.events.some(x=>x.type==='SUIT_CHANGED'&&x.suit==='D'));assertCardConservation(mock({human:['8H','2C'],top:'5S'}));
});
test('active suit overrides printed eight suit but rank comparison still matches top 8',()=>{
  let s=mock({actor:'human',human:['8H','8C','2C'],top:'5S'});
  s=ok(dispatch(s,{type:'play_card',actor:'human',cardId:'8H',selectedSuit:'D'}));
  // AI has an eight and is allowed to match rank 8 regardless of chosen D.
  s={...s,aiHand:[card('8S'),card('9C')],drawPile:s.drawPile.filter(c=>!['8S','9C'].includes(c.id))};
  assert.deepEqual(getPlayableCards(s,'ai').map(c=>c.id),['8S']);
});
test('final eight wins instantly without selecting a suit; match victory exactly once',()=>{
  const s=mock({human:['8C'],scores:{human:2,ai:0}});
  const result=dispatch(s,{type:'play_card',actor:'human',cardId:'8C'});
  const next=ok(result);
  assert.equal(next.phase,'match_end');assert.equal(next.matchWinner,'human');assert.equal(next.scores.human,3);
  assert.equal(result.events.filter(e=>e.type==='MATCH_ENDED').length,1);
  reject(next,{type:'play_card',actor:'human',cardId:'2S'},'ROUND_FINISHED');
});
test('normal card cannot arbitrarily choose a suit',()=>{
  const s=mock({human:['5H','3H'],top:'5S'});
  reject(s,{type:'play_card',actor:'human',cardId:'5H',selectedSuit:'H'},'INVALID_SUIT');
  const n=ok(dispatch(s,{type:'play_card',actor:'human',cardId:'5H'}));assert.equal(n.activeSuit,'H');
});
test('one drawn unplayable card ends turn without a second draw',()=>{
  const s=mock({human:['2H','3H'],top:'5S',drawTop:'4D'});
  const r=dispatch(s,{type:'draw_card',actor:'human'});const n=ok(r);
  assert.equal(n.humanHand.length,3);assert.equal(n.pendingDrawnCardId,null);assert.equal(n.currentActor,'ai');
  assert.equal(r.events.find(e=>e.type==='CARD_DRAWN').cardId,undefined);
  assert.deepEqual(getLegalActions(n,'human'),[]);
  reject(n,{type:'draw_card',actor:'human'},'WRONG_TURN');
});
test('drawn playable card can be played or held, no repeated draw, only pending card legal',()=>{
  const s=mock({human:['2H','3H'],top:'5S',drawTop:'5D'});
  const result=dispatch(s,{type:'draw_card',actor:'human'});const n=ok(result);
  assert.equal(n.pendingDrawnCardId,'5D');assert.equal(n.turnId,s.turnId);
  assert.deepEqual(getLegalActions(n),[{type:'play_card',cardId:'5D',requiresSuit:false},{type:'finish_turn'}]);
  reject(n,{type:'draw_card',actor:'human'},'CANNOT_DRAW');
  reject(n,{type:'play_card',actor:'human',cardId:'2H'},'ILLEGAL_CARD');
  const played=ok(dispatch(n,{type:'play_card',actor:'human',cardId:'5D'}));assert.equal(played.discardPile.at(-1).id,'5D');
  const finished=ok(dispatch(n,{type:'finish_turn',actor:'human'}));assert.equal(finished.currentActor,'ai');
  assert.equal(finished.humanHand.length,3);
});
test('recycle discards excluding top, preserve activeSuit, and keep inventory when valid',()=>{
  const original=mock({human:['2H','3H'],ai:['4C'],top:'5S'});
  const src={...original,drawPile:[],discardPile:[...original.drawPile,...original.discardPile]};
  assertCardConservation(src);
  const r=dispatch(src,{type:'draw_card',actor:'human'});const n=ok(r);
  assertCardConservation(n);assert.equal(n.discardPile.length,1);assert.equal(n.discardPile[0].id,'5S');
  assert.ok(r.events.some(e=>e.type==='DRAW_PILE_RECYCLED'&&e.count===48));
});
test('two synthetic forced passes trigger blocked scoring; tie yields no win',()=>{
  // These branches are unreachable under perfect 52-card conservation but supported for safety/recovery.
  const s=mock({human:['2H'],ai:['3C'],top:'5S',emptyDraw:true});
  assert.deepEqual(getLegalActions(s),[{type:'pass_turn'}]);
  const first=ok(dispatch(s,{type:'pass_turn',actor:'human'}));
  assert.equal(first.blockedTurns,1);assert.equal(first.currentActor,'ai');
  const second=ok(dispatch(first,{type:'pass_turn',actor:'ai'}));
  assert.equal(second.phase,'round_end');assert.equal(second.roundResult.reason,'blocked');
  assert.equal(second.roundResult.winner,'human');assert.deepEqual(second.scores,{human:1,ai:0});
  const tie=mock({human:['2H'],ai:['2D'],top:'5S',emptyDraw:true,blockedTurns:1});
  const ended=ok(dispatch(tie,{type:'pass_turn',actor:'human'}));
  assert.equal(ended.roundResult.winner,null);assert.deepEqual(ended.scores,{human:0,ai:0});
});
test('8 penalty=50, A=1, J/Q/K=10, others face value',()=>{
  assert.equal(calculateHandPenalty(['8S','AH','JH','QH','KH','9C','10D','2S'].map(card)),50+1+30+9+10+2);
});
test('cannot pass when a draw or play is available',()=>{
  reject(mock({human:['5H']}),{type:'pass_turn',actor:'human'},'CANNOT_PASS');
  reject(mock({human:['2H']}),{type:'pass_turn',actor:'human'},'CANNOT_PASS');
});
test('duplicate action IDs and stale turn IDs cannot mutate state or score twice',()=>{
  const s=mock({human:['5H','3H'],top:'5S'});
  const a={type:'play_card',actor:'human',cardId:'5H',expectedTurnId:s.turnId,actionId:'same-id'};
  const n=ok(applyAction(s,a,seeded(1)));
  const duplicate=applyAction(n,a,seeded(1));assert.equal(duplicate.ok,false);assert.equal(duplicate.error.code,'DUPLICATE_ACTION');assert.equal(duplicate.state,n);
  const stale=applyAction(n,{...a,actionId:'new-id'},seeded(1));assert.equal(stale.ok,false);assert.equal(stale.error.code,'STALE_ACTION');
});
test('start_next_round alternates starter, resets state but keeps match wins and action guard',()=>{
  const s=mock({human:['5H'],top:'5S'});
  const ended=ok(dispatch(s,{type:'play_card',actor:'human',cardId:'5H'}));
  assert.equal(ended.phase,'round_end');
  const action={type:'start_next_round',expectedRoundNumber:ended.roundNumber,actionId:'next-round'};
  const n=ok(applyAction(ended,action,seeded(4)));
  assertCardConservation(n);assert.equal(n.roundNumber,2);assert.equal(n.currentActor,'ai');
  assert.equal(n.phase,'ai_thinking');assert.equal(n.scores.human,1);assert.equal(n.publicHistory.length,0);
  assert.equal(n.humanHand.length,7);assert.equal(n.aiHand.length,7);
  const dup=applyAction(n,action,seeded(4));assert.equal(dup.ok,false);assert.equal(dup.error.code,'DUPLICATE_ACTION');
});
test('restart requires new session, resets match score and emits new match event',()=>{
  const s=mock();reject(s,{type:'restart_match',newSessionId:s.sessionId},'INVALID_SESSION_ID');
  const result=dispatch(s,{type:'restart_match',newSessionId:'restart-two'});
  const n=ok(result);assert.equal(n.sessionId,'restart-two');assert.equal(n.roundNumber,1);assert.deepEqual(n.scores,{human:0,ai:0});
  assert.ok(result.events.find(e=>e.type==='MATCH_STARTED'));assertCardConservation(n);
});
test('state is serializable, public view excludes hidden hands and deck identities',()=>{
  const s=mock({human:['AH','2H'],ai:['10S','QS'],top:'5D'});
  assert.deepEqual(JSON.parse(JSON.stringify(s)),s);
  const pub=getPublicGameState(s);const human=getHumanView(s);
  const json=JSON.stringify(pub);assert.equal(json.includes('"humanHand"'),false);assert.equal(json.includes('"aiHand"'),false);
  assert.equal(json.includes('"drawPile"'),false);
  assert.ok(human.ownHand.some(x=>x.id==='AH'));assert.equal(JSON.stringify(human).includes('"aiHand"'),false);
  assert.equal(getCurrentActor(s),'human');assert.equal(getActiveSuit(s),'D');assert.equal(getRoundStatus(s),null);assert.equal(getMatchStatus(s),null);
});
test('sanitized AI observation includes only allowed fields; no human cards or deck identities',()=>{
  const s=mock({actor:'ai',human:['AH','2H'],ai:['7S','QS'],top:'5D'});
  const obs=createAIObservation(s);assert.deepEqual(obs.ownHand.map(x=>x.id),['7S','QS']);
  assert.equal(obs.opponentHandCount,2);assert.deepEqual(obs.legalActions,getLegalActions(s,'ai'));
  for(const banned of ['humanHand','drawPile','pendingDrawnCardId','processedActionIds','seed','rng']) assert.equal(Object.hasOwn(obs,banned),false);
  const content=JSON.stringify(obs);assert.equal(content.includes('"AH"'),false);assert.equal(content.includes('"2H"'),false);
  // No matching card: AI may draw, but the public event never reveals its card ID.
  const drawn=dispatch(s,{type:'draw_card',actor:'ai'});
  assert.equal(drawn.ok,true);
  assert.ok(drawn.events.some(e=>e.type==='CARD_DRAWN'));
  assert.ok(drawn.events.every(e=>!Object.hasOwn(e,'cardId')));
});
test('public events/history hide a drawn card identity',()=>{
  const s=mock({human:['2H','3H'],top:'5S',drawTop:'4D'});
  const result=dispatch(s,{type:'draw_card',actor:'human'});const n=ok(result);
  assert.equal(JSON.stringify(result.events).includes('4D'),false);
  assert.equal(JSON.stringify(n.publicHistory).includes('4D'),false);
  assert.equal(JSON.stringify(getPublicGameState(n)).includes('4D'),false);
});

test('AI pending drawn-card status is private to its observation',()=>{
  const s=mock({actor:'ai',human:['2H'],ai:['3C'],top:'5S',pendingDrawnCardId:'3C'});
  assert.equal(getPublicGameState(s).hasPendingDrawDecision,false);
  assert.equal(getHumanView(s).hasPendingDrawDecision,false);
  assert.equal(createAIObservation(s).hasPendingDrawDecision,true);
  assert.deepEqual(getLegalActions(s,'ai'),[{type:'finish_turn'}]);
});
test('recycling a top wild eight preserves its chosen suit',()=>{
  const source=mock({human:['2H'],ai:['4C'],top:'8D',activeSuit:'S'});
  const s={...source,drawPile:[],discardPile:[...source.drawPile,...source.discardPile]};
  assertCardConservation(s);
  const result=dispatch(s,{type:'draw_card',actor:'human'});const n=ok(result);
  assert.equal(n.activeSuit,'S');assert.equal(n.discardPile.at(-1).id,'8D');assertCardConservation(n);
});
test('two identical action IDs always produce one transition, even with differing payloads',()=>{
  const s=mock({human:['5H','8C'],top:'5S'});
  const first=ok(applyAction(s,{type:'play_card',actor:'human',cardId:'5H',actionId:'exact-id',expectedTurnId:s.turnId},seeded(3)));
  const second=applyAction(first,{type:'play_card',actor:'ai',cardId:'8C',actionId:'exact-id',expectedTurnId:first.turnId},seeded(3));
  assert.equal(second.ok,false);assert.equal(second.error.code,'DUPLICATE_ACTION');assert.equal(second.state,first);
});
test('initial state events are available without a renderer', async()=>{
  const {createMatchWithEvents}=await import('../dist/games/meowdeck/index.js');
  const {state,events}=createMatchWithEvents({sessionId:'initial-events',rng:seeded(3)});
  assert.equal(events[0].type,'MATCH_STARTED');assert.equal(events[1].type,'ROUND_STARTED');
  assert.equal(events[1].starter,'human');assertCardConservation(state);
});
test('public selector returns a copy of the round result, not mutable internal references',()=>{
  const s=mock({human:['5H'],top:'5S'});
  const n=ok(dispatch(s,{type:'play_card',actor:'human',cardId:'5H'}));
  const pub=getPublicGameState(n);pub.roundResult.penalties.human=123;
  assert.equal(n.roundResult.penalties.human,0);
});

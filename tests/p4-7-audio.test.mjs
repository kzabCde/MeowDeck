import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planEventSounds} from '../dist-p4/web/audio/audio-manager.js';

test('P4.7 card play and suit change SFX are staggered instead of stacked',()=>{
 const sounds=planEventSounds([
  {type:'CARD_PLAYED',actor:'human',cardId:'8H',visibility:'public'},
  {type:'SUIT_CHANGED',actor:'human',suit:'S',visibility:'public'}
 ]);
 assert.deepEqual(sounds.map(s=>s.name),['play','suit']);
 assert.ok(sounds[1].offsetMs>=90);
 assert.equal(sounds[0].offsetMs,0);
});
test('match-ending audio is exclusive of the interim round winner',()=>{
 const sounds=planEventSounds([
  {type:'CARD_PLAYED',actor:'human',cardId:'AS',visibility:'public'},
  {type:'ROUND_ENDED',result:{winner:'human'},visibility:'public'},
  {type:'MATCH_ENDED',winner:'human',visibility:'public'}
 ]);
 assert.deepEqual(sounds.map(s=>s.name),['play','matchWin']);
 assert.ok(sounds[1].offsetMs>sounds[0].offsetMs);
});
test('P4.7 drawn cards and quiet public events remain deterministic',()=>{
 const effects=[
  {type:'CARD_DRAWN',actor:'ai',count:1,visibility:'public'},
  {type:'TURN_CHANGED',actor:'human',visibility:'public'}
 ];
 assert.deepEqual(planEventSounds(effects).map(s=>s.name),['draw']);
 assert.deepEqual(planEventSounds(effects),planEventSounds(effects));
 assert.deepEqual(planEventSounds([]),[]);
});

import test from 'node:test';import assert from 'node:assert/strict';import { readFileSync } from 'node:fs';
import { parseMochiManifest,ClipClock,PresentationQueue,clipPriority } from '../dist/games/meowdeck/presentation/mochi-animation.js';
const raw=JSON.parse(readFileSync(new URL('../public/assets/meowdeck/mochi/animations.json',import.meta.url),'utf8'));
const manifest=parseMochiManifest(raw);
test('all 10 clips and 44 frames load from unchanged P0 manifest',()=>{
  assert.equal(manifest.size,10);assert.equal([...manifest.values()].reduce((n,c)=>n+c.frameCount,0),44);
  assert.deepEqual([...manifest.keys()],['idle','blink','thinking','draw_card','play_card','victory','defeat','sleep','pet_reaction','surprise']);
});
test('manifest validator rejects inconsistent frames, timing, paths and loops',()=>{
  for(const [name,update] of [
    ['time',x=>x.animations[0].frameDurationMs=0],['loop',x=>x.animations[2].loop=false],
    ['path',x=>x.animations[0].sheet='../outside.png'],['frame',x=>x.animations[0].frames[1].x=2],
    ['action',x=>x.animations[3].actionFrame=8]
  ]){const x=structuredClone(raw);update(x);assert.throws(()=>parseMochiManifest(x),undefined,name);}
});
test('clock repeats loop and completes one shots with actionFrame once',()=>{
  const looping=new ClipClock(manifest.get('idle'));
  assert.equal(looping.advance(600).frame,3);
  assert.equal(looping.advance(200).frame,0);
  assert.equal(looping.completed,false);
  const clip=manifest.get('play_card'),one=new ClipClock(clip);
  assert.equal(one.advance(200).hitActionFrame,false);
  const at=one.advance(100);assert.equal(at.frame,3);assert.equal(at.hitActionFrame,true);
  assert.equal(one.advance(100).hitActionFrame,false);
  assert.equal(one.advance(200).completed,true);
  assert.equal(one.advance(1200).frame,5);
});
test('presentation queue protects events by unique IDs and resets on new sessions',()=>{
  const q=new PresentationQueue(3);
  const cue=(id,clip)=>({id,clip,sessionId:'x',round:1,turn:1});
  assert.equal(q.enqueue(cue('p','play_card')).id,'p');
  assert.equal(q.enqueue(cue('p','play_card')).id,'p');
  q.enqueue(cue('b','blink'));q.enqueue(cue('s','surprise'));
  assert.equal(q.complete('p').id,'b');
  assert.equal(q.enqueue(cue('victory','victory')).id,'victory');
  assert.equal(q.complete('b').id,'victory');
  assert.equal(clipPriority('victory')>clipPriority('thinking'),true);
  q.clear();assert.equal(q.current,null);assert.equal(q.count,0);
});

test('only confirmed public domain events create card cues without private draw identities',async()=>{
  const {cuesFromConfirmedEvents}=await import('../dist/games/meowdeck/presentation/event-cues.js');
  const context={sessionId:'fair',round:2,turn:4,actionId:'once'};
  const draw=cuesFromConfirmedEvents(context,[{type:'CARD_DRAWN',actor:'ai',count:1,visibility:'public'}]);
  assert.equal(draw.length,1);assert.equal(draw[0].clip,'draw_card');assert.equal(draw[0].cardId,undefined);
  const play=cuesFromConfirmedEvents(context,[
    {type:'CARD_PLAYED',actor:'ai',cardId:'8H',visibility:'public'},
    {type:'SUIT_CHANGED',actor:'ai',suit:'S',visibility:'public'},
    {type:'ROUND_ENDED',result:{roundNumber:2,reason:'empty_hand',winner:'ai',penalties:{human:1,ai:0},handCounts:{human:1,ai:0}},visibility:'public'}
  ]);
  assert.deepEqual(play.map(c=>c.clip),['play_card','victory']);
  assert.equal(play[0].cardId,'8H');
});

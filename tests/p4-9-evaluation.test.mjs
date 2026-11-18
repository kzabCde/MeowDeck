import test from 'node:test';
import assert from 'node:assert/strict';
import {wilsonInterval,pairedGap,evaluateDifficulties} from '../examples/evaluate-ai-difficulty.mjs';

test('P4.9 win intervals are bounded and respect all-win/all-loss edges',()=>{
 assert.deepEqual(wilsonInterval(0,100).slice(0,1),[0]);
 assert.equal(wilsonInterval(100,100)[1],100);
 assert.throws(()=>wilsonInterval(2,1));
});
test('P4.9 paired comparisons distinguish supported evidence from uncertainty',()=>{
 const positive=pairedGap(Array(60).fill(1),Array(60).fill(0));
 assert.equal(positive.assessment,'positive-evidence');
 const same=pairedGap([1,0,1,0],[1,0,1,0]);
 assert.equal(same.assessment,'inconclusive');
 assert.throws(()=>pairedGap([1],[1,0]));
});
test('P4.9 all policies finish seeded matches and report reproducible paired outcomes',()=>{
 const result=evaluateDifficulties(12,71);
 assert.equal(result.seeds,'71..82');
 for(const level of ['easy','normal','hard']){
  const s=result.summary[level];
  assert.equal(s.matches,12);
  assert.equal(s.wins+s.losses+s.draws,12);
  assert.ok(s.decisions>0);
  assert.ok(s.wilson95Pct[0]>=0&&s.wilson95Pct[1]<=100);
  assert.ok(s.p95DecisionMs>=0);
 }
 assert.ok(result.pairedGaps.hardMinusEasy.approximate95Pct.length===2);
});

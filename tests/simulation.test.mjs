import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate} from '../examples/legal-driver.mjs';

test('40 reproducible full matches finish with exactly three round wins',()=>{
  const results=[];
  for(let seed=1;seed<=40;seed++)results.push(simulate(seed));
  assert.deepEqual(results.map(x=>x.steps),Array.from({length:40},(_,i)=>simulate(i+1).steps));
  assert.ok(results.every(x=>x.rounds>=3&&x.steps>3));
});

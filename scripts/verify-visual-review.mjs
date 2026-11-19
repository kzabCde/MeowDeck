import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const dir='test-results/visual-review';
const names=[
  '01-main-menu','02-game-selection','03-difficulty-selection',
  '04-crazy-player-turn','05-crazy-ai-turn','06-crazy-suit-selection',
  '07-crazy-round-result','08-blackjack-initial','09-blackjack-player-action',
  '10-blackjack-round-result','11-settings','12-rules','13-pause',
  '14-statistics','15-save-error'
];
// This is a *failure gate*, not a snapshot update command. A valid screenshot
// must have real PNG bytes with the expected viewport dimensions.
const invalid=[];
for(const name of names){
  const path=join(dir,'p13-'+name+'-390x844.png');
  if(!existsSync(path)){invalid.push('Missing required state: '+path);continue;}
  const bytes=readFileSync(path);
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const w=bytes.length>=24?bytes.readUInt32BE(16):0;
  const h=bytes.length>=24?bytes.readUInt32BE(20):0;
  if(!png||w!==390||h!==844||bytes.length<2500){
    invalid.push('Invalid or incomplete screenshot: '+path);
  }
}
const baselineStates=[
  'main-menu','game-selection','difficulty-selection','crazy-player','blackjack-initial'
];
for(const name of baselineStates){
  const path=join(dir,'p13-baseline-'+name+'-report.json');
  if(!existsSync(path)){invalid.push('Missing baseline comparison report: '+path);continue;}
  const data=JSON.parse(readFileSync(path,'utf8'));
  if(data.sourceRun!==44467286619||data.sourceCommit!=='67f96095bd3a176f7d4cde262357086aae53bf3d')
    invalid.push('Unreviewed baseline reference: '+path);
}
const report=[
  '# MeowDeck Phase 13 — Visual Screenshot Review',
  '',
  '**Reference:** Phase 12 reviewed production run 44467286619, commit 67f9609.',
  '**Status:** '+(invalid.length?'FAIL — see missing or invalid screenshots':'PASS — all 15 required states captured'),
  '',
  '| State | Reviewed screenshot (390 × 844) |',
  '| --- | --- |',
  ...names.map(name=>'| '+name+' | p13-'+name+'-390x844.png |'),
  '',
  'Five baseline spatial-color comparisons are generated separately. Review every screenshot',
  'for alignment, type wrapping, clipped controls, missing art, overlap and visual hierarchy.',
  'The signature is a regression tripwire, not a substitute for human visual inspection.',
  '',
  invalid.length?'## Failures\n'+invalid.map(i=>'- '+i).join('\n'):'No screenshot inventory errors.',
  ''
].join('\n');
writeFileSync(join(dir,'p13-review-checklist.md'),report);
if(invalid.length){
  console.error('Phase 13 screenshot inventory failed:\n'+invalid.join('\n'));
  process.exitCode=1;
}else console.log('Phase 13: 15/15 required screenshots, 5/5 baseline reports present.');

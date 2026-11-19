import {expect,test,type Page} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';

type Reference = {source:string;viewport:[number,number];zones:number[][]};
const baselinePath='e2e/visual-baselines/p13-reviewed-phase12.json';
const doc=JSON.parse(await readFile(baselinePath,'utf8')) as {
  sourceRun:number;sourceCommit:string;grid:[number,number];samplesPerZone:[number,number];
  screens:Record<string,Reference>;
  thresholds:{staticMeanMax:number;gameMeanMax:number;badZoneDelta:number;badZoneCountMax:number}
};

/**
 * Sample actual screenshot pixels, not CSS values. A fixed 4x6 spatial grid
 * protects layout, palette, card-room visual hierarchy, and major typography.
 * Full screenshots are always retained for human inspection; the low-resolution
 * signature is deliberately NOT presented as pixel-perfect visual equivalence.
 */
async function signature(page:Page,png:Buffer):Promise<number[][]>{
  return page.evaluate(async base64=>{
    const image=new Image();
    image.src='data:image/png;base64,'+base64;
    await image.decode();
    const canvas=document.createElement('canvas');
    canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)throw new Error('Visual regression pixel context unavailable');
    context.drawImage(image,0,0);
    const rgba=context.getImageData(0,0,canvas.width,canvas.height).data;
    const result:number[][]=[];
    const columns=4,rows=6,resolution=8;
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const sum=[0,0,0];
      for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
        const px=Math.min(canvas.width-1,Math.floor((col+(x+0.5)/resolution)*canvas.width/columns));
        const py=Math.min(canvas.height-1,Math.floor((row+(y+0.5)/resolution)*canvas.height/rows));
        const offset=(py*canvas.width+px)*4;
        for(let channel=0;channel<3;channel++)sum[channel]+=rgba[offset+channel];
      }
      result.push(sum.map(value=>Math.round(value/(resolution*resolution))));
    }
    return result;
  },png.toString('base64'));
}

async function compare(page:Page,key:string,selector:string,game=false){
  const reference=doc.screens[key];
  expect(reference,'Missing reviewed baseline '+key).toBeDefined();
  await expect(page.locator(selector)).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  const image=await page.screenshot({animations:'disabled',caret:'hide'});
  const observed=await signature(page,image);
  expect(observed.length).toBe(24);
  const differences=observed.map((zone,i)=>zone.reduce((sum,n,c)=>sum+Math.abs(n-reference.zones[i][c]),0)/3);
  const mean=differences.reduce((sum,value)=>sum+value,0)/differences.length;
  const significant=differences.map((value,index)=>({value,index})).filter(zone=>zone.value>doc.thresholds.badZoneDelta);
  await mkdir('test-results/visual-review',{recursive:true});
  await writeFile('test-results/visual-review/p13-baseline-'+key+'-390x844.png',image);
  await writeFile('test-results/visual-review/p13-baseline-'+key+'-report.json',JSON.stringify({
    key,sourceRun:doc.sourceRun,sourceCommit:doc.sourceCommit,
    meanDelta:mean,significantZones:significant,expected:reference.zones,observed
  },null,2));
  expect(mean,'Visual layout/palette drift in '+key+' (reference '+reference.source+')').toBeLessThanOrEqual(
    game?doc.thresholds.gameMeanMax:doc.thresholds.staticMeanMax);
  expect(significant.length,'Too many altered screen regions in '+key).toBeLessThanOrEqual(doc.thresholds.badZoneCountMax);
}

test('reviewed Phase 12 screenshots remain visually consistent through five representative screens',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?qaSeed=62&fastAI=1');
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await compare(page,'main-menu','[data-testid="main-menu"]');
  await page.getByTestId('play-now').click();
  await compare(page,'game-selection','[data-testid="game-selection"]');
  await page.getByTestId('select-crazy-eights').click();
  await compare(page,'difficulty-selection','[data-testid="difficulty-selection"]');
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('player-hand').locator('button')).toHaveCount(7);
  await compare(page,'crazy-player','[data-testid="gameplay-screen"]',true);
  await page.goto('/?qaSeed=62&fastAI=1');
  await page.getByTestId('play-now').click();
  await page.getByTestId('select-blackjack').click();
  await expect(page.getByTestId('blackjack-hit')).toBeVisible();
  await compare(page,'blackjack-initial','[data-testid="blackjack-screen"]',true);
  // Signatures are reviewed, fixed source artifacts. Never regenerate on test failures.
});

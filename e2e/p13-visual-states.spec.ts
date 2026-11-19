import {expect,test,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

const mobile=[390,844] as const;
const portraits=[[320,568],[390,844],[1280,800]] as const;
const output='test-results/visual-review/';

/** Review screenshots show the REAL UI. Do not synthesize dealt cards or fake states. */
async function capture(page:Page,state:string,selector:string,
  viewports:readonly (readonly [number,number])[]=portraits){
  await mkdir(output,{recursive:true});
  for(const [width,height] of viewports){
    await page.setViewportSize({width,height});
    await expect(page.locator(selector)).toBeVisible();
    await page.evaluate(()=>document.fonts.ready);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,'Unexpected document-wide X overflow in '+state+' at '+width+'x'+height).toBeLessThanOrEqual(2);
    const file=output+'p13-'+state+'-'+width+'x'+height+'.png';
    const png=await page.screenshot({path:file,animations:'disabled',caret:'hide'});
    expect(png.length,'Blank/missing screenshot: '+state).toBeGreaterThan(2500);
  }
  await page.setViewportSize({width:mobile[0],height:mobile[1]});
}

async function startCrazy(page:Page,fast=true){
 await page.goto('/?qaSeed=62'+(fast?'&fastAI=1':''));
 await page.getByTestId('play-now').click();
 await page.getByTestId('select-crazy-eights').click();
 await page.getByTestId('start-match').click();
 await expect(page.getByTestId('gameplay-screen')).toBeVisible();
 if(await page.getByTestId('tutorial-skip').isVisible().catch(()=>false))
   await page.getByTestId('tutorial-skip').click();
}

async function startBlackjack(page:Page,seed=62){
 await page.goto('/?qaSeed='+seed+'&fastAI=1');
 await page.getByTestId('play-now').click();
 await page.getByTestId('select-blackjack').click();
 await expect(page.getByTestId('blackjack-screen')).toBeVisible();
}

test('visual matrix: title, both game choices, difficulty and every non-gameplay modal',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await capture(page,'01-main-menu','[data-testid="main-menu"]');
 await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).first().click();
 await capture(page,'11-settings','dialog[open]');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:/How to play|วิธีเล่น/i}).first().click();
 await capture(page,'12-rules','dialog[open]');
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:/Statistics|สถิติ/i}).first().click();
 await expect(page.getByTestId('statistics-panel')).toBeVisible();
 await capture(page,'14-statistics','dialog[open]');
 await page.keyboard.press('Escape');
 await page.getByTestId('play-now').click();
 await capture(page,'02-game-selection','[data-testid="game-selection"]');
 await page.getByTestId('select-crazy-eights').click();
 await capture(page,'03-difficulty-selection','[data-testid="difficulty-selection"]');
});

test('visual matrix: Crazy Eights player turn, pause, wild eight choice and genuine AI turn',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 // Disabling fastAI leaves the *real* AI turn visible for its natural presentation.
 await startCrazy(page,false);
 await expect(page.getByTestId('player-hand').locator('button')).toHaveCount(7);
 await capture(page,'04-crazy-player-turn','[data-testid="gameplay-screen"]');
 await page.getByTestId('pause-button').click();
 await capture(page,'13-pause','dialog[open]');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 // Seed 62 deals a legal 8D in round 1: this opens the actual suit-choice dialog.
 const eight=page.getByTestId('player-hand').locator('button[data-testid^="card-8"]:not([disabled])').first();
 await expect(eight).toBeVisible();
 await eight.click();
 await page.getByTestId('play-selected').click();
 await expect(page.getByTestId('suit-S')).toBeVisible();
 await capture(page,'06-crazy-suit-selection','dialog[open]');
 await page.getByTestId('suit-S').click();
 // Unlike a screenshot of a mocked turn, wait for the state machine to announce Mochi's turn.
 await expect(page.getByTestId('turn-status')).toContainText(/Mochi|โมจิ/);
 await capture(page,'05-crazy-ai-turn','[data-testid="gameplay-screen"]',[[390,844]]);
});

test('visual matrix: actual Crazy Eights round result after legal seeded gameplay',async({page})=>{
 test.setTimeout(180_000);
 await page.setViewportSize({width:390,height:844});
 await startCrazy(page,true);
 let ended=false;
 // This is the real state machine and legal UI actions. Never inject a fabricated score or round.
 for(let attempt=0;attempt<500;attempt++){
   if(await page.getByTestId('next-round').isVisible().catch(()=>false)){ended=true;break;}
   if(await page.getByTestId('suit-S').isVisible().catch(()=>false)){
     await page.getByTestId('suit-S').click();continue;
   }
   const play=page.getByTestId('player-hand').locator('button[data-playable="true"]:not([disabled])').first();
   if(await play.count()){
     await play.click();
     await page.getByTestId('play-selected').click();
     continue;
   }
   if(await page.getByTestId('draw-card').isVisible().catch(()=>false)){
     await page.getByTestId('draw-card').click();continue;
   }
   if(await page.getByTestId('finish-turn').isVisible().catch(()=>false)){
     await page.getByTestId('finish-turn').click();continue;
   }
   if(await page.getByTestId('pass-turn').isVisible().catch(()=>false)){
     await page.getByTestId('pass-turn').click();continue;
   }
   await page.waitForTimeout(35);
 }
 expect(ended,'Round result must come from legal moves in the real engine').toBe(true);
 await expect(page.getByTestId('result-winner')).toBeVisible();
 await capture(page,'07-crazy-round-result','dialog[open]');
});

test('visual matrix: Blackjack initial hand, genuine player Hit and round result',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await startBlackjack(page,62);
 await expect(page.getByTestId('blackjack-hit')).toBeEnabled();
 await capture(page,'08-blackjack-initial','[data-testid="blackjack-screen"]');
 // A fresh save is necessary because Blackjack persists independently of Crazy Eights.
 await page.evaluate(()=>localStorage.removeItem('meowdeck:blackjack:1'));
 await startBlackjack(page,2);
 await expect(page.getByTestId('blackjack-player-total')).toHaveText('9');
 await page.getByTestId('blackjack-hit').click();
 await expect(page.getByTestId('blackjack-player-hand').locator('img')).toHaveCount(3);
 await expect(page.getByTestId('blackjack-player-total')).toHaveText('19');
 await capture(page,'09-blackjack-player-action','[data-testid="blackjack-screen"]');
 await page.getByTestId('blackjack-stand').click();
 await expect(page.getByTestId('blackjack-result')).toBeVisible();
 await capture(page,'10-blackjack-round-result','[data-testid="blackjack-screen"]');
});

test('visual matrix: genuine localized save-unavailable state from failed IndexedDB',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{
   // Exercise the real persistence error path; no fake alert, screenshot overlay, or UI mock.
   Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined});
 });
 await page.goto('/');
 const warning=page.getByTestId('save-status');
 await expect(warning).toBeVisible();
 await expect(warning).toHaveAttribute('role','alert');
 await expect(warning).toContainText(/บันทึก|พื้นที่|Save|storage/i);
 await capture(page,'15-save-error','[data-testid="main-menu"]');
});

test('visual matrix: English and landscape typography remains visible and operable',async({page})=>{
 await page.setViewportSize({width:667,height:375});
 await page.goto('/');
 await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).first().click();
 await page.getByRole('combobox',{name:/Language|ภาษา/i}).selectOption('en');
 await page.keyboard.press('Escape');
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await capture(page,'language-en-menu','[data-testid="main-menu"]',[[667,375],[390,844]]);
 await page.getByTestId('play-now').click();
 await capture(page,'language-en-game-selection','[data-testid="game-selection"]',[[667,375],[390,844]]);
 await page.getByTestId('select-crazy-eights').click();
 await capture(page,'language-en-difficulty','[data-testid="difficulty-selection"]',[[667,375],[390,844]]);
});

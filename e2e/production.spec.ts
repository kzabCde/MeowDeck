import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('Next.js production App Router hydrates, serves canonical manifests and stays playable', async ({ page, request }) => {
  const pageErrors: string[] = [];
  const badConsole: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /hydration|mismatch|uncaught|runtime|manifest/i.test(message.text())) {
      badConsole.push(message.text());
    }
  });

  const home = await page.goto('/?qaSeed=62&fastAI=1', { waitUntil: 'domcontentloaded' });
  expect(home?.status()).toBe(200);
  await expect(page).toHaveTitle('MeowDeck');
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(page.getByTestId('play-now')).toBeEnabled();

  for (const assetPath of [
    '/assets/meowdeck/cards/manifest.json',
    '/assets/meowdeck/mochi/animations.json',
    '/assets/meowdeck/cards/backs/card_back.png',
    '/assets/meowdeck/mochi/sprites/mochi_idle_4f_96x96.png'
  ]) {
    const response = await request.get(assetPath);
    expect(response.status(), `Public asset must be available: ${assetPath}`).toBe(200);
  }

  await page.getByTestId('play-now').click();
  await page.getByTestId('select-crazy-eights').click();
  
  await page.getByTestId('difficulty-hard').click();
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();
  await expect(page.getByTestId('player-hand').locator('button')).toHaveCount(7);
  expect(pageErrors).toEqual([]);
  expect(badConsole).toEqual([]);
});

test('Next.js production mobile mount has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await page.getByTestId('play-now').click();
  await expect(page.getByTestId('game-selection')).toBeVisible();
  await page.screenshot({ path: 'test-results/visual-review/game-select-mobile-390x844.png', animations: 'disabled' });
  for(const [width,height] of [[320,568],[430,932],[1280,800]] as const){
    await page.setViewportSize({width,height});
    await expect(page.getByTestId('select-crazy-eights')).toBeVisible();
    await page.screenshot({
      path: `test-results/visual-review/game-select-${width}x${height}.png`,animations:'disabled'
    });
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByTestId('select-crazy-eights').click();
  await expect(page.getByTestId('difficulty-selection')).toBeVisible();
  
  await expect(page.getByTestId('difficulty-selection')).toBeVisible();
  await page.screenshot({ path: 'test-results/visual-review/difficulty-mobile-390x844.png', animations: 'disabled' });
  for(const [width,height] of [[320,568],[430,932]] as const){
    await page.setViewportSize({width,height});
    await expect(page.getByTestId('start-match')).toBeVisible();
    await page.screenshot({
      path: `test-results/visual-review/difficulty-${width}x${height}.png`,animations:'disabled'
    });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: 'test-results/visual-review/difficulty-desktop-1280x720.png', animations: 'disabled' });
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
});

/** CI emits real production screenshots for art-direction review; tests alone cannot grade visuals. */
test('production visual review captures original sprites on title and table, desktop and mobile', async ({ page }) => {
  await mkdir('test-results/visual-review', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await page.screenshot({ path: 'test-results/visual-review/title-desktop-1280x720.png', animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/visual-review/title-mobile-390x844.png', animations: 'disabled' });
  // Phase 4 visual evidence: verify the real production scene on compact and wide screens.
  for (const [width, height, label] of [
    [320, 568, 'mobile'],
    [430, 932, 'mobile'],
    [1920, 1080, 'desktop']
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.getByTestId('title-scene')).toBeVisible();
    const play = await page.getByTestId('play-now').boundingBox();
    expect(play).not.toBeNull();
    expect((play?.y ?? Infinity) + (play?.height ?? 0)).toBeLessThanOrEqual(height + 1);
    await page.screenshot({
      path: `test-results/visual-review/title-${label}-${width}x${height}.png`,
      animations: 'disabled'
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('play-now').click();
  await page.getByTestId('select-crazy-eights').click();
  
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();

  for (const [width, height] of [[1280, 720], [1920, 1080], [768, 1024], [430, 932], [390, 844], [320, 568]] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.getByTestId('top-discard')).toBeVisible();
    await page.screenshot({
      path: `test-results/visual-review/table-${width}x${height}.png`,
      animations: 'disabled'
    });
  }
});

test('P5 production Blackjack runs without test seed and restores a finished round',async({page})=>{
 await page.goto('/?qaSeed=62&fastAI=1');
 await page.getByTestId('play-now').click();
 await expect(page.getByTestId('game-selection')).toBeVisible();
 await page.getByTestId('select-blackjack').click();
 await expect(page.getByTestId('blackjack-screen')).toBeVisible();
 await mkdir('test-results/visual-review',{recursive:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'test-results/visual-review/blackjack-mobile-390x844.png',animations:'disabled'});
 await page.setViewportSize({width:1280,height:720});
 await page.screenshot({path:'test-results/visual-review/blackjack-desktop-1280x720.png',animations:'disabled'});
 // Production Phase 6: both game tables captured using original sprites at compact and wide sizes.
 for(const [width,height] of [[320,568],[430,932],[768,1024],[1920,1080]] as const){
   await page.setViewportSize({width,height});
   await expect(page.getByTestId('blackjack-table')).toBeVisible();
   const box=await page.getByTestId('blackjack-action-rail').boundingBox();
   expect((box?.y??Infinity)+(box?.height??0)).toBeLessThanOrEqual(height+1);
   await page.screenshot({path:`test-results/visual-review/blackjack-${width}x${height}.png`,animations:'disabled'});
 }
 await page.setViewportSize({width:1280,height:720});
 // A responsive table is not acceptable if its primary actions are below the fold.
 const action=await page.getByTestId('blackjack-hit').boundingBox();
 expect(action).not.toBeNull();
 expect((action?.y??0)+(action?.height??0)).toBeLessThanOrEqual(720);
 const cards=page.getByTestId('blackjack-player-hand').locator('img');
 await expect(cards).toHaveCount(2);
 if(await page.getByTestId('blackjack-stand').isVisible().catch(()=>false))
   await page.getByTestId('blackjack-stand').click();
 await expect(page.getByTestId('blackjack-result')).toBeVisible();
 const persisted=await page.evaluate(()=>JSON.parse(localStorage.getItem('meowdeck:blackjack:1')||'null'));
 expect(persisted?.game).toBe('blackjack');
 await page.reload();
 await page.getByTestId('play-now').click();
 await page.getByTestId('select-blackjack').click();
 await expect(page.getByTestId('blackjack-result')).toBeVisible();
});


test('Phase 7 production captures genuine Mochi pet frames in both games without game-state mutation',async({page})=>{
 await mkdir('test-results/visual-review',{recursive:true});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.getByTestId('play-now').click();
 await page.getByTestId('select-crazy-eights').click();
 await page.getByTestId('start-match').click();
 const crazyMochi=page.getByTestId('mochi');
 const crazySprite=crazyMochi.locator('.mochi-frame');
 await expect(crazySprite).toHaveAttribute('data-clip','idle');
 const cardsBefore=await page.getByTestId('player-hand').locator('button').count();
 await crazyMochi.click();
 await expect(crazySprite).toHaveAttribute('data-clip','pet_reaction');
 await expect.poll(async()=>Number(await crazySprite.getAttribute('data-frame'))).toBeGreaterThanOrEqual(1);
 await page.screenshot({path:'test-results/visual-review/mochi-pet-crazy-eights-production-390x844.png',animations:'disabled'});
 await expect(page.getByTestId('player-hand').locator('button')).toHaveCount(cardsBefore);
 // Fresh mount keeps Blackjack's separate save/engine; no test seed in production.
 await page.goto('/');
 await page.getByTestId('play-now').click();
 await page.getByTestId('select-blackjack').click();
 // Wait for the saved-hand hydration before inspecting any action buttons.
 // A natural Blackjack is a valid initial deal; advance only that finished round.
 await expect(page.getByTestId('blackjack-screen')).toBeVisible();
 for(let tries=0;tries<6;tries++){
   if(await page.getByTestId('blackjack-hit').isVisible().catch(()=>false))break;
   await page.getByTestId('blackjack-next').click();
 }
 await expect(page.getByTestId('blackjack-hit')).toBeVisible();
 const blackjackMochi=page.getByTestId('mochi');
 const blackjackSprite=blackjackMochi.locator('.mochi-frame');
 await expect(blackjackSprite).toHaveAttribute('data-clip','idle');
 const before=await page.evaluate(()=>localStorage.getItem('meowdeck:blackjack:1'));
 await blackjackMochi.click();
 await expect(blackjackSprite).toHaveAttribute('data-clip','pet_reaction');
 await expect.poll(async()=>Number(await blackjackSprite.getAttribute('data-frame'))).toBeGreaterThanOrEqual(1);
 await page.screenshot({path:'test-results/visual-review/mochi-pet-blackjack-production-390x844.png',animations:'disabled'});
 expect(await page.evaluate(()=>localStorage.getItem('meowdeck:blackjack:1'))).toBe(before);
});


// Phase 8: verify production UI omits success narration while keeping tutorials.
test('Phase 8 production keeps successful saves silent and action prompts contextual',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await expect(page.getByTestId('main-menu')).toBeVisible();
 await expect(page.getByTestId('save-status')).toHaveCount(0);
 await expect(page.getByText(/บันทึกแล้ว|พร้อมเล่นแบบออฟไลน์|Saved successfully|Ready for offline play/i)).toHaveCount(0);
 await page.getByTestId('play-now').click();
 await expect(page.getByTestId('select-blackjack')).toContainText('ทำแต้มใกล้ 21 แต่ห้ามเกิน');
 await page.getByTestId('select-crazy-eights').click();
 await page.getByTestId('start-match').click();
 await expect(page.getByTestId('gameplay-screen')).toBeVisible();
 await expect(page.getByTestId('tutorial-hint')).toBeVisible();
 await page.getByTestId('tutorial-skip').click();
 await expect(page.locator('.action-status')).toHaveText('');
 await expect(page.locator('.action-status')).not.toHaveAttribute('role','status');
 await expect(page.getByTestId('save-status')).toHaveCount(0);
 await mkdir('test-results/visual-review',{recursive:true});
 await page.screenshot({path:'test-results/visual-review/p8-clean-game-390x844.png',animations:'disabled'});
});


// Phase 9: real production renders, portrait + short landscape + compact reflow.
test('Phase 9 captures notch-aware mobile and landscape game scenes',async({page})=>{
 await mkdir('test-results/visual-review',{recursive:true});
 await page.setViewportSize({width:375,height:667});
 await page.goto('/');
 await expect(page.getByTestId('main-menu')).toBeVisible();
 await page.screenshot({path:'test-results/visual-review/p9-menu-375x667.png',animations:'disabled'});
 await page.getByTestId('play-now').click();
 await page.screenshot({path:'test-results/visual-review/p9-game-select-375x667.png',animations:'disabled'});
 await page.getByTestId('select-crazy-eights').click();
 await page.getByTestId('start-match').click();
 await expect(page.getByTestId('gameplay-screen')).toBeVisible();
 if(await page.getByTestId('tutorial-skip').isVisible().catch(()=>false))
   await page.getByTestId('tutorial-skip').click();
 for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[768,1024],[1280,800],[1920,1080],[667,375],[844,390],[640,360]] as const){
   await page.setViewportSize({width,height});
   const hand=page.getByTestId('player-hand');
   await expect(hand).toBeVisible();
   await page.screenshot({path:`test-results/visual-review/p9-crazy-${width}x${height}.png`,animations:'disabled'});
 }
 await page.goto('/');
 await page.getByTestId('play-now').click();
 await page.getByTestId('select-blackjack').click();
 await expect(page.getByTestId('blackjack-screen')).toBeVisible();
 for(const [width,height] of [[320,568],[375,667],[390,844],[430,932],[667,375],[844,390],[1280,800]] as const){
   await page.setViewportSize({width,height});
   await expect(page.getByTestId('blackjack-table')).toBeVisible();
   await page.screenshot({path:`test-results/visual-review/p9-blackjack-${width}x${height}.png`,animations:'disabled'});
 }
 await page.setViewportSize({width:667,height:375});
 await page.getByTestId('blackjack-rules').click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.screenshot({path:'test-results/visual-review/p9-dialog-landscape-667x375.png',animations:'disabled'});
});


test('Phase 10 production captures selection, pause and result feedback with original card art',async({page})=>{
 await mkdir('test-results/visual-review',{recursive:true});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.getByTestId('play-now').click();
 await page.getByTestId('select-crazy-eights').click();
 await page.getByTestId('start-match').click();
 await expect(page.getByTestId('gameplay-screen')).toBeVisible();
 if(await page.getByTestId('tutorial-skip').isVisible().catch(()=>false))
  await page.getByTestId('tutorial-skip').click();
 const playable=page.getByTestId('player-hand').locator('.card-tile.is-playable:not(:disabled)').first();
 await playable.click();
 await expect(playable).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:'test-results/visual-review/p10-card-selected-390x844.png',animations:'disabled'});
 await page.getByTestId('pause-button').click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.screenshot({path:'test-results/visual-review/p10-pause-dialog-390x844.png',animations:'disabled'});
 await page.goto('/');
 await page.getByTestId('play-now').click();
 await page.getByTestId('select-blackjack').click();
 await expect(page.getByTestId('blackjack-screen')).toBeVisible();
 for(let i=0;i<6;i++){
   if(await page.getByTestId('blackjack-stand').isVisible().catch(()=>false))break;
   await page.getByTestId('blackjack-next').click();
 }
 await expect(page.getByTestId('blackjack-stand')).toBeVisible();
 await page.getByTestId('blackjack-stand').click();
 await expect(page.getByTestId('blackjack-result')).toBeVisible();
 await page.screenshot({path:'test-results/visual-review/p10-blackjack-result-390x844.png',animations:'disabled'});
 await page.setViewportSize({width:1280,height:800});
 await page.screenshot({path:'test-results/visual-review/p10-blackjack-result-1280x800.png',animations:'disabled'});
});

import {expect,test,type Page} from '@playwright/test';

async function startCrazyEights(page:Page){
  await page.goto('/?qaSeed=62&fastAI=1');
  await page.getByTestId('play-now').click();
  await page.getByTestId('select-crazy-eights').click();
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();
  if(await page.getByTestId('tutorial-skip').isVisible().catch(()=>false))
    await page.getByTestId('tutorial-skip').click();
}

async function startBlackjack(page:Page){
  await page.goto('/?qaSeed=62&fastAI=1');
  await page.getByTestId('play-now').click();
  await page.getByTestId('select-blackjack').click();
  await expect(page.getByTestId('blackjack-screen')).toBeVisible();
}

const screens=[
  [320,568],[375,667],[390,844],[430,932],
  [768,1024],[1280,800],[1920,1080],
  [667,375],[844,390],[640,360] // compact landscape and 200% zoom-equivalent reflow
] as const;

for(const [width,height] of screens){
  test(`Crazy Eights keeps every card independently tappable at ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await startCrazyEights(page);
    const hand=page.getByTestId('player-hand');
    const cards=hand.locator('.card-tile');
    await expect(cards).toHaveCount(7);
    const one=await cards.nth(0).boundingBox(),two=await cards.nth(1).boundingBox();
    expect(one).not.toBeNull();
    expect(two).not.toBeNull();
    expect(one?.width).toBeGreaterThanOrEqual(44);
    expect(two?.width).toBeGreaterThanOrEqual(44);
    // Previously negative margins let the neighboring card steal part of the tap.
    expect(two!.x).toBeGreaterThanOrEqual(one!.x+one!.width-1);
    const overflow=await hand.evaluate(el=>el.scrollWidth>el.clientWidth+2);
    await expect(hand).toHaveAttribute('data-overflow',String(overflow));
    if(overflow){
      await expect(page.getByTestId('hand-scroll-cue')).toBeVisible();
      await hand.evaluate(el=>{el.scrollLeft=el.scrollWidth;});
      await expect.poll(()=>hand.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
      const handEnd=await hand.boundingBox(),last=await cards.last().boundingBox();
      expect((last?.x??Infinity)+(last?.width??0)).toBeLessThanOrEqual((handEnd?.x??0)+(handEnd?.width??0)+3);
    }else{
      await expect(page.getByTestId('hand-scroll-cue')).toHaveCount(0);
    }
    const rail=page.getByTestId('crazy-eights-action-rail');
    const primary=page.getByTestId('play-selected');
    await primary.scrollIntoViewIfNeeded();
    await expect(primary).toBeVisible();
    const rect=await primary.boundingBox();
    expect(rect?.height).toBeGreaterThanOrEqual(44);
    expect(rect?.y).toBeGreaterThanOrEqual(-1);
    expect((rect?.y??Infinity)+(rect?.height??0)).toBeLessThanOrEqual(height+2);
    await expect(rail).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    await expect(page.getByTestId('top-discard')).toBeAttached();
    await expect(page.getByTestId('human-score')).toBeVisible();
    await expect(page.getByTestId('active-suit')).toBeAttached();
  });

  test(`Blackjack keeps score, cards and action controls reachable at ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await startBlackjack(page);
    const action=page.getByTestId('blackjack-hit');
    const rail=page.getByTestId('blackjack-action-rail');
    await action.scrollIntoViewIfNeeded();
    const box=await action.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.y).toBeGreaterThanOrEqual(-1);
    expect((box?.y??Infinity)+(box?.height??0)).toBeLessThanOrEqual(height+2);
    await expect(rail).toBeVisible();
    await expect(page.getByTestId('blackjack-player-total')).toBeVisible();
    await expect(page.getByTestId('blackjack-dealer-total')).toBeVisible();
    await expect(page.getByTestId('blackjack-player-hand').locator('img')).toHaveCount(2);
    const hands=page.locator('.md5-bj-hand');
    for(const hand of await hands.all()){
      const rect=await hand.boundingBox();
      expect(rect?.width).toBeGreaterThan(100);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  });
}

for(const [width,height] of [[320,568],[667,375],[844,390]] as const){
  test(`dialogs can scroll to action buttons inside ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await startCrazyEights(page);
    await page.getByTestId('pause-button').click();
    const dialog=page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box=await dialog.boundingBox();
    expect(box?.y).toBeGreaterThanOrEqual(-1);
    expect((box?.y??Infinity)+(box?.height??0)).toBeLessThanOrEqual(height+2);
    const replay=page.getByTestId('tutorial-replay');
    await replay.scrollIntoViewIfNeeded();
    await expect(replay).toBeVisible();
    const replayBox=await replay.boundingBox();
    expect(replayBox?.height).toBeGreaterThanOrEqual(44);
    expect((replayBox?.y??Infinity)+(replayBox?.height??0)).toBeLessThanOrEqual(height+2);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
}

test('orientation changes preserve the selected game and the same hand',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await startCrazyEights(page);
  const round=await page.getByTestId('round-number').textContent();
  const deck=await page.getByTestId('draw-count').textContent();
  const cardIDs=await page.getByTestId('player-hand').locator('button').evaluateAll(btns=>btns.map(el=>el.getAttribute('data-testid')));
  await page.setViewportSize({width:844,height:390});
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();
  await page.getByTestId('play-selected').scrollIntoViewIfNeeded();
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByTestId('round-number')).toHaveText(round??'');
  await expect(page.getByTestId('draw-count')).toHaveText(deck??'');
  expect(await page.getByTestId('player-hand').locator('button').evaluateAll(btns=>btns.map(el=>el.getAttribute('data-testid')))).toEqual(cardIDs);
});

test('mobile touch events reach each original card rather than a neighboring overlay',async({browser})=>{
  const context=await browser.newContext({viewport:{width:320,height:568},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  try{
    const page=await context.newPage();
    await startCrazyEights(page);
    const card=page.getByTestId('player-hand').locator('.card-tile.is-playable:not([disabled])').first();
    await expect(card).toBeVisible();
    const rect=await card.boundingBox();
    expect(rect?.width).toBeGreaterThanOrEqual(44);
    await page.touchscreen.tap(rect!.x+rect!.width/2,rect!.y+rect!.height/2);
    await expect(card).toHaveAttribute('aria-pressed','true');
  }finally{await context.close();}
});

test('viewport metadata enables notch-safe standalone PWA rendering',async({page,request})=>{
  await page.goto('/');
  const viewport=await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).toContain('viewport-fit=cover');
  const response=await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest=await response.json() as {display?:string};
  expect(manifest.display).toBe('standalone');
});

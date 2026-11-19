import { expect, test } from '@playwright/test';

test('menu, selection and dialogs share card-room typography and controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('main-menu')).toBeVisible();
  const design = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const play = getComputedStyle(document.querySelector('[data-testid="play-now"]')!);
    return { felt: root.getPropertyValue('--md-table').trim(),
      gold: root.getPropertyValue('--md-gold').trim(), ui: root.getPropertyValue('--md-font-ui').trim(),
      buttonFont: play.fontFamily, buttonHeight: parseFloat(play.minHeight) };
  });
  expect(design.felt).toBe('#194b40');
  expect(design.gold).toBe('#e8c17c');
  expect(design.ui).toMatch(/Noto Sans Thai|Thonburi/);
  expect(design.buttonFont).toMatch(/Noto Sans Thai|Thonburi/);
  expect(design.buttonHeight).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.md4-title-ornament, .md4-title-suits, .md4-menu-footer')).toHaveCount(0);
  await page.getByRole('button', {name:/Settings|ตั้งค่า/}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const colors = await dialog.evaluate(el => ({
    border: getComputedStyle(el).borderTopColor,
    font: getComputedStyle(el).fontFamily
  }));
  expect(colors.border).toMatch(/rgb\(152, 119, 80\)/);
  expect(colors.font).toMatch(/Noto Sans Thai|Thonburi/);
});

test('Crazy Eights and Blackjack use matching table material and focus treatment', async ({ page }) => {
  // Fixed QA seed: an unseeded Blackjack can settle a natural on deal with no Hit button.
  // Production random dealing is unchanged. The normal P5 tests use this same seed.
  await page.goto('/?qaSeed=62&fastAI=1');
  await page.getByTestId('play-now').click();
  await page.getByTestId('select-blackjack').click();
  await expect(page.getByTestId('blackjack-screen')).toBeVisible();
  const blackjack = await page.locator('.md5-bj-felt').evaluate(el => ({
    border: getComputedStyle(el).borderTopColor,
    background: getComputedStyle(el).backgroundImage
  }));
  const hit = page.getByTestId('blackjack-hit');
  expect((await hit.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await page.getByTestId('blackjack-back').click();
  await page.getByTestId('select-crazy-eights').click();
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();
  const crazyEights = await page.locator('.md4-cardroom .game-table').evaluate(el => ({
    border: getComputedStyle(el).borderTopColor,
    background: getComputedStyle(el).backgroundImage
  }));
  expect(crazyEights.border).toBe(blackjack.border);
  expect(crazyEights.background).toBe(blackjack.background);
  expect((await page.getByTestId('play-selected').boundingBox())?.height).toBeGreaterThanOrEqual(44);
});


test('settings use touch-sized game controls and accessible native inputs', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name:/Settings|ตั้งค่า/}).click();
  await expect(page.getByTestId('persistent-settings')).toBeVisible();
  const inputs = await page.locator('.p4-settings select, .p4-settings input[type=range]').evaluateAll(nodes =>
    nodes.map(node => ({height:node.getBoundingClientRect().height, font:getComputedStyle(node).fontFamily}))
  );
  expect(inputs.length).toBeGreaterThanOrEqual(4);
  for(const input of inputs) {
    expect(input.height).toBeGreaterThanOrEqual(44);
    expect(input.font).toMatch(/Noto Sans Thai|Thonburi|sans-serif/);
  }
  const toggle = page.getByTestId('sfx-toggle');
  await toggle.check();
  await expect(toggle).toBeChecked();
  const close = page.getByRole('button', {name:/Close|ปิด/i});
  const box = await close.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(box?.width).toBeGreaterThanOrEqual(44);
  await close.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

// Phase 4 acceptance: the title is a game scene, and the Play action stays above
// the fold on compact screens without hiding its functional menu navigation.
for (const [width,height] of [[320,568],[390,844],[430,932],[768,1024],[1280,800],[1920,1080]] as const) {
  test(`title scene keeps Mochi and the play action reachable at ${width}x${height}`, async ({page}) => {
    await page.setViewportSize({width,height});
    await page.goto('/');
    const scene = page.getByTestId('title-scene');
    const mochi = scene.getByTestId('mochi');
    const play = page.getByTestId('play-now');
    await expect(scene).toBeVisible();
    await expect(mochi).toBeVisible();
    await expect(play).toBeVisible();
    const button = await play.boundingBox();
    expect(button?.height).toBeGreaterThanOrEqual(44);
    expect(button?.y ?? Infinity).toBeGreaterThanOrEqual(0);
    expect((button?.y ?? Infinity)+(button?.height ?? 0)).toBeLessThanOrEqual(height+1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    const images = await scene.locator('img').evaluateAll(nodes =>
      nodes.map(node => ({complete:(node as HTMLImageElement).complete,width:(node as HTMLImageElement).naturalWidth}))
    );
    expect(images.length).toBeGreaterThanOrEqual(3);
    for(const img of images) expect(img.complete && img.width>0).toBe(true);
  });
}

test('title scene play and auxiliary controls remain functional after redesign',async({page})=>{
  await page.goto('/');
  await expect(page.getByTestId('continue')).toHaveCount(0);
  await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByTestId('play-now').click();
  await expect(page.getByTestId('game-selection')).toBeVisible();
});

// Phase 5: both physical table choices must be visible, fully tappable,
// display actual pixel-card assets and leave no horizontal overflow.
for(const [width,height] of [[320,568],[390,844],[430,932],[768,1024],[1280,800]] as const){
  test(`game selection is accessible at ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.goto('/?qaSeed=62&fastAI=1');
    await page.getByTestId('play-now').click();
    await expect(page.getByTestId('game-selection')).toBeVisible();
    const choices=page.getByTestId('game-choice-list').locator('button');
    await expect(choices).toHaveCount(2);
    for(const button of await choices.all()){
      await expect(button).toBeVisible();
      const box=await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(100);
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.y??Infinity).toBeGreaterThanOrEqual(0);
      expect((box?.y??Infinity)+(box?.height??0)).toBeLessThanOrEqual(height+1);
      const art=button.locator('img');
      await expect(art).toHaveCount(3);
      await expect.poll(()=>art.evaluateAll(imgs=>imgs.every(el=>(el as HTMLImageElement).naturalWidth>0))).toBe(true);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  });
}

for(const [width,height] of [[320,568],[390,844],[1280,800]] as const){
  test(`difficulty grid stays playable at ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.goto('/?qaSeed=62&fastAI=1');
    await page.getByTestId('play-now').click();
    await page.getByTestId('select-crazy-eights').click();
    await expect(page.getByTestId('difficulty-selection')).toBeVisible();
    await expect(page.getByTestId('difficulty-selection').getByTestId('mochi')).toBeVisible();
    const modes=page.locator('.md4-mode-strip button');
    await expect(modes).toHaveCount(4);
    for(const button of await modes.all()){
      const bounds=await button.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }
    const start=page.getByTestId('start-match');
    const bounds=await start.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect((bounds?.y??Infinity)+(bounds?.height??0)).toBeLessThanOrEqual(height+1);
    const desc=page.locator('#difficulty-description');
    const before=await desc.innerText();
    await page.getByTestId('difficulty-hard').click();
    await expect(page.getByTestId('difficulty-hard')).toHaveAttribute('aria-pressed','true');
    await expect(page.getByTestId('difficulty-practice')).toHaveAttribute('aria-pressed','false');
    expect(await desc.innerText()).not.toBe(before);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    await start.click();
    await expect(page.getByTestId('gameplay-screen')).toBeVisible();
  });
}

test('keyboard choice routes Blackjack directly and Crazy Eights through opponent selection',async({page})=>{
  await page.goto('/?qaSeed=62&fastAI=1');
  await page.getByTestId('play-now').click();
  await page.getByTestId('select-blackjack').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('blackjack-screen')).toBeVisible();
  await page.getByTestId('blackjack-back').click();
  await page.getByTestId('select-crazy-eights').click();
  await expect(page.getByTestId('difficulty-selection')).toBeVisible();
  await page.getByTestId('difficulty-hard').focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('difficulty-hard')).toHaveAttribute('aria-pressed','true');
});

// Phase 5 i18n check: long English labels and explanation must remain playable on narrow screens.
for(const [width,height] of [[320,568],[390,844]] as const){
  test(`English selection copy stays within playable UI at ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.goto('/?qaSeed=62&fastAI=1');
    await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).click();
    await page.getByRole('combobox',{name:/Language|ภาษา/i}).selectOption('en');
    await page.keyboard.press('Escape');
    await page.getByTestId('play-now').click();
    await expect(page.getByRole('heading',{name:'Choose a game'})).toBeVisible();
    const option=page.getByTestId('select-crazy-eights');
    const title=option.locator('.md5-choice-copy strong');
    const parent=await option.boundingBox(), child=await title.boundingBox();
    expect((child?.x??0)+(child?.width??0)).toBeLessThanOrEqual((parent?.x??0)+(parent?.width??0)+1);
    await option.click();
    await expect(page.getByRole('heading',{name:'Choose your opponent'})).toBeVisible();
    await page.getByTestId('difficulty-hard').click();
    await expect(page.getByTestId('difficulty-hard')).toHaveAttribute('aria-pressed','true');
    const button=await page.getByTestId('start-match').boundingBox();
    expect((button?.y??Infinity)+(button?.height??0)).toBeLessThanOrEqual(height+1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  });
}

// Phase 6: preserve gameplay actions and card-readability at every supported screen size.
for(const [width,height] of [[320,568],[390,844],[430,932],[768,1024],[1280,720],[1920,1080]] as const){
  test(`Crazy Eights HUD, felt and controls remain readable at ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.goto('/?qaSeed=62&fastAI=1');
    await page.getByTestId('play-now').click();
    await page.getByTestId('select-crazy-eights').click();
    await page.getByTestId('start-match').click();
    await expect(page.getByTestId('gameplay-screen')).toBeVisible();
    const header=page.locator('.md4-cardroom .game-hud');
    const round=page.locator('.md4-cardroom .hud-round');
    const score=page.locator('.md4-cardroom .hud-score');
    await expect(page.getByTestId('round-number')).toBeVisible();
    await expect(page.getByTestId('human-score')).toBeVisible();
    await expect(page.getByTestId('mochi-score')).toBeVisible();
    const [headBox,roundBox,scoreBox,pauseBox]=await Promise.all([
      header.boundingBox(),round.boundingBox(),score.boundingBox(),page.getByTestId('pause-button').boundingBox()
    ]);
    expect((roundBox?.y??Infinity)).toBeGreaterThanOrEqual((headBox?.y??0)-1);
    expect((roundBox?.y??Infinity)+(roundBox?.height??0)).toBeLessThanOrEqual((headBox?.y??0)+(headBox?.height??0)+1);
    expect((scoreBox?.x??0)+(scoreBox?.width??0)).toBeLessThanOrEqual((pauseBox?.x??Infinity)+1);
    expect(pauseBox?.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByTestId('top-discard')).toBeVisible();
    await expect(page.getByTestId('player-hand').locator('button')).toHaveCount(7);
    const [tableBox,handBox,railBox,primaryBox]=await Promise.all([
      page.getByTestId('crazy-eights-table').boundingBox(),page.getByTestId('player-hand').boundingBox(),
      page.getByTestId('crazy-eights-action-rail').boundingBox(),page.getByTestId('play-selected').boundingBox()
    ]);
    expect((handBox?.y??0)+(handBox?.height??0)).toBeLessThanOrEqual((railBox?.y??Infinity)+2);
    expect((tableBox?.y??0)+(tableBox?.height??0)).toBeLessThanOrEqual((railBox?.y??Infinity)+2);
    expect(primaryBox?.height).toBeGreaterThanOrEqual(44);
    expect((primaryBox?.y??Infinity)+(primaryBox?.height??0)).toBeLessThanOrEqual(height+1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  });

  test(`Blackjack score, both hands and actions remain readable at ${width}x${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.goto('/?qaSeed=62&fastAI=1');
    await page.getByTestId('play-now').click();
    await page.getByTestId('select-blackjack').click();
    await expect(page.getByTestId('blackjack-screen')).toBeVisible();
    const felt=page.getByTestId('blackjack-table');
    const [feltBox,dealerBox,playerBox,railBox,hitBox,standBox]=await Promise.all([
      felt.boundingBox(),page.getByTestId('blackjack-dealer-hand').boundingBox(),
      page.getByTestId('blackjack-player-hand').boundingBox(),
      page.getByTestId('blackjack-action-rail').boundingBox(),
      page.getByTestId('blackjack-hit').boundingBox(),page.getByTestId('blackjack-stand').boundingBox()
    ]);
    expect((dealerBox?.y??0)+(dealerBox?.height??0)).toBeLessThanOrEqual(playerBox?.y??Infinity);
    expect((feltBox?.y??0)+(feltBox?.height??0)).toBeLessThanOrEqual((railBox?.y??Infinity)+2);
    expect(hitBox?.height).toBeGreaterThanOrEqual(44);
    expect(standBox?.height).toBeGreaterThanOrEqual(44);
    expect((hitBox?.y??Infinity)+(hitBox?.height??0)).toBeLessThanOrEqual(height+1);
    expect((standBox?.y??Infinity)+(standBox?.height??0)).toBeLessThanOrEqual(height+1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
    await expect(page.getByTestId('blackjack-player-hand').locator('img')).toHaveCount(2);
  });
}

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
  await page.goto('/');
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

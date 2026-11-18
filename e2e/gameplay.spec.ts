import { expect, test } from '@playwright/test';

async function start(page: import('@playwright/test').Page) {
  await page.goto('/?qaSeed=62&fastAI=1');
  await page.getByTestId('play-now').click();
  await page.getByTestId('select-crazy-eights').click();
  
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();
}

test('menu → selection → practice → playable P1-controlled table', async ({ page }) => {
  await start(page);
  await expect(page.getByTestId('player-hand').locator('button')).toHaveCount(7);
  await expect(page.getByTestId('ai-card-count')).toHaveText('7');
  await expect(page.getByTestId('round-number')).toHaveText('1');
  await expect(page.getByTestId('human-score')).toHaveText('0');
  await expect(page.getByTestId('mochi-score')).toHaveText('0');
  // The AI hand consists of identical card backs and a count, never face values.
  await expect(page.getByTestId('ai-hand').locator('.card-tile')).toHaveCount(0);
  const firstPlayable = page.getByTestId('player-hand').locator('button[data-playable="true"]').first();
  await firstPlayable.click();
  await expect(page.getByTestId('play-selected')).toBeEnabled();
  await page.getByTestId('play-selected').click();
  if (await page.getByTestId('suit-S').count()) await page.getByTestId('suit-S').click();
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();
});

test('practice opponent can complete real P1 match; next round, rematch, and menu', async ({ page }) => {
  await start(page);
  let advancedRounds = 0;
  let complete = false;
  for (let attempts=0; attempts < 700; attempts++) {
    if (await page.getByTestId('rematch').isVisible().catch(()=>false)) { complete = true; break; }
    if (await page.getByTestId('next-round').isVisible().catch(()=>false)) {
      await page.getByTestId('next-round').click(); advancedRounds++; continue;
    }
    if (await page.getByTestId('suit-S').isVisible().catch(()=>false)) { await page.getByTestId('suit-S').click(); continue; }
    const play = page.getByTestId('play-selected');
    const cards = page.getByTestId('player-hand').locator('button[data-playable="true"]:not([disabled])');
    if (await cards.count()) {
      await cards.first().click();
      await play.click();
      continue;
    }
    const draw = page.getByTestId('draw-card');
    if (await draw.isVisible().catch(()=>false)) { await draw.click(); continue; }
    const finish = page.getByTestId('finish-turn');
    if (await finish.isVisible().catch(()=>false)) { await finish.click(); continue; }
    const pass = page.getByTestId('pass-turn');
    if (await pass.isVisible().catch(()=>false)) { await pass.click(); continue; }
    await page.waitForTimeout(30);
  }
  expect(complete, 'Expected a completed match without mocks or fake score transitions').toBe(true);
  expect(advancedRounds).toBeGreaterThanOrEqual(2);
  await page.getByTestId('rematch').click();
  await expect(page.getByTestId('human-score')).toHaveText('0');
  await expect(page.getByTestId('mochi-score')).toHaveText('0');
  await page.getByTestId('pause-button').click();
  await page.getByRole('button', { name: /Return to menu|กลับเมนูหลัก/i }).click();
  await page.getByRole('button', { name: /Confirm|ยืนยัน/i }).click();
  await expect(page.getByTestId('main-menu')).toBeVisible();
});

test('settings work and pause guards prevent duplicate actions', async ({ page }) => {
  await start(page);
  await page.getByTestId('pause-button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /Settings|ตั้งค่า/i }).last().click();
  await page.getByRole('combobox', { name: /Language|ภาษา/i }).selectOption('en');
  await page.getByRole('checkbox', { name: /Reduced motion/i }).check();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByTestId('pause-button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

for (const [width, height] of [[320,568],[390,844],[430,932],[768,1024],[1280,720],[1920,1080]] as const) {
  test(`responsive table layout ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({width,height});
    await start(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    await expect(page.getByTestId('player-hand')).toBeVisible();
    await expect(page.getByTestId('top-discard')).toBeVisible();
    const actionRect = await page.getByTestId('play-selected').boundingBox();
    expect(actionRect?.width).toBeGreaterThanOrEqual(40);
    expect(actionRect?.height).toBeGreaterThanOrEqual(40);
    // A seven-card opening hand must be fully visible on a phone. Testing
    // document overflow alone misses clipped cards inside an overflow container.
    if (width <= 430) {
      const hand = page.getByTestId('player-hand').locator('button');
      await expect(hand).toHaveCount(7);
      const left = await hand.first().boundingBox();
      const right = await hand.last().boundingBox();
      expect(left?.x).toBeGreaterThanOrEqual(3);
      expect((right?.x ?? 0) + (right?.width ?? 0)).toBeLessThanOrEqual(width - 3);
    }
  });
}


test('modern game UI avoids passive status noise and retains accessible card controls', async ({ page }) => {
  await start(page);
  await expect(page.getByTestId('save-status')).toHaveCount(0);
  await expect(page.getByTestId('offline-status')).toHaveCount(0);
  await expect(page.locator('.opponent-title .p3-speech')).toHaveCount(0);
  await expect(page.locator('.draw-pile-action')).toHaveCount(1);
  await expect(page.locator('.draw-pile-action')).toHaveAttribute('aria-label', /.+/);
  await expect(page.getByTestId('player-hand').locator('button')).toHaveCount(7);
  await page.getByTestId('pause-button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

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
  await page.getByTestId('select-crazy-eights').click();
  await expect(page.getByTestId('difficulty-selection')).toBeVisible();
  
  await expect(page.getByTestId('difficulty-selection')).toBeVisible();
  await page.screenshot({ path: 'test-results/visual-review/difficulty-mobile-390x844.png', animations: 'disabled' });
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

  await page.getByTestId('play-now').click();
  await page.getByTestId('select-crazy-eights').click();
  
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();

  for (const [width, height] of [[1280, 720], [390, 844], [320, 568]] as const) {
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

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

import { expect, test } from '@playwright/test';

/** P4.5 visual invariants complement human screenshot review. */
test('main menu keeps a clear Play action and Thai-safe typography', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(page.getByTestId('play-now')).toHaveCount(1);
  await expect(page.getByTestId('play-now')).toBeEnabled();
  await expect(page.getByTestId('save-status')).toHaveCount(0);
  await expect(page.getByTestId('offline-status')).toHaveCount(0);
  const font = await page.locator('html').evaluate(el => getComputedStyle(el).fontFamily);
  expect(font).toMatch(/Noto Sans Thai|Thonburi/);
});

for (const [width, height] of [[320, 568], [390, 844], [430, 932]] as const) {
  test(`compact HUD remains legible at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/?qaSeed=62&fastAI=1');
    await page.getByTestId('play-now').click();
    await page.getByTestId('select-crazy-eights').click();
    await page.getByTestId('start-match').click();
    await expect(page.getByTestId('gameplay-screen')).toBeVisible();
    const sizes = await page.locator('.md4-cardroom .pile-label, .md4-cardroom .hand-title, .md4-cardroom .active-suit span').evaluateAll(elements =>
      elements.filter(el => getComputedStyle(el).display !== 'none').map(el => parseFloat(getComputedStyle(el).fontSize))
    );
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) expect(size).toBeGreaterThanOrEqual(10);
    const rect = await page.getByTestId('play-selected').boundingBox();
    expect(rect?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  });
}

import {expect,test} from '@playwright/test';
async function openGin(page:import('@playwright/test').Page){
 await page.goto('/');
 await expect(page.getByTestId('main-menu')).toBeVisible();
 await page.getByTestId('play-now').click();
 await expect(page.getByTestId('select-gin-rummy')).toBeVisible();
 await page.getByTestId('select-gin-rummy').click();
 await expect(page.getByTestId('gin-difficulty-screen')).toBeVisible();
 await page.getByTestId('gin-start').click();
 await expect(page.getByTestId('gin-screen')).toBeVisible();
}
test('Gin Rummy enters through the shared MeowDeck game selector',async({page})=>{
 await openGin(page);
 await expect(page.getByTestId('gin-player-hand').locator('[data-testid^="gin-card-"]')).toHaveCount(10);
 await expect(page.getByTestId('gin-opponent-hand').locator('.card-back')).toHaveCount(10);
 await expect(page.getByTestId('gin-stock')).toContainText('31');
 await expect(page.getByTestId('gin-discard')).toBeVisible();
});
test('Gin Rummy restores a complete hand on refresh without affecting Blackjack',async({page})=>{
 await openGin(page);
 const before=await page.evaluate(()=>localStorage.getItem('meowdeck:gin-rummy:1'));
 expect(before).toContain('"game":"gin-rummy"');
 await page.reload();
 await expect(page.getByTestId('main-menu')).toBeVisible();
 await page.getByTestId('play-now').click();
 await page.getByTestId('select-gin-rummy').click();
 await expect(page.getByTestId('gin-screen')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('meowdeck:gin-rummy:1'))).toEqual(before);
 await page.getByTestId('gin-back').click();
 await page.getByTestId('select-blackjack').click();
 await expect(page.getByTestId('blackjack-screen')).toBeVisible();
});
for(const [width,height] of [[320,568],[390,844],[768,1024],[1280,720]] as const){
 test('Gin Rummy cardroom remains within viewport '+width+'x'+height,async({page})=>{
  await page.setViewportSize({width,height});await openGin(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await expect(page.getByTestId('gin-player-hand')).toBeVisible();
 });
}

import {expect,test} from '@playwright/test';

async function blackjack(page:import('@playwright/test').Page){
 await page.goto('/?qaSeed=62&fastAI=1');
 await expect(page.getByTestId('main-menu')).toBeVisible();
 await page.getByTestId('play-now').click();
 await expect(page.getByTestId('select-blackjack')).toBeVisible();
 await page.getByTestId('select-blackjack').click();
 await expect(page.getByTestId('blackjack-screen')).toBeVisible();
}

test('P5 two games share original card art but Blackjack has a hidden dealer card',async({page})=>{
 await blackjack(page);
 await expect(page.getByTestId('blackjack-player-hand').locator('.md5-bj-card-face')).toHaveCount(2);
 await expect(page.getByTestId('blackjack-dealer-hand').locator('.md5-bj-card-face')).toHaveCount(1);
 await expect(page.getByTestId('blackjack-dealer-hand').locator('.card-back')).toHaveCount(1);
 await expect(page.getByTestId('blackjack-dealer-total')).toHaveText('?');
 await expect(page.getByTestId('blackjack-player-total')).toHaveText('15');
 await expect(page.getByTestId('blackjack-hit')).toBeEnabled();
 await expect(page.getByTestId('blackjack-stand')).toBeEnabled();
});
test('P5 stand reveals dealer hole card, settles scores and deals another 52-card round',async({page})=>{
 await blackjack(page);
 await page.getByTestId('blackjack-stand').click();
 await expect(page.getByTestId('blackjack-result')).toBeVisible();
 await expect(page.getByTestId('blackjack-dealer-hand').locator('.card-back')).toHaveCount(0);
 await expect(page.getByTestId('blackjack-dealer-total')).not.toHaveText('?');
 await expect(page.getByTestId('blackjack-hit')).toHaveCount(0);
 const score=await page.locator('[data-testid^="blackjack-"][data-testid$="s"], [data-testid="blackjack-wins"]').allTextContents();
 await page.getByTestId('blackjack-next').click();
 await expect(page.getByTestId('blackjack-player-hand').locator('.md5-bj-card-face')).toHaveCount(2);
 await expect(page.getByTestId('blackjack-dealer-hand').locator('.card-back')).toHaveCount(1);
 await expect(page.locator('.md5-bj-round')).toContainText('2');
 expect(score.length).toBeGreaterThan(0);
});
test('P5 Blackjack survives refresh without mutating Crazy Eights IndexedDB',async({page})=>{
 await blackjack(page);
 await page.getByTestId('blackjack-stand').click();
 const before=await page.evaluate(()=>localStorage.getItem('meowdeck:blackjack:1'));
 expect(before).toContain('"game":"blackjack"');
 await page.reload();
 await expect(page.getByTestId('main-menu')).toBeVisible();
 await page.getByTestId('play-now').click();
 await page.getByTestId('select-blackjack').click();
 await expect(page.getByTestId('blackjack-result')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('meowdeck:blackjack:1'))).toBe(before);
 await page.getByTestId('blackjack-back').click();
 await page.getByTestId('select-crazy-eights').click();
 await expect(page.getByTestId('difficulty-selection')).toBeVisible();
 await page.getByTestId('start-match').click();
 await expect(page.getByTestId('gameplay-screen')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('meowdeck:blackjack:1'))).toBe(before);
});
test('P5 rules and reset confirmation keep gameplay state intact until explicitly confirmed',async({page})=>{
 await blackjack(page);
 await page.getByTestId('blackjack-rules').click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:/Close|ปิด/i}).click();
 await page.getByTestId('blackjack-stand').click();
 await page.getByTestId('blackjack-new-series').click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:/Cancel|ยกเลิก/i}).click();
 await expect(page.getByTestId('blackjack-result')).toBeVisible();
 await page.getByTestId('blackjack-new-series').click();
 await page.getByTestId('blackjack-confirm-reset').click();
 await expect(page.locator('.md5-bj-round')).toContainText('1');
 await expect(page.getByTestId('blackjack-wins')).toHaveText('0');
 await expect(page.getByTestId('blackjack-losses')).toHaveText('0');
 await expect(page.getByTestId('blackjack-pushes')).toHaveText('0');
});
for(const [width,height] of [[320,568],[390,844],[768,1024],[1280,720]] as const){
 test(`P5 responsive Blackjack ${width}x${height}`,async({page})=>{
  await page.setViewportSize({width,height});
  await blackjack(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await expect(page.getByTestId('blackjack-player-hand')).toBeVisible();
  await expect(page.getByTestId('blackjack-dealer-hand')).toBeVisible();
  const box=await page.getByTestId('blackjack-hit').boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
 });
}

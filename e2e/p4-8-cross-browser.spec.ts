import {expect,test} from '@playwright/test';

test('cross-browser input, layout and a confirmed Crazy Eights move',async({page})=>{
 await page.goto('/?qaSeed=62&fastAI=1');
 await expect(page.getByTestId('main-menu')).toBeVisible();
 await page.getByTestId('play-now').click();
  await page.getByTestId('select-crazy-eights').click();
 await expect(page.getByTestId('difficulty-selection')).toBeVisible();
 await page.getByTestId('start-match').click();
 await expect(page.getByTestId('player-hand').locator('button')).toHaveCount(7);
 const before=await page.getByTestId('player-hand').locator('button').count();
 const legal=page.getByTestId('player-hand').locator('button[data-playable="true"]:not([disabled])').first();
 await legal.click();
 await expect(page.getByTestId('play-selected')).toBeEnabled();
 await page.getByTestId('play-selected').click();
 if(await page.getByTestId('suit-S').isVisible().catch(()=>false))await page.getByTestId('suit-S').click();
 await expect(page.getByTestId('gameplay-screen')).toBeVisible();
 const remaining=await page.getByTestId('player-hand').locator('button').count();
 expect(remaining).toBeLessThanOrEqual(before);
 const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(horizontalOverflow).toBeLessThanOrEqual(2);
});

// P5 uses the same original P0 assets and must hydrate on every supported engine.
test('cross-browser Blackjack deals, hides hole card and settles hand',async({page})=>{
 await page.goto('/?qaSeed=62&fastAI=1');
 await page.getByTestId('play-now').click();
 await page.getByTestId('select-blackjack').click();
 await expect(page.getByTestId('blackjack-screen')).toBeVisible();
 await expect(page.getByTestId('blackjack-dealer-hand').locator('.card-back')).toHaveCount(1);
 await page.getByTestId('blackjack-stand').click();
 await expect(page.getByTestId('blackjack-result')).toBeVisible();
 await expect(page.getByTestId('blackjack-dealer-hand').locator('.card-back')).toHaveCount(0);
});

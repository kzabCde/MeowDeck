import {expect,test} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

async function crazyEights(page:import('@playwright/test').Page){
  await page.goto('/?qaSeed=62&fastAI=1');
  await page.getByTestId('play-now').click();
  await page.getByTestId('select-crazy-eights').click();
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();
}

test('pet reaction freezes on Pause and continues without changing the hand',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await crazyEights(page);
  const mochi=page.getByTestId('mochi');
  const sprite=mochi.locator('.mochi-frame');
  await expect(sprite).toHaveAttribute('data-clip','idle');
  const handCount=await page.getByTestId('player-hand').locator('button').count();
  await mochi.click();
  await expect(sprite).toHaveAttribute('data-clip','pet_reaction');
  await expect(mochi).toBeDisabled();
  await expect.poll(async()=>Number(await sprite.getAttribute('data-frame'))).toBeGreaterThanOrEqual(1);
  await mkdir('test-results/visual-review',{recursive:true});
  await page.screenshot({path:'test-results/visual-review/mochi-pet-crazy-eights-390x844.png',animations:'disabled'});
  await page.getByTestId('pause-button').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const atPause=await sprite.getAttribute('data-frame');
  await page.waitForTimeout(350);
  await expect(sprite).toHaveAttribute('data-frame',atPause??'');
  await expect(sprite).toHaveAttribute('data-clip','pet_reaction');
  await page.keyboard.press('Escape');
  await expect(sprite).toHaveAttribute('data-clip','idle',{timeout:3500});
  await expect(mochi).toBeEnabled();
  await expect(page.getByTestId('player-hand').locator('button')).toHaveCount(handCount);
});

test('Blackjack pet is a purely cosmetic reaction and stops on finished rounds',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?qaSeed=62&fastAI=1');
  await page.getByTestId('play-now').click();
  await page.getByTestId('select-blackjack').click();
  await expect(page.getByTestId('blackjack-screen')).toBeVisible();
  const mochi=page.getByTestId('mochi'),sprite=mochi.locator('.mochi-frame');
  await expect(sprite).toHaveAttribute('data-clip','idle');
  const before=await page.evaluate(()=>localStorage.getItem('meowdeck:blackjack:1'));
  const total=await page.getByTestId('blackjack-player-total').textContent();
  const playerCount=await page.getByTestId('blackjack-player-hand').locator('img').count();
  await mochi.click();
  await expect(sprite).toHaveAttribute('data-clip','pet_reaction');
  await expect(mochi).toBeDisabled();
  await mkdir('test-results/visual-review',{recursive:true});
  await page.screenshot({path:'test-results/visual-review/mochi-pet-blackjack-390x844.png',animations:'disabled'});
  await expect(sprite).toHaveAttribute('data-clip','idle',{timeout:3000});
  expect(await page.evaluate(()=>localStorage.getItem('meowdeck:blackjack:1'))).toBe(before);
  await expect(page.getByTestId('blackjack-player-total')).toHaveText(total??'');
  await expect(page.getByTestId('blackjack-player-hand').locator('img')).toHaveCount(playerCount);
  await page.getByTestId('blackjack-stand').click();
  await expect(page.getByTestId('blackjack-result')).toBeVisible();
  await expect(mochi).toBeDisabled();
  await expect(sprite).toHaveAttribute('data-clip',/victory|defeat|idle/);
});

test('reduced motion keeps Mochi static and the pet action optional',async({page})=>{
  await page.goto('/?qaSeed=62&fastAI=1');
  await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).click();
  await page.getByTestId('motion-setting').selectOption('on');
  await page.keyboard.press('Escape');
  await page.getByTestId('play-now').click();
  await page.getByTestId('select-blackjack').click();
  const mochi=page.getByTestId('mochi'),sprite=mochi.locator('.mochi-frame');
  await expect(sprite).toHaveAttribute('data-clip','idle');
  const frame=await sprite.getAttribute('data-frame');
  await page.waitForTimeout(320);
  await expect(sprite).toHaveAttribute('data-frame',frame??'0');
  await mochi.click();
  await expect(mochi).toBeEnabled({timeout:2500});
  await expect(page.getByTestId('blackjack-hit')).toBeEnabled();
});

test('ambient 18-second sleep wakes naturally without a new gameplay event',async({page})=>{
  await page.clock.install();
  await page.goto('/');
  const sprite=page.getByTestId('main-menu').locator('.mochi-frame');
  await expect(sprite).toHaveAttribute('data-clip','idle');
  await page.clock.runFor(18_400);
  await expect(sprite).toHaveAttribute('data-clip','sleep');
  await page.clock.runFor(4_900);
  await expect(sprite).toHaveAttribute('data-clip','idle');
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(page.locator('[role="status"]')).toHaveCount(0);
});

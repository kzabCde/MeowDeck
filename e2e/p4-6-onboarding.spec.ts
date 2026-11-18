import { expect, test } from '@playwright/test';

async function begin(page:import('@playwright/test').Page){
  await page.goto('/?qaSeed=62&fastAI=1');
  await page.getByTestId('play-now').click();
  await expect(page.getByTestId('difficulty-selection')).toBeVisible();
  await expect(page.getByTestId('game-selection')).toHaveCount(0);
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();
}

test('main Play skips the single-game catalog and Back returns to menu',async({page})=>{
  await page.goto('/');
  await page.getByTestId('play-now').click();
  await expect(page.getByTestId('difficulty-selection')).toBeVisible();
  await page.getByRole('button',{name:/Back|ย้อนกลับ/i}).click();
  await expect(page.getByTestId('main-menu')).toBeVisible();
});

test('first-time guidance follows selection and a committed legal action',async({page})=>{
  await begin(page);
  await expect(page.getByTestId('tutorial-hint')).toBeVisible();
  const card=page.getByTestId('player-hand').locator('button[data-playable="true"]').first();
  await card.click();
  await expect(page.getByTestId('play-selected')).toBeEnabled();
  await expect(page.getByTestId('tutorial-hint')).toContainText(/Play card|กดลงไพ่/i);
  await card.click();
  await expect(page.getByTestId('play-selected')).toBeDisabled();
  await card.click();
  await page.getByTestId('play-selected').click();
  if(await page.getByTestId('suit-S').isVisible().catch(()=>false))await page.getByTestId('suit-S').click();
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('meowdeck:tutorial:1')||'{}').played)).toBe(true);
});

test('guidance can be skipped, remains skipped across refresh and can be replayed',async({page})=>{
  await begin(page);
  const handSize=await page.getByTestId('player-hand').locator('button').count();
  await page.getByTestId('tutorial-skip').click();
  await expect(page.getByTestId('tutorial-hint')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('tutorial-hint')).toHaveCount(0);
  await page.getByTestId('pause-button').click();
  await page.getByTestId('tutorial-replay').click();
  await expect(page.getByTestId('tutorial-hint')).toBeVisible();
  await expect(page.getByTestId('player-hand').locator('button')).toHaveCount(handSize);
});

for(const [width,height] of [[320,568],[390,844]] as const){
  test(`compact gameplay controls stay reachable with tips at ${width}×${height}`,async({page})=>{
    await page.setViewportSize({width,height});
    await begin(page);
    await expect(page.getByTestId('tutorial-hint')).toBeVisible();
    await expect(page.getByTestId('play-selected')).toBeVisible();
    const button=await page.getByTestId('play-selected').boundingBox();
    expect(button?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  });
}

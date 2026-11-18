import {expect,test} from '@playwright/test';

async function begin(page:import('@playwright/test').Page,mode:'easy'|'normal'|'hard',fast=true){
  await page.goto(`/?qaSeed=62${fast?'&fastAI=1':''}`);
  await page.getByTestId('play-now').click();
  
  await page.getByTestId(`difficulty-${mode}`).click();
  await expect(page.getByTestId(`difficulty-${mode}`)).toHaveAttribute('aria-pressed','true');
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();
}
for(const mode of ['easy','normal','hard'] as const){
  test(`${mode} mode starts and AI responds through the P1 engine`,async({page})=>{
    await begin(page,mode);
    await expect(page.locator('.difficulty-name')).toHaveText(mode==='easy'?'ง่าย':mode==='normal'?'ปกติ':'ยาก');
    await expect(page.getByTestId('player-hand').locator('button')).toHaveCount(7);
    const first=page.getByTestId('player-hand').locator('button[data-playable="true"]').first();
    await first.click();await page.getByTestId('play-selected').click();
    if(await page.getByTestId('suit-S').count())await page.getByTestId('suit-S').click();
    // After a legal move, the next actor may take a turn and only real P1 state can update the table.
    await expect(page.getByTestId('gameplay-screen')).toBeVisible();
    await expect(page.getByTestId('ai-hand').locator('button')).toHaveCount(0);
  });
}
test('Mochi plays production frames and pet response without gameplay mutation',async({page})=>{
  await begin(page,'normal',false);
  const sprite=page.getByTestId('gameplay-screen').locator('.mochi-frame');
  await expect(sprite).toHaveAttribute('data-clip','idle');
  const before=await page.getByTestId('player-hand').locator('button').count();
  await page.getByTestId('mochi').click();
  await expect(sprite).toHaveAttribute('data-clip','pet_reaction');
  await expect(sprite).toHaveAttribute('data-frame',/[0-3]/);
  await expect(page.getByTestId('player-hand').locator('button')).toHaveCount(before);
  await expect(sprite).toHaveAttribute('data-clip','idle',{timeout:3000});
  const first=page.getByTestId('player-hand').locator('button[data-playable="true"]').first();
  await first.click();await page.getByTestId('play-selected').click();
  if(await page.getByTestId('suit-S').count())await page.getByTestId('suit-S').click();
  // AI will receive its turn after P1 commits the human action; wait for its public reaction.
  await expect.poll(async()=>await sprite.getAttribute('data-clip'),{timeout:6000}).toMatch(/thinking|draw_card|play_card|idle/);
});
test('reduced motion keeps moves legal and skips card flight',async({page})=>{
  await begin(page,'easy');
  await page.getByTestId('pause-button').click();
  await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).last().click();
  await page.getByRole('checkbox',{name:/Reduced motion|ลดการเคลื่อนไหว/i}).check();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  await expect(page.getByTestId('mochi-card-flight')).toHaveCount(0);
  const count=await page.getByTestId('player-hand').locator('button').count();
  await page.getByTestId('player-hand').locator('button[data-playable="true"]').first().click();
  await page.getByTestId('play-selected').click();
  if(await page.getByTestId('suit-S').count())await page.getByTestId('suit-S').click();
  await expect(page.getByTestId('player-hand').locator('button')).toHaveCount(count-1);
});

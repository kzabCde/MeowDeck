import {expect,test} from '@playwright/test';
test('P4.7 visible table uses crisp pixel event effects that cannot intercept cards',async({page})=>{
 await page.goto('/?qaSeed=62&fastAI=1');
 await page.getByTestId('play-now').click();
  await page.getByTestId('select-crazy-eights').click();
 await page.getByTestId('start-match').click();
 await expect(page.getByTestId('gameplay-screen')).toBeVisible();
 const properties=await page.evaluate(()=>{
  const table=document.querySelector('.game-table');
  if(!table)return null;
  const effect=document.createElement('span');
  effect.className='md-card-impact md-wild-impact md-wild-hearts';
  table.querySelector('.discard-pile')?.append(effect);
  const css=getComputedStyle(effect);
  const result={pointerEvents:css.pointerEvents,animationName:css.animationName};
  effect.remove();
  return result;
 });
 expect(properties?.pointerEvents).toBe('none');
 expect(properties?.animationName).toContain('md-discard-impact');
 const top=page.getByTestId('top-discard');
 await expect(top).toBeVisible();
 await page.getByTestId('pause-button').click();
 await expect(page.getByRole('dialog')).toBeVisible();
});
test('P4.7 reduced motion keeps gameplay usable with no decorative impact animation',async({page})=>{
 await page.goto('/?qaSeed=62&fastAI=1');
 await page.getByTestId('play-now').click();
  await page.getByTestId('select-crazy-eights').click();
 await page.getByTestId('start-match').click();
 await page.getByTestId('pause-button').click();
 await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).last().click();
 await page.getByRole('checkbox',{name:/Reduced motion|ลดการเคลื่อนไหว/i}).check();
 await page.keyboard.press('Escape');
 await expect(page.locator('html')).toHaveClass(/reduce-motion/);
 const effect=await page.evaluate(()=>{
  const node=document.createElement('span');
  node.className='md-card-impact';
  document.querySelector('.discard-pile')?.append(node);
  const display=getComputedStyle(node).display;
  node.remove();
  return display;
 });
 expect(effect).toBe('none');
 await expect(page.getByTestId('player-hand')).toBeVisible();
});

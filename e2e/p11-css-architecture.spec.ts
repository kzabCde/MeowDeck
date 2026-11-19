import {expect,test} from '@playwright/test';

test('semantic screen roots preserve the original pixel-cardroom visual tokens',async({page})=>{
 await page.goto('/');
 const title=page.getByTestId('main-menu');
 await expect(title).toHaveClass(/title-screen/);
 await expect(title).toHaveClass(/md4-title-screen/);
 const design=await page.evaluate(()=>{
   const root=getComputedStyle(document.documentElement);
   const play=document.querySelector<HTMLElement>('[data-testid="play-now"]')!;
   return {gold:root.getPropertyValue('--md-gold').trim(),
     background:getComputedStyle(document.querySelector<HTMLElement>('.title-screen')!).backgroundColor,
     height:play.getBoundingClientRect().height,button:getComputedStyle(play).fontFamily};
 });
 expect(design.gold).toBe('#e8c17c');
 expect(design.height).toBeGreaterThanOrEqual(44);
 expect(design.button).toMatch(/Noto Sans Thai|Thonburi/);
 await page.getByTestId('play-now').click();
 const selection=page.getByTestId('game-selection');
 await expect(selection).toHaveClass(/selection-screen/);
 await expect(selection).toHaveClass(/game-choices/);
 await expect(page.getByTestId('select-crazy-eights')).toBeVisible();
 await expect(page.getByTestId('select-blackjack')).toBeVisible();
 await page.getByTestId('select-crazy-eights').click();
 await expect(page.getByTestId('difficulty-selection')).toHaveClass(/difficulty-screen/);
 await expect(page.getByTestId('difficulty-hard')).toBeVisible();
});

for(const [width,height] of [[320,568],[390,844],[768,1024],[1280,800]] as const){
 test(`Crazy Eights semantic table and cards retain hit areas and scroll behavior at ${width}x${height}`,async({page})=>{
  await page.setViewportSize({width,height});
  await page.goto('/?qaSeed=62&fastAI=1');
  await page.getByTestId('play-now').click();
  await page.getByTestId('select-crazy-eights').click();
  await page.getByTestId('start-match').click();
  const table=page.getByTestId('gameplay-screen');
  await expect(table).toHaveClass(/crazy-eights-room/);
  await expect(table).toHaveClass(/md4-cardroom/);
  await expect(page.getByTestId('crazy-eights-table')).toBeVisible();
  const hand=page.getByTestId('player-hand');
  const cards=hand.locator('.card-tile');
  await expect(cards).toHaveCount(7);
  const first=await cards.first().boundingBox(),second=await cards.nth(1).boundingBox();
  expect(first?.width).toBeGreaterThanOrEqual(44);
  expect(second?.x??0).toBeGreaterThanOrEqual((first?.x??0)+(first?.width??0)-1);
  const scroll=await hand.evaluate(el=>el.scrollWidth>el.clientWidth+2);
  await expect(hand).toHaveAttribute('data-overflow',String(scroll));
  if(scroll)await expect(page.getByTestId('hand-scroll-cue')).toBeVisible();
  await expect(page.getByTestId('play-selected')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
 });
}

test('Blackjack and dialog still use shared controls, focus and reduced motion',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/?qaSeed=62&fastAI=1');
 await page.getByTestId('play-now').click();
 await page.getByTestId('select-blackjack').click();
 const blackjack=page.getByTestId('blackjack-screen');
 await expect(blackjack).toHaveClass(/blackjack-room/);
 await expect(blackjack).toHaveClass(/md5-blackjack/);
 const hit=page.getByTestId('blackjack-hit');
 await expect(hit).toBeVisible();
 const size=await hit.boundingBox();
 expect(size?.height).toBeGreaterThanOrEqual(44);
 const color=await page.locator('.md5-bj-felt').evaluate(el=>getComputedStyle(el).backgroundImage);
 expect(color).toContain('radial-gradient');
 await page.getByTestId('blackjack-rules').click();
 const dialog=page.getByRole('dialog');
 await expect(dialog).toBeVisible();
 expect(await dialog.evaluate(el=>getComputedStyle(el).borderTopWidth)).toBe('3px');
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
 await page.getByTestId('blackjack-back').click();
 await page.getByTestId('select-crazy-eights').click();
 await page.getByTestId('start-match').click();
 await page.getByTestId('pause-button').click();
 await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).last().click();
 await page.getByRole('checkbox',{name:/Reduced motion|ลดการเคลื่อนไหว/i}).check();
 await expect(page.locator('html')).toHaveClass(/reduce-motion/);
 await expect(page.getByRole('dialog')).toBeVisible();
});

test('short landscape keeps semantic screen layouts and actionable dialog',async({page})=>{
 await page.setViewportSize({width:667,height:375});
 await page.goto('/');
 await page.getByTestId('play-now').click();
 const selected=page.getByTestId('game-selection');
 await expect(selected).toHaveClass(/selection-screen/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
 await page.getByTestId('select-blackjack').click();
 await expect(page.getByTestId('blackjack-screen')).toBeVisible();
 await page.getByTestId('blackjack-rules').click();
 const box=await page.getByRole('dialog').boundingBox();
 expect(box?.y).toBeGreaterThanOrEqual(-1);
 expect((box?.y??Infinity)+(box?.height??0)).toBeLessThanOrEqual(377);
});

import {expect,test} from '@playwright/test';

async function enter(page:import('@playwright/test').Page) {
 await page.goto('/?qaSeed=62&fastAI=1');
 await page.getByTestId('play-now').click();
 await page.getByTestId('start-match').click();
 await expect(page.getByTestId('gameplay-screen')).toBeVisible();
}

test('keyboard-only card choice, focus and suit status remain accessible',async({page})=>{
 await enter(page);
 const playable=page.getByTestId('player-hand').locator('button[data-playable="true"]:not([disabled])');
 await playable.first().focus();
 await expect(playable.first()).toBeFocused();
 await page.keyboard.press('ArrowRight');
 const active=await page.evaluate(()=>({
  className:(document.activeElement as HTMLElement)?.className,
  disabled:(document.activeElement as HTMLButtonElement)?.disabled
 }));
 expect(active.className).toContain('card-tile');
 expect(active.disabled).toBe(false);
 await page.keyboard.press('Space');
 await expect(page.getByTestId('play-selected')).toBeEnabled();
 await expect(page.getByTestId('active-suit')).toHaveAttribute('role','img');
 await expect(page.getByTestId('active-suit')).toHaveAttribute('aria-label',/.+/);
 await expect(page.getByTestId('pause-button')).toHaveAttribute('aria-label',/.+/);
 const size=await page.getByTestId('pause-button').boundingBox();
 expect(size?.width).toBeGreaterThanOrEqual(44);
 expect(size?.height).toBeGreaterThanOrEqual(44);
});

test('narrow landscape and 200 percent zoom-like CSS viewport keep controls reachable',async({page})=>{
 await page.setViewportSize({width:640,height:360});
 await enter(page);
 const game=page.getByTestId('gameplay-screen');
 const geometry=await game.evaluate(el=>({
  overflow:getComputedStyle(el).overflow,
  height:el.scrollHeight,
  viewport:document.documentElement.clientHeight,
  horizontalOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
 }));
 expect(geometry.horizontalOverflow).toBeLessThanOrEqual(2);
 expect(geometry.height).toBeGreaterThanOrEqual(geometry.viewport);
 await page.getByTestId('play-selected').scrollIntoViewIfNeeded();
 await expect(page.getByTestId('play-selected')).toBeVisible();
 const rect=await page.getByTestId('play-selected').boundingBox();
 expect(rect?.height).toBeGreaterThanOrEqual(44);
});

test('mobile game errors are visible instead of hidden behind responsive CSS',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await enter(page);
 const visible=await page.locator('.action-footer').evaluate(el=>{
  const rail=el as HTMLElement;
  const status=rail.querySelector<HTMLElement>('.action-status');
  if(!status)return false;
  const original=rail.className;
  rail.classList.add('has-error');
  const shown=getComputedStyle(status).display!=='none';
  rail.className=original;
  return shown;
 });
 expect(visible).toBe(true);
});

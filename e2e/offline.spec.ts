import {expect,test} from '@playwright/test';

test('production PWA is installable, precaches and resumes an offline match after reopening',async({browser})=>{
  const context=await browser.newContext({serviceWorkers:'allow'});
  try{
    let page=await context.newPage();
    await page.goto('/');await expect(page.getByTestId('main-menu')).toBeVisible();
    const response=await page.request.get('/manifest.webmanifest');expect(response.status()).toBe(200);
    const manifest=await response.json();expect(manifest.display).toBe('standalone');
    for(const icon of manifest.icons){const iconResponse=await page.request.get(icon.src);expect(iconResponse.status()).toBe(200);}
    await expect(page.getByTestId('offline-status')).toContainText(/พร้อมเล่นแบบออฟไลน์|Ready for offline play/,{timeout:90_000});
    await page.getByTestId('play-now').click();await page.getByTestId('select-crazy-eights').click();
    await page.getByTestId('difficulty-easy').click();await page.getByTestId('start-match').click();
    await expect(page.getByTestId('save-status')).toContainText(/บันทึกแล้ว|Saved/);
    // The actual authoritative IndexedDB snapshot is the restore comparison point.
    const handCount=await page.getByTestId('player-hand').locator('button').count();
    await page.close();await context.setOffline(true);
    page=await context.newPage();await page.goto('/',{waitUntil:'domcontentloaded'});
    await expect(page.getByTestId('main-menu')).toBeVisible();
    await expect(page.getByTestId('continue')).toBeVisible();await page.getByTestId('continue').click();
    await expect(page.getByTestId('gameplay-screen')).toBeVisible();
    await expect(page.getByTestId('player-hand').locator('button')).toHaveCount(handCount);
    const first=page.getByTestId('player-hand').locator('button[data-playable="true"]').first();
    if(await first.count()){await first.click();await page.getByTestId('play-selected').click();}
    else await page.getByTestId('draw-card').click();
    if(await page.getByTestId('suit-S').isVisible().catch(()=>false))await page.getByTestId('suit-S').click();
    await expect(page.getByTestId('save-status')).toContainText(/บันทึกแล้ว|Saved/);
    await page.reload();await expect(page.getByTestId('continue')).toBeVisible();
  }finally{await context.close();}
});

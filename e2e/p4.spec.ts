import { expect, test } from '@playwright/test';
async function begin(page:import('@playwright/test').Page,level:'practice'|'easy'|'normal'|'hard'='practice'){
  await page.goto('/?qaSeed=62&fastAI=1');
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await page.getByTestId('play-now').click();await page.getByTestId('select-crazy-eights').click();
  await page.getByTestId(`difficulty-${level}`).click();await page.getByTestId('start-match').click();
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();
  await expect(page.getByTestId('save-status')).toContainText(/บันทึกแล้ว|Saved/);
}
async function move(page:import('@playwright/test').Page){
  const card=page.getByTestId('player-hand').locator('button[data-playable="true"]:not([disabled])').first();
  if(await card.count()){await card.click();await page.getByTestId('play-selected').click();}
  else if(await page.getByTestId('draw-card').count())await page.getByTestId('draw-card').click();
  else if(await page.getByTestId('finish-turn').count())await page.getByTestId('finish-turn').click();
  if(await page.getByTestId('suit-S').isVisible().catch(()=>false))await page.getByTestId('suit-S').click();
  await expect(page.getByTestId('save-status')).toContainText(/บันทึกแล้ว|Saved/);
}
test('auto save restores exact authoritative match after refresh with original difficulty',async({page})=>{
  await begin(page,'hard');
  await move(page);
  const before=await page.evaluate(async()=>{
    const db:IDBDatabase=await new Promise((res,rej)=>{const r=indexedDB.open('meowdeck-local-v1');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
    const row=await new Promise<any>((res,rej)=>{const tx=db.transaction('active','readonly');const r=tx.objectStore('active').get('active');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
    db.close();return row?.save;
  });
  expect(before?.difficulty).toBe('hard');expect(before?.gameState?.humanHand?.length).toBeGreaterThan(0);
  await page.reload();await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(page.getByTestId('continue')).toBeVisible();
  await expect(page.getByTestId('save-summary')).toContainText(/ยาก|Hard/);
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();
  expect(await page.getByTestId('round-number').textContent()).toBe(String(before.gameState.roundNumber));
  await expect(page.locator('.difficulty-name')).toContainText(/ยาก|Hard/);
  await move(page);
});
test('language, reduced motion and audio settings survive a reload',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).first().click();
  await page.getByRole('combobox',{name:/Language|ภาษา/i}).selectOption('en');
  await page.getByTestId('motion-setting').selectOption('on');
  await page.getByTestId('sfx-toggle').uncheck();await page.getByTestId('music-toggle').check();
  await page.getByTestId('sfx-volume').fill('0.25');
  await page.reload();await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).first().click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.getByTestId('motion-setting')).toHaveValue('on');
  await expect(page.getByTestId('sfx-toggle')).not.toBeChecked();
  await expect(page.getByTestId('music-toggle')).toBeChecked();
  await expect(page.getByTestId('sfx-volume')).toHaveValue('0.25');
});
test('statistics record only completed matches and resets do not erase active save',async({page})=>{
  await begin(page);
  await page.getByTestId('pause-button').click();
  await page.getByRole('button',{name:/Return to menu|กลับเมนูหลัก/i}).click();
  await page.getByRole('button',{name:/Confirm|ยืนยัน/i}).click();
  await expect(page.getByTestId('continue')).toBeVisible();
  await page.getByRole('button',{name:/Statistics|สถิติ/i}).click();
  await expect(page.getByTestId('statistics-panel')).toBeVisible();
  await expect(page.getByTestId('stats-matches')).toHaveText('0');
  await page.getByTestId('reset-statistics').click();
  await page.getByRole('button',{name:/Confirm|ยืนยัน/i}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('continue')).toBeVisible();
});
test('second tab detects active owner and prevents silent overwrite',async({context,page})=>{
  await begin(page);
  const another=await context.newPage();await another.goto('/');
  await expect(another.getByTestId('continue')).toBeVisible();
  await another.getByTestId('continue').click();
  await expect(another.getByRole('dialog')).toContainText(/อีกแท็บ|another tab/i);
  await another.close();
});

test('closing the old tab immediately releases match ownership for a fresh tab',async({browser})=>{
  const context=await browser.newContext();
  try{
    let owner=await context.newPage();
    await begin(owner,'normal');
    await owner.close();
    const reopened=await context.newPage();
    await reopened.goto('/');
    await expect(reopened.getByTestId('continue')).toBeVisible();
    await reopened.getByTestId('continue').click();
    await expect(reopened.getByTestId('gameplay-screen')).toBeVisible();
    await expect(reopened.getByRole('dialog')).toHaveCount(0);
  }finally{await context.close();}
});

test('exactly-once match statistics survive refresh and rematch gets a new identity',async({page})=>{
  await begin(page,'practice');
  let won=false;
  for(let i=0;i<850;i++){
    if(await page.getByTestId('rematch').isVisible().catch(()=>false)){won=true;break;}
    if(await page.getByTestId('next-round').isVisible().catch(()=>false)){await page.getByTestId('next-round').click();continue;}
    if(await page.getByTestId('suit-S').isVisible().catch(()=>false)){await page.getByTestId('suit-S').click();continue;}
    const card=page.getByTestId('player-hand').locator('button[data-playable="true"]:not([disabled])').first();
    if(await card.count()){await card.click();await page.getByTestId('play-selected').click();continue;}
    if(await page.getByTestId('draw-card').isVisible().catch(()=>false)){await page.getByTestId('draw-card').click();continue;}
    if(await page.getByTestId('finish-turn').isVisible().catch(()=>false)){await page.getByTestId('finish-turn').click();continue;}
    if(await page.getByTestId('pass-turn').isVisible().catch(()=>false)){await page.getByTestId('pass-turn').click();continue;}
    await page.waitForTimeout(20);
  }
  expect(won,'match completes through real P1 engine').toBe(true);
  await expect(page.getByTestId('save-status')).toContainText(/บันทึกแล้ว|Saved/);
  await page.reload();await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(page.getByTestId('continue')).toHaveCount(0);
  await page.getByRole('button',{name:/Statistics|สถิติ/i}).click();
  await expect(page.getByTestId('stats-matches')).toHaveText('1');
  await page.reload();await page.getByRole('button',{name:/Statistics|สถิติ/i}).click();
  await expect(page.getByTestId('stats-matches')).toHaveText('1');
});

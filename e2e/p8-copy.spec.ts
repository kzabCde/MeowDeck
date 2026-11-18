import {expect,test} from '@playwright/test';

test('routine save and turn narration stay silent, while tutorial remains replayable',async({page})=>{
  await page.goto('/?qaSeed=62&fastAI=1');
  await expect(page.getByTestId('main-menu')).toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveCount(0);
  await expect(page.getByText(/พร้อมเล่นแบบออฟไลน์|บันทึกแล้ว|Saved successfully|Ready for offline play/i)).toHaveCount(0);
  await page.getByTestId('play-now').click();
  await expect(page.getByTestId('select-blackjack')).toContainText('ทำแต้มใกล้ 21 แต่ห้ามเกิน');
  await page.getByTestId('select-crazy-eights').click();
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();
  // The optional, dismissible tutorial remains functional; routine footer prose does not.
  await expect(page.getByTestId('tutorial-hint')).toBeVisible();
  await page.getByTestId('tutorial-skip').click();
  const footer=page.locator('.action-status');
  await expect(footer).toHaveText('');
  await expect(footer).not.toHaveAttribute('role','status');
  await expect(page.getByTestId('save-status')).toHaveCount(0);
  await page.getByTestId('pause-button').click();
  await page.getByTestId('tutorial-replay').click();
  await expect(page.getByTestId('tutorial-hint')).toBeVisible();
});

for(const locale of ['th','en'] as const){
  test(`failed card assets show one localized alert with a working Retry control in ${locale}`,async({page})=>{
    await page.addInitScript(language=>{
      localStorage.setItem('meowdeck:settings:1',JSON.stringify({
        schemaVersion:1,language,preferredDifficulty:'practice',motion:'system',
        sfxEnabled:true,musicEnabled:false,sfxVolume:0.45,musicVolume:0.16
      }));
    },locale);
    await page.route('**/assets/meowdeck/cards/manifest.json',route=>route.fulfill({
      status:503,contentType:'application/json',body:'{}'
    }));
    await page.goto('/');
    const error=page.getByRole('alert');
    await expect(error).toHaveText(locale==='th'?'ไม่สามารถโหลดภาพไพ่':'Card art unavailable');
    await expect(page.getByRole('button',{name:locale==='th'?'ลองอีกครั้ง':'Retry'})).toBeVisible();
    await expect(page.getByText('Retry / ลองอีกครั้ง')).toHaveCount(0);
    await expect(page.locator('.asset-loading')).not.toHaveAttribute('role','status');
  });
}

test('failed settings are reported accurately, not as a misleading game-save failure',async({page})=>{
  await page.addInitScript(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key:string,value:string){
      if(key==='meowdeck:settings:1')throw new Error('Simulated settings write failure');
      return original.call(this,key,value);
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('main-menu')).toBeVisible();
  const warning=page.getByTestId('save-status');
  await expect(warning).toHaveText('บันทึกการตั้งค่าไม่ได้');
  await expect(warning).toHaveAttribute('role','alert');
  await expect(page.locator('.p4-statusbar')).not.toHaveAttribute('role','status');
  await page.getByRole('button',{name:/ตั้งค่า|Settings/i}).first().click();
  await page.getByRole('combobox',{name:/ภาษา|Language/i}).selectOption('en');
  await expect(warning).toHaveText('Could not save settings');
});

test('concise English game and difficulty text has no invented lore or routine status',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:/ตั้งค่า|Settings/i}).first().click();
  await page.getByRole('combobox',{name:/ภาษา|Language/i}).selectOption('en');
  await page.keyboard.press('Escape');
  await page.getByTestId('play-now').click();
  await expect(page.getByTestId('select-crazy-eights')).toContainText('Match suit or rank. Eights change suit.');
  await expect(page.getByTestId('select-blackjack')).toContainText('Get close to 21 without going over.');
  await page.getByTestId('select-crazy-eights').click();
  await page.getByTestId('difficulty-hard').click();
  await expect(page.locator('#difficulty-description')).toHaveText('Tracks public cards to plan stronger moves.');
  await expect(page.getByTestId('difficulty-hard')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByText(/One little table|Many big adventures|Mochi has shuffled the deck/i)).toHaveCount(0);
});

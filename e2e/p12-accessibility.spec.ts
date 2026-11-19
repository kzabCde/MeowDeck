import {expect,test,type Page} from '@playwright/test';

async function openCrazy(page:Page){
 await page.goto('/?qaSeed=62&fastAI=1');
 await page.getByTestId('play-now').click();
 await page.getByTestId('select-crazy-eights').click();
 await page.getByTestId('start-match').click();
 await expect(page.getByTestId('gameplay-screen')).toBeVisible();
}

async function switchLanguage(page:Page,lang:'th'|'en'){
 await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).first().click();
 const dialog=page.getByRole('dialog');
 await expect(dialog).toBeVisible();
 await page.getByRole('combobox',{name:/ภาษา|Language/i}).selectOption(lang);
 await expect(page.locator('html')).toHaveAttribute('lang',lang);
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
}

for(const lang of ['th','en'] as const){
 test(`language ${lang} provides labelled navigation and a full readable card hand`,async({page})=>{
  await page.setViewportSize({width:320,height:568});
  await page.goto('/');
  if(lang==='en')await switchLanguage(page,'en');
  await page.getByTestId('play-now').click();
  await expect(page.getByTestId('game-selection').locator('h1[data-screen-heading]')).toBeFocused();
  await page.getByTestId('select-crazy-eights').click();
  await expect(page.getByTestId('difficulty-selection').locator('h1[data-screen-heading]')).toBeFocused();
  await page.getByTestId('start-match').click();
  const game=page.getByTestId('gameplay-screen');
  await expect(game.locator('h1[data-screen-heading]')).toBeFocused();
  const hand=page.getByTestId('player-hand');
  const cards=hand.locator('.card-tile');
  await expect(cards).toHaveCount(7);
  const inventory=page.getByTestId('accessible-hand-list');
  await expect(inventory.locator('li')).toHaveCount(7);
  const names=await cards.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')??''));
  const contents=await inventory.locator('li').allTextContents();
  expect(new Set(names).size).toBe(7);
  names.forEach((name,index)=>{
   expect(name.length).toBeGreaterThan(2);
   expect(contents[index]).toContain(name);
   expect(contents[index]).toMatch(lang==='th'?/ลงได้|ยังลงไม่ได้/:/Can play|Cannot play now/);
  });
  if(lang==='en'){
   expect(names.every(s=>!/^(A|J|Q|K)\s/.test(s))).toBe(true);
  }else{
   expect(names.every(s=>!/^(A|J|Q|K)\s/.test(s))).toBe(true);
  }
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  if(await hand.getAttribute('data-overflow')==='true'){
   await expect(hand).toHaveAttribute('role','region');
   await expect(hand).toHaveAttribute('tabindex','0');
   await hand.focus();
   await expect(hand).toBeFocused();
   expect(await hand.getAttribute('aria-describedby')).toBe('hand-scroll-instructions');
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
 });
}

test('keyboard focus remains visible on controls, and a native dialog returns focus on Escape',async({page})=>{
 await page.goto('/');
 const trigger=page.getByRole('button',{name:/Settings|ตั้งค่า/i}).first();
 await trigger.focus();
 await expect(trigger).toBeFocused();
 const focus=await trigger.evaluate(node=>getComputedStyle(node).outlineWidth);
 expect(parseFloat(focus)).toBeGreaterThanOrEqual(3);
 await page.keyboard.press('Enter');
 const dialog=page.getByRole('dialog');
 await expect(dialog).toBeVisible();
 const title=dialog.locator('h2');
 expect(await dialog.getAttribute('aria-labelledby')).toBe(await title.getAttribute('id'));
 const language=page.getByRole('combobox',{name:/ภาษา|Language/i});
 await expect(language).toBeFocused();
 await expect(dialog.locator('.dialog-header .icon-button')).not.toBeFocused();
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
 await expect(trigger).toBeFocused();
});

test('nested confirmation initially focuses its safe action and preserves dialog heading',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).first().click();
 await page.getByRole('button',{name:/คืนค่าการตั้งค่า|Reset settings/}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog).toBeVisible();
 await expect(page.getByRole('button',{name:/Cancel|ยกเลิก/})).toBeFocused();
 expect(await dialog.getAttribute('aria-labelledby')).toBe(await dialog.locator('h2').getAttribute('id'));
 await page.keyboard.press('Escape');
 await expect(dialog).toContainText(/ตั้งค่า|Settings/);
 const language=page.getByRole('combobox',{name:/ภาษา|Language/i});
 await expect(language).toBeVisible();
});

test('high-contrast suit controls are readable against dark felt in both languages',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).first().click();
 const contrast=await page.getByRole('dialog').evaluate(dialog=>{
   const button=document.createElement('button');
   button.className='suit-choice suit-hearts';
   dialog.querySelector('.dialog-content')!.append(button);
   const score=(color:string,bg:string)=>{
     const components=(s:string)=>s.match(/[0-9.]+/g)!.slice(0,3).map(n=>{
       const c=Number(n)/255;
       return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);
     });
     const lum=(rgb:number[])=>rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
     const a=lum(components(color)),b=lum(components(bg));
     return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   };
   const red=getComputedStyle(button);
   const redScore=score(red.color,red.backgroundColor);
   button.className='suit-choice suit-spades';
   const black=getComputedStyle(button);
   const blackScore=score(black.color,black.backgroundColor);
   button.remove();
   return {redScore,blackScore};
 });
 expect(contrast.redScore).toBeGreaterThanOrEqual(4.5);
 expect(contrast.blackScore).toBeGreaterThanOrEqual(4.5);
});

test('turn and errors announce real information without reading cosmetic sprite changes',async({page})=>{
 await openCrazy(page);
 const turn=page.getByTestId('turn-status');
 await expect(turn).toHaveAttribute('aria-live','polite');
 await expect(page.locator('.mochi-frame[aria-live], .mochi-frame[role="status"]')).toHaveCount(0);
 const hand=page.getByTestId('player-hand');
 await expect(hand.locator('button')).toHaveCount(7);
 if(await page.getByTestId('tutorial-skip').isVisible().catch(()=>false))
  await page.getByTestId('tutorial-skip').click();
 await expect(page.locator('.action-status')).not.toHaveAttribute('role','status');
 await expect(page.getByTestId('save-status')).toHaveCount(0);
});

for(const [width,height] of [[320,568],[640,360],[390,844]] as const){
 test(`Thai and English controls stay usable at zoom-equivalent ${width}x${height}`,async({page})=>{
  await page.setViewportSize({width,height});
  await page.goto('/');
  await expect(page.getByTestId('play-now')).toBeVisible();
  await page.getByTestId('play-now').click();
  await expect(page.getByTestId('game-choice-list')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await page.getByTestId('select-blackjack').click();
  await expect(page.getByTestId('blackjack-screen')).toBeVisible();
  const button=page.getByTestId('blackjack-rules');
  await button.scrollIntoViewIfNeeded();
  const rect=await button.boundingBox();
  expect(rect?.height).toBeGreaterThanOrEqual(44);
  await button.click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.locator('h2').count()).toBe(1);
  const bounds=await dialog.boundingBox();
  expect(bounds?.y).toBeGreaterThanOrEqual(-1);
  expect((bounds?.y??Infinity)+(bounds?.height??0)).toBeLessThanOrEqual(height+2);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
 });
}


test('Blackjack entry focuses its heading even during local-save hydration',async({page})=>{
 await page.goto('/?qaSeed=62&fastAI=1');
 await page.getByTestId('play-now').click();
 await page.getByTestId('select-blackjack').click();
 await expect(page.getByTestId('blackjack-screen')).toBeVisible();
 await expect(page.getByTestId('blackjack-screen').locator('h1[data-screen-heading]')).toBeFocused();
 await expect(page.getByRole('group',{name:/คะแนนรอบแบล็กแจ็ก|Blackjack round score/})).toBeVisible();
 await page.getByTestId('blackjack-back').click();
 await expect(page.getByTestId('game-selection').locator('h1[data-screen-heading]')).toBeFocused();
});

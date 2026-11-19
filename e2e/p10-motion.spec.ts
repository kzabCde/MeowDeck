import {expect,test,type Page} from '@playwright/test';

async function crazyEights(page:Page){
  await page.goto('/?qaSeed=62&fastAI=1');
  await page.getByTestId('play-now').click();
  await page.getByTestId('select-crazy-eights').click();
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();
  if(await page.getByTestId('tutorial-skip').isVisible().catch(()=>false))
    await page.getByTestId('tutorial-skip').click();
}

test('buttons press as short pixel steps and retain native click/keyboard action',async({page})=>{
  await page.goto('/');
  const play=page.getByTestId('play-now');
  const motion=await play.evaluate(node=>{
    const style=getComputedStyle(node);
    return {duration:style.transitionDuration,timing:style.transitionTimingFunction};
  });
  expect(motion.duration).toContain('0.09s');
  expect(motion.timing).toContain('steps(');
  const box=await play.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  await page.mouse.down();
  await expect.poll(()=>play.evaluate(n=>new DOMMatrixReadOnly(getComputedStyle(n).transform).m42)).toBeGreaterThanOrEqual(1);
  await page.mouse.up();
  await expect(page.getByTestId('game-selection')).toBeVisible();
  await page.keyboard.press('Tab');
  // Keyboard events and native button focus remain available alongside visual feedback.
  const focusable=await page.evaluate(()=>document.activeElement?.tagName==='BUTTON');
  expect(focusable).toBe(true);
});

test('scene entrances are finite and pixel-stepped, without moving the live table',async({page})=>{
  await page.goto('/');
  const menu=await page.locator('.md4-title-choices').evaluate(n=>{
    const s=getComputedStyle(n);return {name:s.animationName,duration:s.animationDuration,count:s.animationIterationCount,timing:s.animationTimingFunction};
  });
  expect(menu.name).toBe('md-scene-enter');
  expect(menu.duration).toBe('0.15s');
  expect(menu.count).toBe('1');
  expect(menu.timing).toContain('steps(');
  await page.getByTestId('play-now').click();
  const game=await page.locator('.md5-choice-scene').evaluate(n=>getComputedStyle(n).animationName);
  expect(game).toBe('md-scene-enter');
  await page.getByTestId('select-crazy-eights').click();
  expect(await page.locator('.md4-difficulty-controls').evaluate(n=>getComputedStyle(n).animationName)).toBe('md-scene-enter');
  await page.getByTestId('difficulty-hard').click();
  await expect(page.getByTestId('difficulty-hard')).toHaveAttribute('aria-pressed','true');
  await page.getByTestId('start-match').click();
  await expect(page.getByTestId('gameplay-screen')).toBeVisible();
  expect(await page.getByTestId('crazy-eights-table').evaluate(n=>getComputedStyle(n).animationName)).toBe('none');
});

test('card selection lifts original artwork without scale or fake status text',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await crazyEights(page);
  const playable=page.getByTestId('player-hand').locator('.card-tile.is-playable:not(:disabled)').first();
  await playable.click();
  await expect(playable).toHaveAttribute('aria-pressed','true');
  await expect.poll(async()=>playable.evaluate(n=>Math.round(new DOMMatrixReadOnly(getComputedStyle(n).transform).m42))).toBe(-8);
  const transform=await playable.evaluate(n=>{
    const matrix=new DOMMatrixReadOnly(getComputedStyle(n).transform);
    return {x:matrix.m41,scaleX:matrix.m11,scaleY:matrix.m22};
  });
  expect(transform.x).toBe(0);
  expect(transform.scaleX).toBe(1);
  expect(transform.scaleY).toBe(1);
  await expect(page.getByTestId('save-status')).toHaveCount(0);
  await expect(page.getByTestId('play-selected')).toBeEnabled();
  await playable.click();
  await expect(playable).toHaveAttribute('aria-pressed','false');
});

test('committed card impact is a short nonblocking border flash without particles',async({page})=>{
  await crazyEights(page);
  const feedback=await page.evaluate(()=>{
    const discard=document.querySelector('.discard-pile');
    if(!discard)return null;
    const mark=document.createElement('span');
    mark.className='md-card-impact md-wild-impact md-wild-hearts';
    discard.append(mark);
    const style=getComputedStyle(mark);
    const after=getComputedStyle(mark,'::after');
    const values={pointerEvents:style.pointerEvents,name:style.animationName,
      duration:style.animationDuration,iterations:style.animationIterationCount,
      timing:style.animationTimingFunction,afterContent:after.content};
    mark.remove();
    return values;
  });
  expect(feedback?.pointerEvents).toBe('none');
  expect(feedback?.name).toBe('md-discard-impact');
  expect(feedback?.duration).toBe('0.21s');
  expect(feedback?.iterations).toBe('1');
  expect(feedback?.timing).toContain('steps(');
  expect(['none','normal']).toContain(feedback?.afterContent);
  await expect(page.locator('.draw-pile-action')).toBeVisible();
});

test('Blackjack outcome uses one brief transition, no looping glow or gameplay delay',async({page})=>{
  await page.goto('/?qaSeed=62&fastAI=1');
  await page.getByTestId('play-now').click();
  await page.getByTestId('select-blackjack').click();
  await expect(page.getByTestId('blackjack-hit')).toBeVisible();
  await page.getByTestId('blackjack-stand').click();
  const result=page.getByTestId('blackjack-result');
  await expect(result).toBeVisible();
  const css=await result.evaluate(n=>{
    const s=getComputedStyle(n);return {name:s.animationName,duration:s.animationDuration,count:s.animationIterationCount};
  });
  expect(css).toEqual({name:'md-result-enter',duration:'0.15s',count:'1'});
  await expect(page.getByTestId('blackjack-next')).toBeEnabled();
});

test('OS and in-game reduced motion disable decorative scenes while keeping game functional',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  expect(await page.locator('.md4-title-choices').evaluate(n=>getComputedStyle(n).animationName)).toBe('none');
  await page.getByTestId('play-now').click();
  expect(await page.locator('.md5-choice-scene').evaluate(n=>getComputedStyle(n).animationName)).toBe('none');
  await page.getByTestId('select-crazy-eights').click();
  expect(await page.locator('.md4-difficulty-controls').evaluate(n=>getComputedStyle(n).animationName)).toBe('none');
  await page.getByTestId('start-match').click();
  const impact=await page.evaluate(()=>{
    const el=document.createElement('span');el.className='md-card-impact';
    document.querySelector('.discard-pile')?.append(el);
    const display=getComputedStyle(el).display;el.remove();return display;
  });
  expect(impact).toBe('none');
  await expect(page.getByTestId('play-selected')).toBeVisible();
  await page.getByTestId('pause-button').click();
  const modal=page.getByRole('dialog');
  await expect(modal).toBeVisible();
  expect(await modal.evaluate(n=>getComputedStyle(n).animationName)).toBe('none');
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
  // Check the in-game override independently from OS-level media settings.
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.getByTestId('pause-button').click();
  await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).last().click();
  await page.getByRole('checkbox',{name:/Reduced motion|ลดการเคลื่อนไหว/i}).check();
  await expect(page.locator('html')).toHaveClass(/reduce-motion/);
  expect(await page.getByRole('dialog').evaluate(n=>getComputedStyle(n).animationName)).toBe('none');
});

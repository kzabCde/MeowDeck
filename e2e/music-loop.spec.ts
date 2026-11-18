import {test,expect} from '@playwright/test';

type MusicSnapshot={src:string;loop:boolean;volume:number;playCalls:number;pauseCalls:number;instances:number};

/** Observe the media element without needing a browser sound device or a network
 * download. Real file playback and seam QA still need the committed MP3 asset. */
test('Little Cafe loops as a single track across modes with persistent music settings',async({page})=>{
 await page.addInitScript(()=>{
   type QA=typeof window & {__musicQA?:{instances:HTMLMediaElement[];playCalls:number;pauseCalls:number}};
   const w=window as QA;
   w.__musicQA={instances:[],playCalls:0,pauseCalls:0};
   const originalPlay=HTMLMediaElement.prototype.play;
   const originalPause=HTMLMediaElement.prototype.pause;
   HTMLMediaElement.prototype.play=function(){
     if(this instanceof HTMLAudioElement){
       const q=w.__musicQA!;
       if(!q.instances.includes(this))q.instances.push(this);
       q.playCalls++;
       return Promise.resolve();
     }
     return originalPlay.call(this);
   };
   HTMLMediaElement.prototype.pause=function(){
     if(this instanceof HTMLAudioElement){w.__musicQA!.pauseCalls++;return;}
     return originalPause.call(this);
   };
 });
 const read=()=>page.evaluate(():MusicSnapshot=>{
   const q=(window as typeof window & {__musicQA:{instances:HTMLMediaElement[];playCalls:number;pauseCalls:number}}).__musicQA;
   const m=q.instances[0];
   return {src:m?.currentSrc||m?.src||'',loop:m?.loop??false,volume:m?.volume??-1,
     playCalls:q.playCalls,pauseCalls:q.pauseCalls,instances:q.instances.length};
 });
 await page.goto('/?qaSeed=62&fastAI=1');
 await expect(page.getByTestId('main-menu')).toBeVisible();
 expect((await read()).playCalls).toBe(0); // never auto-start before a gesture
 await page.getByTestId('play-now').click();
 await expect(page.getByTestId('game-selection')).toBeVisible();
 await expect.poll(async()=> (await read()).playCalls).toBe(1);
 const first=await read();
 expect(first.src).toContain('/assets/meowdeck/audio/little_cafe.mp3');
 expect(first.loop).toBe(true);
 expect(first.volume).toBeCloseTo(.16,2);
 expect(first.instances).toBe(1);
 await page.getByTestId('select-blackjack').click();
 await expect(page.getByTestId('blackjack-screen')).toBeVisible();
 expect((await read()).instances).toBe(1);
 expect((await read()).playCalls).toBe(1);
 await page.getByTestId('blackjack-back').click();
 await page.getByRole('button',{name:/Back|กลับ/i}).first().click();
 await expect(page.getByTestId('main-menu')).toBeVisible();
 await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).first().click();
 await expect(page.getByTestId('music-toggle')).toBeChecked();
 await page.getByTestId('music-toggle').uncheck();
 await expect.poll(async()=> (await read()).pauseCalls).toBeGreaterThan(0);
 await page.getByTestId('music-toggle').check();
 await expect.poll(async()=> (await read()).playCalls).toBeGreaterThan(1);
 await page.getByTestId('music-volume').fill('0.3');
 await expect.poll(async()=> (await read()).volume).toBeCloseTo(.3,2);
 expect((await read()).instances).toBe(1);
 await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('meowdeck:settings:1')||'{}').musicEnabled)).toBe(true);
 await page.reload();
 await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).first().click();
 await expect(page.getByTestId('music-toggle')).toBeChecked();
 await expect(page.getByTestId('music-volume')).toHaveValue('0.3');
});

test('Little Cafe toggle off is independent from game SFX controls',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:/Settings|ตั้งค่า/i}).first().click();
 await expect(page.getByTestId('music-toggle')).toBeChecked();
 await expect(page.getByTestId('sfx-toggle')).toBeChecked();
 await page.getByTestId('music-toggle').uncheck();
 await expect(page.getByTestId('sfx-toggle')).toBeChecked();
 await page.getByTestId('music-toggle').check();
 await page.getByTestId('sfx-toggle').uncheck();
 await expect(page.getByTestId('music-toggle')).toBeChecked();
});

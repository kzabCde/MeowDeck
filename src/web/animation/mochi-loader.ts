import { parseMochiManifest, type MochiClip, type MochiClipName, type MochiManifest } from '../../games/meowdeck/presentation/mochi-animation.js';

export const MOCHI_ROOT='/assets/meowdeck/mochi/';
let loaded:MochiManifest|null=null;
let inflight:Promise<MochiManifest>|null=null;
const spriteCache=new Map<MochiClipName,HTMLImageElement>();
const unavailable=new Set<MochiClipName>();

export function mochiSheetUrl(clip:MochiClip):string {
  // The manifest parser constrains sheets to a safe local relative path.
  return MOCHI_ROOT+clip.sheet;
}
export function getMochiClip(name:MochiClipName):MochiClip|null { return loaded?.get(name)??null; }
export function isMochiSheetReady(name:MochiClipName):boolean {return spriteCache.has(name)&&!unavailable.has(name);}
export function ensureMochiAnimations():Promise<MochiManifest> {
  if(loaded)return Promise.resolve(loaded);
  if(!inflight)inflight=fetch(`${MOCHI_ROOT}animations.json`).then(async(response)=>{
    if(!response.ok)throw Error(`Mochi animation manifest HTTP ${response.status}`);
    const manifest=parseMochiManifest(await response.json() as unknown);
    await Promise.all([...manifest.values()].map(c=>new Promise<void>((resolve)=>{
      const image=new Image();
      image.onload=()=>{if(image.naturalWidth===c.sheetWidth&&image.naturalHeight===c.sheetHeight){spriteCache.set(c.name,image);}else{unavailable.add(c.name);}resolve();};
      image.onerror=()=>{unavailable.add(c.name);resolve();};
      image.src=mochiSheetUrl(c);
    })));
    loaded=manifest;
    return manifest;
  }).catch((error:unknown)=>{inflight=null;throw error;});
  return inflight;
}

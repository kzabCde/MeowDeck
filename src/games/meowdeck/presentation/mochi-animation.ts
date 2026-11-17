/** P3 animation contract: no DOM, React, timers or gameplay state. */
export const CLIP_NAMES = ['idle','blink','thinking','draw_card','play_card','victory','defeat','sleep','pet_reaction','surprise'] as const;
export type MochiClipName = typeof CLIP_NAMES[number];
export interface MochiFrame { readonly index:number;readonly x:number;readonly y:number;readonly width:number;readonly height:number }
export interface MochiClip {
  readonly name:MochiClipName;readonly frameCount:number;readonly frameWidth:number;readonly frameHeight:number;
  readonly sheetWidth:number;readonly sheetHeight:number;readonly anchor:{readonly x:number;readonly y:number};
  readonly origin:{readonly x:number;readonly y:number};readonly loop:boolean;readonly frameDurationMs:number;
  readonly sheet:string;readonly frames:readonly MochiFrame[];readonly actionFrame?:number;
}
export type MochiManifest = ReadonlyMap<MochiClipName,MochiClip>;
const loops=new Set<MochiClipName>(['idle','thinking','sleep']);
function record(x:unknown):x is Record<string,unknown>{return x!==null&&typeof x==='object'&&!Array.isArray(x)}
function integer(x:unknown,min=0):x is number{return Number.isInteger(x)&&typeof x==='number'&&x>=min}
/** Validate all P0 fields. The *numbers* of milliseconds are read only from the manifest. */
export function parseMochiManifest(raw:unknown):MochiManifest {
  if(!record(raw)||!Array.isArray(raw.animations)||JSON.stringify(raw.frameSize)!=='[96,96]'||JSON.stringify(raw.anchor)!=='[48,88]')throw Error('Invalid P0 Mochi root');
  const map=new Map<MochiClipName,MochiClip>();
  for(const row of raw.animations){
    if(!record(row)||!CLIP_NAMES.includes(row.name as MochiClipName))throw Error('Unknown Mochi clip');
    const name=row.name as MochiClipName;
    if(map.has(name)||!integer(row.frameCount,1)||!integer(row.frameDurationMs,1)||row.frameWidth!==96||row.frameHeight!==96
      ||row.sheetWidth!==row.frameCount*96||row.sheetHeight!==96||row.loop!==loops.has(name))throw Error(`Invalid Mochi metadata: ${name}`);
    if(!record(row.anchor)||row.anchor.x!==48||row.anchor.y!==88 || !record(row.origin)||row.origin.x!==0.5||Math.abs(Number(row.origin.y)-88/96)>1e-6)throw Error(`Invalid Mochi anchor: ${name}`);
    if(typeof row.sheet!=='string'||!/^sprites\/mochi_[a-z_]+_[346]f_96x96\.png$/.test(row.sheet)||row.sheet.includes('..'))throw Error(`Unsafe Mochi sheet path: ${name}`);
    if(!Array.isArray(row.frames)||row.frames.length!==row.frameCount)throw Error(`Invalid Mochi frames: ${name}`);
    for(let i=0;i<row.frames.length;i++){
      const frame:unknown=row.frames[i];
      if(!record(frame)||frame.index!==i||frame.x!==i*96||frame.y!==0||frame.width!==96||frame.height!==96)throw Error(`Invalid Mochi frame: ${name}:${i}`);
    }
    const expectsAction=name==='draw_card'||name==='play_card';
    if(expectsAction?(row.actionFrame!==3):('actionFrame'in row))throw Error(`Invalid action frame: ${name}`);
    map.set(name,row as unknown as MochiClip);
  }
  if(map.size!==10||[...map.values()].reduce((n,c)=>n+c.frameCount,0)!==44)throw Error('Mochi manifest requires 10 clips and 44 frames');
  return map;
}
export interface FrameProgress {readonly frame:number;readonly hitActionFrame:boolean;readonly completed:boolean}
/** Clock with elapsed-time accumulation. Tests use synthetic timestamps without sleeps. */
export class ClipClock {
  private elapsed=0;
  private fired=false;
  private finished=false;
  private last=0;
  private frame=0;
  constructor(readonly clip:MochiClip){this.frame=0;}
  get currentFrame(){return this.frame;}
  get completed(){return this.finished;}
  advance(ms:number):FrameProgress {
    if(!Number.isFinite(ms)||ms<0)throw Error('Animation elapsed time must be finite and >= 0');
    if(this.finished)return {frame:this.frame,hitActionFrame:false,completed:true};
    this.elapsed+=ms;
    const count=this.clip.frameCount;
    const absolute=Math.floor(this.elapsed/this.clip.frameDurationMs);
    const max=count-1;
    this.frame=this.clip.loop?absolute%count:Math.min(absolute,max);
    const hitActionFrame=this.clip.actionFrame!==undefined&&!this.fired&&absolute>=this.clip.actionFrame;
    if(hitActionFrame)this.fired=true;
    if(!this.clip.loop&&absolute>=count){this.finished=true;this.frame=max;}
    this.last=absolute;
    return {frame:this.frame,hitActionFrame,completed:this.finished};
  }
}
export type ClipPriority = 1|2|3|4|5;
export function clipPriority(c:MochiClipName):ClipPriority {
  return ['victory','defeat'].includes(c)?5:['draw_card','play_card'].includes(c)?4:['pet_reaction','surprise'].includes(c)?3:c==='thinking'?2:1;
}
/** Presentation-only queue keyed by committed action/round context; no rules actions. */
export interface PresentationCue { readonly id:string;readonly clip:MochiClipName;readonly sessionId:string;readonly round:number;readonly turn:number;readonly cardId?:string;readonly actor?:'human'|'ai' }
export class PresentationQueue {
  private pending:PresentationCue[]=[];
  private seen=new Set<string>();
  private active:PresentationCue|null=null;
  constructor(private maxPending=12){}
  get current(){return this.active;}
  get count(){return this.pending.length+(this.active?1:0);}
  enqueue(cue:PresentationCue):PresentationCue|null {
    if(this.seen.has(cue.id))return this.active;
    this.seen.add(cue.id);
    if(this.seen.size>256)this.seen=new Set([...this.seen].slice(-128));
    if(!this.active){this.active=cue;return cue;}
    if(clipPriority(cue.clip)===5 && clipPriority(this.active.clip)<=3){this.active=cue;this.pending=[];return cue;}
    if(this.pending.length>=this.maxPending){
      // Keep critical card actions/terminal results while dropping low-value decoration.
      const index=this.pending.findIndex(x=>clipPriority(x.clip)<=3);
      if(index>=0)this.pending.splice(index,1);else this.pending.shift();
    }
    this.pending.push(cue);
    return this.active;
  }
  complete(id:string):PresentationCue|null {
    if(this.active?.id!==id)return this.active;
    this.active=this.pending.shift()??null;
    return this.active;
  }
  clear(){this.pending=[];this.active=null;this.seen.clear();}
}

import { useEffect, useRef, useState } from 'react';
import { ClipClock, type MochiClipName, type MochiManifest, type PresentationCue } from '../../games/meowdeck/presentation/mochi-animation.js';
import { ensureMochiAnimations, isMochiSheetReady, mochiSheetUrl } from './mochi-loader.js';

export interface MochiAnimationProps {
  readonly pose?: MochiClipName;
  readonly cue?: PresentationCue | null;
  readonly reducedMotion?: boolean;
  readonly paused?:boolean;
  readonly onCueDone?: (id:string)=>void;
  readonly onCueActionFrame?: (id:string)=>void;
}
/** Frame updates are imperative on an isolated span; never re-render the entire game table per frame. */
export function useMochiAnimation({pose='idle',cue=null,reducedMotion=false,paused=false,onCueDone,onCueActionFrame}:MochiAnimationProps) {
  const spriteRef=useRef<HTMLSpanElement|null>(null);
  const [manifest,setManifest]=useState<MochiManifest|null>(null);
  const [loadFailed,setLoadFailed]=useState(false);
  const completeRef=useRef(onCueDone),actionRef=useRef(onCueActionFrame);
  completeRef.current=onCueDone;actionRef.current=onCueActionFrame;
  useEffect(()=>{
    let mounted=true;
    ensureMochiAnimations().then(m=>{if(mounted)setManifest(m)}).catch(()=>{if(mounted)setLoadFailed(true)});
    return ()=>{mounted=false};
  },[]);
  const baseDependency=cue?undefined:pose;
  useEffect(()=>{
    const target=spriteRef.current;
    if(!target || paused)return;
    const initial=cue?.clip??pose;
    if(!manifest){target.style.backgroundImage='url(/assets/meowdeck/mochi/sprites/mochi_idle_4f_96x96.png)';target.style.backgroundSize='400% 100%';return;}
    let raf=0,blinkTimer=0,sleepTimer=0,disposed=false,lastTimestamp:number|null=null;
    let currentName:MochiClipName=initial;
    let clock:ClipClock|null=null;
    let cueCompleted=false;
    let currentCue=cue;
    const changeClip=(next:MochiClipName)=>{
      const clip=manifest.get(next);if(!clip)return;
      currentName=next;
      clock=new ClipClock(clip);
      lastTimestamp=null;
      if(isMochiSheetReady(next)){
        target.style.backgroundImage=`url("${mochiSheetUrl(clip)}")`;
        target.style.backgroundSize=`${clip.frameCount*100}% 100%`;
        target.style.backgroundPosition='0% 0%';
        target.dataset.clip=next;
        target.dataset.frame='0';
      }else{
        target.style.backgroundImage='url(/assets/meowdeck/mochi/sprites/mochi_idle_4f_96x96.png)';
        target.style.backgroundSize='400% 100%';
        target.style.backgroundPosition='0% 0%';
        target.dataset.clip='fallback';target.dataset.frame='0';
      }
    };
    const settle=()=>{
      if(currentCue&&!cueCompleted){cueCompleted=true;const id=currentCue.id;completeRef.current?.(id);currentCue=null;}
    };
    const step=(now:number)=>{
      if(disposed)return;
      const clip=manifest.get(currentName);
      if(!clip||!clock){raf=requestAnimationFrame(step);return;}
      if(document.hidden){lastTimestamp=null;raf=requestAnimationFrame(step);return;}
      const delta=lastTimestamp===null?0:Math.min(100,Math.max(0,now-lastTimestamp));
      lastTimestamp=now;
      const progress=clock.advance(delta);
      if(isMochiSheetReady(currentName)){
        target.style.backgroundPosition=`${clip.frameCount===1?0:progress.frame/(clip.frameCount-1)*100}% 0%`;
        target.dataset.frame=String(progress.frame);
      }
      if(progress.hitActionFrame&&currentCue)actionRef.current?.(currentCue.id);
      if(progress.completed){
        if(currentCue){settle();changeClip(pose);}
        else if(currentName==='blink'||currentName==='pet_reaction'||currentName==='surprise')changeClip(pose);
        else if(!clip.loop)return; // terminal one-shots freeze on the final frame
      }
      raf=requestAnimationFrame(step);
    };
    changeClip(initial);
    if(reducedMotion||loadFailed||!isMochiSheetReady(initial)){
      if(currentCue){const id=currentCue.id;const timer=window.setTimeout(()=>{if(!disposed){settle()}},0);return()=>{disposed=true;window.clearTimeout(timer)};}
      return ()=>{disposed=true};
    }
    if(!cue&&pose==='idle'){
      const scheduleBlink=()=>{blinkTimer=window.setTimeout(()=>{
        if(disposed)return;
        if(currentName==='idle')changeClip('blink');
        scheduleBlink();
      },3500+Math.floor(Math.random()*3500));};
      scheduleBlink();
      sleepTimer=window.setTimeout(()=>{if(!disposed&&(currentName==='idle'||currentName==='blink'))changeClip('sleep');},18000);
    }
    raf=requestAnimationFrame(step);
    return ()=>{disposed=true;cancelAnimationFrame(raf);window.clearTimeout(blinkTimer);window.clearTimeout(sleepTimer)};
  },[manifest,pose,cue?.id,baseDependency,reducedMotion,paused,loadFailed]);
  return {spriteRef,loadFailed};
}

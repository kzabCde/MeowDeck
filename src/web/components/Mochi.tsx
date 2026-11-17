import type { MochiClipName, PresentationCue } from '../../games/meowdeck/presentation/mochi-animation.js';
import { useMochiAnimation } from '../animation/useMochiAnimation.js';
import type { T } from '../i18n.js';

export function Mochi({ pose='idle',size='large',t,cue,reducedMotion=false,paused=false,onCueDone,onCueActionFrame,onPet }: {
  pose?:MochiClipName;size?:'large'|'small';t:T;cue?:PresentationCue|null;reducedMotion?:boolean;paused?:boolean;
  onCueDone?:(id:string)=>void;onCueActionFrame?:(id:string)=>void;onPet?:()=>void;
}) {
  const {spriteRef}=useMochiAnimation({pose,cue,reducedMotion,paused,onCueDone,onCueActionFrame});
  const artwork=<span ref={spriteRef} className="mochi-frame pixel-art" />;
  if(onPet)return <button className={`mochi-character mochi-${size} mochi-pet`} type="button" onClick={onPet} aria-label={t('petMochi')} data-testid="mochi" title={t('petMochi')}>{artwork}</button>;
  return <div className={`mochi-character mochi-${size}`} role="img" aria-label={`${t('mochi')} — ${t('mochiAppearance')}`} data-testid="mochi">{artwork}</div>;
}

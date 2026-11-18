import type { TranslationKey } from '../i18n.js';

/** Presentation-only progress; it is never written into the authoritative match. */
export interface TutorialProgress {
  played:boolean;
  drew:boolean;
  usedEight:boolean;
  skipped:boolean;
}
export const TUTORIAL_KEY='meowdeck:tutorial:1';
export const DEFAULT_TUTORIAL:TutorialProgress={played:false,drew:false,usedEight:false,skipped:false};

export function readTutorial():TutorialProgress{
  try{
    const raw=localStorage.getItem(TUTORIAL_KEY);
    if(!raw)return {...DEFAULT_TUTORIAL};
    const data:unknown=JSON.parse(raw);
    if(!data||typeof data!=='object'||Array.isArray(data))return {...DEFAULT_TUTORIAL};
    const v=data as Record<string,unknown>;
    return {played:v.played===true,drew:v.drew===true,usedEight:v.usedEight===true,skipped:v.skipped===true};
  }catch{return {...DEFAULT_TUTORIAL};}
}
export function writeTutorial(progress:TutorialProgress):void{
  try{localStorage.setItem(TUTORIAL_KEY,JSON.stringify(progress));}catch{/* The guide is optional. */}
}
export function advanceTutorial(progress:TutorialProgress,action:'play_card'|'draw_card',cardId?:string):TutorialProgress{
  if(progress.skipped)return progress;
  if(action==='draw_card')return progress.drew?progress:{...progress,drew:true};
  const usedEight=progress.usedEight||cardId?.startsWith('8')===true;
  return progress.played&&progress.usedEight===usedEight?progress:{...progress,played:true,usedEight};
}
interface Opportunity {
  humanTurn:boolean;
  legalPlay:boolean;
  legalDraw:boolean;
  legalEight:boolean;
  selected:boolean;
}
/** Show only currently legal opportunities; never force the deck or a player's hand. */
export function getTutorialHint(progress:TutorialProgress,op:Opportunity):TranslationKey|null{
  if(progress.skipped||(progress.played&&progress.drew&&progress.usedEight)||!op.humanTurn)return null;
  if(!progress.played&&op.legalPlay)return op.selected?'tutorialPlay':'tutorialSelect';
  if(!progress.drew&&op.legalDraw)return 'tutorialDraw';
  if(!progress.usedEight&&op.legalEight)return 'tutorialEight';
  return null;
}

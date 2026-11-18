import type { Language } from '../i18n.js';
import type { StoredDifficulty } from '../storage/save-schema.js';
export type MotionPreference='system'|'on'|'off';
export interface GameSettingsV1 {
  schemaVersion:1;
  language:Language;
  preferredDifficulty:StoredDifficulty;
  motion:MotionPreference;
  sfxEnabled:boolean;
  musicEnabled:boolean;
  sfxVolume:number;
  musicVolume:number;
}
export const DEFAULT_SETTINGS:GameSettingsV1={schemaVersion:1,language:'th',preferredDifficulty:'practice',motion:'system',sfxEnabled:true,musicEnabled:true,sfxVolume:0.45,musicVolume:0.16};
export const SETTINGS_KEY='meowdeck:settings:1';
export function readSettings():GameSettingsV1{
  try{
    const source=localStorage.getItem(SETTINGS_KEY);if(!source)return {...DEFAULT_SETTINGS};
    const raw:unknown=JSON.parse(source);
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return {...DEFAULT_SETTINGS};
    const v=raw as Record<string,unknown>;if(v.schemaVersion!==1)return {...DEFAULT_SETTINGS};
    return {schemaVersion:1,language:v.language==='en'?'en':'th',
      preferredDifficulty:['practice','easy','normal','hard'].includes(String(v.preferredDifficulty))?v.preferredDifficulty as StoredDifficulty:'practice',
      motion:v.motion==='on'||v.motion==='off'?v.motion:'system',sfxEnabled:v.sfxEnabled!==false,musicEnabled:v.musicEnabled===true,
      sfxVolume:typeof v.sfxVolume==='number'&&Number.isFinite(v.sfxVolume)?Math.max(0,Math.min(1,v.sfxVolume)):DEFAULT_SETTINGS.sfxVolume,
      musicVolume:typeof v.musicVolume==='number'&&Number.isFinite(v.musicVolume)?Math.max(0,Math.min(1,v.musicVolume)):DEFAULT_SETTINGS.musicVolume};
  }catch{return {...DEFAULT_SETTINGS};}
}
export function writeSettings(settings:GameSettingsV1):boolean{
  try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));return true;}catch{return false;}
}
export function resetSettings():boolean{try{localStorage.removeItem(SETTINGS_KEY);return true;}catch{return false;}}
export function resolveReducedMotion(pref:MotionPreference,systemPrefers:boolean):boolean{return pref==='on'||(pref==='system'&&systemPrefers);}

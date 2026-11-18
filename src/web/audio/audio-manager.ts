import type { GameSettingsV1 } from '../settings/settings-store.js';
import type { DomainEvent } from '../../games/meowdeck/core/game-types.js';
export type SoundName='click'|'select'|'draw'|'play'|'wild'|'suit'|'win'|'lose'|'matchWin'|'matchLose'|'pet'|'confirm';
interface Tone {frequency:number;duration:number;wave:OscillatorType;gain:number;slide?:number;}
const cues:Record<SoundName,readonly Tone[]>={
  click:[{frequency:510,duration:.045,wave:'square',gain:.12}],select:[{frequency:670,duration:.055,wave:'triangle',gain:.16}],
  draw:[{frequency:310,duration:.09,wave:'triangle',gain:.15,slide:190}],
  play:[{frequency:390,duration:.09,wave:'square',gain:.12,slide:280}],
  wild:[{frequency:520,duration:.12,wave:'triangle',gain:.14},{frequency:780,duration:.12,wave:'triangle',gain:.1}],
  suit:[{frequency:700,duration:.07,wave:'sine',gain:.12}],
  win:[{frequency:680,duration:.14,wave:'triangle',gain:.2},{frequency:930,duration:.16,wave:'triangle',gain:.13}],
  lose:[{frequency:330,duration:.15,wave:'triangle',gain:.17,slide:245}],
  matchWin:[{frequency:740,duration:.19,wave:'triangle',gain:.2},{frequency:1040,duration:.25,wave:'triangle',gain:.14}],
  matchLose:[{frequency:300,duration:.22,wave:'triangle',gain:.16,slide:220}],
  pet:[{frequency:510,duration:.18,wave:'sine',gain:.13,slide:445}],
  confirm:[{frequency:610,duration:.11,wave:'triangle',gain:.16}]
};
export interface PlannedSound { readonly name:SoundName; readonly eventIndex:number; readonly offsetMs:number }

/** Public, confirmed engine events are the only source of gameplay SFX.
 * Stagger simultaneous card/suit/result cues instead of piling them at time zero.
 * This pure planner can be tested without creating an AudioContext. */
export function planEventSounds(events:readonly DomainEvent[]):readonly PlannedSound[] {
  const finishedMatch=events.some(e=>e.type==='MATCH_ENDED');
  const hasCardEvent=events.some(e=>e.type==='CARD_PLAYED'||e.type==='CARD_DRAWN');
  const planned:PlannedSound[]=[];
  for(const [eventIndex,event] of events.entries()){
    if(finishedMatch&&event.type==='ROUND_ENDED')continue;
    let name:SoundName|null=null;
    if(event.type==='CARD_DRAWN')name='draw';
    else if(event.type==='CARD_PLAYED')name='play';
    else if(event.type==='SUIT_CHANGED')name='suit';
    else if(event.type==='MATCH_ENDED')name=event.winner==='human'?'matchWin':'matchLose';
    else if(event.type==='ROUND_ENDED')name=event.result.winner==='human'?'win':event.result.winner==='ai'?'lose':null;
    if(!name)continue;
    const offsetMs=name==='suit'&&hasCardEvent?100:
      ['win','lose','matchWin','matchLose'].includes(name)&&hasCardEvent?180:0;
    planned.push({name,eventIndex,offsetMs});
  }
  return planned;
}

/** The user-supplied Little Cafe loop is served locally for offline PWA use.
 * UI and SFX keep their original sound pipeline; background music is one shared media element. */
export const BACKGROUND_MUSIC_URL='/assets/meowdeck/audio/little_cafe.mp3';
/** Original procedural SFX remain independent of the background music. */
export class GameAudio {
  private ctx:AudioContext|null=null;
  private settings:GameSettingsV1;
  private unlocked=false;
  private sequence=new Set<string>();
  private sequenceOrder:string[]=[];
  private music:HTMLAudioElement|null=null;
  private musicPending=false;
  private musicPlaying=false;
  private musicRequest=0;
  private visible=true;
  constructor(settings:GameSettingsV1){this.settings=settings;}
  setSettings(settings:GameSettingsV1){
    this.settings=settings;
    if(this.music)this.music.volume=Math.max(0,Math.min(1,settings.musicVolume));
    if(!settings.musicEnabled||settings.musicVolume<=0)this.stopMusic();
    else this.startMusic();
  }
  async unlock():Promise<void>{
    if(typeof window==='undefined')return;
    // Start the HTML audio inside the user's click/tap, before awaiting AudioContext.
    // Mobile Safari may reject play() if it is delayed beyond the user gesture.
    this.unlocked=true;
    this.startMusic();
    if(!('AudioContext' in window))return;
    try{this.ctx??=new AudioContext();await this.ctx.resume();}
    catch{/* Optional effects must not block gameplay or background music. */}
  }
  setVisible(visible:boolean){
    this.visible=visible;
    if(!visible){this.stopMusic();void this.ctx?.suspend().catch(()=>{});}
    else if(this.unlocked){
      this.startMusic();
      void this.ctx?.resume().catch(()=>{});
    }
  }
  private tone(sound:Tone,volume:number,offset:number){
    if(!this.ctx||this.ctx.state!=='running')return;
    const now=this.ctx.currentTime+offset,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
    osc.type=sound.wave;osc.frequency.setValueAtTime(sound.frequency,now);if(sound.slide)osc.frequency.exponentialRampToValueAtTime(sound.slide,now+sound.duration);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,sound.gain*volume),now+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,now+sound.duration);
    osc.connect(gain);gain.connect(this.ctx.destination);osc.start(now);osc.stop(now+sound.duration+.02);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  play(name:SoundName,identity?:string,offsetMs=0){
    if(!this.unlocked||!this.visible||!this.settings.sfxEnabled||this.settings.sfxVolume===0)return;
    if(identity){
      if(this.sequence.has(identity))return;
      this.sequence.add(identity);
      this.sequenceOrder.push(identity);
      if(this.sequenceOrder.length>256){
        const removed=this.sequenceOrder.shift();
        if(removed)this.sequence.delete(removed);
      }
    }
    cues[name].forEach((tone,i)=>this.tone(tone,this.settings.sfxVolume,Math.max(0,offsetMs)/1000+i*.10));
  }
  onEvents(events:readonly DomainEvent[],identity:string){
    for(const event of planEventSounds(events))this.play(event.name,`${identity}:${event.eventIndex}`,event.offsetMs);
  }
  private startMusic(){
    if(!this.unlocked||!this.settings.musicEnabled||this.settings.musicVolume<=0||!this.visible||typeof window==='undefined')return;
    if(!this.music){
      const audio=new Audio(BACKGROUND_MUSIC_URL);
      audio.loop=true;
      audio.preload='auto';
      audio.volume=Math.max(0,Math.min(1,this.settings.musicVolume));
      this.music=audio;
    }
    const audio=this.music;
    if(!audio.paused||this.musicPending||this.musicPlaying)return;
    const request=++this.musicRequest;
    this.musicPending=true;
    // Browser autoplay restrictions or missing assets must never break gameplay.
    try{
      void audio.play().then(()=>{
        if(request!==this.musicRequest)return;
        this.musicPending=false;
        this.musicPlaying=true;
      }).catch(()=>{
        if(request!==this.musicRequest)return;
        this.musicPending=false;
        this.musicPlaying=false;
      });
    }catch{this.musicPending=false;this.musicPlaying=false;}
  }
  private stopMusic(){
    this.musicRequest++;
    this.music?.pause(); // Preserve playback position when muted or tab-hidden.
    this.musicPending=false;
    this.musicPlaying=false;
  }
  dispose(){
    this.stopMusic();
    if(this.music){this.music.removeAttribute('src');this.music.load();this.music=null;}
    this.sequence.clear();this.sequenceOrder=[];this.unlocked=false;
    if(this.ctx){void this.ctx.close().catch(()=>{});this.ctx=null;}
  }
}

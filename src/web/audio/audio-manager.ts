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
/** Original, procedurally synthesized game cues. No downloaded or copyrighted audio. */
export class GameAudio {
  private ctx:AudioContext|null=null;
  private settings:GameSettingsV1;
  private unlocked=false;
  private sequence=new Set<string>();
  private musicTimer:number|null=null;
  private musicStep=0;
  private visible=true;
  constructor(settings:GameSettingsV1){this.settings=settings;}
  setSettings(settings:GameSettingsV1){this.settings=settings;if(!settings.musicEnabled||settings.musicVolume===0)this.stopMusic();else this.startMusic();}
  async unlock():Promise<void>{
    if(typeof window==='undefined'||!('AudioContext' in window))return;
    try{this.ctx??=new AudioContext();await this.ctx.resume();this.unlocked=this.ctx.state==='running';this.startMusic();}catch{/* Audio is optional. */}
  }
  setVisible(visible:boolean){this.visible=visible;if(!visible){this.stopMusic();void this.ctx?.suspend().catch(()=>{});}else if(this.unlocked){void this.ctx?.resume().then(()=>this.startMusic()).catch(()=>{});}}
  private tone(sound:Tone,volume:number,offset:number){
    if(!this.ctx||this.ctx.state!=='running')return;
    const now=this.ctx.currentTime+offset,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
    osc.type=sound.wave;osc.frequency.setValueAtTime(sound.frequency,now);if(sound.slide)osc.frequency.exponentialRampToValueAtTime(sound.slide,now+sound.duration);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,sound.gain*volume),now+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,now+sound.duration);
    osc.connect(gain);gain.connect(this.ctx.destination);osc.start(now);osc.stop(now+sound.duration+.02);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  play(name:SoundName,identity?:string){
    if(!this.unlocked||!this.visible||!this.settings.sfxEnabled||this.settings.sfxVolume===0)return;
    if(identity){if(this.sequence.has(identity))return;this.sequence.add(identity);if(this.sequence.size>200)this.sequence.clear();}
    cues[name].forEach((tone,i)=>this.tone(tone,this.settings.sfxVolume,i*.10));
  }
  onEvents(events:readonly DomainEvent[],identity:string){
    const terminal=events.some(e=>e.type==='MATCH_ENDED');
    for(const [i,event] of events.entries()){
      if(terminal&&event.type==='ROUND_ENDED')continue;
      const sound:SoundName|null=event.type==='CARD_DRAWN'?'draw':event.type==='CARD_PLAYED'?'play':
        event.type==='SUIT_CHANGED'?'suit':event.type==='MATCH_ENDED'?(event.winner==='human'?'matchWin':'matchLose'):
        event.type==='ROUND_ENDED'?(event.result.winner==='human'?'win':event.result.winner==='ai'?'lose':null):null;
      if(sound)this.play(sound,`${identity}:${i}`);
    }
  }
  private startMusic(){
    if(!this.unlocked||!this.settings.musicEnabled||this.settings.musicVolume<=0||!this.visible||this.musicTimer!==null)return;
    // Original ambient four-note motif; independent from SFX and never triggered before unlock.
    const notes=[261.63,329.63,392,329.63,293.66,349.23,440,349.23];
    const step=()=>{if(!this.ctx||this.ctx.state!=='running')return;this.tone({frequency:notes[this.musicStep++%notes.length]!,duration:.45,wave:'sine',gain:.10},this.settings.musicVolume,0);};
    step();this.musicTimer=window.setInterval(step,830);
  }
  private stopMusic(){if(this.musicTimer!==null){clearInterval(this.musicTimer);this.musicTimer=null;}}
  dispose(){this.stopMusic();this.sequence.clear();this.unlocked=false;if(this.ctx){void this.ctx.close().catch(()=>{});this.ctx=null;}}
}

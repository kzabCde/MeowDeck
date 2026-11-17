import type { DomainEvent } from '../core/game-types.js';
import type { PresentationCue, MochiClipName } from './mochi-animation.js';

/** Only committed public events and public identifiers cross into presentation. */
export interface CueContext {readonly sessionId:string;readonly round:number;readonly turn:number;readonly actionId:string}
export function cuesFromConfirmedEvents(context:CueContext,events:readonly DomainEvent[]):readonly PresentationCue[] {
  const cues:PresentationCue[]=[];
  const add=(clip:MochiClipName,index:number,cardId?:string,actor?:'human'|'ai')=>{
    cues.push({id:`${context.sessionId}:${context.round}:${context.turn}:${context.actionId}:${clip}:${index}`,
      sessionId:context.sessionId,round:context.round,turn:context.turn,clip,
      ...(cardId?{cardId}:{}),...(actor?{actor}:{})});
  };
  for(let i=0;i<events.length;i++){
    const e=events[i]!;
    if(e.type==='CARD_DRAWN'&&e.actor==='ai')add('draw_card',i,undefined,e.actor);
    if(e.type==='CARD_PLAYED'&&e.actor==='ai')add('play_card',i,e.cardId,e.actor);
    if(e.type==='CARD_PLAYED'&&e.actor==='human'&&e.cardId.startsWith('8'))add('surprise',i,e.cardId,e.actor);
    if(e.type==='ROUND_ENDED'){
      if(e.result.winner==='ai')add('victory',i);
      if(e.result.winner==='human')add('defeat',i);
    }
  }
  return cues;
}

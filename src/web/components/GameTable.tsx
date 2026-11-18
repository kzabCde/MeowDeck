import { useEffect, useRef, useState } from 'react';
import type { CardId } from '../../games/meowdeck/core/cards.js';
import type { PublicGameState } from '../../games/meowdeck/games/crazy-eights/selectors.js';
import type { Card } from '../../games/meowdeck/core/cards.js';
import type { LegalAction } from '../../games/meowdeck/core/game-types.js';
import { SUIT_SYMBOL, SUIT_CLASS, cardImage } from '../game/assets.js';
import type { MochiClipName, PresentationCue } from '../../games/meowdeck/presentation/mochi-animation.js';
import type { Difficulty } from '../../games/meowdeck/ai/strategies.js';
import { getMochiClip } from '../animation/mochi-loader.js';
import type { T } from '../i18n.js';
import { CardBack, PixelCard } from './PixelCard.js';
import { Mochi } from './Mochi.js';

type HumanView = PublicGameState & { readonly ownHand: readonly Card[]; readonly legalActions: readonly LegalAction[] };

export interface GameTableProps {
  view: HumanView;
  t: T;
  selected: CardId | null;
  onSelect: (id: CardId) => void;
  onPlay: () => void;
  onDraw: () => void;
  onFinish: () => void;
  onPass: () => void;
  onPause: () => void;
  error: string | null;
  difficulty: Difficulty;
  cue: PresentationCue|null;
  reducedMotion:boolean;
  paused:boolean;
  onCueDone:(id:string)=>void;
  onPet:()=>void;
  tutorialHint:string|null;
  onSkipTutorial:()=>void;
}


function gameHint(view: HumanView, t: T): string {
  if (view.phase === 'round_end' || view.phase === 'match_end') return t('roundResult');
  if (view.currentActor === 'ai') return '';
  if (view.hasPendingDrawDecision) return t('finishHint');
  if (view.legalActions.some(a=>a.type==='draw_card')) return t('drawHint');
  if (view.legalActions.some(a=>a.type==='pass_turn')) return t('passHint');
  return '';
}

export function GameTable({ view, t, selected, onSelect, onPlay, onDraw, onFinish, onPass, onPause, error, difficulty, cue, reducedMotion, paused, onCueDone, onPet, tutorialHint, onSkipTutorial }: GameTableProps) {
  const handRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLDivElement|null>(null);
  const drawRef = useRef<HTMLDivElement|null>(null);
  const discardRef = useRef<HTMLDivElement|null>(null);
  const enemyRef = useRef<HTMLDivElement|null>(null);
  const [flight,setFlight]=useState<{id:string;left:number;top:number;dx:number;dy:number;duration:number;started:boolean;cardId?:CardId}|null>(null);
  const [shownActionFrame,setShownActionFrame]=useState<string|null>(null);
  const lastDiscardRef=useRef(view.topDiscard.id);
  const [impact,setImpact]=useState<string|null>(null);
  const humanOrigin=useRef<{cardId:CardId;left:number;top:number;width:number;height:number}|null>(null);
  const [humanFlight,setHumanFlight]=useState<{id:string;cardId:CardId;left:number;top:number;width:number;height:number;dx:number;dy:number;started:boolean}|null>(null);
  const lastHandRef=useRef({round:view.roundNumber,count:view.ownHand.length});
  const [handMotion,setHandMotion]=useState<string|null>(null);
  useEffect(()=>{
    const previous=lastHandRef.current;
    if(previous.round===view.roundNumber&&view.ownHand.length>previous.count&&!reducedMotion)
      setHandMotion(`${view.roundNumber}:${view.turnId}:${view.ownHand.length}`);
    lastHandRef.current={round:view.roundNumber,count:view.ownHand.length};
  },[view.roundNumber,view.turnId,view.ownHand.length,reducedMotion]);
  useEffect(()=>{
    if(lastDiscardRef.current===view.topDiscard.id)return;
    lastDiscardRef.current=view.topDiscard.id;
    setHumanFlight(null); // Drop a previous visual if a new committed card arrives early.
    const origin=humanOrigin.current;
    humanOrigin.current=null;
    const flightId=`${view.roundNumber}:${view.turnId}:${view.topDiscard.id}`;
    if(!reducedMotion&&origin?.cardId===view.topDiscard.id) {
      const table=tableRef.current?.getBoundingClientRect();
      const dest=discardRef.current?.getBoundingClientRect();
      if(table&&dest) {
        const dx=dest.left+dest.width/2-(origin.left+origin.width/2);
        const dy=dest.top+dest.height/2-(origin.top+origin.height/2);
        setHumanFlight({id:flightId,cardId:origin.cardId,left:origin.left-table.left,
          top:origin.top-table.top,width:origin.width,height:origin.height,dx,dy,started:false});
        const raf=requestAnimationFrame(()=>setHumanFlight(current=>current?.id===flightId?{...current,started:true}:current));
        const timer=window.setTimeout(()=>{
          setHumanFlight(current=>current?.id===flightId?null:current);
          setImpact(flightId);
        },310);
        return()=>{cancelAnimationFrame(raf);window.clearTimeout(timer);};
      }
    }
    const aiFlight=cue?.clip==='play_card'&&cue.actor==='ai'&&cue.cardId===view.topDiscard.id;
    if(!reducedMotion&&!aiFlight)setImpact(flightId);
  },[view.topDiscard.id,view.roundNumber,view.turnId,reducedMotion]);
  useEffect(()=>{
    if(reducedMotion||!cue||!['draw_card','play_card'].includes(cue.clip)) {setFlight(null);return;}
    const table=tableRef.current;
    const from=cue.clip==='draw_card'?drawRef.current:enemyRef.current;
    const to=cue.clip==='draw_card'?enemyRef.current:discardRef.current;
    const clip=getMochiClip(cue.clip);
    if(!table||!from||!to||!clip||clip.actionFrame===undefined)return;
    const b=table.getBoundingClientRect(),a=from.getBoundingClientRect(),z=to.getBoundingClientRect();
    const left=a.left-b.left+a.width/2-24,top=a.top-b.top+a.height/2-36;
    const dx=(z.left+z.width/2)-(a.left+a.width/2),dy=(z.top+z.height/2)-(a.top+a.height/2);
    setShownActionFrame(null);
    setFlight({id:cue.id,left,top,dx,dy,duration:clip.frameDurationMs*clip.actionFrame,started:false,...(cue.cardId?{cardId:cue.cardId as CardId}:{})});
    const id=requestAnimationFrame(()=>setFlight(prev=>prev?.id===cue.id?{...prev,started:true}:prev));
    return()=>{cancelAnimationFrame(id);setFlight(null);};
  },[cue?.id,reducedMotion]);
  const onActionFrame=(id:string)=>{setShownActionFrame(id);setFlight(prev=>prev?.id===id?null:prev);
    if(!reducedMotion&&cue?.id===id&&cue.clip==='play_card'&&cue.cardId===view.topDiscard.id)
      setImpact(`${view.roundNumber}:${view.turnId}:${view.topDiscard.id}`);
  };
  const isHumanTurn = view.phase === 'human_turn';
  const plays = new Set(view.legalActions.filter((a): a is Extract<LegalAction,{type:'play_card'}>=>a.type==='play_card').map(a=>a.cardId));
  const canPlay = selected !== null && plays.has(selected);
  const canDraw = view.legalActions.some(a=>a.type==='draw_card');
  const canFinish = view.legalActions.some(a=>a.type==='finish_turn');
  const canPass = view.legalActions.some(a=>a.type==='pass_turn');
  function playFromHand() {
    if(selected&&canPlay&&!reducedMotion){
      const tile=handRef.current?.querySelector<HTMLButtonElement>(`[data-testid="card-${selected}"]`);
      const rect=tile?.getBoundingClientRect();
      if(rect)humanOrigin.current={cardId:selected,left:rect.left,top:rect.top,width:rect.width,height:rect.height};
    }
    onPlay();
  }
  const currentPose: MochiClipName = view.phase === 'match_end' || view.phase === 'round_end'
    ? view.roundResult?.winner === 'ai' ? 'victory' : view.roundResult?.winner === 'human' ? 'defeat' : 'idle'
    : view.phase === 'ai_thinking' ? 'thinking' : 'idle';
  function navigate(current: number, offset: -1 | 1) {
    const buttons = Array.from(handRef.current?.querySelectorAll<HTMLButtonElement>('.card-tile') ?? []);
    const length = buttons.length;
    if (!length) return;
    buttons[(current + offset + length) % length]?.focus();
  }
  return <main className="gameplay-page md4-cardroom" data-testid="gameplay-screen">
    <header className="game-hud md4-hud"><div className="hud-brand">MEOW<span>DECK</span></div>
      <div className="hud-round">{t('round')} <strong data-testid="round-number">{view.roundNumber}</strong></div>
      <div className="hud-score"><span>{t('you')}</span><strong data-testid="human-score">{view.scores.human}</strong><span className="score-sep">:</span><strong data-testid="mochi-score">{view.scores.ai}</strong><span>{t('mochi')}</span></div>
      <button className="pixel-button button-secondary pause-btn" type="button" onClick={onPause} aria-label={t('pause')} data-testid="pause-button">Ⅱ</button>
    </header>
    <div className="table-frame md4-table-frame"><div className="game-table md4-table" ref={tableRef}>
      
      <section className="opponent-area md4-opponent" aria-label={t('mochiHand')}>
        <div className="opponent-persona"><div className="opponent-avatar"><Mochi pose={currentPose} cue={cue} size="small" t={t} reducedMotion={reducedMotion} paused={paused} onCueDone={onCueDone} onCueActionFrame={onActionFrame} onPet={onPet}/></div><div className="opponent-title"><h2>MOCHI</h2><div className="difficulty-name">{t(difficulty)}</div></div></div>
        <div className="opponent-cards" data-testid="ai-hand"><div className="opponent-card-fan" ref={enemyRef} aria-hidden="true">{Array.from({length:Math.min(view.handCounts.ai,7)},(_,i)=><CardBack key={i} small label={t('mochiHand')} />)}</div>
          <div className="hand-count"><b data-testid="ai-card-count">{view.handCounts.ai}</b> {t('cards')}</div></div>
      </section>
      {flight && <div key={flight.id} aria-hidden="true" data-testid="mochi-card-flight" className="p3-card-flight"
        style={{left:flight.left,top:flight.top,transitionDuration:`${flight.duration}ms`,transform:flight.started?`translate(${flight.dx}px,${flight.dy}px)`:'translate(0px,0px)'}}>
          <img className="pixel-art" src={flight.cardId?cardImage(flight.cardId,true):cardImage('card_back',true)} alt="" />
      </div>}
      {humanFlight&&<div key={humanFlight.id} aria-hidden="true" className="p3-card-flight md-human-card-flight" data-testid="human-card-flight" onTransitionEnd={()=>setHumanFlight(null)}
        style={{left:humanFlight.left,top:humanFlight.top,width:humanFlight.width,height:humanFlight.height,transitionDuration:'310ms',
          transform:humanFlight.started?`translate(${humanFlight.dx}px,${humanFlight.dy}px) rotate(-5deg)`:'translate(0px,0px)'}}>
        <img className="pixel-art" src={cardImage(humanFlight.cardId,true)} alt="" />
      </div>}
      <section className="table-center md4-table-center" aria-label={t('discard')}>
        <div className="pile-group"><span className="pile-label">{t('draw')}</span><div className="draw-pile" ref={drawRef}><button type="button" className="draw-pile-action" onClick={onDraw} disabled={!canDraw} aria-label={t('drawCard')}><CardBack label={t('deck')}/></button><span className="pile-count" data-testid="draw-count">{view.drawPileCount}</span></div></div>
        <div className="table-center-symbol" aria-hidden="true">✦</div>
        <div className="pile-group"><span className="pile-label">{t('discard')}</span><div className="discard-pile" ref={discardRef} data-testid="top-discard"><img className="pixel-art card-image" style={((cue?.clip==='play_card'&&cue.cardId===view.topDiscard.id&&shownActionFrame!==cue.id&&!reducedMotion)||(humanFlight?.cardId===view.topDiscard.id))?{visibility:'hidden'}:undefined} src={cardImage(view.topDiscard.id, true)} alt={`${view.topDiscard.rank} ${SUIT_SYMBOL[view.topDiscard.suit]}`} />{impact&&<span key={impact} className={view.topDiscard.rank==='8'?`md-card-impact md-wild-impact md-wild-${SUIT_CLASS[view.activeSuit]}`:'md-card-impact'} aria-hidden="true" onAnimationEnd={()=>setImpact(null)}/>}</div></div>
        <div className="active-suit"><span>{t('activeSuit')}</span><strong className={`suit-${SUIT_CLASS[view.activeSuit]}`} data-testid="active-suit" aria-label={t(({ S:'spades', H:'hearts', D:'diamonds', C:'clubs' } as const)[view.activeSuit])}>{SUIT_SYMBOL[view.activeSuit]}</strong></div>
      </section>
      <div className={`turn-banner ${isHumanTurn?'your-turn':'opponent-turn'}`} aria-live="polite" data-testid="turn-status"><span className="md-turn-dot" aria-hidden="true"/><strong>{isHumanTurn?t('yourTurn'):t('mochiTurn')}</strong></div>
      <section className="player-area md4-player-area" aria-label={t('yourHand')}>
        <div className="hand-title"><span>{t('yourHand')}</span><span className="hand-count">{view.ownHand.length}</span></div>
        <div className={`player-hand ${handMotion?'md-hand-drawn':''}`} ref={handRef} data-testid="player-hand" onAnimationEnd={()=>setHandMotion(null)}>{view.ownHand.map((card,i)=><PixelCard key={card.id} card={card} t={t} playable={plays.has(card.id)} selected={selected===card.id} disabled={!isHumanTurn||!plays.has(card.id)} onSelect={()=>onSelect(card.id)} onNavigate={(direction)=>navigate(i,direction)}/>)}</div>
        <div className="scroll-hint">{t('zoomHint')}</div>
      </section>
    </div></div>
    <footer className={`action-footer md4-control-rail ${tutorialHint?'has-tutorial':''}`}><div className="action-status" aria-live="polite" role="status">{error?<span className="status-error">{t('invalidAction')}: {error}</span>:
        tutorialHint?<div className="tutorial-guide" data-testid="tutorial-hint"><span>{tutorialHint}</span><button type="button" data-testid="tutorial-skip" onClick={onSkipTutorial}>{t('tutorialSkip')}</button></div>:gameHint(view,t)}</div>
      <div className="action-buttons"><button className="pixel-button button-primary" type="button" data-testid="play-selected" onClick={playFromHand} disabled={!isHumanTurn||!canPlay}>{selected?t('playCard'):t('selectCard')} <span aria-hidden="true">❯</span></button>
        {canDraw && <button className="pixel-button button-cream" type="button" onClick={onDraw} data-testid="draw-card">{t('drawCard')}</button>}
        {canFinish && <button className="pixel-button button-cream" type="button" onClick={onFinish} data-testid="finish-turn">{t('endTurn')}</button>}
        {canPass && <button className="pixel-button button-cream" type="button" onClick={onPass} data-testid="pass-turn">{t('passTurn')}</button>}
      </div></footer>
  </main>;
}

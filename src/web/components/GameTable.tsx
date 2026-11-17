import { useRef } from 'react';
import type { CardId } from '../../games/meowdeck/core/cards.js';
import type { PublicGameState } from '../../games/meowdeck/games/crazy-eights/selectors.js';
import type { Card } from '../../games/meowdeck/core/cards.js';
import type { LegalAction } from '../../games/meowdeck/core/game-types.js';
import { SUIT_SYMBOL, SUIT_CLASS, cardImage, type MochiPose } from '../game/assets.js';
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
}

function gameHint(view: HumanView, t: T): string {
  if (view.phase === 'round_end' || view.phase === 'match_end') return t('roundResult');
  if (view.currentActor === 'ai') return t('mochiTurn');
  if (view.hasPendingDrawDecision) return t('finishHint');
  if (view.legalActions.some(a=>a.type==='draw_card')) return t('drawHint');
  if (view.legalActions.some(a=>a.type==='pass_turn')) return t('passHint');
  return t('pickCard');
}

export function GameTable({ view, t, selected, onSelect, onPlay, onDraw, onFinish, onPass, onPause, error }: GameTableProps) {
  const handRef = useRef<HTMLDivElement | null>(null);
  const isHumanTurn = view.phase === 'human_turn';
  const plays = new Set(view.legalActions.filter((a): a is Extract<LegalAction,{type:'play_card'}>=>a.type==='play_card').map(a=>a.cardId));
  const canPlay = selected !== null && plays.has(selected);
  const canDraw = view.legalActions.some(a=>a.type==='draw_card');
  const canFinish = view.legalActions.some(a=>a.type==='finish_turn');
  const canPass = view.legalActions.some(a=>a.type==='pass_turn');
  const currentPose: MochiPose = view.phase === 'match_end' || view.phase === 'round_end'
    ? view.roundResult?.winner === 'ai' ? 'victory' : view.roundResult?.winner === 'human' ? 'defeat' : 'idle'
    : view.phase === 'ai_thinking' ? 'thinking' : 'idle';
  function navigate(current: number, offset: -1 | 1) {
    const buttons = Array.from(handRef.current?.querySelectorAll<HTMLButtonElement>('.card-tile') ?? []);
    const length = buttons.length;
    if (!length) return;
    buttons[(current + offset + length) % length]?.focus();
  }
  return <main className="gameplay-page" data-testid="gameplay-screen">
    <header className="game-hud"><div className="hud-brand">MEOW<span>DECK</span> <span className="hud-star">✦</span></div>
      <div className="hud-round">{t('round')} <strong data-testid="round-number">{view.roundNumber}</strong></div>
      <div className="hud-score"><span>{t('you')}</span><strong data-testid="human-score">{view.scores.human}</strong><span className="score-sep">:</span><strong data-testid="mochi-score">{view.scores.ai}</strong><span>{t('mochi')}</span></div>
      <button className="pixel-button button-secondary pause-btn" type="button" onClick={onPause} data-testid="pause-button">⚙ <span>{t('pause')}</span></button>
    </header>
    <div className="table-frame"><div className="game-table">
      <div className="table-corner corner-tl">✦</div><div className="table-corner corner-tr">✦</div><div className="table-corner corner-bl">✦</div><div className="table-corner corner-br">✦</div>
      <section className="opponent-area" aria-label={t('mochiHand')}>
        <div className="opponent-persona"><div className="opponent-avatar"><Mochi pose={currentPose} size="small" t={t}/></div><div className="opponent-title"><span className="character-eyebrow">THE CARD MASTER</span><h2>MOCHI <span>✦</span></h2><div className="character-subtitle" aria-live="polite">{view.currentActor === 'ai' ? t('mochiTurn') : t('gameMochi')}</div></div></div>
        <div className="opponent-cards" data-testid="ai-hand"><div className="opponent-card-fan" aria-hidden="true">{Array.from({length:Math.min(view.handCounts.ai,7)},(_,i)=><CardBack key={i} small label={t('mochiHand')} />)}</div>
          <div className="hand-count">{t('mochi')} · <b data-testid="ai-card-count">{view.handCounts.ai}</b> {t('cards')}</div></div>
      </section>
      <div className="center-ornament"><span>◆</span> MEOWDECK <span>◆</span></div>
      <section className="table-center" aria-label={t('discard')}>
        <div className="pile-group"><span className="pile-label">{t('draw')}</span><div className="draw-pile"><CardBack label={t('deck')}/><span className="pile-count" data-testid="draw-count">{view.drawPileCount}</span></div></div>
        <div className="table-center-symbol">✦</div>
        <div className="pile-group"><span className="pile-label">{t('discard')}</span><div className="discard-pile" data-testid="top-discard"><img className="pixel-art card-image" src={cardImage(view.topDiscard.id, true)} alt={`${view.topDiscard.rank} ${SUIT_SYMBOL[view.topDiscard.suit]}`} /></div></div>
        <div className="active-suit"><span>{t('activeSuit')}</span><strong className={`suit-${SUIT_CLASS[view.activeSuit]}`} data-testid="active-suit" aria-label={t(({ S:'spades', H:'hearts', D:'diamonds', C:'clubs' } as const)[view.activeSuit])}>{SUIT_SYMBOL[view.activeSuit]}</strong></div>
      </section>
      <div className={`turn-banner ${isHumanTurn?'your-turn':'opponent-turn'}`} aria-live="polite" data-testid="turn-status"><span className="turn-glimmer">✦</span><strong>{isHumanTurn?t('yourTurn'):t('mochiTurn')}</strong><span className="turn-glimmer">✦</span></div>
      <section className="player-area" aria-label={t('yourHand')}>
        <div className="hand-title"><span>✦ {t('yourHand')}</span><span className="hand-count">{view.ownHand.length} {t('cards')}</span></div>
        <div className="player-hand" ref={handRef} data-testid="player-hand">{view.ownHand.map((card,i)=><PixelCard key={card.id} card={card} t={t} playable={plays.has(card.id)} selected={selected===card.id} disabled={!isHumanTurn||!plays.has(card.id)} onSelect={()=>onSelect(card.id)} onNavigate={(direction)=>navigate(i,direction)}/>)}</div>
        <div className="scroll-hint">{t('zoomHint')}</div>
      </section>
    </div></div>
    <footer className="action-footer"><div className="action-status" aria-live="polite" role="status">{error?<span className="status-error">{t('invalidAction')}: {error}</span>:gameHint(view,t)}</div>
      <div className="action-buttons"><button className="pixel-button button-primary" type="button" data-testid="play-selected" onClick={onPlay} disabled={!isHumanTurn||!canPlay}>{t('playCard')} <span>❯</span></button>
        {canDraw && <button className="pixel-button button-cream" type="button" onClick={onDraw} data-testid="draw-card">{t('drawCard')}</button>}
        {canFinish && <button className="pixel-button button-cream" type="button" onClick={onFinish} data-testid="finish-turn">{t('endTurn')}</button>}
        {canPass && <button className="pixel-button button-cream" type="button" onClick={onPass} data-testid="pass-turn">{t('passTurn')}</button>}
      </div></footer>
  </main>;
}

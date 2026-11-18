import { useState } from 'react';
import type { T } from '../i18n.js';
import type { Difficulty } from '../../games/meowdeck/ai/strategies.js';
import type { SavedMatchV1 } from '../storage/save-schema.js';
import { Mochi } from './Mochi.js';
import { CardBack } from './PixelCard.js';
import { cardImage } from '../game/assets.js';

interface MenuProps {
  t: T;
  hasMatch: boolean;
  onPlay: () => void;
  onContinue: () => void;
  onSettings: () => void;
  onStatistics: () => void;
  onRules: () => void;
  saved?: SavedMatchV1 | null;
  preferredDifficulty?: Difficulty;
}

/** Title-screen composition: game logo, the real opponent, and one clear start action. */
export function MainMenu({ t, hasMatch, onPlay, onContinue, onSettings, onStatistics, onRules, saved }: MenuProps) {
  return <main className="menu-page md4-title-screen" data-testid="main-menu">
    <header className="md4-menu-header">
      <span className="md4-menu-edition" aria-hidden="true">♣　MOCHI'S CARD ROOM</span>
      <nav className="md4-menu-tools" aria-label={t('settings')}>
        <button type="button" className="md4-text-button" onClick={onRules}>{t('rules')}</button>
        <button type="button" className="md4-text-button" onClick={onSettings}>{t('settings')}</button>
      </nav>
    </header>
    <div className="md4-title-composition">
      <div className="md4-title-mark">
        <span className="md4-title-ornament" aria-hidden="true">✦　♣　✦</span>
        <h1 className="brand-title"><span>MEOW</span><span>DECK</span></h1>
        <span className="md4-title-suits" aria-hidden="true">♠ <i>♥</i> ♦ <i>♣</i></span>
      </div>
      <div className="md4-title-diorama" aria-label={t('mochiAppearance')}>
        <div className="md4-title-halo" aria-hidden="true"/>
        <div className="md4-title-mochi"><Mochi t={t} size="large"/></div>
        <div className="md4-title-table" aria-hidden="true"/>
        <div className="md4-title-card md4-card-left" aria-hidden="true"><img className="pixel-art" src={cardImage('8H', true)} alt=""/></div>
        <div className="md4-title-card md4-card-back" aria-hidden="true"><CardBack label={t('deck')}/></div>
        <div className="md4-title-card md4-card-right" aria-hidden="true"><img className="pixel-art" src={cardImage('AS', true)} alt=""/></div>
      </div>
      <div className="md4-title-choices">
        <button type="button" className="pixel-button button-primary button-xl md4-start" onClick={onPlay} data-testid="play-now"><span>{t('play')}</span><span aria-hidden="true">›</span></button>
        {hasMatch && <button type="button" className="md4-resume" onClick={onContinue} data-testid="continue">{t('continue')}{saved && <span> · {t('round')} {saved.gameState.roundNumber}</span>}</button>}
        <button type="button" className="md4-text-button md4-stats-link" onClick={onStatistics}>{t('statistics')}</button>
      </div>
    </div>
    <footer className="md4-menu-footer"><span>MEOWDECK</span><span>01 / CRAZY EIGHTS</span></footer>
  </main>;
}

export function GameSelection({ t, onBack, onNext }: { t:T; onBack:()=>void; onNext:()=>void }) {
  return <main className="selection-page md4-selection-page" data-testid="game-selection">
    <header className="md4-section-header"><button className="md4-text-button" type="button" onClick={onBack}>‹ {t('back')}</button><span>MEOWDECK / 01</span></header>
    <div className="md4-selection-scene">
      <div className="md4-scene-head"><span aria-hidden="true">♣　01　♣</span><h1>{t('gameSelect')}</h1></div>
      <button className="md4-game-token" type="button" onClick={onNext} data-testid="select-crazy-eights">
        <span className="md4-token-art" aria-hidden="true">
          <img className="pixel-art" src={cardImage('8H', true)} alt=""/>
          <img className="pixel-art" src={cardImage('8S', true)} alt=""/>
          <img className="pixel-art" src={cardImage('8D', true)} alt=""/>
        </span>
        <span className="md4-token-info"><strong>{t('crazyEights')}</strong><small>{t('crazyEightsDesc')}</small><em>{t('chooseDifficulty')}　›</em></span>
      </button>
      <span className="md4-scene-foot" aria-hidden="true">♠　♥　♦　♣</span>
    </div>
  </main>;
}

export function DifficultySelection({ t, onBack, onStart, preferredDifficulty='practice' }: { t:T; onBack:()=>void; onStart:(difficulty:Difficulty)=>void;preferredDifficulty?:Difficulty }) {
  const [selected,setSelected]=useState<Difficulty>(preferredDifficulty);
  const modes:readonly {id:Difficulty;key:'practice'|'easy'|'normal'|'hard'; desc:'practiceDesc'|'easyDesc'|'normalDesc'|'hardDesc'}[]=[
    {id:'practice',key:'practice',desc:'practiceDesc'},
    {id:'easy',key:'easy',desc:'easyDesc'},
    {id:'normal',key:'normal',desc:'normalDesc'},
    {id:'hard',key:'hard',desc:'hardDesc'}
  ];
  return <main className="selection-page md4-selection-page md4-difficulty-page" data-testid="difficulty-selection">
    <header className="md4-section-header"><button type="button" className="md4-text-button" onClick={onBack}>‹ {t('back')}</button><span>MEOWDECK / 02</span></header>
    <div className="md4-difficulty-scene">
      <div className="md4-scene-head"><span aria-hidden="true">♣　MOCHI　♣</span><h1>{t('chooseDifficulty')}</h1></div>
      <div className="md4-difficulty-mochi"><Mochi t={t} size="large"/></div>
      <div className="md4-mode-strip" role="group" aria-label={t('chooseDifficulty')}>
        {modes.map(mode=><button key={mode.id} type="button" className={`md4-mode ${selected===mode.id?'is-active':''}`} data-testid={`difficulty-${mode.id}`} aria-pressed={selected===mode.id} onClick={()=>setSelected(mode.id)}>
          <strong>{t(mode.key)}</strong>
        </button>)}
      </div>
      <p className="md4-mode-description">{t(modes.find(mode=>mode.id===selected)!.desc)}</p>
      <button type="button" className="pixel-button button-primary button-xl md4-difficulty-start" onClick={()=>onStart(selected)} data-testid="start-match">{t('start')} <span aria-hidden="true">›</span></button>
    </div>
  </main>;
}

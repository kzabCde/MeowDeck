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

/** The menu is a game title screen, not a marketing landing page. */
export function MainMenu({ t, hasMatch, onPlay, onContinue, onSettings, onStatistics, onRules, saved }: MenuProps) {
  return <main className="menu-page md-title-screen" data-testid="main-menu">
    <header className="menu-topbar">
      <span className="brand-mini" aria-hidden="true">MD / 01</span>
      <nav className="top-actions" aria-label={t('settings')}>
        <button className="link-button" onClick={onRules}>{t('rules')}</button>
        <button className="link-button" onClick={onSettings}>{t('settings')}</button>
      </nav>
    </header>
    <div className="menu-stage">
      <section className="menu-copy">
        <h1 className="brand-title">MEOW<span>DECK</span></h1>
        <p className="tagline">{t('subtitle')}</p>
        <div className="menu-buttons">
          <button className="pixel-button button-primary button-xl" onClick={onPlay} data-testid="play-now">
            {t('play')} <span aria-hidden="true">▶</span>
          </button>
          {hasMatch && <button className="pixel-button button-cream md-continue" onClick={onContinue} data-testid="continue">
            {t('continue')}{saved ? <span className="md-progress"> · {t('round')} {saved.gameState.roundNumber}</span> : null}
          </button>}
          <div className="menu-secondary">
            <button className="link-button" onClick={onStatistics}>{t('statistics')}</button>
            <button className="link-button" onClick={onSettings}>{t('settings')}</button>
          </div>
        </div>
      </section>
      <div className="menu-scene" aria-label={t('mochiAppearance')}>
        <div className="hero-mochi"><Mochi size="large" t={t}/></div>
        <div className="hero-felt" aria-hidden="true">
          <div className="hero-card hc-1"><img className="pixel-art" src={cardImage('AH', true)} alt="" /></div>
          <div className="hero-card hc-2"><img className="pixel-art" src={cardImage('8S', true)} alt="" /></div>
          <div className="hero-card hc-3"><CardBack label={t('deck')} /></div>
        </div>
      </div>
    </div>
    <footer className="menu-footer"><span>MEOWDECK</span><span>CRAZY EIGHTS · 01</span></footer>
  </main>;
}

export function GameSelection({ t, onBack, onNext }: { t:T; onBack:()=>void; onNext:()=>void }) {
  return <main className="selection-page md-selection-page" data-testid="game-selection">
    <header className="section-nav"><button className="link-button" onClick={onBack}>‹ {t('back')}</button><span>MEOWDECK</span></header>
    <div className="selection-head"><h1>{t('gameSelect')}</h1></div>
    <div className="selection-grid">
      <button className="game-option available-option" type="button" onClick={onNext} data-testid="select-crazy-eights">
        <div className="selection-card-art" aria-hidden="true">
          <img className="pixel-art" src={cardImage('8H', true)} alt="" />
          <img className="pixel-art" src={cardImage('KS', true)} alt="" />
        </div>
        <div className="md-game-option-copy">
          <strong>{t('crazyEights')}</strong>
          <span className="option-desc">{t('crazyEightsDesc')}</span>
          <span className="option-cta">{t('playNow')} ›</span>
        </div>
      </button>
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
  return <main className="selection-page difficulty-page md-selection-page" data-testid="difficulty-selection">
    <header className="section-nav"><button className="link-button" onClick={onBack}>‹ {t('back')}</button><span>MEOWDECK</span></header>
    <div className="selection-head"><h1>{t('chooseDifficulty')}</h1></div>
    <div className="difficulty-card p3-difficulty-card">
      <Mochi t={t} size="large" />
      <div className="difficulty-info">
        <h2>{t(selected)}</h2>
        <p>{t(modes.find(x=>x.id===selected)!.desc)}</p>
        <button className="pixel-button button-primary button-xl" onClick={()=>onStart(selected)} data-testid="start-match">{t('start')} ›</button>
      </div>
    </div>
    <div className="p3-difficulty-options" role="group" aria-label={t('chooseDifficulty')}>
      {modes.map(mode=><button key={mode.id} type="button" className={`p3-difficulty-option ${selected===mode.id?'is-active':''}`} data-testid={`difficulty-${mode.id}`} aria-pressed={selected===mode.id} onClick={()=>setSelected(mode.id)}>
        <strong>{t(mode.key)}</strong><span>{t(mode.desc)}</span>
      </button>)}
    </div>
  </main>;
}

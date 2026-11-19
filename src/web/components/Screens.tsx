import { useState } from 'react';
import type { T } from '../i18n.js';
import type { Difficulty } from '../../games/meowdeck/ai/strategies.js';
import type { SavedMatchV1 } from '../storage/save-schema.js';
import { Mochi } from './Mochi.js';
import { CardBack } from './PixelCard.js';
import { GameButton } from './GameButton.js';
import { cardImage } from '../game/assets.js';

interface MenuProps {
  t: T;
  reducedMotion?:boolean;
  hasMatch: boolean;
  onPlay: () => void;
  onContinue: () => void;
  onSettings: () => void;
  onStatistics: () => void;
  onRules: () => void;
  saved?: SavedMatchV1 | null;
  preferredDifficulty?: Difficulty;
}

/** Play-first title screen: one room, real card sprites and Mochi, no passive status copy. */
export function MainMenu({ t, hasMatch, onPlay, onContinue, onSettings, onStatistics, onRules, saved, reducedMotion=false }: MenuProps) {
  return <main className="menu-page title-screen md4-title-screen" data-testid="main-menu">
    <header className="md4-menu-header">
      <nav className="md4-menu-tools" aria-label={t('mainMenu')}>
        <GameButton variant="text" onClick={onRules}>{t('rules')}</GameButton>
        <GameButton variant="text" onClick={onSettings}>{t('settings')}</GameButton>
      </nav>
    </header>
    <div className="md4-title-composition">
      <div className="md4-title-mark">
        <h1 className="brand-title"><span>MEOW</span><span>DECK</span></h1>
      </div>
      <div className="md4-title-diorama" data-testid="title-scene">
        <div className="md4-title-room" aria-hidden="true"/>
        <div className="md4-title-mochi"><Mochi t={t} size="large" reducedMotion={reducedMotion}/></div>
        <div className="md4-title-table" aria-hidden="true"/>
        <div className="md4-title-card md4-card-left" aria-hidden="true"><img className="pixel-art" src={cardImage('8H', true)} alt=""/></div>
        <div className="md4-title-card md4-card-back" aria-hidden="true"><CardBack label={t('deck')}/></div>
        <div className="md4-title-card md4-card-right" aria-hidden="true"><img className="pixel-art" src={cardImage('AS', true)} alt=""/></div>
      </div>
      <div className="md4-title-choices">
        <GameButton variant="primary" className="button-xl md4-start" onClick={onPlay} data-testid="play-now"><span>{t('play')}</span><span aria-hidden="true">›</span></GameButton>
        {hasMatch && <GameButton variant="text" className="md4-resume" onClick={onContinue} data-testid="continue">{t('continue')}{saved && <span> · {t('round')} {saved.gameState.roundNumber}</span>}</GameButton>}
        <GameButton variant="text" className="md4-stats-link" onClick={onStatistics}>{t('statistics')}</GameButton>
      </div>
    </div>
  </main>;
}

/** Two games, one card room: concise rules beside actual card artwork. */
export function GameSelection({t,onBack,onCrazyEights,onBlackjack}:{
  t:T;onBack:()=>void;onCrazyEights:()=>void;onBlackjack:()=>void;
}){
  return <main className="selection-page selection-screen game-choices md4-selection-page md5-game-choice" data-testid="game-selection">
    <header className="md4-section-header">
      <GameButton variant="text" onClick={onBack}>‹ {t('back')}</GameButton>
      <span>MEOWDECK</span>
    </header>
    <section className="md5-choice-scene" aria-labelledby="game-select-title">
      <div className="md4-scene-head"><h1 id="game-select-title">{t('gameSelect')}</h1></div>
      <div className="md5-choice-grid" data-testid="game-choice-list">
        <button type="button" className="md5-choice-tile" data-testid="select-crazy-eights" onClick={onCrazyEights}>
          <span className="md5-choice-art" aria-hidden="true">
            <img className="pixel-art" src={cardImage('8H',true)} alt=""/>
            <img className="pixel-art" src={cardImage('8S',true)} alt=""/>
            <img className="pixel-art" src={cardImage('8D',true)} alt=""/>
          </span>
          <span className="md5-choice-copy"><strong>{t('crazyEights')}</strong><span>{t('crazyEightsDesc')}</span></span>
        </button>
        <button type="button" className="md5-choice-tile" data-testid="select-blackjack" onClick={onBlackjack}>
          <span className="md5-choice-art" aria-hidden="true">
            <img className="pixel-art" src={cardImage('AS',true)} alt=""/>
            <img className="pixel-art" src={cardImage('KH',true)} alt=""/>
            <img className="pixel-art" src={cardImage('card_back',true)} alt=""/>
          </span>
          <span className="md5-choice-copy"><strong>{t('blackjack')}</strong><span>{t('blackjackDesc')}</span></span>
        </button>
      </div>
    </section>
  </main>;
}

/** Four existing opponent behaviors, with Mochi as the focus and tactile game choices. */
export function DifficultySelection({t,onBack,onStart,preferredDifficulty='practice',reducedMotion=false}:{
  t:T;onBack:()=>void;onStart:(difficulty:Difficulty)=>void;preferredDifficulty?:Difficulty;reducedMotion?:boolean;
}){
  const [selected,setSelected]=useState<Difficulty>(preferredDifficulty);
  const modes:readonly {id:Difficulty;key:'practice'|'easy'|'normal'|'hard';desc:'practiceDesc'|'easyDesc'|'normalDesc'|'hardDesc'}[]=[
    {id:'practice',key:'practice',desc:'practiceDesc'},
    {id:'easy',key:'easy',desc:'easyDesc'},
    {id:'normal',key:'normal',desc:'normalDesc'},
    {id:'hard',key:'hard',desc:'hardDesc'}
  ];
  const description=modes.find(mode=>mode.id===selected)!.desc;
  return <main className="selection-page selection-screen difficulty-screen md4-selection-page md4-difficulty-page" data-testid="difficulty-selection">
    <header className="md4-section-header">
      <GameButton variant="text" onClick={onBack}>‹ {t('back')}</GameButton>
      <span>MEOWDECK</span>
    </header>
    <section className="md4-difficulty-scene" aria-labelledby="opponent-select-title">
      <div className="md4-scene-head"><h1 id="opponent-select-title">{t('chooseDifficulty')}</h1></div>
      <div className="md4-difficulty-stage">
        <div className="md4-difficulty-mochi"><Mochi t={t} size="large" reducedMotion={reducedMotion}/></div>
        <div className="md4-difficulty-controls">
          <div className="md4-mode-strip" role="group" aria-label={t('chooseDifficulty')} aria-describedby="difficulty-description">
            {modes.map(mode=><button key={mode.id} type="button"
              className={`md4-mode ${selected===mode.id?'is-active':''}`}
              data-testid={`difficulty-${mode.id}`} aria-pressed={selected===mode.id}
              onClick={()=>setSelected(mode.id)}><strong>{t(mode.key)}</strong></button>)}
          </div>
          <p id="difficulty-description" className="md4-mode-description" aria-live="polite">{t(description)}</p>
          <GameButton variant="primary" className="button-xl md4-difficulty-start"
            onClick={()=>onStart(selected)} data-testid="start-match">
            {t('start')} <span aria-hidden="true">›</span>
          </GameButton>
        </div>
      </div>
    </section>
  </main>;
}

import { useState } from 'react';
import type { T } from '../i18n.js';
import type { Difficulty } from '../../games/meowdeck/ai/strategies.js';
import type { SavedMatchV1 } from '../storage/save-schema.js';
import { Mochi } from './Mochi.js';
import { CardBack } from './PixelCard.js';
import { cardImage } from '../game/assets.js';

interface MenuProps { t: T; hasMatch: boolean; onPlay: () => void; onContinue: () => void; onSettings: () => void; onStatistics: () => void; onRules: () => void; saved?: SavedMatchV1 | null; preferredDifficulty?: Difficulty }
export function MainMenu({ t, hasMatch, onPlay, onContinue, onSettings, onStatistics, onRules, saved }: MenuProps) {
  return <main className="menu-page" data-testid="main-menu">
    <header className="menu-topbar"><div className="brand-mini">✦ MEOWDECK ✦</div><div className="top-actions"><button className="link-button" onClick={onRules}>{t('rules')}</button><button className="link-button" onClick={onSettings}>{t('settings')} ⚙</button></div></header>
    <div className="menu-stage">
      <div className="menu-copy"><span className="eyebrow">✦ PIXEL CARD ADVENTURE ✦</span><h1 className="brand-title">MEOW<span>DECK</span></h1><div className="tagline">{t('subtitle')}</div>
        <h2>{t('welcome')}</h2><p className="menu-intro">{t('intro')}</p>
        <div className="menu-buttons"><button className="pixel-button button-primary button-xl" onClick={onPlay} data-testid="play-now">{t('play')} <span>❯</span></button>
          {hasMatch && <><button className="pixel-button button-cream" onClick={onContinue} data-testid="continue">{t('continue')}</button>{saved && <p className="p4-save-summary" data-testid="save-summary">{t('savedRound')} {saved.gameState.roundNumber} · {saved.gameState.scores.human}:{saved.gameState.scores.ai} · {t(saved.difficulty)} · {t('savedAt')}: {new Date(saved.savedAt).toLocaleString()}</p>}</>}
          <div className="menu-secondary"><button className="pixel-button button-secondary" onClick={onStatistics}>{t('statistics')}</button><button className="pixel-button button-secondary" onClick={onSettings}>{t('settings')}</button></div>
        </div>
      </div>
      <div className="menu-scene"><div className="scene-sign">MOCHI'S <strong>CARD TABLE</strong></div>
        <div className="hero-mochi"><Mochi size="large" t={t}/><div className="speech speech-hero">{t('menuMochi')}</div></div>
        <div className="hero-felt"><div className="hero-card hc-1"><img className="pixel-art" src={cardImage('AH', true)} alt="Ace of Hearts" /></div><div className="hero-card hc-2"><img className="pixel-art" src={cardImage('8S', true)} alt="Eight of Spades" /></div><div className="hero-card hc-3"><CardBack label="Face-down card" /></div></div>
        <div className="scene-corner left">✧</div><div className="scene-corner right">✧</div>
      </div>
    </div><footer className="menu-footer"><span>© MEOWDECK</span><span>CRAZY EIGHTS · v0.4.0</span></footer>
  </main>;
}

export function GameSelection({ t, onBack, onNext }: { t:T; onBack:()=>void; onNext:()=>void }) {
  const coming = ['Blackjack', 'Gin Rummy', 'Five-Card Draw Poker'];
  return <main className="selection-page" data-testid="game-selection"><header className="section-nav"><button className="link-button" onClick={onBack}>‹ {t('back')}</button><div>MEOWDECK ✦</div></header>
    <div className="selection-head"><span className="eyebrow">01 / THE GAME</span><h1>{t('gameSelect')}</h1><p>{t('gameSelectSub')}</p></div>
    <div className="selection-grid"><button className="game-option available-option" type="button" onClick={onNext} data-testid="select-crazy-eights">
      <span className="option-badge">{t('available')}</span><div className="selection-card-art"><img className="pixel-art" src={cardImage('8H', true)} alt="" /><img className="pixel-art" src={cardImage('KS', true)} alt="" /></div>
      <strong>{t('crazyEights')}</strong><span className="option-desc">{t('crazyEightsDesc')}</span><span className="option-cta">{t('playNow')} ❯</span>
    </button>{coming.map(name=><div className="game-option unavailable-option" key={name} aria-disabled="true"><span className="option-badge">{t('comingSoon')}</span><div className="selection-placeholder">♠ ♣ ♥ ♦</div><strong>{name}</strong><span className="option-desc">{t('comingSoon')}</span></div>)}</div>
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
  return <main className="selection-page difficulty-page" data-testid="difficulty-selection"><header className="section-nav"><button className="link-button" onClick={onBack}>‹ {t('back')}</button><div>MEOWDECK ✦</div></header>
    <div className="selection-head"><span className="eyebrow">02 / THE OPPONENT</span><h1>{t('chooseDifficulty')}</h1></div>
    <div className="difficulty-card p3-difficulty-card"><Mochi t={t} size="large"/><div className="difficulty-info"><span className="eyebrow">MOCHI · THE CARD MASTER</span><h2>{t(selected)}</h2><p>{t(modes.find(x=>x.id===selected)!.desc)}</p>
    <button className="pixel-button button-primary button-xl" onClick={()=>onStart(selected)} data-testid="start-match">{t('start')} ❯</button></div></div>
    <div className="p3-difficulty-options" role="group" aria-label={t('chooseDifficulty')}>{modes.map(mode=><button key={mode.id} type="button" className={`p3-difficulty-option ${selected===mode.id?'is-active':''}`} data-testid={`difficulty-${mode.id}`} aria-pressed={selected===mode.id} onClick={()=>setSelected(mode.id)}><strong>{t(mode.key)}</strong><span>{t(mode.desc)}</span></button>)}</div>
  </main>;
}

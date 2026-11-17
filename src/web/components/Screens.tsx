import type { T } from '../i18n.js';
import { Mochi } from './Mochi.js';
import { CardBack } from './PixelCard.js';
import { cardImage } from '../game/assets.js';

interface MenuProps { t: T; hasMatch: boolean; onPlay: () => void; onContinue: () => void; onSettings: () => void; onStatistics: () => void; onRules: () => void }
export function MainMenu({ t, hasMatch, onPlay, onContinue, onSettings, onStatistics, onRules }: MenuProps) {
  return <main className="menu-page" data-testid="main-menu">
    <header className="menu-topbar"><div className="brand-mini">✦ MEOWDECK ✦</div><div className="top-actions"><button className="link-button" onClick={onRules}>{t('rules')}</button><button className="link-button" onClick={onSettings}>{t('settings')} ⚙</button></div></header>
    <div className="menu-stage">
      <div className="menu-copy"><span className="eyebrow">✦ PIXEL CARD ADVENTURE ✦</span><h1 className="brand-title">MEOW<span>DECK</span></h1><div className="tagline">{t('subtitle')}</div>
        <h2>{t('welcome')}</h2><p className="menu-intro">{t('intro')}</p>
        <div className="menu-buttons"><button className="pixel-button button-primary button-xl" onClick={onPlay} data-testid="play-now">{t('play')} <span>❯</span></button>
          {hasMatch && <button className="pixel-button button-cream" onClick={onContinue} data-testid="continue">{t('continue')}</button>}
          <div className="menu-secondary"><button className="pixel-button button-secondary" onClick={onStatistics}>{t('statistics')}</button><button className="pixel-button button-secondary" onClick={onSettings}>{t('settings')}</button></div>
        </div>
      </div>
      <div className="menu-scene"><div className="scene-sign">MOCHI'S <strong>CARD TABLE</strong></div>
        <div className="hero-mochi"><Mochi size="large" t={t}/><div className="speech speech-hero">{t('menuMochi')}</div></div>
        <div className="hero-felt"><div className="hero-card hc-1"><img className="pixel-art" src={cardImage('AH', true)} alt="Ace of Hearts" /></div><div className="hero-card hc-2"><img className="pixel-art" src={cardImage('8S', true)} alt="Eight of Spades" /></div><div className="hero-card hc-3"><CardBack label="Face-down card" /></div></div>
        <div className="scene-corner left">✧</div><div className="scene-corner right">✧</div>
      </div>
    </div><footer className="menu-footer"><span>© MEOWDECK</span><span>CRAZY EIGHTS · v0.2.0</span></footer>
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

export function DifficultySelection({ t, onBack, onStart }: { t:T; onBack:()=>void; onStart:()=>void }) {
  return <main className="selection-page difficulty-page" data-testid="difficulty-selection"><header className="section-nav"><button className="link-button" onClick={onBack}>‹ {t('back')}</button><div>MEOWDECK ✦</div></header>
    <div className="selection-head"><span className="eyebrow">02 / THE OPPONENT</span><h1>{t('chooseDifficulty')}</h1></div>
    <div className="difficulty-card"><Mochi t={t} size="large"/><div className="difficulty-info"><span className="eyebrow">MOCHI · THE CARD MASTER</span><h2>{t('practice')}</h2><p>{t('practiceDesc')}</p><button className="pixel-button button-primary button-xl" onClick={onStart} data-testid="start-match">{t('start')} ❯</button></div></div>
    <div className="difficulty-locked"><div>{t('normal')} <span>{t('aiLater')}</span></div><div>{t('hard')} <span>{t('aiLater')}</span></div></div>
  </main>;
}

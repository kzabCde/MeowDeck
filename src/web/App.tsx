'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { applyAction, createAIObservation, createMatch, getHumanView, type CardId, type GameAction, type GameState, type Suit } from '../games/meowdeck/index.js';
import { GameDialog } from './components/GameDialog.js';
import { Mochi } from './components/Mochi.js';
import { GameTable } from './components/GameTable.js';
import { DifficultySelection, GameSelection, MainMenu } from './components/Screens.js';
import { SUIT_SYMBOL, SUIT_CLASS, ensureCardAssets } from './game/assets.js';
import { choosePracticeMove } from './game/practice-opponent.js';
import { chooseAIMove, isLegalDecision, type Difficulty, type AIDecision } from '../games/meowdeck/ai/strategies.js';
import { secureRandomInt, type RandomInt } from '../games/meowdeck/core/random.js';
import { PresentationQueue, type PresentationCue } from '../games/meowdeck/presentation/mochi-animation.js';
import { cuesFromConfirmedEvents } from '../games/meowdeck/presentation/event-cues.js';
import { getTranslator, type Language } from './i18n.js';

type Screen = 'menu' | 'select' | 'difficulty' | 'game';
type Modal = 'pause' | 'settings' | 'rules' | 'statistics' | 'suit' | 'restart' | 'leave' | null;
const fourSuits: readonly Suit[] = ['S', 'H', 'D', 'C'];

function sessionId(): string { return crypto.randomUUID(); }
function qaSeededRandom(seed: number): (maxExclusive: number) => number {
  let state = seed >>> 0 || 1;
  return (max) => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) % max; };
}

export function App() {
  const [language, setLanguage] = useState<Language>('th');
  const [reducedMotion, setReducedMotion] = useState(false); // SSR and hydration start with the same value.
  const [screen, setScreen] = useState<Screen>('menu');
  const [modal, setModal] = useState<Modal>(null);
  const [selected, setSelected] = useState<CardId | null>(null);
  const [difficulty,setDifficulty]=useState<Difficulty>('practice');
  const [presentationCue,setPresentationCue]=useState<PresentationCue|null>(null);
  const [resultReady,setResultReady]=useState(false);
  const presentationQueue=useRef(new PresentationQueue());
  const petCooldown=useRef(-100000);
  const aiRng=useRef<RandomInt>(secureRandomInt);
  const [skipCosmetics,setSkipCosmetics]=useState(false); // QA query flags are read client-side, in dev only.
  const [session, setSession] = useState<GameState | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [assetStatus, setAssetStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [assetAttempt, setAssetAttempt] = useState(0);
  const sessionRef = useRef<GameState | null>(null);
  const actionCounterRef = useRef(0);
  const t = useMemo(() => getTranslator(language), [language]);
  const view = session ? getHumanView(session) : null;

  const clearPresentation=useCallback(()=>{presentationQueue.current.clear();setPresentationCue(null);setResultReady(false);},[]);
  const cueComplete=useCallback((id:string)=>{
    const was=presentationQueue.current.current;
    const next=presentationQueue.current.complete(id);
    if(was?.id!==id)return;
    setPresentationCue(next);
    if(!next && ['round_end','match_end'].includes(sessionRef.current?.phase??''))setResultReady(true);
  },[]);
  const petMochi=useCallback(()=>{
    const now=performance.now();
    if(now-petCooldown.current<1400||presentationQueue.current.count>0)return;
    petCooldown.current=now;
    const state=sessionRef.current;
    if(!state||state.phase==='ai_thinking')return;
    const id=`${state.sessionId}:pet:${Math.round(now)}`;
    presentationQueue.current.enqueue({id,clip:'pet_reaction',sessionId:state.sessionId,round:state.roundNumber,turn:state.turnId});
    setPresentationCue(presentationQueue.current.current);
  },[]);
  // Atomic controller. This is the only place that submits gameplay changes to P1.
  const dispatch = useCallback((action: GameAction): boolean => {
    const previous = sessionRef.current;
    if (!previous) return false;
    const result = applyAction(previous, action);
    if (!result.ok) { setLastError(result.error.code); return false; }
    sessionRef.current = result.state;
    setSession(result.state);
    setSelected(null);
    setLastError(null);
    if(action.type==='start_next_round'||action.type==='restart_match')clearPresentation();
    if(skipCosmetics){
      presentationQueue.current.clear();setPresentationCue(null);
      if(result.state.phase==='round_end'||result.state.phase==='match_end')setResultReady(true);
    }else{
      const cues=cuesFromConfirmedEvents({sessionId:previous.sessionId,round:previous.roundNumber,turn:previous.turnId,actionId:action.actionId},result.events);
      for(const cue of cues)presentationQueue.current.enqueue(cue);
      setPresentationCue(presentationQueue.current.current);
      if(['round_end','match_end'].includes(result.state.phase)&&cues.length===0&&presentationQueue.current.count===0)setResultReady(true);
    }
    return true;
  }, [clearPresentation,skipCosmetics]);

  const nextActionId = useCallback((current: GameState) => `${current.sessionId}:ui:${++actionCounterRef.current}`, []);
  const submit = useCallback((type: 'play_card' | 'draw_card' | 'finish_turn' | 'pass_turn', actor: 'human' | 'ai', cardId?: CardId, selectedSuit?: Suit): boolean => {
    const current = sessionRef.current;
    if (!current || current.currentActor !== actor || !['human_turn','ai_thinking'].includes(current.phase)) return false;
    const actionId = nextActionId(current);
    const common = { actor, expectedTurnId: current.turnId, actionId };
    const action: GameAction = type === 'play_card'
      ? { ...common, type, cardId: cardId!, ...(selectedSuit ? { selectedSuit } : {}) }
      : type === 'draw_card' ? { ...common, type }
      : type === 'finish_turn' ? { ...common, type }
      : { ...common, type };
    return dispatch(action);
  }, [dispatch, nextActionId]);

  const startMatch = useCallback((chosen:Difficulty='practice') => {
    const url = new URL(window.location.href);
    const seed = process.env.NODE_ENV === 'development' ? Number(url.searchParams.get('qaSeed')) : NaN;
    const state = Number.isSafeInteger(seed) && seed > 0
      ? createMatch({ sessionId: sessionId(), rng: qaSeededRandom(seed) })
      : createMatch({ sessionId: sessionId() });
    actionCounterRef.current = 0;
    aiRng.current=Number.isSafeInteger(seed)&&seed>0?qaSeededRandom(seed^0xD3CA1):secureRandomInt;
    setDifficulty(chosen);
    clearPresentation();
    sessionRef.current = state;
    setSession(state);
    setSelected(null);
    setLastError(null);
    setModal(null);
    setScreen('game');
  }, [clearPresentation]);

  // P3: strategy sees only sanitized AIObservation; the controller checks the live turn again.
  useEffect(()=>{
    if(screen!=='game'||modal||!session||session.phase!=='ai_thinking')return;
    if(!skipCosmetics && presentationCue && ['draw_card','play_card','victory','defeat'].includes(presentationCue.clip))return;
    const snapshot={sessionId:session.sessionId,round:session.roundNumber,turn:session.turnId,pending:session.pendingDrawnCardId};
    const delay=skipCosmetics?10:550;
    const timer=window.setTimeout(()=>{
      const state=sessionRef.current;
      if(!state||state.sessionId!==snapshot.sessionId||state.roundNumber!==snapshot.round||state.turnId!==snapshot.turn||state.pendingDrawnCardId!==snapshot.pending||state.phase!=='ai_thinking')return;
      const observation=createAIObservation(state);
      let decision:AIDecision;
      try {decision=difficulty==='practice'?choosePracticeMove(observation):chooseAIMove(difficulty,observation,aiRng.current);} catch(error){
        console.warn('AI strategy failed; using observable legal fallback',error);
        decision=choosePracticeMove(observation);
      }
      if(!isLegalDecision(observation,decision))return;
      const {action,selectedSuit}=decision;
      if(action.type==='play_card')submit('play_card','ai',action.cardId,selectedSuit);
      else if(action.type==='draw_card')submit('draw_card','ai');
      else if(action.type==='finish_turn')submit('finish_turn','ai');
      else submit('pass_turn','ai');
    },delay);
    return ()=>window.clearTimeout(timer);
  },[session,screen,modal,submit,difficulty,presentationCue?.id,skipCosmetics]);

  // Hydration-safe browser preferences. Do not access window or document during render.
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const onPreferenceChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener('change', onPreferenceChange);
    return () => media.removeEventListener('change', onPreferenceChange);
  }, []);
  useEffect(() => {
    // Production builds do not honor qaSeed or fastAI, even if query params exist.
    if (process.env.NODE_ENV === 'development') {
      setSkipCosmetics(new URLSearchParams(window.location.search).get('fastAI') === '1');
    }
  }, []);

  useEffect(() => {
    let active = true;
    ensureCardAssets().then(() => { if (active) setAssetStatus('ready'); })
      .catch(() => { if (active) setAssetStatus('error'); });
    return () => { active = false; };
  }, [assetAttempt]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => { document.documentElement.classList.toggle('reduce-motion', reducedMotion); }, [reducedMotion]);
  useEffect(() => { setSelected(null); }, [session?.turnId, session?.roundNumber]);

  function playSelected() {
    const current = sessionRef.current;
    if (!selected || !current || current.phase !== 'human_turn') return;
    const action = getHumanView(current).legalActions.find(a => a.type === 'play_card' && a.cardId === selected);
    if (!action || action.type !== 'play_card') return;
    if (action.requiresSuit) { setModal('suit'); return; }
    submit('play_card','human', selected);
  }
  function selectSuit(suit: Suit) {
    const current = sessionRef.current;
    if (!selected || !current) return;
    const success = submit('play_card', 'human', selected, suit);
    if (success) setModal(null);
  }
  function nextRound() {
    const current = sessionRef.current;
    if (!current) return;
    dispatch({ type: 'start_next_round', expectedRoundNumber: current.roundNumber, actionId: nextActionId(current) });
  }
  function restart() {
    const current = sessionRef.current;
    if (!current) { startMatch(); return; }
    const success = dispatch({ type: 'restart_match', newSessionId: sessionId(), actionId: nextActionId(current) });
    if (success) { actionCounterRef.current = 0; setScreen('game'); setModal(null); }
  }
  function goMenu() { clearPresentation();setModal(null); setScreen('menu'); }
  const isEnded = session?.phase === 'round_end' || session?.phase === 'match_end';
  const isMatchEnd = session?.phase === 'match_end';
  const modalOpen = Boolean(modal) || (screen === 'game' && isEnded);

  if (assetStatus !== 'ready') {
    return <main className="asset-loading" role="status" aria-live="polite">
      <div className="brand-mini">✦ MEOWDECK ✦</div>
      {assetStatus === 'loading' ? <p>Loading card artwork… / กำลังโหลดไพ่…</p>
        : <><p>Card artwork could not be loaded. / โหลดภาพไพ่ไม่สำเร็จ</p>
          <button className="pixel-button button-cream" onClick={() => { setAssetStatus('loading'); setAssetAttempt(n => n + 1); }}>Retry / ลองอีกครั้ง</button></>}
    </main>;
  }
  return <div className="meowdeck-app">
    {screen === 'menu' && <MainMenu t={t} hasMatch={!!session && !isEnded} onPlay={() => setScreen('select')} onContinue={() => setScreen('game')}
      onSettings={() => setModal('settings')} onStatistics={() => setModal('statistics')} onRules={() => setModal('rules')} />}
    {screen === 'select' && <GameSelection t={t} onBack={() => setScreen('menu')} onNext={() => setScreen('difficulty')} />}
    {screen === 'difficulty' && <DifficultySelection t={t} onBack={() => setScreen('select')} onStart={startMatch} />}
    {screen === 'game' && view && <GameTable view={view} t={t} selected={selected} onSelect={setSelected} onPlay={playSelected}
      onDraw={() => submit('draw_card','human')} onFinish={() => submit('finish_turn','human')}
      onPass={() => submit('pass_turn','human')} onPause={() => setModal('pause')} error={lastError}
      difficulty={difficulty} cue={presentationCue} reducedMotion={reducedMotion} paused={Boolean(modal)} onCueDone={cueComplete} onPet={petMochi} />}


    {modal === 'settings' && <GameDialog title={t('settings')} onClose={() => setModal(null)} t={t}>
      <label className="settings-field"><span>{t('language')}</span><select value={language} onChange={(e: ChangeEvent<HTMLSelectElement>)=>setLanguage(e.target.value as Language)} aria-label={t('language')}><option value="th">ไทย</option><option value="en">English</option></select></label>
      <label className="settings-toggle"><span><strong>{t('reducedMotion')}</strong><small>{t('reducedHelp')}</small></span><input type="checkbox" checked={reducedMotion} onChange={(e: ChangeEvent<HTMLInputElement>)=>setReducedMotion(e.target.checked)} /></label>
      <p className="modal-note">{t('settingsScope')}</p>
    </GameDialog>}
    {modal === 'rules' && <GameDialog title={t('rules')} onClose={() => setModal(null)} t={t}><p>{t('rulesIntro')}</p></GameDialog>}
    {modal === 'statistics' && <GameDialog title={t('statistics')} onClose={() => setModal(null)} t={t}><p>{t('statsLater')}</p></GameDialog>}
    {modal === 'pause' && <GameDialog title={t('gamePaused')} onClose={() => setModal(null)} t={t}>
      <div className="modal-buttons"><button className="pixel-button button-primary" onClick={() => setModal(null)}>{t('resume')}</button>
        <button className="pixel-button button-cream" onClick={() => setModal('settings')}>{t('settings')}</button>
        <button className="pixel-button button-secondary" onClick={() => setModal('restart')}>{t('restart')}</button>
        <button className="pixel-button button-secondary" onClick={() => setModal('leave')}>{t('leave')}</button></div>
    </GameDialog>}
    {modal === 'restart' && <GameDialog title={t('confirmRestart')} onClose={() => setModal('pause')} t={t}><p>{t('confirmRestartDesc')}</p>
      <div className="modal-inline"><button className="pixel-button button-secondary" onClick={() => setModal('pause')}>{t('cancel')}</button><button className="pixel-button button-primary" onClick={restart}>{t('confirm')}</button></div></GameDialog>}
    {modal === 'leave' && <GameDialog title={t('confirmLeave')} onClose={() => setModal('pause')} t={t}><p>{t('confirmLeaveDesc')}</p>
      <div className="modal-inline"><button className="pixel-button button-secondary" onClick={() => setModal('pause')}>{t('cancel')}</button><button className="pixel-button button-primary" onClick={goMenu}>{t('confirm')}</button></div></GameDialog>}
    {modal === 'suit' && <GameDialog title={t('chooseSuit')} onClose={() => setModal(null)} t={t} initialFocusSelector='[data-testid="suit-S"]'><p>{t('chooseSuitDesc')}</p>
      <div className="suit-picker">{fourSuits.map(suit=><button key={suit} type="button" data-testid={`suit-${suit}`} className={`suit-choice suit-${SUIT_CLASS[suit]}`} onClick={() => selectSuit(suit)}><span>{SUIT_SYMBOL[suit]}</span>{t(({ S:'spades', H:'hearts', D:'diamonds', C:'clubs' } as const)[suit])}</button>)}</div>
      <button className="pixel-button button-secondary dialog-bottom" onClick={() => setModal(null)}>{t('cancel')}</button>
    </GameDialog>}
    {screen === 'game' && isEnded && resultReady && session?.roundResult && !modal && <GameDialog title={isMatchEnd ? t('matchResult') : t('roundResult')} onClose={goMenu} t={t}>
      <div className="p3-result-mochi"><Mochi pose={session.roundResult.winner==='ai'?'victory':session.roundResult.winner==='human'?'defeat':'idle'} reducedMotion={reducedMotion} t={t} size="small" /></div><div className="result-crest">{session.roundResult.winner === 'human' ? '✦ ♛ ✦' : session.roundResult.winner === 'ai' ? '♣ ✦ ♣' : '♢ ♢ ♢'}</div>
      <h3 className="result-winner" data-testid="result-winner">{session.roundResult.winner === 'human' ? t('win') : session.roundResult.winner === 'ai' ? t('lose') : t('drawResult')}</h3>
      <div className="result-stats"><div><span>{t('matchScore')}</span><strong>{session.scores.human} — {session.scores.ai}</strong></div>
        <div><span>{t('penalties')}</span><strong>{session.roundResult.penalties.human} — {session.roundResult.penalties.ai}</strong></div>
        <div><span>{t('remaining')}</span><strong>{session.roundResult.handCounts.human} — {session.roundResult.handCounts.ai}</strong></div></div>
      <div className="modal-buttons">
        {isMatchEnd ? <button className="pixel-button button-primary" data-testid="rematch" onClick={restart}>{t('rematch')}</button>
          : <button className="pixel-button button-primary" data-testid="next-round" onClick={nextRound}>{t('nextRound')}</button>}
        <button className="pixel-button button-secondary" data-testid="result-menu" onClick={goMenu}>{t('mainMenu')}</button>
      </div>
    </GameDialog>}
    {modalOpen && <span className="sr-only" aria-live="polite">{t('pause')}</span>}
  </div>;
}

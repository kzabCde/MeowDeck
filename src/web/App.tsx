'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { applyAction, createAIObservation, createMatch, getHumanView, type CardId, type GameAction, type GameState, type Suit } from '../games/meowdeck/index.js';
import { GameDialog } from './components/GameDialog.js';
import { Mochi } from './components/Mochi.js';
import { GameTable } from './components/GameTable.js';
import { BlackjackGame } from './components/BlackjackGame.js';
import { DifficultySelection, GameSelection, MainMenu } from './components/Screens.js';
import { SUIT_SYMBOL, SUIT_CLASS, ensureCardAssets } from './game/assets.js';
import { choosePracticeMove } from './game/practice-opponent.js';
import { chooseAIMove, isLegalDecision, type Difficulty, type AIDecision } from '../games/meowdeck/ai/strategies.js';
import { secureRandomInt, type RandomInt } from '../games/meowdeck/core/random.js';
import { PresentationQueue, type PresentationCue } from '../games/meowdeck/presentation/mochi-animation.js';
import { cuesFromConfirmedEvents } from '../games/meowdeck/presentation/event-cues.js';
import { getTranslator, type Language } from './i18n.js';
import { LocalGameRepository, SaveError } from './storage/database.js';
import { makeSavedMatch, type SavedMatchV1 } from './storage/save-schema.js';
import { toMatchRecord, type MatchRecord } from './statistics/statistics-service.js';
import { StatisticsPanel } from './components/StatisticsPanel.js';
import { DEFAULT_SETTINGS, readSettings, writeSettings, resetSettings, resolveReducedMotion, type GameSettingsV1 } from './settings/settings-store.js';
import { GameAudio } from './audio/audio-manager.js';
import { setupPwa, type PwaController, type PwaState } from './pwa/service-worker-register.js';
import { DEFAULT_TUTORIAL, getTutorialHint, readTutorial, advanceTutorial, writeTutorial, type TutorialProgress } from './tutorial/tutorial.js';

type Screen = 'menu' | 'select' | 'difficulty' | 'game' | 'blackjack';
type Modal = 'pause' | 'settings' | 'rules' | 'statistics' | 'suit' | 'restart' | 'leave' | 'replace' | 'discard' | 'resetStats' | 'resetSettings' | 'storageConflict' | 'corrupt' | null;
const fourSuits: readonly Suit[] = ['S', 'H', 'D', 'C'];

function sessionId(): string { return crypto.randomUUID(); }
function qaSeededRandom(seed: number): (maxExclusive: number) => number {
  let state = seed >>> 0 || 1;
  return (max) => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) % max; };
}

export function App() {
  const [settings,setSettings]=useState<GameSettingsV1>(DEFAULT_SETTINGS);
  const [tutorial,setTutorial]=useState<TutorialProgress>(DEFAULT_TUTORIAL);
  const [tutorialReady,setTutorialReady]=useState(false);
  const [systemMotion,setSystemMotion]=useState(false);
  const language:Language=settings.language;
  const reducedMotion=resolveReducedMotion(settings.motion,systemMotion);
  const [storageReady,setStorageReady]=useState(false);
  const [saveStatus,setSaveStatus]=useState<'loading'|'saving'|'saved'|'error'|'unavailable'>('loading');
  const [savedMatch,setSavedMatch]=useState<SavedMatchV1|null>(null);
  const [records,setRecords]=useState<MatchRecord[]>([]);
  const [pwaStatus,setPwaStatus]=useState<PwaState>('unsupported');
  const [pwaUpdate,setPwaUpdate]=useState(false);
  const [pwaInstallable,setPwaInstallable]=useState(false);
  const [saveWarning,setSaveWarning]=useState<string|null>(null);
  const repositoryRef=useRef<LocalGameRepository|null>(null);
  const lastSavedRef=useRef<SavedMatchV1|null>(null);
  const writeQueue=useRef<Promise<void>>(Promise.resolve());
  const lastPersistSucceededRef=useRef(true);
  const audioRef=useRef<GameAudio|null>(null);
  const pwaRef=useRef<PwaController|null>(null);
  const canUpdateRef=useRef<()=>Promise<boolean>>(async()=>false);
  const replaceIntent=useRef<Difficulty>('practice');
  const storageConflictRef=useRef(false);
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
  const updateSettings=useCallback((change:Partial<GameSettingsV1>)=>{
    setSettings(current=>({...current,...change}));
  },[]);
  const queuePersist=useCallback((state:GameState,mode:Difficulty,sequence:number):Promise<void>=>{
    const repository=repositoryRef.current;
    if(!repository){setSaveStatus('unavailable');return Promise.resolve();}
    lastPersistSucceededRef.current=false;setSaveStatus('saving');
    const work=writeQueue.current.catch(()=>{}).then(async()=>{
      const previous=lastSavedRef.current;
      const record=state.phase==='match_end'?toMatchRecord(state,mode):undefined;
      const save=makeSavedMatch(state,mode,sequence,previous?.sessionId===state.sessionId?previous.revision:0);
      const committed=await repository.commit(save,record,previous?.sessionId!==state.sessionId);
      lastSavedRef.current=record?null:committed;
      setSavedMatch(record?null:committed);
      if(record)setRecords(await repository.records());
      lastPersistSucceededRef.current=true;setSaveStatus('saved');setSaveWarning(null);
    }).catch(error=>{
      lastPersistSucceededRef.current=false;setSaveStatus('error');setSaveWarning(error instanceof SaveError?error.kind:'transaction');
      if(error instanceof SaveError&&error.kind==='conflict'){storageConflictRef.current=true;setModal('storageConflict');}
    });
    writeQueue.current=work;return work;
  },[]);
  const playUi=useCallback((sound:'click'|'select'|'confirm'|'pet'='click')=>{void audioRef.current?.unlock();audioRef.current?.play(sound);},[]);
  const reloadRecords=useCallback(()=>{void repositoryRef.current?.records().then(setRecords).catch(()=>setSaveWarning('statistics'));},[]);
  useEffect(()=>{setTutorial(readTutorial());setTutorialReady(true);},[]);
  useEffect(()=>{if(tutorialReady)writeTutorial(tutorial);},[tutorial,tutorialReady]);

  useEffect(()=>{
    let alive=true;
    const audio=new GameAudio(DEFAULT_SETTINGS);audioRef.current=audio;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');setSystemMotion(media.matches);
    const preference=(event:MediaQueryListEvent)=>setSystemMotion(event.matches);
    media.addEventListener('change',preference);
    const onVisible=()=>audio.setVisible(!document.hidden);
    document.addEventListener('visibilitychange',onVisible);
    // Session storage survives refresh in the same tab, while separate tabs receive distinct owners.
    let owner:string;
    try{owner=sessionStorage.getItem('meowdeck:tab-owner')||crypto.randomUUID();sessionStorage.setItem('meowdeck:tab-owner',owner);}
    catch{owner=crypto.randomUUID();}
    const localSettings=readSettings();setSettings(localSettings);audio.setSettings(localSettings);
    void LocalGameRepository.create(owner).then(async repository=>{
      if(!alive){repository.close();return;}
      repositoryRef.current=repository;
      const [loaded,history]=await Promise.all([repository.load(),repository.records()]);
      if(!alive)return;
      setRecords(history);
      if(loaded.invalid){setModal('corrupt');setSaveWarning(loaded.reason??'invalid');}
      else if(loaded.save){lastSavedRef.current=loaded.save;setSavedMatch(loaded.save);}
      setStorageReady(true);setSaveStatus('saved');
    }).catch(()=>{if(alive){setStorageReady(true);setSaveStatus('unavailable');setSaveWarning('unavailable');}});
    const renew=window.setInterval(()=>{
      const repo=repositoryRef.current;
      if(!repo||!sessionRef.current||sessionRef.current.phase==='match_end')return;
      void repo.renew().then(ok=>{if(!ok&&alive){setSaveStatus('error');setSaveWarning('conflict');storageConflictRef.current=true;setModal('storageConflict');}}).catch(()=>{});
    },4000);
    return ()=>{alive=false;window.clearInterval(renew);media.removeEventListener('change',preference);
      document.removeEventListener('visibilitychange',onVisible);audio.dispose();audioRef.current=null;
      // Do not drop the lease on React Strict Mode's development unmount/remount cycle.
      // The same tab reuses its owner ID; another tab must claim after lease expiry or explicit takeover.
      const repo=repositoryRef.current;repositoryRef.current=null;repo?.close();
    };
  },[]);
  useEffect(()=>{audioRef.current?.setSettings(settings);if(storageReady&&!writeSettings(settings))setSaveWarning('settings');},[settings,storageReady]);
  canUpdateRef.current=async()=>{
    await writeQueue.current;
    const current=sessionRef.current,saved=lastSavedRef.current;
    if(!repositoryRef.current||!lastPersistSucceededRef.current)return false;
    if(current&&current.phase!=='match_end'&&(!saved||saved.sessionId!==current.sessionId||
      saved.gameState.processedActionIds.length!==current.processedActionIds.length))return false;
    return true;
  };
  useEffect(()=>{
    if(process.env.NODE_ENV!=='production')return;
    const pwa=setupPwa((status,update,installable)=>{setPwaStatus(status);setPwaUpdate(update);setPwaInstallable(installable);},()=>canUpdateRef.current());
    pwaRef.current=pwa;
    return ()=>{pwa.dispose();pwaRef.current=null;};
  },[]);


  const clearPresentation=useCallback(()=>{presentationQueue.current.clear();setPresentationCue(null);setResultReady(false);},[]);
  const cueComplete=useCallback((id:string)=>{
    const was=presentationQueue.current.current;
    const next=presentationQueue.current.complete(id);
    if(was?.id!==id)return;
    setPresentationCue(next);
    if(!next && ['round_end','match_end'].includes(sessionRef.current?.phase??''))setResultReady(true);
  },[]);
  const petMochi=useCallback(():boolean=>{
    const state=sessionRef.current,now=performance.now();
    // Only the player's turn accepts a pet. A rejected tap must not play SFX.
    if(!state||state.phase!=='human_turn'||presentationQueue.current.count>0||
       now-petCooldown.current<1400)return false;
    petCooldown.current=now;
    const id=`${state.sessionId}:pet:${Math.round(now)}`;
    presentationQueue.current.enqueue({id,clip:'pet_reaction',sessionId:state.sessionId,round:state.roundNumber,turn:state.turnId});
    setPresentationCue(presentationQueue.current.current);
    return true;
  },[]);
  // Atomic controller. This is the only place that submits gameplay changes to P1.
  const dispatch = useCallback((action: GameAction): boolean => {
    const previous = sessionRef.current;
    if (!previous || storageConflictRef.current) return false;
    const result = applyAction(previous, action);
    if (!result.ok) { setLastError(result.error.code); return false; }
    sessionRef.current = result.state;
    setSession(result.state);
    setSelected(null);
    setLastError(null);
    // Presentation hints change only after a real committed player move.
    if((action.type==='play_card'||action.type==='draw_card')&&action.actor==='human')
      setTutorial(progress=>advanceTutorial(progress,action.type,action.type==='play_card'?action.cardId:undefined));
    audioRef.current?.onEvents(result.events,`${previous.sessionId}:${action.actionId}`);
    void queuePersist(result.state,difficulty,action.type==='restart_match'?1:actionCounterRef.current+1);
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
  }, [clearPresentation,skipCosmetics,queuePersist,difficulty]);

  const nextActionId = useCallback((current: GameState) => `${current.sessionId}:ui:${++actionCounterRef.current}`, []);
  const submit = useCallback((type: 'play_card' | 'draw_card' | 'finish_turn' | 'pass_turn', actor: 'human' | 'ai', cardId?: CardId, selectedSuit?: Suit): boolean => {
    const current = sessionRef.current;
    if (!current || current.currentActor !== actor || !['human_turn','ai_thinking'].includes(current.phase)) return false;
    if(storageConflictRef.current)return false;
    const actionId = nextActionId(current);
    const common = { actor, expectedTurnId: current.turnId, actionId };
    const action: GameAction = type === 'play_card'
      ? { ...common, type, cardId: cardId!, ...(selectedSuit ? { selectedSuit } : {}) }
      : type === 'draw_card' ? { ...common, type }
      : type === 'finish_turn' ? { ...common, type }
      : { ...common, type };
    return dispatch(action);
  }, [dispatch, nextActionId]);

  const startMatch = useCallback((chosen:Difficulty='practice',confirmed=false) => {
    if(!storageReady)return;
    if(!confirmed && (savedMatch||sessionRef.current?.phase!=='match_end'&&sessionRef.current)){
      replaceIntent.current=chosen;setModal('replace');return;
    }
    playUi('confirm');
    const url=new URL(window.location.href);
    const seed=process.env.NODE_ENV==='development'?Number(url.searchParams.get('qaSeed')):NaN;
    const state=Number.isSafeInteger(seed)&&seed>0
      ?createMatch({sessionId:sessionId(),rng:qaSeededRandom(seed)})
      :createMatch({sessionId:sessionId()});
    actionCounterRef.current=0;
    aiRng.current=Number.isSafeInteger(seed)&&seed>0?qaSeededRandom(seed^0xD3CA1):secureRandomInt;
    setDifficulty(chosen);updateSettings({preferredDifficulty:chosen});
    clearPresentation();storageConflictRef.current=false;
    sessionRef.current=state;setSession(state);setSelected(null);setLastError(null);setModal(null);setScreen('game');
    void queuePersist(state,chosen,1);
  },[clearPresentation,playUi,queuePersist,savedMatch,storageReady,updateSettings]);

  const continueMatch=useCallback(async(force=false)=>{
    const repo=repositoryRef.current;if(!repo||!storageReady)return;
    playUi('confirm');
    try{
      const saved=await repo.claim(force);
      if(!saved)return;
      lastSavedRef.current=saved;setSavedMatch(saved);
      actionCounterRef.current=saved.nextActionSequence-1;
      aiRng.current=secureRandomInt;
      setDifficulty(saved.difficulty);clearPresentation();
      sessionRef.current=saved.gameState;setSession(saved.gameState);
      setResultReady(saved.gameState.phase==='round_end');setScreen('game');setModal(null);storageConflictRef.current=false;
      lastPersistSucceededRef.current=true;setSaveStatus('saved');setSaveWarning(null);
    }catch(error){setSaveWarning(error instanceof SaveError?error.kind:'invalid');
      if(error instanceof SaveError&&error.kind==='conflict'){setModal('storageConflict');storageConflictRef.current=true;}
      else setModal('corrupt');}
  },[clearPresentation,playUi,storageReady]);
  const discardSaved=useCallback(async()=>{
    const repo=repositoryRef.current;if(!repo)return;
    try{await writeQueue.current;await repo.discard();lastSavedRef.current=null;setSavedMatch(null);
      sessionRef.current=null;setSession(null);clearPresentation();setModal(null);setScreen('menu');setSaveStatus('saved');storageConflictRef.current=false;
    }catch{setSaveStatus('error');setSaveWarning('conflict');}
  },[clearPresentation]);


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
    playUi('confirm');
    const success = dispatch({ type: 'restart_match', newSessionId: sessionId(), actionId: nextActionId(current) });
    if (success) { actionCounterRef.current = 0; setScreen('game'); setModal(null); }
  }
  function goMenu() { playUi();clearPresentation();setModal(null);setScreen('menu'); }
  const tutorialHintKey=tutorialReady&&view?getTutorialHint(tutorial,{
    humanTurn:view.phase==='human_turn',
    legalPlay:view.legalActions.some(action=>action.type==='play_card'),
    legalDraw:view.legalActions.some(action=>action.type==='draw_card'),
    legalEight:view.legalActions.some(action=>action.type==='play_card'&&action.cardId.startsWith('8')),
    selected:selected!==null
  }):null;
  const isEnded = session?.phase === 'round_end' || session?.phase === 'match_end';
  const isMatchEnd = session?.phase === 'match_end';
  const modalOpen = Boolean(modal) || (screen === 'game' && isEnded);

  if (assetStatus !== 'ready' || !storageReady) {
    return <main className="asset-loading" role="status" aria-live="polite">
      <div className="brand-mini">✦ MEOWDECK ✦</div>
      {assetStatus === 'loading' || !storageReady ? <p>{t('saveLoading')}</p>
        : <><p>Card artwork could not be loaded. / โหลดภาพไพ่ไม่สำเร็จ</p>
          <button className="pixel-button button-cream" onClick={() => { setAssetStatus('loading'); setAssetAttempt(n => n + 1); }}>Retry / ลองอีกครั้ง</button></>}
    </main>;
  }
  return <div className="meowdeck-app">
    {(saveWarning || saveStatus==='error' || saveStatus==='unavailable' || pwaStatus==='failed') && <div className="p4-statusbar" role="status" aria-live="polite">
      {(saveWarning || saveStatus==='error' || saveStatus==='unavailable') && <span className="p4-status error" role="alert" data-testid="save-status">{t(saveWarning==='conflict'?'storageConflict':saveStatus==='unavailable'?'saveUnavailable':'saveFailed')}</span>}
      {process.env.NODE_ENV==='production' && pwaStatus==='failed' && <span className="p4-status error" role="alert" data-testid="offline-status">{t('offlineFailed')}</span>}
    </div>}
    {screen === 'menu' && <MainMenu t={t} reducedMotion={reducedMotion} hasMatch={!!savedMatch || (!!session && !isEnded)} saved={savedMatch} preferredDifficulty={settings.preferredDifficulty} onPlay={() => {playUi();setScreen('select');}} onContinue={() => {if(sessionRef.current&&sessionRef.current.phase!=='match_end'&&!storageConflictRef.current){setResultReady(sessionRef.current.phase==='round_end');setScreen('game');}else void continueMatch();}}
      onSettings={() => setModal('settings')} onStatistics={() => setModal('statistics')} onRules={() => setModal('rules')} />}
    {screen==='menu' && process.env.NODE_ENV==='production' && <div className="p4-install" style={{padding:'8px 24px 16px',margin:'0 auto'}}>
      {pwaInstallable&&<button className="pixel-button button-secondary" onClick={()=>{void pwaRef.current?.install();}}>{t('installApp')}</button>}
      {pwaUpdate&&<button className="pixel-button button-cream" onClick={()=>{void pwaRef.current?.update();}}>{t('updateApp')}</button>}
    </div>}
    {screen === 'select' && <GameSelection t={t} onBack={() => setScreen('menu')} onCrazyEights={() => {playUi();setScreen('difficulty');}} onBlackjack={() => {playUi();setScreen('blackjack');}} />}
    {screen === 'difficulty' && <DifficultySelection t={t} reducedMotion={reducedMotion} preferredDifficulty={settings.preferredDifficulty} onBack={() => setScreen('select')} onStart={startMatch} />}
    {screen === 'blackjack' && <BlackjackGame t={t} reducedMotion={reducedMotion} onBack={() => {playUi();setScreen('select');}}
      onSound={(sound) => {void audioRef.current?.unlock().then(()=>audioRef.current?.play(sound));}} />}
    {screen === 'game' && view && <GameTable view={view} t={t} selected={selected} onSelect={id=>{playUi('select');setSelected(current=>current===id?null:id);}} onPlay={playSelected}
      onDraw={() => {playUi('select');submit('draw_card','human');}} onFinish={() => {playUi('click');submit('finish_turn','human');}}
      onPass={() => {playUi();submit('pass_turn','human');}} onPause={() => {playUi();setModal('pause');}} error={lastError}
      difficulty={difficulty} cue={presentationCue} reducedMotion={reducedMotion} paused={Boolean(modal)} onCueDone={cueComplete} onPet={()=>{if(petMochi())playUi('pet');}}
      tutorialHint={tutorialHintKey?t(tutorialHintKey):null} onSkipTutorial={()=>setTutorial(current=>({...current,skipped:true}))} />}


    {modal === 'settings' && <GameDialog title={t('settings')} onClose={() => setModal(null)} t={t}>
      <div className="p4-settings" data-testid="persistent-settings">
        <label>{t('language')}<select value={settings.language} onChange={(e:ChangeEvent<HTMLSelectElement>)=>updateSettings({language:e.target.value as Language})}><option value="th">ไทย</option><option value="en">English</option></select></label>
        <label>{t('preferredDifficulty')}<select value={settings.preferredDifficulty} onChange={(e:ChangeEvent<HTMLSelectElement>)=>updateSettings({preferredDifficulty:e.target.value as Difficulty})}>{(['practice','easy','normal','hard'] as const).map(d=><option key={d} value={d}>{t(d)}</option>)}</select></label>
        <label className="p4-setting-check">{t('reducedMotion')}<input type="checkbox" checked={reducedMotion} onChange={(e:ChangeEvent<HTMLInputElement>)=>updateSettings({motion:e.target.checked?'on':'off'})}/></label>
        <label>{t('motionPreference')}<select data-testid="motion-setting" value={settings.motion} onChange={(e:ChangeEvent<HTMLSelectElement>)=>updateSettings({motion:e.target.value as GameSettingsV1['motion']})}><option value="system">{t('motionSystem')}</option><option value="on">{t('motionOn')}</option><option value="off">{t('motionOff')}</option></select></label>
        <label className="p4-setting-check">{t('soundEffects')}<input type="checkbox" data-testid="sfx-toggle" checked={settings.sfxEnabled} onChange={(e:ChangeEvent<HTMLInputElement>)=>updateSettings({sfxEnabled:e.target.checked})}/></label>
        <label>{t('sfxVolume')}<input type="range" min="0" max="1" step="0.05" data-testid="sfx-volume" value={settings.sfxVolume} onChange={(e:ChangeEvent<HTMLInputElement>)=>updateSettings({sfxVolume:Number(e.target.value)})}/></label>
        <label className="p4-setting-check">{t('music')}<input type="checkbox" data-testid="music-toggle" checked={settings.musicEnabled} onChange={(e:ChangeEvent<HTMLInputElement>)=>{
          const enabled=e.target.checked;
          // Apply inside this user gesture: mobile browsers may reject a deferred audio.play().
          playUi();
          audioRef.current?.setSettings({...settings,musicEnabled:enabled});
          if(enabled)void audioRef.current?.unlock();
          updateSettings({musicEnabled:enabled});
        }}/></label>
        <label>{t('musicVolume')}<input type="range" min="0" max="1" step="0.05" data-testid="music-volume" value={settings.musicVolume} onChange={(e:ChangeEvent<HTMLInputElement>)=>updateSettings({musicVolume:Number(e.target.value)})}/></label>
        <button className="pixel-button button-secondary" onClick={()=>setModal('resetSettings')}>{t('resetSettings')}</button>
        {!!savedMatch && <button className="pixel-button button-secondary" data-testid="discard-match" onClick={()=>setModal('discard')}>{t('discardMatch')}</button>}
      </div>
    </GameDialog>}
    {modal === 'rules' && <GameDialog title={t('rules')} onClose={() => setModal(null)} t={t}><p>{t('rulesIntro')}</p>
      <button className="pixel-button button-secondary" data-testid="tutorial-replay-rules" onClick={()=>{setTutorial({...DEFAULT_TUTORIAL});setModal(null);}}>{t('tutorialReplay')}</button>
    </GameDialog>}
    {modal === 'statistics' && <GameDialog title={t('statistics')} onClose={() => setModal(null)} t={t} wide><StatisticsPanel records={records} t={t} onReset={()=>setModal('resetStats')}/></GameDialog>}
    {modal === 'pause' && <GameDialog title={t('gamePaused')} onClose={() => setModal(null)} t={t}>
      <div className="modal-buttons"><button className="pixel-button button-primary" onClick={() => setModal(null)}>{t('resume')}</button>
        <button className="pixel-button button-cream" onClick={() => setModal('settings')}>{t('settings')}</button>
        <button className="pixel-button button-secondary" data-testid="tutorial-replay" onClick={()=>{setTutorial({...DEFAULT_TUTORIAL});setModal(null);}}>{t('tutorialReplay')}</button>
        <button className="pixel-button button-secondary" onClick={() => setModal('restart')}>{t('restart')}</button>
        <button className="pixel-button button-secondary" onClick={() => setModal('leave')}>{t('leave')}</button></div>
    </GameDialog>}
    {modal === 'restart' && <GameDialog title={t('confirmRestart')} onClose={() => setModal('pause')} t={t}><p>{t('confirmRestartDesc')}</p>
      <div className="modal-inline"><button className="pixel-button button-secondary" onClick={() => setModal('pause')}>{t('cancel')}</button><button className="pixel-button button-primary" onClick={restart}>{t('confirm')}</button></div></GameDialog>}
    {modal === 'leave' && <GameDialog title={t('confirmLeave')} onClose={() => setModal('pause')} t={t}><p>{t('confirmLeaveDesc')}</p>
      <div className="modal-inline"><button className="pixel-button button-secondary" onClick={() => setModal('pause')}>{t('cancel')}</button><button className="pixel-button button-primary" onClick={goMenu}>{t('confirm')}</button></div></GameDialog>}
    {modal === 'replace' && <GameDialog title={t('replaceMatch')} t={t} onClose={()=>setModal(null)}><p>{t('replaceWarning')}</p><div className="modal-inline"><button className="pixel-button button-secondary" onClick={()=>setModal(null)}>{t('cancel')}</button><button className="pixel-button button-primary" onClick={()=>startMatch(replaceIntent.current,true)}>{t('confirm')}</button></div></GameDialog>}
    {modal === 'discard' && <GameDialog title={t('discardMatch')} t={t} onClose={()=>setModal('settings')}><p>{t('discardConfirm')}</p><div className="modal-inline"><button className="pixel-button button-secondary" onClick={()=>setModal('settings')}>{t('cancel')}</button><button className="pixel-button button-primary" onClick={()=>{void discardSaved();}}>{t('confirm')}</button></div></GameDialog>}
    {modal === 'resetStats' && <GameDialog title={t('resetStatistics')} t={t} onClose={()=>setModal('statistics')}><p>{t('resetStatsConfirm')}</p><div className="modal-inline"><button className="pixel-button button-secondary" onClick={()=>setModal('statistics')}>{t('cancel')}</button><button className="pixel-button button-primary" onClick={()=>{void repositoryRef.current?.resetStatistics().then(()=>{reloadRecords();setModal('statistics');}).catch(()=>setSaveWarning('statistics'));}}>{t('confirm')}</button></div></GameDialog>}
    {modal === 'resetSettings' && <GameDialog title={t('resetSettings')} t={t} onClose={()=>setModal('settings')}><p>{t('resetSettingsConfirm')}</p><div className="modal-inline"><button className="pixel-button button-secondary" onClick={()=>setModal('settings')}>{t('cancel')}</button><button className="pixel-button button-primary" onClick={()=>{resetSettings();updateSettings(DEFAULT_SETTINGS);setModal('settings');}}>{t('confirm')}</button></div></GameDialog>}
    {modal === 'storageConflict' && <GameDialog title={t('storageConflict')} t={t} onClose={()=>{setModal(null);setScreen('menu');}}><p>{t('storageConflict')}</p><div className="modal-inline"><button className="pixel-button button-secondary" onClick={()=>{setModal(null);setScreen('menu');}}>{t('cancel')}</button><button className="pixel-button button-primary" onClick={()=>{void continueMatch(true);}}>{t('takeOver')}</button></div></GameDialog>}
    {modal === 'corrupt' && <GameDialog title={t('corruptSave')} t={t} onClose={()=>setModal(null)}><p>{t('corruptSave')}</p><button className="pixel-button button-secondary" onClick={()=>{void discardSaved();}}>{t('recoverSave')}</button></GameDialog>}
    {modal === 'suit' && <GameDialog title={t('chooseSuit')} onClose={() => setModal(null)} t={t} initialFocusSelector='[data-testid="suit-S"]'>
      <div className="suit-picker">{fourSuits.map(suit=><button key={suit} type="button" data-testid={`suit-${suit}`} className={`suit-choice suit-${SUIT_CLASS[suit]}`} onClick={() => selectSuit(suit)}><span>{SUIT_SYMBOL[suit]}</span>{t(({ S:'spades', H:'hearts', D:'diamonds', C:'clubs' } as const)[suit])}</button>)}</div>
      <button className="pixel-button button-secondary dialog-bottom" onClick={() => setModal(null)}>{t('cancel')}</button>
    </GameDialog>}
    {screen === 'game' && isEnded && resultReady && session?.roundResult && !modal && <GameDialog title={isMatchEnd ? t('matchResult') : t('roundResult')} onClose={goMenu} t={t}>
      <div className="p3-result-mochi"><Mochi pose={session.roundResult.winner==='ai'?'victory':session.roundResult.winner==='human'?'defeat':'idle'} reducedMotion={reducedMotion} t={t} size="small" /></div>
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

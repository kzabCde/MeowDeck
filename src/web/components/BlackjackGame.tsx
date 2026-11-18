import {useCallback,useEffect,useRef,useState} from 'react';
import {applyBlackjackAction,getBlackjackView,startBlackjack,validateBlackjackSave,
  type BlackjackAction,type BlackjackState,type BlackjackOutcome} from '../../games/meowdeck/games/blackjack/rules.js';
import {secureRandomInt,type RandomInt} from '../../games/meowdeck/core/random.js';
import {cardImage} from '../game/assets.js';
import {Mochi} from './Mochi.js';
import {CardBack} from './PixelCard.js';
import {GameDialog} from './GameDialog.js';
import type {T} from '../i18n.js';
import type {SoundName} from '../audio/audio-manager.js';
import type {Card} from '../../games/meowdeck/core/cards.js';

const SAVE_KEY='meowdeck:blackjack:1';
function storedGame():BlackjackState|null{
 try{const text=localStorage.getItem(SAVE_KEY);return text?validateBlackjackSave(JSON.parse(text) as unknown):null;}
 catch{return null;}
}
function qaRandom():RandomInt{
 // Never expose a deterministic gameplay seed in a production build.
 if(process.env.NODE_ENV!=='development')return secureRandomInt;
 const seed=new URLSearchParams(location.search).get('qaSeed');
 const n=Number(seed);
 if(!seed||!Number.isSafeInteger(n)||n<1)return secureRandomInt;
 let value=n>>>0;
 return (max:number)=>{
   value^=value<<13;value^=value>>>17;value^=value<<5;
   return (value>>>0)%max;
 };
}
function Face({card}:{card:Card}){
 return <img className="pixel-art md5-bj-card-face" draggable={false} alt={`${card.rank} ${card.suit}`} src={cardImage(card.id,true)}/>;
}
function Score({label,count,testId}:{label:string;count:number;testId:string}){
 return <span className="md5-bj-score"><span>{label}</span><strong data-testid={testId}>{count}</strong></span>;
}
function soundFor(result:BlackjackState,action:BlackjackAction['type']):SoundName{
 if(result.phase==='finished'){
   return result.outcome==='human'?'win':result.outcome==='dealer'?'lose':'confirm';
 }
 return action==='hit'?'draw':'confirm';
}
const outcomeKeys={
 human:'bjPlayerWins',dealer:'bjDealerWins',push:'bjPush'
} as const;
const reasonKeys={
 player_natural:'bjPlayerNatural',dealer_natural:'bjDealerNatural',
 both_natural:'bjBothNatural',player_bust:'bjPlayerBust',dealer_bust:'bjDealerBust',
 higher_total:'bjHigherHand',equal_total:'bjEqualHand'
} as const;

export function BlackjackGame({t,onBack,onSound,reducedMotion}:{
 t:T;onBack:()=>void;onSound:(sound:SoundName)=>void;reducedMotion:boolean;
}){
 const [state,setState]=useState<BlackjackState|null>(null);
 const stateRef=useRef<BlackjackState|null>(null);
 const rngRef=useRef<RandomInt>(secureRandomInt);
 const [hydrated,setHydrated]=useState(false);
 const [storageError,setStorageError]=useState(false);
 const [externalChange,setExternalChange]=useState(false);
 const [rulesOpen,setRulesOpen]=useState(false);
 const [resetOpen,setResetOpen]=useState(false);
 useEffect(()=>{
   rngRef.current=qaRandom();
   const saved=storedGame();
   const initial=saved??startBlackjack(rngRef.current);
   stateRef.current=initial;setState(initial);setHydrated(true);
 },[]);
 useEffect(()=>{
   if(!hydrated||!state||externalChange)return;
   try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));setStorageError(false);}
   catch{setStorageError(true);}
 },[state,hydrated,externalChange]);
 useEffect(()=>{
   const onExternal=(event:StorageEvent)=>{
     if(event.storageArea===localStorage&&(event.key===SAVE_KEY||event.key===null))setExternalChange(true);
   };
   window.addEventListener('storage',onExternal);
   return ()=>window.removeEventListener('storage',onExternal);
 },[]);
 const perform=useCallback((type:BlackjackAction['type'])=>{
   const current=stateRef.current;
   if(!current||externalChange)return;
   const action:BlackjackAction={type,expectedRevision:current.revision,actionId:crypto.randomUUID()};
   const result=applyBlackjackAction(current,action,rngRef.current);
   if(!result.ok)return;
   stateRef.current=result.state;setState(result.state);
   onSound(soundFor(result.state,type));
 },[onSound,externalChange]);
 const reset=useCallback(()=>{
   const fresh=startBlackjack(rngRef.current);
   stateRef.current=fresh;setState(fresh);setResetOpen(false);
   onSound('confirm');
 },[onSound]);
 const reload=()=>{
   const latest=storedGame()??startBlackjack(rngRef.current);
   stateRef.current=latest;setState(latest);setExternalChange(false);
 };
 if(!hydrated||!state)return <main className="md5-blackjack" role="status">{t('saveLoading')}</main>;
 const view=getBlackjackView(state);
 const outcome:BlackjackOutcome|null=view.outcome;
 const mochiPose=view.phase==='finished'
   ?outcome==='dealer'?'victory':outcome==='human'?'defeat':'idle'
   :'idle';
 return <main className="md5-blackjack" data-testid="blackjack-screen">
   <header className="md5-bj-header">
     <button type="button" onClick={onBack} className="md4-text-button" data-testid="blackjack-back">‹ {t('back')}</button>
     <div className="md5-bj-brand"><span>MEOWDECK</span><strong>BLACKJACK</strong></div>
     <div className="md5-bj-tools">
       <button type="button" onClick={()=>setRulesOpen(true)} className="md4-text-button" data-testid="blackjack-rules">{t('rules')}</button>
     </div>
   </header>
   <div className="md5-bj-scorebar" aria-label={t('bjSeriesScore')}>
     <span className="md5-bj-round">{t('round')} {view.round}</span>
     <div className="md5-bj-score-pips">
       <Score label={t('you')} count={view.score.human} testId="blackjack-wins"/>
       <span aria-hidden="true" className="md5-bj-score-sep">✦</span>
       <Score label={t('bjPush')} count={view.score.pushes} testId="blackjack-pushes"/>
       <span aria-hidden="true" className="md5-bj-score-sep">✦</span>
       <Score label={t('mochi')} count={view.score.dealer} testId="blackjack-losses"/>
     </div>
   </div>
   <div className="md5-bj-frame">
     <div className="md5-bj-felt">
       <section className="md5-bj-dealer" aria-label={t('bjDealer')}>
         <div className="md5-bj-dealer-head">
           <Mochi pose={mochiPose} t={t} size="small" reducedMotion={reducedMotion}/>
           <div className="md5-bj-hand-head">
             <span>{t('bjDealer')}</span>
             <strong data-testid="blackjack-dealer-total">{view.dealerTotal??t('bjHidden')}</strong>
           </div>
         </div>
         <div className="md5-bj-hand" data-testid="blackjack-dealer-hand">
           {view.dealerCards.map((card,index)=><span key={card?.id??'hole'} className="md5-bj-slot">
             {card?<Face card={card}/>:<CardBack label={t('bjHiddenCard')}/>}
           </span>)}
         </div>
       </section>
       <div className="md5-bj-table-mark" aria-hidden="true"><span>♠　♥　♦　♣</span></div>
       <section className="md5-bj-player" aria-label={t('yourHand')}>
         <div className="md5-bj-hand-head md5-bj-player-label">
           <span>{t('you')}</span>
           <strong data-testid="blackjack-player-total">{view.playerTotal}</strong>
         </div>
         <div className="md5-bj-hand" data-testid="blackjack-player-hand">
           {view.player.map(card=><span key={card.id} className="md5-bj-slot"><Face card={card}/></span>)}
         </div>
       </section>
     </div>
   </div>
   <footer className="md5-bj-actions">
     {externalChange && <div role="alert" className="md5-bj-warning">
       {t('bjExternalChange')}
       <button className="pixel-button button-cream" onClick={reload} data-testid="blackjack-reload">{t('bjReload')}</button>
     </div>}
     {storageError && <p className="md5-bj-storage-warning" role="alert">{t('saveFailed')}</p>}
     {view.phase==='finished'&&outcome&&view.reason
       ?<div className="md5-bj-result" role="status" data-testid="blackjack-result">
         <strong>{t(outcomeKeys[outcome])}</strong>
         <span>{t(reasonKeys[view.reason])}</span>
       </div>
       :<div className="md5-bj-instruction">{t('bjYourMove')}</div>}
     <div className="md5-bj-action-row">
       {view.phase==='player'
         ?<>
           <button className="pixel-button button-primary" type="button" disabled={!view.canHit||externalChange} onClick={()=>perform('hit')} data-testid="blackjack-hit">{t('bjHit')}</button>
           <button className="pixel-button button-cream" type="button" disabled={!view.canStand||externalChange} onClick={()=>perform('stand')} data-testid="blackjack-stand">{t('bjStand')}</button>
         </>
         :<>
           <button className="pixel-button button-primary" type="button" disabled={externalChange} onClick={()=>perform('next_round')} data-testid="blackjack-next">{t('nextRound')}</button>
           <button className="pixel-button button-secondary" type="button" onClick={()=>setResetOpen(true)} data-testid="blackjack-new-series">{t('bjNewSeries')}</button>
         </>}
     </div>
   </footer>
   {rulesOpen&&<GameDialog title={t('bjRulesTitle')} t={t} onClose={()=>setRulesOpen(false)}>
     <p>{t('bjRulesText')}</p>
   </GameDialog>}
   {resetOpen&&<GameDialog title={t('bjNewSeries')} t={t} onClose={()=>setResetOpen(false)}>
     <p>{t('bjNewSeriesConfirm')}</p>
     <div className="modal-inline">
       <button className="pixel-button button-secondary" onClick={()=>setResetOpen(false)}>{t('cancel')}</button>
       <button className="pixel-button button-primary" onClick={reset} data-testid="blackjack-confirm-reset">{t('confirm')}</button>
     </div>
   </GameDialog>}
 </main>;
}

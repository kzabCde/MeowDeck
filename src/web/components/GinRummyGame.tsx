import {useCallback,useEffect,useMemo,useRef,useState,type DragEvent} from 'react';
import type {Card,CardId,Actor} from '../../games/meowdeck/core/cards.js';
import {secureRandomInt} from '../../games/meowdeck/core/random.js';
import {applyGinAction,evaluateGinHand,startGinRummy,validateGinSave,type GinActionType,type GinDifficulty,type GinState} from '../../games/meowdeck/games/gin-rummy/rules.js';
import {chooseGinMove,createGinObservation} from '../../games/meowdeck/games/gin-rummy/ai.js';
import {cardImage} from '../game/assets.js';
import {cardLabel,CardBack} from './PixelCard.js';
import {Mochi} from './Mochi.js';
import {GameButton} from './GameButton.js';
import {GameDialog} from './GameDialog.js';
import type {T} from '../i18n.js';
import type {SoundName} from '../audio/audio-manager.js';
import type {PresentationCue} from '../../games/meowdeck/presentation/mochi-animation.js';

const SAVE_KEY='meowdeck:gin-rummy:1',MODE_KEY='meowdeck:gin-rummy:difficulty';
const RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const rankOrder=(c:Card)=>RANKS.indexOf(c.rank);
const soundFor=(type:GinActionType,after:GinState):SoundName=>
 after.result?.winner==='human'?'win':after.result?.winner==='ai'?'lose':
 (type==='draw_stock'||type==='draw_discard'||type==='take_open')?'draw':'confirm';
function readSave():GinState|null{
 try{const raw=localStorage.getItem(SAVE_KEY);return raw?validateGinSave(JSON.parse(raw) as unknown):null;}catch{return null;}
}
function readMode():GinDifficulty{
 try{const raw=localStorage.getItem(MODE_KEY);return raw==='easy'||raw==='hard'?raw:'normal';}catch{return 'normal';}
}
function GinCard({card,t,selected=false,disabled=false,onClick,onDragStart,onDrop}:{card:Card;t:T;selected?:boolean;disabled?:boolean;onClick?:()=>void;
 onDragStart?:(e:DragEvent<HTMLButtonElement>)=>void;onDrop?:(e:DragEvent<HTMLButtonElement>)=>void}){
 return <button className={'md-gin-card'+(selected?' is-selected':'')} type="button" disabled={disabled} onClick={onClick}
   draggable={Boolean(onDragStart)} onDragStart={onDragStart} onDragOver={onDrop?e=>e.preventDefault():undefined} onDrop={onDrop}
   data-testid={'gin-card-'+card.id} aria-pressed={selected} aria-label={cardLabel(card,t)}>
   <img className="pixel-art" draggable={false} src={cardImage(card.id,true)} alt=""/>
 </button>;
}
export function GinRummyGame({t,onBack,onSound,reducedMotion}:{
 t:T;onBack:()=>void;onSound:(sound:SoundName)=>void;reducedMotion:boolean
}){
 const [hydrated,setHydrated]=useState(false);
 const [state,setState]=useState<GinState|null>(null);
 const stateRef=useRef<GinState|null>(null);
 const [difficulty,setDifficulty]=useState<GinDifficulty>('normal');
 const [selected,setSelected]=useState<CardId|null>(null);
 const [order,setOrder]=useState<CardId[]>([]);
 const [rulesOpen,setRulesOpen]=useState(false);
 const [resetOpen,setResetOpen]=useState(false);
 const [storageError,setStorageError]=useState(false);
 const [externalChange,setExternalChange]=useState(false);
 const [cue,setCue]=useState<PresentationCue|null>(null);
 const headingRef=useRef<HTMLHeadingElement|null>(null);
 useEffect(()=>{
  const saved=readSave();setState(saved);stateRef.current=saved;setDifficulty(readMode());
  setHydrated(true);
 },[]);
 useEffect(()=>{
  if(!hydrated||!state||externalChange)return;
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));localStorage.setItem(MODE_KEY,difficulty);setStorageError(false);}
  catch{setStorageError(true);}
 },[state,difficulty,hydrated,externalChange]);
 useEffect(()=>{
  const update=(event:StorageEvent)=>{
   if(event.storageArea===localStorage&&(event.key===SAVE_KEY||event.key===null))setExternalChange(true);
  };
  window.addEventListener('storage',update);return ()=>window.removeEventListener('storage',update);
 },[]);
 useEffect(()=>{if(hydrated)headingRef.current?.focus({preventScroll:true});},[hydrated]);
 useEffect(()=>{setSelected(null);},[state?.revision]);
 const begin=()=>{
  const next=startGinRummy(secureRandomInt,secureRandomInt(2)===0?'ai':'human',stateRef.current?.stats);
  stateRef.current=next;setState(next);setSelected(null);setOrder([]);setExternalChange(false);
  onSound('confirm');
 };
 const perform=useCallback((type:GinActionType,actor:Actor='human',cardId?:CardId)=>{
  const current=stateRef.current;
  if(!current||externalChange)return;
  const result=applyGinAction(current,{type,actor,...(cardId?{cardId}:{}),expectedRevision:current.revision,actionId:crypto.randomUUID()},secureRandomInt);
  if(!result.ok)return;
  const next=result.state;stateRef.current=next;setState(next);
  const eventClip=next.result
    ?next.result.winner==='ai'?'victory':next.result.winner==='human'?'defeat':'surprise'
    :actor==='ai'?(type==='draw_stock'||type==='draw_discard'||type==='take_open'?'draw_card':'play_card'):null;
  if(eventClip)setCue({id:'gin:'+next.handNumber+':'+next.revision,clip:eventClip,sessionId:'gin-rummy',round:next.handNumber,turn:next.revision});
  onSound(soundFor(type,next));
 },[externalChange,onSound]);
 useEffect(()=>{
  if(!state||state.actor!=='ai'||state.phase==='hand_result'||state.phase==='match_result'||externalChange||rulesOpen)return;
  const timer=setTimeout(()=>{
   if(stateRef.current!==state)return;
   try{
    const action=chooseGinMove(createGinObservation(state,'ai'),difficulty);
    perform(action.type,'ai',action.cardId);
   }catch(error){console.error('Gin AI decision failed',error);}
  },reducedMotion?60:420);
  return ()=>clearTimeout(timer);
 },[state,difficulty,perform,reducedMotion,externalChange,rulesOpen]);
 const cards=useMemo(()=>{
  if(!state)return [];
  return [...state.human].sort((a,b)=>{
   const ai=order.indexOf(a.id),bi=order.indexOf(b.id);
   return (ai<0?100+state.human.indexOf(a):ai)-(bi<0?100+state.human.indexOf(b):bi);
  });
 },[state,order]);
 function moveCard(from:CardId,to:CardId){
  const copy=cards.map(c=>c.id);const src=copy.indexOf(from),dst=copy.indexOf(to);
  if(src<0||dst<0||src===dst)return;
  copy.splice(src,1);copy.splice(dst,0,from);setOrder(copy);
 }
 function shiftSelected(direction:-1|1){
  if(!selected)return;const index=cards.findIndex(c=>c.id===selected),dest=cards[index+direction];
  if(dest)moveCard(selected,dest.id);
 }
 function sortHand(mode:'rank'|'suit'){
  if(!state)return;
  const sorted=[...state.human].sort((a,b)=>mode==='rank'
    ?rankOrder(a)-rankOrder(b)||a.suit.localeCompare(b.suit)
    :a.suit.localeCompare(b.suit)||rankOrder(a)-rankOrder(b));
  setOrder(sorted.map(c=>c.id));
 }
 if(!hydrated)return <main className="md-gin-room"><h1 className="sr-only" ref={headingRef} tabIndex={-1} data-screen-heading>{t('ginRummy')}</h1></main>;
 if(!state)return <main className="md-gin-room" data-testid="gin-difficulty-screen">
  <header className="md-gin-header"><GameButton variant="text" onClick={onBack}>‹ {t('back')}</GameButton>
   <h1 ref={headingRef} tabIndex={-1} data-screen-heading>{t('ginRummy')}</h1><span/></header>
  <section className="md-gin-entry">
   <Mochi t={t} reducedMotion={reducedMotion} size="large"/>
   <p>{t('ginDescription')}</p>
   <fieldset><legend>{t('chooseDifficulty')}</legend>
    {(['easy','normal','hard'] as const).map(mode=><label key={mode}>
     <input type="radio" name="gin-difficulty" checked={difficulty===mode} onChange={()=>setDifficulty(mode)}/>{t(mode)}
    </label>)}
   </fieldset>
   <GameButton variant="primary" onClick={begin} data-testid="gin-start">{t('start')}</GameButton>
   <GameButton variant="text" onClick={()=>setRulesOpen(true)}>{t('rules')}</GameButton>
  </section>
  {resetOpen&&<GameDialog t={t} title={t('ginNewMatch')} onClose={()=>setResetOpen(false)}>
   <p>{t('ginNewMatchConfirm')}</p>
   <div className="modal-inline"><GameButton variant="secondary" onClick={()=>setResetOpen(false)}>{t('cancel')}</GameButton>
    <GameButton variant="primary" onClick={()=>{setResetOpen(false);begin();}} data-testid="gin-confirm-reset">{t('confirm')}</GameButton></div>
  </GameDialog>}
  {rulesOpen&&<GameDialog t={t} title={t('ginRulesTitle')} onClose={()=>setRulesOpen(false)}><p>{t('ginRulesText')}</p></GameDialog>}
 </main>;
 const humanTurn=state.actor==='human',drawPhase=state.phase==='draw',openPhase=state.phase.startsWith('opening_');
 const discardPhase=state.phase==='discard',finished=state.phase==='hand_result'||state.phase==='match_result';
 const selectedValid=Boolean(humanTurn&&discardPhase&&selected&&selected!==state.drawnFromDiscard&&state.human.some(c=>c.id===selected));
 const remaining=selectedValid?state.human.filter(c=>c.id!==selected):state.human;
 const evaluated=evaluateGinHand(remaining);
 const canGin=selectedValid&&evaluated.value===0,canKnock=selectedValid&&evaluated.value>0&&evaluated.value<=10;
 const pose=finished?(state.result?.winner==='ai'?'victory':state.result?.winner==='human'?'defeat':'idle'):
 state.actor==='ai'?'thinking':'idle';
 return <main className="md-gin-room" data-testid="gin-screen">
  <header className="md-gin-header">
   <GameButton variant="text" onClick={onBack} data-testid="gin-back">‹ {t('back')}</GameButton>
   <h1 tabIndex={-1} ref={headingRef} data-screen-heading>GIN RUMMY</h1>
   <div className="md-gin-tools"><GameButton variant="text" onClick={()=>setResetOpen(true)}>{t('ginNewMatch')}</GameButton>
    <GameButton variant="text" onClick={()=>setRulesOpen(true)}>{t('rules')}</GameButton></div>
  </header>
  <div className="md-gin-score" aria-label={t('matchScore')}>
   <span>{t('you')} <strong>{state.scores.human}</strong></span>
   <span>{t('round')} {state.handNumber}</span>
   <span>{t('mochi')} <strong>{state.scores.ai}</strong></span>
  </div>
  <div className="md-gin-table">
   <section className="md-gin-opponent" aria-label={t('mochiHand')}>
    <Mochi t={t} size="small" reducedMotion={reducedMotion} pose={pose} cue={cue}
     onCueDone={id=>setCue(current=>current?.id===id?null:current)}/>
    <div className="md-gin-backhand" data-testid="gin-opponent-hand">
     {finished?state.ai.map(c=><GinCard key={c.id} card={c} t={t} disabled/>)
      :state.ai.map(c=><CardBack key={c.id} small label={t('mochiHand')}/>)}
    </div>
   </section>
   <div className="md-gin-middle">
    <button className="md-gin-pile" type="button" disabled={!humanTurn||!drawPhase||state.stock.length<=2||externalChange}
     onClick={()=>perform('draw_stock')} data-testid="gin-stock">
     <CardBack label={t('deck')}/>
     <span>{t('ginStock')} · {state.stock.length}</span>
    </button>
    <button className="md-gin-pile" type="button" disabled={!humanTurn||!(drawPhase||openPhase)||externalChange||!state.discard.length}
     onClick={()=>perform(openPhase?'take_open':'draw_discard')} data-testid="gin-discard">
     {state.discard.length?<img className="pixel-art md-gin-pile-face" src={cardImage(state.discard[state.discard.length-1]!.id,true)} alt={cardLabel(state.discard[state.discard.length-1]!,t)}/>:<span className="md-gin-empty"/>}
     <span>{t('discard')}</span>
    </button>
    <span className="md-gin-turn" role="status">{finished?t('ginHandOver'):humanTurn?t('yourTurn'):t('mochiTurn')}</span>
   </div>
   <section className="md-gin-player" aria-label={t('yourHand')}>
    <div className="md-gin-player-label"><span>{t('yourHand')}</span><span>{t('ginDeadwood')} <strong>{evaluated.value}</strong></span></div>
    <div className="md-gin-hand" data-testid="gin-player-hand">
     {cards.map(c=><GinCard key={c.id} card={c} t={t} selected={selected===c.id} disabled={!humanTurn||!discardPhase||externalChange}
      onClick={()=>setSelected(prev=>prev===c.id?null:c.id)}
      onDragStart={e=>e.dataTransfer.setData('text/plain',c.id)}
      onDrop={e=>{e.preventDefault();const source=e.dataTransfer.getData('text/plain') as CardId;moveCard(source,c.id);}}/>)}
    </div>
    {evaluated.melds.length>0&&<div className="md-gin-melds" aria-label={t('ginMelds')}>
      {evaluated.melds.map((meld,i)=><span key={i}>{meld.cards.join(' · ')}</span>)}
    </div>}
   </section>
  </div>
  <footer className="md-gin-actions">
   {externalChange&&<div role="alert">{t('ginExternal')} <GameButton variant="cream" onClick={()=>{
    const current=readSave();stateRef.current=current;setState(current);setExternalChange(false);setCue(null);
   }}>{t('bjReload')}</GameButton></div>}
   {storageError&&<span role="alert">{t('saveFailed')}</span>}
   {openPhase&&humanTurn&&!finished&&<GameButton variant="secondary" onClick={()=>perform('pass_open')} data-testid="gin-pass">{t('ginPass')}</GameButton>}
   {discardPhase&&humanTurn&&!finished&&<>
    <GameButton variant="primary" disabled={!selectedValid||externalChange} onClick={()=>perform('discard','human',selected!)} data-testid="gin-throw">{t('discard')}</GameButton>
    {canKnock&&<GameButton variant="cream" disabled={externalChange} onClick={()=>perform('knock','human',selected!)} data-testid="gin-knock">{t('ginKnock')}</GameButton>}
    {canGin&&<GameButton variant="cream" disabled={externalChange} onClick={()=>perform('gin','human',selected!)} data-testid="gin-gin">{t('ginDeclare')}</GameButton>}
   </>}
   {discardPhase&&humanTurn&&<div className="md-gin-sort">
    <GameButton variant="text" onClick={()=>sortHand('rank')}>{t('ginSortRank')}</GameButton>
    <GameButton variant="text" onClick={()=>sortHand('suit')}>{t('ginSortSuit')}</GameButton>
    <GameButton variant="text" disabled={!selected} onClick={()=>shiftSelected(-1)} aria-label={t('ginMoveLeft')}>◀</GameButton>
    <GameButton variant="text" disabled={!selected} onClick={()=>shiftSelected(1)} aria-label={t('ginMoveRight')}>▶</GameButton>
   </div>}
   {finished&&state.result&&<div className="md-gin-result" role="status" data-testid="gin-result">
    <strong>{state.result.kind==='stock'?t('drawResult'):state.result.winner==='human'?t('win'):t('lose')}</strong>
    <span>{state.result.kind==='gin'?t('ginDeclare'):state.result.kind==='undercut'?t('ginUndercut'):state.result.kind==='knock'?t('ginKnock'):t('ginStockEmpty')}</span>
    <span>{t('ginPoints')} +{state.result.points} · {t('ginDeadwood')} {state.result.knockerDeadwood} : {state.result.opponentDeadwood}</span>
    {state.phase==='match_result'&&<span>{t('ginMatches')} {state.stats.matches} · {t('wins')} {state.stats.humanWins} · {t('losses')} {state.stats.aiWins}</span>}
    {state.result.laidOff.length>0&&<span>{t('ginLayoff')}: {state.result.laidOff.join(' · ')}</span>}
    <GameButton variant="primary" disabled={externalChange} onClick={()=>{perform(state.phase==='match_result'?'new_match':'next_hand');setOrder([]);}} data-testid="gin-next">
     {state.phase==='match_result'?t('rematch'):t('nextRound')}
    </GameButton>
   </div>}
  </footer>
  {rulesOpen&&<GameDialog t={t} title={t('ginRulesTitle')} onClose={()=>setRulesOpen(false)}><p>{t('ginRulesText')}</p></GameDialog>}
 </main>;
}

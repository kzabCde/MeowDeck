import type { GameState } from '../../games/meowdeck/core/game-types.js';
import type { StoredDifficulty } from '../storage/save-schema.js';
export interface MatchRecord {
  readonly matchId: string;
  readonly completedAt: string;
  readonly difficulty: StoredDifficulty;
  readonly winner: 'human' | 'ai';
  readonly finalScore: {readonly human:number;readonly ai:number};
  readonly roundsPlayed:number;
  readonly roundsWon:number;
  readonly roundsLost:number;
  readonly roundsDrawn:number;
}
export function toMatchRecord(state:GameState,difficulty:StoredDifficulty):MatchRecord {
  if(state.phase!=='match_end'||!state.matchWinner)throw Error('Only a completed match is recordable');
  const roundsWon=state.scores.human, roundsLost=state.scores.ai, roundsDrawn=state.roundNumber-roundsWon-roundsLost;
  if(roundsDrawn<0)throw Error('Invalid round counts');
  return {matchId:state.sessionId,completedAt:new Date().toISOString(),difficulty,winner:state.matchWinner,
    finalScore:{...state.scores},roundsPlayed:state.roundNumber,roundsWon,roundsLost,roundsDrawn};
}
export interface StatisticsSummary {
  matches:number;wins:number;losses:number;winRate:number;rounds:number;roundsWon:number;roundsLost:number;roundsDrawn:number;currentStreak:number;bestStreak:number;
  byDifficulty:Record<StoredDifficulty,{matches:number;wins:number;losses:number;winRate:number}>;
}
export function summarizeMatches(records:readonly MatchRecord[]):StatisticsSummary {
  const byDifficulty=Object.fromEntries((['practice','easy','normal','hard'] as const).map(d=>[d,{matches:0,wins:0,losses:0,winRate:0}])) as StatisticsSummary['byDifficulty'];
  const ordered=[...records].sort((a,b)=>a.completedAt.localeCompare(b.completedAt)||a.matchId.localeCompare(b.matchId));
  let wins=0,rounds=0,roundsWon=0,roundsLost=0,roundsDrawn=0,currentStreak=0,bestStreak=0;
  for(const r of ordered){const win=r.winner==='human';if(win)wins++;
    currentStreak=win?currentStreak+1:0;bestStreak=Math.max(bestStreak,currentStreak);
    rounds+=r.roundsPlayed;roundsWon+=r.roundsWon;roundsLost+=r.roundsLost;roundsDrawn+=r.roundsDrawn;
    const part=byDifficulty[r.difficulty];part.matches++;if(win)part.wins++;else part.losses++;
  }
  for(const d of Object.values(byDifficulty))d.winRate=d.matches?Math.round(1000*d.wins/d.matches)/10:0;
  return {matches:ordered.length,wins,losses:ordered.length-wins,winRate:ordered.length?Math.round(1000*wins/ordered.length)/10:0,
    rounds,roundsWon,roundsLost,roundsDrawn,currentStreak,bestStreak,byDifficulty};
}

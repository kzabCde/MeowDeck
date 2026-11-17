import type { T } from '../i18n.js';
import type { MatchRecord } from '../statistics/statistics-service.js';
import { summarizeMatches } from '../statistics/statistics-service.js';
export function StatisticsPanel({records,t,onReset}:{records:readonly MatchRecord[];t:T;onReset:()=>void}){
  const stats=summarizeMatches(records);
  return <section className="p4-stats" data-testid="statistics-panel">
    <div className="p4-stats-grid">
      <div><span>{t('matchesPlayed')}</span><strong data-testid="stats-matches">{stats.matches}</strong></div>
      <div><span>{t('wins')}</span><strong>{stats.wins}</strong></div>
      <div><span>{t('losses')}</span><strong>{stats.losses}</strong></div>
      <div><span>{t('winRate')}</span><strong>{stats.winRate}%</strong></div>
    </div>
    <h3>{t('byDifficulty')}</h3>
    <div className="p4-stat-breakdown">{(['practice','easy','normal','hard'] as const).map(level=>
      <div key={level}><span>{t(level)}</span><strong>{stats.byDifficulty[level].wins}/{stats.byDifficulty[level].matches}</strong><span>{stats.byDifficulty[level].winRate}%</span></div>
    )}</div>
    <h3>{t('roundStats')}</h3><p>{t('wins')}: {stats.roundsWon} · {t('losses')}: {stats.roundsLost} · {t('drawResult')}: {stats.roundsDrawn}</p>
    <p>{t('currentStreak')}: {stats.currentStreak} · {t('bestStreak')}: {stats.bestStreak}</p>
    <h3>{t('recentMatches')}</h3>
    <div className="p4-recent">{records.length===0?<p>{t('noRecords')}</p>: [...records].sort((a,b)=>b.completedAt.localeCompare(a.completedAt)).slice(0,8).map(r=>
      <div key={r.matchId}><time>{new Date(r.completedAt).toLocaleDateString()}</time><span>{t(r.difficulty)}</span><strong>{r.winner==='human'?t('win'):t('lose')}</strong></div>
    )}</div>
    <button className="pixel-button button-secondary" onClick={onReset} data-testid="reset-statistics">{t('resetStatistics')}</button>
  </section>;
}

import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useHistoryStore } from '@/stores/historyStore.ts';
import { useInboxStore } from '@/stores/inboxStore.ts';
import { cn } from '@/lib/cn.ts';
import type { InboxItem } from '@/stores/inboxStore.ts';

const AWARD_META: Record<string, { label: string; color: string }> = {
  MVP: { label: 'MVP', color: 'text-gold' },
  CyYoung: { label: 'Cy Young', color: 'text-blue-400' },
  ROY: { label: 'ROY', color: 'text-green-light' },
};

export function FranchiseHistoryPage() {
  const navigate = useNavigate();
  const { engine, userTeamId, season } = useFranchiseStore();
  const { seasonRecords, champions, awardHistory, allStarResults, tradeHistory, clearHistory } = useHistoryStore();
  const inboxItems = useInboxStore(s => s.items);

  if (!engine) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => navigate('/')}>Back to Menu</Button>
      </div>
    );
  }

  const getTeamName = (id: string) => {
    const t = engine.getTeam(id);
    return t ? `${t.city} ${t.name}` : id;
  };

  // Sort by year desc
  const sortedYears = [...new Set([
    ...seasonRecords.map(r => r.year),
    ...champions.map(c => c.year),
  ])].sort((a, b) => b - a);

  const userSeasonRecords = seasonRecords
    .filter(r => r.teamId === userTeamId)
    .sort((a, b) => b.year - a.year);

  const playoffResultLabel = (result: string) => {
    switch (result) {
      case 'champion': return { label: 'Champion', color: 'text-gold' };
      case 'runner-up': return { label: 'Runner-Up', color: 'text-cream' };
      case 'league-cs': return { label: 'League CS', color: 'text-cream-dim' };
      case 'division-series': return { label: 'Div. Series', color: 'text-cream-dim' };
      case 'missed': return { label: 'Missed Playoffs', color: 'text-red' };
      default: return { label: '—', color: 'text-cream-dim/50' };
    }
  };

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Franchise History</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            All-time records, champions, and awards
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { if (confirm('Clear all franchise history?')) clearHistory(); }}
        >
          Clear History
        </Button>
      </div>

      {/* Current Season In Progress */}
      {season && userTeamId && (() => {
        const rec = season.standings.getRecord(userTeamId);
        if (!rec) return null;
        const gamesPlayed = rec.wins + rec.losses;
        const pct = gamesPlayed > 0
          ? (rec.wins / gamesPlayed).toFixed(3).replace(/^0/, '')
          : '.000';
        const divs = season.standings.getDivisionStandings();
        const userDiv = divs.find(d => d.teams.some(t => t.teamId === userTeamId));
        const divRank = userDiv
          ? userDiv.teams.findIndex(t => t.teamId === userTeamId) + 1
          : null;
        const rankLabel = divRank === 1 ? '1st' : divRank === 2 ? '2nd' : divRank === 3 ? '3rd' : `${divRank}th`;
        return (
          <div key="in-progress" className="mb-6 p-4 rounded-xl border border-green-light/30 bg-green-light/5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-light animate-pulse shrink-0" />
              <h2 className="font-display text-lg text-green-light tracking-wide uppercase">
                {season.year} Season — In Progress
              </h2>
              <span className="font-mono text-xs text-cream-dim/50 ml-1">
                Day {season.currentDay}/{season.totalDays}
              </span>
            </div>
            <div className="flex flex-wrap gap-6 font-mono">
              <div>
                <p className="text-xs text-cream-dim/50 uppercase tracking-wider mb-0.5">Record</p>
                <p className="text-xl text-cream font-bold">
                  {rec.wins}–{rec.losses}{' '}
                  <span className="text-sm text-cream-dim font-normal">{pct}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-cream-dim/50 uppercase tracking-wider mb-0.5">Progress</p>
                <p className="text-sm text-cream">{gamesPlayed} GP · {Math.round((season.currentDay / season.totalDays) * 100)}% done</p>
              </div>
              {divRank && userDiv && (
                <div>
                  <p className="text-xs text-cream-dim/50 uppercase tracking-wider mb-0.5">Standing</p>
                  <p className="text-sm text-cream">
                    {rankLabel} <span className="text-cream-dim">in {userDiv.division}</span>
                  </p>
                </div>
              )}
            </div>
            <p className="text-xs text-cream-dim/40 mt-3 font-mono">Full history is saved at season end.</p>
          </div>
        );
      })()}

      {/* Recent Games (in-season) */}
      {season && userTeamId && (() => {
        const recentGames = season.schedule
          .filter(g => g.played && (g.awayId === userTeamId || g.homeId === userTeamId))
          .slice(-15)
          .reverse();
        if (recentGames.length === 0) return null;
        return (
          <Panel title="Recent Games" className="mb-6">
            <div className="space-y-0.5">
              {recentGames.map(g => {
                const isHome = g.homeId === userTeamId;
                const oppId = isHome ? g.awayId : g.homeId;
                const oppTeam = engine.getTeam(oppId);
                const oppName = oppTeam ? `${oppTeam.city} ${oppTeam.name}` : oppId;
                const userScore = isHome ? g.homeScore! : g.awayScore!;
                const oppScore = isHome ? g.awayScore! : g.homeScore!;
                const won = userScore > oppScore;
                return (
                  <div key={g.id} className="flex items-center justify-between py-1.5 border-b border-navy-lighter/20 last:border-0 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'w-5 text-center font-bold rounded',
                        won ? 'text-green-light' : 'text-red',
                      )}>
                        {won ? 'W' : 'L'}
                      </span>
                      <span className="text-cream-dim/50">D{g.date}</span>
                      <span className="text-cream-dim text-[10px]">{isHome ? 'vs' : '@'}</span>
                      <span className="text-cream truncate max-w-[140px]">{oppName}</span>
                    </div>
                    <span className={cn('font-bold tabular-nums', won ? 'text-green-light' : 'text-cream-dim')}>
                      {userScore}–{oppScore}
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>
        );
      })()}

      {/* Season Events (in-season inbox items) */}
      {season && (() => {
        const EVENT_COLORS: Partial<Record<InboxItem['type'], string>> = {
          injury: 'text-red',
          return: 'text-green-light',
          milestone: 'text-gold',
          trade_offer: 'text-blue-400',
          waiver: 'text-cream-dim',
          callup: 'text-green-light',
        };
        const relevantItems = inboxItems
          .filter(item => item.day > 0)
          .sort((a, b) => b.day - a.day)
          .slice(0, 20);
        if (relevantItems.length === 0) return null;
        return (
          <Panel title="Season Events" className="mb-6">
            <div className="space-y-0.5 max-h-72 overflow-y-auto">
              {relevantItems.map(item => {
                const color = EVENT_COLORS[item.type] ?? 'text-cream-dim';
                return (
                  <div key={item.id} className="flex items-start gap-3 py-1.5 border-b border-navy-lighter/20 last:border-0">
                    <span className="font-mono text-[10px] text-cream-dim/40 shrink-0 mt-0.5">D{item.day}</span>
                    <div className="min-w-0">
                      <p className={cn('font-mono text-xs font-semibold truncate', color)}>{item.title}</p>
                      {item.body && (
                        <p className="font-mono text-[10px] text-cream-dim/60 truncate">{item.body}</p>
                      )}
                    </div>
                    {item.urgent && (
                      <span className="shrink-0 font-mono text-[9px] text-red uppercase font-bold mt-0.5">!</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        );
      })()}

      {/* Champions Banner */}
      {champions.length > 0 && (
        <div className="mb-6 p-5 rounded-xl border border-gold/50 bg-gold/5">
          <h2 className="font-display text-gold text-xl tracking-wide uppercase mb-3">
            World Series Champions
          </h2>
          <div className="flex flex-wrap gap-3">
            {[...champions].sort((a, b) => b.year - a.year).map(c => (
              <div key={c.year} className={cn(
                'px-4 py-2 rounded-lg border',
                c.teamId === userTeamId
                  ? 'border-gold bg-gold/15'
                  : 'border-navy-lighter bg-navy-lighter/20',
              )}>
                <p className={cn(
                  'font-display text-sm tracking-wide uppercase',
                  c.teamId === userTeamId ? 'text-gold' : 'text-cream',
                )}>
                  {c.year}
                </p>
                <p className={cn(
                  'font-mono text-xs',
                  c.teamId === userTeamId ? 'text-gold/80' : 'text-cream-dim',
                )}>
                  {c.teamName}
                </p>
                <p className="font-mono text-xs text-cream-dim/50">
                  {c.wins}-{c.losses}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Your Team's History */}
      {userSeasonRecords.length > 0 && (
        <Panel title="Your Season Records" className="mb-6">
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="border-b border-navy-lighter">
                  <th className="text-left py-2 text-xs text-cream-dim/60 uppercase tracking-widest">Year</th>
                  <th className="text-right py-2 text-xs text-cream-dim/60 uppercase tracking-widest">W</th>
                  <th className="text-right py-2 text-xs text-cream-dim/60 uppercase tracking-widest">L</th>
                  <th className="text-right py-2 text-xs text-cream-dim/60 uppercase tracking-widest">PCT</th>
                  <th className="text-left py-2 text-xs text-cream-dim/60 uppercase tracking-widest pl-4">Result</th>
                </tr>
              </thead>
              <tbody>
                {userSeasonRecords.map(r => {
                  const result = playoffResultLabel(r.playoffResult);
                  const isChamp = r.playoffResult === 'champion';
                  return (
                    <tr key={r.year} className={cn(
                      'border-b border-navy-lighter/20',
                      isChamp && 'bg-gold/5',
                    )}>
                      <td className={cn('py-2', isChamp ? 'text-gold font-bold' : 'text-cream')}>
                        {r.year}
                      </td>
                      <td className="text-right text-cream">{r.wins}</td>
                      <td className="text-right text-cream">{r.losses}</td>
                      <td className="text-right text-cream-dim">{r.winPct}</td>
                      <td className={cn('pl-4', result.color)}>{result.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* League Champions by Year */}
      {sortedYears.length > 0 && (
        <Panel title="Year-by-Year Champions" className="mb-6">
          {sortedYears.length === 0 ? (
            <p className="font-mono text-cream-dim text-sm">No champions recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {sortedYears.map(year => {
                const champion = champions.find(c => c.year === year);
                const yearAwards = awardHistory.filter(a => a.year === year);
                return (
                  <div key={year} className="py-2 border-b border-navy-lighter/20 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-cream font-bold">{year}</span>
                      {champion ? (
                        <span className={cn(
                          'font-mono text-sm',
                          champion.teamId === userTeamId ? 'text-gold font-bold' : 'text-cream-dim',
                        )}>
                          {champion.teamName} ({champion.wins}-{champion.losses})
                        </span>
                      ) : (
                        <span className="font-mono text-cream-dim text-sm">No champion recorded</span>
                      )}
                    </div>
                    {yearAwards.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {yearAwards
                          .sort((a, b) => ['MVP', 'CyYoung', 'ROY'].indexOf(a.type) - ['MVP', 'CyYoung', 'ROY'].indexOf(b.type))
                          .map(a => {
                            const meta = AWARD_META[a.type] ?? { label: a.type, color: 'text-cream-dim' };
                            return (
                              <span key={`${a.league}-${a.type}`} className={cn(
                                'font-mono text-xs',
                                meta.color,
                              )}>
                                {meta.label}: {a.playerName}
                              </span>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* All-Star History */}
      {allStarResults.length > 0 && (
        <Panel title="All-Star Game Results" className="mb-6">
          <div className="space-y-2">
            {[...allStarResults].sort((a, b) => b.year - a.year).map(r => (
              <div key={r.year} className="flex items-center justify-between py-1.5 border-b border-navy-lighter/20 font-mono text-sm">
                <span className="text-cream-dim">{r.year}</span>
                <span className="text-cream">
                  {r.awayLeague} {r.awayScore}, {r.homeLeague} {r.homeScore}
                </span>
                <span className="text-cream-dim text-xs">MVP: {r.mvpPlayerName}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Trade History */}
      {tradeHistory.length > 0 && (
        <Panel title="Trade History">
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {[...tradeHistory]
              .sort((a, b) => b.year - a.year || b.day - a.day)
              .slice(0, 50)
              .map((t, i) => (
                <div key={i} className={cn(
                  'flex items-start gap-3 py-2 border-b border-navy-lighter/20 font-mono text-xs',
                  t.isUserTrade && 'text-cream',
                  !t.isUserTrade && 'text-cream-dim',
                )}>
                  <span className="shrink-0 text-cream-dim/50">{t.year}/D{t.day}</span>
                  <span className="min-w-0">{t.description}</span>
                  {t.isUserTrade && (
                    <span className="shrink-0 text-gold text-[10px] uppercase font-bold">You</span>
                  )}
                </div>
              ))}
          </div>
        </Panel>
      )}

      {/* Empty state — only when there's no in-progress season and no past data */}
      {champions.length === 0 && seasonRecords.length === 0 && awardHistory.length === 0 && !season && (
        <Panel>
          <p className="font-mono text-cream-dim text-sm text-center py-8">
            No franchise history yet. History is recorded at season end.
          </p>
        </Panel>
      )}
    </div>
  );
}

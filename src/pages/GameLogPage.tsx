import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';
import type { ScheduledGame } from '@/engine/season/index.ts';

type FilterMode = 'all' | 'user' | 'division';

export function GameLogPage() {
  const navigate = useNavigate();
  const { season, engine, userTeamId } = useFranchiseStore();

  const [filter, setFilter] = useState<FilterMode>('user');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => navigate('/')}>Back to Menu</Button>
      </div>
    );
  }

  // Get user's division team IDs
  const leagueStructure = engine.getLeagueStructure();
  const userDivisionTeams = useMemo(() => {
    const ids = new Set<string>();
    for (const divisions of Object.values(leagueStructure)) {
      for (const teamIds of Object.values(divisions)) {
        if (teamIds.includes(userTeamId)) {
          teamIds.forEach(id => ids.add(id));
        }
      }
    }
    return ids;
  }, [leagueStructure, userTeamId]);

  // Filter completed games
  const completedGames = useMemo(() => {
    return season.schedule
      .filter(g => g.played)
      .filter(g => {
        if (filter === 'user') return g.awayId === userTeamId || g.homeId === userTeamId;
        if (filter === 'division') {
          return (
            (userDivisionTeams.has(g.awayId) && userDivisionTeams.has(g.homeId)) ||
            g.awayId === userTeamId ||
            g.homeId === userTeamId
          );
        }
        return true; // 'all'
      })
      .sort((a, b) => b.date - a.date); // newest first
  }, [season.schedule, filter, userTeamId, userDivisionTeams]);

  // Running W-L for user team games
  const userGameResults = useMemo(() => {
    const userGames = season.schedule
      .filter(g => g.played && (g.awayId === userTeamId || g.homeId === userTeamId))
      .sort((a, b) => a.date - b.date);

    let wins = 0;
    let losses = 0;
    const recordMap = new Map<string, { wins: number; losses: number }>();

    for (const g of userGames) {
      const isHome = g.homeId === userTeamId;
      const userScore = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
      const oppScore = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
      if (userScore > oppScore) wins++; else losses++;
      recordMap.set(g.id, { wins, losses });
    }
    return recordMap;
  }, [season.schedule, userTeamId]);

  const getTeamName = (id: string) => {
    const t = engine.getTeam(id);
    return t ? `${t.city} ${t.name}` : id;
  };

  const getTeamAbbr = (id: string) => {
    const t = engine.getTeam(id);
    return t?.abbreviation ?? id.slice(0, 3).toUpperCase();
  };

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Game Log</h1>
        <p className="font-mono text-cream-dim text-sm mt-1">
          {season.year} Season — {completedGames.length} games completed
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {(['user', 'division', 'all'] as FilterMode[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-1.5 rounded-md font-mono text-sm transition-all cursor-pointer border',
              filter === f
                ? 'bg-gold/15 border-gold/50 text-gold'
                : 'bg-navy-lighter/20 border-navy-lighter text-cream-dim hover:text-cream hover:border-navy-lighter/80',
            )}
          >
            {f === 'user' ? 'My Games' : f === 'division' ? 'Division' : 'All Games'}
          </button>
        ))}
      </div>

      {/* Summary stats (user filter) */}
      {filter === 'user' && completedGames.length > 0 && (() => {
        const lastRecord = userGameResults.get(
          [...completedGames].sort((a, b) => a.date - b.date).at(-1)?.id ?? ''
        );
        return lastRecord ? (
          <div className="flex gap-6 mb-4 p-3 bg-navy-light rounded-lg border border-navy-lighter">
            <div className="font-mono text-center">
              <p className="text-2xl font-bold text-gold">{lastRecord.wins}-{lastRecord.losses}</p>
              <p className="text-xs text-cream-dim">Season Record</p>
            </div>
            <div className="font-mono text-center">
              <p className="text-lg font-bold text-cream">{completedGames.length}</p>
              <p className="text-xs text-cream-dim">Games Played</p>
            </div>
            <div className="font-mono text-center">
              <p className="text-lg font-bold text-cream">
                {season.schedule.filter(g => g.awayId === userTeamId || g.homeId === userTeamId).length - completedGames.length}
              </p>
              <p className="text-xs text-cream-dim">Remaining</p>
            </div>
          </div>
        ) : null;
      })()}

      {/* Game List */}
      {completedGames.length === 0 ? (
        <Panel>
          <p className="text-cream-dim font-mono text-sm text-center py-8">
            No completed games yet
          </p>
        </Panel>
      ) : (
        <div className="space-y-1">
          {completedGames.map(g => {
            const isUserGame = g.awayId === userTeamId || g.homeId === userTeamId;
            const isHome = g.homeId === userTeamId;
            const userScore = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
            const oppScore = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
            const won = isUserGame && userScore > oppScore;
            const lost = isUserGame && userScore < oppScore;
            const record = isUserGame ? userGameResults.get(g.id) : null;
            const isExpanded = expandedId === g.id;

            return (
              <div
                key={g.id}
                className={cn(
                  'rounded-lg border transition-all overflow-hidden',
                  isUserGame
                    ? won
                      ? 'border-green-light/20 bg-green-900/10'
                      : 'border-red-500/20 bg-red-900/10'
                    : 'border-navy-lighter/40 bg-navy-light/30',
                )}
              >
                {/* Main row */}
                <div
                  className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-navy-lighter/10 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : g.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setExpandedId(isExpanded ? null : g.id)}
                >
                  {/* Result badge */}
                  {isUserGame ? (
                    <span className={cn(
                      'w-6 text-center font-mono text-sm font-bold shrink-0',
                      won ? 'text-green-light' : lost ? 'text-red' : 'text-cream-dim',
                    )}>
                      {won ? 'W' : lost ? 'L' : 'T'}
                    </span>
                  ) : (
                    <span className="w-6 text-center font-mono text-xs text-cream-dim/40 shrink-0">·</span>
                  )}

                  {/* Day */}
                  <span className="font-mono text-xs text-cream-dim w-12 shrink-0">Day {g.date}</span>

                  {/* Matchup */}
                  <div className="flex-1 flex items-center gap-2 font-mono text-sm min-w-0">
                    <span className={cn(
                      'truncate',
                      g.awayId === userTeamId ? 'text-gold font-bold' : 'text-cream',
                    )}>
                      {getTeamAbbr(g.awayId)}
                    </span>
                    <span className="text-cream-dim font-bold text-lg leading-none">{g.awayScore}</span>
                    <span className="text-cream-dim text-xs">@</span>
                    <span className="text-cream-dim font-bold text-lg leading-none">{g.homeScore}</span>
                    <span className={cn(
                      'truncate',
                      g.homeId === userTeamId ? 'text-gold font-bold' : 'text-cream',
                    )}>
                      {getTeamAbbr(g.homeId)}
                    </span>
                  </div>

                  {/* Running record */}
                  {record && (
                    <span className="font-mono text-xs text-cream-dim shrink-0">
                      {record.wins}-{record.losses}
                    </span>
                  )}

                  {/* Box score quick link */}
                  {isUserGame && (
                    <button
                      className="font-mono text-[10px] text-cream-dim/50 hover:text-gold border border-navy-lighter/50 hover:border-gold/40 rounded px-1.5 py-0.5 transition-colors shrink-0 cursor-pointer"
                      onClick={e => { e.stopPropagation(); navigate(`/franchise/box-score/${g.id}`); }}
                    >
                      BOX
                    </button>
                  )}

                  {/* Expand indicator */}
                  <span className="font-mono text-xs text-cream-dim/40 shrink-0">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>

                {/* Expanded box score summary */}
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 border-t border-navy-lighter/30 bg-navy-lighter/5">
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      {[
                        { id: g.awayId, score: g.awayScore ?? 0, label: 'Away' },
                        { id: g.homeId, score: g.homeScore ?? 0, label: 'Home' },
                      ].map(({ id, score, label }) => (
                        <div key={id} className="font-mono">
                          <p className="text-xs text-cream-dim">{label}</p>
                          <p className={cn(
                            'text-sm font-bold',
                            id === userTeamId ? 'text-gold' : 'text-cream',
                          )}>
                            {getTeamName(id)}
                          </p>
                          <p className="text-2xl font-bold text-cream">{score}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/franchise/box-score/${g.id}`)}
                      >
                        Full Box Score
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { usePlayerModal } from '@/stores/playerModalStore.ts';
import {
  calcBattingAdvanced,
  calcPitchingAdvanced,
  deriveLeagueContext,
  DEFAULT_LEAGUE_CONTEXT,
  POSITION_ADJ,
} from '@/engine/stats/AdvancedStats.ts';
import { cn } from '@/lib/cn.ts';

type ViewMode = 'leaders' | 'team' | 'positions';
type PlayerType = 'all' | 'batters' | 'pitchers';

interface WarEntry {
  playerId: string;
  playerName: string;
  teamId: string;
  teamAbbr: string;
  position: string;
  war: number;
  isPitcher: boolean;
  keyStats: string;
  isUserTeam: boolean;
}

function WarBar({ war, maxWar }: { war: number; maxWar: number }) {
  const pct = maxWar > 0 ? Math.max(0, Math.min(100, (war / maxWar) * 100)) : 0;
  const color = war >= 4 ? 'bg-gold' : war >= 2 ? 'bg-green-light' : war >= 0.5 ? 'bg-cream-dim/60' : war >= 0 ? 'bg-cream-dim/30' : 'bg-red-400/60';
  return (
    <div className="flex-1 h-2.5 bg-navy-lighter/30 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function WarBadge({ war }: { war: number }) {
  const tier = war >= 6 ? { label: 'MVP', color: 'text-gold border-gold/50 bg-gold/10' }
    : war >= 4 ? { label: 'All-Star', color: 'text-gold/80 border-gold/30 bg-gold/5' }
    : war >= 2 ? { label: 'Starter', color: 'text-green-light border-green-light/30 bg-green-light/5' }
    : war >= 0.5 ? { label: 'Bench', color: 'text-cream-dim border-cream-dim/20 bg-cream-dim/5' }
    : war >= 0 ? { label: 'Below Avg', color: 'text-cream-dim/50 border-cream-dim/10 bg-transparent' }
    : { label: 'Negative', color: 'text-red-400/70 border-red-400/20 bg-red-400/5' };

  return (
    <span className={cn('font-mono text-[9px] px-1.5 py-0.5 rounded border', tier.color)}>
      {tier.label}
    </span>
  );
}

export function WarDashboardPage() {
  const navigate = useNavigate();
  const { engine, userTeamId, season } = useFranchiseStore();
  const getCurrentSeasonStats = useStatsStore(s => s.getCurrentSeasonStats);
  const playerStats = useMemo(() => getCurrentSeasonStats(), [getCurrentSeasonStats]);
  const openPlayer = usePlayerModal(s => s.openPlayer);
  const [viewMode, setViewMode] = useState<ViewMode>('leaders');
  const [playerType, setPlayerType] = useState<PlayerType>('all');
  const [posFilter, setPosFilter] = useState<string>('ALL');

  if (!engine || !userTeamId || !season) {
    return (
      <div className="min-h-screen p-6 max-w-5xl mx-auto">
        <h1 className="font-display text-3xl text-gold uppercase tracking-wide mb-4">WAR Dashboard</h1>
        <p className="font-mono text-cream-dim text-sm">
          Wins Above Replacement — the single stat that measures total player value.
        </p>
        <p className="font-mono text-cream-dim/50 text-xs mt-2">Loading franchise data...</p>
        <Button className="mt-4" onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  // Compute league context
  const leagueCtx = useMemo(() => {
    const allStats = Object.values(playerStats);
    if (allStats.length === 0) return DEFAULT_LEAGUE_CONTEXT;
    let totalAB = 0, totalPA = 0, totalH = 0, totalDoubles = 0, totalTriples = 0;
    let totalHR = 0, totalBB = 0, totalHBP = 0, totalSF = 0, totalSO = 0, totalRuns = 0;
    let totalER = 0, totalIP = 0;
    for (const p of allStats) {
      totalAB += p.batting.ab; totalPA += p.batting.pa; totalH += p.batting.h;
      totalDoubles += p.batting.doubles; totalTriples += p.batting.triples;
      totalHR += p.batting.hr; totalBB += p.batting.bb; totalHBP += p.batting.hbp;
      totalSF += p.batting.sf; totalSO += p.batting.so; totalRuns += p.batting.r;
      totalER += p.pitching.er; totalIP += p.pitching.ip;
    }
    return deriveLeagueContext(totalAB, totalPA, totalH, totalDoubles, totalTriples, totalHR, totalBB, totalHBP, totalSF, totalSO, totalRuns, 0, totalER, totalIP);
  }, [playerStats]);

  // Build WAR entries for all players
  const warEntries = useMemo(() => {
    const entries: WarEntry[] = [];
    for (const ps of Object.values(playerStats)) {
      const team = engine.getTeam(ps.teamId);
      const isPitcher = ps.position === 'P';
      let war = 0;
      let keyStats = '';

      if (isPitcher && ps.pitching.ip > 0) {
        const adv = calcPitchingAdvanced(ps.pitching, leagueCtx);
        war = adv.war;
        const innings = ps.pitching.ip / 3;
        keyStats = `${adv.era.toFixed(2)} ERA, ${ps.pitching.so} K, ${innings.toFixed(1)} IP`;
      } else if (!isPitcher && ps.batting.pa >= 10) {
        const posAdj = POSITION_ADJ[ps.position] ?? 0;
        const adv = calcBattingAdvanced(ps.batting, leagueCtx, ps.position);
        war = adv.war;
        keyStats = `.${Math.round(adv.avg * 1000).toString().padStart(3, '0')} AVG, ${ps.batting.hr} HR, ${ps.batting.rbi} RBI`;
      } else {
        continue;
      }

      entries.push({
        playerId: ps.playerId,
        playerName: ps.playerName,
        teamId: ps.teamId,
        teamAbbr: team?.abbreviation ?? ps.teamId.slice(0, 3).toUpperCase(),
        position: ps.position,
        war,
        isPitcher,
        keyStats,
        isUserTeam: ps.teamId === userTeamId,
      });
    }
    return entries.sort((a, b) => b.war - a.war);
  }, [playerStats, leagueCtx, engine, userTeamId]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    let entries = warEntries;
    if (playerType === 'batters') entries = entries.filter(e => !e.isPitcher);
    if (playerType === 'pitchers') entries = entries.filter(e => e.isPitcher);
    if (posFilter !== 'ALL') entries = entries.filter(e => e.position === posFilter);
    return entries;
  }, [warEntries, playerType, posFilter]);

  const maxWar = Math.max(1, ...filteredEntries.map(e => e.war));

  // Team WAR totals
  const teamWar = useMemo(() => {
    const map = new Map<string, { teamId: string; abbr: string; name: string; totalWar: number; batWar: number; pitWar: number; isUser: boolean }>();
    for (const e of warEntries) {
      const team = engine.getTeam(e.teamId);
      if (!map.has(e.teamId)) {
        map.set(e.teamId, {
          teamId: e.teamId,
          abbr: e.teamAbbr,
          name: team ? `${team.city} ${team.name}` : e.teamId,
          totalWar: 0,
          batWar: 0,
          pitWar: 0,
          isUser: e.teamId === userTeamId,
        });
      }
      const entry = map.get(e.teamId)!;
      entry.totalWar += e.war;
      if (e.isPitcher) entry.pitWar += e.war; else entry.batWar += e.war;
    }
    return Array.from(map.values()).sort((a, b) => b.totalWar - a.totalWar);
  }, [warEntries, engine, userTeamId]);

  const maxTeamWar = Math.max(1, ...teamWar.map(t => t.totalWar));

  // Position WAR leaders
  const positionLeaders = useMemo(() => {
    const positions = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'P'];
    return positions.map(pos => {
      const posEntries = warEntries.filter(e => e.position === pos);
      const leader = posEntries[0] ?? null;
      return { position: pos, leader, count: posEntries.length };
    });
  }, [warEntries]);

  // User team WAR
  const userTeamWarData = teamWar.find(t => t.isUser);
  const userTeamRank = teamWar.findIndex(t => t.isUser) + 1;

  const POSITIONS = ['ALL', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'P'];

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">WAR Dashboard</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            Wins Above Replacement — {season.year} Season · {warEntries.length} players tracked
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/franchise')}>← Back</Button>
      </div>

      {/* Your Team Summary */}
      {userTeamWarData && (
        <div className="mb-6 rounded-lg border border-gold/30 bg-gold/5 px-5 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-mono text-[10px] text-gold/60 uppercase tracking-wider">Your Team WAR</p>
              <p className="font-mono text-3xl font-bold text-gold mt-1">{userTeamWarData.totalWar.toFixed(1)}</p>
              <p className="font-mono text-xs text-cream-dim/50 mt-0.5">
                Rank #{userTeamRank} of {teamWar.length}
              </p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="font-mono text-[10px] text-cream-dim/50 uppercase">Batting</p>
                <p className="font-mono text-xl font-bold text-green-light">{userTeamWarData.batWar.toFixed(1)}</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-[10px] text-cream-dim/50 uppercase">Pitching</p>
                <p className="font-mono text-xl font-bold text-blue-400">{userTeamWarData.pitWar.toFixed(1)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-navy-lighter/40">
        {([['leaders', 'WAR Leaders'], ['team', 'Team Rankings'], ['positions', 'By Position']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setViewMode(key)}
            className={cn(
              'px-4 py-2 font-mono text-xs transition-all border-b-2 cursor-pointer',
              viewMode === key ? 'border-gold text-gold' : 'border-transparent text-cream-dim/50 hover:text-cream-dim',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Leaders View */}
      {viewMode === 'leaders' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex gap-1">
              {(['all', 'batters', 'pitchers'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setPlayerType(t); setPosFilter('ALL'); }}
                  className={cn(
                    'px-3 py-1 rounded font-mono text-xs transition-all cursor-pointer',
                    playerType === t ? 'bg-gold/15 text-gold border border-gold/30' : 'text-cream-dim/50 hover:text-cream-dim border border-transparent',
                  )}
                >
                  {t === 'all' ? 'All' : t === 'batters' ? 'Position Players' : 'Pitchers'}
                </button>
              ))}
            </div>
            {playerType !== 'pitchers' && (
              <div className="flex gap-0.5 ml-2">
                {POSITIONS.filter(p => p !== 'P' || playerType === 'all').map(p => (
                  <button
                    key={p}
                    onClick={() => setPosFilter(p)}
                    className={cn(
                      'px-2 py-0.5 rounded font-mono text-[10px] transition-all cursor-pointer',
                      posFilter === p ? 'bg-navy-lighter text-cream' : 'text-cream-dim/30 hover:text-cream-dim/60',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Leaderboard */}
          <div className="space-y-1">
            {filteredEntries.slice(0, 50).map((e, i) => (
              <div
                key={e.playerId}
                onClick={() => openPlayer(e.playerId)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-all cursor-pointer',
                  e.isUserTeam ? 'bg-gold/5 hover:bg-gold/10 border border-gold/15' : 'hover:bg-navy-lighter/20 border border-transparent',
                )}
              >
                {/* Rank */}
                <span className={cn(
                  'font-mono text-xs font-bold w-6 text-right shrink-0',
                  i === 0 ? 'text-gold' : i < 3 ? 'text-cream' : 'text-cream-dim/40',
                )}>
                  {i + 1}
                </span>

                {/* Player info */}
                <div className="min-w-0 w-40 shrink-0">
                  <p className={cn('font-body text-sm truncate', e.isUserTeam ? 'text-gold' : 'text-cream')}>
                    {e.playerName}
                  </p>
                  <p className="font-mono text-[10px] text-cream-dim/50">
                    {e.teamAbbr} · {e.position}
                  </p>
                </div>

                {/* WAR bar */}
                <WarBar war={e.war} maxWar={maxWar} />

                {/* WAR value */}
                <span className={cn(
                  'font-mono text-sm font-bold w-10 text-right shrink-0',
                  e.war >= 4 ? 'text-gold' : e.war >= 2 ? 'text-green-light' : e.war >= 0 ? 'text-cream' : 'text-red-400',
                )}>
                  {e.war.toFixed(1)}
                </span>

                {/* Tier badge */}
                <WarBadge war={e.war} />

                {/* Key stats */}
                <span className="font-mono text-[10px] text-cream-dim/40 hidden md:block w-48 text-right shrink-0 truncate">
                  {e.keyStats}
                </span>
              </div>
            ))}
          </div>

          {filteredEntries.length === 0 && (
            <div className="text-center py-8">
              <p className="font-mono text-cream-dim/40 text-sm">No players match the current filters</p>
            </div>
          )}
        </>
      )}

      {/* Team Rankings View */}
      {viewMode === 'team' && (
        <div className="space-y-2">
          {teamWar.map((t, i) => (
            <div
              key={t.teamId}
              onClick={() => navigate(`/franchise/team-stats/${t.teamId}`)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer',
                t.isUser ? 'bg-gold/5 border border-gold/20 hover:bg-gold/10' : 'bg-navy-light/20 border border-navy-lighter/30 hover:border-navy-lighter/60',
              )}
            >
              <span className={cn('font-mono text-xs font-bold w-6 text-right shrink-0', i < 3 ? 'text-gold' : 'text-cream-dim/40')}>
                {i + 1}
              </span>
              <div className="w-40 shrink-0">
                <p className={cn('font-body text-sm', t.isUser ? 'text-gold font-bold' : 'text-cream')}>{t.name}</p>
                <p className="font-mono text-[10px] text-cream-dim/50">{t.abbr}</p>
              </div>

              {/* Stacked bar: batting + pitching WAR */}
              <div className="flex-1 h-4 bg-navy-lighter/20 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-green-light/60 transition-all duration-500"
                  style={{ width: `${maxTeamWar > 0 ? (Math.max(0, t.batWar) / maxTeamWar) * 100 : 0}%` }}
                  title={`Batting WAR: ${t.batWar.toFixed(1)}`}
                />
                <div
                  className="h-full bg-blue-400/60 transition-all duration-500"
                  style={{ width: `${maxTeamWar > 0 ? (Math.max(0, t.pitWar) / maxTeamWar) * 100 : 0}%` }}
                  title={`Pitching WAR: ${t.pitWar.toFixed(1)}`}
                />
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <span className="font-mono text-xs text-green-light">{t.batWar.toFixed(1)}</span>
                  <span className="font-mono text-[10px] text-cream-dim/30 mx-1">+</span>
                  <span className="font-mono text-xs text-blue-400">{t.pitWar.toFixed(1)}</span>
                </div>
                <span className={cn(
                  'font-mono text-sm font-bold w-10 text-right',
                  i < 3 ? 'text-gold' : 'text-cream',
                )}>
                  {t.totalWar.toFixed(1)}
                </span>
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 ml-10">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-light/60" />
              <span className="font-mono text-[10px] text-cream-dim/50">Batting WAR</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-400/60" />
              <span className="font-mono text-[10px] text-cream-dim/50">Pitching WAR</span>
            </div>
          </div>
        </div>
      )}

      {/* By Position View */}
      {viewMode === 'positions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {positionLeaders.map(({ position, leader, count }) => (
            <div
              key={position}
              className="rounded-lg border border-navy-lighter bg-navy-light/20 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs bg-navy-lighter px-2 py-0.5 rounded text-cream">{position}</span>
                  <span className="font-mono text-[10px] text-cream-dim/40">{count} players</span>
                </div>
                <span className="font-mono text-[10px] text-cream-dim/30">
                  Pos Adj: {(POSITION_ADJ[position] ?? 0) > 0 ? '+' : ''}{POSITION_ADJ[position] ?? 0}
                </span>
              </div>

              {leader ? (
                <button
                  onClick={() => openPlayer(leader.playerId)}
                  className="w-full text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn('font-body text-sm', leader.isUserTeam ? 'text-gold' : 'text-cream')}>
                        {leader.playerName}
                      </p>
                      <p className="font-mono text-[10px] text-cream-dim/50">{leader.teamAbbr} · {leader.keyStats}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        'font-mono text-lg font-bold',
                        leader.war >= 4 ? 'text-gold' : leader.war >= 2 ? 'text-green-light' : 'text-cream',
                      )}>
                        {leader.war.toFixed(1)}
                      </p>
                      <WarBadge war={leader.war} />
                    </div>
                  </div>
                </button>
              ) : (
                <p className="font-mono text-xs text-cream-dim/30">No qualifying players</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* WAR Explainer */}
      <Panel title="What is WAR?" className="mt-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {[
            { range: '6+', label: 'MVP Caliber', color: 'text-gold' },
            { range: '4-6', label: 'All-Star', color: 'text-gold/80' },
            { range: '2-4', label: 'Solid Starter', color: 'text-green-light' },
            { range: '0.5-2', label: 'Bench Player', color: 'text-cream-dim' },
            { range: '0', label: 'Replacement', color: 'text-cream-dim/50' },
            { range: '<0', label: 'Below Repl.', color: 'text-red-400' },
          ].map(tier => (
            <div key={tier.range} className="text-center py-2">
              <p className={cn('font-mono text-sm font-bold', tier.color)}>{tier.range}</p>
              <p className="font-mono text-[10px] text-cream-dim/40">{tier.label}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useHistoryStore } from '@/stores/historyStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { AwardsCeremony, type CeremonyAward } from '@/components/game/AwardsCeremony.tsx';
import { cn } from '@/lib/cn.ts';
import { ops } from '@/engine/types/stats.ts';
import { getFieldingForPosition } from '@/engine/types/player.ts';
import type { Position } from '@/engine/types/enums.ts';
import type { Award } from '@/engine/season/index.ts';

const AWARD_META: Record<string, { label: string; icon: string; color: string; valueLabel: string }> = {
  MVP: { label: 'Most Valuable Player', icon: '★', color: 'text-gold', valueLabel: 'HR+RBI' },
  CyYoung: { label: 'Cy Young Award', icon: '⚾', color: 'text-blue-400', valueLabel: 'ERA' },
  ROY: { label: 'Rookie of the Year', icon: '🔰', color: 'text-green-light', valueLabel: 'HR+RBI' },
  SilverSlugger: { label: 'Silver Slugger', icon: '🥈', color: 'text-cream', valueLabel: 'OPS' },
  GoldGlove: { label: 'Gold Glove', icon: '🥇', color: 'text-gold', valueLabel: 'DEF' },
};

const SS_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
const GG_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

function AwardCard({
  award,
  year,
  teamName,
  isUserTeam,
  compact = false,
}: {
  award: Award;
  year: number;
  teamName: string;
  isUserTeam: boolean;
  compact?: boolean;
}) {
  const meta = AWARD_META[award.type] ?? { label: award.type, icon: '·', color: 'text-cream' };
  if (compact) {
    return (
      <div className={cn(
        'p-2 rounded border flex items-center gap-2',
        isUserTeam ? 'border-gold/40 bg-gold/5' : 'border-navy-lighter bg-navy-light/20',
      )}>
        <span className="font-mono text-xs text-cream-dim/60 w-7 shrink-0">{award.position}</span>
        <span className="font-display text-cream text-sm tracking-wide truncate flex-1">{award.playerName}</span>
        <span className={cn('font-mono text-xs font-bold shrink-0', meta.color)}>
          {award.type === 'SilverSlugger' ? award.value.toFixed(3) : Math.round(award.value)}
        </span>
      </div>
    );
  }
  return (
    <div className={cn(
      'p-4 rounded-lg border transition-all',
      isUserTeam
        ? 'border-gold/50 bg-gold/5'
        : 'border-navy-lighter bg-navy-light/30',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={cn('font-mono text-xs uppercase tracking-widest mb-0.5', meta.color)}>
            {meta.icon} {meta.label}
          </p>
          <p className="font-display text-cream text-base tracking-wide truncate">
            {award.playerName}
          </p>
          <p className="font-mono text-cream-dim text-xs truncate">{teamName}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-xs text-cream-dim">{year}</p>
          <p className={cn('font-mono text-sm font-bold', meta.color)}>{award.value.toFixed(1)}</p>
          <p className="font-mono text-[10px] text-cream-dim/40">{meta.valueLabel}</p>
        </div>
      </div>
    </div>
  );
}

function CurrentSeasonAwards({ season, engine, userTeamId }: {
  season: import('@/engine/season/SeasonEngine.ts').SeasonEngine['getState'] extends () => infer S ? S : never;
  engine: import('@/engine/season/SeasonEngine.ts').SeasonEngine;
  userTeamId: string;
}) {
  const getCurrentSeasonStats = useStatsStore(s => s.getCurrentSeasonStats);
  const playerStats = useMemo(() => getCurrentSeasonStats(), [getCurrentSeasonStats]);

  // Calculate from current stats: highest OVR composite = MVP, lowest ERA = Cy Young, best rookie = ROY
  const calculatedAwards = useMemo(() => {
    const leagueStructure = engine.getLeagueStructure();
    const awards: (Award & { calculated: boolean })[] = [];

    for (const [league, divisions] of Object.entries(leagueStructure)) {
      const leagueTeamIds = new Set<string>();
      for (const teamIds of Object.values(divisions)) teamIds.forEach(id => leagueTeamIds.add(id));

      // Stats for this league
      const leagueStats = Object.values(playerStats).filter(ps => leagueTeamIds.has(ps.teamId));

      // MVP: non-pitchers with most PA, highest composite batting/value
      const batters = leagueStats.filter(ps => ps.position !== 'P' && ps.batting.pa >= 50);
      if (batters.length > 0) {
        const mvp = batters.reduce((best, ps) => {
          const score = (ps.batting.h / Math.max(1, ps.batting.ab)) * 100 +
            ps.batting.hr * 3 + ps.batting.rbi * 0.5;
          const bestScore = (best.batting.h / Math.max(1, best.batting.ab)) * 100 +
            best.batting.hr * 3 + best.batting.rbi * 0.5;
          return score > bestScore ? ps : best;
        }, batters[0]!);
        const mvpTeam = engine.getTeam(mvp.teamId);
        awards.push({
          type: 'MVP',
          league,
          playerId: mvp.playerId,
          playerName: mvp.playerName,
          teamId: mvp.teamId,
          value: mvp.batting.hr + mvp.batting.rbi,
          calculated: true,
        });
      }

      // Cy Young: pitchers with most IP, lowest ERA
      const pitchers = leagueStats.filter(ps => ps.position === 'P' && ps.pitching.ip >= 45);
      if (pitchers.length > 0) {
        const cy = pitchers.reduce((best, ps) => {
          const era = ps.pitching.ip === 0 ? 99 : (ps.pitching.er / (ps.pitching.ip / 3)) * 9;
          const bestEra = best.pitching.ip === 0 ? 99 : (best.pitching.er / (best.pitching.ip / 3)) * 9;
          return era < bestEra ? ps : best;
        }, pitchers[0]!);
        const cyEra = cy.pitching.ip === 0 ? 0 : (cy.pitching.er / (cy.pitching.ip / 3)) * 9;
        awards.push({
          type: 'CyYoung',
          league,
          playerId: cy.playerId,
          playerName: cy.playerName,
          teamId: cy.teamId,
          value: Math.round(cyEra * 100) / 100,
          calculated: true,
        });
      }

      // ROY: age <= 26, best batting composite
      const allTeams = engine.getAllTeams();
      const rookies = leagueStats.filter(ps => {
        const player = allTeams
          .flatMap(t => t.roster.players)
          .find(p => p.id === ps.playerId);
        return player && player.age <= 26 && ps.batting.pa >= 30;
      });
      if (rookies.length > 0) {
        const roy = rookies.reduce((best, ps) => {
          const score = ps.batting.hr * 3 + ps.batting.rbi * 0.5 + ps.batting.h;
          const bestScore = best.batting.hr * 3 + best.batting.rbi * 0.5 + best.batting.h;
          return score > bestScore ? ps : best;
        }, rookies[0]!);
        awards.push({
          type: 'ROY',
          league,
          playerId: roy.playerId,
          playerName: roy.playerName,
          teamId: roy.teamId,
          value: roy.batting.hr + roy.batting.rbi,
          calculated: true,
        });
      }

      // Silver Slugger: best OPS per position (min 30 PA)
      const allPlayers = allTeams.flatMap(t => t.roster.players);
      for (const pos of SS_POSITIONS) {
        const posStats = leagueStats.filter(ps =>
          ps.position === pos && ps.batting.pa >= 30
        );
        if (posStats.length === 0) continue;
        const winner = posStats.reduce((best, ps) =>
          ops(ps.batting) > ops(best.batting) ? ps : best, posStats[0]!
        );
        awards.push({
          type: 'SilverSlugger',
          league,
          playerId: winner.playerId,
          playerName: winner.playerName,
          teamId: winner.teamId,
          value: ops(winner.batting),
          position: pos,
          calculated: true,
        });
      }

      // Gold Glove: best fielding score per position among starters (min 20 games)
      // fielding score = range + arm_strength + arm_accuracy + turn_dp + (100 - error_rate)
      const fieldingScore = (player: ReturnType<typeof allPlayers[0]['fielding']['find']>) => {
        if (!player) return 0;
        return player.range + player.arm_strength + player.arm_accuracy +
               player.turn_dp + (100 - player.error_rate);
      };
      for (const pos of GG_POSITIONS) {
        const posStats = leagueStats.filter(ps =>
          ps.position === pos && ps.gamesPlayed >= 10
        );
        if (posStats.length === 0) continue;
        const winner = posStats.reduce((best, ps) => {
          const pPlayer = allPlayers.find(p => p.id === ps.playerId);
          const bPlayer = allPlayers.find(p => p.id === best.playerId);
          const pFs = fieldingScore(pPlayer ? getFieldingForPosition(pPlayer, pos as Position) : undefined);
          const bFs = fieldingScore(bPlayer ? getFieldingForPosition(bPlayer, pos as Position) : undefined);
          return pFs > bFs ? ps : best;
        }, posStats[0]!);
        const winnerPlayer = allPlayers.find(p => p.id === winner.playerId);
        const winnerFs = fieldingScore(winnerPlayer ? getFieldingForPosition(winnerPlayer, pos as Position) : undefined);
        awards.push({
          type: 'GoldGlove',
          league,
          playerId: winner.playerId,
          playerName: winner.playerName,
          teamId: winner.teamId,
          value: winnerFs,
          position: pos,
          calculated: true,
        });
      }
    }

    return awards;
  }, [playerStats, engine]);

  // If offseason awards exist, use those; otherwise show calculated
  const awards = season.offseasonAwards?.length
    ? season.offseasonAwards.map(a => ({ ...a, calculated: false }))
    : calculatedAwards;

  const leagueNames = [...new Set(awards.map(a => a.league))].sort();

  const getTeamName = (id: string) => {
    const t = engine.getTeam(id);
    return t ? `${t.city} ${t.name}` : id;
  };

  if (awards.length === 0) {
    return <p className="font-mono text-cream-dim text-sm">Not enough data yet — play more games.</p>;
  }

  return (
    <div className="space-y-6">
      {leagueNames.map(league => {
        const leagueAwards = awards.filter(a => a.league === league);
        const mainAwards = leagueAwards.filter(a => ['MVP', 'CyYoung', 'ROY'].includes(a.type));
        const silverSluggers = leagueAwards.filter(a => a.type === 'SilverSlugger');
        const goldGloves = leagueAwards.filter(a => a.type === 'GoldGlove');
        return (
        <div key={league}>
          <h3 className="font-display text-cream text-lg tracking-wide uppercase mb-3">
            {league} League
          </h3>
          {/* Main awards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {mainAwards
              .sort((a, b) => {
                const order = ['MVP', 'CyYoung', 'ROY'];
                return order.indexOf(a.type) - order.indexOf(b.type);
              })
              .map(a => (
                <AwardCard
                  key={`${a.league}-${a.type}`}
                  award={a}
                  year={season.year}
                  teamName={getTeamName(a.teamId)}
                  isUserTeam={a.teamId === userTeamId}
                />
              ))}
          </div>
          {/* Positional awards */}
          {(silverSluggers.length > 0 || goldGloves.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {silverSluggers.length > 0 && (
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-cream mb-2">🥈 Silver Slugger</p>
                  <div className="space-y-1">
                    {silverSluggers
                      .sort((a, b) => (SS_POSITIONS.indexOf(a.position ?? '') - SS_POSITIONS.indexOf(b.position ?? '')))
                      .map(a => (
                        <AwardCard
                          key={`${a.league}-${a.type}-${a.position}`}
                          award={a}
                          year={season.year}
                          teamName={getTeamName(a.teamId)}
                          isUserTeam={a.teamId === userTeamId}
                          compact
                        />
                      ))}
                  </div>
                </div>
              )}
              {goldGloves.length > 0 && (
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-gold mb-2">🥇 Gold Glove</p>
                  <div className="space-y-1">
                    {goldGloves
                      .sort((a, b) => (GG_POSITIONS.indexOf(a.position ?? '') - GG_POSITIONS.indexOf(b.position ?? '')))
                      .map(a => (
                        <AwardCard
                          key={`${a.league}-${a.type}-${a.position}`}
                          award={a}
                          year={season.year}
                          teamName={getTeamName(a.teamId)}
                          isUserTeam={a.teamId === userTeamId}
                          compact
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        );
      })}
      {calculatedAwards.length > 0 && !season.offseasonAwards?.length && (
        <p className="font-mono text-xs text-cream-dim/50 italic">
          * Live projections based on current stats. Final awards determined at season end.
        </p>
      )}
    </div>
  );
}

export function AwardsPage() {
  const navigate = useNavigate();
  const { season, engine, userTeamId } = useFranchiseStore();
  const { awardHistory } = useHistoryStore();
  const [showCeremony, setShowCeremony] = useState(false);
  const getCurrentSeasonStats = useStatsStore(s => s.getCurrentSeasonStats);
  const playerStats = useMemo(() => getCurrentSeasonStats(), [getCurrentSeasonStats]);

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">Awards</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">Track season award races — MVP, Cy Young, ROY, and more — plus historical winners.</p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  // Past seasons (from history store)
  const pastYears = [...new Set(awardHistory.map(a => a.year))]
    .filter(y => y !== season.year)
    .sort((a, b) => b - a);

  const getTeamName = (id: string) => {
    const t = engine.getTeam(id);
    return t ? `${t.city} ${t.name}` : id;
  };

  // Build ceremony steps from current awards
  const ceremonySteps = useMemo(() => {
    const leagueStructure = engine.getLeagueStructure();
    const steps: { awardType: string; league: string; winner: CeremonyAward; runnersUp: CeremonyAward[] }[] = [];

    for (const [league, divisions] of Object.entries(leagueStructure)) {
      const leagueTeamIds = new Set<string>();
      for (const teamIds of Object.values(divisions)) teamIds.forEach(id => leagueTeamIds.add(id));
      const leagueStats = Object.values(playerStats).filter(ps => leagueTeamIds.has(ps.teamId));

      // MVP
      const batters = leagueStats.filter(ps => ps.position !== 'P' && ps.batting.pa >= 30);
      if (batters.length >= 2) {
        const sorted = [...batters].sort((a, b) => {
          const sa = (a.batting.h / Math.max(1, a.batting.ab)) * 100 + a.batting.hr * 3 + a.batting.rbi * 0.5;
          const sb = (b.batting.h / Math.max(1, b.batting.ab)) * 100 + b.batting.hr * 3 + b.batting.rbi * 0.5;
          return sb - sa;
        });
        const w = sorted[0]!;
        const mkBatLine = (p: typeof w) => `.${Math.round((p.batting.h / Math.max(1, p.batting.ab)) * 1000).toString().padStart(3, '0')} / ${p.batting.hr} HR / ${p.batting.rbi} RBI`;
        const mkBatShort = (p: typeof w) => `.${Math.round((p.batting.h / Math.max(1, p.batting.ab)) * 1000).toString().padStart(3, '0')} / ${p.batting.hr} HR`;
        steps.push({
          awardType: 'MVP', league: `${league} League`,
          winner: { playerName: w.playerName, teamId: w.teamId, position: w.position, statLine: mkBatLine(w) },
          runnersUp: sorted.slice(1, 4).map(p => ({ playerName: p.playerName, teamId: p.teamId, position: p.position, statLine: mkBatShort(p) })),
        });
      }

      // Cy Young
      const pitchers = leagueStats.filter(ps => ps.position === 'P' && ps.pitching.ip >= 20);
      if (pitchers.length >= 2) {
        const sorted = [...pitchers].sort((a, b) => {
          const eraA = a.pitching.ip > 0 ? (a.pitching.er / a.pitching.ip) * 9 : 99;
          const eraB = b.pitching.ip > 0 ? (b.pitching.er / b.pitching.ip) * 9 : 99;
          return eraA - eraB;
        });
        const w = sorted[0]!;
        const era = w.pitching.ip > 0 ? ((w.pitching.er / w.pitching.ip) * 9).toFixed(2) : '0.00';
        steps.push({
          awardType: 'CyYoung', league: `${league} League`,
          winner: { playerName: w.playerName, teamId: w.teamId, position: 'P', statLine: `${era} ERA / ${w.pitching.so} K` },
          runnersUp: sorted.slice(1, 4).map(p => { const pe = p.pitching.ip > 0 ? ((p.pitching.er / p.pitching.ip) * 9).toFixed(2) : '0.00'; return { playerName: p.playerName, teamId: p.teamId, position: 'P', statLine: `${pe} ERA / ${p.pitching.so} K` }; }),
        });
      }

      // ROY
      const rookies = leagueStats.filter(ps => ps.position !== 'P' && ps.batting.pa >= 20);
      if (rookies.length >= 2) {
        const youngest = [...rookies].sort((a, b) => {
          const sa = a.batting.hr * 2 + a.batting.rbi + (a.batting.h / Math.max(1, a.batting.ab)) * 50;
          const sb = b.batting.hr * 2 + b.batting.rbi + (b.batting.h / Math.max(1, b.batting.ab)) * 50;
          return sb - sa;
        });
        const w = youngest[0]!;
        const mkLine = (p: typeof w) => `.${Math.round((p.batting.h / Math.max(1, p.batting.ab)) * 1000).toString().padStart(3, '0')} / ${p.batting.hr} HR / ${p.batting.rbi} RBI`;
        steps.push({
          awardType: 'ROY', league: `${league} League`,
          winner: { playerName: w.playerName, teamId: w.teamId, position: w.position, statLine: mkLine(w) },
          runnersUp: youngest.slice(1, 3).map(p => ({ playerName: p.playerName, teamId: p.teamId, position: p.position, statLine: `.${Math.round((p.batting.h / Math.max(1, p.batting.ab)) * 1000).toString().padStart(3, '0')} / ${p.batting.hr} HR` })),
        });
      }
    }

    return steps;
  }, [engine, playerStats, season.year]);

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Awards</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            Season honors — MVP, Cy Young, Rookie of the Year
          </p>
        </div>
        {ceremonySteps.length > 0 && (
          <Button variant="primary" size="sm" onClick={() => { setShowCeremony(true); import('@/stores/achievementStore.ts').then(m => m.useAchievementStore.getState().unlock('awards-ceremony')); }}>
            Awards Ceremony
          </Button>
        )}
      </div>

      {/* Current Season */}
      <Panel title={`${season.year} Season Awards`} className="mb-6">
        <CurrentSeasonAwards
          season={season}
          engine={engine}
          userTeamId={userTeamId}
        />
      </Panel>

      {/* Awards Ceremony Overlay */}
      {showCeremony && (
        <AwardsCeremony
          steps={ceremonySteps}
          year={season.year}
          userTeamId={userTeamId}
          getTeamName={getTeamName}
          onClose={() => setShowCeremony(false)}
        />
      )}

      {/* Past Seasons */}
      {pastYears.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl text-cream tracking-wide uppercase">Award History</h2>
          {pastYears.map(year => {
            const yearAwards = awardHistory.filter(a => a.year === year);
            const leagueNames = [...new Set(yearAwards.map(a => a.league))].sort();
            return (
              <Panel key={year} title={`${year} Season`}>
                {leagueNames.map(league => (
                  <div key={league} className="mb-4 last:mb-0">
                    <p className="font-mono text-xs text-cream-dim/60 uppercase tracking-widest mb-2">
                      {league} League
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {yearAwards
                        .filter(a => a.league === league)
                        .sort((a, b) => ['MVP', 'CyYoung', 'ROY'].indexOf(a.type) - ['MVP', 'CyYoung', 'ROY'].indexOf(b.type))
                        .map(a => {
                          const meta = AWARD_META[a.type] ?? { label: a.type, icon: '·', color: 'text-cream' };
                          return (
                            <div key={`${a.league}-${a.type}`} className="p-2 rounded border border-navy-lighter font-mono text-sm">
                              <p className={cn('text-xs', meta.color)}>{meta.icon} {a.type}</p>
                              <p className="text-cream font-bold">{a.playerName}</p>
                              <p className="text-cream-dim text-xs">{getTeamName(a.teamId)}</p>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

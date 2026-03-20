import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useHistoryStore } from '@/stores/historyStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { cn } from '@/lib/cn.ts';
import type { Award } from '@/engine/season/index.ts';

const AWARD_META: Record<string, { label: string; icon: string; color: string; valueLabel: string }> = {
  MVP: { label: 'Most Valuable Player', icon: '★', color: 'text-gold', valueLabel: 'HR+RBI' },
  CyYoung: { label: 'Cy Young Award', icon: '⚾', color: 'text-blue-400', valueLabel: 'ERA' },
  ROY: { label: 'Rookie of the Year', icon: '🔰', color: 'text-green-light', valueLabel: 'HR+RBI' },
};

function AwardCard({
  award,
  year,
  teamName,
  isUserTeam,
}: {
  award: Award;
  year: number;
  teamName: string;
  isUserTeam: boolean;
}) {
  const meta = AWARD_META[award.type] ?? { label: award.type, icon: '·', color: 'text-cream' };
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
  const playerStats = useStatsStore(s => s.playerStats);

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
          value: mvp.batting.hr + Math.round(mvp.batting.rbi / 10),
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
          value: roy.batting.hr + Math.round(roy.batting.rbi / 10),
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
      {leagueNames.map(league => (
        <div key={league}>
          <h3 className="font-display text-cream text-lg tracking-wide uppercase mb-3">
            {league} League
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {awards
              .filter(a => a.league === league)
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
        </div>
      ))}
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

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => navigate('/')}>Back to Menu</Button>
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

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Awards</h1>
        <p className="font-mono text-cream-dim text-sm mt-1">
          Season honors — MVP, Cy Young, Rookie of the Year
        </p>
      </div>

      {/* Current Season */}
      <Panel title={`${season.year} Season Awards`} className="mb-6">
        <CurrentSeasonAwards
          season={season}
          engine={engine}
          userTeamId={userTeamId}
        />
      </Panel>

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

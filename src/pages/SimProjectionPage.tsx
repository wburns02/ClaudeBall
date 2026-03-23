/**
 * SimProjectionPage — Monte Carlo season projection.
 * Simulates the rest of the season 100 times to project final standings,
 * playoff odds, and win distribution.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { cn } from '@/lib/cn.ts';

interface TeamProjection {
  teamId: string;
  name: string;
  abbr: string;
  currentWins: number;
  currentLosses: number;
  avgFinalWins: number;
  avgFinalLosses: number;
  playoffPct: number;
  divisionPct: number;
  worstCase: number;
  bestCase: number;
  isUser: boolean;
}

function seedRandom(seed: number) {
  let s = seed | 0;
  return () => { s = (s * 1664525 + 1013904223) | 0; return (s >>> 0) / 4294967296; };
}

export function SimProjectionPage() {
  const navigate = useNavigate();
  const { engine, season, userTeamId } = useFranchiseStore();
  const [simCount] = useState(100);

  const projections = useMemo(() => {
    if (!engine || !season || !userTeamId) return [];

    const allTeams = engine.getAllTeams();
    const standings = season.standings;
    const schedule = season.schedule;
    const remaining = schedule.filter(g => !g.played);

    if (remaining.length === 0) return [];

    // Calculate team strengths
    const teamStrength = new Map<string, number>();
    for (const t of allTeams) {
      const avg = t.roster.players.length > 0
        ? t.roster.players.reduce((s, p) => s + evaluatePlayer(p), 0) / t.roster.players.length
        : 50;
      teamStrength.set(t.id, avg);
    }

    // Monte Carlo simulation
    const simResults = new Map<string, { totalWins: number; totalLosses: number; playoffCount: number; divisionCount: number; minWins: number; maxWins: number }>();
    for (const t of allTeams) {
      const rec = standings.getRecord(t.id);
      simResults.set(t.id, {
        totalWins: 0, totalLosses: 0, playoffCount: 0, divisionCount: 0,
        minWins: 999, maxWins: 0,
      });
    }

    for (let sim = 0; sim < simCount; sim++) {
      const rand = seedRandom(sim * 12345 + 67890);
      const simWins = new Map<string, number>();

      // Start with current records
      for (const t of allTeams) {
        const rec = standings.getRecord(t.id);
        simWins.set(t.id, rec?.wins ?? 0);
      }

      // Simulate remaining games
      for (const g of remaining) {
        const awayStr = teamStrength.get(g.awayId) ?? 50;
        const homeStr = teamStrength.get(g.homeId) ?? 50;
        // Home advantage + strength-based probability
        const homeAdvantage = 0.54;
        const strengthFactor = (homeStr - awayStr) / 200;
        const homeWinProb = Math.max(0.2, Math.min(0.8, homeAdvantage + strengthFactor));
        const homeWins = rand() < homeWinProb;

        const winner = homeWins ? g.homeId : g.awayId;
        simWins.set(winner, (simWins.get(winner) ?? 0) + 1);
      }

      // Determine playoffs (top 5 per league by wins)
      const leagueStructure = engine.getLeagueStructure();
      for (const [league, divisions] of Object.entries(leagueStructure)) {
        const leagueTeamIds: string[] = [];
        for (const teamIds of Object.values(divisions)) leagueTeamIds.push(...teamIds);

        const sorted = leagueTeamIds.sort((a, b) => (simWins.get(b) ?? 0) - (simWins.get(a) ?? 0));
        const playoffTeams = sorted.slice(0, 5); // Top 5 make playoffs

        // Division winners
        for (const [div, teamIds] of Object.entries(divisions)) {
          const divSorted = teamIds.sort((a, b) => (simWins.get(b) ?? 0) - (simWins.get(a) ?? 0));
          if (divSorted.length > 0) {
            const r = simResults.get(divSorted[0]!);
            if (r) r.divisionCount++;
          }
        }

        for (const tid of playoffTeams) {
          const r = simResults.get(tid);
          if (r) r.playoffCount++;
        }
      }

      // Accumulate
      for (const t of allTeams) {
        const wins = simWins.get(t.id) ?? 0;
        const totalGames = (standings.getRecord(t.id)?.wins ?? 0) + (standings.getRecord(t.id)?.losses ?? 0) + remaining.filter(g => g.awayId === t.id || g.homeId === t.id).length;
        const losses = totalGames - wins;
        const r = simResults.get(t.id)!;
        r.totalWins += wins;
        r.totalLosses += losses;
        r.minWins = Math.min(r.minWins, wins);
        r.maxWins = Math.max(r.maxWins, wins);
      }
    }

    // Build projections
    const results: TeamProjection[] = [];
    for (const t of allTeams) {
      const r = simResults.get(t.id)!;
      const rec = standings.getRecord(t.id);
      results.push({
        teamId: t.id,
        name: `${t.city} ${t.name}`,
        abbr: t.abbreviation,
        currentWins: rec?.wins ?? 0,
        currentLosses: rec?.losses ?? 0,
        avgFinalWins: Math.round(r.totalWins / simCount),
        avgFinalLosses: Math.round(r.totalLosses / simCount),
        playoffPct: Math.round((r.playoffCount / simCount) * 100),
        divisionPct: Math.round((r.divisionCount / simCount) * 100),
        worstCase: r.minWins,
        bestCase: r.maxWins,
        isUser: t.id === userTeamId,
      });
    }

    return results.sort((a, b) => b.playoffPct - a.playoffPct);
  }, [engine, season, userTeamId, simCount]);

  if (!engine || !season || !userTeamId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="font-display text-gold text-xl">Season Projections</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">
          Monte Carlo simulation of your remaining schedule to project final standings and playoff odds.
        </p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const userProj = projections.find(p => p.isUser);
  const gamesRemaining = season.schedule.filter(g => !g.played).length;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Season Projections</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {simCount}-simulation Monte Carlo projection · {gamesRemaining} games remaining
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/standings')}>Standings</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise')}>Dashboard</Button>
        </div>
      </div>

      {/* Your Team Projection */}
      {userProj && (
        <Panel title="Your Projection">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-gold/10 border border-gold/30">
              <p className="font-display text-3xl text-gold font-bold">{userProj.avgFinalWins}-{userProj.avgFinalLosses}</p>
              <p className="font-mono text-[9px] text-gold/60 uppercase tracking-wider mt-1">Projected Record</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-navy-lighter/15 border border-navy-lighter/30">
              <p className={cn('font-display text-3xl font-bold', userProj.playoffPct >= 70 ? 'text-green-light' : userProj.playoffPct >= 40 ? 'text-gold' : 'text-red-400')}>
                {userProj.playoffPct}%
              </p>
              <p className="font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider mt-1">Playoff Odds</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-navy-lighter/15 border border-navy-lighter/30">
              <p className="font-display text-3xl text-cream font-bold">{userProj.divisionPct}%</p>
              <p className="font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider mt-1">Division Win</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-navy-lighter/15 border border-navy-lighter/30">
              <p className="font-mono text-lg text-cream">{userProj.worstCase}-{userProj.bestCase}</p>
              <p className="font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider mt-1">Win Range</p>
            </div>
          </div>
        </Panel>
      )}

      {/* League-wide Projections */}
      <Panel title="League-wide Playoff Odds">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-lighter/30">
                <th className="text-left font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider py-2 px-2">#</th>
                <th className="text-left font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider py-2 px-2">Team</th>
                <th className="text-center font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider py-2 px-1">Now</th>
                <th className="text-center font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider py-2 px-1">Proj</th>
                <th className="text-center font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider py-2 px-1">PO%</th>
                <th className="text-center font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider py-2 px-1">Div%</th>
                <th className="text-center font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider py-2 px-1 hidden sm:table-cell">Range</th>
              </tr>
            </thead>
            <tbody>
              {projections.map((p, i) => (
                <tr
                  key={p.teamId}
                  className={cn(
                    'border-b border-navy-lighter/15 transition-colors',
                    p.isUser ? 'bg-gold/5' : 'hover:bg-navy-lighter/10',
                  )}
                >
                  <td className="py-1.5 px-2 font-mono text-xs text-cream-dim/40">{i + 1}</td>
                  <td className="py-1.5 px-2">
                    <span className={cn('font-mono text-xs', p.isUser ? 'text-gold font-bold' : 'text-cream')}>{p.abbr}</span>
                    <span className="font-body text-[10px] text-cream-dim/40 ml-1.5 hidden sm:inline">{p.name}</span>
                  </td>
                  <td className="py-1.5 px-1 text-center font-mono text-xs text-cream-dim">{p.currentWins}-{p.currentLosses}</td>
                  <td className="py-1.5 px-1 text-center font-mono text-xs text-cream font-bold">{p.avgFinalWins}-{p.avgFinalLosses}</td>
                  <td className="py-1.5 px-1 text-center">
                    <span className={cn(
                      'font-mono text-xs font-bold',
                      p.playoffPct >= 80 ? 'text-green-light' : p.playoffPct >= 50 ? 'text-gold' : p.playoffPct >= 20 ? 'text-cream' : 'text-red-400',
                    )}>{p.playoffPct}%</span>
                  </td>
                  <td className="py-1.5 px-1 text-center font-mono text-xs text-cream-dim">{p.divisionPct}%</td>
                  <td className="py-1.5 px-1 text-center font-mono text-[10px] text-cream-dim/40 hidden sm:table-cell">{p.worstCase}-{p.bestCase}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2 justify-center pb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/standings')}>Standings</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/power-rankings')}>Power Rankings</Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/franchise/team-compare')}>Compare Teams</Button>
      </div>
    </div>
  );
}

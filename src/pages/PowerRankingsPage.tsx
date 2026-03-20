import { useMemo, useState } from 'react';
import { Panel } from '@/components/ui/Panel.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';
import type { TeamRecord } from '@/engine/season/StandingsTracker.ts';

// ── Helpers ────────────────────────────────────────────────────────────────

function pythWinPct(rs: number, ra: number): number {
  if (rs + ra === 0) return 0.5;
  return (rs * rs) / (rs * rs + ra * ra);
}

function playoffOdds(
  record: TeamRecord,
  divRecords: TeamRecord[],
  allLeagueRecords: TeamRecord[],
  gamesRemaining: number,
): number {
  const gp = record.wins + record.losses;
  if (gp === 0) return 0.5;

  // Find division leader
  const divLeader = [...divRecords].sort((a, b) => b.wins - a.wins)[0];
  const divGB = divLeader === record ? 0 : ((divLeader.wins - record.wins) + (record.losses - divLeader.losses)) / 2;

  // Wild card: top 3 WC teams per league (after division winners)
  // Simplify: find best non-division-leader across league, compute WC GB
  const divWinners = new Set<string>();
  // Mark rough "division winner" per division within league
  // We'll just use league-wide standings for WC
  const sorted = [...allLeagueRecords].sort((a, b) => b.wins - a.wins);
  // Top 6 make playoffs in each league (3 div winners + 3 WC)
  const playoffIdx = sorted.findIndex(r => r.teamId === record.teamId);
  const inTopSix = playoffIdx < 6;

  // WC cutoff: 6th team's wins
  const cutoffRecord = sorted[5] ?? sorted[sorted.length - 1];
  const wcGB = inTopSix ? 0 : ((cutoffRecord.wins - record.wins) + (record.losses - cutoffRecord.losses)) / 2;

  const relevantGB = Math.min(divGB, wcGB);

  if (gamesRemaining <= 0) return inTopSix ? 0.97 : 0.03;

  // Sigmoid-like formula
  const x = (relevantGB - 2) / Math.max(1, gamesRemaining / 8);
  const raw = 1 / (1 + Math.exp(x * 1.5));
  return Math.max(0.01, Math.min(0.99, raw));
}

function getCompositeScore(r: TeamRecord): number {
  const gp = r.wins + r.losses;
  if (gp === 0) return 0.5;
  const winPct = r.wins / gp;
  const rdPerGame = (r.runsScored - r.runsAllowed) / gp;
  const pyth = pythWinPct(r.runsScored, r.runsAllowed);
  // Recent form: last10 W count
  const recentW = r.last10.filter(x => x === 'W').length;
  const formBonus = (recentW - 5) * 0.005;
  return winPct * 0.4 + pyth * 0.3 + (rdPerGame / 10) * 0.25 + formBonus;
}

function rankColor(rank: number, total: number): string {
  if (rank <= 3) return 'text-gold';
  if (rank <= total * 0.4) return 'text-green-light';
  if (rank <= total * 0.65) return 'text-cream';
  return 'text-red-400';
}

function movementArrow(r: TeamRecord): { arrow: string; color: string } {
  if (r.last10.length === 0) return { arrow: '—', color: 'text-cream-dim/20' };
  const recentW = r.last10.filter(x => x === 'W').length;
  if (recentW >= 7) return { arrow: '▲▲', color: 'text-green-light' };
  if (recentW >= 6) return { arrow: '▲', color: 'text-green-light/70' };
  if (recentW <= 3) return { arrow: '▼▼', color: 'text-red-400' };
  if (recentW <= 4) return { arrow: '▼', color: 'text-red-400/70' };
  return { arrow: '—', color: 'text-cream-dim/40' };
}

function OddsBar({ pct }: { pct: number }) {
  const color = pct >= 0.75 ? 'bg-gold' : pct >= 0.4 ? 'bg-green-light' : pct >= 0.15 ? 'bg-cream-dim' : 'bg-red-400/60';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-navy-lighter rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      <span className={cn(
        'font-mono text-[10px] tabular-nums w-8',
        pct >= 0.75 ? 'text-gold' : pct >= 0.4 ? 'text-green-light' : pct >= 0.15 ? 'text-cream-dim' : 'text-red-400/70',
      )}>
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}

function RunDiffBar({ rs, ra }: { rs: number; ra: number }) {
  const diff = rs - ra;
  const maxDiff = 120;
  const pct = Math.abs(diff) / maxDiff;
  const clamped = Math.min(pct, 1);
  const color = diff >= 0 ? 'bg-green-light' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative w-16 h-1.5 bg-navy-lighter rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-1/2 w-px bg-cream-dim/20" />
        <div
          className={cn('absolute inset-y-0 rounded-full', color)}
          style={{
            left: diff >= 0 ? '50%' : `${Math.round((0.5 - clamped * 0.5) * 100)}%`,
            right: diff >= 0 ? `${Math.round((0.5 - clamped * 0.5) * 100)}%` : '50%',
          }}
        />
      </div>
      <span className={cn(
        'font-mono text-[10px] tabular-nums w-10',
        diff > 0 ? 'text-green-light' : diff < 0 ? 'text-red-400' : 'text-cream-dim',
      )}>
        {diff > 0 ? '+' : ''}{diff}
      </span>
    </div>
  );
}

type SortKey = 'rank' | 'wins' | 'pct' | 'pyth' | 'rdiff' | 'odds' | 'form';

export function PowerRankingsPage() {
  const { engine, season, userTeamId, teams } = useFranchiseStore();
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortAsc, setSortAsc] = useState(true);
  const [showDivisions, setShowDivisions] = useState(false);

  const data = useMemo(() => {
    if (!engine || !season) return null;

    const leagueStruct = engine.getLeagueStructure();
    const allRecords = season.standings.getAllRecords();

    // Total games: estimate from schedule
    const totalGames = season.schedule.length / (teams.length / 2);
    const gamesPlayed = allRecords[0] ? allRecords[0].wins + allRecords[0].losses : 0;
    const gamesRemaining = Math.max(0, Math.round(totalGames) - gamesPlayed);

    // Build league membership map: teamId → league
    const teamLeague = new Map<string, string>();
    const teamDivision = new Map<string, string>();
    for (const [league, divs] of Object.entries(leagueStruct)) {
      for (const [div, teamIds] of Object.entries(divs)) {
        for (const tid of teamIds) {
          teamLeague.set(tid, league);
          teamDivision.set(tid, div);
        }
      }
    }

    // Group records by league
    const byLeague = new Map<string, TeamRecord[]>();
    for (const rec of allRecords) {
      const lg = teamLeague.get(rec.teamId) ?? 'Unknown';
      if (!byLeague.has(lg)) byLeague.set(lg, []);
      byLeague.get(lg)!.push(rec);
    }

    // Group records by division
    const byDivision = new Map<string, TeamRecord[]>();
    for (const rec of allRecords) {
      const div = teamDivision.get(rec.teamId) ?? 'Unknown';
      if (!byDivision.has(div)) byDivision.set(div, []);
      byDivision.get(div)!.push(rec);
    }

    // Compute ranked teams with analytics
    const ranked = allRecords.map(rec => {
      const team = engine.getTeam(rec.teamId);
      const gp = rec.wins + rec.losses;
      const wPct = gp > 0 ? rec.wins / gp : 0.5;
      const pyth = pythWinPct(rec.runsScored, rec.runsAllowed);
      const pythWins = Math.round(pyth * gp);
      const pythLosses = gp - pythWins;
      const luckDiff = rec.wins - pythWins; // positive = lucky, negative = unlucky
      const composite = getCompositeScore(rec);

      const leagueRecords = byLeague.get(teamLeague.get(rec.teamId) ?? '') ?? [];
      const divRecords = byDivision.get(teamDivision.get(rec.teamId) ?? '') ?? [];
      const odds = playoffOdds(rec, divRecords, leagueRecords, gamesRemaining);
      const recentW = rec.last10.filter(x => x === 'W').length;
      const mv = movementArrow(rec);

      return {
        rec,
        team,
        gp,
        wPct,
        pyth,
        pythWins,
        pythLosses,
        luckDiff,
        composite,
        odds,
        recentW,
        mv,
        league: teamLeague.get(rec.teamId) ?? '?',
        division: teamDivision.get(rec.teamId) ?? '?',
      };
    });

    // Sort by composite to get default ranks
    const sortedByComposite = [...ranked].sort((a, b) => b.composite - a.composite);
    const rankMap = new Map(sortedByComposite.map((r, i) => [r.rec.teamId, i + 1]));

    return {
      teams: ranked.map(r => ({ ...r, rank: rankMap.get(r.rec.teamId) ?? 0 })),
      gamesRemaining,
      totalGames: Math.round(totalGames),
    };
  }, [engine, season, teams]);

  const sortedTeams = useMemo(() => {
    if (!data) return [];
    const arr = [...data.teams];
    arr.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'rank': diff = a.rank - b.rank; break;
        case 'wins': diff = b.rec.wins - a.rec.wins; break;
        case 'pct': diff = b.wPct - a.wPct; break;
        case 'pyth': diff = b.pyth - a.pyth; break;
        case 'rdiff': diff = (b.rec.runsScored - b.rec.runsAllowed) - (a.rec.runsScored - a.rec.runsAllowed); break;
        case 'odds': diff = b.odds - a.odds; break;
        case 'form': diff = b.recentW - a.recentW; break;
      }
      return sortAsc ? diff : -diff;
    });
    return arr;
  }, [data, sortKey, sortAsc]);

  const userEntry = data?.teams.find(t => t.rec.teamId === userTeamId);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) { setShowDivisions(false); setSortAsc(a => !a); }
    else { setSortKey(key); setSortAsc(true); }
  };

  if (!engine || !season) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-cream-dim">No franchise loaded.</p>
      </div>
    );
  }

  if (!data || data.teams.length === 0) {
    return (
      <div className="min-h-screen p-6 max-w-5xl mx-auto">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase mb-4">Power Rankings</h1>
        <Panel>
          <p className="font-mono text-cream-dim text-center py-8">
            Play some games to unlock rankings. Sim a few days to see standings data.
          </p>
        </Panel>
      </div>
    );
  }

  const SortBtn = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      onClick={() => toggleSort(k)}
      className={cn(
        'font-mono text-[10px] uppercase tracking-wider transition-colors',
        sortKey === k ? 'text-gold' : 'text-cream-dim/40 hover:text-cream-dim',
      )}
    >
      {label}{sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </button>
  );

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Power Rankings</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {season.year} · Day {season.currentDay}/{season.totalDays} · {data.gamesRemaining} games remaining
          </p>
        </div>
        <div className="flex items-center gap-1 bg-navy-lighter/30 rounded-xl p-1">
          {([['league', 'League', false], ['divisions', 'Divisions', true]] as const).map(([id, label, isDivisions]) => (
            <button
              key={id}
              onClick={() => setShowDivisions(isDivisions)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all',
                showDivisions === isDivisions
                  ? 'bg-gold text-navy shadow-[0_1px_3px_rgba(0,0,0,0.3)]'
                  : 'text-cream-dim hover:text-cream',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Your Team Spotlight */}
      {userEntry && (
        <div className="mb-6 p-4 rounded-xl border border-gold/30 bg-gold/5">
          <p className="font-mono text-[10px] text-gold/60 uppercase tracking-widest mb-2">Your Team</p>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-baseline gap-2">
              <span className={cn('font-display text-4xl font-bold', rankColor(userEntry.rank, data.teams.length))}>
                #{userEntry.rank}
              </span>
              <div>
                <p className="font-display text-lg text-gold tracking-wide">
                  {userEntry.team ? `${userEntry.team.city} ${userEntry.team.name}` : userTeamId}
                </p>
                <p className="font-mono text-xs text-cream-dim">{userEntry.division}</p>
              </div>
            </div>
            <div className="flex gap-5 ml-auto flex-wrap font-mono text-sm">
              <div className="text-center">
                <p className="text-[10px] text-cream-dim/50 uppercase tracking-wider">Record</p>
                <p className="text-cream font-bold">{userEntry.rec.wins}–{userEntry.rec.losses}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-cream-dim/50 uppercase tracking-wider">Run Diff</p>
                <p className={cn('font-bold', (userEntry.rec.runsScored - userEntry.rec.runsAllowed) >= 0 ? 'text-green-light' : 'text-red-400')}>
                  {userEntry.rec.runsScored - userEntry.rec.runsAllowed > 0 ? '+' : ''}{userEntry.rec.runsScored - userEntry.rec.runsAllowed}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-cream-dim/50 uppercase tracking-wider">Pyth W-L</p>
                <p className="text-cream font-bold">{userEntry.pythWins}–{userEntry.pythLosses}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-cream-dim/50 uppercase tracking-wider">Playoff %</p>
                <p className={cn('font-bold', userEntry.odds >= 0.75 ? 'text-gold' : userEntry.odds >= 0.4 ? 'text-green-light' : 'text-red-400')}>
                  {Math.round(userEntry.odds * 100)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-cream-dim/50 uppercase tracking-wider">Last 10</p>
                <p className={cn('font-bold', userEntry.recentW >= 7 ? 'text-green-light' : userEntry.recentW <= 3 ? 'text-red-400' : 'text-cream')}>
                  {userEntry.recentW}–{10 - userEntry.recentW}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-cream-dim/50 uppercase tracking-wider">Luck</p>
                <p className={cn('font-bold', userEntry.luckDiff > 3 ? 'text-orange-400' : userEntry.luckDiff < -3 ? 'text-blue-400' : 'text-cream-dim')}>
                  {userEntry.luckDiff > 0 ? '+' : ''}{userEntry.luckDiff}
                </p>
              </div>
            </div>
          </div>
          {userEntry.luckDiff > 5 && (
            <p className="mt-2 font-mono text-[10px] text-orange-400/70">
              ⚠ Your record is {userEntry.luckDiff}W ahead of your Pythagorean expected wins — regression may be coming.
            </p>
          )}
          {userEntry.luckDiff < -5 && (
            <p className="mt-2 font-mono text-[10px] text-blue-400/70">
              ↑ You're {Math.abs(userEntry.luckDiff)}W behind your Pythagorean projection — expect improvement ahead.
            </p>
          )}
        </div>
      )}

      {/* Division View */}
      {showDivisions && (() => {
        const divGroups = new Map<string, typeof sortedTeams>();
        for (const entry of data.teams) {
          if (!divGroups.has(entry.division)) divGroups.set(entry.division, []);
          divGroups.get(entry.division)!.push(entry);
        }
        for (const [, arr] of divGroups) arr.sort((a, b) => b.wPct - a.wPct || b.rec.wins - a.rec.wins);
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {[...divGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([div, entries]) => (
              <Panel key={div}>
                <h3 className="font-display text-sm text-gold uppercase tracking-wider mb-3">{div}</h3>
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="border-b border-navy-lighter/40 text-cream-dim/50">
                      <th className="text-left py-1">Team</th>
                      <th className="text-right py-1">W-L</th>
                      <th className="text-right py-1 px-2">PCT</th>
                      <th className="text-right py-1">RD</th>
                      <th className="text-right py-1 pl-2">PO%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, i) => {
                      const isUser = entry.rec.teamId === userTeamId;
                      const name = entry.team ? `${entry.team.city} ${entry.team.name}` : entry.rec.teamId;
                      const rd = entry.rec.runsScored - entry.rec.runsAllowed;
                      return (
                        <tr key={entry.rec.teamId} className={cn('border-b border-navy-lighter/10 last:border-0', isUser && 'bg-gold/5')}>
                          <td className="py-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-cream-dim/30 w-3">{i + 1}</span>
                              <span className={cn(isUser ? 'text-gold font-bold' : 'text-cream')}>{name}</span>
                            </div>
                          </td>
                          <td className="text-right tabular-nums text-cream">{entry.rec.wins}–{entry.rec.losses}</td>
                          <td className="text-right tabular-nums text-cream-dim px-2">{entry.gp > 0 ? entry.wPct.toFixed(3).replace(/^0/, '') : '.000'}</td>
                          <td className={cn('text-right tabular-nums', rd > 0 ? 'text-green-light' : rd < 0 ? 'text-red-400' : 'text-cream-dim/40')}>
                            {rd > 0 ? '+' : ''}{rd}
                          </td>
                          <td className={cn('text-right tabular-nums pl-2', entry.odds >= 0.6 ? 'text-gold' : entry.odds >= 0.3 ? 'text-green-light' : 'text-cream-dim/50')}>
                            {Math.round(entry.odds * 100)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
            ))}
          </div>
        );
      })()}

      {/* Rankings Table (League View) */}
      {!showDivisions && <Panel>
        {/* Table header */}
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-navy-lighter">
                <th className="text-left py-2 pr-2 w-8"><SortBtn label="RK" k="rank" /></th>
                <th className="text-left py-2 pr-3 w-6"></th>{/* movement */}
                <th className="text-left py-2">Team</th>
                <th className="text-right py-2 px-2"><SortBtn label="W-L" k="wins" /></th>
                <th className="text-right py-2 px-2"><SortBtn label="PCT" k="pct" /></th>
                <th className="text-left py-2 px-3"><SortBtn label="Run Diff" k="rdiff" /></th>
                <th className="text-right py-2 px-2">Pyth</th>
                <th className="text-right py-2 px-2">Luck</th>
                <th className="text-left py-2 px-3"><SortBtn label="Playoffs" k="odds" /></th>
                <th className="text-left py-2 pl-2"><SortBtn label="L10" k="form" /></th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map(entry => {
                const isUser = entry.rec.teamId === userTeamId;
                const teamName = entry.team ? `${entry.team.city} ${entry.team.name}` : entry.rec.teamId;
                const wPctStr = entry.gp > 0
                  ? (entry.wPct).toFixed(3).replace(/^0/, '')
                  : '.000';

                return (
                  <tr
                    key={entry.rec.teamId}
                    className={cn(
                      'border-b border-navy-lighter/20 last:border-0 transition-colors',
                      isUser ? 'bg-gold/5' : 'hover:bg-navy-lighter/10',
                    )}
                  >
                    <td className={cn('py-2 pr-2 font-bold text-sm', rankColor(entry.rank, data.teams.length))}>
                      {entry.rank}
                    </td>
                    <td className={cn('py-2 pr-2 text-[10px] font-bold', entry.mv.color)}>
                      {entry.mv.arrow}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('font-body text-sm', isUser ? 'text-gold font-bold' : 'text-cream')}>
                          {teamName}
                        </span>
                        {isUser && <span className="text-[9px] text-gold/60 font-mono uppercase">YOU</span>}
                      </div>
                      <p className="text-[10px] text-cream-dim/50">{entry.division}</p>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      <span className="text-cream">{entry.rec.wins}</span>
                      <span className="text-cream-dim/40">–</span>
                      <span className="text-cream">{entry.rec.losses}</span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-cream-dim">{wPctStr}</td>
                    <td className="py-2 px-3">
                      <RunDiffBar rs={entry.rec.runsScored} ra={entry.rec.runsAllowed} />
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-cream-dim">
                      {entry.pythWins}–{entry.pythLosses}
                    </td>
                    <td className={cn(
                      'py-2 px-2 text-right tabular-nums text-[11px] font-bold',
                      entry.luckDiff > 3 ? 'text-orange-400' :
                      entry.luckDiff < -3 ? 'text-blue-400' : 'text-cream-dim/40',
                    )}>
                      {entry.luckDiff > 0 ? '+' : ''}{entry.luckDiff}
                    </td>
                    <td className="py-2 px-3">
                      <OddsBar pct={entry.odds} />
                    </td>
                    <td className="py-2 pl-2">
                      <div className="flex gap-0.5">
                        {entry.rec.last10.map((r, i) => (
                          <span
                            key={i}
                            className={cn(
                              'inline-block w-2 h-2 rounded-sm',
                              r === 'W' ? 'bg-green-light' : 'bg-red-400/60',
                            )}
                            title={r}
                          />
                        ))}
                        {entry.rec.last10.length === 0 && (
                          <span className="text-cream-dim/30">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-navy-lighter/20 flex flex-wrap gap-4 font-mono text-[10px] text-cream-dim/50">
          <span><span className="text-orange-400 font-bold">Luck</span> = Actual W – Pythagorean W (positive = lucky, negative = unlucky)</span>
          <span><span className="text-cream-dim">Pyth</span> = Expected record based on runs scored/allowed</span>
          <span><span className="text-green-light">L10</span> = Last 10 games (green=W, red=L)</span>
        </div>
      </Panel>}
    </div>
  );
}

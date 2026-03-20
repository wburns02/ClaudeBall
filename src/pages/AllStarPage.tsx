import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { StatsTable } from '@/components/ui/StatsTable.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useHistoryStore } from '@/stores/historyStore.ts';
import type { AllStarResult } from '@/stores/historyStore.ts';
import { evaluatePlayer } from '@/engine/gm/TradeEngine.ts';
import { getPlayerName } from '@/engine/types/player.ts';
import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';

// Positions to fill for each All-Star roster
const ASG_POSITIONS = ['C', 'SS', 'CF', '2B', '3B', 'RF', 'LF', '1B', 'DH', 'P'];

interface ASGPlayer {
  player: Player;
  teamId: string;
  teamAbbr: string;
  value: number;
}

function selectAllStarRoster(
  teams: import('@/engine/types/team.ts').Team[],
  targetTeamIds: string[],
  engine: import('@/engine/season/SeasonEngine.ts').SeasonEngine
): ASGPlayer[] {
  const roster: ASGPlayer[] = [];
  const usedIds = new Set<string>();

  for (const pos of ASG_POSITIONS) {
    let best: ASGPlayer | null = null;

    for (const team of teams) {
      if (!targetTeamIds.includes(team.id)) continue;
      const candidates = team.roster.players.filter(
        p => (p.position === pos || (pos === 'DH' && p.position !== 'P')) && !usedIds.has(p.id)
      );

      for (const p of candidates) {
        const value = evaluatePlayer(p);
        if (!best || value > best.value) {
          const t = engine.getTeam(team.id);
          best = { player: p, teamId: team.id, teamAbbr: t?.abbreviation ?? team.id, value };
        }
      }
    }

    if (best) {
      usedIds.add(best.player.id);
      roster.push(best);
    }
  }

  return roster;
}

function simulateASGScore(rng: () => number): [number, number] {
  // Random score, roughly 4–10 runs each
  const homeRuns = 3 + Math.floor(rng() * 8);
  const awayRuns = 3 + Math.floor(rng() * 8);
  if (homeRuns === awayRuns) return [homeRuns + 1, awayRuns]; // no ties
  return [awayRuns, homeRuns];
}

const ASG_ROSTER_COLS = [
  { key: 'pos', label: 'POS', align: 'center' as const },
  { key: 'name', label: 'Player', align: 'left' as const },
  { key: 'team', label: 'Team', align: 'left' as const },
  { key: 'ovr', label: 'OVR', align: 'right' as const },
];

export function AllStarPage() {
  const navigate = useNavigate();
  const { season, engine, teams } = useFranchiseStore();
  const { allStarResults, recordAllStarGame } = useHistoryStore();

  const [gameResult, setGameResult] = useState<AllStarResult | null>(null);

  if (!season || !engine) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">All-Star Game</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">Simulate the mid-season All-Star Game between the league's best players.</p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const leagueStructure = engine.getLeagueStructure();
  const leagues = Object.entries(leagueStructure);

  // Build league team ID sets
  const leagueTeamIds = leagues.map(([, divisions]) => {
    const ids: string[] = [];
    for (const teamIds of Object.values(divisions)) ids.push(...teamIds);
    return ids;
  });

  const allTeams = engine.getAllTeams();

  const league1Name = leagues[0]?.[0] ?? 'American';
  const league2Name = leagues[1]?.[0] ?? 'National';
  const league1Ids = leagueTeamIds[0] ?? [];
  const league2Ids = leagueTeamIds[1] ?? [];

  const asgRoster1 = useMemo(
    () => selectAllStarRoster(allTeams, league1Ids, engine),
    [allTeams, league1Ids, engine]
  );

  const asgRoster2 = useMemo(
    () => selectAllStarRoster(allTeams, league2Ids, engine),
    [allTeams, league2Ids, engine]
  );

  // This year's ASG result (if already played)
  const thisYearResult = allStarResults.find(r => r.year === season.year);
  const ALL_STAR_DAY = 90;
  const isAllStarTime = season.currentDay >= ALL_STAR_DAY;
  const daysUntilASG = Math.max(0, ALL_STAR_DAY - season.currentDay);

  const handlePlayASG = () => {
    const rng = engine.getRng();
    const [awayScore, homeScore] = simulateASGScore(() => rng.next());

    // MVP: weighted random pick from winning roster (higher OVR = more likely, but not guaranteed)
    const winnerRoster = awayScore > homeScore ? asgRoster1 : asgRoster2;
    const totalWeight = winnerRoster.reduce((sum, e) => sum + e.value, 0);
    let pick = rng.next() * totalWeight;
    let mvpEntry = winnerRoster[0]!;
    for (const e of winnerRoster) {
      pick -= e.value;
      if (pick <= 0) { mvpEntry = e; break; }
    }
    const mvpName = mvpEntry ? getPlayerName(mvpEntry.player) : 'Unknown';
    const mvpId = mvpEntry?.player.id ?? '';

    const result: AllStarResult = {
      year: season.year,
      awayScore,
      homeScore,
      homeLeague: league2Name,
      awayLeague: league1Name,
      mvpPlayerId: mvpId,
      mvpPlayerName: mvpName,
    };

    recordAllStarGame(result);
    setGameResult(result);
  };

  const toRows = (roster: ASGPlayer[]) =>
    roster.map(e => ({
      pos: e.player.position,
      name: getPlayerName(e.player),
      team: e.teamAbbr,
      ovr: Math.round(e.value),
    }));

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase">All-Star Game</h1>
        <p className="font-mono text-cream-dim text-sm mt-1">
          {season.year} Midsummer Classic — {league1Name} vs {league2Name}
        </p>
      </div>

      {/* Result Banner */}
      {(thisYearResult || gameResult) && (() => {
        const r = gameResult ?? thisYearResult!;
        const awayWon = r.awayScore > r.homeScore;
        return (
          <div className="mb-6 p-5 rounded-xl border border-gold/50 bg-gold/5">
            <p className="font-display text-gold text-xl tracking-wide uppercase mb-2">
              Final Score
            </p>
            <div className="flex items-center gap-6 font-mono">
              <div className="text-center">
                <p className={cn('text-3xl font-bold', awayWon ? 'text-gold' : 'text-cream')}>{r.awayScore}</p>
                <p className="text-xs text-cream-dim">{league1Name}</p>
              </div>
              <p className="text-cream-dim text-2xl">—</p>
              <div className="text-center">
                <p className={cn('text-3xl font-bold', !awayWon ? 'text-gold' : 'text-cream')}>{r.homeScore}</p>
                <p className="text-xs text-cream-dim">{league2Name}</p>
              </div>
            </div>
            <p className="font-mono text-cream-dim text-sm mt-3">
              MVP: <span className="text-gold font-bold">{r.mvpPlayerName}</span>
            </p>
          </div>
        );
      })()}

      {/* Play Button */}
      {!thisYearResult && !gameResult && (
        <div className="mb-6">
          {isAllStarTime ? (
            <div className="flex items-center gap-4">
              <Button onClick={handlePlayASG} size="lg">
                Play All-Star Game
              </Button>
              <p className="font-mono text-cream-dim text-sm">
                {league1Name} vs {league2Name} — best players from each league
              </p>
            </div>
          ) : (
            <div className="px-4 py-3 rounded-md border border-navy-lighter bg-navy-light font-mono text-sm text-cream-dim">
              All-Star Game unlocks at midseason (Day {ALL_STAR_DAY}).{' '}
              <span className="text-gold">{daysUntilASG} day{daysUntilASG !== 1 ? 's' : ''} remaining.</span>
            </div>
          )}
        </div>
      )}

      {/* Rosters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title={`${league1Name} All-Stars`}>
          <StatsTable columns={ASG_ROSTER_COLS} rows={toRows(asgRoster1)} compact />
        </Panel>
        <Panel title={`${league2Name} All-Stars`}>
          <StatsTable columns={ASG_ROSTER_COLS} rows={toRows(asgRoster2)} compact />
        </Panel>
      </div>

      {/* Past Results */}
      {allStarResults.length > 0 && (
        <Panel title="All-Star Game History" className="mt-6">
          <div className="space-y-2">
            {[...allStarResults].sort((a, b) => b.year - a.year).map(r => (
              <div key={r.year} className="flex items-center justify-between py-2 border-b border-navy-lighter/30 font-mono text-sm">
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
    </div>
  );
}

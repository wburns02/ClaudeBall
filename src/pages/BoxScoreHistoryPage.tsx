import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { StatsTable } from '@/components/ui/StatsTable.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { useStatsStore } from '@/stores/statsStore.ts';
import { cn } from '@/lib/cn.ts';

const BATTER_COLS = [
  { key: 'name', label: 'Player', align: 'left' as const },
  { key: 'pos', label: 'POS', align: 'center' as const },
  { key: 'ab', label: 'AB', align: 'right' as const },
  { key: 'r', label: 'R', align: 'right' as const },
  { key: 'h', label: 'H', align: 'right' as const },
  { key: 'rbi', label: 'RBI', align: 'right' as const },
  { key: 'hr', label: 'HR', align: 'right' as const },
  { key: 'bb', label: 'BB', align: 'right' as const },
  { key: 'so', label: 'SO', align: 'right' as const },
  { key: 'avg', label: 'AVG', align: 'right' as const },
];

const PITCHER_COLS = [
  { key: 'name', label: 'Pitcher', align: 'left' as const },
  { key: 'dec', label: 'DEC', align: 'center' as const },
  { key: 'ip', label: 'IP', align: 'right' as const },
  { key: 'r', label: 'R', align: 'right' as const },
  { key: 'er', label: 'ER', align: 'right' as const },
  { key: 'bb', label: 'BB', align: 'right' as const },
  { key: 'k', label: 'K', align: 'right' as const },
];

export function BoxScoreHistoryPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { season, engine, userTeamId } = useFranchiseStore();
  const getCurrentSeasonStats = useStatsStore(s => s.getCurrentSeasonStats);
  const playerStats = useMemo(() => getCurrentSeasonStats(), [getCurrentSeasonStats]);

  if (!season || !engine || !gameId) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-4">
        <Button onClick={() => navigate('/franchise/game-log')}>Back to Game Log</Button>
      </div>
    );
  }

  const game = season.schedule.find(g => g.id === gameId);

  if (!game || !game.played) {
    return (
      <div className="min-h-screen p-6 max-w-5xl mx-auto">
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Back</Button>
        </div>
        <Panel>
          <p className="text-cream-dim font-mono text-sm text-center py-8">
            {game ? 'This game has not been played yet.' : 'Game not found.'}
          </p>
        </Panel>
      </div>
    );
  }

  const awayTeam = engine.getTeam(game.awayId);
  const homeTeam = engine.getTeam(game.homeId);
  const awayName = awayTeam ? `${awayTeam.city} ${awayTeam.name}` : game.awayId;
  const homeName = homeTeam ? `${homeTeam.city} ${homeTeam.name}` : game.homeId;

  // Reconstruct box score from per-player game logs
  const awayBatters = useMemo(() => {
    const entries = Object.values(playerStats)
      .filter(ps => ps.teamId === game.awayId)
      .map(ps => {
        const log = ps.gameLog.find(l => l.gameId === gameId);
        if (!log || log.ip) return null; // skip pitchers
        const avg = log.ab > 0 ? (log.h / log.ab).toFixed(3).replace(/^0/, '') : '.000';
        return {
          name: ps.playerName,
          pos: ps.position,
          ab: log.ab,
          r: log.r,
          h: log.h,
          rbi: log.rbi,
          hr: log.hr,
          bb: log.bb,
          so: log.so,
          avg,
        };
      })
      .filter(Boolean);
    return entries as NonNullable<typeof entries[number]>[];
  }, [playerStats, gameId, game.awayId]);

  const homeBatters = useMemo(() => {
    const entries = Object.values(playerStats)
      .filter(ps => ps.teamId === game.homeId)
      .map(ps => {
        const log = ps.gameLog.find(l => l.gameId === gameId);
        if (!log || log.ip) return null;
        const avg = log.ab > 0 ? (log.h / log.ab).toFixed(3).replace(/^0/, '') : '.000';
        return {
          name: ps.playerName,
          pos: ps.position,
          ab: log.ab,
          r: log.r,
          h: log.h,
          rbi: log.rbi,
          hr: log.hr,
          bb: log.bb,
          so: log.so,
          avg,
        };
      })
      .filter(Boolean);
    return entries as NonNullable<typeof entries[number]>[];
  }, [playerStats, gameId, game.homeId]);

  const buildPitchers = (teamId: string) =>
    Object.values(playerStats)
      .filter(ps => ps.teamId === teamId)
      .map(ps => {
        const log = ps.gameLog.find(l => l.gameId === gameId);
        if (!log || !log.ip) return null;
        return {
          name: ps.playerName,
          playerId: ps.playerId,
          dec: log.decision ?? '—',
          ip: log.ip,
          ipNum: parseFloat(log.ip),
          r: log.er,
          er: log.er,
          bb: log.bbPitching,
          k: log.kPitching,
        };
      })
      .filter(Boolean)
      // Sort by IP desc so starter appears first
      .sort((a, b) => b!.ipNum - a!.ipNum) as { name: string; playerId: string; dec: string; ip: string; ipNum: number; r: number; er: number; bb: number; k: number }[];

  const awayPitchers = useMemo(() => buildPitchers(game.awayId), [playerStats, gameId, game.awayId]);
  const homePitchers = useMemo(() => buildPitchers(game.homeId), [playerStats, gameId, game.homeId]);

  // Key plays: home runs + notable hitting + W/L pitchers
  const keyPlays = useMemo(() => {
    const plays: { icon: string; text: string; color: string }[] = [];
    for (const ps of Object.values(playerStats)) {
      const log = ps.gameLog.find(l => l.gameId === gameId);
      if (!log) continue;
      const teamName = ps.teamId === game.awayId ? awayName : homeName;
      if (log.hr > 0) {
        plays.push({ icon: '💥', text: `${ps.playerName} — ${log.hr > 1 ? log.hr + '-run HR' : 'HR'}${log.rbi > 1 ? `, ${log.rbi} RBI` : ''} (${teamName})`, color: 'text-gold' });
      }
      if (!log.ip && log.h >= 3) {
        plays.push({ icon: '🔥', text: `${ps.playerName} — ${log.h}H, ${log.rbi} RBI (${teamName})`, color: 'text-green-light' });
      }
    }
    // W/L decisions from pitching logs
    for (const ps of Object.values(playerStats)) {
      const log = ps.gameLog.find(l => l.gameId === gameId);
      if (!log || !log.ip) continue;
      if (log.decision === 'W') {
        plays.push({ icon: '⚾', text: `W: ${ps.playerName} ${log.ip} IP, ${log.er} ER, ${log.kPitching} K`, color: 'text-blue-400' });
      } else if (log.decision === 'L') {
        plays.push({ icon: '⚾', text: `L: ${ps.playerName} ${log.ip} IP, ${log.er} ER, ${log.kPitching} K`, color: 'text-cream-dim' });
      } else if (log.decision === 'S') {
        plays.push({ icon: '🔒', text: `SV: ${ps.playerName} ${log.ip} IP, ${log.kPitching} K`, color: 'text-gold' });
      }
    }
    return plays;
  }, [playerStats, gameId, awayName, homeName, game.awayId]);

  const awayWon = (game.awayScore ?? 0) > (game.homeScore ?? 0);
  const isUserAway = game.awayId === userTeamId;
  const isUserHome = game.homeId === userTeamId;

  // Build normalized inning arrays (pad/trim to exactly 9)
  const awayInn = useMemo(() => {
    const arr = game.awayInnings ?? [];
    return Array.from({ length: 9 }, (_, i) => arr[i] ?? null);
  }, [game.awayInnings]);

  const homeInn = useMemo(() => {
    const arr = game.homeInnings ?? [];
    return Array.from({ length: 9 }, (_, i) => {
      const val = arr[i];
      if (val === undefined) return null;
      if (val === -1) return 'x' as const;  // walk-off: home didn't bat in 9th
      return val;
    });
  }, [game.homeInnings]);

  const hasInningData = (game.awayInnings?.length ?? 0) > 0;

  const noStatsAvailable = awayBatters.length === 0 && homeBatters.length === 0;

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Back */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Back</Button>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Box Score</h1>
        <p className="font-mono text-cream-dim text-sm mt-1">
          {season.year} Season — Day {game.date}
        </p>
      </div>

      {/* Line Score */}
      <Panel className="mb-4">
        {hasInningData ? (
          /* Full inning-by-inning line score */
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] font-mono text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-cream-dim/50 text-xs font-normal py-1 pr-4 w-40">Team</th>
                  {[1,2,3,4,5,6,7,8,9].map(n => (
                    <th key={n} className="text-center text-cream-dim/50 text-xs font-normal py-1 w-7">{n}</th>
                  ))}
                  <th className="text-center text-cream-dim/50 text-xs font-normal py-1 pl-2 border-l border-navy-lighter w-10">R</th>
                </tr>
              </thead>
              <tbody>
                {/* Away row */}
                <tr className="border-t border-navy-lighter/40">
                  <td className={cn('py-2 pr-4 font-bold text-sm', awayWon ? 'text-gold' : 'text-cream-dim')}>
                    {awayName}{isUserAway && <span className="text-gold/60 text-xs ml-1">(You)</span>}
                  </td>
                  {awayInn.map((runs, i) => (
                    <td key={i} className={cn(
                      'text-center py-2 text-sm',
                      runs !== null && runs > 0 ? 'text-cream font-bold' : 'text-cream-dim/40',
                    )}>
                      {runs === null ? '-' : runs}
                    </td>
                  ))}
                  <td className={cn(
                    'text-center py-2 text-lg font-bold pl-2 border-l border-navy-lighter',
                    awayWon ? 'text-gold' : 'text-cream',
                  )}>
                    {game.awayScore}
                  </td>
                </tr>
                {/* Home row */}
                <tr className="border-t border-navy-lighter/40">
                  <td className={cn('py-2 pr-4 font-bold text-sm', !awayWon ? 'text-gold' : 'text-cream-dim')}>
                    {homeName}{isUserHome && <span className="text-gold/60 text-xs ml-1">(You)</span>}
                  </td>
                  {homeInn.map((runs, i) => (
                    <td key={i} className={cn(
                      'text-center py-2 text-sm',
                      runs === 'x' ? 'text-cream-dim/25 italic' :
                      runs !== null && runs > 0 ? 'text-cream font-bold' : 'text-cream-dim/40',
                    )}>
                      {runs === null ? '-' : runs}
                    </td>
                  ))}
                  <td className={cn(
                    'text-center py-2 text-lg font-bold pl-2 border-l border-navy-lighter',
                    !awayWon ? 'text-gold' : 'text-cream',
                  )}>
                    {game.homeScore}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          /* Fallback: simple final score for older games */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={cn('font-mono text-lg font-bold', awayWon ? 'text-gold' : 'text-cream-dim', isUserAway && 'text-gold')}>
                {awayName}{isUserAway && ' (You)'}
              </span>
              <span className={cn('font-mono text-3xl font-bold', awayWon ? 'text-gold' : 'text-cream')}>{game.awayScore}</span>
            </div>
            <div className="h-px bg-navy-lighter" />
            <div className="flex items-center justify-between">
              <span className={cn('font-mono text-lg font-bold', !awayWon ? 'text-gold' : 'text-cream-dim', isUserHome && 'text-gold')}>
                {homeName}{isUserHome && ' (You)'}
              </span>
              <span className={cn('font-mono text-3xl font-bold', !awayWon ? 'text-gold' : 'text-cream')}>{game.homeScore}</span>
            </div>
          </div>
        )}
      </Panel>

      {/* Key Plays */}
      <Panel title="Key Plays" className="mb-4">
        {keyPlays.length > 0 ? (
          <div className="space-y-1.5">
            {keyPlays.map((play, i) => (
              <div key={i} className="flex items-start gap-2 font-mono text-sm">
                <span className="shrink-0 mt-0.5">{play.icon}</span>
                <span className={play.color}>{play.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-mono text-xs text-cream-dim/40 py-2">
            No detailed play data available for this game.
          </p>
        )}
      </Panel>

      {/* Box Scores */}
      {noStatsAvailable ? (
        <Panel>
          <div className="text-center py-10">
            <p className="font-mono text-cream-dim text-sm mb-2">
              Detailed player stats unavailable for this game.
            </p>
            <p className="font-mono text-cream-dim/40 text-xs">
              Per-game stats are kept for the most recent 19 games per player.
              <br />
              Older games show only the final score.
            </p>
          </div>
        </Panel>
      ) : (
        <div className="space-y-4">
          {/* Away batting */}
          <Panel title={`${awayName} Batting`}>
            {awayBatters.length > 0 ? (
              <StatsTable columns={BATTER_COLS} rows={awayBatters} compact />
            ) : (
              <p className="font-mono text-cream-dim text-sm">No batting data</p>
            )}
            {awayPitchers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-navy-lighter">
                <p className="font-mono text-xs text-cream-dim/60 uppercase tracking-widest mb-2">Pitching</p>
                <StatsTable columns={PITCHER_COLS} rows={awayPitchers} compact />
              </div>
            )}
          </Panel>

          {/* Home batting */}
          <Panel title={`${homeName} Batting`}>
            {homeBatters.length > 0 ? (
              <StatsTable columns={BATTER_COLS} rows={homeBatters} compact />
            ) : (
              <p className="font-mono text-cream-dim text-sm">No batting data</p>
            )}
            {homePitchers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-navy-lighter">
                <p className="font-mono text-xs text-cream-dim/60 uppercase tracking-widest mb-2">Pitching</p>
                <StatsTable columns={PITCHER_COLS} rows={homePitchers} compact />
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

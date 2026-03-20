import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';
import type { ScheduledGame } from '@/engine/season/index.ts';

// ── Helpers ──────────────────────────────────────────────────────────────────

function dayLabel(day: number, currentDay: number): string {
  if (day === currentDay) return `Day ${day} (Today)`;
  if (day === currentDay - 1) return `Day ${day} (Yesterday)`;
  return `Day ${day}`;
}

function scoreColor(score: number, opponentScore: number) {
  if (score > opponentScore) return 'text-green-light font-bold';
  if (score < opponentScore) return 'text-red-400';
  return 'text-cream';
}

// ── Game card ─────────────────────────────────────────────────────────────────

interface GameCardProps {
  game: ScheduledGame;
  awayAbbr: string;
  homeAbbr: string;
  awayRecord: { wins: number; losses: number } | null;
  homeRecord: { wins: number; losses: number } | null;
  isUserTeam: (teamId: string) => boolean;
  onClick?: () => void;
}

function GameCard({ game, awayAbbr, homeAbbr, awayRecord, homeRecord, isUserTeam, onClick }: GameCardProps) {
  const played = game.played && game.awayScore !== undefined && game.homeScore !== undefined;
  const userAway = isUserTeam(game.awayId);
  const userHome = isUserTeam(game.homeId);
  const hasUser = userAway || userHome;

  return (
    <div
      onClick={played && onClick ? onClick : undefined}
      className={cn(
        'rounded-lg border px-3 py-2.5 transition-all',
        played && onClick ? 'cursor-pointer hover:border-cream/40' : '',
        hasUser
          ? 'border-gold/40 bg-gold/5'
          : 'border-navy-lighter/40 bg-navy-lighter/10',
      )}
    >
      {/* Away team row */}
      <div className="flex items-center gap-2">
        <span className={cn(
          'font-mono text-xs w-4 text-cream-dim/60',
        )}>@</span>
        <span className={cn(
          'font-mono text-xs tracking-wider uppercase flex-1',
          userAway ? 'text-gold font-bold' : 'text-cream',
        )}>
          {awayAbbr}
        </span>
        {awayRecord && (
          <span className="font-mono text-[10px] text-cream-dim/60 w-12 text-right">
            {awayRecord.wins}-{awayRecord.losses}
          </span>
        )}
        {played ? (
          <span className={cn(
            'font-mono text-sm w-6 text-right tabular-nums',
            scoreColor(game.awayScore!, game.homeScore!),
          )}>
            {game.awayScore}
          </span>
        ) : (
          <span className="font-mono text-xs text-cream-dim/40 w-6 text-right">–</span>
        )}
      </div>

      {/* Home team row */}
      <div className="flex items-center gap-2 mt-1">
        <span className="font-mono text-xs w-4 text-cream-dim/60">H</span>
        <span className={cn(
          'font-mono text-xs tracking-wider uppercase flex-1',
          userHome ? 'text-gold font-bold' : 'text-cream',
        )}>
          {homeAbbr}
        </span>
        {homeRecord && (
          <span className="font-mono text-[10px] text-cream-dim/60 w-12 text-right">
            {homeRecord.wins}-{homeRecord.losses}
          </span>
        )}
        {played ? (
          <span className={cn(
            'font-mono text-sm w-6 text-right tabular-nums',
            scoreColor(game.homeScore!, game.awayScore!),
          )}>
            {game.homeScore}
          </span>
        ) : (
          <span className="font-mono text-xs text-cream-dim/40 w-6 text-right">–</span>
        )}
      </div>

      {/* Status */}
      <div className="mt-1.5 flex items-center justify-between">
        {played ? (
          <span className="font-mono text-[9px] text-cream-dim/50 uppercase tracking-wider">Final</span>
        ) : (
          <span className="font-mono text-[9px] text-cream-dim/40 uppercase tracking-wider">Scheduled</span>
        )}
        {played && onClick && (
          <span className="font-mono text-[9px] text-gold/60 uppercase tracking-wider">Box Score →</span>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function LeagueScoreboardPage() {
  const navigate = useNavigate();
  const { season, engine, userTeamId } = useFranchiseStore();

  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="font-display text-gold text-xl">League Scoreboard</p>
        <p className="font-mono text-cream-dim text-sm text-center max-w-xs">
          Live scores and results from across the league, updated each simulated day.
        </p>
        <p className="font-mono text-cream-dim/60 text-xs">No franchise loaded.</p>
        <Button onClick={() => navigate('/franchise')}>Go to Dashboard</Button>
      </div>
    );
  }

  const currentDay = season.currentDay;
  const activeDay = selectedDay ?? currentDay;

  // Build a lookup: teamId → abbreviation
  const teamMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const team of engine.getAllTeams()) {
      map.set(team.id, team.abbreviation);
    }
    return map;
  }, [engine]);

  // Days that have at least one played game (for the day picker)
  const playedDays = useMemo(() => {
    const days = new Set<number>();
    for (const g of season.schedule) {
      if (g.played) days.add(g.date);
    }
    return Array.from(days).sort((a, b) => a - b);
  }, [season.schedule]);

  // All days that have games (including unplayed)
  const allGameDays = useMemo(() => {
    const days = new Set<number>();
    for (const g of season.schedule) days.add(g.date);
    return Array.from(days).sort((a, b) => a - b);
  }, [season.schedule]);

  // Games on the selected day
  const dayGames = useMemo(
    () => season.schedule.filter(g => g.date === activeDay),
    [season.schedule, activeDay],
  );

  const playedCount = dayGames.filter(g => g.played).length;

  function getRecord(teamId: string) {
    const r = season!.standings.getRecord(teamId);
    return r ? { wins: r.wins, losses: r.losses } : null;
  }

  function isUserTeam(teamId: string) {
    return teamId === userTeamId;
  }

  // Navigable days: show last 14 days + current + next few upcoming
  const navDays = useMemo(() => {
    const start = Math.max(1, currentDay - 13);
    const end = Math.min(season.totalDays, currentDay + 6);
    return allGameDays.filter(d => d >= start && d <= end);
  }, [allGameDays, currentDay, season.totalDays]);

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Scoreboard</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            League-wide results · Day {currentDay} of {season.totalDays}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => navigate('/franchise/schedule')}>Schedule</Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/franchise')}>Dashboard</Button>
        </div>
      </div>

      {/* Day picker */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
          {navDays.map(day => {
            const isActive = day === activeDay;
            const isCurrent = day === currentDay;
            const isPlayed = playedDays.includes(day);
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-md font-mono text-xs transition-all border',
                  isActive
                    ? 'bg-gold text-navy border-gold font-bold'
                    : isCurrent
                    ? 'border-gold/40 text-gold hover:bg-gold/10'
                    : isPlayed
                    ? 'border-navy-lighter/40 text-cream hover:bg-navy-lighter/20'
                    : 'border-navy-lighter/20 text-cream-dim/50 hover:bg-navy-lighter/10',
                )}
              >
                {isCurrent ? `Day ${day} ★` : `Day ${day}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Games Today', value: dayGames.length, color: 'text-cream' },
          { label: 'Final', value: playedCount, color: 'text-green-light' },
          { label: 'Scheduled', value: dayGames.length - playedCount, color: 'text-cream-dim' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-navy-light border border-navy-lighter rounded-lg px-4 py-3 text-center">
            <p className={cn('font-display text-2xl font-bold', color)}>{value}</p>
            <p className="font-mono text-xs text-cream-dim mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Games grid */}
      {dayGames.length === 0 ? (
        <Panel title={dayLabel(activeDay, currentDay)}>
          <div className="text-center py-12">
            <p className="font-display text-cream-dim text-lg">No games on Day {activeDay}</p>
            <p className="font-mono text-cream-dim/60 text-xs mt-2">
              {activeDay < currentDay
                ? 'Off day in the schedule.'
                : 'Simulate days to see results here.'}
            </p>
          </div>
        </Panel>
      ) : (
        <Panel title={`${dayLabel(activeDay, currentDay)} — ${dayGames.length} games`}>
          {playedCount === 0 && activeDay >= currentDay && (
            <div className="mb-4 px-3 py-2 rounded-md bg-navy-lighter/20 border border-navy-lighter/40">
              <p className="font-mono text-xs text-cream-dim">
                Simulate from the Dashboard to populate today's scores.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {dayGames.map(game => (
              <GameCard
                key={game.id}
                game={game}
                awayAbbr={teamMap.get(game.awayId) ?? game.awayId.slice(0, 3).toUpperCase()}
                homeAbbr={teamMap.get(game.homeId) ?? game.homeId.slice(0, 3).toUpperCase()}
                awayRecord={getRecord(game.awayId)}
                homeRecord={getRecord(game.homeId)}
                isUserTeam={isUserTeam}
                onClick={game.played ? () => navigate(`/franchise/box-score/${game.id}`) : undefined}
              />
            ))}
          </div>
        </Panel>
      )}

      {/* Season overview strip */}
      {playedDays.length > 0 && (
        <div className="mt-6">
          <Panel title="Season Results">
            <p className="font-mono text-xs text-cream-dim mb-3">
              {playedDays.length} days played · click a day to view scores
            </p>
            <div className="flex flex-wrap gap-1.5">
              {allGameDays.map(day => {
                const isPlayed = playedDays.includes(day);
                const isActive = day === activeDay;
                const isCurrent = day === currentDay;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    title={`Day ${day}${isPlayed ? ' — Final' : ''}`}
                    className={cn(
                      'w-7 h-7 rounded text-[9px] font-mono transition-all',
                      isActive
                        ? 'bg-gold text-navy font-bold'
                        : isCurrent
                        ? 'bg-gold/20 text-gold border border-gold/40'
                        : isPlayed
                        ? 'bg-navy-lighter/40 text-cream hover:bg-navy-lighter/60'
                        : 'bg-navy-lighter/10 text-cream-dim/30 hover:bg-navy-lighter/20',
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

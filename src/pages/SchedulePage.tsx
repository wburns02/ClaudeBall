import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { useFranchiseStore } from '@/stores/franchiseStore.ts';
import { cn } from '@/lib/cn.ts';
import type { ScheduledGame } from '@/engine/season/index.ts';

// Milestone days
const MILESTONES = [
  { day: 90, label: 'All-Star Break', color: 'text-gold' },
  { day: 120, label: 'Trade Deadline', color: 'text-red-400' },
  { day: 183, label: 'Playoffs', color: 'text-green-light' },
];

const DAYS_PER_WEEK = 7;
const WEEKS_PER_VIEW = 4; // 4 weeks = 28 days per "month" view


export function SchedulePage() {
  const navigate = useNavigate();
  const { season, engine, userTeamId, advanceDay, simDays } = useFranchiseStore();

  const [weekOffset, setWeekOffset] = useState(0); // in weeks from week 1
  // Auto-scroll to current week on mount
  useEffect(() => {
    if (season) {
      const weekIdx = Math.max(0, Math.floor((season.currentDay - 1) / DAYS_PER_WEEK) - 1);
      setWeekOffset(weekIdx);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!season || !engine || !userTeamId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => navigate('/')}>Back to Menu</Button>
      </div>
    );
  }

  const currentDay = season.currentDay;
  const totalDays = season.totalDays;

  // Current week (0-indexed)
  const currentWeekIdx = Math.floor((currentDay - 1) / DAYS_PER_WEEK);

  // Display window: from weekOffset, show WEEKS_PER_VIEW weeks
  const startWeek = weekOffset;
  const startDay = startWeek * DAYS_PER_WEEK + 1;
  const endDay = startDay + WEEKS_PER_VIEW * DAYS_PER_WEEK - 1;

  // Build day→games map for fast lookup
  const gamesByDay = useMemo(() => {
    const map = new Map<number, ScheduledGame[]>();
    for (const g of season.schedule) {
      if (!map.has(g.date)) map.set(g.date, []);
      map.get(g.date)!.push(g);
    }
    return map;
  }, [season.schedule]);

  const weeks = useMemo(() => {
    const result: number[][] = [];
    for (let w = 0; w < WEEKS_PER_VIEW; w++) {
      const week: number[] = [];
      for (let d = 0; d < DAYS_PER_WEEK; d++) {
        const day = startDay + w * DAYS_PER_WEEK + d;
        if (day >= 1 && day <= totalDays) week.push(day);
      }
      result.push(week);
    }
    return result;
  }, [startDay, totalDays]);

  const handleDayClick = (day: number) => {
    const games = gamesByDay.get(day) ?? [];
    const userGame = games.find(g => g.awayId === userTeamId || g.homeId === userTeamId);
    if (!userGame) return;

    if (userGame.played) {
      // Navigate directly to box score for played games
      navigate(`/franchise/box-score/${userGame.id}`);
    }
    // Upcoming games handled by action buttons
  };

  const handlePlayGame = async (game: ScheduledGame) => {
    // Advance the day — advanceDay returns the user's game for that day
    const userGame = advanceDay();
    // Use the returned game id, falling back to the clicked game if day was already advanced
    navigate(`/game/live?gameId=${(userGame ?? game).id}`);
  };

  const handleSimGame = (game: ScheduledGame) => {
    // Sim all days up to and including the selected game's day
    const daysToSim = game.date - currentDay;
    if (daysToSim > 0) simDays(daysToSim);
    else simDays(1); // fallback: sim at least one day
  };

  const maxWeekOffset = Math.ceil(totalDays / DAYS_PER_WEEK) - WEEKS_PER_VIEW;

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl text-gold tracking-wide uppercase">Schedule</h1>
          <p className="font-mono text-cream-dim text-sm mt-1">
            {season.year} Season — Day {currentDay} of {totalDays}
          </p>
        </div>

        {/* Season Progress Bar */}
        <div className="w-72">
          <div className="flex justify-between font-mono text-xs text-cream-dim mb-1">
            <span>Day {currentDay}</span>
            <span>Day {totalDays}</span>
          </div>
          <div className="relative h-4 bg-navy-lighter rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gold/70 rounded-full transition-all"
              style={{ width: `${(currentDay / totalDays) * 100}%` }}
            />
            {MILESTONES.map(m => (
              <div
                key={m.day}
                className="absolute top-0 bottom-0 w-px bg-cream-dim/40"
                style={{ left: `${(m.day / totalDays) * 100}%` }}
                title={m.label}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {MILESTONES.map(m => (
              <span key={m.day} className={cn('font-mono text-[10px]', m.color)}>
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWeekOffset(w => Math.max(0, w - WEEKS_PER_VIEW))}
          disabled={weekOffset === 0}
        >
          ← Prev
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setWeekOffset(Math.max(0, currentWeekIdx))}
        >
          Today
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWeekOffset(w => Math.min(maxWeekOffset, w + WEEKS_PER_VIEW))}
          disabled={weekOffset >= maxWeekOffset}
        >
          Next →
        </Button>
        <span className="font-mono text-cream-dim text-sm">
          Days {startDay}–{Math.min(endDay, totalDays)}
        </span>
      </div>

      {/* Milestone legend */}
      <div className="flex gap-4 mb-4">
        {MILESTONES.map(m => (
          <div key={m.day} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-cream-dim/40 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-cream-dim/60 rounded-full" />
            </div>
            <span className={cn('font-mono text-xs', m.color)}>{m.label} (Day {m.day})</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="space-y-2">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 gap-1">
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
            <div key={d} className="text-center font-mono text-xs text-cream-dim/50 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map(day => {
              const games = gamesByDay.get(day) ?? [];
              const userGame = games.find(g => g.awayId === userTeamId || g.homeId === userTeamId);
              const isToday = day === currentDay;
              const isPast = day < currentDay;
              const isFuture = day > currentDay;
              const milestone = MILESTONES.find(m => m.day === day);

              let resultColor = '';
              let resultLabel = '';
              if (userGame?.played) {
                const isHome = userGame.homeId === userTeamId;
                const userScore = isHome ? (userGame.homeScore ?? 0) : (userGame.awayScore ?? 0);
                const oppScore = isHome ? (userGame.awayScore ?? 0) : (userGame.homeScore ?? 0);
                const won = userScore > oppScore;
                resultColor = won ? 'text-green-light' : 'text-red';
                resultLabel = won ? 'W' : 'L';
              }

              return (
                <div
                  key={day}
                  className={cn(
                    'min-h-[80px] rounded-lg border p-1.5 transition-all',
                    isToday && 'border-gold bg-gold/10',
                    !isToday && isPast && 'border-navy-lighter/30 bg-navy-light/20',
                    !isToday && isFuture && 'border-navy-lighter/50 bg-navy-light/40',
                    milestone && !isToday && 'border-dashed border-cream-dim/30',
                    userGame && !userGame.played && isFuture && 'cursor-pointer hover:border-gold/40',
                    userGame?.played && 'cursor-pointer hover:border-cream-dim/60',
                  )}
                  onClick={() => userGame && handleDayClick(day)}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      'font-mono text-xs font-bold',
                      isToday ? 'text-gold' : 'text-cream-dim/60',
                    )}>
                      {day}
                    </span>
                    {milestone && (
                      <span className={cn('font-mono text-[9px] truncate ml-1', milestone.color)}>
                        {milestone.label.split(' ')[0]}
                      </span>
                    )}
                  </div>

                  {/* Games */}
                  {games.length === 0 && (
                    <p className="font-mono text-[10px] text-cream-dim/30 text-center mt-2">—</p>
                  )}

                  {games.slice(0, 3).map(g => {
                    const isUserG = g.awayId === userTeamId || g.homeId === userTeamId;
                    const isHome = g.homeId === userTeamId;
                    const opp = isHome ? engine.getTeam(g.awayId) : engine.getTeam(g.homeId);
                    const abbr = opp?.abbreviation ?? (isHome ? g.awayId : g.homeId).slice(0, 3);

                    if (!isUserG) {
                      // Non-user game — small dot
                      return (
                        <div key={g.id} className="text-[9px] font-mono text-cream-dim/30 truncate">
                          {g.played ? `${g.awayScore}-${g.homeScore}` : '···'}
                        </div>
                      );
                    }

                    // User game
                    return (
                      <div key={g.id} className="mt-0.5">
                        <div className="flex items-center gap-1">
                          <span className={cn('font-mono text-[10px] font-bold', resultColor || 'text-cream')}>
                            {resultLabel || (isHome ? 'vs' : '@')}
                          </span>
                          <span className="font-mono text-[10px] text-cream truncate">{abbr}</span>
                        </div>
                        {g.played && (
                          <div className="font-mono text-[10px] text-cream-dim">
                            {g.awayScore}-{g.homeScore}
                          </div>
                        )}
                        {!g.played && isFuture && (
                          <div className="flex gap-1 mt-0.5">
                            {day === currentDay + 1 && (
                              <button
                                className="font-mono text-[9px] text-gold bg-gold/10 rounded px-1 hover:bg-gold/20 cursor-pointer"
                                onClick={e => { e.stopPropagation(); handlePlayGame(g); }}
                              >
                                Play
                              </button>
                            )}
                            <button
                              className={cn(
                                'font-mono text-[9px] rounded px-1 cursor-pointer',
                                day === currentDay + 1
                                  ? 'text-cream-dim bg-navy-lighter/30 hover:bg-navy-lighter/60'
                                  : 'text-blue bg-blue/10 hover:bg-blue/20',
                              )}
                              onClick={e => { e.stopPropagation(); handleSimGame(g); }}
                            >
                              {day === currentDay + 1 ? 'Sim' : `Sim→${day}`}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {/* Fill empty slots if week has fewer than 7 days */}
            {week.length < 7 && Array.from({ length: 7 - week.length }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px]" />
            ))}
          </div>
        ))}
      </div>

    </div>
  );
}

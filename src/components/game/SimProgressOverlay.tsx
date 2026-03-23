/**
 * SimProgressOverlay — shows live simulation progress during multi-day sims.
 * Displays a progress bar, current day, and flashing game results.
 */
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn.ts';

interface SimDay {
  day: number;
  userWon: boolean | null; // null = no game that day
  userScore?: number;
  oppScore?: number;
  oppAbbr?: string;
}

interface Props {
  startDay: number;
  endDay: number;
  days: SimDay[];
  onComplete: () => void;
  teamAbbr: string;
}

export function SimProgressOverlay({ startDay, endDay, days, onComplete, teamAbbr }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [complete, setComplete] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (days.length === 0) { onComplete(); return; }

    intervalRef.current = window.setInterval(() => {
      setCurrentIdx(prev => {
        if (prev >= days.length - 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setComplete(true);
          return prev;
        }
        return prev + 1;
      });
    }, 150); // Fast ticker — 150ms per day

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [days.length, onComplete]);

  const totalDays = endDay - startDay;
  const progress = totalDays > 0 ? ((currentIdx + 1) / days.length) * 100 : 100;
  const current = days[currentIdx];

  // Win/loss tally so far
  let wins = 0, losses = 0;
  for (let i = 0; i <= currentIdx; i++) {
    if (days[i]?.userWon === true) wins++;
    else if (days[i]?.userWon === false) losses++;
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="max-w-sm w-full mx-4 rounded-2xl border border-gold/30 bg-navy-light overflow-hidden shadow-2xl">
        {/* Progress bar */}
        <div className="h-1.5 bg-navy-lighter/30">
          <div className="h-full bg-gold transition-all duration-150 ease-linear" style={{ width: `${progress}%` }} />
        </div>

        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="text-center">
            <p className="font-mono text-[10px] text-gold/50 uppercase tracking-widest">Simulating</p>
            <p className="font-display text-xl text-gold uppercase tracking-wide mt-1">
              {complete ? 'Sim Complete' : `Day ${current?.day ?? startDay}`}
            </p>
          </div>

          {/* Current game result */}
          {current && current.userWon !== null && (
            <div className={cn(
              'rounded-lg border p-3 text-center transition-all duration-150',
              current.userWon ? 'border-green-light/30 bg-green-900/10' : 'border-red-400/30 bg-red-900/10',
            )}>
              <div className="flex items-center justify-center gap-3">
                <span className={cn('font-mono text-lg font-bold', current.userWon ? 'text-green-light' : 'text-red-400')}>
                  {teamAbbr} {current.userScore}
                </span>
                <span className="font-mono text-xs text-cream-dim/40">@</span>
                <span className="font-mono text-lg font-bold text-cream">
                  {current.oppAbbr} {current.oppScore}
                </span>
              </div>
              <p className={cn('font-mono text-xs mt-1', current.userWon ? 'text-green-light/70' : 'text-red-400/70')}>
                {current.userWon ? 'WIN' : 'LOSS'}
              </p>
            </div>
          )}

          {current && current.userWon === null && (
            <div className="rounded-lg border border-navy-lighter/30 p-3 text-center">
              <p className="font-mono text-sm text-cream-dim/50">Off Day</p>
            </div>
          )}

          {/* Running record */}
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="font-mono text-2xl font-bold text-cream">{wins}-{losses}</p>
              <p className="font-mono text-[9px] text-cream-dim/50">This Period</p>
            </div>
            <div className="text-center">
              <p className="font-mono text-sm text-cream-dim">{currentIdx + 1}/{days.length}</p>
              <p className="font-mono text-[9px] text-cream-dim/50">Days</p>
            </div>
          </div>

          {/* Complete button */}
          {complete && (
            <button
              onClick={onComplete}
              className="w-full py-2.5 rounded-lg bg-gold/15 border border-gold/30 text-gold text-sm font-mono font-semibold hover:bg-gold/25 transition-colors cursor-pointer"
            >
              View Results
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

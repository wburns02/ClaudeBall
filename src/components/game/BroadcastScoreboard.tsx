import { cn } from '@/lib/cn.ts';
import type { GameState } from '@/engine/types/index.ts';
import { getPlayer } from '@/engine/types/team.ts';

interface BroadcastScoreboardProps {
  game: GameState;
  currentCount: { balls: number; strikes: number };
  userTeam: 'home' | 'away' | null;
  gameOver: boolean;
  className?: string;
}

/** Small rotated square representing a base. */
function BasePip({ occupied }: { occupied: boolean }) {
  return (
    <div
      className={cn(
        'w-3 h-3 rotate-45 border',
        occupied
          ? 'bg-gold border-gold'
          : 'border-cream-dim/40 bg-transparent'
      )}
    />
  );
}

export function BroadcastScoreboard({
  game,
  currentCount,
  userTeam,
  gameOver,
  className,
}: BroadcastScoreboardProps) {
  const { inning } = game;
  const awayScore = game.score.away.reduce((a, b) => a + b, 0);
  const homeScore = game.score.home.reduce((a, b) => a + b, 0);

  const isTop = inning.half === 'top';
  const pitchingTeam = isTop ? game.home : game.away;
  const battingTeam = isTop ? game.away : game.home;

  const pitcher = getPlayer(pitchingTeam, pitchingTeam.pitcherId);

  // Current batter
  const batterIndex = isTop
    ? game.currentBatterIndex.away
    : game.currentBatterIndex.home;
  const batterSpot = battingTeam.lineup[batterIndex % battingTeam.lineup.length];
  const batter = batterSpot ? getPlayer(battingTeam, batterSpot.playerId) : undefined;

  const isAwayUser = userTeam === 'away';
  const isHomeUser = userTeam === 'home';

  return (
    <div
      className={cn(
        'select-none pointer-events-none',
        className
      )}
      style={{
        background: 'rgba(10,15,26,0.88)',
        border: '1px solid rgba(212,168,67,0.25)',
        borderRadius: 6,
        padding: '10px 14px',
        minWidth: 280,
        maxWidth: 320,
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Score row */}
      <div className="flex items-center gap-3 font-mono mb-2">
        {/* Away */}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-xs uppercase tracking-widest font-bold',
              isAwayUser ? 'text-gold' : 'text-cream'
            )}
          >
            {game.away.abbreviation}
          </span>
          <span className={cn(
            'text-2xl font-bold leading-none',
            isAwayUser ? 'text-gold' : 'text-cream'
          )}>
            {awayScore}
          </span>
        </div>

        <span className="text-cream-dim/40 text-lg">|</span>

        {/* Home */}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-xs uppercase tracking-widest font-bold',
              isHomeUser ? 'text-gold' : 'text-cream'
            )}
          >
            {game.home.abbreviation}
          </span>
          <span className={cn(
            'text-2xl font-bold leading-none',
            isHomeUser ? 'text-gold' : 'text-cream'
          )}>
            {homeScore}
          </span>
        </div>

        <span className="text-cream-dim/40 text-lg">|</span>

        {/* Inning */}
        {gameOver ? (
          <span className="text-gold text-xs font-bold uppercase tracking-wide">FINAL</span>
        ) : (
          <div className="flex flex-col items-center leading-none">
            <span className="text-gold text-xs font-mono">
              {inning.half === 'top' ? '▲' : '▼'}{inning.inning}
            </span>
            <span className="text-cream-dim/70 text-[10px] font-mono mt-0.5">
              {inning.outs} OUT{inning.outs !== 1 ? 'S' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '6px 0' }} />

      {/* Count + Bases row */}
      {!gameOver && (
        <div className="flex items-center justify-between gap-3 mb-2">
          {/* Count */}
          <div className="flex items-center gap-2 font-mono">
            <span className="text-[10px] text-cream-dim uppercase tracking-widest">Count</span>
            <span className="text-lg font-bold">
              <span className="text-green-light">{currentCount.balls}</span>
              <span className="text-cream-dim/50">-</span>
              <span className="text-red">{currentCount.strikes}</span>
            </span>
          </div>

          {/* Base indicators */}
          <div className="relative" style={{ width: 48, height: 44 }}>
            {/* 2nd base — top center */}
            <div className="absolute" style={{ top: 0, left: '50%', transform: 'translateX(-50%)' }}>
              <BasePip occupied={!!inning.bases.second} />
            </div>
            {/* 3rd base — middle left */}
            <div className="absolute" style={{ top: '50%', left: 0, transform: 'translateY(-50%)' }}>
              <BasePip occupied={!!inning.bases.third} />
            </div>
            {/* 1st base — middle right */}
            <div className="absolute" style={{ top: '50%', right: 0, transform: 'translateY(-50%)' }}>
              <BasePip occupied={!!inning.bases.first} />
            </div>
          </div>
        </div>
      )}

      {/* Batter / Pitcher info */}
      {!gameOver && (
        <div className="space-y-1">
          {batter && (
            <div className="flex items-baseline gap-2 font-mono">
              <span className="text-[10px] text-cream-dim/60 uppercase tracking-widest w-10 shrink-0">BAT</span>
              <span className="text-xs text-cream truncate">
                {batter.firstName[0]}. {batter.lastName}
              </span>
            </div>
          )}
          {pitcher && (
            <div className="flex items-baseline gap-2 font-mono">
              <span className="text-[10px] text-cream-dim/60 uppercase tracking-widest w-10 shrink-0">PIT</span>
              <span className="text-xs text-cream truncate">
                {pitcher.firstName[0]}. {pitcher.lastName}
              </span>
              <span className="text-[10px] text-cream-dim/60 ml-auto shrink-0">
                {pitcher.state.pitchCount}P
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

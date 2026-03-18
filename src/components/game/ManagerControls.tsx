import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/cn.ts';
import type { GameState } from '@/engine/types/index.ts';

interface ManagerControlsProps {
  game: GameState;
  isUserHome: boolean;
  onNextAtBat: () => void;
  onAutoPlay: () => void;
  onSimToEnd: () => void;
  isAutoPlaying: boolean;
  gameOver: boolean;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

export function ManagerControls({
  game,
  isUserHome,
  onNextAtBat,
  onAutoPlay,
  onSimToEnd,
  isAutoPlaying,
  gameOver,
  speed,
  onSpeedChange,
}: ManagerControlsProps) {
  const { inning } = game;
  const isUserBatting = isUserHome ? inning.half === 'bottom' : inning.half === 'top';
  const awayScore = game.score.away.reduce((a, b) => a + b, 0);
  const homeScore = game.score.home.reduce((a, b) => a + b, 0);

  return (
    <Panel className="space-y-3">
      {/* Scoreboard */}
      <div className="flex items-center justify-between font-mono">
        <div className="flex items-center gap-3">
          <span className={cn('text-lg font-bold', !isUserHome && 'text-gold')}>{game.away.abbreviation} {awayScore}</span>
          <span className="text-cream-dim">—</span>
          <span className={cn('text-lg font-bold', isUserHome && 'text-gold')}>{game.home.abbreviation} {homeScore}</span>
        </div>
        <div className="text-sm text-cream-dim">
          {gameOver ? (
            <span className="text-gold font-bold">FINAL</span>
          ) : (
            <>
              {inning.half === 'top' ? '▲' : '▼'} {inning.inning}
              <span className="ml-3">{inning.outs} out{inning.outs !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      </div>

      {/* Base indicators */}
      {!gameOver && (
        <div className="flex items-center justify-center gap-1 py-1">
          <div className="relative w-16 h-16">
            {/* Second base */}
            <div className={cn(
              'absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 border',
              inning.bases.second ? 'bg-gold border-gold' : 'border-cream-dim/30 bg-navy-lighter/50'
            )} />
            {/* Third base */}
            <div className={cn(
              'absolute top-1/2 left-0 -translate-y-1/2 w-4 h-4 rotate-45 border',
              inning.bases.third ? 'bg-gold border-gold' : 'border-cream-dim/30 bg-navy-lighter/50'
            )} />
            {/* First base */}
            <div className={cn(
              'absolute top-1/2 right-0 -translate-y-1/2 w-4 h-4 rotate-45 border',
              inning.bases.first ? 'bg-gold border-gold' : 'border-cream-dim/30 bg-navy-lighter/50'
            )} />
          </div>
          {isUserBatting && !gameOver && (
            <span className="text-xs text-gold font-mono ml-2">YOUR AT-BAT</span>
          )}
        </div>
      )}

      {/* Game controls */}
      <div className="flex flex-wrap gap-2">
        {!gameOver ? (
          <>
            <Button size="sm" onClick={onNextAtBat} disabled={isAutoPlaying}>
              Next AB
            </Button>
            <Button size="sm" variant={isAutoPlaying ? 'primary' : 'secondary'} onClick={onAutoPlay}>
              {isAutoPlaying ? 'Pause' : 'Auto Play'}
            </Button>
            <Button size="sm" variant="secondary" onClick={onSimToEnd} disabled={isAutoPlaying}>
              Sim to End
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={onSimToEnd}>
            New Game
          </Button>
        )}
      </div>

      {/* Speed control */}
      {!gameOver && (
        <div className="flex items-center gap-2 text-xs font-mono text-cream-dim">
          <span>Speed:</span>
          {[1, 2, 5, 10].map(s => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={cn(
                'px-2 py-0.5 rounded cursor-pointer transition-colors',
                speed === s ? 'bg-gold text-navy font-bold' : 'bg-navy-lighter hover:bg-navy-lighter/80'
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

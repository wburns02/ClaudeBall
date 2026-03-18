import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/cn.ts';
import type { GameState } from '@/engine/types/index.ts';
import type { SwingType } from '@/engine/types/interactive.ts';
import type { Player } from '@/engine/types/player.ts';
import { getPlayer } from '@/engine/types/team.ts';

interface ManagerControlsProps {
  game: GameState;
  isUserHome: boolean;
  userRole: 'batting' | 'pitching' | 'spectating';
  currentCount: { balls: number; strikes: number };
  onNextPitch: () => void;
  onSwing: (type: SwingType) => void;
  onTake: () => void;
  onAutoPlay: () => void;
  onSimToEnd: () => void;
  isAutoPlaying: boolean;
  gameOver: boolean;
  speed: number;
  onSpeedChange: (speed: number) => void;
  selectedSwingType?: SwingType;
  onSwingTypeChange?: (type: SwingType) => void;
  phase?: string;
}

export function ManagerControls({
  game,
  isUserHome,
  userRole,
  currentCount,
  onNextPitch,
  onSwing,
  onTake,
  onAutoPlay,
  onSimToEnd,
  isAutoPlaying,
  gameOver,
  speed,
  onSpeedChange,
  selectedSwingType = 'normal',
  onSwingTypeChange,
  phase,
}: ManagerControlsProps) {
  const { inning } = game;
  const awayScore = game.score.away.reduce((a, b) => a + b, 0);
  const homeScore = game.score.home.reduce((a, b) => a + b, 0);

  // Get current pitcher info
  const isTop = inning.half === 'top';
  const pitchingTeam = isTop ? game.home : game.away;
  const pitcher: Player | undefined = getPlayer(pitchingTeam, pitchingTeam.pitcherId);

  const isAwaitingSwing = phase === 'awaiting_swing' && userRole === 'batting';
  const isAwaitingPitch = phase === 'awaiting_pitch' && userRole === 'pitching';
  const isAnimating = phase === 'animating';
  const blocked = isAnimating || isAutoPlaying;

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

      {/* Count display — prominent */}
      {!gameOver && (
        <div className="flex items-center justify-between bg-navy-lighter/40 rounded-lg px-3 py-2">
          <div className="flex items-center gap-4 font-mono">
            <span className="text-cream-dim text-xs uppercase tracking-wide">Count</span>
            <span className="text-xl font-bold text-gold">
              {currentCount.balls}-{currentCount.strikes}
            </span>
          </div>
          {/* Pitch count */}
          {pitcher && (
            <div className="text-right">
              <div className="text-xs text-cream-dim">{pitcher.firstName} {pitcher.lastName}</div>
              <div className="text-xs font-mono text-cream-dim">
                {pitcher.state.pitchCount} P
                <span className={cn(
                  'ml-2',
                  pitcher.state.fatigue > 70 ? 'text-red-400' :
                  pitcher.state.fatigue > 50 ? 'text-yellow-400' : 'text-green-400'
                )}>
                  {Math.round(100 - pitcher.state.fatigue)}% fresh
                </span>
              </div>
            </div>
          )}
        </div>
      )}

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
          <div className="ml-2 text-xs font-mono">
            {userRole === 'batting' && !gameOver && (
              <span className="text-gold uppercase tracking-wide">Your AB</span>
            )}
            {userRole === 'pitching' && !gameOver && (
              <span className="text-blue-400 uppercase tracking-wide">You Pitch</span>
            )}
            {userRole === 'spectating' && !gameOver && (
              <span className="text-cream-dim uppercase tracking-wide">Spectating</span>
            )}
          </div>
        </div>
      )}

      {/* ── Batting controls ── */}
      {!gameOver && userRole === 'batting' && !isAutoPlaying && (
        <div className="space-y-2">
          {/* Swing type selector */}
          <div className="flex gap-1 text-xs font-mono">
            {(['normal', 'power', 'contact', 'bunt'] as SwingType[]).map(type => (
              <button
                key={type}
                onClick={() => onSwingTypeChange?.(type)}
                className={cn(
                  'px-2 py-1 rounded capitalize cursor-pointer transition-colors flex-1',
                  selectedSwingType === type
                    ? 'bg-gold text-navy font-bold'
                    : 'bg-navy-lighter text-cream-dim hover:bg-navy-lighter/80'
                )}
              >
                {type === 'normal' ? 'Norm' : type === 'power' ? 'Pwr' : type === 'contact' ? 'Cont' : 'Bunt'}
              </button>
            ))}
          </div>
          {/* Swing / Take buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => onSwing(selectedSwingType)}
              disabled={blocked || !isAwaitingSwing}
              className="flex-1"
            >
              Swing [{selectedSwingType === 'power' ? 'Shift+Space' : selectedSwingType === 'contact' ? 'C' : selectedSwingType === 'bunt' ? 'B' : 'Space'}]
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onTake}
              disabled={blocked || !isAwaitingSwing}
            >
              Take [T]
            </Button>
          </div>
        </div>
      )}

      {/* ── Pitching controls ── */}
      {!gameOver && userRole === 'pitching' && !isAutoPlaying && (
        <div className="space-y-2">
          <Button
            size="sm"
            onClick={onNextPitch}
            disabled={blocked || !isAwaitingPitch}
            className="w-full"
          >
            Throw Pitch [Space]
          </Button>
          <div className="text-xs text-cream-dim font-mono text-center">
            Use keys 1-5 to select pitch type
          </div>
        </div>
      )}

      {/* ── Spectating / CPU turn ── */}
      {!gameOver && (userRole === 'spectating' || isAutoPlaying) && (
        <Button
          size="sm"
          onClick={onNextPitch}
          disabled={blocked}
          className="w-full"
        >
          Next Pitch [Space]
        </Button>
      )}

      {/* ── Global controls ── */}
      <div className="flex flex-wrap gap-2">
        {!gameOver ? (
          <>
            <Button size="sm" variant={isAutoPlaying ? 'primary' : 'secondary'} onClick={onAutoPlay}>
              {isAutoPlaying ? 'Pause [A]' : 'Auto Play [A]'}
            </Button>
            <Button size="sm" variant="secondary" onClick={onSimToEnd} disabled={isAutoPlaying}>
              Sim to End [S]
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

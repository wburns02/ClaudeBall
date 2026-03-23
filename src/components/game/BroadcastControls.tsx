import { cn } from '@/lib/cn.ts';
import type { GameState } from '@/engine/types/index.ts';
import type { SwingType, GamePhaseInteractive } from '@/engine/types/interactive.ts';
import type { UserRole } from '@/stores/gameStore.ts';
import { getPlayer } from '@/engine/types/team.ts';

interface BroadcastControlsProps {
  game: GameState;
  userRole: UserRole;
  currentCount: { balls: number; strikes: number };
  phase: GamePhaseInteractive;
  selectedSwingType: SwingType;
  onSwingTypeChange: (type: SwingType) => void;
  onSwing: (type: SwingType) => void;
  onTake: () => void;
  onNextPitch: () => void;
  onAutoPlay: () => void;
  onSimToEnd: () => void;
  isAutoPlaying: boolean;
  gameOver: boolean;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

export function BroadcastControls({
  game,
  userRole,
  currentCount,
  phase,
  selectedSwingType,
  onSwingTypeChange,
  onSwing,
  onTake,
  onNextPitch,
  onAutoPlay,
  onSimToEnd,
  isAutoPlaying,
  gameOver,
  speed,
  onSpeedChange,
}: BroadcastControlsProps) {
  const { inning } = game;
  const isTop = inning.half === 'top';
  const pitchingTeam = isTop ? game.home : game.away;
  const pitcher = getPlayer(pitchingTeam, pitchingTeam.pitcherId);

  const isAwaitingSwing = phase === 'awaiting_swing' && userRole === 'batting';
  const isAwaitingPitch = phase === 'awaiting_pitch' && userRole === 'pitching';
  const blocked = isAutoPlaying;

  const btnBase =
    'px-3 py-1 rounded text-xs font-mono transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  const btnPrimary = 'bg-gold text-navy font-bold hover:bg-gold-dim';
  const btnSecondary =
    'bg-navy-lighter text-cream border border-navy-lighter hover:bg-[#243044]';
  const btnGhost = 'text-cream-dim hover:text-cream hover:bg-navy-lighter/50';

  const swingShortcut: Record<SwingType, string> = {
    normal: 'Space',
    power: 'Shift+Space',
    contact: 'C',
    bunt: 'B',
  };

  return (
    <div
      style={{
        background: 'rgba(10,15,26,0.90)',
        borderTop: '1px solid rgba(212,168,67,0.18)',
        backdropFilter: 'blur(6px)',
        height: 68,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
        overflow: 'hidden',
      }}
    >
      {/* LEFT: Count + Pitcher */}
      <div className="flex items-center gap-3 shrink-0">
        {!gameOver && (
          <>
            <div className="font-mono leading-none text-center">
              <div className="text-2xl font-bold">
                <span className="text-green-light">{currentCount.balls}</span>
                <span className="text-cream-dim/50">-</span>
                <span className="text-red">{currentCount.strikes}</span>
              </div>
              <div className="text-[10px] text-cream-dim/60 uppercase tracking-widest mt-0.5">
                {inning.outs} out{inning.outs !== 1 ? 's' : ''}
              </div>
            </div>
            {pitcher && (
              <div className="font-mono leading-none">
                <div className="text-xs text-cream/80 truncate max-w-[100px]">
                  {pitcher.firstName[0]}. {pitcher.lastName}
                </div>
                <div
                  className={cn(
                    'text-[10px] mt-0.5',
                    pitcher.state.fatigue > 70
                      ? 'text-red'
                      : pitcher.state.fatigue > 50
                      ? 'text-yellow-400'
                      : 'text-green-light'
                  )}
                >
                  {pitcher.state.pitchCount}P &bull; {Math.round(100 - pitcher.state.fatigue)}% fresh
                </div>
              </div>
            )}
          </>
        )}
        {gameOver && (
          <span className="text-gold font-bold font-mono uppercase tracking-wide text-sm">
            Game Over
          </span>
        )}
      </div>

      {/* Divider */}
      <div
        className="shrink-0"
        style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.1)' }}
      />

      {/* CENTER: Action controls */}
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        {/* Batting controls */}
        {!gameOver && userRole === 'batting' && !isAutoPlaying && (
          <>
            {/* Swing type selector */}
            <div className="flex gap-1">
              {(['normal', 'power', 'contact', 'bunt'] as SwingType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => onSwingTypeChange(type)}
                  className={cn(
                    btnBase,
                    selectedSwingType === type ? btnPrimary : btnSecondary
                  )}
                >
                  {type === 'normal'
                    ? 'Norm'
                    : type === 'power'
                    ? 'Pwr'
                    : type === 'contact'
                    ? 'Cont'
                    : 'Bunt'}
                </button>
              ))}
            </div>

            {/* Swing / Take */}
            <button
              onClick={() => onSwing(selectedSwingType)}
              disabled={blocked || !isAwaitingSwing}
              className={cn(btnBase, btnPrimary)}
            >
              Swing [{swingShortcut[selectedSwingType]}]
            </button>
            <button
              onClick={onTake}
              disabled={blocked || !isAwaitingSwing}
              className={cn(btnBase, btnSecondary)}
            >
              Take [T]
            </button>
          </>
        )}

        {/* Pitching controls */}
        {!gameOver && userRole === 'pitching' && !isAutoPlaying && (
          <button
            onClick={onNextPitch}
            disabled={blocked || !isAwaitingPitch}
            className={cn(btnBase, btnPrimary)}
          >
            Throw Pitch [Space]
          </button>
        )}

        {/* Spectating / CPU — Next pitch */}
        {!gameOver && (userRole === 'spectating' || isAutoPlaying) && (
          <button
            onClick={onNextPitch}
            disabled={blocked}
            className={cn(btnBase, btnSecondary)}
          >
            Next Pitch
          </button>
        )}

        {/* Phase hint */}
        {!gameOver && (
          <span className="text-[11px] font-mono text-cream-dim/50 ml-1">
            {phase === 'awaiting_swing' && '🟡 Your swing'}
            {phase === 'awaiting_pitch' && '🔵 Throw pitch'}
            {phase === 'cpu_pitch' && 'CPU pitching…'}
            {phase === 'post_ab' && 'Space → next batter'}
            {phase === 'idle' && 'Space to begin'}
            {phase === 'post_pitch' && '…'}
          </span>
        )}
      </div>

      {/* Divider */}
      <div
        className="shrink-0"
        style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.1)' }}
      />

      {/* RIGHT: Auto-play / Sim / Speed */}
      <div className="flex items-center gap-2 shrink-0">
        {!gameOver ? (
          <>
            <button
              onClick={onAutoPlay}
              className={cn(
                btnBase,
                isAutoPlaying ? btnPrimary : btnSecondary
              )}
            >
              {isAutoPlaying ? 'Pause [A]' : 'Auto [A]'}
            </button>
            <button
              onClick={onSimToEnd}
              disabled={isAutoPlaying}
              className={cn(btnBase, btnGhost)}
            >
              Sim [S]
            </button>
            <div className="flex items-center gap-1 font-mono">
              {[1, 2, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => onSpeedChange(s)}
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[11px] cursor-pointer transition-colors',
                    speed === s
                      ? 'bg-gold text-navy font-bold'
                      : 'bg-navy-lighter text-cream-dim hover:bg-[#243044]'
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>
          </>
        ) : (
          <button onClick={onSimToEnd} className={cn(btnBase, btnSecondary)}>
            New Game
          </button>
        )}
      </div>
    </div>
  );
}

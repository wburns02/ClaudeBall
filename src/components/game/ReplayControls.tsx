import { useState } from 'react';
import type { ReplayPitchStep } from '@/engine/core/ReplayBuffer.ts';
import { Panel } from '@/components/ui/Panel.tsx';
import { Button } from '@/components/ui/Button.tsx';
import { cn } from '@/lib/cn.ts';

// ── Types ─────────────────────────────────────────────────────────────────

interface ReplayControlsProps {
  /** Each entry is an array of pitch steps representing one highlight at-bat. */
  highlights: ReplayPitchStep[][];
  /** Called when the user selects a highlight to replay (index into highlights[]). */
  onReplay: (index: number) => void;
  /** True while a replay is actively playing. */
  isReplaying: boolean;
  /** Called to pause/resume the active replay. */
  onTogglePause?: () => void;
  /** Called to change playback speed (1 = normal, 0.5 = half, 2 = double). */
  onSpeedChange?: (speed: number) => void;
  /** Current playback speed (1 by default). */
  playbackSpeed?: number;
  /** Called to replay the most recent play. */
  onReplayLast?: () => void;
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getHighlightLabel(pitches: ReplayPitchStep[]): string {
  const last = pitches[pitches.length - 1];
  if (!last) return 'Play';

  const result = last.atBatResult ?? '';

  if (result === 'home_run') return 'Home Run';
  if (result === 'strikeout_swinging') return 'Strikeout (Swinging)';
  if (result === 'strikeout_looking') return 'Strikeout (Looking)';
  if (result === 'double_play') return 'Double Play';
  if (result === 'triple_play') return 'Triple Play';
  if (result === 'error') return 'Error';
  return result.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getHighlightIcon(pitches: ReplayPitchStep[]): string {
  const last = pitches[pitches.length - 1];
  const result = last?.atBatResult ?? '';
  if (result === 'home_run') return '★';
  if (result.startsWith('strikeout')) return 'K';
  if (result === 'double_play' || result === 'triple_play') return 'DP';
  if (result === 'error') return 'E';
  return '▶';
}

function getHighlightColor(pitches: ReplayPitchStep[]): string {
  const last = pitches[pitches.length - 1];
  const result = last?.atBatResult ?? '';
  if (result === 'home_run') return 'text-gold';
  if (result.startsWith('strikeout')) return 'text-red-400';
  if (result === 'error') return 'text-orange-400';
  return 'text-cream';
}

// ── Component ─────────────────────────────────────────────────────────────

const SPEED_OPTIONS: Array<{ label: string; value: number }> = [
  { label: '0.5×', value: 0.5 },
  { label: '1×',   value: 1 },
  { label: '2×',   value: 2 },
];

export function ReplayControls({
  highlights,
  onReplay,
  isReplaying,
  onTogglePause,
  onSpeedChange,
  playbackSpeed = 1,
  onReplayLast,
  className,
}: ReplayControlsProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const handleReplay = (idx: number) => {
    setSelectedIdx(idx);
    setIsPaused(false);
    onReplay(idx);
  };

  const handleTogglePause = () => {
    setIsPaused(p => !p);
    onTogglePause?.();
  };

  return (
    <Panel
      title="Replay"
      className={cn('min-w-[200px]', className)}
    >
      <div className="flex flex-col gap-3">
        {/* Replay last play */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onReplayLast}
          disabled={!onReplayLast || isReplaying}
          className="w-full justify-center"
        >
          ▶ Replay Last Play
        </Button>

        {/* Replay mode indicator */}
        {isReplaying && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-gold/10 border border-gold/30 rounded text-gold text-xs font-mono">
            <span className="animate-pulse">●</span>
            <span>REPLAY MODE</span>
          </div>
        )}

        {/* Playback controls — only shown during replay */}
        {isReplaying && (
          <div className="flex flex-col gap-2">
            {/* Pause / resume */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTogglePause}
              className="w-full"
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </Button>

            {/* Speed controls */}
            {onSpeedChange && (
              <div className="flex gap-1">
                {SPEED_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => onSpeedChange(opt.value)}
                    className={cn(
                      'flex-1 py-1 text-xs rounded font-mono transition-colors',
                      playbackSpeed === opt.value
                        ? 'bg-gold text-navy font-semibold'
                        : 'bg-navy-lighter text-cream-dim hover:text-cream hover:bg-[#243044]',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Highlights list */}
        {highlights.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="text-cream-dim text-xs uppercase tracking-wide font-mono mb-1">
              Highlights ({highlights.length})
            </p>
            <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto pr-1">
              {highlights.map((pitches, idx) => {
                const label = getHighlightLabel(pitches);
                const icon = getHighlightIcon(pitches);
                const colorClass = getHighlightColor(pitches);
                const isSelected = selectedIdx === idx;

                return (
                  <button
                    key={idx}
                    onClick={() => handleReplay(idx)}
                    disabled={isReplaying && !isSelected}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded text-left',
                      'text-xs font-mono transition-colors',
                      isSelected
                        ? 'bg-gold/15 border border-gold/40'
                        : 'hover:bg-navy-lighter border border-transparent',
                      isReplaying && !isSelected && 'opacity-40 cursor-not-allowed',
                    )}
                  >
                    <span className={cn('text-sm font-bold w-5 text-center', colorClass)}>
                      {icon}
                    </span>
                    <span className={cn('flex-1', colorClass)}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-cream-dim text-xs text-center py-2">
            No highlights yet
          </p>
        )}
      </div>
    </Panel>
  );
}

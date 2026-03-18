import { cn } from '@/lib/cn.ts';
import type { Player } from '@/engine/types/player.ts';
import type { SwingType, SwingTiming } from '@/engine/types/batting.ts';
import { BatterInfoCard } from './BatterInfoCard.tsx';
import { PitcherInfoCard } from './PitcherInfoCard.tsx';
import { CountDisplay } from './CountDisplay.tsx';
import { SwingTypeSelector } from './SwingTypeSelector.tsx';
import { TimingFeedback } from './TimingFeedback.tsx';

interface BattingInterfaceProps {
  batter: Player;
  pitcher: Player;
  count: { balls: number; strikes: number; outs: number };
  /** Current swing type selection. */
  selectedSwingType: SwingType;
  /** Most recent timing result to display briefly. */
  lastTimingResult?: SwingTiming | null;
  /** Show the timing feedback flash right now. */
  showTimingFeedback?: boolean;
  /** Pitcher ERA string for display. */
  pitcherEra?: string;
  /** Batter stats for display. */
  batterAVG?: string;
  batterHR?: number;
  batterRBI?: number;
  onSwingTypeChange: (type: SwingType) => void;
  /** Whether controls are locked (e.g. during animation). */
  disabled?: boolean;
  className?: string;
}

/**
 * Full overlay UI shown during the batter's turn.
 * Composites batter card, pitcher card, count, swing selector, and timing feedback.
 */
export function BattingInterface({
  batter,
  pitcher,
  count,
  selectedSwingType,
  lastTimingResult = null,
  showTimingFeedback = false,
  pitcherEra,
  batterAVG,
  batterHR,
  batterRBI,
  onSwingTypeChange,
  disabled = false,
  className,
}: BattingInterfaceProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Top row: batter info + count + pitcher info */}
      <div className="flex items-stretch gap-3">
        {/* Batter card */}
        <BatterInfoCard
          batter={batter}
          gameAVG={batterAVG}
          gameHR={batterHR}
          gameRBI={batterRBI}
          className="flex-1 min-w-0"
        />

        {/* Count — centered */}
        <div className="flex flex-col items-center justify-center px-2 shrink-0">
          <CountDisplay
            balls={count.balls}
            strikes={count.strikes}
            outs={count.outs}
          />
        </div>

        {/* Pitcher card */}
        <PitcherInfoCard
          pitcher={pitcher}
          era={pitcherEra}
          className="flex-1 min-w-0"
        />
      </div>

      {/* Swing type selector */}
      <SwingTypeSelector
        selected={selectedSwingType}
        onChange={onSwingTypeChange}
        disabled={disabled}
      />

      {/* Timing feedback — overlaid by parent (absolute positioning) */}
      {showTimingFeedback && (
        <TimingFeedback
          timing={lastTimingResult}
          visible={showTimingFeedback}
        />
      )}
    </div>
  );
}

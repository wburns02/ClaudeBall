import { cn } from '@/lib/cn.ts';

interface CountDisplayProps {
  balls: number;
  strikes: number;
  outs: number;
  className?: string;
}

/** Filled circle indicator for counts. */
function CirclePip({
  filled,
  colorClass,
}: {
  filled: boolean;
  colorClass: string;
}) {
  return (
    <div
      className={cn(
        'w-3 h-3 rounded-full border',
        filled
          ? cn(colorClass, 'border-transparent')
          : 'bg-transparent border-current opacity-30',
      )}
    />
  );
}

/**
 * Large, prominent count display.
 * Shows "B-S" in large monospace font with individual pip indicators.
 */
export function CountDisplay({ balls, strikes, outs, className }: CountDisplayProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 select-none',
        className,
      )}
    >
      {/* Large B-S readout */}
      <div className="font-mono text-5xl font-bold leading-none tracking-tight">
        <span className="text-green">{balls}</span>
        <span className="text-cream-dim mx-1">-</span>
        <span className="text-red">{strikes}</span>
      </div>

      {/* Labels */}
      <div className="flex gap-6 text-[10px] font-mono text-cream-dim uppercase tracking-widest">
        <span>Balls</span>
        <span>Strikes</span>
      </div>

      {/* Pip rows */}
      <div className="flex gap-4 mt-1">
        {/* Ball pips (max 4) */}
        <div className="flex gap-1 text-green">
          {Array.from({ length: 4 }, (_, i) => (
            <CirclePip key={i} filled={i < balls} colorClass="bg-green" />
          ))}
        </div>

        {/* Divider */}
        <div className="w-px bg-navy-lighter" />

        {/* Strike pips (max 3) */}
        <div className="flex gap-1 text-red">
          {Array.from({ length: 3 }, (_, i) => (
            <CirclePip key={i} filled={i < strikes} colorClass="bg-red" />
          ))}
        </div>
      </div>

      {/* Outs */}
      <div className="flex items-center gap-1.5 mt-2">
        <span className="text-[10px] font-mono text-cream-dim uppercase tracking-widest mr-1">
          Out{outs !== 1 ? 's' : ''}
        </span>
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className={cn(
              'w-3 h-3 rounded-full border',
              i < outs
                ? 'bg-gold border-gold'
                : 'bg-transparent border-cream-dim/30',
            )}
          />
        ))}
      </div>
    </div>
  );
}

import { cn } from '@/lib/cn.ts';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  className?: string;
}

function getValueColor(value: number, min: number, max: number): string {
  const pct = (value - min) / (max - min) * 100;
  if (pct >= 75) return 'text-green-light';
  if (pct >= 50) return 'text-gold';
  return 'text-red';
}

function getTrackColor(value: number, min: number, max: number): string {
  const pct = (value - min) / (max - min) * 100;
  if (pct >= 75) return '#3a7a52'; // green-light
  if (pct >= 50) return '#d4a843'; // gold
  return '#c44d4d'; // red
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  label,
  showValue = true,
  className,
}: SliderProps) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const trackColor = getTrackColor(value, min, max);

  return (
    <div className={cn('space-y-1.5', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="text-xs font-mono text-cream-dim uppercase tracking-wider">
              {label}
            </span>
          )}
          {showValue && (
            <span className={cn('text-sm font-mono font-bold', getValueColor(value, min, max))}>
              {value}
            </span>
          )}
        </div>
      )}

      <div className="relative flex items-center">
        {/* Min label */}
        <span className="text-xs font-mono text-cream-dim/60 mr-2 w-6 text-right flex-shrink-0">
          {min}
        </span>

        {/* Track */}
        <div className="relative flex-1 h-2 bg-navy-lighter rounded-full">
          {/* Fill */}
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-150"
            style={{ width: `${pct}%`, backgroundColor: trackColor }}
          />
          {/* Input (overlaid for interaction) */}
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={e => onChange(Number(e.target.value))}
            className={cn(
              'absolute inset-0 w-full h-full opacity-0 cursor-pointer',
            )}
            style={{ margin: 0 }}
          />
          {/* Thumb indicator */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-navy shadow-md pointer-events-none transition-all duration-150"
            style={{
              left: `calc(${pct}% - 8px)`,
              backgroundColor: trackColor,
            }}
          />
        </div>

        {/* Max label */}
        <span className="text-xs font-mono text-cream-dim/60 ml-2 w-6 flex-shrink-0">
          {max}
        </span>
      </div>
    </div>
  );
}

import { cn } from '@/lib/cn.ts';

interface ProgressBarProps {
  value: number; // 0-100
  label?: string;
  showPercent?: boolean;
  color?: string;
  className?: string;
}

export function ProgressBar({ value, label, showPercent = false, color, className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const fillColor = color ?? '#d4a843'; // default gold

  return (
    <div className={cn('space-y-1', className)}>
      {(label || showPercent) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="text-xs font-mono text-cream-dim uppercase tracking-wider">
              {label}
            </span>
          )}
          {showPercent && (
            <span className="text-xs font-mono text-cream-dim">
              {Math.round(clamped)}%
            </span>
          )}
        </div>
      )}

      <div className="h-2 bg-navy-lighter rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${clamped}%`, backgroundColor: fillColor }}
        />
      </div>
    </div>
  );
}

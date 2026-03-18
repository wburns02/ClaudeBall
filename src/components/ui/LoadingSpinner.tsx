import { cn } from '@/lib/cn.ts';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
};

const textSizes = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={cn('relative', sizeClasses[size])}>
        {/* Outer spinning ring */}
        <div
          className={cn(
            'absolute inset-0 rounded-full border-2 border-transparent',
            'border-t-gold border-r-gold/40',
            'animate-spin',
          )}
          style={{ animationDuration: '0.8s' }}
        />
        {/* Baseball seam arcs */}
        <div className={cn(
          'absolute inset-1 rounded-full border-2 border-transparent',
          'border-b-gold/30 border-l-gold/60',
          'animate-spin',
        )}
          style={{ animationDuration: '1.2s', animationDirection: 'reverse' }}
        />
        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={cn(
            'rounded-full bg-gold/80',
            size === 'sm' ? 'w-1.5 h-1.5' : size === 'md' ? 'w-2 h-2' : 'w-3 h-3',
          )} />
        </div>
      </div>

      {text !== undefined && (
        <p className={cn('font-mono text-cream-dim tracking-wider uppercase', textSizes[size])}>
          {text}
        </p>
      )}
    </div>
  );
}

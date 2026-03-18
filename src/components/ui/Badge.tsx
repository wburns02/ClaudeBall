import { cn } from '@/lib/cn.ts';

type BadgeVariant = 'gold' | 'green' | 'red' | 'blue' | 'gray';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  gold: 'bg-gold/15 text-gold border-gold/40',
  green: 'bg-green/30 text-green-light border-green-light/40',
  red: 'bg-red/15 text-red border-red/40',
  blue: 'bg-blue/15 text-blue border-blue/40',
  gray: 'bg-navy-lighter/80 text-cream-dim border-navy-lighter',
};

export function Badge({ label, variant = 'gold', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-semibold',
        'border tracking-wide uppercase',
        variantClasses[variant],
        className,
      )}
    >
      {label}
    </span>
  );
}

import { cn } from '@/lib/cn.ts';
import { Button } from '@/components/ui/Button.tsx';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-6 text-center',
      className,
    )}>
      {icon && (
        <span className="text-4xl mb-4 opacity-60 select-none" aria-hidden="true">
          {icon}
        </span>
      )}
      <h3 className="font-display text-lg text-cream tracking-wide uppercase mb-2">
        {title}
      </h3>
      {description && (
        <p className="font-body text-cream-dim text-sm max-w-xs leading-relaxed mb-6">
          {description}
        </p>
      )}
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

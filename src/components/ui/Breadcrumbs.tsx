import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn.ts';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const navigate = useNavigate();

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center gap-1 font-mono text-xs text-cream-dim/60 mb-4', className)}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-cream-dim/30 select-none">›</span>
            )}
            {item.path && !isLast ? (
              <button
                onClick={() => navigate(item.path!)}
                className="hover:text-cream-dim transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ) : (
              <span className={cn(isLast ? 'text-cream-dim' : 'text-cream-dim/60')}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

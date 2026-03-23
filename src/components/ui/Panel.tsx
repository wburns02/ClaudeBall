import type { ReactNode } from 'react';
import { cn } from '@/lib/cn.ts';

interface PanelProps {
  children: ReactNode;
  className?: string;
  title?: string;
  id?: string;
}

export function Panel({ children, className, title, id }: PanelProps) {
  return (
    <div id={id} className={cn(
      'bg-navy-light border border-navy-lighter rounded-lg',
      'shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_8px_rgba(0,0,0,0.3)]',
      className
    )}>
      {title && (
        <div className="px-4 py-2.5 border-b border-navy-lighter">
          <h3 className="font-display text-gold text-lg tracking-wide uppercase">{title}</h3>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

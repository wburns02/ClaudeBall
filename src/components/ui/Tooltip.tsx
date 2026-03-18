import { useState, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn.ts';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const positionClasses = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const arrowClasses = {
  top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-[#1a2235]',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-[#1a2235]',
  left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-[#1a2235]',
  right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-[#1a2235]',
};

export function Tooltip({ content, children, position = 'top', className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), 300);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <span className="relative inline-block" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <span
          className={cn(
            'absolute z-50 pointer-events-none whitespace-nowrap',
            'bg-navy-lighter border border-gold/40 rounded px-2.5 py-1.5',
            'text-cream text-xs font-body shadow-[0_4px_12px_rgba(0,0,0,0.5)]',
            'animate-[fadeIn_0.1s_ease-out]',
            positionClasses[position],
            className,
          )}
          role="tooltip"
        >
          {content}
          {/* Arrow */}
          <span
            className={cn(
              'absolute border-4',
              arrowClasses[position],
            )}
          />
        </span>
      )}
    </span>
  );
}

import { useEffect } from 'react';
import { cn } from '@/lib/cn.ts';
import { Button } from '@/components/ui/Button.tsx';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title = 'Are you sure?',
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  danger = true,
}: ConfirmDialogProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-navy/80 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className={cn(
        'relative z-10 w-full max-w-md mx-4 rounded-xl',
        'bg-navy-light border border-navy-lighter',
        'shadow-[0_8px_32px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]',
        'p-6 space-y-4',
      )}>
        <h2 className="font-display text-xl text-gold tracking-wide uppercase">
          {title}
        </h2>

        <p className="font-body text-cream-dim text-sm leading-relaxed">
          {message}
        </p>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <button
            onClick={onConfirm}
            className={cn(
              'px-5 py-2.5 rounded-md font-body text-base font-semibold transition-all duration-150',
              'active:scale-[0.98] cursor-pointer',
              danger
                ? 'bg-red text-cream hover:bg-red/80 shadow-[0_2px_0_rgba(0,0,0,0.3)]'
                : 'bg-gold text-navy hover:bg-gold-dim shadow-[0_2px_0_#8a6e2e]',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

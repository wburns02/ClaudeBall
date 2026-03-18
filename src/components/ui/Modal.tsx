import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/cn.ts';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md', className }: ModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-navy/85 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          'relative z-10 w-full rounded-xl',
          'bg-navy-light border border-navy-lighter',
          'shadow-[0_8px_40px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.05)]',
          sizeClasses[size],
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-navy-lighter">
            <h2 id="modal-title" className="font-display text-xl text-gold tracking-wide uppercase">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-cream-dim hover:text-cream transition-colors text-2xl leading-none cursor-pointer w-8 h-8 flex items-center justify-center rounded hover:bg-navy-lighter/50"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        {/* If no title, still show close button */}
        {!title && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-cream-dim hover:text-cream transition-colors text-2xl leading-none cursor-pointer w-8 h-8 flex items-center justify-center rounded hover:bg-navy-lighter/50 z-10"
            aria-label="Close"
          >
            ×
          </button>
        )}

        {/* Content */}
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

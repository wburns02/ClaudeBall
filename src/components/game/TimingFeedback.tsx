import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn.ts';
import type { SwingTiming } from '@/engine/types/batting.ts';

interface TimingFeedbackProps {
  timing: SwingTiming | null;
  visible: boolean;
}

const TIMING_CONFIG: Record<
  SwingTiming,
  { label: string; colorClass: string; glowClass: string }
> = {
  perfect: {
    label: 'PERFECT!',
    colorClass: 'text-gold',
    glowClass: 'drop-shadow-[0_0_12px_rgba(212,168,67,0.9)]',
  },
  early: {
    label: 'Early',
    colorClass: 'text-cream',
    glowClass: '',
  },
  late: {
    label: 'Late',
    colorClass: 'text-cream',
    glowClass: '',
  },
  way_early: {
    label: 'Way Early!',
    colorClass: 'text-red',
    glowClass: '',
  },
  way_late: {
    label: 'Way Late!',
    colorClass: 'text-red',
    glowClass: '',
  },
  miss: {
    label: 'Miss',
    colorClass: 'text-cream-dim',
    glowClass: '',
  },
};

/**
 * Animated feedback text that appears briefly after a swing.
 * Fades in with a slight scale-up, then fades out. ~800ms total.
 * Positioned above the diamond via absolute layout in the parent.
 */
export function TimingFeedback({ timing, visible }: TimingFeedbackProps) {
  const [animState, setAnimState] = useState<'hidden' | 'in' | 'out'>('hidden');

  useEffect(() => {
    if (!visible || !timing) {
      setAnimState('hidden');
      return;
    }

    // Fade in
    setAnimState('in');

    // Begin fade-out after 500ms, fully hidden at ~800ms
    const outTimer = setTimeout(() => setAnimState('out'), 500);
    const hideTimer = setTimeout(() => setAnimState('hidden'), 820);

    return () => {
      clearTimeout(outTimer);
      clearTimeout(hideTimer);
    };
  }, [visible, timing]);

  if (animState === 'hidden' || !timing) return null;

  const cfg = TIMING_CONFIG[timing];

  return (
    <div
      className={cn(
        'pointer-events-none select-none absolute inset-x-0 flex justify-center',
        'top-[30%]',
      )}
      aria-live="polite"
    >
      <span
        className={cn(
          'font-display tracking-widest uppercase',
          'text-3xl',
          cfg.colorClass,
          cfg.glowClass,
          'transition-all duration-[300ms]',
          animState === 'in'
            ? 'opacity-100 scale-110'
            : 'opacity-0 scale-100',
        )}
        style={{
          textShadow: timing === 'perfect' ? '0 0 20px rgba(212,168,67,0.8)' : undefined,
        }}
      >
        {cfg.label}
      </span>
    </div>
  );
}

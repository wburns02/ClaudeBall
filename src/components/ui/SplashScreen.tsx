import { useState, useEffect } from 'react';
import { cn } from '@/lib/cn.ts';

interface SplashScreenProps {
  onDone?: () => void;
  durationMs?: number;
}

export function SplashScreen({ onDone, durationMs = 1200 }: SplashScreenProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    // Fade in: 300ms — then hold — then fade out: 300ms
    const holdTimer = setTimeout(() => setPhase('out'), durationMs - 300);
    const doneTimer = setTimeout(() => {
      setPhase('out');
      onDone?.();
    }, durationMs);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(doneTimer);
    };
  }, [durationMs, onDone]);

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center',
        'bg-navy',
        'transition-opacity duration-300',
        phase === 'out' ? 'opacity-0 pointer-events-none' : 'opacity-100',
      )}
    >
      {/* Baseball animation */}
      <div className="relative mb-8">
        {/* Outer orbit ring */}
        <div
          className="w-24 h-24 rounded-full border border-gold/20 absolute inset-0 animate-spin"
          style={{ animationDuration: '3s' }}
        />
        {/* Inner spinning baseball-style arcs */}
        <div
          className="w-24 h-24 rounded-full border-2 border-transparent border-t-gold border-r-gold/30 animate-spin"
          style={{ animationDuration: '0.9s' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-14 h-14 rounded-full border-2 border-transparent border-b-gold/50 border-l-gold/70 animate-spin"
            style={{ animationDuration: '1.3s', animationDirection: 'reverse' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl select-none" aria-hidden="true">⚾</span>
          </div>
        </div>
      </div>

      {/* Logo */}
      <h1
        className={cn(
          'font-display text-5xl text-gold tracking-tight uppercase mb-2',
          'transition-all duration-500',
          phase === 'in' ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0',
        )}
        style={{ transitionDelay: '150ms' }}
      >
        Claude Ball
      </h1>

      <p
        className={cn(
          'font-mono text-cream-dim text-xs tracking-widest uppercase mb-8',
          'transition-all duration-500',
          phase === 'in' ? 'opacity-0' : 'opacity-100',
        )}
        style={{ transitionDelay: '300ms' }}
      >
        Baseball Simulator
      </p>

      {/* Loading dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gold/50"
            style={{
              animation: 'pulse 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      <p className="font-mono text-cream-dim/50 text-xs mt-3 tracking-wider">Loading...</p>
    </div>
  );
}

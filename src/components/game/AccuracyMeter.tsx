import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/cn.ts';

interface AccuracyMeterProps {
  /** Marker bounce speed: pixels per second */
  speed: number;
  onComplete: (accuracy: number) => void;
  active: boolean;
}

const METER_HEIGHT = 200;
const METER_WIDTH = 40;
const MARKER_HEIGHT = 4;
const AUTO_RESOLVE_MS = 3000;

/**
 * Zone thresholds (fraction from top):
 *   0.00–0.15 → red (wild)
 *   0.15–0.35 → yellow (ok)
 *   0.35–0.65 → green (accurate) ← center
 *   0.65–0.85 → yellow (ok)
 *   0.85–1.00 → red (wild)
 */

function getZoneColor(yFraction: number): string {
  const d = Math.abs(yFraction - 0.5);
  if (d < 0.15) return '#22c55e'; // green
  if (d < 0.35) return '#eab308'; // yellow
  return '#ef4444';                // red
}

function fractionToAccuracy(yFraction: number): number {
  // Distance from center (0.5) mapped 0-1
  return Math.min(1, Math.abs(yFraction - 0.5) * 2);
}

export function AccuracyMeter({ speed, onComplete, active }: AccuracyMeterProps) {
  const [markerY, setMarkerY] = useState(0); // 0 = top, METER_HEIGHT = bottom
  const directionRef = useRef<1 | -1>(1);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStop = useCallback(() => {
    if (!active || completedRef.current) return;
    completedRef.current = true;
    cancelAnimationFrame(animFrameRef.current);
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    const yFraction = markerY / (METER_HEIGHT - MARKER_HEIGHT);
    onComplete(fractionToAccuracy(yFraction));
  }, [active, markerY, onComplete]);

  // Keyboard: spacebar to stop
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleStop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, handleStop]);

  // Animation loop
  useEffect(() => {
    if (!active) return;
    completedRef.current = false;
    lastTimeRef.current = null;

    const animate = (ts: number) => {
      if (completedRef.current) return;

      if (lastTimeRef.current === null) {
        lastTimeRef.current = ts;
      }
      const dt = (ts - lastTimeRef.current) / 1000;
      lastTimeRef.current = ts;

      setMarkerY(prev => {
        let next = prev + directionRef.current * speed * dt;
        const maxY = METER_HEIGHT - MARKER_HEIGHT;
        if (next >= maxY) {
          next = maxY;
          directionRef.current = -1;
        } else if (next <= 0) {
          next = 0;
          directionRef.current = 1;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    // Auto-resolve after 3 seconds
    autoTimerRef.current = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        cancelAnimationFrame(animFrameRef.current);
        setMarkerY(prev => {
          const yFraction = prev / (METER_HEIGHT - MARKER_HEIGHT);
          onComplete(fractionToAccuracy(yFraction));
          return prev;
        });
      }
    }, AUTO_RESOLVE_MS);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, speed]);

  const yFraction = markerY / (METER_HEIGHT - MARKER_HEIGHT);
  const markerColor = getZoneColor(yFraction);

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-cream-dim font-mono uppercase tracking-widest">
        Accuracy
      </p>

      <div
        className="relative rounded overflow-hidden border border-navy-lighter cursor-pointer select-none"
        style={{ width: METER_WIDTH, height: METER_HEIGHT }}
        onClick={handleStop}
        role="button"
        aria-label="Click to lock accuracy"
        tabIndex={active ? 0 : -1}
        onKeyDown={(e) => { if (e.code === 'Enter') handleStop(); }}
      >
        {/* Zone gradient segments */}
        {/* Red top */}
        <div className="absolute left-0 right-0 bg-red-900/60"   style={{ top: 0,   height: METER_HEIGHT * 0.15 }} />
        {/* Yellow upper */}
        <div className="absolute left-0 right-0 bg-yellow-900/50" style={{ top: METER_HEIGHT * 0.15, height: METER_HEIGHT * 0.20 }} />
        {/* Green center */}
        <div className="absolute left-0 right-0 bg-green-900/60"  style={{ top: METER_HEIGHT * 0.35, height: METER_HEIGHT * 0.30 }} />
        {/* Yellow lower */}
        <div className="absolute left-0 right-0 bg-yellow-900/50" style={{ top: METER_HEIGHT * 0.65, height: METER_HEIGHT * 0.20 }} />
        {/* Red bottom */}
        <div className="absolute left-0 right-0 bg-red-900/60"    style={{ top: METER_HEIGHT * 0.85, height: METER_HEIGHT * 0.15 }} />

        {/* Center "perfect" line */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-green-400/40 pointer-events-none"
          style={{ top: METER_HEIGHT * 0.5 - 1 }}
        />

        {/* Moving marker */}
        <div
          className={cn(
            'absolute left-0 right-0 rounded-sm transition-none pointer-events-none',
          )}
          style={{
            top: markerY,
            height: MARKER_HEIGHT,
            backgroundColor: markerColor,
            boxShadow: `0 0 6px ${markerColor}`,
          }}
        />
      </div>

      <p className="text-xs text-cream-dim/60">
        {active ? 'Click or Space' : '—'}
      </p>
    </div>
  );
}

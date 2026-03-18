import { useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore.ts';

/**
 * Manages the interactive game tick.
 *
 * - When CPU turn (cpu_pitch / post_pitch / post_ab), auto-advances after delay.
 * - When animating, waits for onAnimationComplete.
 * - Handles auto-play mode.
 * - Speed: 1 = 1200ms delay, 10 = 100ms delay (linear interpolation).
 */
export function useGameLoop(): void {
  const phase = useGameStore(s => s.phase);
  const isAutoPlaying = useGameStore(s => s.isAutoPlaying);
  const gameSpeed = useGameStore(s => s.gameSpeed);
  const userRole = useGameStore(s => s.userRole);
  const autoAdvance = useGameStore(s => s.autoAdvance);
  const onAnimationComplete = useGameStore(s => s.onAnimationComplete);
  const startNextAtBat = useGameStore(s => s.startNextAtBat);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer(): void {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  // Delay in ms based on speed (1-10)
  const getDelay = (): number => {
    // Speed 1 → 1200ms, speed 10 → 100ms
    return Math.round(1200 - (gameSpeed - 1) * (1100 / 9));
  };

  useEffect(() => {
    clearTimer();

    // Don't tick if game is over or idle
    if (phase === 'game_over' || phase === 'idle') return;

    // When animating, auto-complete after a short fixed delay
    if (phase === 'animating') {
      timerRef.current = setTimeout(() => {
        onAnimationComplete();
      }, Math.min(getDelay(), 400));
      return;
    }

    // When it's the user's turn, don't auto-advance (wait for input)
    if ((phase === 'awaiting_swing' || phase === 'awaiting_pitch') && !isAutoPlaying) {
      return;
    }

    // CPU turn or spectating — auto-advance
    const isCpuTurn = phase === 'cpu_pitch' || phase === 'post_pitch' || phase === 'post_ab';
    const isUserButAutoplay = isAutoPlaying && (phase === 'awaiting_swing' || phase === 'awaiting_pitch');

    if (isCpuTurn || isUserButAutoplay) {
      const delay = isAutoPlaying ? getDelay() : getDelay();

      if (phase === 'post_ab') {
        timerRef.current = setTimeout(() => {
          startNextAtBat();
        }, delay);
      } else {
        timerRef.current = setTimeout(() => {
          autoAdvance();
        }, delay);
      }
    }

    return clearTimer;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isAutoPlaying, gameSpeed, userRole]);

  // Cleanup on unmount
  useEffect(() => {
    return clearTimer;
  }, []);
}

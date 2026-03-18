import { useRef, useEffect, useCallback } from 'react';
import type { GameEvent } from '@/engine/types/index.ts';
import type { BaseState } from '@/engine/types/game.ts';
import { DiamondRenderer } from './DiamondRenderer.ts';

interface DiamondViewProps {
  bases: { first: boolean; second: boolean; third: boolean };
  events: GameEvent[];
  isAnimating?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

/** Convert engine BaseState (player ID | null) to simple booleans. */
export function baseStateToBools(bs: BaseState): { first: boolean; second: boolean; third: boolean } {
  return {
    first: bs.first !== null,
    second: bs.second !== null,
    third: bs.third !== null,
  };
}

export function DiamondView({
  bases,
  events,
  width = 600,
  height = 500,
  className,
}: DiamondViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<DiamondRenderer | null>(null);
  const processedCountRef = useRef(0);

  // ── Initialize / Destroy ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new DiamondRenderer();
    rendererRef.current = renderer;

    renderer.init(canvas, width, height).catch((err: unknown) => {
      console.error('[DiamondView] Failed to init renderer:', err);
    });

    return () => {
      renderer.destroy();
      rendererRef.current = null;
      processedCountRef.current = 0;
    };
  }, [width, height]);

  // ── Sync base runners ─────────────────────────────────────────────
  useEffect(() => {
    rendererRef.current?.updateBases(bases);
  }, [bases]);

  // ── Process new game events for animations ────────────────────────
  const processEvent = useCallback(async (event: GameEvent) => {
    const r = rendererRef.current;
    if (!r) return;

    switch (event.type) {
      case 'pitch':
        await r.animatePitch();
        break;

      case 'at_bat_result': {
        // Determine hit type + animate
        const result = event.result;
        if (result === 'single' || result === 'double' || result === 'triple') {
          const hitTypes: Record<string, 'ground_ball' | 'line_drive' | 'fly_ball'> = {
            single: 'ground_ball',
            double: 'line_drive',
            triple: 'line_drive',
          };
          const hitType = hitTypes[result] ?? 'ground_ball';
          // Random-ish angle based on description hash
          const angle = hashAngle(event.description);
          const dist = result === 'single' ? 0.4 : result === 'double' ? 0.6 : 0.85;
          await r.animateHit(hitType, angle, dist);

          // Highlight the base the batter ends up on
          const baseNum = result === 'single' ? 1 : result === 'double' ? 2 : 3;
          r.highlightBase(baseNum);
        } else if (result === 'home_run') {
          const angle = hashAngle(event.description);
          await r.animateHit('home_run', angle, 1.0);
        } else if (
          result === 'groundout' || result === 'fielders_choice' ||
          result === 'double_play' || result === 'triple_play'
        ) {
          const angle = hashAngle(event.description);
          await r.animateHit('ground_ball', angle, 0.3);
          // Fielding throw to first
          await r.animateFielding('SS');
        } else if (result === 'flyout' || result === 'sacrifice_fly') {
          const angle = hashAngle(event.description);
          await r.animateHit('fly_ball', angle, 0.55);
        } else if (result === 'lineout') {
          const angle = hashAngle(event.description);
          await r.animateHit('line_drive', angle, 0.35);
        } else if (result === 'popout' || result === 'sacrifice_bunt') {
          const angle = hashAngle(event.description);
          await r.animateHit('popup', angle, 0.2);
        }
        // walks, HBP, strikeouts — no ball-in-play animation needed
        break;
      }

      case 'steal_attempt':
        // Highlight the target base
        r.highlightBase(event.base);
        break;

      case 'inning_change':
        r.reset();
        break;

      default:
        break;
    }
  }, []);

  useEffect(() => {
    const newEvents = events.slice(processedCountRef.current);
    processedCountRef.current = events.length;

    if (newEvents.length === 0) return;

    // Process events sequentially
    let chain = Promise.resolve();
    for (const ev of newEvents) {
      chain = chain.then(() => processEvent(ev));
    }
  }, [events, processEvent]);

  return (
    <div className={className} style={{ width, height, background: '#1a2235', borderRadius: 8, overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Derive a deterministic angle (-40 to +40) from a string for visual variety. */
function hashAngle(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  // Map to -40..+40 range
  return ((Math.abs(h) % 80) - 40);
}

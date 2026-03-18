import { useRef, useEffect, useCallback, useState } from 'react';
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
  /** If true, attempt to use sprite-based players; falls back to procedural on failure. */
  preferSprites?: boolean;
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
  preferSprites = true,
}: DiamondViewProps) {
  // Use a div container — Pixi creates its own canvas inside it.
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<DiamondRenderer | null>(null);
  const processedCountRef = useRef(0);
  const [spriteStatus, setSpriteStatus] = useState<'loading' | 'sprites' | 'procedural'>('loading');

  // ── Initialize / Destroy ──────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new DiamondRenderer();
    rendererRef.current = renderer;

    renderer.initInContainer(container, width, height)
      .then(async () => {
        if (preferSprites) {
          const loaded = await renderer.loadSprites();
          setSpriteStatus(loaded ? 'sprites' : 'procedural');
        } else {
          setSpriteStatus('procedural');
        }
      })
      .catch((err: unknown) => {
        console.error('[DiamondView] Failed to init renderer:', err);
        setSpriteStatus('procedural');
      });

    return () => {
      renderer.destroy();
      rendererRef.current = null;
      processedCountRef.current = 0;
    };
  }, [width, height, preferSprites]);

  // ── Sync base runners ─────────────────────────────────────────────
  useEffect(() => {
    rendererRef.current?.updateBases(bases);
  }, [bases]);

  // ── Process new game events for animations ────────────────────────
  const processEvent = useCallback(async (event: GameEvent) => {
    const r = rendererRef.current;
    if (!r) return;

    // Get the sprite scene if available (null in procedural mode)
    const ss = r.getSpriteScene();

    switch (event.type) {
      case 'pitch': {
        // Pitcher windup then ball travels, then umpire call
        const pitchAnimations: Promise<void>[] = [r.animatePitch()];
        if (ss) {
          pitchAnimations.push(ss.animatePitcherWindup());
        }
        await Promise.all(pitchAnimations);

        if (ss) {
          const result = event.result;
          if (
            result === 'strike' || result === 'swinging_strike' ||
            result === 'called_strike' || result === 'foul'
          ) {
            await ss.animateUmpireStrikeCall();
          } else if (result === 'ball') {
            await ss.animateUmpireBallCall();
          }
        }
        break;
      }

      case 'at_bat_result': {
        const result = event.result;

        if (result === 'strikeout') {
          // Batter strikeout: swing + umpire punch-out
          if (ss) {
            await Promise.all([
              ss.animateBatterSwing('late'),
              ss.animateUmpireStrikeCall(),
            ]);
          }
        } else if (result === 'walk' || result === 'hit_by_pitch') {
          // Walk: batter takes, nothing dramatic
          if (ss) await ss.animateBatterTake();
        } else if (result === 'single' || result === 'double' || result === 'triple') {
          // Hit: swing, then ball travels, then fielder catches
          const hitTypes: Record<string, 'ground_ball' | 'line_drive' | 'fly_ball'> = {
            single: 'ground_ball',
            double: 'line_drive',
            triple: 'line_drive',
          };
          const hitType = hitTypes[result] ?? 'ground_ball';
          const angle = hashAngle(event.description);
          const dist = result === 'single' ? 0.4 : result === 'double' ? 0.6 : 0.85;

          const hitAnimations: Promise<void>[] = [r.animateHit(hitType, angle, dist)];
          if (ss) hitAnimations.push(ss.animateBatterSwing('perfect'));
          await Promise.all(hitAnimations);

          // Highlight the destination base
          const baseNum = result === 'single' ? 1 : result === 'double' ? 2 : 3;
          r.highlightBase(baseNum);

          // Fielder catches
          if (ss) {
            const fielder = _pickFielder(result, angle);
            await ss.animateFielderCatch(fielder);
          }
        } else if (result === 'home_run') {
          const angle = hashAngle(event.description);
          const hrAnimations: Promise<void>[] = [r.animateHit('home_run', angle, 1.0)];
          if (ss) hrAnimations.push(ss.animateBatterSwing('perfect'));
          await Promise.all(hrAnimations);
        } else if (
          result === 'groundout' || result === 'fielders_choice' ||
          result === 'double_play' || result === 'triple_play'
        ) {
          const angle = hashAngle(event.description);
          const goAnimations: Promise<void>[] = [r.animateHit('ground_ball', angle, 0.3)];
          if (ss) goAnimations.push(ss.animateBatterSwing('normal'));
          await Promise.all(goAnimations);

          // Fielder fields then throws
          if (ss) {
            const fielder = _pickFielder('groundout', angle);
            await ss.animateFielderCatch(fielder);
            await ss.animateFielderThrow(fielder);
          } else {
            await r.animateFielding('SS');
          }
        } else if (result === 'flyout' || result === 'sacrifice_fly') {
          const angle = hashAngle(event.description);
          const foAnimations: Promise<void>[] = [r.animateHit('fly_ball', angle, 0.55)];
          if (ss) foAnimations.push(ss.animateBatterSwing('perfect'));
          await Promise.all(foAnimations);

          if (ss) {
            const fielder = _pickOutfielder(angle);
            await ss.animateFielderCatch(fielder);
          }
        } else if (result === 'lineout') {
          const angle = hashAngle(event.description);
          const loAnimations: Promise<void>[] = [r.animateHit('line_drive', angle, 0.35)];
          if (ss) loAnimations.push(ss.animateBatterSwing('perfect'));
          await Promise.all(loAnimations);

          if (ss) {
            const fielder = _pickFielder('lineout', angle);
            await ss.animateFielderCatch(fielder);
          }
        } else if (result === 'popout' || result === 'sacrifice_bunt') {
          const angle = hashAngle(event.description);
          const poAnimations: Promise<void>[] = [r.animateHit('popup', angle, 0.2)];
          if (ss) poAnimations.push(ss.animateBatterSwing('normal'));
          await Promise.all(poAnimations);

          if (ss) {
            await ss.animateFielderCatch('SS');
          }
        }
        break;
      }

      case 'steal_attempt':
        r.highlightBase(event.base);
        break;

      case 'inning_change':
        r.reset();
        // Reset sprite positions to ready
        ss?.resetToReady();
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
    <div
      className={className}
      style={{ position: 'relative', width, height, background: '#1a2235', borderRadius: 8, overflow: 'hidden' }}
    >
      {/* Pixi creates its own canvas inside this container div */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
      {spriteStatus === 'loading' && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 10,
            fontSize: 10,
            color: 'rgba(255,255,255,0.4)',
            fontFamily: 'IBM Plex Mono, monospace',
            pointerEvents: 'none',
          }}
        >
          loading sprites…
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Derive a deterministic angle (-40 to +40) from a string for visual variety. */
function hashAngle(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return ((Math.abs(h) % 80) - 40);
}

/**
 * Pick a reasonable fielder position based on result type and spray angle.
 * angle: negative = pulled left, positive = pulled right (from batter's POV).
 */
function _pickFielder(result: string, angle: number): string {
  if (result === 'groundout' || result === 'fielders_choice' || result === 'double_play') {
    if (angle < -15) return '3B';
    if (angle > 15) return '1B';
    return angle < 0 ? 'SS' : '2B';
  }
  if (result === 'lineout') {
    if (angle < -20) return 'SS';
    if (angle > 20) return '2B';
    return 'CF';
  }
  // Default: midfield
  if (angle < -10) return 'SS';
  if (angle > 10) return '2B';
  return 'SS';
}

function _pickOutfielder(angle: number): string {
  if (angle < -20) return 'LF';
  if (angle > 20) return 'RF';
  return 'CF';
}

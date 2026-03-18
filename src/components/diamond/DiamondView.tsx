import { useRef, useEffect, useCallback, useState } from 'react';
import type { GameEvent } from '@/engine/types/index.ts';
import type { BaseState } from '@/engine/types/game.ts';
import { DiamondRenderer } from './DiamondRenderer.ts';
import { PlaySequencer } from './PlaySequencer.ts';

interface DiamondViewProps {
  bases: { first: boolean; second: boolean; third: boolean };
  events: GameEvent[];
  isAnimating?: boolean;
  width?: number;
  height?: number;
  className?: string;
  /** If true, attempt to use sprite-based players; falls back to procedural on failure. */
  preferSprites?: boolean;
  /** Speed multiplier for animations (1 = normal, higher = faster). */
  animationSpeed?: number;
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
  animationSpeed = 1,
}: DiamondViewProps) {
  // Use a div container — Pixi creates its own canvas inside it.
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<DiamondRenderer | null>(null);
  const sequencerRef = useRef<PlaySequencer | null>(null);
  const processedCountRef = useRef(0);
  const [spriteStatus, setSpriteStatus] = useState<'loading' | 'sprites' | 'procedural'>('loading');

  // ── Initialize / Destroy ──────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new DiamondRenderer();
    rendererRef.current = renderer;

    const sequencer = new PlaySequencer(renderer);
    sequencer.speedFactor = animationSpeed;
    sequencerRef.current = sequencer;

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
      sequencer.destroy();
      sequencerRef.current = null;
      renderer.destroy();
      rendererRef.current = null;
      processedCountRef.current = 0;
    };
  }, [width, height, preferSprites]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync animation speed ──────────────────────────────────────────
  useEffect(() => {
    if (sequencerRef.current) {
      sequencerRef.current.speedFactor = animationSpeed;
    }
  }, [animationSpeed]);

  // ── Sync base runners ─────────────────────────────────────────────
  useEffect(() => {
    rendererRef.current?.updateBases(bases);
  }, [bases]);

  // ── Process new game events for animations ────────────────────────
  const processEvent = useCallback(async (event: GameEvent) => {
    const seq = sequencerRef.current;
    if (!seq) return;

    await seq.playEvent(event);

    // Post-animation base sync for steal attempts / errors
    const r = rendererRef.current;
    if (!r) return;

    if (event.type === 'steal_attempt') {
      r.highlightBase(event.base);
    }
  }, []);

  useEffect(() => {
    const newEvents = events.slice(processedCountRef.current);
    processedCountRef.current = events.length;

    if (newEvents.length === 0) return;

    // Process events sequentially — each waits for the previous to finish
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
// (kept for any external consumers that might use them)

/** Derive a deterministic angle (-40 to +40) from a string for visual variety. */
export function hashAngle(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return ((Math.abs(h) % 80) - 40);
}

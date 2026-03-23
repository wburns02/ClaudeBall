import { useRef, useEffect, useCallback, useState } from 'react';
import type { GameEvent } from '@/engine/types/index.ts';
import type { BaseState } from '@/engine/types/game.ts';
import { DiamondRenderer } from './DiamondRenderer.ts';
import { PlaySequencer } from './PlaySequencer.ts';
import { AtBatCamera } from './AtBatCamera.ts';
import { AtBatOverlay } from '../game/AtBatOverlay.tsx';
import type { AtBatOverlayState } from '../game/AtBatOverlay.tsx';

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
  /** If true, the canvas fills its parent container and resizes on window resize. */
  fullScreen?: boolean;
  /** Stadium background key: 'default' | 'day' | 'night' | 'sunset' */
  stadium?: string;
}

/** Convert engine BaseState (player ID | null) to simple booleans. */
export function baseStateToBools(bs: BaseState): { first: boolean; second: boolean; third: boolean } {
  return {
    first: bs.first !== null,
    second: bs.second !== null,
    third: bs.third !== null,
  };
}

const OVERLAY_INITIAL: AtBatOverlayState = {
  visible: false,
  pitchType: '',
  pitchSpeedMph: 0,
  resultText: '',
  balls: 0,
  strikes: 0,
  batterName: '',
  pitcherName: '',
  pitchCount: 0,
};

export function DiamondView({
  bases,
  events,
  width = 600,
  height = 500,
  className,
  preferSprites = true,
  animationSpeed = 1,
  fullScreen = false,
  stadium = 'default',
}: DiamondViewProps) {
  // Use a div container — Pixi creates its own canvas inside it.
  const outerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<DiamondRenderer | null>(null);
  const sequencerRef = useRef<PlaySequencer | null>(null);
  const cameraRef = useRef<AtBatCamera | null>(null);
  const processedCountRef = useRef(0);
  const [spriteStatus, setSpriteStatus] = useState<'loading' | 'sprites' | 'procedural'>('loading');
  const [overlayState, setOverlayState] = useState<AtBatOverlayState>(OVERLAY_INITIAL);

  // Resolve pixel dimensions — use outer container when fullScreen
  const getSize = (): { w: number; h: number } => {
    if (fullScreen && outerRef.current) {
      return {
        w: outerRef.current.clientWidth || window.innerWidth,
        h: outerRef.current.clientHeight || window.innerHeight,
      };
    }
    return { w: width, h: height };
  };

  // ── Initialize / Destroy ──────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { w, h } = getSize();

    const renderer = new DiamondRenderer();
    rendererRef.current = renderer;

    // Create camera early — before init completes. It becomes active once attachRoot() is called.
    const cam = new AtBatCamera();
    cameraRef.current = cam;

    const sequencer = new PlaySequencer(renderer);
    sequencer.speedFactor = animationSpeed;
    // Wire camera + overlay callback into sequencer IMMEDIATELY (camera will attach to root later)
    sequencer.camera = cam;
    sequencer.onOverlayUpdate = (state) => {
      setOverlayState(prev => ({ ...prev, ...state }));
    };
    sequencerRef.current = sequencer;

    renderer.initInContainer(container, w, h)
      .then(async () => {
        // Attach Pixi root to camera now that renderer is initialized
        const root = renderer.getRoot();
        if (root && !renderer._destroyed) {
          const bt = renderer.getRootBaseTransform();
          // Attach to the camera that's already wired to the sequencer
          cameraRef.current?.attachRoot(root, bt.scaleX, bt.scaleY, bt.x, bt.y);
        }

        // Load scene/environment assets (stadium, weather, scoreboard) — non-blocking
        // Fire-and-forget: scene renders fine without them, they just layer on top.
        void renderer.loadSceneSprites();

        // Load stadium background if not default (supports day/sunset/night atmosphere)
        if (stadium !== 'default') {
          void renderer.setStadium(stadium);
        }

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
      cam.destroy();
      cameraRef.current = null;
      renderer.destroy();
      rendererRef.current = null;
      processedCountRef.current = 0;
      setOverlayState(OVERLAY_INITIAL);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, preferSprites, fullScreen]);

  // ── Stadium background switching ─────────────────────────────────
  useEffect(() => {
    const renderer = rendererRef.current;
    if (renderer && stadium !== 'default') {
      void renderer.setStadium(stadium);
    }
  }, [stadium]);

  // ── Resize observer for fullScreen mode ──────────────────────────
  useEffect(() => {
    if (!fullScreen) return;
    const outer = outerRef.current;
    if (!outer) return;

    const onResize = () => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      const { w, h } = getSize();
      // Access internal Pixi app resize if available
      const app = (renderer as unknown as { _app?: { renderer?: { resize: (w: number, h: number) => void } } })._app;
      if (app?.renderer?.resize) {
        app.renderer.resize(w, h);
      }
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(outer);
    window.addEventListener('resize', onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullScreen]);

  // ── Sync animation speed ──────────────────────────────────────────
  useEffect(() => {
    if (sequencerRef.current) {
      sequencerRef.current.speedFactor = animationSpeed;
    }
  }, [animationSpeed]);

  // ── Extract batter/pitcher names from events for overlay ──────────
  useEffect(() => {
    const seq = sequencerRef.current;
    if (!seq) return;
    // Look for the most recent at_bat_result event to get names
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (ev && ev.type === 'at_bat_result') {
        seq.setAtBatNames(ev.batter ?? '', ev.pitcher ?? '');
        break;
      }
    }
  }, [events]);

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
      ref={outerRef}
      className={className}
      style={
        fullScreen
          ? { position: 'relative', width: '100%', height: '100%', background: '#1a2235', overflow: 'hidden' }
          : { position: 'relative', width, height, background: '#1a2235', borderRadius: 8, overflow: 'hidden' }
      }
    >
      {/* Pixi creates its own canvas inside this container div */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />

      {/* At-bat close-up overlay — fades in/out with camera zoom */}
      <AtBatOverlay state={overlayState} />

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

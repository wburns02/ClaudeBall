// ── CatchPop.ts ───────────────────────────────────────────────────────────────
// Small "pop" effect when ball hits the glove: 6 white dots explode outward
// + expanding ring outline. Total duration ~200ms.

import { Graphics, Ticker, Container } from 'pixi.js';
import type { Application } from 'pixi.js';

const DOT_COUNT  = 6;
const TRAVEL_PX  = 8;   // how far dots travel
const DOT_MS     = 200;
const RING_FROM  = 5;
const RING_TO    = 20;
const RING_MS    = 200;

export function spawnCatchPop(
  app: Application,
  x: number,
  y: number,
  parent?: Container,
): void {
  const layer: Container = parent ?? (app.stage as unknown as Container);

  // ── Expanding ring ────────────────────────────────────────────────────────
  const ring = new Graphics();
  ring.x = x;
  ring.y = y;
  layer.addChild(ring);

  let ringLife = 0;
  const onRing = (ticker: Ticker) => {
    ringLife += ticker.deltaMS;
    const t = Math.min(ringLife / RING_MS, 1);
    const radius = RING_FROM + (RING_TO - RING_FROM) * t;
    ring.clear();
    ring.circle(0, 0, radius);
    ring.stroke({ width: 1.2, color: 0xffffff, alpha: Math.max(0, 1 - t) });
    if (t >= 1) {
      Ticker.shared.remove(onRing);
      if (ring.parent) ring.parent.removeChild(ring);
      ring.destroy();
    }
  };
  Ticker.shared.add(onRing);

  // ── Dot particles ─────────────────────────────────────────────────────────
  interface DotP { g: Graphics; angle: number }
  const dots: DotP[] = [];
  for (let i = 0; i < DOT_COUNT; i++) {
    const g = new Graphics();
    g.circle(0, 0, 1.5);
    g.fill({ color: 0xffffff });
    g.x = x;
    g.y = y;
    layer.addChild(g);
    dots.push({ g, angle: (i / DOT_COUNT) * Math.PI * 2 });
  }

  let dotLife = 0;
  const onDots = (ticker: Ticker) => {
    dotLife += ticker.deltaMS;
    const t = Math.min(dotLife / DOT_MS, 1);
    const ease = 1 - Math.pow(1 - t, 2); // ease-out quad
    for (const d of dots) {
      d.g.x = x + Math.cos(d.angle) * TRAVEL_PX * ease;
      d.g.y = y + Math.sin(d.angle) * TRAVEL_PX * ease;
      d.g.alpha = Math.max(0, 1 - t);
    }
    if (t >= 1) {
      Ticker.shared.remove(onDots);
      for (const d of dots) {
        if (d.g.parent) d.g.parent.removeChild(d.g);
        d.g.destroy();
      }
    }
  };
  Ticker.shared.add(onDots);
}

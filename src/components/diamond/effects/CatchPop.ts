// ── CatchPop.ts ───────────────────────────────────────────────────────────────
// Griffey Jr.-style glove pop effect. Satisfying "thwack" visual —
// bright white flash + expanding ring + small sparks. Total duration ~280ms.

import { Graphics, Ticker, Container } from 'pixi.js';
import type { Application } from 'pixi.js';

const SPARK_COUNT  = 8;
const SPARK_REACH  = 14;
const FLASH_SIZE   = 8;
const RING_FROM    = 4;
const RING_TO      = 22;
const TOTAL_MS     = 280;

export function spawnCatchPop(
  app: Application,
  x: number,
  y: number,
  parent?: Container,
): void {
  const layer: Container = parent ?? (app.stage as unknown as Container);
  const container = new Container();
  container.x = x;
  container.y = y;
  layer.addChild(container);

  // Center flash
  const flash = new Graphics();
  flash.circle(0, 0, FLASH_SIZE);
  flash.fill({ color: 0xffffff, alpha: 0.9 });
  container.addChild(flash);

  // Expanding ring
  const ring = new Graphics();
  ring.circle(0, 0, RING_FROM);
  ring.stroke({ width: 1.5, color: 0xffffff, alpha: 0.7 });
  container.addChild(ring);

  // Spark dots
  interface SparkInfo { g: Graphics; angle: number }
  const sparks: SparkInfo[] = [];
  for (let i = 0; i < SPARK_COUNT; i++) {
    const g = new Graphics();
    const size = 1 + Math.random() * 1.5;
    g.circle(0, 0, size);
    g.fill({ color: 0xffffff });
    container.addChild(g);
    sparks.push({ g, angle: (i / SPARK_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.3 });
  }

  let elapsed = 0;
  const onTick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS;
    const t = Math.min(elapsed / TOTAL_MS, 1);
    const easeOut = 1 - Math.pow(1 - t, 3);

    // Flash: instant bright, then fade
    flash.alpha = 0.9 * (1 - t);
    flash.scale.set(1 + easeOut * 0.5);

    // Ring: expand and fade
    ring.clear();
    const radius = RING_FROM + (RING_TO - RING_FROM) * easeOut;
    ring.circle(0, 0, radius);
    ring.stroke({ width: 1.5 - t * 0.5, color: 0xffffff, alpha: Math.max(0, 0.7 * (1 - t)) });

    // Sparks fly outward
    for (const s of sparks) {
      const dist = SPARK_REACH * easeOut;
      s.g.x = Math.cos(s.angle) * dist;
      s.g.y = Math.sin(s.angle) * dist;
      s.g.alpha = 1 - t * t;
    }

    if (t >= 1) {
      Ticker.shared.remove(onTick);
      if (container.parent) container.parent.removeChild(container);
      container.destroy({ children: true });
    }
  };

  Ticker.shared.add(onTick);
}

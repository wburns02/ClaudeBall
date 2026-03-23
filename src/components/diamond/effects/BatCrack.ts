// ── BatCrack.ts ───────────────────────────────────────────────────────────────
// Ken Griffey Jr.-style bat crack impact effect.
// Satisfying white-hot center flash + radiating gold/white spark diamonds +
// expanding ring. Total duration ~350ms.

import { Graphics, Ticker, Container } from 'pixi.js';
import type { Application } from 'pixi.js';

const SPARK_COUNT  = 16;
const SPARK_SIZE   = 2.5;   // max spark diamond size
const SPARK_REACH  = 28;    // max distance from center
const EXTEND_MS    = 120;   // sparks fly out
const HOLD_MS      = 60;    // hold at full
const FADE_MS      = 170;   // fade away
const TOTAL_MS     = EXTEND_MS + HOLD_MS + FADE_MS;

const FLASH_RADIUS = 14;
const RING_RADIUS  = 22;

const GOLD = 0xd4a843;

export function spawnBatCrack(
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

  // ── Center flash (white-hot) ──────────────────────────────────────────
  const flash = new Graphics();
  flash.circle(0, 0, FLASH_RADIUS);
  flash.fill({ color: 0xffffff, alpha: 0.95 });
  container.addChild(flash);

  // ── Gold ring burst ────────────────────────────────────────────────────
  const ring = new Graphics();
  ring.circle(0, 0, RING_RADIUS);
  ring.stroke({ color: GOLD, width: 2.5, alpha: 0.8 });
  container.addChild(ring);

  // ── Spark diamonds ─────────────────────────────────────────────────────
  interface SparkData { g: Graphics; angle: number; dist: number; size: number }
  const sparks: SparkData[] = [];

  for (let i = 0; i < SPARK_COUNT; i++) {
    const angle = (i / SPARK_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
    const isGold = i % 3 === 0;
    const size = SPARK_SIZE * (0.6 + Math.random() * 0.4);
    const dist = SPARK_REACH * (0.7 + Math.random() * 0.3);

    const g = new Graphics();
    // Diamond shape — 16-bit pixel feel
    g.beginPath();
    g.moveTo(0, -size);
    g.lineTo(size * 0.7, 0);
    g.lineTo(0, size);
    g.lineTo(-size * 0.7, 0);
    g.closePath();
    g.fill({ color: isGold ? GOLD : 0xffffff });
    container.addChild(g);

    sparks.push({ g, angle, dist, size });
  }

  let elapsed = 0;

  const onTick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS;
    const t = Math.min(elapsed / TOTAL_MS, 1);

    // Extension phase: sparks fly outward
    const extT = Math.min(elapsed / EXTEND_MS, 1);
    // Ease out cubic
    const easeExt = 1 - Math.pow(1 - extT, 3);

    // Fade phase
    const fadeStart = EXTEND_MS + HOLD_MS;
    const fadeT = Math.max(0, (elapsed - fadeStart) / FADE_MS);
    const alpha = Math.max(0, 1 - fadeT);

    // Flash: immediate then fade
    flash.alpha = 0.95 * Math.max(0, 1 - elapsed / (EXTEND_MS * 0.8));
    flash.scale.set(1 + easeExt * 0.5);

    // Ring: expand and fade
    ring.alpha = 0.8 * alpha;
    ring.scale.set(1 + easeExt * 1.8);

    // Sparks
    for (const s of sparks) {
      const d = s.dist * easeExt;
      s.g.x = Math.cos(s.angle) * d;
      s.g.y = Math.sin(s.angle) * d;
      s.g.alpha = alpha;
      s.g.scale.set(1 - fadeT * 0.4);
      s.g.rotation += 0.08;
    }

    if (t >= 1) {
      Ticker.shared.remove(onTick);
      if (container.parent) container.parent.removeChild(container);
      container.destroy({ children: true });
    }
  };

  Ticker.shared.add(onTick);
}

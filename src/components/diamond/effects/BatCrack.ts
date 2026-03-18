// ── BatCrack.ts ───────────────────────────────────────────────────────────────
// Comic-book-style star burst at bat-ball contact. 12 radiating lines + center
// flash. Total duration ~250ms.

import { Graphics, Ticker, Container } from 'pixi.js';
import type { Application } from 'pixi.js';

const LINE_COUNT   = 12;
const LINE_LENGTH  = 15;   // px at full extension
const EXTEND_MS    = 150;  // time to reach full length
const FADE_MS      = 100;  // fade after full extension
const TOTAL_MS     = EXTEND_MS + FADE_MS;

const FLASH_RADIUS = 20;
const FLASH_MS     = 80;

export function spawnBatCrack(
  app: Application,
  x: number,
  y: number,
  parent?: Container,
): void {
  const layer: Container = parent ?? (app.stage as unknown as Container);

  // ── Center circle flash ──────────────────────────────────────────────────
  const flash = new Graphics();
  flash.circle(0, 0, FLASH_RADIUS);
  flash.fill({ color: 0xffffff, alpha: 0.9 });
  flash.x = x;
  flash.y = y;
  layer.addChild(flash);

  let flashLife = 0;
  const onFlash = (ticker: Ticker) => {
    flashLife += ticker.deltaMS;
    const t = Math.min(flashLife / FLASH_MS, 1);
    flash.alpha = 0.9 * (1 - t);
    if (t >= 1) {
      Ticker.shared.remove(onFlash);
      if (flash.parent) flash.parent.removeChild(flash);
      flash.destroy();
    }
  };
  Ticker.shared.add(onFlash);

  // ── Radiating lines ──────────────────────────────────────────────────────
  // Each line is a very thin Graphics drawn fresh each frame
  const container = new Container();
  container.x = x;
  container.y = y;
  layer.addChild(container);

  const angles: number[] = [];
  for (let i = 0; i < LINE_COUNT; i++) {
    angles.push((i / LINE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.2);
  }

  let lineLife = 0;

  const onLines = (ticker: Ticker) => {
    lineLife += ticker.deltaMS;
    const t = Math.min(lineLife / TOTAL_MS, 1);

    // Extend phase [0, EXTEND_MS], then fade phase [EXTEND_MS, TOTAL_MS]
    const extT = Math.min(lineLife / EXTEND_MS, 1);
    const fadeT = Math.max(0, (lineLife - EXTEND_MS) / FADE_MS);
    const len = LINE_LENGTH * extT;
    const alpha = Math.max(0, 1 - fadeT);

    container.removeChildren();

    if (alpha > 0) {
      for (const angle of angles) {
        const line = new Graphics();
        // Draw inner gap so lines start slightly away from center
        const inner = len * 0.2;
        line.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        line.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
        line.stroke({ width: 1.5, color: 0xffffff, alpha });
        container.addChild(line);
      }
    }

    if (t >= 1) {
      Ticker.shared.remove(onLines);
      if (container.parent) container.parent.removeChild(container);
      container.destroy({ children: true });
    }
  };

  Ticker.shared.add(onLines);
}

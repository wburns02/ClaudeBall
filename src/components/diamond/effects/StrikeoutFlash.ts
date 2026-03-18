// ── StrikeoutFlash.ts ─────────────────────────────────────────────────────────
// Dramatic K (or backwards K) zoom-in and fade effect for strikeouts.
// Total duration ~700ms.

import { Text, Ticker, Container } from 'pixi.js';
import type { Application } from 'pixi.js';

const ZOOM_MS  = 300;  // scale 0.5 → 1.5
const FADE_MS  = 400;  // fade over last portion
const TOTAL_MS = ZOOM_MS + FADE_MS;

export function spawnStrikeoutK(
  app: Application,
  x: number,
  y: number,
  looking: boolean,
  parent?: Container,
): void {
  const layer: Container = parent ?? (app.stage as unknown as Container);

  const label = new Text({
    // Backwards K for looking (called third strike)
    text: looking ? 'ꓘ' : 'K',
    style: {
      fontFamily: 'Oswald, Impact, sans-serif',
      fontSize: 48,
      fontWeight: 'bold',
      fill: 0xc44d4d,
      stroke: { color: 0xffffff, width: 3 },
      dropShadow: {
        color: 0x000000,
        blur: 6,
        distance: 3,
        angle: Math.PI / 4,
      },
    },
  });

  label.anchor.set(0.5, 0.5);
  label.x = x;
  label.y = y;
  label.scale.set(0.5);
  label.alpha = 0;
  layer.addChild(label);

  let life = 0;

  const onTick = (ticker: Ticker) => {
    life += ticker.deltaMS;
    const t = Math.min(life / TOTAL_MS, 1);

    if (life <= ZOOM_MS) {
      // Zoom phase: scale from 0.5 to 1.5, fade in to opaque
      const zt = life / ZOOM_MS;
      label.scale.set(0.5 + 1.0 * zt);
      label.alpha = Math.min(1, zt * 2); // fade in quickly
    } else {
      // Fade phase: hold scale at 1.5, fade out
      const ft = (life - ZOOM_MS) / FADE_MS;
      label.scale.set(1.5);
      label.alpha = Math.max(0, 1 - ft);
    }

    if (t >= 1) {
      Ticker.shared.remove(onTick);
      if (label.parent) label.parent.removeChild(label);
      label.destroy();
    }
  };

  Ticker.shared.add(onTick);
}

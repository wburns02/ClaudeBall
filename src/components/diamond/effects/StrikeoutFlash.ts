// ── StrikeoutFlash.ts ─────────────────────────────────────────────────────────
// Griffey Jr.-style dramatic K that punches in big and fades up.
// Gold K with black outline, bounce-in animation. Total duration ~900ms.

import { Text, Graphics, Ticker, Container } from 'pixi.js';
import type { Application } from 'pixi.js';

const PUNCH_MS = 200;    // scale from 3.0 → 1.0 with bounce
const HOLD_MS  = 350;    // hold at full
const FADE_MS  = 350;    // fade upward
const TOTAL_MS = PUNCH_MS + HOLD_MS + FADE_MS;

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function spawnStrikeoutK(
  app: Application,
  x: number,
  y: number,
  looking: boolean,
  parent?: Container,
): void {
  const layer: Container = parent ?? (app.stage as unknown as Container);
  const container = new Container();
  container.x = x;
  container.y = y;
  layer.addChild(container);

  // Background flash circle (red ring)
  const ring = new Graphics();
  ring.circle(0, 0, 25);
  ring.stroke({ color: 0xcc3333, width: 3, alpha: 0.6 });
  ring.alpha = 0;
  container.addChild(ring);

  const label = new Text({
    text: looking ? 'Ꝁ' : 'K',
    style: {
      fontFamily: 'Oswald, Impact, sans-serif',
      fontSize: 52,
      fontWeight: 'bold',
      fill: 0xd4a843,
      stroke: { color: 0x000000, width: 4 },
      dropShadow: {
        color: 0x000000,
        blur: 6,
        distance: 3,
        angle: Math.PI / 4,
      },
    },
  });

  label.anchor.set(0.5, 0.5);
  label.scale.set(3);
  label.alpha = 0;
  container.addChild(label);

  let life = 0;

  const onTick = (ticker: Ticker) => {
    life += ticker.deltaMS;
    const t = Math.min(life / TOTAL_MS, 1);

    if (life <= PUNCH_MS) {
      // Punch in phase: scale 3.0 → 1.0 with overshoot
      const pt = life / PUNCH_MS;
      const scale = 3 - 2 * easeOutBack(pt);
      label.scale.set(Math.max(0.8, scale));
      label.alpha = Math.min(1, pt * 3);

      ring.alpha = pt * 0.6;
      ring.scale.set(0.5 + pt * 1.5);
    } else if (life <= PUNCH_MS + HOLD_MS) {
      // Hold: subtle pulse
      const ht = (life - PUNCH_MS) / HOLD_MS;
      label.scale.set(1 + Math.sin(ht * Math.PI * 4) * 0.03);
      label.alpha = 1;

      ring.alpha = 0.6 * (1 - ht * 0.5);
      ring.scale.set(2 + ht * 0.5);
    } else {
      // Fade: drift upward and fade out
      const ft = (life - PUNCH_MS - HOLD_MS) / FADE_MS;
      label.alpha = 1 - ft;
      label.y = -ft * 30;
      label.scale.set(1 - ft * 0.15);

      ring.alpha = 0;
    }

    if (t >= 1) {
      Ticker.shared.remove(onTick);
      if (container.parent) container.parent.removeChild(container);
      container.destroy({ children: true });
    }
  };

  Ticker.shared.add(onTick);
}

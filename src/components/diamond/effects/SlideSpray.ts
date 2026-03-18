// ── SlideSpray.ts ─────────────────────────────────────────────────────────────
// Directional dirt spray when a runner slides into a base.
// Particles arc toward the slide direction; some arc upward under gravity.

import { Graphics, Ticker, Container } from 'pixi.js';
import type { Application } from 'pixi.js';

const PARTICLE_COUNT = 20;
const TOTAL_MS = 600;
const COLORS = [0xc4a670, 0xa08850, 0x8b6914] as const;

interface SprayParticle {
  g: Graphics;
  vx: number;    // px per ms
  vy: number;    // px per ms
  grav: number;  // gravity acceleration (px per ms^2)
  life: number;
  lifetime: number;
}

export type SlideDirection = 'left' | 'right';

export function spawnSlideSpray(
  app: Application,
  x: number,
  y: number,
  direction: SlideDirection = 'right',
  parent?: Container,
): void {
  const layer: Container = parent ?? (app.stage as unknown as Container);
  const dirSign = direction === 'right' ? 1 : -1;

  const particles: SprayParticle[] = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const g = new Graphics();
    // Mix small circles and tiny rectangles
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]!;
    const isRect = Math.random() > 0.6;
    if (isRect) {
      const w = 2 + Math.random() * 3;
      const h = 1.5 + Math.random() * 2;
      g.rect(-w / 2, -h / 2, w, h);
    } else {
      g.circle(0, 0, 1 + Math.random() * 2.5);
    }
    g.fill({ color, alpha: 0.9 });
    g.x = x + (Math.random() - 0.5) * 6;
    g.y = y + (Math.random() - 0.5) * 4;
    layer.addChild(g);

    // Bias angle toward the slide direction (forward cone ± 50°)
    // Then some particles also go upward (negative vy)
    const forwardAngleDeg = direction === 'right' ? 0 : 180;
    const spreadDeg = 50 + Math.random() * 30; // 50-80° spread
    const angleDeg = forwardAngleDeg + dirSign * (Math.random() - 0.5) * spreadDeg * 2;
    const rad = (angleDeg * Math.PI) / 180;

    const speed = (0.04 + Math.random() * 0.06); // px/ms
    const upBias = -0.02 - Math.random() * 0.03; // always drift a little upward initially

    particles.push({
      g,
      vx: Math.cos(rad) * speed,
      vy: Math.sin(rad) * speed + upBias,
      grav: 0.00008 + Math.random() * 0.00006, // gravity pulls down
      life: 0,
      lifetime: TOTAL_MS * (0.5 + Math.random() * 0.5),
    });
  }

  const onTick = (ticker: Ticker) => {
    const dt = ticker.deltaMS;
    let alive = 0;
    for (const p of particles) {
      if (p.g.destroyed) continue;
      p.life += dt;
      if (p.life >= p.lifetime) {
        if (p.g.parent) p.g.parent.removeChild(p.g);
        p.g.destroy();
        continue;
      }
      alive++;
      p.vy += p.grav * dt; // gravity
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      const tl = p.life / p.lifetime;
      p.g.alpha = Math.max(0, 1 - tl * tl);
    }
    if (alive === 0) {
      Ticker.shared.remove(onTick);
    }
  };

  Ticker.shared.add(onTick);
}

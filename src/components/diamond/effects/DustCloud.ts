// ── DustCloud.ts ──────────────────────────────────────────────────────────────
// Particle-based dust cloud effect. Light = fielder shuffle, medium = ground
// ball, heavy = headfirst slide / collision.

import { Graphics, Ticker, Container } from 'pixi.js';
import type { Application } from 'pixi.js';

// Dirt palette
const DUST_COLORS = [0xc4a670, 0xa08850, 0x8b6914] as const;

interface DustParticle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  lifetime: number;
}

export type DustIntensity = 'light' | 'medium' | 'heavy';

const CONFIG: Record<DustIntensity, { count: number; sizeMax: number; lifetime: [number, number]; speed: [number, number] }> = {
  light:  { count: 8,  sizeMax: 3,  lifetime: [400, 600], speed: [20, 40] },
  medium: { count: 15, sizeMax: 5,  lifetime: [500, 700], speed: [25, 55] },
  heavy:  { count: 25, sizeMax: 6,  lifetime: [600, 800], speed: [30, 60] },
};

export function spawnDustCloud(
  app: Application,
  x: number,
  y: number,
  intensity: DustIntensity = 'medium',
  parent?: Container,
): void {
  const layer: Container = parent ?? (app.stage as unknown as Container);
  const cfg = CONFIG[intensity];

  const particles: DustParticle[] = [];

  for (let i = 0; i < cfg.count; i++) {
    const g = new Graphics();
    const size = 1.5 + Math.random() * (cfg.sizeMax - 1.5);
    const color = DUST_COLORS[Math.floor(Math.random() * DUST_COLORS.length)]!;
    g.circle(0, 0, size);
    g.fill({ color, alpha: 0.85 });
    g.x = x + (Math.random() - 0.5) * 8;
    g.y = y + (Math.random() - 0.5) * 4;
    layer.addChild(g);

    const angle = Math.random() * Math.PI * 2;
    const px = (cfg.speed[0] + Math.random() * (cfg.speed[1] - cfg.speed[0])) / 1000; // px per ms
    // Slight upward bias so dust rises
    const vx = Math.cos(angle) * px;
    const vy = Math.sin(angle) * px - 0.035;

    const ltMin = cfg.lifetime[0];
    const ltMax = cfg.lifetime[1];
    particles.push({
      g,
      vx,
      vy,
      life: 0,
      lifetime: ltMin + Math.random() * (ltMax - ltMin),
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
      const tl = p.life / p.lifetime;
      p.g.x += p.vx * dt;
      p.g.y += p.vy * dt;
      p.g.alpha = Math.max(0, 1 - tl * tl); // quadratic fade
    }
    if (alive === 0) {
      Ticker.shared.remove(onTick);
    }
  };

  Ticker.shared.add(onTick);
}

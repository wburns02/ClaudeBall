// ── DustCloud.ts ──────────────────────────────────────────────────────────────
// Griffey Jr.-style dirt dust cloud effect. Chunky, visible dirt particles that
// billow and dissipate. Light = fielder shuffle, medium = ground ball scoop,
// heavy = headfirst slide.

import { Graphics, Ticker, Container } from 'pixi.js';
import type { Application } from 'pixi.js';

// Rich dirt palette — warm browns and tans
const DUST_COLORS = [0xc4a670, 0xa08850, 0x8b6914, 0xd4b880, 0xb09060] as const;

interface DustParticle {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  lifetime: number;
  maxSize: number;
}

export type DustIntensity = 'light' | 'medium' | 'heavy';

const CONFIG: Record<DustIntensity, { count: number; sizeMax: number; lifetime: [number, number]; speed: [number, number] }> = {
  light:  { count: 10, sizeMax: 4,  lifetime: [350, 550],  speed: [20, 45] },
  medium: { count: 18, sizeMax: 6,  lifetime: [450, 700],  speed: [25, 60] },
  heavy:  { count: 28, sizeMax: 8,  lifetime: [600, 900],  speed: [30, 70] },
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
  const container = new Container();
  layer.addChild(container);

  const particles: DustParticle[] = [];

  for (let i = 0; i < cfg.count; i++) {
    const g = new Graphics();
    const maxSize = 2 + Math.random() * (cfg.sizeMax - 2);
    const color = DUST_COLORS[Math.floor(Math.random() * DUST_COLORS.length)]!;

    // Start small, will grow
    g.circle(0, 0, maxSize);
    g.fill({ color, alpha: 0.8 });
    g.x = x + (Math.random() - 0.5) * 10;
    g.y = y + (Math.random() - 0.5) * 5;
    g.scale.set(0.2);
    container.addChild(g);

    const angle = (Math.random() - 0.5) * Math.PI;
    const px = (cfg.speed[0] + Math.random() * (cfg.speed[1] - cfg.speed[0])) / 1000;
    // Strong upward bias so dust billows up
    const vx = Math.cos(angle) * px;
    const vy = -Math.abs(Math.sin(angle)) * px - 0.04;

    const ltMin = cfg.lifetime[0];
    const ltMax = cfg.lifetime[1];
    particles.push({
      g,
      vx,
      vy,
      life: 0,
      lifetime: ltMin + Math.random() * (ltMax - ltMin),
      maxSize,
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

      // Grow then shrink
      if (tl < 0.3) {
        p.g.scale.set(0.2 + (tl / 0.3) * 0.8);
        p.g.alpha = 0.8;
      } else {
        p.g.scale.set(1 + (tl - 0.3) * 0.6);
        p.g.alpha = 0.8 * (1 - (tl - 0.3) / 0.7);
      }
    }
    if (alive === 0) {
      Ticker.shared.remove(onTick);
      if (container.parent) container.parent.removeChild(container);
      container.destroy({ children: true });
    }
  };

  Ticker.shared.add(onTick);
}

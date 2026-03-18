// ── HomeRunFireworks.ts ────────────────────────────────────────────────────────
// Multi-burst fireworks celebration for home runs.
// 3 staggered bursts, each with 30 gravity-affected particles + fading trails.
// Total duration ~1500ms.

import { Graphics, Ticker, Container } from 'pixi.js';
import type { Application } from 'pixi.js';

const BURST_COUNT        = 3;
const PARTICLES_PER_BURST = 30;
const BURST_STAGGER_MS   = 200;
const PARTICLE_LIFETIME  = 900;
const TRAIL_DOTS         = 4;
const TRAIL_SPACING_MS   = 40; // ms between trail dot snapshots

const PALETTE = [
  0xffd700, // gold
  0xffffff, // white
  0xff4444, // red
  0x4488ff, // blue
  0x44ff88, // green
  0xff88ff, // pink
];

interface TrailDot {
  x: number;
  y: number;
  alpha: number;
}

interface FireworkParticle {
  g: Graphics;
  x: number;
  y: number;
  vx: number;   // px/ms
  vy: number;   // px/ms
  grav: number; // px/ms^2
  life: number;
  lifetime: number;
  color: number;
  size: number;
  trail: TrailDot[];
  lastTrailAt: number;
}

function createBurst(
  layer: Container,
  cx: number,
  cy: number,
  particles: FireworkParticle[],
): void {
  for (let i = 0; i < PARTICLES_PER_BURST; i++) {
    const angle = (i / PARTICLES_PER_BURST) * Math.PI * 2 + Math.random() * 0.4;
    const speed = 0.08 + Math.random() * 0.12; // px/ms
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)]!;
    const size  = 1.5 + Math.random() * 2.5;

    const g = new Graphics();
    g.circle(0, 0, size);
    g.fill({ color });
    g.x = cx;
    g.y = cy;
    layer.addChild(g);

    particles.push({
      g,
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.04, // slightly upward initial bias
      grav: 0.00012 + Math.random() * 0.00006,
      life: 0,
      lifetime: PARTICLE_LIFETIME * (0.7 + Math.random() * 0.3),
      color,
      size,
      trail: [],
      lastTrailAt: 0,
    });
  }
}

export function spawnHomeRunFireworks(
  app: Application,
  screenWidth: number,
  screenHeight: number,
  parent?: Container,
): void {
  const layer: Container = parent ?? (app.stage as unknown as Container);

  // Trail layer behind main particles
  const trailLayer = new Container();
  layer.addChildAt(trailLayer, 0);

  const allParticles: FireworkParticle[] = [];
  let startedBursts = 0;
  let totalElapsed = 0;
  const TOTAL_MS = PARTICLE_LIFETIME + BURST_STAGGER_MS * (BURST_COUNT - 1) + 200;

  const onTick = (ticker: Ticker) => {
    const dt = ticker.deltaMS;
    totalElapsed += dt;

    // Trigger staggered bursts
    while (startedBursts < BURST_COUNT) {
      const triggerAt = startedBursts * BURST_STAGGER_MS;
      if (totalElapsed < triggerAt) break;
      // Random position in upper ~40% of screen
      const bx = screenWidth  * (0.15 + Math.random() * 0.7);
      const by = screenHeight * (0.05 + Math.random() * 0.35);
      createBurst(layer, bx, by, allParticles);
      startedBursts++;
    }

    // Clear previous frame's trails
    trailLayer.removeChildren().forEach((c) => c.destroy());

    let alive = 0;
    for (const p of allParticles) {
      if (p.g.destroyed) continue;
      p.life += dt;

      if (p.life >= p.lifetime) {
        if (p.g.parent) p.g.parent.removeChild(p.g);
        p.g.destroy();
        continue;
      }
      alive++;

      // Physics
      p.vy += p.grav * dt;
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.g.x = p.x;
      p.g.y = p.y;

      const tl = p.life / p.lifetime;
      p.g.alpha = Math.max(0, 1 - tl * tl);

      // Record trail snapshot
      if (p.life - p.lastTrailAt >= TRAIL_SPACING_MS) {
        p.trail.push({ x: p.x, y: p.y, alpha: p.g.alpha });
        if (p.trail.length > TRAIL_DOTS) p.trail.shift();
        p.lastTrailAt = p.life;
      }

      // Draw trail dots
      for (let ti = 0; ti < p.trail.length; ti++) {
        const dot = p.trail[ti]!;
        const trailFrac = (ti + 1) / (p.trail.length + 1);
        const tg = new Graphics();
        tg.circle(dot.x, dot.y, p.size * trailFrac * 0.6);
        tg.fill({ color: p.color, alpha: dot.alpha * trailFrac * 0.5 });
        trailLayer.addChild(tg);
      }
    }

    if (totalElapsed >= TOTAL_MS && alive === 0) {
      Ticker.shared.remove(onTick);
      if (trailLayer.parent) trailLayer.parent.removeChild(trailLayer);
      trailLayer.destroy({ children: true });
    }
  };

  Ticker.shared.add(onTick);
}

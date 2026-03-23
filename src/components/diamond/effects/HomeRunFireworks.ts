// ── HomeRunFireworks.ts ────────────────────────────────────────────────────────
// Ken Griffey Jr.-style home run celebration.
// Multi-burst fireworks with star particles, "HOME RUN!" text with bounce-in,
// confetti rain, and gold screen flash. Total duration ~2500ms.

import { Graphics, Ticker, Container, Text } from 'pixi.js';
import type { Application } from 'pixi.js';

const BURST_COUNT         = 4;
const PARTICLES_PER_BURST = 35;
const BURST_STAGGER_MS    = 250;
const PARTICLE_LIFETIME   = 1000;
const TRAIL_DOTS          = 4;
const TRAIL_SPACING_MS    = 35;
const CONFETTI_COUNT      = 40;
const TOTAL_MS            = 2500;

const PALETTE = [
  0xffd700, // gold
  0xffffff, // white
  0xff4444, // red
  0x4488ff, // blue
  0x44ff88, // green
  0xff88ff, // pink
  0xff8800, // orange
];

const CONFETTI_COLORS = [0xd4a843, 0xff4444, 0x4488ff, 0x44ff44, 0xffffff, 0xff8800, 0xff44ff];

interface TrailDot {
  x: number;
  y: number;
  alpha: number;
}

interface FireworkParticle {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grav: number;
  life: number;
  lifetime: number;
  color: number;
  size: number;
  trail: TrailDot[];
  lastTrailAt: number;
}

interface ConfettiPiece {
  g: Graphics;
  vx: number;
  vy: number;
  rot: number;
  life: number;
}

function easeOutBounce(t: number): number {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}

function createStarParticle(
  layer: Container,
  cx: number,
  cy: number,
  particles: FireworkParticle[],
): void {
  for (let i = 0; i < PARTICLES_PER_BURST; i++) {
    const angle = (i / PARTICLES_PER_BURST) * Math.PI * 2 + Math.random() * 0.4;
    const speed = 0.08 + Math.random() * 0.14;
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)]!;
    const size = 1.5 + Math.random() * 3;

    const g = new Graphics();
    // Star shape — 16-bit firework
    g.beginPath();
    for (let p = 0; p < 5; p++) {
      const outerA = (p / 5) * Math.PI * 2 - Math.PI / 2;
      const innerA = outerA + Math.PI / 5;
      if (p === 0) {
        g.moveTo(Math.cos(outerA) * size, Math.sin(outerA) * size);
      } else {
        g.lineTo(Math.cos(outerA) * size, Math.sin(outerA) * size);
      }
      g.lineTo(Math.cos(innerA) * size * 0.4, Math.sin(innerA) * size * 0.4);
    }
    g.closePath();
    g.fill({ color });

    g.x = cx;
    g.y = cy;
    layer.addChild(g);

    particles.push({
      g,
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.05,
      grav: 0.00010 + Math.random() * 0.00005,
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

  // Trail layer
  const trailLayer = new Container();
  layer.addChildAt(trailLayer, 0);

  // Gold screen flash
  const overlay = new Graphics();
  overlay.rect(0, 0, screenWidth, screenHeight);
  overlay.fill({ color: 0xd4a843, alpha: 0.35 });
  layer.addChild(overlay);

  // "HOME RUN!" text
  const hrText = new Text({
    text: 'HOME RUN!',
    style: {
      fontFamily: 'Oswald, Impact, sans-serif',
      fontSize: 48,
      fontWeight: 'bold',
      fill: 0xd4a843,
      stroke: { color: 0x000000, width: 5 },
      dropShadow: {
        color: 0x000000,
        blur: 8,
        distance: 3,
        angle: Math.PI / 4,
      },
      letterSpacing: 4,
    },
  });
  hrText.anchor.set(0.5, 0.5);
  hrText.x = screenWidth / 2;
  hrText.y = screenHeight * 0.3;
  hrText.alpha = 0;
  hrText.scale.set(0);
  layer.addChild(hrText);

  // Confetti
  const confetti: ConfettiPiece[] = [];
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const g = new Graphics();
    const w = 2 + Math.random() * 4;
    const h = 1 + Math.random() * 2;
    g.rect(-w / 2, -h / 2, w, h);
    g.fill({ color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]! });
    g.x = Math.random() * screenWidth;
    g.y = -10 - Math.random() * 80;
    g.alpha = 0;
    layer.addChild(g);
    confetti.push({
      g,
      vx: (Math.random() - 0.5) * 2,
      vy: 1.5 + Math.random() * 3,
      rot: (Math.random() - 0.5) * 0.2,
      life: 0,
    });
  }

  const allParticles: FireworkParticle[] = [];
  let startedBursts = 0;
  let totalElapsed = 0;

  const onTick = (ticker: Ticker) => {
    const dt = ticker.deltaMS;
    totalElapsed += dt;
    const masterT = totalElapsed / TOTAL_MS;

    // Gold flash: bright then fade (first 200ms)
    if (totalElapsed < 200) {
      overlay.alpha = 0.35 * (1 - totalElapsed / 200);
    } else {
      overlay.alpha = 0;
    }

    // Trigger staggered bursts
    while (startedBursts < BURST_COUNT) {
      const triggerAt = startedBursts * BURST_STAGGER_MS;
      if (totalElapsed < triggerAt) break;
      const bx = screenWidth * (0.15 + Math.random() * 0.7);
      const by = screenHeight * (0.05 + Math.random() * 0.35);
      createStarParticle(layer, bx, by, allParticles);
      startedBursts++;
    }

    // Update particles
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
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.g.x = p.x;
      p.g.y = p.y;
      const tl = p.life / p.lifetime;
      p.g.alpha = Math.max(0, 1 - tl * tl);
      p.g.rotation += 0.06;

      if (p.life - p.lastTrailAt >= TRAIL_SPACING_MS) {
        p.trail.push({ x: p.x, y: p.y, alpha: p.g.alpha });
        if (p.trail.length > TRAIL_DOTS) p.trail.shift();
        p.lastTrailAt = p.life;
      }
      for (let ti = 0; ti < p.trail.length; ti++) {
        const dot = p.trail[ti]!;
        const frac = (ti + 1) / (p.trail.length + 1);
        const tg = new Graphics();
        tg.circle(dot.x, dot.y, p.size * frac * 0.5);
        tg.fill({ color: p.color, alpha: dot.alpha * frac * 0.4 });
        trailLayer.addChild(tg);
      }
    }

    // HOME RUN! text animation (after 250ms)
    if (totalElapsed > 250) {
      const textT = (totalElapsed - 250) / 1800;
      if (textT < 0.2) {
        // Bounce in
        const bounceT = easeOutBounce(textT / 0.2);
        hrText.alpha = 1;
        hrText.scale.set(bounceT);
      } else if (textT < 0.75) {
        hrText.alpha = 1;
        // Subtle pulse
        const pulse = 1 + Math.sin(textT * Math.PI * 8) * 0.04;
        hrText.scale.set(pulse);
      } else if (textT < 1) {
        const fadeT = (textT - 0.75) / 0.25;
        hrText.alpha = 1 - fadeT;
        hrText.y = screenHeight * 0.3 - fadeT * 25;
      } else {
        hrText.alpha = 0;
      }
    }

    // Confetti (after 300ms)
    if (totalElapsed > 300) {
      for (const c of confetti) {
        c.life += dt;
        const cl = c.life / (TOTAL_MS - 300);
        if (cl < 0.2) {
          c.g.alpha = cl / 0.2 * 0.85;
        } else if (cl < 0.8) {
          c.g.alpha = 0.85;
        } else {
          c.g.alpha = 0.85 * (1 - (cl - 0.8) / 0.2);
        }
        c.g.x += c.vx;
        c.g.y += c.vy;
        c.g.rotation += c.rot;
      }
    }

    if (masterT >= 1) {
      Ticker.shared.remove(onTick);
      overlay.destroy();
      hrText.destroy();
      for (const c of confetti) c.g.destroy();
      if (trailLayer.parent) trailLayer.parent.removeChild(trailLayer);
      trailLayer.destroy({ children: true });
    }
  };

  Ticker.shared.add(onTick);
}

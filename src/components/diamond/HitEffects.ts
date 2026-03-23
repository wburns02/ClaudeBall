// ── HitEffects.ts ─────────────────────────────────────────────────────────
// Ken Griffey Jr. Winning Run-style visual effects.
// Bold, satisfying, 16-bit aesthetic with particles, flashes, and celebration.

import { Application, Graphics, Text, Container, Ticker } from 'pixi.js';

// ── Easing ────────────────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBounce(t: number): number {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}

// ── Internal ticker helper ────────────────────────────────────────────────

function runEffect(
  app: Application,
  lifetimeMs: number,
  fn: (progress: number, deltaMs: number) => void,
  onDone?: () => void,
): void {
  let elapsed = 0;

  const onTick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS;
    const t = Math.min(elapsed / lifetimeMs, 1);
    fn(t, ticker.deltaMS);
    if (t >= 1) {
      app.ticker.remove(onTick);
      onDone?.();
    }
  };

  app.ticker.add(onTick);
}

// ── Contact spark / bat crack ─────────────────────────────────────────────

/**
 * Satisfying bat-crack spark burst at the contact point.
 * White-hot center with gold/white particles radiating outward.
 * Griffey Jr. style — bold and punchy.
 */
export function showContactSpark(
  app: Application,
  position: { x: number; y: number },
): void {
  const stage = app.stage;
  const container = new Container();
  stage.addChild(container);

  const LIFETIME = 450;
  const SPARK_COUNT = 14;
  const FLASH_SIZE = 12;

  // Central white flash (bat crack impact)
  const flash = new Graphics();
  flash.circle(0, 0, FLASH_SIZE);
  flash.fill({ color: 0xffffff });
  flash.x = position.x;
  flash.y = position.y;
  container.addChild(flash);

  // Gold ring burst
  const ring = new Graphics();
  ring.circle(0, 0, FLASH_SIZE + 2);
  ring.stroke({ color: 0xd4a843, width: 2 });
  ring.x = position.x;
  ring.y = position.y;
  container.addChild(ring);

  // Spark particles (white + gold)
  const sparks: Array<{ g: Graphics; vx: number; vy: number; size: number }> = [];
  for (let i = 0; i < SPARK_COUNT; i++) {
    const g = new Graphics();
    const size = 1 + Math.random() * 2.5;
    const isGold = i % 3 === 0;

    // Draw as small diamond shape for pixel-art feel
    g.beginPath();
    g.moveTo(0, -size);
    g.lineTo(size * 0.7, 0);
    g.lineTo(0, size);
    g.lineTo(-size * 0.7, 0);
    g.closePath();
    g.fill({ color: isGold ? 0xd4a843 : 0xffffff });

    g.x = position.x;
    g.y = position.y;
    container.addChild(g);

    const angle = (i / SPARK_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const speed = 2.5 + Math.random() * 4;
    sparks.push({ g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5, size });
  }

  runEffect(app, LIFETIME, (t) => {
    const ease = easeOutCubic(t);

    // Flash: bright then fade
    flash.alpha = t < 0.15 ? 1 : 1 - (t - 0.15) / 0.85;
    flash.scale.set(1 + ease * 0.8);

    // Ring expands and fades
    ring.alpha = 1 - t;
    ring.scale.set(1 + ease * 2.5);

    // Sparks fly outward
    for (const s of sparks) {
      s.g.x = position.x + s.vx * ease * 30;
      s.g.y = position.y + s.vy * ease * 30;
      s.g.alpha = 1 - t * t;
      s.g.scale.set(1 - t * 0.5);
    }
  }, () => {
    container.destroy({ children: true });
  });
}

// ── Dust cloud (slides, diving catches) ──────────────────────────────────

/**
 * Puff of dirt/dust at the given position.
 * Used for slides into bases, diving catches, ground ball scoops.
 */
export function showDustCloud(
  app: Application,
  position: { x: number; y: number },
  intensity: 'small' | 'medium' | 'large' = 'medium',
): void {
  const stage = app.stage;
  const container = new Container();
  stage.addChild(container);

  const counts = { small: 6, medium: 10, large: 16 };
  const COUNT = counts[intensity];
  const LIFETIME = intensity === 'large' ? 700 : 500;
  const SPREAD = intensity === 'large' ? 25 : intensity === 'medium' ? 18 : 12;

  const DUST_COLORS = [0xc8b090, 0xb09870, 0xa08860, 0xd0c0a0];

  const puffs: Array<{ g: Graphics; vx: number; vy: number; maxSize: number }> = [];

  for (let i = 0; i < COUNT; i++) {
    const g = new Graphics();
    const maxSize = 3 + Math.random() * 5;
    g.circle(0, 0, maxSize);
    g.fill({ color: DUST_COLORS[i % DUST_COLORS.length]! });
    g.x = position.x + (Math.random() - 0.5) * 6;
    g.y = position.y + (Math.random() - 0.5) * 4;
    g.alpha = 0;
    container.addChild(g);

    const angle = (Math.random() - 0.5) * Math.PI;
    const speed = 0.5 + Math.random() * 2;
    puffs.push({
      g,
      vx: Math.cos(angle) * speed,
      vy: -Math.abs(Math.sin(angle)) * speed - 0.3,
      maxSize,
    });
  }

  runEffect(app, LIFETIME, (t) => {
    for (const p of puffs) {
      p.g.x += p.vx * 0.6;
      p.g.y += p.vy * 0.6;

      // Fade in quickly, expand, then fade out
      if (t < 0.2) {
        p.g.alpha = t / 0.2 * 0.6;
        p.g.scale.set(0.3 + t / 0.2 * 0.7);
      } else {
        p.g.alpha = 0.6 * (1 - (t - 0.2) / 0.8);
        p.g.scale.set(1 + (t - 0.2) * 1.5);
      }
    }
  }, () => {
    container.destroy({ children: true });
  });
}

// ── Ball trail / afterimage ─────────────────────────────────────────────

/**
 * Creates a brief speed-line trail behind a fast-moving ball.
 * Gives hits and throws a sense of velocity.
 */
export function showBallTrail(
  app: Application,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  const stage = app.stage;
  const LIFETIME = 300;
  const TRAIL_COUNT = 5;

  const trails: Graphics[] = [];

  for (let i = 0; i < TRAIL_COUNT; i++) {
    const t = i / (TRAIL_COUNT - 1);
    const g = new Graphics();
    const size = 2 - t * 1.2;
    g.circle(0, 0, Math.max(0.5, size));
    g.fill({ color: 0xffffff, alpha: 0.6 - t * 0.4 });
    g.x = from.x + (to.x - from.x) * t * 0.3;
    g.y = from.y + (to.y - from.y) * t * 0.3;
    stage.addChild(g);
    trails.push(g);
  }

  runEffect(app, LIFETIME, (t) => {
    for (const trail of trails) {
      trail.alpha = (1 - t) * 0.5;
    }
  }, () => {
    for (const trail of trails) trail.destroy();
  });
}

// ── Home run celebration ──────────────────────────────────────────────────

/**
 * GRIFFEY JR. STYLE home run celebration!
 * Multi-stage: screen flash → firework burst → falling confetti → "HOME RUN!" text
 */
export function showHomeRunCelebration(app: Application): void {
  const stage = app.stage;
  const container = new Container();
  stage.addChild(container);
  const LIFETIME = 2000;
  const GOLD = 0xd4a843;
  const WHITE = 0xffffff;

  // Stage 1: Screen flash (gold overlay)
  const overlay = new Graphics();
  overlay.rect(0, 0, 700, 600);
  overlay.fill({ color: GOLD, alpha: 0.3 });
  container.addChild(overlay);

  // Stage 2: Firework burst from home plate
  const cx = 300;
  const cy = 300;
  const fireworks: Array<{ g: Graphics; vx: number; vy: number; color: number }> = [];
  const BURST_COUNT = 40;

  for (let i = 0; i < BURST_COUNT; i++) {
    const g = new Graphics();
    const isGold = i % 4 < 2;
    const color = isGold ? GOLD : (i % 3 === 0 ? 0xff4444 : WHITE);
    const size = 2 + Math.random() * 3;

    // Star shape for fireworks
    g.beginPath();
    for (let p = 0; p < 5; p++) {
      const outerAngle = (p / 5) * Math.PI * 2 - Math.PI / 2;
      const innerAngle = outerAngle + Math.PI / 5;
      if (p === 0) {
        g.moveTo(Math.cos(outerAngle) * size, Math.sin(outerAngle) * size);
      } else {
        g.lineTo(Math.cos(outerAngle) * size, Math.sin(outerAngle) * size);
      }
      g.lineTo(Math.cos(innerAngle) * size * 0.4, Math.sin(innerAngle) * size * 0.4);
    }
    g.closePath();
    g.fill({ color });

    g.x = cx + (Math.random() - 0.5) * 20;
    g.y = cy + (Math.random() - 0.5) * 20;
    g.alpha = 0;
    container.addChild(g);

    const angle = (i / BURST_COUNT) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 2 + Math.random() * 5;
    fireworks.push({
      g,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      color,
    });
  }

  // Stage 3: "HOME RUN!" text
  const hrText = new Text({
    text: 'HOME RUN!',
    style: {
      fontFamily: 'Oswald, Impact, sans-serif',
      fontSize: 42,
      fontWeight: 'bold',
      fill: GOLD,
      stroke: { color: 0x000000, width: 4 },
      dropShadow: {
        color: 0x000000,
        blur: 6,
        distance: 3,
        angle: Math.PI / 4,
      },
      letterSpacing: 4,
    },
  });
  hrText.anchor.set(0.5, 0.5);
  hrText.x = 300;
  hrText.y = 200;
  hrText.alpha = 0;
  hrText.scale.set(0);
  container.addChild(hrText);

  // Stage 4: Confetti rain
  const confetti: Array<{ g: Graphics; vx: number; vy: number; rot: number }> = [];
  const CONFETTI_COLORS = [0xd4a843, 0xff4444, 0x4488ff, 0x44ff44, 0xffffff, 0xff8800];
  for (let i = 0; i < 30; i++) {
    const g = new Graphics();
    const w = 2 + Math.random() * 3;
    const h = 1 + Math.random() * 2;
    g.rect(-w / 2, -h / 2, w, h);
    g.fill({ color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]! });
    g.x = Math.random() * 600;
    g.y = -20 - Math.random() * 100;
    g.alpha = 0;
    container.addChild(g);

    confetti.push({
      g,
      vx: (Math.random() - 0.5) * 2,
      vy: 1 + Math.random() * 3,
      rot: (Math.random() - 0.5) * 0.15,
    });
  }

  runEffect(app, LIFETIME, (t) => {
    // Flash: bright burst then fade (0-0.15)
    if (t < 0.15) {
      overlay.alpha = 0.3 * (1 - t / 0.15);
    } else {
      overlay.alpha = 0;
    }

    // Fireworks burst (0.05-0.6)
    if (t > 0.05 && t < 0.6) {
      const ft = (t - 0.05) / 0.55;
      const ease = easeOutCubic(ft);
      for (const fw of fireworks) {
        fw.g.alpha = ft < 0.3 ? ft / 0.3 : (1 - (ft - 0.3) / 0.7);
        fw.g.x += fw.vx * 0.8;
        fw.g.y += fw.vy * 0.8;
        fw.vy += 0.08; // gravity
        fw.g.scale.set(1 - ease * 0.3);
        fw.g.rotation += 0.05;
      }
    } else if (t >= 0.6) {
      for (const fw of fireworks) fw.g.alpha = 0;
    }

    // HOME RUN text (0.15-0.85)
    if (t > 0.15 && t < 0.85) {
      const tt = (t - 0.15) / 0.7;
      if (tt < 0.3) {
        // Scale in with bounce
        const bounceT = easeOutBounce(tt / 0.3);
        hrText.alpha = 1;
        hrText.scale.set(bounceT);
      } else if (tt < 0.8) {
        hrText.alpha = 1;
        hrText.scale.set(1);
        // Subtle pulse
        const pulse = 1 + Math.sin(tt * Math.PI * 6) * 0.03;
        hrText.scale.set(pulse);
      } else {
        hrText.alpha = 1 - (tt - 0.8) / 0.2;
        hrText.y = 200 - (tt - 0.8) * 30;
      }
    }

    // Confetti (0.2-1.0)
    if (t > 0.2) {
      const ct = (t - 0.2) / 0.8;
      for (const c of confetti) {
        c.g.alpha = ct < 0.3 ? ct / 0.3 * 0.8 : 0.8 * (1 - (ct - 0.3) / 0.7);
        c.g.x += c.vx;
        c.g.y += c.vy;
        c.g.rotation += c.rot;
      }
    }
  }, () => {
    container.destroy({ children: true });
  });
}

// ── Strikeout effect ──────────────────────────────────────────────────────

/**
 * Bold "K" (or backwards K) that punches in with Griffey Jr. energy.
 */
export function showStrikeoutEffect(
  app: Application,
  position: { x: number; y: number },
  lookingStrikeout = false,
): void {
  const stage = app.stage;
  const LIFETIME = 800;

  const label = new Text({
    text: lookingStrikeout ? 'Ꝁ' : 'K',
    style: {
      fontFamily: 'Oswald, Impact, sans-serif',
      fontSize: 44,
      fontWeight: 'bold',
      fill: 0xd4a843,
      stroke: { color: 0x000000, width: 3 },
      dropShadow: {
        color: 0x000000,
        blur: 4,
        distance: 2,
        angle: Math.PI / 4,
      },
    },
  });

  label.anchor.set(0.5, 0.5);
  label.x = position.x;
  label.y = position.y;
  label.alpha = 0;
  label.scale.set(2.5);
  stage.addChild(label);

  runEffect(app, LIFETIME, (t) => {
    if (t < 0.15) {
      // Punch in (scale from big to normal)
      const pt = t / 0.15;
      label.alpha = pt;
      label.scale.set(2.5 - easeOutCubic(pt) * 1.5);
    } else if (t < 0.65) {
      label.alpha = 1;
      label.scale.set(1);
    } else {
      // Fade up and out
      const ft = (t - 0.65) / 0.35;
      label.alpha = 1 - ft;
      label.y = position.y - ft * 25;
      label.scale.set(1 - ft * 0.2);
    }
  }, () => {
    label.destroy();
  });
}

// ── Walk effect ───────────────────────────────────────────────────────────

/**
 * Green glow pulse on first base for a walk/HBP.
 */
export function showWalkEffect(app: Application): void {
  const stage = app.stage;
  const LIFETIME = 700;

  const glow = new Graphics();
  glow.circle(420, 300, 18);
  glow.fill({ color: 0x4caf50, alpha: 0.6 });
  stage.addChild(glow);

  // Arrow pointing to first
  const arrow = new Text({
    text: 'BB',
    style: {
      fontFamily: 'Oswald, sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      fill: 0x4caf50,
      stroke: { color: 0x000000, width: 2 },
    },
  });
  arrow.anchor.set(0.5, 0.5);
  arrow.x = 420;
  arrow.y = 280;
  arrow.alpha = 0;
  stage.addChild(arrow);

  runEffect(app, LIFETIME, (t) => {
    glow.alpha = 0.6 * (1 - t);
    const scale = 1 + t * 0.8;
    glow.scale.set(scale);

    if (t < 0.3) {
      arrow.alpha = t / 0.3;
    } else {
      arrow.alpha = 1 - (t - 0.3) / 0.7;
    }
  }, () => {
    glow.destroy();
    arrow.destroy();
  });
}

// ── Error flash ───────────────────────────────────────────────────────────

/**
 * Red flash on a fielder position — "E" label with ring burst.
 */
export function showErrorFlash(
  app: Application,
  fielderPos: { x: number; y: number },
): void {
  const stage = app.stage;
  const LIFETIME = 700;

  const ring = new Graphics();
  ring.circle(fielderPos.x, fielderPos.y, 14);
  ring.fill({ color: 0xff3333, alpha: 0.8 });
  stage.addChild(ring);

  const label = new Text({
    text: 'E',
    style: {
      fontFamily: 'Oswald, Impact, sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0xff3333,
      stroke: { color: 0x000000, width: 2 },
    },
  });
  label.anchor.set(0.5, 0.5);
  label.x = fielderPos.x;
  label.y = fielderPos.y - 22;
  label.alpha = 0;
  stage.addChild(label);

  runEffect(app, LIFETIME, (t) => {
    ring.alpha = 0.8 * (1 - t);
    ring.scale.set(1 + t * 1.5);

    if (t < 0.2) {
      label.alpha = t / 0.2;
      label.scale.set(0.5 + (t / 0.2) * 0.5);
    } else {
      label.alpha = 1 - (t - 0.2) / 0.8;
      label.y = fielderPos.y - 22 - (t - 0.2) * 15;
    }
  }, () => {
    ring.destroy();
    label.destroy();
  });
}

// ── Catch flash ──────────────────────────────────────────────────────────

/**
 * Brief white pop when a fielder catches the ball — satisfying "thwack" visual.
 */
export function showCatchFlash(
  app: Application,
  position: { x: number; y: number },
): void {
  const stage = app.stage;
  const LIFETIME = 250;

  const flash = new Graphics();
  flash.circle(position.x, position.y, 6);
  flash.fill({ color: 0xffffff });
  stage.addChild(flash);

  runEffect(app, LIFETIME, (t) => {
    flash.alpha = 1 - t;
    flash.scale.set(1 + t * 1.5);
  }, () => {
    flash.destroy();
  });
}

// ── Composite effects layer container ────────────────────────────────────

export function createEffectsLayer(): Container {
  return new Container();
}

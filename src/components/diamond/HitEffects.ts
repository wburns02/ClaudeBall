import { Application, Graphics, Text, Container, Ticker } from 'pixi.js';

// ── Easing ────────────────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ── Internal ticker helper ────────────────────────────────────────────────

/** Runs `fn` each tick for `lifetimeMs` using the provided app's ticker. */
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

// ── Contact spark ─────────────────────────────────────────────────────────

/**
 * Brief white spark/flash at the contact point (bat meets ball).
 * Auto-removes itself after 400ms.
 */
export function showContactSpark(
  app: Application,
  position: { x: number; y: number },
): void {
  const stage = app.stage;
  const particles: Array<{ g: Graphics; vx: number; vy: number }> = [];
  const COUNT = 10;
  const LIFETIME = 400;

  for (let i = 0; i < COUNT; i++) {
    const g = new Graphics();
    g.circle(0, 0, 1.5 + Math.random() * 1.5);
    g.fill({ color: 0xffffff });
    g.x = position.x;
    g.y = position.y;
    stage.addChild(g);

    const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.3;
    const speed = 1.5 + Math.random() * 2.5;
    particles.push({ g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
  }

  runEffect(app, LIFETIME, (t, _dt) => {
    const ease = easeOutCubic(t);
    for (const p of particles) {
      p.g.x = position.x + p.vx * ease * 25;
      p.g.y = position.y + p.vy * ease * 25;
      p.g.alpha = 1 - t;
    }
  }, () => {
    for (const p of particles) p.g.destroy();
  });
}

// ── Home run celebration ──────────────────────────────────────────────────

/**
 * Gold particle burst + brief gold screen overlay for a home run.
 * Auto-cleans after 800ms.
 */
export function showHomeRunCelebration(app: Application): void {
  const stage = app.stage;
  const LIFETIME = 800;
  const COUNT = 30;
  const GOLD = 0xd4a843;

  // Screen overlay
  const overlay = new Graphics();
  overlay.rect(0, 0, 700, 600);
  overlay.fill({ color: GOLD, alpha: 0.15 });
  stage.addChild(overlay);

  // Burst particles from home plate area
  const cx = 300;
  const cy = 380;
  const particles: Array<{ g: Graphics; vx: number; vy: number }> = [];

  for (let i = 0; i < COUNT; i++) {
    const g = new Graphics();
    const size = 2 + Math.random() * 3;
    g.circle(0, 0, size);
    g.fill({ color: i % 3 === 0 ? 0xffffff : GOLD });
    g.x = cx + (Math.random() - 0.5) * 10;
    g.y = cy + (Math.random() - 0.5) * 10;
    stage.addChild(g);

    const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 2 + Math.random() * 4;
    particles.push({ g, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5 });
  }

  runEffect(app, LIFETIME, (t, _dt) => {
    overlay.alpha = 0.15 * (1 - t);

    const ease = easeOutCubic(t);
    for (const p of particles) {
      p.g.x = p.g.x + p.vx * 0.5;
      p.g.y = p.g.y + p.vy * 0.5;
      p.g.alpha = 1 - ease;
      // Apply gravity
      p.vy += 0.06;
    }
  }, () => {
    overlay.destroy();
    for (const p of particles) p.g.destroy();
  });
}

// ── Strikeout effect ──────────────────────────────────────────────────────

/**
 * "K" text (or "ꓘ" for backwards K) that briefly appears near the batter
 * box and fades out.
 *
 * @param lookingStrikeout - Pass `true` for called strike three (backwards K)
 */
export function showStrikeoutEffect(
  app: Application,
  position: { x: number; y: number },
  lookingStrikeout = false,
): void {
  const stage = app.stage;
  const LIFETIME = 700;

  const label = new Text({
    text: lookingStrikeout ? 'Ꝁ' : 'K',
    style: {
      fontFamily: 'Oswald, Impact, sans-serif',
      fontSize: 36,
      fontWeight: 'bold',
      fill: 0xd4a843,
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
  stage.addChild(label);

  runEffect(app, LIFETIME, (t, _dt) => {
    // Fade in quickly, hold, then fade out
    if (t < 0.2) {
      label.alpha = t / 0.2;
      label.scale.set(1 + (1 - t / 0.2) * 0.4); // shrink in from big
    } else if (t < 0.7) {
      label.alpha = 1;
      label.scale.set(1);
    } else {
      label.alpha = 1 - (t - 0.7) / 0.3;
      label.y = position.y - (t - 0.7) * 20; // drift upward as it fades
    }
  }, () => {
    label.destroy();
  });
}

// ── Walk effect ───────────────────────────────────────────────────────────

/**
 * Subtle green glow on first base for a walk / HBP.
 */
export function showWalkEffect(app: Application): void {
  const stage = app.stage;
  const LIFETIME = 600;

  // First base position
  const glow = new Graphics();
  glow.circle(420, 300, 18);
  glow.fill({ color: 0x4caf50, alpha: 0.5 });
  stage.addChild(glow);

  runEffect(app, LIFETIME, (t, _dt) => {
    glow.alpha = 0.5 * (1 - t);
    const scale = 1 + t * 0.6;
    glow.scale.set(scale);
  }, () => {
    glow.destroy();
  });
}

// ── Error flash ───────────────────────────────────────────────────────────

/**
 * Red flash on a fielder position to indicate an error.
 */
export function showErrorFlash(
  app: Application,
  fielderPos: { x: number; y: number },
): void {
  const stage = app.stage;
  const LIFETIME = 600;

  // Outer red ring
  const ring = new Graphics();
  ring.circle(fielderPos.x, fielderPos.y, 12);
  ring.fill({ color: 0xff3333, alpha: 0.8 });
  stage.addChild(ring);

  // "E" label
  const label = new Text({
    text: 'E',
    style: {
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xff3333,
    },
  });
  label.anchor.set(0.5, 0.5);
  label.x = fielderPos.x;
  label.y = fielderPos.y - 18;
  stage.addChild(label);

  runEffect(app, LIFETIME, (t, _dt) => {
    ring.alpha = 0.8 * (1 - t);
    const scale = 1 + t * 1.2;
    ring.scale.set(scale);
    label.alpha = 1 - t;
  }, () => {
    ring.destroy();
    label.destroy();
  });
}

// ── Composite effects layer container ────────────────────────────────────

/**
 * Optional: creates a dedicated effects Container that sits above all other
 * layers so effect graphics don't interleave with game graphics.
 * Add this to your scene graph as the topmost child.
 */
export function createEffectsLayer(): Container {
  return new Container();
}

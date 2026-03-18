import { Application, Graphics, Ticker } from 'pixi.js';

// ── Coordinate constants (mirror DiamondRenderer) ─────────────────────────
const HOME_X = 300;
const HOME_Y = 420;
const BASE_1_X = 420;
const BASE_1_Y = 300;

// ── Easing helpers ────────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface Pos {
  x: number;
  y: number;
}

/**
 * Smoothly moves a fielder dot (Graphics) from one position to another.
 *
 * @param app          - Pixi Application (for the ticker)
 * @param fielderDot   - The Graphics node representing the fielder
 * @param from         - Start position in canvas coordinates
 * @param to           - End position in canvas coordinates
 * @param rangeRating  - Fielding range rating 1-100 (higher = faster movement)
 * @param onComplete   - Optional callback once the animation finishes
 */
export function animateFielderMove(
  app: Application,
  fielderDot: Graphics,
  from: Pos,
  to: Pos,
  rangeRating: number,
  onComplete?: () => void,
): void {
  // Speed: range 1 → 600ms, range 100 → 300ms
  const durationMs = 600 - (rangeRating / 100) * 300;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distancePx = Math.sqrt(dx * dx + dy * dy);
  // Scale duration by distance so short moves aren't painfully long
  const scaledDuration = Math.max(150, durationMs * Math.min(1, distancePx / 120));

  fielderDot.x = from.x;
  fielderDot.y = from.y;

  let elapsed = 0;

  const onTick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS;
    const t = Math.min(elapsed / scaledDuration, 1);
    const ease = easeOutCubic(t);

    fielderDot.x = from.x + (to.x - from.x) * ease;
    fielderDot.y = from.y + (to.y - from.y) * ease;

    if (t >= 1) {
      app.ticker.remove(onTick);
      // Flash gold on catch, then revert to cream
      _flashFielderCatch(app, fielderDot, onComplete);
    }
  };

  app.ticker.add(onTick);
}

/**
 * Brief gold flash on a fielder dot to indicate a catch, then reverts to cream.
 */
function _flashFielderCatch(
  app: Application,
  fielderDot: Graphics,
  onComplete?: () => void,
): void {
  const GOLD = 0xd4a843;
  const CREAM = 0xe8e0d4;
  const flashDurationMs = 250;
  let elapsed = 0;
  let phase: 'in' | 'out' = 'in';

  const onTick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS;

    if (phase === 'in') {
      const t = Math.min(elapsed / (flashDurationMs / 2), 1);
      // Interpolate color from cream → gold using tint
      const r1 = (CREAM >> 16) & 0xff;
      const g1 = (CREAM >> 8) & 0xff;
      const b1 = CREAM & 0xff;
      const r2 = (GOLD >> 16) & 0xff;
      const g2 = (GOLD >> 8) & 0xff;
      const b2 = GOLD & 0xff;
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      const color = (r << 16) | (g << 8) | b;
      fielderDot.tint = color;

      if (t >= 1) {
        phase = 'out';
        elapsed = 0;
      }
    } else {
      const t = Math.min(elapsed / (flashDurationMs / 2), 1);
      const r1 = (GOLD >> 16) & 0xff;
      const g1 = (GOLD >> 8) & 0xff;
      const b1 = GOLD & 0xff;
      const r2 = (CREAM >> 16) & 0xff;
      const g2 = (CREAM >> 8) & 0xff;
      const b2 = CREAM & 0xff;
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      const color = (r << 16) | (g << 8) | b;
      fielderDot.tint = color;

      if (t >= 1) {
        app.ticker.remove(onTick);
        fielderDot.tint = 0xffffff; // reset tint
        onComplete?.();
      }
    }
  };

  app.ticker.add(onTick);
}

/**
 * Animates a thrown ball travelling from one position to another.
 * Used for relay throws, throw to first, etc.
 *
 * @param app        - Pixi Application
 * @param ballDot    - The Graphics node representing the ball
 * @param fromPos    - Start world position
 * @param toPos      - End world position
 * @param onComplete - Callback when throw animation finishes
 */
export function animateThrow(
  app: Application,
  ballDot: Graphics,
  fromPos: Pos,
  toPos: Pos,
  onComplete?: () => void,
): void {
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  const distancePx = Math.sqrt(dx * dx + dy * dy);

  // 200-400ms based on distance (capped to 220 px for full-field throws)
  const durationMs = 200 + Math.min(200, (distancePx / 220) * 200);

  ballDot.x = fromPos.x;
  ballDot.y = fromPos.y;
  ballDot.visible = true;

  let elapsed = 0;

  // Slight parabolic arc — mid-point lifts up a little
  const midX = (fromPos.x + toPos.x) / 2;
  const midY = (fromPos.y + toPos.y) / 2 - distancePx * 0.12;

  const onTick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS;
    const t = Math.min(elapsed / durationMs, 1);
    const ease = easeOutQuad(t);

    // Quadratic bezier: P = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
    const inv = 1 - ease;
    ballDot.x = inv * inv * fromPos.x + 2 * inv * ease * midX + ease * ease * toPos.x;
    ballDot.y = inv * inv * fromPos.y + 2 * inv * ease * midY + ease * ease * toPos.y;

    if (t >= 1) {
      app.ticker.remove(onTick);
      ballDot.visible = false;
      onComplete?.();
    }
  };

  app.ticker.add(onTick);
}

/**
 * Pre-built helper: fielder moves to ball position, then throws to first base.
 * Sequences the two animations automatically.
 */
export function animateFielderCatchAndThrow(
  app: Application,
  fielderDot: Graphics,
  ballDot: Graphics,
  fielderCurrentPos: Pos,
  ballLandingPos: Pos,
  rangeRating: number,
  onComplete?: () => void,
): void {
  animateFielderMove(app, fielderDot, fielderCurrentPos, ballLandingPos, rangeRating, () => {
    animateThrow(
      app,
      ballDot,
      ballLandingPos,
      { x: BASE_1_X, y: BASE_1_Y },
      onComplete,
    );
  });
}

// Export the default home plate position for consumers who need it
export const HOME_PLATE: Pos = { x: HOME_X, y: HOME_Y };
export const FIRST_BASE: Pos = { x: BASE_1_X, y: BASE_1_Y };

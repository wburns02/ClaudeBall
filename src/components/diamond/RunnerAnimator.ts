import { Application, Graphics, Ticker } from 'pixi.js';

// ── Coordinate constants (mirror DiamondRenderer) ─────────────────────────
const HOME_X = 300;
const HOME_Y = 420;
const BASE_1_X = 420;
const BASE_1_Y = 300;
const BASE_2_X = 300;
const BASE_2_Y = 190;
const BASE_3_X = 180;
const BASE_3_Y = 300;

// ── Base coordinate map ────────────────────────────────────────────────────
const BASE_COORDS: Record<number, { x: number; y: number }> = {
  0: { x: HOME_X, y: HOME_Y },   // home plate
  1: { x: BASE_1_X, y: BASE_1_Y },
  2: { x: BASE_2_X, y: BASE_2_Y },
  3: { x: BASE_3_X, y: BASE_3_Y },
};

// ── Easing ────────────────────────────────────────────────────────────────

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ── Basepath waypoints ────────────────────────────────────────────────────
// Runners follow the 90° basepath, not a straight line.
// Returns ordered list of waypoints from fromBase to toBase.

function buildBasepathWaypoints(
  fromBase: number,
  toBase: number,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];

  // Normalise: bases are 0=home, 1=first, 2=second, 3=third
  // Handle wrap-around (scoring from 3rd back to home = 4 in engine terms)
  const start = fromBase % 4;
  let end = toBase % 4;

  // Build path by stepping through each base
  let cur = start;
  while (cur !== end) {
    const next = (cur + 1) % 4;
    pts.push(BASE_COORDS[next]!);
    cur = next;
    if (cur === end) break;
  }

  return pts.length > 0 ? pts : [BASE_COORDS[end]!];
}

// ── Runner advance animation ──────────────────────────────────────────────

/**
 * Animates a runner dot advancing from one base to another along the basepath.
 *
 * @param app          - Pixi Application
 * @param runnerDot    - The Graphics node (gold dot) to animate
 * @param fromBase     - Starting base number: 0=home, 1=first, 2=second, 3=third
 * @param toBase       - Target base number (use 4 to indicate "scored")
 * @param speedRating  - Player speed rating 1-100 (higher = faster)
 * @param onComplete   - Callback when animation finishes
 */
export function animateRunnerAdvance(
  app: Application,
  runnerDot: Graphics,
  fromBase: number,
  toBase: number,
  speedRating: number,
  onComplete?: () => void,
): void {
  const waypoints = buildBasepathWaypoints(fromBase, toBase);
  if (waypoints.length === 0) {
    onComplete?.();
    return;
  }

  // 400ms per base for 50 speed rating; range 300-500ms per base
  const msPerBase = 500 - (speedRating / 100) * 200;

  let waypointIndex = 0;

  const startPos = BASE_COORDS[fromBase % 4] ?? { x: HOME_X, y: HOME_Y };
  let segStart = { ...startPos };

  function animateSegment(): void {
    const target = waypoints[waypointIndex];
    if (!target) {
      onComplete?.();
      return;
    }

    const dx = target.x - segStart.x;
    const dy = target.y - segStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const segDuration = Math.max(150, msPerBase * (dist / 120));

    let elapsed = 0;
    const segFrom = { ...segStart };

    const onTick = (ticker: Ticker) => {
      elapsed += ticker.deltaMS;
      const t = Math.min(elapsed / segDuration, 1);
      const ease = easeInOut(t);

      runnerDot.x = segFrom.x + (target.x - segFrom.x) * ease;
      runnerDot.y = segFrom.y + (target.y - segFrom.y) * ease;

      if (t >= 1) {
        app.ticker.remove(onTick);
        segStart = { ...target };
        waypointIndex++;

        if (waypointIndex >= waypoints.length) {
          // All waypoints reached
          if (toBase >= 4) {
            // Runner scored
            animateRunnerScore(app, runnerDot, onComplete);
          } else {
            onComplete?.();
          }
        } else {
          animateSegment();
        }
      }
    };

    app.ticker.add(onTick);
  }

  animateSegment();
}

/**
 * Runner reaches home plate — brief gold burst then hide.
 */
export function animateRunnerScore(
  app: Application,
  runnerDot: Graphics,
  onComplete?: () => void,
): void {
  const GOLD = 0xd4a843;
  const celebrationMs = 500;
  let elapsed = 0;

  // Move runner to home plate
  runnerDot.x = HOME_X;
  runnerDot.y = HOME_Y;

  const onTick = (ticker: Ticker) => {
    elapsed += ticker.deltaMS;
    const t = Math.min(elapsed / celebrationMs, 1);
    const ease = easeOutCubic(t);

    // Pulse outward and fade
    const scale = 1 + ease * 2.5;
    runnerDot.scale.set(scale);
    runnerDot.alpha = 1 - ease;
    runnerDot.tint = GOLD;

    if (t >= 1) {
      app.ticker.remove(onTick);
      runnerDot.visible = false;
      runnerDot.scale.set(1);
      runnerDot.alpha = 1;
      runnerDot.tint = 0xffffff;
      onComplete?.();
    }
  };

  app.ticker.add(onTick);
}

// ── Multiple runners simultaneous ─────────────────────────────────────────

export interface RunnerAdvanceSpec {
  dot: Graphics;
  fromBase: number;
  toBase: number;
  speedRating: number;
}

/**
 * Animates multiple runners advancing simultaneously (e.g., on a double all
 * runners advance). Calls onComplete when the LAST runner finishes.
 */
export function animateMultipleRunners(
  app: Application,
  runners: RunnerAdvanceSpec[],
  onComplete?: () => void,
): void {
  if (runners.length === 0) {
    onComplete?.();
    return;
  }

  let finishedCount = 0;

  for (const runner of runners) {
    animateRunnerAdvance(
      app,
      runner.dot,
      runner.fromBase,
      runner.toBase,
      runner.speedRating,
      () => {
        finishedCount++;
        if (finishedCount >= runners.length) {
          onComplete?.();
        }
      },
    );
  }
}

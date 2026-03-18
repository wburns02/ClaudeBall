import { Application, Graphics, Container, Ticker } from 'pixi.js';
import type { PitchType } from '@/engine/types/enums.ts';

// ── Types ─────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

// ── Bezier helpers ────────────────────────────────────────────────────

/** Quadratic bezier position at parameter t ∈ [0,1]. */
function quadBezier(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

// ── Per-pitch-type trajectory configs ────────────────────────────────

interface PitchConfig {
  /** Duration in ms. */
  durationMs: number;
  /**
   * Control point expressed as fractions of the (start→end) vector.
   * cx/cy are offsets perpendicular / along the path in normalized coords.
   * We compute the absolute control point inside animatePitchDelivery.
   */
  ctrlOffsetX: number; // lateral offset (+ = right)
  ctrlOffsetY: number; // vertical offset relative to midpoint (+ = down)
  /** Easing: 'linear' | 'ease_in' | 'ease_out'. */
  easing: 'linear' | 'ease_in' | 'ease_out';
}

const PITCH_CONFIGS: Record<PitchType, PitchConfig> = {
  fastball:    { durationMs: 250, ctrlOffsetX: 0,   ctrlOffsetY: -8,  easing: 'ease_out' },
  sinker:      { durationMs: 300, ctrlOffsetX: 4,   ctrlOffsetY: 20,  easing: 'ease_out' },
  cutter:      { durationMs: 280, ctrlOffsetX: -14, ctrlOffsetY: 0,   easing: 'ease_out' },
  slider:      { durationMs: 350, ctrlOffsetX: -30, ctrlOffsetY: 10,  easing: 'ease_in'  },
  curveball:   { durationMs: 400, ctrlOffsetX: 10,  ctrlOffsetY: -50, easing: 'ease_in'  },
  changeup:    { durationMs: 450, ctrlOffsetX: 6,   ctrlOffsetY: 5,   easing: 'linear'   },
  splitter:    { durationMs: 350, ctrlOffsetX: 0,   ctrlOffsetY: 40,  easing: 'ease_in'  },
  knuckleball: { durationMs: 480, ctrlOffsetX: 18,  ctrlOffsetY: 18,  easing: 'linear'   },
};

// Fallback config if an unknown pitch type is passed.
const DEFAULT_CONFIG: PitchConfig = PITCH_CONFIGS.fastball;

// ── Trail config ──────────────────────────────────────────────────────

const TRAIL_LENGTH = 8; // number of trailing dots
const BALL_RADIUS = 4;

function easeValue(t: number, mode: PitchConfig['easing']): number {
  switch (mode) {
    case 'ease_in':  return t * t;
    case 'ease_out': return 1 - Math.pow(1 - t, 2);
    case 'linear':
    default:         return t;
  }
}

// ── PitchAnimator ─────────────────────────────────────────────────────

/**
 * Standalone animation module for enhanced pitch delivery.
 *
 * Usage:
 *   const animator = new PitchAnimator(app);
 *   await animator.animatePitchDelivery('curveball', 78, start, end);
 *   animator.destroy();
 */
export class PitchAnimator {
  private app: Application;
  private container: Container;
  private ballGraphic: Graphics;
  private trailDots: Graphics[] = [];
  private trailPositions: Point[] = [];

  constructor(app: Application) {
    this.app = app;

    this.container = new Container();
    this.app.stage.addChild(this.container);

    // Ball
    this.ballGraphic = new Graphics();
    this.ballGraphic.circle(0, 0, BALL_RADIUS);
    this.ballGraphic.fill({ color: 0xffffff });
    this.ballGraphic.visible = false;
    this.container.addChild(this.ballGraphic);

    // Trail dots (pre-create, reuse)
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const dot = new Graphics();
      dot.circle(0, 0, BALL_RADIUS * 0.65);
      dot.fill({ color: 0xffffff, alpha: 1 });
      dot.visible = false;
      this.container.addChild(dot);
      this.trailDots.push(dot);
    }
  }

  /**
   * Animate a pitch from startPos to endPos with pitch-type bezier curve.
   * Returns a Promise that resolves when the ball arrives at the plate.
   *
   * @param pitchType  Which pitch to animate.
   * @param _velocity  Velocity in mph (unused for visual scaling but reserved).
   * @param startPos   World-space start position (mound).
   * @param endPos     World-space end position (home plate).
   * @param targetPos  Optional — overrides endPos as the bezier endpoint.
   */
  animatePitchDelivery(
    pitchType: PitchType,
    _velocity: number,
    startPos: Point,
    endPos: Point,
    targetPos?: Point,
  ): Promise<void> {
    const dest = targetPos ?? endPos;
    const cfg = PITCH_CONFIGS[pitchType] ?? DEFAULT_CONFIG;

    // Compute absolute control point.
    // Mid-point of the straight path:
    const mid: Point = {
      x: (startPos.x + dest.x) / 2,
      y: (startPos.y + dest.y) / 2,
    };

    const ctrl: Point = {
      x: mid.x + cfg.ctrlOffsetX,
      y: mid.y + cfg.ctrlOffsetY,
    };

    this.trailPositions = [];
    this.ballGraphic.visible = true;

    return new Promise<void>((resolve) => {
      let elapsed = 0;
      let done = false;

      const onTick = (ticker: Ticker) => {
        if (done) return;

        elapsed += ticker.deltaMS;
        const rawT = Math.min(elapsed / cfg.durationMs, 1);
        const t = easeValue(rawT, cfg.easing);

        const pos = quadBezier(startPos, ctrl, dest, t);

        // Update ball
        this.ballGraphic.x = pos.x;
        this.ballGraphic.y = pos.y;

        // Record trail position
        this.trailPositions.push({ x: pos.x, y: pos.y });
        if (this.trailPositions.length > TRAIL_LENGTH) {
          this.trailPositions.shift();
        }

        // Draw trail dots
        for (let i = 0; i < TRAIL_LENGTH; i++) {
          const dot = this.trailDots[i];
          const trailIdx = this.trailPositions.length - 1 - i;
          if (trailIdx < 0) {
            dot.visible = false;
            continue;
          }
          const tp = this.trailPositions[trailIdx];
          dot.x = tp.x;
          dot.y = tp.y;
          dot.alpha = ((TRAIL_LENGTH - i) / TRAIL_LENGTH) * 0.45;
          dot.visible = true;
        }

        if (rawT >= 1) {
          done = true;
          this.app.ticker.remove(onTick);
          // Hold briefly then hide
          setTimeout(() => {
            this.ballGraphic.visible = false;
            for (const dot of this.trailDots) dot.visible = false;
            this.trailPositions = [];
            resolve();
          }, 120);
        }
      };

      this.app.ticker.add(onTick);
    });
  }

  /** Remove this animator's container from the stage. */
  destroy(): void {
    this.app.ticker.remove(() => {}); // no-op safety
    this.container.destroy({ children: true });
  }
}

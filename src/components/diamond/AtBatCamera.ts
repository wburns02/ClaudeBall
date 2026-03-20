// ── AtBatCamera.ts ────────────────────────────────────────────────────────────
// Manages camera zoom for the Pixi root container to create a cinematic
// at-bat close-up effect. Zooms in on the home plate area before each pitch
// and zooms back out to full field view for balls in play.
//
// Coordinate system:
//   The root container is the Pixi "world" container. DiamondRenderer scales
//   it to fill the canvas at init (scale ≈ 1.0 for a 600×500 world).
//   When we zoom we modify this root scale + position so that home plate
//   (300, 425) is centered in the rendered viewport.

import { Container, Ticker } from 'pixi.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** World-space home plate position (mirrors DiamondRenderer). */
const HOME_X = 300;
const HOME_Y = 425;

/** World-space mound position. */
const MOUND_X = 300;
const MOUND_Y = 310;

/** Logical world viewport (what DiamondRenderer was designed for). */
const WORLD_W = 600;
const WORLD_H = 500;

// ── Easing ────────────────────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ── Camera state ──────────────────────────────────────────────────────────────

interface CameraState {
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
}

// ── AtBatCamera ───────────────────────────────────────────────────────────────

/**
 * Manages smooth camera zoom animations for the Pixi scene.
 *
 * Usage:
 *   const cam = new AtBatCamera(root, baseScaleX, baseScaleY, baseX, baseY);
 *   await cam.zoomToAtBat(500);   // zoom in before pitch
 *   await cam.zoomToField(400);   // zoom back out after contact
 *   cam.destroy();
 */
export class AtBatCamera {
  private root: Container | null = null;

  /** The scale/position set by DiamondRenderer.initInContainer() — our "home base". */
  private baseScaleX: number;
  private baseScaleY: number;
  private baseX: number;
  private baseY: number;

  /** Track running animation so we can cancel. */
  private _cancelCurrent: (() => void) | null = null;
  private _destroyed = false;

  /** Current logical zoom state (at-bat or field). */
  private _zoomedIn = false;

  constructor() {
    this.baseScaleX = 1;
    this.baseScaleY = 1;
    this.baseX = 0;
    this.baseY = 0;
  }

  /**
   * Attach the Pixi root container. Called once the renderer finishes init.
   * Before this is called, all zoom operations are no-ops.
   */
  attachRoot(root: Container, baseScaleX: number, baseScaleY: number, baseX: number, baseY: number): void {
    this.root = root;
    this.baseScaleX = baseScaleX;
    this.baseScaleY = baseScaleY;
    this.baseX = baseX;
    this.baseY = baseY;
  }

  /** Whether the camera has been attached to a Pixi root. */
  get isReady(): boolean {
    return this.root !== null;
  }

  // ── State ─────────────────────────────────────────────────────────────────

  get isZoomedIn(): boolean {
    return this._zoomedIn;
  }

  /** Update base scale/position (called after canvas resize). */
  updateBase(scaleX: number, scaleY: number, x: number, y: number): void {
    this.baseScaleX = scaleX;
    this.baseScaleY = scaleY;
    this.baseX = x;
    this.baseY = y;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Zoom in to at-bat view. Centers on the midpoint between home plate and
   * the mound so we can see pitcher, batter, catcher, and umpire large.
   * Returns a Promise that resolves when the zoom animation completes.
   */
  zoomToAtBat(duration = 700): Promise<void> {
    if (!this.root) return Promise.resolve();
    this._zoomedIn = true;

    // Focus point: midway between mound and home plate, slightly biased toward home
    const focusX = MOUND_X * 0.35 + HOME_X * 0.65;
    const focusY = MOUND_Y * 0.40 + HOME_Y * 0.60;

    // We zoom the WORLD by atBatZoom relative to basescale.
    // The rendered canvas shows "world * baseScale" pixels, so an additional
    // 2.5x zoom fills the camera with the close-up area.
    const atBatZoom = 2.5;
    const targetScaleX = this.baseScaleX * atBatZoom;
    const targetScaleY = this.baseScaleY * atBatZoom;

    // After scaling, world coordinate focusX,focusY must appear at viewport center.
    // Viewport center in rendered pixels: (canvasW/2, canvasH/2)
    // canvasW = WORLD_W * baseScaleX + 2*baseX (usually baseX = 0 when fullscreen)
    const canvasW = WORLD_W * this.baseScaleX + this.baseX * 2;
    const canvasH = WORLD_H * this.baseScaleY + this.baseY * 2;
    const vpCX = canvasW / 2;
    const vpCY = canvasH / 2;

    const targetX = vpCX - focusX * targetScaleX;
    const targetY = vpCY - focusY * targetScaleY;

    return this._tweenTo({ scaleX: targetScaleX, scaleY: targetScaleY, x: targetX, y: targetY }, duration, easeOutCubic);
  }

  /**
   * Zoom back to full field view.
   * Returns a Promise that resolves when the zoom animation completes.
   */
  zoomToField(duration = 800): Promise<void> {
    if (!this.root) return Promise.resolve();
    this._zoomedIn = false;
    return this._tweenTo(
      { scaleX: this.baseScaleX, scaleY: this.baseScaleY, x: this.baseX, y: this.baseY },
      duration,
      easeInOutCubic,
    );
  }

  /**
   * Zoom slightly toward where the ball was hit (for home-run / fly ball drama).
   * Direction: 'left' | 'right' | 'center'
   */
  zoomToOutfield(direction: 'left' | 'right' | 'center', duration = 700): Promise<void> {
    if (!this.root) return Promise.resolve();
    this._zoomedIn = false;

    // Outfield target positions (world coords)
    const ofTargets = {
      left:   { x: 150, y: 158 },
      right:  { x: 450, y: 158 },
      center: { x: 300, y: 100 },
    };
    const target = ofTargets[direction];

    const ofZoom = 1.35;
    const targetScaleX = this.baseScaleX * ofZoom;
    const targetScaleY = this.baseScaleY * ofZoom;

    const canvasW = WORLD_W * this.baseScaleX + this.baseX * 2;
    const canvasH = WORLD_H * this.baseScaleY + this.baseY * 2;
    const vpCX = canvasW / 2;
    const vpCY = canvasH / 2;

    const targetX = vpCX - target.x * targetScaleX;
    const targetY = vpCY - target.y * targetScaleY;

    return this._tweenTo({ scaleX: targetScaleX, scaleY: targetScaleY, x: targetX, y: targetY }, duration, easeInOutCubic);
  }

  /**
   * Pan to an arbitrary world point at a given zoom level.
   * Used for following the ball on hits and dramatic camera moves.
   */
  panToPoint(worldX: number, worldY: number, zoom: number, duration = 600): Promise<void> {
    if (!this.root) return Promise.resolve();

    const targetScaleX = this.baseScaleX * zoom;
    const targetScaleY = this.baseScaleY * zoom;

    const canvasW = WORLD_W * this.baseScaleX + this.baseX * 2;
    const canvasH = WORLD_H * this.baseScaleY + this.baseY * 2;
    const vpCX = canvasW / 2;
    const vpCY = canvasH / 2;

    const targetX = vpCX - worldX * targetScaleX;
    const targetY = vpCY - worldY * targetScaleY;

    return this._tweenTo(
      { scaleX: targetScaleX, scaleY: targetScaleY, x: targetX, y: targetY },
      duration,
      easeInOutQuad,
    );
  }

  /**
   * Immediately snap back to field view (no animation — for inning change / reset).
   */
  snapToField(): void {
    this._cancelCurrentAnim();
    this._zoomedIn = false;
    if (!this.root) return;
    this.root.scale.set(this.baseScaleX, this.baseScaleY);
    this.root.x = this.baseX;
    this.root.y = this.baseY;
  }

  destroy(): void {
    this._cancelCurrentAnim();
    this._destroyed = true;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private _cancelCurrentAnim(): void {
    if (this._cancelCurrent) {
      this._cancelCurrent();
      this._cancelCurrent = null;
    }
  }

  private _tweenTo(target: CameraState, durationMs: number, easeFn: (t: number) => number): Promise<void> {
    const root = this.root;
    if (!root) return Promise.resolve();

    this._cancelCurrentAnim();

    if (durationMs <= 0 || this._destroyed) {
      root.scale.set(target.scaleX, target.scaleY);
      root.x = target.x;
      root.y = target.y;
      return Promise.resolve();
    }

    const startScaleX = root.scale.x;
    const startScaleY = root.scale.y;
    const startX = root.x;
    const startY = root.y;

    let elapsed = 0;
    let cancelled = false;

    return new Promise<void>((resolve) => {
      const onTick = (ticker: Ticker) => {
        if (cancelled || this._destroyed) {
          Ticker.shared.remove(onTick);
          resolve();
          return;
        }

        elapsed += ticker.deltaMS;
        const progress = Math.min(elapsed / durationMs, 1);
        const ease = easeFn(progress);

        root.scale.set(
          startScaleX + (target.scaleX - startScaleX) * ease,
          startScaleY + (target.scaleY - startScaleY) * ease,
        );
        root.x = startX + (target.x - startX) * ease;
        root.y = startY + (target.y - startY) * ease;

        if (progress >= 1) {
          Ticker.shared.remove(onTick);
          this._cancelCurrent = null;
          resolve();
        }
      };

      this._cancelCurrent = () => {
        cancelled = true;
      };

      Ticker.shared.add(onTick);
    });
  }
}

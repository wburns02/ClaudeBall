import { Container, Ticker } from 'pixi.js';

// ── Coordinate constants (mirror DiamondRenderer) ─────────────────────────
const VIEWPORT_W = 600;
const VIEWPORT_H = 500;
const HOME_X = 300;
const HOME_Y = 420;

// ── Easing ────────────────────────────────────────────────────────────────

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ── Internal state ────────────────────────────────────────────────────────

interface CamTarget {
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
}

// Track currently running animation to cancel previous if a new one starts
let _currentCancelFn: (() => void) | null = null;

function cancelCurrent(): void {
  if (_currentCancelFn) {
    _currentCancelFn();
    _currentCancelFn = null;
  }
}

// ── Core tween helper ─────────────────────────────────────────────────────

/**
 * Tweens a Container's scale and position from its current values to the
 * given target using ease-out-cubic, via Pixi's shared Ticker.
 */
function tweenCamera(
  container: Container,
  target: CamTarget,
  durationMs: number,
  onComplete?: () => void,
): void {
  cancelCurrent();

  const startScaleX = container.scale.x;
  const startScaleY = container.scale.y;
  const startX = container.x;
  const startY = container.y;

  let elapsed = 0;
  let cancelled = false;

  const ticker = Ticker.shared;

  const onTick = (t: Ticker) => {
    if (cancelled) {
      ticker.remove(onTick);
      return;
    }

    elapsed += t.deltaMS;
    const progress = Math.min(elapsed / durationMs, 1);
    const ease = easeOutCubic(progress);

    container.scale.set(
      startScaleX + (target.scaleX - startScaleX) * ease,
      startScaleY + (target.scaleY - startScaleY) * ease,
    );
    container.x = startX + (target.x - startX) * ease;
    container.y = startY + (target.y - startY) * ease;

    if (progress >= 1) {
      ticker.remove(onTick);
      _currentCancelFn = null;
      onComplete?.();
    }
  };

  _currentCancelFn = () => {
    cancelled = true;
  };

  ticker.add(onTick);
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Zooms in on the home plate area to give an at-bat view.
 * Scale 1.3x, centered on home plate.
 */
export function zoomToPlate(container: Container, durationMs = 400): void {
  const zoom = 1.3;
  tweenCamera(container, {
    scaleX: zoom,
    scaleY: zoom,
    // Offset so home plate stays centered in the viewport
    x: VIEWPORT_W / 2 - HOME_X * zoom,
    y: VIEWPORT_H / 2 - HOME_Y * zoom,
  }, durationMs);
}

/**
 * Zooms back out to show the full diamond (default view).
 */
export function zoomToField(container: Container, durationMs = 400): void {
  tweenCamera(container, {
    scaleX: 1,
    scaleY: 1,
    x: 0,
    y: 0,
  }, durationMs);
}

/**
 * Subtle zoom with a short screen shake for home run / celebration moments.
 */
export function zoomToCelebrate(container: Container, durationMs = 600): void {
  const zoom = 1.1;
  const ticker = Ticker.shared;

  // Brief shake before settling
  const shakeMs = 350;
  const shakeAmplitude = 4;
  let shakeElapsed = 0;

  const shakeOnTick = (t: Ticker) => {
    shakeElapsed += t.deltaMS;
    if (shakeElapsed >= shakeMs) {
      ticker.remove(shakeOnTick);
      container.x = 0;
      container.y = 0;
      return;
    }
    const decay = 1 - shakeElapsed / shakeMs;
    container.x = (Math.random() - 0.5) * shakeAmplitude * 2 * decay;
    container.y = (Math.random() - 0.5) * shakeAmplitude * decay;
  };

  ticker.add(shakeOnTick);

  // After shake, settle at slight zoom
  setTimeout(() => {
    tweenCamera(container, {
      scaleX: zoom,
      scaleY: zoom,
      x: VIEWPORT_W / 2 - (VIEWPORT_W / 2) * zoom,
      y: VIEWPORT_H / 2 - (VIEWPORT_H / 2) * zoom,
    }, durationMs);
  }, shakeMs);
}

/**
 * Smooth pan so that the given world coordinate (x, y) is centered in the viewport.
 */
export function panToArea(
  container: Container,
  worldX: number,
  worldY: number,
  durationMs = 350,
): void {
  const currentScale = container.scale.x;
  tweenCamera(container, {
    scaleX: currentScale,
    scaleY: currentScale,
    x: VIEWPORT_W / 2 - worldX * currentScale,
    y: VIEWPORT_H / 2 - worldY * currentScale,
  }, durationMs);
}

/**
 * Returns the camera to its default position (scale=1, no offset).
 */
export function resetCamera(container: Container, durationMs = 400): void {
  tweenCamera(container, {
    scaleX: 1,
    scaleY: 1,
    x: 0,
    y: 0,
  }, durationMs);
}

/**
 * Immediately snaps camera to default without animation — useful on inning
 * changes or game reset.
 */
export function snapCameraReset(container: Container): void {
  cancelCurrent();
  container.scale.set(1);
  container.x = 0;
  container.y = 0;
}

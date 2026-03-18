// ── Tween.ts ──────────────────────────────────────────────────────────────────
// Frame-accurate tween utilities using Pixi's shared Ticker.
// Every tween returns a Promise that ALWAYS resolves (never hangs).

import { Ticker } from 'pixi.js';

export interface Point {
  x: number;
  y: number;
}

// ── Easing library ─────────────────────────────────────────────────────────────

export const Easing = {
  linear: (t: number) => t,
  easeIn:  (t: number) => t * t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 2),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInCubic:  (t: number) => t * t * t,
  easeOutQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  easeOutExpo:  (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  bounce: (t: number) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
    if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
    t -= 2.625 / d1;
    return n1 * t * t + 0.984375;
  },
} as const;

// ── Simple delay ───────────────────────────────────────────────────────────────

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── tweenTo — linear position tween ───────────────────────────────────────────

export function tweenTo(
  obj: { x: number; y: number },
  target: { x: number; y: number },
  duration: number,
  easing: (t: number) => number = Easing.easeOutCubic,
  destroyedFlag?: { _destroyed: boolean },
): Promise<void> {
  if (duration <= 0) {
    obj.x = target.x;
    obj.y = target.y;
    return Promise.resolve();
  }

  const startX = obj.x;
  const startY = obj.y;
  let elapsed = 0;

  return new Promise<void>((resolve) => {
    const onTick = (ticker: Ticker) => {
      if (destroyedFlag?._destroyed) {
        Ticker.shared.remove(onTick);
        resolve();
        return;
      }

      elapsed += ticker.deltaMS;
      const t = Math.min(elapsed / duration, 1);
      const e = easing(t);

      obj.x = startX + (target.x - startX) * e;
      obj.y = startY + (target.y - startY) * e;

      if (t >= 1) {
        Ticker.shared.remove(onTick);
        resolve();
      }
    };

    Ticker.shared.add(onTick);
  });
}

// ── tweenBezier — quadratic bezier position tween ─────────────────────────────

export function tweenBezier(
  obj: { x: number; y: number },
  start: Point,
  control: Point,
  end: Point,
  duration: number,
  easing: (t: number) => number = Easing.linear,
  destroyedFlag?: { _destroyed: boolean },
): Promise<void> {
  if (duration <= 0) {
    obj.x = end.x;
    obj.y = end.y;
    return Promise.resolve();
  }

  let elapsed = 0;

  return new Promise<void>((resolve) => {
    const onTick = (ticker: Ticker) => {
      if (destroyedFlag?._destroyed) {
        Ticker.shared.remove(onTick);
        resolve();
        return;
      }

      elapsed += ticker.deltaMS;
      const rawT = Math.min(elapsed / duration, 1);
      const t = easing(rawT);

      const mt = 1 - t;
      obj.x = mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x;
      obj.y = mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y;

      if (rawT >= 1) {
        Ticker.shared.remove(onTick);
        resolve();
      }
    };

    Ticker.shared.add(onTick);
  });
}

// ── tweenParabolic — parabolic arc (fly ball / HR) ────────────────────────────
// Horizontal movement is linear. Vertical adds a parabolic arc above the
// straight-line path. peakHeight is the maximum rise above the midpoint (px).

export function tweenParabolic(
  obj: { x: number; y: number; scale?: { set: (s: number) => void } },
  start: Point,
  end: Point,
  peakHeight: number,
  duration: number,
  destroyedFlag?: { _destroyed: boolean },
  onProgress?: (t: number, heightFraction: number) => void,
): Promise<void> {
  if (duration <= 0) {
    obj.x = end.x;
    obj.y = end.y;
    return Promise.resolve();
  }

  let elapsed = 0;

  return new Promise<void>((resolve) => {
    const onTick = (ticker: Ticker) => {
      if (destroyedFlag?._destroyed) {
        Ticker.shared.remove(onTick);
        resolve();
        return;
      }

      elapsed += ticker.deltaMS;
      const t = Math.min(elapsed / duration, 1);

      // Horizontal: linear lerp
      obj.x = start.x + (end.x - start.x) * t;

      // Vertical: parabolic arc
      // Straight-line y at this t
      const straightY = start.y + (end.y - start.y) * t;
      // Parabola: rises to peakHeight at t=0.5, returns to 0 at t=1
      const parabola = 4 * peakHeight * t * (1 - t);
      obj.y = straightY - parabola;

      // heightFraction for scale effects: 0 at start/end, 1 at apex
      const heightFraction = 4 * t * (1 - t);
      onProgress?.(t, heightFraction);

      if (t >= 1) {
        Ticker.shared.remove(onTick);
        resolve();
      }
    };

    Ticker.shared.add(onTick);
  });
}

// ── tweenScale — scale a display object over time ─────────────────────────────

export function tweenScale(
  obj: { scale: { set: (s: number) => void } },
  from: number,
  to: number,
  duration: number,
  easing: (t: number) => number = Easing.easeOutCubic,
  destroyedFlag?: { _destroyed: boolean },
): Promise<void> {
  if (duration <= 0) {
    obj.scale.set(to);
    return Promise.resolve();
  }

  let elapsed = 0;

  return new Promise<void>((resolve) => {
    const onTick = (ticker: Ticker) => {
      if (destroyedFlag?._destroyed) {
        Ticker.shared.remove(onTick);
        resolve();
        return;
      }

      elapsed += ticker.deltaMS;
      const t = Math.min(elapsed / duration, 1);
      const e = easing(t);
      obj.scale.set(from + (to - from) * e);

      if (t >= 1) {
        Ticker.shared.remove(onTick);
        resolve();
      }
    };

    Ticker.shared.add(onTick);
  });
}

// ── tweenAlpha — fade an object in or out ────────────────────────────────────

export function tweenAlpha(
  obj: { alpha: number },
  from: number,
  to: number,
  duration: number,
  easing: (t: number) => number = Easing.easeOut,
  destroyedFlag?: { _destroyed: boolean },
): Promise<void> {
  if (duration <= 0) {
    obj.alpha = to;
    return Promise.resolve();
  }

  obj.alpha = from;
  let elapsed = 0;

  return new Promise<void>((resolve) => {
    const onTick = (ticker: Ticker) => {
      if (destroyedFlag?._destroyed) {
        Ticker.shared.remove(onTick);
        resolve();
        return;
      }

      elapsed += ticker.deltaMS;
      const t = Math.min(elapsed / duration, 1);
      obj.alpha = from + (to - from) * easing(t);

      if (t >= 1) {
        Ticker.shared.remove(onTick);
        resolve();
      }
    };

    Ticker.shared.add(onTick);
  });
}

// ── tweenGround — rolling ground ball with hop simulation ─────────────────────

export function tweenGround(
  obj: { x: number; y: number },
  start: Point,
  end: Point,
  duration: number,
  exitVelo = 80,
  destroyedFlag?: { _destroyed: boolean },
): Promise<void> {
  if (duration <= 0) {
    obj.x = end.x;
    obj.y = end.y;
    return Promise.resolve();
  }

  let elapsed = 0;

  return new Promise<void>((resolve) => {
    const onTick = (ticker: Ticker) => {
      if (destroyedFlag?._destroyed) {
        Ticker.shared.remove(onTick);
        resolve();
        return;
      }

      elapsed += ticker.deltaMS;
      const t = Math.min(elapsed / duration, 1);
      const ease = Easing.easeOutExpo(t);

      obj.x = start.x + (end.x - start.x) * ease;

      // Hop offset
      const speed = Math.min(1, Math.max(0, (exitVelo - 60) / 50));
      const hopCount = speed > 0.7 ? 1.5 : speed > 0.4 ? 2.5 : 3.5;
      const amplitude = speed > 0.7 ? 7 : speed > 0.4 ? 4 : 2.5;
      const decay = 1 - t;
      const hop = Math.max(0, Math.sin(t * Math.PI * hopCount) * amplitude * decay);

      obj.y = start.y + (end.y - start.y) * ease - hop;

      if (t >= 1) {
        Ticker.shared.remove(onTick);
        resolve();
      }
    };

    Ticker.shared.add(onTick);
  });
}

// ── UmpireAnimation.ts ────────────────────────────────────────────────────
// Home plate umpire figure and animations.

import { Ticker } from 'pixi.js';
import type { PlayerFigure } from './PlayerFigure.ts';
import { POSE_LIBRARY, interpolatePose, easeOut, easeInOut } from './AnimationKeyframes.ts';
import type { PoseData } from './AnimationKeyframes.ts';
import { PlayerFigure as PlayerFigureClass } from './PlayerFigure.ts';

// ── Internal sequencer ────────────────────────────────────────────────────

function runKeyframes(
  figure: PlayerFigure,
  keyframes: Array<{ pose: PoseData; durationMs: number; easeFn?: (t: number) => number }>,
  onComplete?: () => void,
): void {
  let idx = 0;
  let elapsed = 0;
  let fromPose = figure.getPoseData();
  const ticker = Ticker.shared;

  const onTick = (t: Ticker) => {
    const kf = keyframes[idx];
    if (!kf) {
      ticker.remove(onTick);
      onComplete?.();
      return;
    }

    elapsed += t.deltaMS;
    const rawT = Math.min(elapsed / kf.durationMs, 1);
    const easedT = (kf.easeFn ?? easeInOut)(rawT);

    figure.applyPoseData(interpolatePose(fromPose, kf.pose, easedT));

    if (rawT >= 1) {
      fromPose = { ...kf.pose };
      elapsed = 0;
      idx++;
    }
  };

  ticker.add(onTick);
}

// ── Exports ───────────────────────────────────────────────────────────────

/**
 * Create the umpire figure (dark blue/black, no team colors).
 * Umpire wears all dark — distinguishable from players.
 */
export function createUmpireFigure(): PlayerFigure {
  // Umpire: dark navy jersey, black cap
  return new PlayerFigureClass('#1a1a2e', '#000000', false);
}

/**
 * Dramatic punch-out strike call.
 * Right arm shoots out, body turns slightly.
 */
export function animateStrikeCall(
  figure: PlayerFigure,
  onComplete: () => void,
): void {
  const punchPose: PoseData = { ...POSE_LIBRARY['umpire_strike'] };
  const bigPunchPose: PoseData = {
    ...punchPose,
    rightArm: -85,  // fully extended
    torsoLean: -15,
    headTilt: 8,
  };

  runKeyframes(
    figure,
    [
      // Wind up
      { pose: { ...POSE_LIBRARY['standing'], rightArm: 50 }, durationMs: 80, easeFn: easeInOut },
      // Punch out — dramatic
      { pose: bigPunchPose, durationMs: 150, easeFn: easeOut },
      // Hold pose
      { pose: bigPunchPose, durationMs: 200 },
      // Return
      { pose: POSE_LIBRARY['standing'], durationMs: 300, easeFn: easeInOut },
    ],
    onComplete,
  );
}

/**
 * Subtle ball call — point to first base side.
 */
export function animateBallCall(
  figure: PlayerFigure,
  onComplete: () => void,
): void {
  const ballPose: PoseData = { ...POSE_LIBRARY['umpire_ball'] };

  runKeyframes(
    figure,
    [
      { pose: ballPose, durationMs: 180, easeFn: easeOut },
      { pose: ballPose, durationMs: 150 },
      { pose: POSE_LIBRARY['standing'], durationMs: 250, easeFn: easeInOut },
    ],
    onComplete,
  );
}

/**
 * Fist pump out call at a base.
 */
export function animateOutCall(
  figure: PlayerFigure,
  onComplete: () => void,
): void {
  const outPose: PoseData = { ...POSE_LIBRARY['umpire_out'] };
  const bigOut: PoseData = {
    ...outPose,
    rightArm: -70,
    torsoLean: -10,
  };

  runKeyframes(
    figure,
    [
      { pose: { ...POSE_LIBRARY['standing'], rightArm: -30 }, durationMs: 80, easeFn: easeInOut },
      { pose: bigOut, durationMs: 140, easeFn: easeOut },
      { pose: bigOut, durationMs: 180 },
      { pose: POSE_LIBRARY['standing'], durationMs: 280, easeFn: easeInOut },
    ],
    onComplete,
  );
}

/**
 * Safe call — arms spread wide, palms down.
 */
export function animateSafeCall(
  figure: PlayerFigure,
  onComplete: () => void,
): void {
  const safePose: PoseData = { ...POSE_LIBRARY['umpire_safe'] };

  runKeyframes(
    figure,
    [
      // Arms come up and spread wide
      { pose: safePose, durationMs: 200, easeFn: easeOut },
      // Hold
      { pose: safePose, durationMs: 250 },
      // Return
      { pose: POSE_LIBRARY['standing'], durationMs: 300, easeFn: easeInOut },
    ],
    onComplete,
  );
}

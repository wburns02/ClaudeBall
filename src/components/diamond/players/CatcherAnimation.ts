// ── CatcherAnimation.ts ───────────────────────────────────────────────────
// Catcher behind the plate: crouch, receive, frame, throw to second.

import { Ticker } from 'pixi.js';
import type { PlayerFigure } from './PlayerFigure.ts';
import { POSE_LIBRARY, interpolatePose, easeIn, easeOut, easeInOut } from './AnimationKeyframes.ts';
import type { PoseData } from './AnimationKeyframes.ts';

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
 * Put catcher in catching crouch with mitt target.
 */
export function animateCrouch(figure: PlayerFigure): void {
  runKeyframes(figure, [
    { pose: POSE_LIBRARY['catcher_crouch'], durationMs: 250, easeFn: easeInOut },
  ]);
}

/**
 * Reach to catch pitch at a given location offset.
 * location.x/y are offsets from the catcher's base position (pitch zone).
 */
export function animateReceive(
  figure: PlayerFigure,
  location: { x: number; y: number },
  onComplete: () => void,
): void {
  // Derive arm pose from pitch location — high/low, inside/outside
  const reachPose: PoseData = { ...POSE_LIBRARY['catcher_receive'] };

  // Low pitch → deeper crouch
  if (location.y > 10) {
    reachPose.torsoLean = -30;
    reachPose.leftArm = -80;
    reachPose.rightArm = -80;
  }
  // High pitch → arms extend up
  if (location.y < -10) {
    reachPose.leftArm = -60;
    reachPose.rightArm = -60;
    reachPose.torsoLean = -15;
  }
  // Inside/outside → glove moves laterally (reflected in arm rotation)
  if (location.x > 8) {
    reachPose.leftArm = -65;
  } else if (location.x < -8) {
    reachPose.rightArm = -65;
  }

  runKeyframes(
    figure,
    [
      { pose: reachPose, durationMs: 120, easeFn: easeOut },
      { pose: reachPose, durationMs: 80 }, // brief hold
      { pose: POSE_LIBRARY['catcher_crouch'], durationMs: 180, easeFn: easeOut },
    ],
    onComplete,
  );
}

/**
 * Subtle pitch framing — gentle glove tilt toward zone.
 */
export function animateFramePitch(
  figure: PlayerFigure,
  onComplete: () => void,
): void {
  const framePose: PoseData = {
    ...POSE_LIBRARY['catcher_receive'],
    leftArm: -72,
    torsoLean: -22,
  };

  runKeyframes(
    figure,
    [
      { pose: framePose, durationMs: 100, easeFn: easeOut },
      { pose: POSE_LIBRARY['catcher_crouch'], durationMs: 150, easeFn: easeInOut },
    ],
    onComplete,
  );
}

/**
 * Pop up from crouch and throw to second base.
 * - onRelease fires when arm extends
 */
export function animateThrowDown(
  figure: PlayerFigure,
  onRelease: () => void,
  onComplete: () => void,
): void {
  let releaseFired = false;
  let totalElapsed = 0;
  const RELEASE_MS = 280;

  const throwPose: PoseData = { ...POSE_LIBRARY['catcher_throw'] };

  const kfs = [
    // Pop up from crouch
    { pose: { ...POSE_LIBRARY['ready'], rightArm: 40 }, durationMs: 150, easeFn: easeOut },
    // Wind arm back
    { pose: throwPose, durationMs: 130, easeFn: easeIn },
    // Arm fires forward
    { pose: { ...throwPose, rightArm: -80, torsoLean: -20 }, durationMs: 100, easeFn: easeIn },
    // Follow through
    { pose: { ...throwPose, rightArm: 15, torsoLean: -25 }, durationMs: 180, easeFn: easeOut },
    // Return to crouch
    { pose: POSE_LIBRARY['catcher_crouch'], durationMs: 250, easeFn: easeInOut },
  ];

  let idx = 0;
  let elapsed = 0;
  let fromPose = figure.getPoseData();
  const ticker = Ticker.shared;

  const onTick = (t: Ticker) => {
    totalElapsed += t.deltaMS;

    if (!releaseFired && totalElapsed >= RELEASE_MS) {
      releaseFired = true;
      onRelease();
    }

    const kf = kfs[idx];
    if (!kf) {
      ticker.remove(onTick);
      onComplete();
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

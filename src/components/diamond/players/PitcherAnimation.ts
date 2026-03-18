// ── PitcherAnimation.ts ───────────────────────────────────────────────────
// Pitcher windup and delivery animation sequences.

import { Ticker } from 'pixi.js';
import type { PlayerFigure } from './PlayerFigure.ts';
import { POSE_LIBRARY, interpolatePose, easeIn, easeOut, easeInOut } from './AnimationKeyframes.ts';
import type { PoseData } from './AnimationKeyframes.ts';

// ── Keyframe type ─────────────────────────────────────────────────────────

interface Keyframe {
  pose: PoseData;
  durationMs: number;
  easeFn?: (t: number) => number;
}

// ── Helper: run a keyframe sequence on a figure ───────────────────────────

function runKeyframes(
  figure: PlayerFigure,
  keyframes: Keyframe[],
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

    const interp = interpolatePose(fromPose, kf.pose, easedT);
    figure.applyPoseData(interp);

    if (rawT >= 1) {
      fromPose = { ...kf.pose };
      elapsed = 0;
      idx++;
    }
  };

  ticker.add(onTick);
}

// ── Per-pitch-type follow-through variations ──────────────────────────────

function getFollowThroughPose(pitchType: string): PoseData {
  switch (pitchType) {
    case 'curveball':
      return {
        ...POSE_LIBRARY['pitching_follow'],
        rightArm: 30,   // more snap-down
        torsoLean: -40,
        headTilt: -20,
      };
    case 'fastball':
      return {
        ...POSE_LIBRARY['pitching_follow'],
        rightArm: 15,   // full extension follow-through
        torsoLean: -35,
        leftLeg: -30,
      };
    case 'changeup':
      return {
        ...POSE_LIBRARY['pitching_follow'],
        rightArm: 25,
        torsoLean: -30,
        headTilt: -10,
      };
    case 'slider':
      return {
        ...POSE_LIBRARY['pitching_follow'],
        rightArm: 35,   // sweeping motion
        leftArm: -25,
        torsoLean: -32,
      };
    case 'splitter':
      return {
        ...POSE_LIBRARY['pitching_follow'],
        rightArm: 20,
        torsoLean: -38,
        headTilt: -18,
      };
    default:
      return { ...POSE_LIBRARY['pitching_follow'] };
  }
}

// ── Main export ───────────────────────────────────────────────────────────

/**
 * Animate a full pitcher windup and delivery.
 * - onRelease fires at ~500ms (ball leaves hand)
 * - onComplete fires when follow-through is done (~800ms total)
 */
export function animateWindup(
  figure: PlayerFigure,
  pitchType: string,
  onRelease: () => void,
  onComplete: () => void,
): void {
  const followPose = getFollowThroughPose(pitchType);

  // Build delivery pose with slight pitch-type variation
  const deliveryPose: PoseData = { ...POSE_LIBRARY['pitching_delivery'] };
  if (pitchType === 'curveball') {
    deliveryPose.rightArm = -85;
    deliveryPose.torsoLean = -35;
  }

  // Keyframe sequence: ~800ms total
  const kfs: Keyframe[] = [
    // 1. Stand upright → windup arms come up (150ms)
    { pose: POSE_LIBRARY['pitching_windup'], durationMs: 150, easeFn: easeInOut },
    // 2. Windup → leg kick (200ms)
    { pose: POSE_LIBRARY['pitching_kick'], durationMs: 200, easeFn: easeOut },
    // 3. Leg kick → delivery stride (150ms) — ball releases at end of this
    { pose: deliveryPose, durationMs: 150, easeFn: easeIn },
    // 4. Delivery → follow through (300ms)
    { pose: followPose, durationMs: 300, easeFn: easeOut },
  ];

  // Track time to fire onRelease at ~500ms (after first 3 keyframes: 150+200+150=500ms)
  let totalElapsed = 0;
  let releaseFired = false;
  const RELEASE_MS = 490;

  const ticker = Ticker.shared;

  let idx = 0;
  let elapsed = 0;
  let fromPose = figure.getPoseData();

  const onTick = (t: Ticker) => {
    totalElapsed += t.deltaMS;

    // Fire release callback
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

    const interp = interpolatePose(fromPose, kf.pose, easedT);
    figure.applyPoseData(interp);

    if (rawT >= 1) {
      fromPose = { ...kf.pose };
      elapsed = 0;
      idx++;
    }
  };

  ticker.add(onTick);
}

/**
 * Quick idle pitching "set" pose — pitcher stands on the rubber.
 */
export function animatePitcherSet(figure: PlayerFigure): void {
  runKeyframes(figure, [
    { pose: POSE_LIBRARY['standing'], durationMs: 200 },
    { pose: POSE_LIBRARY['ready'], durationMs: 300 },
  ]);
}

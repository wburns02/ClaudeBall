// ── BatterAnimation.ts ────────────────────────────────────────────────────
// Batting stance, swing, take, bunt, and reaction animations.

import { Ticker } from 'pixi.js';
import type { PlayerFigure } from './PlayerFigure.ts';
import { POSE_LIBRARY, interpolatePose, easeIn, easeOut, easeInOut } from './AnimationKeyframes.ts';
import type { PoseData } from './AnimationKeyframes.ts';

// ── Helper: sequenced keyframe runner with callback at a specific time ─────

function runKeyframesWithCallback(
  figure: PlayerFigure,
  keyframes: Array<{ pose: PoseData; durationMs: number; easeFn?: (t: number) => number }>,
  callbackMs: number,
  callback: (() => void) | null,
  onComplete?: () => void,
): void {
  let totalElapsed = 0;
  let cbFired = false;
  let idx = 0;
  let elapsed = 0;
  let fromPose = figure.getPoseData();

  const ticker = Ticker.shared;

  const onTick = (t: Ticker) => {
    totalElapsed += t.deltaMS;

    if (!cbFired && callback && totalElapsed >= callbackMs) {
      cbFired = true;
      callback();
    }

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

// ── Swing variations by timing ─────────────────────────────────────────────

function getSwingKeyframes(
  timing: string,
): Array<{ pose: PoseData; durationMs: number; easeFn?: (t: number) => number }> {
  const base = [
    // Load / coil (60ms)
    {
      pose: { ...POSE_LIBRARY['batting_swing_1'] },
      durationMs: 60,
      easeFn: easeIn,
    },
    // Stride / swing comes through zone (150ms)
    {
      pose: { ...POSE_LIBRARY['batting_swing_2'] },
      durationMs: 150,
      easeFn: easeIn,
    },
    // Follow through (200ms)
    {
      pose: { ...POSE_LIBRARY['batting_swing_3'] },
      durationMs: 200,
      easeFn: easeOut,
    },
    // Return to stance (120ms)
    {
      pose: { ...POSE_LIBRARY['batting_stance'] },
      durationMs: 120,
      easeFn: easeInOut,
    },
  ];

  if (timing === 'early') {
    // Rushed swing — faster load, arms pull through early
    return [
      { pose: { ...POSE_LIBRARY['batting_swing_1'], leftArm: -70 }, durationMs: 40, easeFn: easeIn },
      { pose: { ...POSE_LIBRARY['batting_swing_2'], rightLeg: -10 }, durationMs: 110, easeFn: easeIn },
      { pose: { ...POSE_LIBRARY['batting_swing_3'] }, durationMs: 220, easeFn: easeOut },
      { pose: { ...POSE_LIBRARY['batting_stance'] }, durationMs: 130, easeFn: easeInOut },
    ];
  }

  if (timing === 'late') {
    // Reaching swing — slower start, lunging finish
    return [
      { pose: { ...POSE_LIBRARY['batting_swing_1'] }, durationMs: 80, easeFn: easeInOut },
      { pose: { ...POSE_LIBRARY['batting_swing_2'], torsoLean: -30, leftLeg: -35 }, durationMs: 180, easeFn: easeIn },
      { pose: { ...POSE_LIBRARY['batting_swing_3'], torsoLean: -25 }, durationMs: 190, easeFn: easeOut },
      { pose: { ...POSE_LIBRARY['batting_stance'] }, durationMs: 120, easeFn: easeInOut },
    ];
  }

  return base;
}

// ── Exports ───────────────────────────────────────────────────────────────

/**
 * Set batting stance pose instantly.
 */
export function animateStance(figure: PlayerFigure): void {
  figure.setPose('batting_stance');

  // Mirror for right-handed batter facing pitcher (toward left)
  if (!figure.isLeftHanded) {
    figure.setFacing('left');
  } else {
    figure.setFacing('right');
  }
}

/**
 * Swing animation.
 * - onContact fires at ~300ms (bat-ball contact point)
 * - onComplete fires when swing finishes (~500ms)
 * - timing: 'perfect' | 'early' | 'late'
 */
export function animateSwing(
  figure: PlayerFigure,
  timing: string,
  onContact: () => void,
  onComplete: () => void,
): void {
  const kfs = getSwingKeyframes(timing);
  // Contact fires at ~310ms (after load 60ms + partial through-zone 150ms + buffer)
  const contactMs = timing === 'early' ? 220 : timing === 'late' ? 340 : 300;
  runKeyframesWithCallback(figure, kfs, contactMs, onContact, onComplete);
}

/**
 * Take animation — watch the pitch go by, slight shoulder check.
 */
export function animateTake(
  figure: PlayerFigure,
  onComplete: () => void,
): void {
  const watchPose: PoseData = {
    ...POSE_LIBRARY['batting_stance'],
    headTilt: 5,
    torsoLean: -3,
  };

  runKeyframesWithCallback(
    figure,
    [
      { pose: watchPose, durationMs: 200, easeFn: easeInOut },
      { pose: { ...POSE_LIBRARY['batting_stance'] }, durationMs: 250, easeFn: easeOut },
    ],
    9999,
    null,
    onComplete,
  );
}

/**
 * Bunt animation — square up, short push.
 */
export function animateBunt(
  figure: PlayerFigure,
  onComplete: () => void,
): void {
  const squaredPose: PoseData = {
    leftArm: -60,
    rightArm: -55,
    leftLeg: -5,
    rightLeg: 5,
    torsoLean: -5,
    headTilt: -5,
  };

  const pushPose: PoseData = {
    leftArm: -50,
    rightArm: -45,
    leftLeg: -10,
    rightLeg: 8,
    torsoLean: -8,
    headTilt: -5,
  };

  runKeyframesWithCallback(
    figure,
    [
      { pose: squaredPose, durationMs: 180, easeFn: easeInOut },
      { pose: pushPose, durationMs: 120, easeFn: easeOut },
      { pose: { ...POSE_LIBRARY['batting_stance'] }, durationMs: 200, easeFn: easeInOut },
    ],
    9999,
    null,
    onComplete,
  );
}

/**
 * Strikeout reaction — head drop, bat drag, dejected posture.
 */
export function animateStrikeoutReaction(figure: PlayerFigure): void {
  const slumpPose: PoseData = {
    ...POSE_LIBRARY['strikeout_reaction'],
  };

  runKeyframesWithCallback(
    figure,
    [
      { pose: slumpPose, durationMs: 400, easeFn: easeOut },
      { pose: { ...POSE_LIBRARY['standing'] }, durationMs: 600, easeFn: easeInOut },
    ],
    9999,
    null,
  );
}

/**
 * Home run trot — bat flip pose, then transition into jog.
 */
export function animateHRTrot(figure: PlayerFigure): void {
  // Bat flip pose (arms release upward)
  const flipPose: PoseData = {
    leftArm: -85,
    rightArm: -75,
    leftLeg: 0,
    rightLeg: 0,
    torsoLean: 15,
    headTilt: 20,
  };

  runKeyframesWithCallback(
    figure,
    [
      { pose: flipPose, durationMs: 250, easeFn: easeOut },
      { pose: { ...POSE_LIBRARY['hr_trot'] }, durationMs: 200, easeFn: easeInOut },
      { pose: { ...POSE_LIBRARY['running_1'] }, durationMs: 300, easeFn: easeInOut },
    ],
    9999,
    null,
  );
}

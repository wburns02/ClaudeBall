// ── FielderAnimation.ts ───────────────────────────────────────────────────
// Fielder movement and action animations.

import { Ticker } from 'pixi.js';
import type { PlayerFigure } from './PlayerFigure.ts';
import { POSE_LIBRARY, interpolatePose, easeIn, easeOut, easeInOut } from './AnimationKeyframes.ts';
import type { PoseData } from './AnimationKeyframes.ts';

// ── Internal sequencer ────────────────────────────────────────────────────

function runKeyframes(
  figure: PlayerFigure,
  keyframes: Array<{ pose: PoseData; durationMs: number; easeFn?: (t: number) => number }>,
  onComplete?: () => void,
): () => void {
  let idx = 0;
  let elapsed = 0;
  let fromPose = figure.getPoseData();
  let removed = false;

  const ticker = Ticker.shared;

  const onTick = (t: Ticker) => {
    if (removed) return;

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

  return () => {
    removed = true;
    ticker.remove(onTick);
  };
}

// ── Exports ───────────────────────────────────────────────────────────────

/**
 * Animate a fielder running from one position to another.
 * Alternates running_1 / running_2 poses while moving the container.
 */
export function animateRunToPosition(
  figure: PlayerFigure,
  from: { x: number; y: number },
  to: { x: number; y: number },
  speed: number,  // 1-100
  onComplete: () => void,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Duration: speed 50 → 500ms per 120px; range ~300-700ms per 120px
  const msPerPx = (700 - (speed / 100) * 400) / 120;
  const durationMs = Math.max(150, dist * msPerPx);

  // Face the direction of movement
  if (dx > 0) {
    figure.setFacing('right');
  } else if (dx < 0) {
    figure.setFacing('left');
  }

  figure.setPosition(from.x, from.y);

  // Running stride cycle: alternate poses
  const strideCycleMs = 250; // one full stride cycle
  let legPhase: 0 | 1 = 0;

  const runPoses = [POSE_LIBRARY['running_1'], POSE_LIBRARY['running_2']];
  let legElapsed = 0;
  let fromLegPose = figure.getPoseData();
  let totalElapsed = 0;

  const ticker = Ticker.shared;

  const onTick = (t: Ticker) => {
    totalElapsed += t.deltaMS;
    legElapsed += t.deltaMS;

    const moveT = Math.min(totalElapsed / durationMs, 1);
    const ease = easeInOut(moveT);

    // Move position
    figure.setPosition(
      from.x + dx * ease,
      from.y + dy * ease,
    );

    // Cycle leg/arm poses
    const halfCycle = strideCycleMs / 2;
    if (legElapsed >= halfCycle) {
      legElapsed -= halfCycle;
      legPhase = legPhase === 0 ? 1 : 0;
      fromLegPose = figure.getPoseData();
    }

    const legT = easeInOut(legElapsed / halfCycle);
    const interp = interpolatePose(fromLegPose, runPoses[legPhase], legT);
    figure.applyPoseData(interp);

    if (moveT >= 1) {
      ticker.remove(onTick);
      figure.setPose('fielding_ready');
      onComplete();
    }
  };

  ticker.add(onTick);
}

/**
 * Animate a catch — glove snaps up, brief hold, return to ready.
 */
export function animateCatch(
  figure: PlayerFigure,
  onComplete: () => void,
): void {
  runKeyframes(
    figure,
    [
      { pose: POSE_LIBRARY['catching'], durationMs: 120, easeFn: easeOut },
      { pose: POSE_LIBRARY['catching'], durationMs: 150 }, // hold
      { pose: POSE_LIBRARY['fielding_ready'], durationMs: 200, easeFn: easeOut },
    ],
    onComplete,
  );
}

/**
 * Animate a crow-hop + throw.
 * - onRelease fires when arm extends (ball leaves hand)
 */
export function animateThrow(
  figure: PlayerFigure,
  direction: 'left' | 'right' | 'up',
  onRelease: () => void,
  onComplete: () => void,
): void {
  figure.setFacing(direction === 'left' ? 'left' : 'right');

  const throwPose: PoseData = { ...POSE_LIBRARY['throwing'] };
  const releasePose: PoseData = {
    ...POSE_LIBRARY['throwing'],
    rightArm: -80,
    torsoLean: -30,
  };

  let releaseFired = false;
  let totalElapsed = 0;
  const RELEASE_MS = 200;

  const kfs = [
    // Gather / wind up
    { pose: { ...POSE_LIBRARY['fielding_ready'], rightArm: 50 }, durationMs: 120, easeFn: easeInOut },
    // Arm back
    { pose: throwPose, durationMs: 100, easeFn: easeIn },
    // Arm fires forward
    { pose: releasePose, durationMs: 100, easeFn: easeIn },
    // Follow through
    { pose: { ...POSE_LIBRARY['throwing'], rightArm: 20, torsoLean: -35 }, durationMs: 180, easeFn: easeOut },
    // Return to ready
    { pose: POSE_LIBRARY['fielding_ready'], durationMs: 200, easeFn: easeInOut },
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

/**
 * Dive animation — body goes horizontal, arm/glove extended.
 */
export function animateDive(
  figure: PlayerFigure,
  direction: 'left' | 'right',
  onComplete: () => void,
): void {
  const divePose = direction === 'left'
    ? POSE_LIBRARY['dive_left']
    : POSE_LIBRARY['dive_right'];

  figure.setFacing(direction);

  runKeyframes(
    figure,
    [
      // Launch into dive
      { pose: divePose, durationMs: 200, easeFn: easeIn },
      // Hold extended
      { pose: divePose, durationMs: 300 },
      // Get up slowly
      { pose: POSE_LIBRARY['fielding_ready'], durationMs: 500, easeFn: easeOut },
    ],
    onComplete,
  );
}

/**
 * Set fielding ready crouch pose.
 */
export function animateReadyPosition(figure: PlayerFigure): void {
  runKeyframes(figure, [
    { pose: POSE_LIBRARY['fielding_ready'], durationMs: 200, easeFn: easeInOut },
  ]);
}

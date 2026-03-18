// ── RunnerAnimation.ts ────────────────────────────────────────────────────
// Base runner animations: running bases, sliding, leadoff, return to base.

import { Ticker } from 'pixi.js';
import type { PlayerFigure } from './PlayerFigure.ts';
import { POSE_LIBRARY, interpolatePose, easeInOut, easeOut } from './AnimationKeyframes.ts';
import type { PoseData } from './AnimationKeyframes.ts';

// ── Coordinate constants (mirror DiamondRenderer) ─────────────────────────

const HOME_X = 300;
const HOME_Y = 420;
const BASE_1_X = 420;
const BASE_1_Y = 300;
const BASE_2_X = 300;
const BASE_2_Y = 190;
const BASE_3_X = 180;
const BASE_3_Y = 300;

const BASE_COORDS: Record<number, { x: number; y: number }> = {
  0: { x: HOME_X, y: HOME_Y },
  1: { x: BASE_1_X, y: BASE_1_Y },
  2: { x: BASE_2_X, y: BASE_2_Y },
  3: { x: BASE_3_X, y: BASE_3_Y },
};

// ── Basepath waypoints ────────────────────────────────────────────────────

function buildWaypoints(
  fromBase: number,
  toBase: number,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const start = fromBase % 4;
  const end = toBase % 4;
  let cur = start;
  while (cur !== end) {
    const next = (cur + 1) % 4;
    pts.push(BASE_COORDS[next]!);
    cur = next;
    if (cur === end) break;
  }
  return pts.length > 0 ? pts : [BASE_COORDS[end]!];
}

// ── Internal: run segment-by-segment along waypoints ─────────────────────

function runAlongWaypoints(
  figure: PlayerFigure,
  startPos: { x: number; y: number },
  waypoints: Array<{ x: number; y: number }>,
  msPerBase: number,
  onComplete?: () => void,
): void {
  const strideCycleMs = 230;

  let wpIdx = 0;
  let segElapsed = 0;
  let legElapsed = 0;
  let legPhase: 0 | 1 = 0;
  let segFrom = { ...startPos };
  let fromLegPose = figure.getPoseData();
  const runPoses = [POSE_LIBRARY['running_1'], POSE_LIBRARY['running_2']];

  // Distance for first segment
  const firstTarget = waypoints[0] ?? startPos;
  const firstDx = firstTarget.x - segFrom.x;
  const firstDy = firstTarget.y - segFrom.y;
  const firstDist = Math.sqrt(firstDx * firstDx + firstDy * firstDy);
  let segDuration = Math.max(150, msPerBase * (firstDist / 120));

  const ticker = Ticker.shared;

  const onTick = (t: Ticker) => {
    segElapsed += t.deltaMS;
    legElapsed += t.deltaMS;

    const target = waypoints[wpIdx];
    if (!target) {
      ticker.remove(onTick);
      figure.setPose('ready');
      onComplete?.();
      return;
    }

    // Move along segment
    const moveT = Math.min(segElapsed / segDuration, 1);
    const ease = easeInOut(moveT);

    figure.setPosition(
      segFrom.x + (target.x - segFrom.x) * ease,
      segFrom.y + (target.y - segFrom.y) * ease,
    );

    // Face direction of travel
    const dx = target.x - segFrom.x;
    if (Math.abs(dx) > 5) {
      figure.setFacing(dx > 0 ? 'right' : 'left');
    }

    // Running pose cycle
    const halfCycle = strideCycleMs / 2;
    if (legElapsed >= halfCycle) {
      legElapsed -= halfCycle;
      legPhase = legPhase === 0 ? 1 : 0;
      fromLegPose = figure.getPoseData();
    }

    const legT = easeInOut(legElapsed / halfCycle);
    figure.applyPoseData(interpolatePose(fromLegPose, runPoses[legPhase], legT));

    if (moveT >= 1) {
      segFrom = { ...target };
      segElapsed = 0;
      wpIdx++;

      const nextTarget = waypoints[wpIdx];
      if (nextTarget) {
        const ndx = nextTarget.x - segFrom.x;
        const ndy = nextTarget.y - segFrom.y;
        const ndist = Math.sqrt(ndx * ndx + ndy * ndy);
        segDuration = Math.max(150, msPerBase * (ndist / 120));
      }
    }
  };

  ticker.add(onTick);
}

// ── Exports ───────────────────────────────────────────────────────────────

/**
 * Animate a runner advancing along the basepaths.
 */
export function animateRunBases(
  figure: PlayerFigure,
  fromBase: number,
  toBase: number,
  speed: number,  // 1-100
  onComplete: () => void,
): void {
  const waypoints = buildWaypoints(fromBase, toBase);
  const msPerBase = 500 - (speed / 100) * 200;

  const startPos = BASE_COORDS[fromBase % 4] ?? { x: HOME_X, y: HOME_Y };
  figure.setPosition(startPos.x, startPos.y);

  // If going all the way home (toBase >= 4), do score animation at end
  const finalWaypoints = toBase >= 4
    ? [...waypoints]
    : waypoints;

  runAlongWaypoints(figure, startPos, finalWaypoints, msPerBase, () => {
    if (toBase >= 4) {
      // Score — pulse and fade
      animateScore(figure, onComplete);
    } else {
      onComplete();
    }
  });
}

/**
 * Animate runner crossing home plate (fade out celebration).
 */
export function animateScore(figure: PlayerFigure, onComplete?: () => void): void {
  let elapsed = 0;
  const durationMs = 500;

  const ticker = Ticker.shared;
  const container = figure.getContainer();

  const onTick = (t: Ticker) => {
    elapsed += t.deltaMS;
    const progress = Math.min(elapsed / durationMs, 1);
    const ease = easeOut(progress);

    container.alpha = 1 - ease;
    container.scale.set(1 + ease * 1.5);

    if (progress >= 1) {
      ticker.remove(onTick);
      container.visible = false;
      container.alpha = 1;
      container.scale.set(1);
      onComplete?.();
    }
  };

  ticker.add(onTick);
}

/**
 * Animate feet-first slide into base.
 */
export function animateSlide(
  figure: PlayerFigure,
  onComplete: () => void,
): void {
  const slidePose: PoseData = { ...POSE_LIBRARY['slide'] };

  // Quick slide — body drops forward
  let elapsed = 0;
  const durationMs = 350;
  const fromPose = figure.getPoseData();

  const ticker = Ticker.shared;

  const onTick = (t: Ticker) => {
    elapsed += t.deltaMS;
    const rawT = Math.min(elapsed / durationMs, 1);
    const easedT = easeOut(rawT);

    figure.applyPoseData(interpolatePose(fromPose, slidePose, easedT));

    // Also tilt the whole container forward during the slide
    const container = figure.getContainer();
    container.rotation = easedT * 0.6; // lean forward ~35 degrees

    if (rawT >= 1) {
      ticker.remove(onTick);
      // Hold at base briefly, then stand
      setTimeout(() => {
        container.rotation = 0;
        figure.setPose('standing');
        onComplete();
      }, 300);
    }
  };

  ticker.add(onTick);
}

/**
 * Animate leadoff — take a few steps off the base.
 */
export function animateLeadoff(figure: PlayerFigure, base: number): void {
  const baseCoord = BASE_COORDS[base % 4] ?? { x: HOME_X, y: HOME_Y };
  const nextCoord = BASE_COORDS[(base + 1) % 4] ?? { x: HOME_X, y: HOME_Y };

  const dx = nextCoord.x - baseCoord.x;
  const dy = nextCoord.y - baseCoord.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const LEADOFF_FRACTION = 0.12; // ~10-12% toward next base

  const leadX = baseCoord.x + dx * LEADOFF_FRACTION;
  const leadY = baseCoord.y + dy * LEADOFF_FRACTION;

  // Move to lead position, set ready pose
  let elapsed = 0;
  const durationMs = 400;
  const startX = figure.getContainer().x;
  const startY = figure.getContainer().y;

  if (dist > 0 && dx !== 0) {
    figure.setFacing(dx > 0 ? 'right' : 'left');
  }

  const ticker = Ticker.shared;

  const onTick = (t: Ticker) => {
    elapsed += t.deltaMS;
    const rawT = Math.min(elapsed / durationMs, 1);
    const ease = easeInOut(rawT);

    figure.setPosition(
      startX + (leadX - startX) * ease,
      startY + (leadY - startY) * ease,
    );

    if (rawT >= 1) {
      ticker.remove(onTick);
      figure.setPose('lead_off');
    }
  };

  ticker.add(onTick);
}

/**
 * Animate runner diving back to base (pickoff attempt).
 */
export function animateReturnToBase(
  figure: PlayerFigure,
  base: number,
  onComplete: () => void,
): void {
  const targetCoord = BASE_COORDS[base % 4] ?? { x: HOME_X, y: HOME_Y };

  const fromX = figure.getContainer().x;
  const fromY = figure.getContainer().y;
  const dx = targetCoord.x - fromX;

  figure.setFacing(dx > 0 ? 'right' : 'left');

  let elapsed = 0;
  const durationMs = 250;
  const divePose: PoseData = { ...POSE_LIBRARY['dive_back'] };
  const fromPose = figure.getPoseData();

  const ticker = Ticker.shared;

  const onTick = (t: Ticker) => {
    elapsed += t.deltaMS;
    const rawT = Math.min(elapsed / durationMs, 1);
    const ease = easeInOut(rawT);

    figure.setPosition(
      fromX + (targetCoord.x - fromX) * ease,
      fromY + (targetCoord.y - fromY) * ease,
    );

    figure.applyPoseData(interpolatePose(fromPose, divePose, ease));

    if (rawT >= 1) {
      ticker.remove(onTick);
      figure.setPose('standing');
      onComplete();
    }
  };

  ticker.add(onTick);
}

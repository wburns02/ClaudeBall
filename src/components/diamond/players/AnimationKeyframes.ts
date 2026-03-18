// ── AnimationKeyframes.ts ─────────────────────────────────────────────────
// Central keyframe definitions for all player poses.
// Angles are in degrees relative to body center:
//   0   = limb hanging straight down
//   -90 = limb pointing forward (toward viewer / "out in front")
//   +90 = limb pointing back
//   For arms: negative = forward/up, positive = back/down

export interface PoseData {
  leftArm: number;    // degrees, 0=down, -90=forward/up, +90=back
  rightArm: number;
  leftLeg: number;    // degrees, 0=down, -30=forward stride, +30=back
  rightLeg: number;
  torsoLean: number;  // degrees, 0=upright, negative=lean forward, positive=lean back
  headTilt: number;   // degrees, 0=neutral, negative=look down, positive=look up
}

// ── Easing functions ──────────────────────────────────────────────────────

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeIn(t: number): number {
  return t * t * t;
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ── Pose interpolation ────────────────────────────────────────────────────

export function interpolatePose(from: PoseData, to: PoseData, t: number): PoseData {
  const lerp = (a: number, b: number) => a + (b - a) * t;
  return {
    leftArm: lerp(from.leftArm, to.leftArm),
    rightArm: lerp(from.rightArm, to.rightArm),
    leftLeg: lerp(from.leftLeg, to.leftLeg),
    rightLeg: lerp(from.rightLeg, to.rightLeg),
    torsoLean: lerp(from.torsoLean, to.torsoLean),
    headTilt: lerp(from.headTilt, to.headTilt),
  };
}

// ── Pose library ──────────────────────────────────────────────────────────

export const POSE_LIBRARY: Record<string, PoseData> = {
  standing: {
    leftArm: 10,
    rightArm: -10,
    leftLeg: 0,
    rightLeg: 0,
    torsoLean: 0,
    headTilt: 0,
  },

  ready: {
    leftArm: -25,
    rightArm: -25,
    leftLeg: -10,
    rightLeg: 10,
    torsoLean: -10,
    headTilt: -5,
  },

  running_1: {
    leftArm: -50,
    rightArm: 30,
    leftLeg: -35,
    rightLeg: 25,
    torsoLean: -15,
    headTilt: 0,
  },

  running_2: {
    leftArm: 30,
    rightArm: -50,
    leftLeg: 25,
    rightLeg: -35,
    torsoLean: -15,
    headTilt: 0,
  },

  fielding_ready: {
    leftArm: -30,
    rightArm: -30,
    leftLeg: -15,
    rightLeg: 15,
    torsoLean: -20,
    headTilt: -10,
  },

  catching: {
    leftArm: -70,
    rightArm: -40,
    leftLeg: -5,
    rightLeg: 5,
    torsoLean: -5,
    headTilt: -5,
  },

  throwing: {
    leftArm: -60,
    rightArm: 60,
    leftLeg: -20,
    rightLeg: 15,
    torsoLean: -20,
    headTilt: -5,
  },

  batting_stance: {
    leftArm: -55,
    rightArm: -75,
    leftLeg: -10,
    rightLeg: 10,
    torsoLean: -5,
    headTilt: -5,
  },

  batting_swing_1: {
    leftArm: -65,
    rightArm: -80,
    leftLeg: -20,
    rightLeg: 5,
    torsoLean: -10,
    headTilt: -5,
  },

  batting_swing_2: {
    leftArm: -80,
    rightArm: -20,
    leftLeg: -30,
    rightLeg: -5,
    torsoLean: -25,
    headTilt: -5,
  },

  batting_swing_3: {
    leftArm: 30,
    rightArm: -60,
    leftLeg: -20,
    rightLeg: -15,
    torsoLean: -20,
    headTilt: 5,
  },

  pitching_windup: {
    leftArm: -80,
    rightArm: -60,
    leftLeg: 0,
    rightLeg: 0,
    torsoLean: 5,
    headTilt: 0,
  },

  pitching_kick: {
    leftArm: -40,
    rightArm: -20,
    leftLeg: -60,
    rightLeg: 0,
    torsoLean: 10,
    headTilt: -5,
  },

  pitching_delivery: {
    leftArm: -50,
    rightArm: -90,
    leftLeg: -40,
    rightLeg: 30,
    torsoLean: -30,
    headTilt: -10,
  },

  pitching_follow: {
    leftArm: -30,
    rightArm: 20,
    leftLeg: -25,
    rightLeg: 20,
    torsoLean: -35,
    headTilt: -15,
  },

  crouch: {
    leftArm: -20,
    rightArm: -20,
    leftLeg: -25,
    rightLeg: 25,
    torsoLean: -25,
    headTilt: -10,
  },

  celebrating: {
    leftArm: -90,
    rightArm: -90,
    leftLeg: -15,
    rightLeg: 15,
    torsoLean: 10,
    headTilt: 15,
  },

  // Catcher-specific poses
  catcher_crouch: {
    leftArm: -50,
    rightArm: -60,
    leftLeg: -35,
    rightLeg: 35,
    torsoLean: -20,
    headTilt: -10,
  },

  catcher_receive: {
    leftArm: -70,
    rightArm: -70,
    leftLeg: -35,
    rightLeg: 35,
    torsoLean: -20,
    headTilt: -10,
  },

  catcher_throw: {
    leftArm: -50,
    rightArm: -85,
    leftLeg: -20,
    rightLeg: 10,
    torsoLean: -15,
    headTilt: -5,
  },

  // Umpire poses
  umpire_strike: {
    leftArm: -20,
    rightArm: -80,
    leftLeg: 0,
    rightLeg: 0,
    torsoLean: -10,
    headTilt: 5,
  },

  umpire_ball: {
    leftArm: -30,
    rightArm: -20,
    leftLeg: 0,
    rightLeg: 0,
    torsoLean: -5,
    headTilt: 0,
  },

  umpire_out: {
    leftArm: -20,
    rightArm: -65,
    leftLeg: 0,
    rightLeg: 0,
    torsoLean: -5,
    headTilt: 5,
  },

  umpire_safe: {
    leftArm: -85,
    rightArm: -85,
    leftLeg: 0,
    rightLeg: 0,
    torsoLean: -10,
    headTilt: 0,
  },

  // Runner slides
  slide: {
    leftArm: -30,
    rightArm: -50,
    leftLeg: 10,
    rightLeg: -15,
    torsoLean: -60,
    headTilt: 20,
  },

  lead_off: {
    leftArm: -20,
    rightArm: -20,
    leftLeg: -15,
    rightLeg: 10,
    torsoLean: -15,
    headTilt: -5,
  },

  dive_back: {
    leftArm: -70,
    rightArm: -80,
    leftLeg: 20,
    rightLeg: 40,
    torsoLean: -50,
    headTilt: 10,
  },

  // Strikeout reaction
  strikeout_reaction: {
    leftArm: 20,
    rightArm: 30,
    leftLeg: -5,
    rightLeg: 5,
    torsoLean: 15,
    headTilt: -20,
  },

  // HR trot
  hr_trot: {
    leftArm: 20,
    rightArm: -60,
    leftLeg: -20,
    rightLeg: 15,
    torsoLean: -5,
    headTilt: 5,
  },

  dive_left: {
    leftArm: -70,
    rightArm: -50,
    leftLeg: 10,
    rightLeg: 20,
    torsoLean: -50,
    headTilt: 5,
  },

  dive_right: {
    leftArm: -50,
    rightArm: -70,
    leftLeg: 20,
    rightLeg: 10,
    torsoLean: -50,
    headTilt: 5,
  },
};

export type PlayerPose = keyof typeof POSE_LIBRARY;

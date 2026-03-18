// ── SpriteConfig.ts ───────────────────────────────────────────────────────
// Configuration mapping sprite sheet image files to their frame grid layouts.
// All sprites are JPG files with gray/checkered backgrounds (not transparent).

export interface SpriteSheetConfig {
  url: string;
  cols: number;
  rows: number;
  /**
   * Fractional vertical trim applied to each frame after slicing.
   * trimTop: fraction of frame height to skip from the top (0–1).
   * trimBottom: fraction of frame height to keep from the top (0–1).
   * Example: trimTop=0.33, trimBottom=0.87 → use rows 33%–87% of each frame.
   * Defaults to trimTop=0, trimBottom=1 (full frame).
   */
  trimTop?: number;
  trimBottom?: number;
}

export const SPRITE_SHEETS: Record<string, SpriteSheetConfig> = {
  // Fielder: content rows 40%–74% of 720px frame
  batterSwing:       { url: '/sprites/batter-swing.jpg',         cols: 7, rows: 1, trimTop: 0.30, trimBottom: 0.88 },
  batterSwingAlt:    { url: '/sprites/batter-swing-alt.jpg',     cols: 5, rows: 1, trimTop: 0.30, trimBottom: 0.88 },
  // Pitcher: nearly full frame (content rows 3%–100%)
  pitcherWindup:     { url: '/sprites/pitcher-windup.jpg',       cols: 3, rows: 2, trimTop: 0.02, trimBottom: 1.00 },
  pitcherDelivery:   { url: '/sprites/pitcher-delivery.jpg',     cols: 3, rows: 2, trimTop: 0.02, trimBottom: 1.00 },
  // Fielder: content rows 38%–75% of 720px frame
  fielderActions:    { url: '/sprites/fielder-actions.jpg',      cols: 7, rows: 1, trimTop: 0.37, trimBottom: 0.76 },
  fielderActionsAlt: { url: '/sprites/fielder-actions-alt.jpg',  cols: 6, rows: 1, trimTop: 0.37, trimBottom: 0.76 },
  // Runner: content in bottom 30% of frame (rows 71%–100%)
  runnerRun:         { url: '/sprites/runner-run.jpg',           cols: 2, rows: 2, trimTop: 0.68, trimBottom: 1.00 },
  runnerSlide:       { url: '/sprites/runner-slide.jpg',         cols: 2, rows: 2, trimTop: 0.68, trimBottom: 1.00 },
  // Catcher/Umpire: full frame (content fills entire frame)
  catcherUmpire:     { url: '/sprites/catcher-umpire.jpg',       cols: 4, rows: 1, trimTop: 0.00, trimBottom: 1.00 },
  catcherUmpireAlt:  { url: '/sprites/catcher-umpire-alt.jpg',   cols: 4, rows: 1, trimTop: 0.00, trimBottom: 1.00 },
} as const;

export type SpriteSheetKey = keyof typeof SPRITE_SHEETS;

// ── Frame indices for semantic access ─────────────────────────────────────

/** Frame indices into batterSwing (7 frames) */
export const BATTER_FRAMES = {
  stance:        0,
  load:          1,
  stride:        2,
  contact:       3,
  followThrough: 4,
  batFlip:       5,
  running:       6,
} as const;

/** Frame indices into batterSwingAlt (5 frames) */
export const BATTER_ALT_FRAMES = {
  stance:        0,
  load:          1,
  contact:       2,
  followThrough: 3,
  running:       4,
} as const;

/**
 * Frame indices into pitcherWindup / pitcherDelivery (3x2 grid = 6 frames).
 * Grid is row-major: frame 0 = top-left, 1 = top-center, 2 = top-right,
 * 3 = bottom-left, 4 = bottom-center, 5 = bottom-right.
 */
export const PITCHER_FRAMES = {
  setPosition:   0,
  windup:        1,
  legKick:       2,
  stride:        3,
  release:       4,
  followThrough: 5,
} as const;

/** Frame indices into fielderActions (7 frames) */
export const FIELDER_FRAMES = {
  ready:         0,
  fielding:      1,
  scooping:      2,
  catchingFly:   3,
  fieldingGround:4,
  crowHop:       5,
  throwing:      6,
} as const;

/** Frame indices into fielderActionsAlt (6 frames) */
export const FIELDER_ALT_FRAMES = {
  ready:         0,
  fielding:      1,
  scooping:      2,
  catchingFly:   3,
  crowHop:       4,
  throwing:      5,
} as const;

/**
 * Frame indices into runnerRun / runnerSlide (2x2 grid = 4 frames).
 * Grid: 0 = top-left, 1 = top-right, 2 = bottom-left, 3 = bottom-right.
 */
export const RUNNER_RUN_FRAMES = {
  runA:          0,
  runB:          1,
  headfirstSlide:2,
  feetFirstSlide:3,
} as const;

export const RUNNER_SLIDE_FRAMES = {
  running:       0,
  approaching:   1,
  headfirstDive: 2,
  sliding:       3,
} as const;

/** Frame indices into catcherUmpire (4 frames) */
export const CATCHER_UMPIRE_FRAMES = {
  catcherCrouch:  0,
  catcherReceive: 1,
  umpireStanding: 2,
  umpireStrike:   3,
} as const;

/** Frame indices into catcherUmpireAlt (4 frames) */
export const CATCHER_UMPIRE_ALT_FRAMES = {
  catcherCrouch:  0,
  catcherReach:   1,
  umpireStand:    2,
  umpirePunchOut: 3,
} as const;

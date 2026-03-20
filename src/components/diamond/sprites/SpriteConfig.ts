// ── SpriteConfig.ts ───────────────────────────────────────────────────────
// Configuration mapping sprite sheet image files to their frame grid layouts.
// Legacy sprites are JPG files with gray/checkered backgrounds.
// V2 sprites are PNG files with solid #00FF00 green chroma-key backgrounds.

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

  // ── V2 sprites: solid #00FF00 green chroma-key backgrounds ──────────────
  // These are PNG files; BackgroundRemover will use green-screen removal.
  pitcherV2:         { url: '/sprites/pitcher32bit.png',         cols: 4, rows: 4 },
  batterV2:          { url: '/sprites/batter-v2.png',            cols: 4, rows: 3 },
  fielderV2:         { url: '/sprites/fielder32bit.png',         cols: 4, rows: 4 },
  runnerV2:          { url: '/sprites/runner-v2.png',            cols: 2, rows: 4 },
  catcherUmpireV2:   { url: '/sprites/catcher-umpire-v2.png',    cols: 4, rows: 2, trimTop: 0.08, trimBottom: 1.0 },

  // ── Scene / environment assets ───────────────────────────────────────────
  // stadium1.png — panoramic stadium background (NOT green-screened, use as-is)
  stadium:           { url: '/sprites/stadium1.png',             cols: 1, rows: 1 },
  // weather1.png — 2×2 grid: clear day, sunset, night, overcast (NOT green-screened)
  weather:           { url: '/sprites/weather1.png',             cols: 2, rows: 2 },
  // scoreboard.png — retro scoreboard on green (#00FF00) background (IS green-screened)
  scoreboard:        { url: '/sprites/scoreboard.png',           cols: 1, rows: 1 },
  // homerun1.png — 3×2 grid celebration frames on green background (IS green-screened)
  homerunEffects:    { url: '/sprites/homerun1.png',             cols: 3, rows: 2 },
  // dirtdust2.png — irregular dust effects on green background (IS green-screened)
  dirtDust:          { url: '/sprites/dirtdust2.png',            cols: 1, rows: 1 },
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

// ── V2 frame indices ───────────────────────────────────────────────────────

/**
 * Frame indices into pitcherV2 (4x3 grid = 12 frames, row-major).
 * Full windup sequence: standing → set → windupStart → … → fieldingReady
 */
export const PITCHER_V2_FRAMES = {
  standing:       0,
  set:            1,
  windupStart:    2,
  windupPeak:     3,
  legKick:        4,
  stride:         5,
  armCocked:      6,
  armForward:     7,
  release:        8,
  followThrough:  9,
  recovery:       10,
  fieldingReady:  11,
} as const;

/**
 * Frame indices into batterV2 (4x3 grid = 12 frames, row-major).
 * Full swing + run sequence.
 */
export const BATTER_V2_FRAMES = {
  stance:         0,
  loaded:         1,
  strideBegin:    2,
  hipsRotate:     3,
  batEntering:    4,
  contact:        5,
  followStart:    6,
  followFull:     7,
  watching:       8,
  dropBat:        9,
  running1:       10,
  running2:       11,
} as const;

/**
 * Frame indices into fielderV2 (4x3 grid = 12 frames, row-major).
 * Fielding actions (frames have small overlaid number labels — visible at game scale but acceptable).
 */
export const FIELDER_V2_FRAMES = {
  ready:          0,
  shuffleLeft:    1,
  shuffleRight:   2,
  runForward:     3,
  runCycle2:      4,
  bendGrounder:   5,
  scooping:       6,
  standingUp:     7,
  crowHop:        8,
  throwing:       9,
  throwFollow:    10,
  catchFly:       11,
} as const;

/**
 * Frame indices into runnerV2 (2x4 grid = 8 frames, row-major).
 * Running and sliding sequence.
 */
export const RUNNER_V2_FRAMES = {
  run1:           0,
  run2:           1,
  run3:           2,
  run4:           3,
  slideStart:     4,
  feetSlide:      5,
  headfirstDive:  6,
  standingOnBase: 7,
} as const;

/**
 * Frame indices into catcherUmpireV2 (4x2 grid = 8 frames, row-major).
 * Catcher crouch/receive/throw + umpire stand/strike/ball/out.
 */
export const CATCHER_UMP_V2_FRAMES = {
  catcherSquat:       0,
  catcherReachLeft:   1,
  catcherReachRight:  2,
  catcherThrow:       3,
  umpireStanding:     4,
  umpireStrike:       5,
  umpireBall:         6,
  umpireOut:          7,
} as const;

// ── Environment / scene asset frame indices ─────────────────────────────────

/**
 * Frame indices into weather (2×2 grid = 4 frames, row-major).
 * 0 = clear day (top-left), 1 = sunset (top-right),
 * 2 = night (bottom-left), 3 = overcast (bottom-right).
 */
export const WEATHER_FRAMES = {
  day:      0,
  sunset:   1,
  night:    2,
  overcast: 3,
} as const;

export type WeatherType = keyof typeof WEATHER_FRAMES;

/**
 * Frame indices into homerunEffects (3×2 grid = 6 frames, row-major).
 * 0 = gold firework, 1 = red/blue firework, 2 = confetti,
 * 3 = star burst, 4 = crowd wave, 5 = "HOME RUN!" text.
 */
export const HOMERUN_EFFECT_FRAMES = {
  goldFirework:   0,
  colorFirework:  1,
  confetti:       2,
  starBurst:      3,
  crowdWave:      4,
  homeRunText:    5,
} as const;

/**
 * Manually-defined crop rects for dirtdust2.png (irregular layout, NOT a grid).
 * Each rect is [x, y, w, h] in pixels — tweak after visual inspection.
 * These are approximate based on the described layout (scattered effects on green bg).
 */
export const DUST_CROP_RECTS = {
  // Top row: small puff (top-left), medium puff (top-center), large explosion (top-right)
  smallPuff:      { x: 0,   y: 0,   w: 200, h: 200 },
  mediumPuff:     { x: 200, y: 0,   w: 200, h: 200 },
  largeExplosion: { x: 400, y: 0,   w: 200, h: 200 },
  // Middle row: dirt spray (middle-left)
  dirtSpray:      { x: 0,   y: 200, w: 200, h: 200 },
} as const;

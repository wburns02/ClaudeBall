// ── SpritePlayerScene.ts ──────────────────────────────────────────────────
// Sprite-based replacement for PlayerScene. Uses AI-generated sprite sheet
// images sliced from JPG files with background removal applied.

import type { Application } from 'pixi.js';
import { Container, Ticker } from 'pixi.js';
import { SpriteAnimator } from './SpriteAnimator.ts';
import { loadSheet } from './SpriteSheetLoader.ts';
import {
  SPRITE_SHEETS,
  BATTER_FRAMES,
  PITCHER_FRAMES,
  FIELDER_FRAMES,
  RUNNER_RUN_FRAMES,
  RUNNER_SLIDE_FRAMES,
  CATCHER_UMPIRE_FRAMES,
  CATCHER_UMPIRE_ALT_FRAMES,
} from './SpriteConfig.ts';
import type { Texture } from 'pixi.js';

// ── Coordinate constants (mirror DiamondRenderer) ─────────────────────────

const HOME_X = 300;
const HOME_Y = 420;
const BASE_1_X = 420;
const BASE_1_Y = 300;
const BASE_2_X = 300;
const BASE_2_Y = 190;
const BASE_3_X = 180;
const BASE_3_Y = 300;
const MOUND_X = 300;
const MOUND_Y = 310;

// ── Default fielder positions ──────────────────────────────────────────────

const FIELDER_DEFAULTS: Record<string, { x: number; y: number }> = {
  P:    { x: MOUND_X, y: MOUND_Y },
  C:    { x: HOME_X, y: HOME_Y + 25 },
  '1B': { x: 410, y: 295 },
  '2B': { x: 355, y: 240 },
  SS:   { x: 245, y: 240 },
  '3B': { x: 190, y: 295 },
  LF:   { x: 130, y: 150 },
  CF:   { x: 300, y: 90 },
  RF:   { x: 470, y: 150 },
};

// ── Perspective scale factors ──────────────────────────────────────────────
// Batter/Catcher/Umpire = largest (closest to camera, scale 1.0 reference)
// Pitcher = ~75% of batter
// Infielders = ~65% of batter
// Outfielders = ~45% of batter
//
// After trim the effective content heights (in source pixels) are approx:
//   Fielder (trimTop=0.37, trimBottom=0.76): 720 * 0.39 ≈ 281px
//   Batter  (trimTop=0.30, trimBottom=0.88): 720 * 0.58 ≈ 418px
//   Pitcher (trimTop=0.02, trimBottom=1.00): 584 * 0.98 ≈ 572px
//   Catcher/Umpire alt (full): 832px
//   Runner  (trimTop=0.68, trimBottom=1.00): 360 * 0.32 ≈ 115px
//
// Target rendered heights:
//   Batter  ~80px → scale = 80/418 ≈ 0.191
//   Pitcher ~65px → scale = 65/572 ≈ 0.114
//   Infield ~55px → scale = 55/281 ≈ 0.196
//   Outfield~38px → scale = 38/281 ≈ 0.135
//   Catcher ~68px → scale = 68/832 ≈ 0.082  (catcherUmpireAlt full frame)
//   Umpire  ~68px → scale = 68/832 ≈ 0.082
//   Runner  ~40px → scale = 40/115 ≈ 0.348

const FIELDER_SCALES: Record<string, number> = {
  P:    0.114,   // pitcher: far-ish → 65px rendered height
  C:    0.082,   // catcher uses catcherUmpire sheet (832px frame) → 68px
  '1B': 0.196,   // infielder 281px → 55px
  '2B': 0.178,   // slightly smaller — further from camera
  SS:   0.178,
  '3B': 0.196,
  LF:   0.135,   // outfielder 281px → 38px
  CF:   0.124,   // CF furthest back
  RF:   0.135,
};

const BATTER_SCALE  = 0.191; // 418px → ~80px
const UMPIRE_SCALE  = 0.082; // 832px → ~68px
const RUNNER_SCALE  = 0.348; // 115px → ~40px

// ── Facing / flip rules ───────────────────────────────────────────────────
// Sprite sheets are drawn facing LEFT by default (player faces left).
// To face right we flip horizontally (scale.x *= -1).
//
// Field perspective:
//   LF, 3B, SS → face right (toward infield) → flip = true
//   RF, 1B, 2B → face left  (toward infield) → flip = false (default)
//   CF → face down toward home → no flip (use default)
//   P  → faces home plate (faces down / toward camera) → no flip
//   C  → faces pitcher (faces up) → flip = false
//   Batter → faces pitcher → flip = false (right-handed default)

const FIELDER_FLIP: Record<string, boolean> = {
  P:    false,
  C:    false,
  '1B': false,  // right side → face left (default)
  '2B': false,  // right side → face left
  SS:   true,   // left side  → face right
  '3B': true,   // left side  → face right
  LF:   true,   // left side  → face right
  CF:   false,
  RF:   false,  // right side → face left
};

// ── SpritePlayerScene ─────────────────────────────────────────────────────

export class SpritePlayerScene {
  private layer: Container;

  // Loaded texture arrays
  private batterFrames: Texture[] = [];
  private pitcherFrames: Texture[] = [];
  private fielderFrames: Texture[] = [];
  private runnerFrames: Texture[] = [];
  private runnerSlideFrames: Texture[] = [];
  private catcherFrames: Texture[] = [];
  private catcherAltFrames: Texture[] = [];

  // Sprite animators
  private fielderSprites: Map<string, SpriteAnimator> = new Map();
  private runnerSprites: Map<number, SpriteAnimator> = new Map();
  private _batter: SpriteAnimator | null = null;
  private _pitcher: SpriteAnimator | null = null;
  private _catcher: SpriteAnimator | null = null;
  private _umpire: SpriteAnimator | null = null;

  private _loaded = false;
  private _destroyed = false;

  constructor() {
    this.layer = new Container();
  }

  // ── Initialization ─────────────────────────────────────────────────

  /**
   * Load all sprite sheets and initialize the scene.
   * Must be awaited before any other method is called.
   */
  async createScene(_app: Application): Promise<Container> {
    await this._loadAllSheets();
    if (this._destroyed) return this.layer;

    this._loaded = true;

    // Build default scene: 9 fielders, batter, catcher, umpire
    this.positionFielders(['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']);
    this.setBatter(false);
    this.setCatcher();
    this.setUmpire();

    return this.layer;
  }

  private async _loadAllSheets(): Promise<void> {
    const [
      batterFrames,
      pitcherFrames,
      fielderFrames,
      runnerFrames,
      runnerSlideFrames,
      catcherFrames,
      catcherAltFrames,
    ] = await Promise.all([
      loadSheet(SPRITE_SHEETS.batterSwing),
      loadSheet(SPRITE_SHEETS.pitcherWindup),
      loadSheet(SPRITE_SHEETS.fielderActions),
      loadSheet(SPRITE_SHEETS.runnerRun),
      loadSheet(SPRITE_SHEETS.runnerSlide),
      loadSheet(SPRITE_SHEETS.catcherUmpire),
      loadSheet(SPRITE_SHEETS.catcherUmpireAlt),
    ]);

    this.batterFrames = batterFrames;
    this.pitcherFrames = pitcherFrames;
    this.fielderFrames = fielderFrames;
    this.runnerFrames = runnerFrames;
    this.runnerSlideFrames = runnerSlideFrames;
    this.catcherFrames = catcherFrames;
    this.catcherAltFrames = catcherAltFrames;
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private _makeAnimator(
    firstFrame: Texture | undefined,
    frames: Texture[],
  ): SpriteAnimator {
    const anim = new SpriteAnimator(firstFrame);
    // Store the frame array so setFrame() works immediately
    anim.loadFrames(frames);
    this.layer.addChild(anim.getSprite());
    return anim;
  }

  private _removeAnimator(anim: SpriteAnimator): void {
    anim.stop();
    this.layer.removeChild(anim.getSprite());
    anim.destroy();
  }

  // ── Fielders ──────────────────────────────────────────────────────

  positionFielders(positions: string[]): void {
    if (!this._loaded) return;

    // Clear existing fielder sprites
    for (const anim of this.fielderSprites.values()) {
      this._removeAnimator(anim);
    }
    this.fielderSprites.clear();
    this._pitcher = null;
    this._catcher = null;

    for (const pos of positions) {
      const coord = FIELDER_DEFAULTS[pos];
      if (!coord) continue;

      const scale = FIELDER_SCALES[pos] ?? 0.18;
      const shouldFlip = FIELDER_FLIP[pos] ?? false;

      let anim: SpriteAnimator;

      if (pos === 'P') {
        anim = this._makeAnimator(
          this.pitcherFrames[PITCHER_FRAMES.setPosition],
          this.pitcherFrames,
        );
        anim.setFrame(PITCHER_FRAMES.setPosition);
      } else if (pos === 'C') {
        anim = this._makeAnimator(
          this.catcherFrames[CATCHER_UMPIRE_FRAMES.catcherCrouch],
          this.catcherFrames,
        );
        anim.setFrame(CATCHER_UMPIRE_FRAMES.catcherCrouch);
      } else {
        anim = this._makeAnimator(
          this.fielderFrames[FIELDER_FRAMES.ready],
          this.fielderFrames,
        );
        anim.setFrame(FIELDER_FRAMES.ready);
      }

      anim.setPosition(coord.x, coord.y);
      anim.setScale(scale);
      anim.setFlip(shouldFlip);

      this.fielderSprites.set(pos, anim);

      if (pos === 'P') this._pitcher = anim;
      if (pos === 'C') this._catcher = anim;
    }
  }

  // ── Batter ────────────────────────────────────────────────────────

  setBatter(isLeftHanded: boolean): void {
    if (!this._loaded) return;

    if (this._batter !== null) {
      this._removeAnimator(this._batter);
    }

    const batterX = isLeftHanded ? HOME_X + 20 : HOME_X - 20;
    const batterY = HOME_Y - 5;

    const anim = this._makeAnimator(
      this.batterFrames[BATTER_FRAMES.stance],
      this.batterFrames,
    );
    anim.setPosition(batterX, batterY);
    anim.setScale(BATTER_SCALE);
    anim.setFrame(BATTER_FRAMES.stance);
    // Left-handed batter: flip horizontally
    anim.setFlip(isLeftHanded);

    this._batter = anim;
  }

  // ── Catcher ───────────────────────────────────────────────────────

  setCatcher(): void {
    if (!this._loaded) return;
    if (this._catcher !== null) {
      this._catcher.setFrame(CATCHER_UMPIRE_FRAMES.catcherCrouch);
    }
  }

  // ── Umpire ────────────────────────────────────────────────────────

  setUmpire(): void {
    if (!this._loaded) return;

    if (this._umpire !== null) {
      this._removeAnimator(this._umpire);
    }

    const anim = this._makeAnimator(
      this.catcherAltFrames[CATCHER_UMPIRE_ALT_FRAMES.umpireStand],
      this.catcherAltFrames,
    );
    anim.setPosition(HOME_X + 5, HOME_Y + 38);
    anim.setScale(UMPIRE_SCALE);
    anim.setFrame(CATCHER_UMPIRE_ALT_FRAMES.umpireStand);

    this._umpire = anim;
  }

  // ── Runners ───────────────────────────────────────────────────────

  addRunner(base: number): void {
    if (!this._loaded) return;

    this.removeRunner(base);

    const baseCoords: Record<number, { x: number; y: number }> = {
      0: { x: HOME_X, y: HOME_Y },
      1: { x: BASE_1_X, y: BASE_1_Y - 12 },
      2: { x: BASE_2_X, y: BASE_2_Y - 12 },
      3: { x: BASE_3_X, y: BASE_3_Y - 12 },
    };

    const coord = baseCoords[base] ?? { x: HOME_X, y: HOME_Y };

    const anim = this._makeAnimator(
      this.runnerFrames[RUNNER_RUN_FRAMES.runA],
      this.runnerFrames,
    );
    anim.setPosition(coord.x, coord.y);
    anim.setScale(RUNNER_SCALE);
    anim.setFrame(RUNNER_RUN_FRAMES.runA);

    this.runnerSprites.set(base, anim);
  }

  removeRunner(base: number): void {
    const anim = this.runnerSprites.get(base);
    if (anim !== undefined) {
      this._removeAnimator(anim);
      this.runnerSprites.delete(base);
    }
  }

  clearRunners(): void {
    for (const base of [...this.runnerSprites.keys()]) {
      this.removeRunner(base);
    }
  }

  // ── Animation: Pitcher ────────────────────────────────────────────

  async animatePitcherWindup(): Promise<void> {
    if (!this._loaded || this._pitcher === null || this._destroyed) return;

    const pitcher = this._pitcher;
    await pitcher.playAnimation(this.pitcherFrames, 800, false);
    if (!this._destroyed) {
      pitcher.setFrame(PITCHER_FRAMES.setPosition);
    }
  }

  // ── Animation: Batter ─────────────────────────────────────────────

  async animateBatterSwing(_timing?: string): Promise<void> {
    if (!this._loaded || this._batter === null || this._destroyed) return;

    const batter = this._batter;
    await batter.playAnimation(this.batterFrames, 500, false);
    if (this._destroyed) return;
    batter.setFrame(BATTER_FRAMES.followThrough);

    await _delay(300);
    if (!this._destroyed) {
      batter.setFrame(BATTER_FRAMES.stance);
    }
  }

  async animateBatterTake(): Promise<void> {
    if (!this._loaded || this._batter === null || this._destroyed) return;
    this._batter.setFrame(BATTER_FRAMES.stance);
    await _delay(300);
  }

  // ── Animation: Fielders ───────────────────────────────────────────

  async animateFielderCatch(position: string): Promise<void> {
    if (!this._loaded || this._destroyed) return;

    const anim = this.fielderSprites.get(position);
    if (anim === undefined) return;

    const catchFrames = [
      this.fielderFrames[FIELDER_FRAMES.ready],
      this.fielderFrames[FIELDER_FRAMES.fielding],
      this.fielderFrames[FIELDER_FRAMES.catchingFly],
      this.fielderFrames[FIELDER_FRAMES.scooping],
    ].filter((t): t is Texture => t !== undefined);

    await anim.playAnimation(catchFrames, 400, false);
    if (!this._destroyed) {
      anim.setFrame(FIELDER_FRAMES.ready);
    }
  }

  async animateFielderThrow(position: string): Promise<void> {
    if (!this._loaded || this._destroyed) return;

    const anim = this.fielderSprites.get(position);
    if (anim === undefined) return;

    const throwFrames = [
      this.fielderFrames[FIELDER_FRAMES.crowHop],
      this.fielderFrames[FIELDER_FRAMES.throwing],
      this.fielderFrames[FIELDER_FRAMES.ready],
    ].filter((t): t is Texture => t !== undefined);

    await anim.playAnimation(throwFrames, 450, false);
    if (!this._destroyed) {
      anim.setFrame(FIELDER_FRAMES.ready);
    }
  }

  // ── Animation: Runners ────────────────────────────────────────────

  async animateRunnerAdvance(fromBase: number, toBase: number): Promise<void> {
    if (!this._loaded || this._destroyed) return;

    const anim = this.runnerSprites.get(fromBase);
    if (anim === undefined) return;

    const baseCoords: Record<number, { x: number; y: number }> = {
      0: { x: HOME_X, y: HOME_Y },
      1: { x: BASE_1_X, y: BASE_1_Y - 12 },
      2: { x: BASE_2_X, y: BASE_2_Y - 12 },
      3: { x: BASE_3_X, y: BASE_3_Y - 12 },
    };

    const from = baseCoords[fromBase] ?? baseCoords[0]!;
    const to   = baseCoords[toBase]   ?? baseCoords[1]!;

    const runCycleFrames = [
      this.runnerFrames[RUNNER_RUN_FRAMES.runA],
      this.runnerFrames[RUNNER_RUN_FRAMES.runB],
    ].filter((t): t is Texture => t !== undefined);

    const duration = 600;
    const startTime = performance.now();

    // Play looping run cycle while moving position
    const runPromise = anim.playAnimation(runCycleFrames, 300, true);

    await new Promise<void>((resolve) => {
      const onTick = (_ticker: Ticker) => {
        if (this._destroyed) {
          Ticker.shared.remove(onTick);
          resolve();
          return;
        }
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - t, 2);

        anim.setPosition(
          from.x + (to.x - from.x) * ease,
          from.y + (to.y - from.y) * ease,
        );

        if (t >= 1) {
          Ticker.shared.remove(onTick);
          resolve();
        }
      };
      Ticker.shared.add(onTick);
    });

    anim.stop();
    void runPromise;

    if (!this._destroyed) {
      anim.setFrame(RUNNER_RUN_FRAMES.runA);
      this.runnerSprites.delete(fromBase);
      this.runnerSprites.set(toBase, anim);
    }
  }

  async animateRunnerSlide(base: number): Promise<void> {
    if (!this._loaded || this._destroyed) return;

    const anim = this.runnerSprites.get(base);
    if (anim === undefined) return;

    const slideFrames = [
      this.runnerSlideFrames[RUNNER_SLIDE_FRAMES.running],
      this.runnerSlideFrames[RUNNER_SLIDE_FRAMES.approaching],
      this.runnerSlideFrames[RUNNER_SLIDE_FRAMES.headfirstDive],
      this.runnerSlideFrames[RUNNER_SLIDE_FRAMES.sliding],
    ].filter((t): t is Texture => t !== undefined);

    await anim.playAnimation(slideFrames, 500, false);
    if (!this._destroyed) {
      anim.setFrame(RUNNER_SLIDE_FRAMES.sliding);
    }
  }

  // ── Animation: Umpire ─────────────────────────────────────────────

  async animateUmpireStrikeCall(): Promise<void> {
    if (!this._loaded || this._umpire === null || this._destroyed) return;

    const umpire = this._umpire;

    const strikeFrames = [
      this.catcherAltFrames[CATCHER_UMPIRE_ALT_FRAMES.umpireStand],
      this.catcherAltFrames[CATCHER_UMPIRE_ALT_FRAMES.umpirePunchOut],
      this.catcherAltFrames[CATCHER_UMPIRE_ALT_FRAMES.umpirePunchOut],
      this.catcherAltFrames[CATCHER_UMPIRE_ALT_FRAMES.umpireStand],
    ].filter((t): t is Texture => t !== undefined);

    await umpire.playAnimation(strikeFrames, 600, false);
    if (!this._destroyed) {
      umpire.setFrame(CATCHER_UMPIRE_ALT_FRAMES.umpireStand);
    }
  }

  async animateUmpireBallCall(): Promise<void> {
    if (!this._loaded || this._umpire === null || this._destroyed) return;

    const umpire = this._umpire;
    const ballFrames = [
      this.catcherAltFrames[CATCHER_UMPIRE_ALT_FRAMES.umpireStand],
      this.catcherAltFrames[CATCHER_UMPIRE_ALT_FRAMES.umpireStand],
    ].filter((t): t is Texture => t !== undefined);

    await umpire.playAnimation(ballFrames, 300, false);
  }

  // ── Reset ─────────────────────────────────────────────────────────

  resetToReady(): void {
    if (!this._loaded) return;

    // Return each fielder to their default ready frame
    for (const [pos, anim] of this.fielderSprites.entries()) {
      anim.stop();
      if (pos === 'P') {
        anim.setFrame(PITCHER_FRAMES.setPosition);
      } else if (pos === 'C') {
        anim.setFrame(CATCHER_UMPIRE_FRAMES.catcherCrouch);
      } else {
        anim.setFrame(FIELDER_FRAMES.ready);
      }
    }

    if (this._batter !== null) {
      this._batter.stop();
      this._batter.setFrame(BATTER_FRAMES.stance);
    }
    if (this._umpire !== null) {
      this._umpire.stop();
      this._umpire.setFrame(CATCHER_UMPIRE_ALT_FRAMES.umpireStand);
    }
  }

  // ── Getters ───────────────────────────────────────────────────────

  getLayer(): Container {
    return this.layer;
  }

  isLoaded(): boolean {
    return this._loaded;
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  destroy(): void {
    this._destroyed = true;

    for (const anim of this.fielderSprites.values()) anim.destroy();
    this.fielderSprites.clear();

    for (const anim of this.runnerSprites.values()) anim.destroy();
    this.runnerSprites.clear();

    this._batter?.destroy();
    this._batter = null;

    this._pitcher = null; // owned by fielderSprites, already destroyed above
    this._catcher = null;

    this._umpire?.destroy();
    this._umpire = null;

    this.layer.destroy({ children: true });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

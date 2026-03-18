// ── SpritePlayerScene.ts ──────────────────────────────────────────────────
// Sprite-based replacement for PlayerScene. Uses AI-generated sprite sheet
// images instead of procedural vector figures.
//
// Sprite sheets are JPG files with gray backgrounds — this is acceptable on
// the dark green/brown diamond field.

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

// ── Scale factors for depth perspective ───────────────────────────────────
// After trim, effective content heights are approx:
//   Fielder (trimTop=0.37, trimBottom=0.76): 720 * 0.39 ≈ 281px
//   Batter  (trimTop=0.30, trimBottom=0.88): 720 * 0.58 ≈ 418px
//   Pitcher (trimTop=0.02, trimBottom=1.00): 584 * 0.98 ≈ 572px
//   Catcher/Umpire alt (full): 832px
//   Runner  (trimTop=0.68, trimBottom=1.00): 360 * 0.32 ≈ 115px
//
// Target rendered heights:
//   Infielders ~55px, Outfielders ~38px, Batter ~85px, Pitcher ~65px
//   Catcher ~70px, Umpire ~70px, Runner ~42px

const FIELDER_SCALES: Record<string, number> = {
  P:    0.114,  // pitcher 572px → ~65px
  C:    0.094,  // catcher 720px (full frame) → ~68px
  '1B': 0.196,  // fielder 281px → ~55px
  '2B': 0.178,
  SS:   0.178,
  '3B': 0.196,
  LF:   0.130,  // fielder 281px → ~37px
  CF:   0.120,
  RF:   0.130,
};

const BATTER_SCALE   = 0.203;  // batter 418px → ~85px
const UMPIRE_SCALE   = 0.085;  // catcher-umpire-alt 832px → ~71px
const RUNNER_SCALE   = 0.365;  // runner 115px → ~42px

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

  private _makeAnimator(firstFrame: Texture | undefined): SpriteAnimator {
    const anim = new SpriteAnimator(firstFrame);
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

    for (const pos of positions) {
      const coord = FIELDER_DEFAULTS[pos];
      if (!coord) continue;

      const scale = FIELDER_SCALES[pos] ?? 0.22;

      // Pitcher uses pitcher sprite; catcher uses catcher sprite; others use fielder
      let anim: SpriteAnimator;

      if (pos === 'P') {
        const firstFrame = this.pitcherFrames[PITCHER_FRAMES.setPosition];
        anim = this._makeAnimator(firstFrame);
        anim.setFrame(PITCHER_FRAMES.setPosition);
      } else if (pos === 'C') {
        const firstFrame = this.catcherFrames[CATCHER_UMPIRE_FRAMES.catcherCrouch];
        anim = this._makeAnimator(firstFrame);
        anim.setFrame(CATCHER_UMPIRE_FRAMES.catcherCrouch);
      } else {
        const firstFrame = this.fielderFrames[FIELDER_FRAMES.ready];
        anim = this._makeAnimator(firstFrame);
        anim.setFrame(FIELDER_FRAMES.ready);
        // Outfielders face slightly different direction
        if (['LF', 'RF'].includes(pos)) {
          anim.setFlip(pos === 'LF');
        }
      }

      anim.setPosition(coord.x, coord.y);
      anim.setScale(scale);

      this.fielderSprites.set(pos, anim);
    }

    // Re-bind catcher reference
    const catcherAnim = this.fielderSprites.get('C');
    if (catcherAnim !== undefined) {
      this._catcher = catcherAnim;
    }

    // Re-bind pitcher reference
    const pitcherAnim = this.fielderSprites.get('P');
    if (pitcherAnim !== undefined) {
      this._pitcher = pitcherAnim;
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

    const firstFrame = this.batterFrames[BATTER_FRAMES.stance];
    const anim = this._makeAnimator(firstFrame);
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

    // The catcher is created as part of positionFielders — just ensure crouch pose
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

    const umpireFrame = this.catcherAltFrames[CATCHER_UMPIRE_ALT_FRAMES.umpireStand];
    const anim = this._makeAnimator(umpireFrame);
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

    const firstFrame = this.runnerFrames[RUNNER_RUN_FRAMES.runA];
    const anim = this._makeAnimator(firstFrame);
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
    if (!this._loaded || this._pitcher === null) return;

    const pitcher = this._pitcher;
    await pitcher.playAnimation(this.pitcherFrames, 700, false);
    // Return to set position
    pitcher.setFrame(PITCHER_FRAMES.setPosition);
  }

  // ── Animation: Batter ─────────────────────────────────────────────

  async animateBatterSwing(_timing: string): Promise<void> {
    if (!this._loaded || this._batter === null) return;

    const batter = this._batter;
    await batter.playAnimation(this.batterFrames, 500, false);
    // Hold on follow-through briefly
    batter.setFrame(BATTER_FRAMES.followThrough);

    await _delay(300);
    // Return to stance
    batter.setFrame(BATTER_FRAMES.stance);
  }

  async animateBatterTake(): Promise<void> {
    if (!this._loaded || this._batter === null) return;

    // Subtle "watch the pitch" — just hold stance with a brief pause
    this._batter.setFrame(BATTER_FRAMES.stance);
    await _delay(300);
  }

  // ── Animation: Fielders ───────────────────────────────────────────

  async animateFielderCatch(position: string): Promise<void> {
    if (!this._loaded) return;

    const anim = this.fielderSprites.get(position);
    if (anim === undefined) return;

    // Cycle through catch frames: ready → catching fly → fielding
    const catchFrames = [
      this.fielderFrames[FIELDER_FRAMES.ready],
      this.fielderFrames[FIELDER_FRAMES.fielding],
      this.fielderFrames[FIELDER_FRAMES.catchingFly],
      this.fielderFrames[FIELDER_FRAMES.scooping],
    ].filter((t): t is Texture => t !== undefined);

    await anim.playAnimation(catchFrames, 400, false);
    anim.setFrame(FIELDER_FRAMES.ready);
  }

  async animateFielderThrow(position: string): Promise<void> {
    if (!this._loaded) return;

    const anim = this.fielderSprites.get(position);
    if (anim === undefined) return;

    const throwFrames = [
      this.fielderFrames[FIELDER_FRAMES.crowHop],
      this.fielderFrames[FIELDER_FRAMES.throwing],
      this.fielderFrames[FIELDER_FRAMES.ready],
    ].filter((t): t is Texture => t !== undefined);

    await anim.playAnimation(throwFrames, 450, false);
    anim.setFrame(FIELDER_FRAMES.ready);
  }

  // ── Animation: Runners ────────────────────────────────────────────

  async animateRunnerAdvance(fromBase: number, toBase: number): Promise<void> {
    if (!this._loaded) return;

    const anim = this.runnerSprites.get(fromBase);
    if (anim === undefined) return;

    // Determine target coordinates
    const baseCoords: Record<number, { x: number; y: number }> = {
      0: { x: HOME_X, y: HOME_Y },
      1: { x: BASE_1_X, y: BASE_1_Y - 12 },
      2: { x: BASE_2_X, y: BASE_2_Y - 12 },
      3: { x: BASE_3_X, y: BASE_3_Y - 12 },
    };

    const from = baseCoords[fromBase] ?? baseCoords[0];
    const to = baseCoords[toBase] ?? baseCoords[1];

    if (from === undefined || to === undefined) return;

    // Animate the running cycle while moving position over 600ms
    const runCycleFrames = [
      this.runnerFrames[RUNNER_RUN_FRAMES.runA],
      this.runnerFrames[RUNNER_RUN_FRAMES.runB],
    ].filter((t): t is Texture => t !== undefined);

    const duration = 600;
    const startTime = performance.now();

    // Play looping run cycle
    const runPromise = anim.playAnimation(runCycleFrames, 300, true);

    // Move the sprite via ticker
    await new Promise<void>((resolve) => {
      const onTick = (_ticker: Ticker) => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - t, 2); // ease-out quad

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

    // Stop loop, hold still at destination
    anim.stop();
    void runPromise; // silence unused promise warning
    anim.setFrame(RUNNER_RUN_FRAMES.runA);

    // Update runner map: move from old base to new base
    this.runnerSprites.delete(fromBase);
    this.runnerSprites.set(toBase, anim);
  }

  async animateRunnerSlide(base: number): Promise<void> {
    if (!this._loaded) return;

    const anim = this.runnerSprites.get(base);
    if (anim === undefined) return;

    const slideFrames = [
      this.runnerSlideFrames[RUNNER_SLIDE_FRAMES.running],
      this.runnerSlideFrames[RUNNER_SLIDE_FRAMES.approaching],
      this.runnerSlideFrames[RUNNER_SLIDE_FRAMES.headfirstDive],
      this.runnerSlideFrames[RUNNER_SLIDE_FRAMES.sliding],
    ].filter((t): t is Texture => t !== undefined);

    await anim.playAnimation(slideFrames, 500, false);
    // Hold on slide frame
    anim.setFrame(RUNNER_SLIDE_FRAMES.sliding);
  }

  // ── Animation: Umpire ─────────────────────────────────────────────

  async animateUmpireStrikeCall(): Promise<void> {
    if (!this._loaded || this._umpire === null) return;

    const umpire = this._umpire;

    // Punch-out: standing → punch-out → return
    const strikeFrames = [
      this.catcherAltFrames[CATCHER_UMPIRE_ALT_FRAMES.umpireStand],
      this.catcherAltFrames[CATCHER_UMPIRE_ALT_FRAMES.umpirePunchOut],
      this.catcherAltFrames[CATCHER_UMPIRE_ALT_FRAMES.umpirePunchOut],
      this.catcherAltFrames[CATCHER_UMPIRE_ALT_FRAMES.umpireStand],
    ].filter((t): t is Texture => t !== undefined);

    await umpire.playAnimation(strikeFrames, 600, false);
    umpire.setFrame(CATCHER_UMPIRE_ALT_FRAMES.umpireStand);
  }

  async animateUmpireBallCall(): Promise<void> {
    if (!this._loaded || this._umpire === null) return;

    const umpire = this._umpire;
    // Ball call: brief stand, return to standing
    const ballFrames = [
      this.catcherAltFrames[CATCHER_UMPIRE_ALT_FRAMES.umpireStand],
      this.catcherAltFrames[CATCHER_UMPIRE_ALT_FRAMES.umpireStand],
    ].filter((t): t is Texture => t !== undefined);

    await umpire.playAnimation(ballFrames, 300, false);
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

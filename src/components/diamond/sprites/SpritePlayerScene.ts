// ── SpritePlayerScene.ts ──────────────────────────────────────────────────
// Sprite-based replacement for PlayerScene. Uses AI-generated sprite sheet
// images sliced from PNG files with green chroma-key background removal applied.
// V2 sprites have solid #00FF00 backgrounds and 12-frame sequences.

import type { Application } from 'pixi.js';
import { Container, Ticker } from 'pixi.js';
import { SpriteAnimator } from './SpriteAnimator.ts';
import { loadSheet } from './SpriteSheetLoader.ts';
import {
  SPRITE_SHEETS,
  PITCHER_V2_FRAMES,
  BATTER_V2_FRAMES,
  FIELDER_V2_FRAMES,
  RUNNER_V2_FRAMES,
  CATCHER_UMP_V2_FRAMES,
} from './SpriteConfig.ts';
import type { Texture } from 'pixi.js';

// ── Coordinate constants (mirror DiamondRenderer) ─────────────────────────
// Tuned to match visual positions in gameplayfield2.png (behind-home-plate view).

const HOME_X = 300;
const HOME_Y = 425;
const BASE_1_X = 390;
const BASE_1_Y = 335;
const BASE_2_X = 300;
const BASE_2_Y = 235;
const BASE_3_X = 210;
const BASE_3_Y = 335;
const MOUND_X = 300;
const MOUND_Y = 310;

// ── Default fielder positions ──────────────────────────────────────────────

const FIELDER_DEFAULTS: Record<string, { x: number; y: number }> = {
  P:    { x: MOUND_X, y: MOUND_Y },
  C:    { x: HOME_X, y: HOME_Y + 12 },
  '1B': { x: 382, y: 330 },
  '2B': { x: 345, y: 268 },
  SS:   { x: 255, y: 268 },
  '3B': { x: 218, y: 330 },
  LF:   { x: 160, y: 215 },
  CF:   { x: 300, y: 190 },
  RF:   { x: 440, y: 215 },
};

// ── Perspective scale factors ──────────────────────────────────────────────
// V2 sprites: each frame is ~512px tall (natural size from PNG sheet).
// We scale to approximate perspective depth matching gameplayfield2.png.
//
// gameplayfield2.png is a behind-home-plate view with strong perspective:
//   - Players near home plate (batter, catcher, umpire) appear largest
//   - Pitcher on mound is medium-large
//   - Infielders are medium
//   - Outfielders are small (far back in the image)
//
// Target rendered heights on 600×500 canvas:
//   Batter/Catcher/Umpire (bottom):  ~75px → 0.146
//   Pitcher (mound, ~62% y):         ~60px → 0.117
//   Infielders (2/3 up field):       ~48px → 0.094
//   2B/SS (slightly further):        ~42px → 0.082
//   Outfielders (top ~30% of image): ~30px → 0.059
//   CF (furthest back):              ~26px → 0.051

const FIELDER_SCALES: Record<string, number> = {
  P:    0.22,    // pitcher on mound — prominent
  C:    0.25,    // catcher at plate — large
  '1B': 0.17,   // infielder
  '2B': 0.15,   // middle infield
  SS:   0.15,
  '3B': 0.17,
  LF:   0.09,   // outfielder — smaller for perspective depth
  CF:   0.07,   // CF furthest back — smallest
  RF:   0.09,
};

const BATTER_SCALE  = 0.28;  // batter — largest, closest to camera
const UMPIRE_SCALE  = 0.25;  // umpire behind plate
const RUNNER_SCALE  = 0.14;  // base runners

// ── Facing / flip rules ───────────────────────────────────────────────────
// Sprite sheets drawn facing LEFT by default (player faces left).
// To face right we flip horizontally (scale.x *= -1).
//
//   LF, 3B, SS → face right (toward infield) → flip = true
//   RF, 1B, 2B → face left  (toward infield) → flip = false (default)
//   CF → face down toward home → no flip
//   P  → faces home plate → no flip
//   C  → faces pitcher → flip = false
//   Batter → faces pitcher → flip = false (right-handed default)

const FIELDER_FLIP: Record<string, boolean> = {
  P:    false,
  C:    false,
  '1B': false,
  '2B': false,
  SS:   true,
  '3B': true,
  LF:   true,
  CF:   false,
  RF:   false,
};

// ── SpritePlayerScene ─────────────────────────────────────────────────────

export class SpritePlayerScene {
  private layer: Container;

  // Loaded texture arrays (v2)
  private batterFrames: Texture[] = [];
  private pitcherFrames: Texture[] = [];
  private fielderFrames: Texture[] = [];
  private runnerFrames: Texture[] = [];
  private catcherUmpireFrames: Texture[] = [];

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
   * Load all v2 sprite sheets and initialize the scene.
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
      catcherUmpireFrames,
    ] = await Promise.all([
      loadSheet(SPRITE_SHEETS.batterV2),
      loadSheet(SPRITE_SHEETS.pitcherV2),
      loadSheet(SPRITE_SHEETS.fielderV2),
      loadSheet(SPRITE_SHEETS.runnerV2),
      loadSheet(SPRITE_SHEETS.catcherUmpireV2),
    ]);

    this.batterFrames        = batterFrames;
    this.pitcherFrames       = pitcherFrames;
    this.fielderFrames       = fielderFrames;
    this.runnerFrames        = runnerFrames;
    this.catcherUmpireFrames = catcherUmpireFrames;
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private _makeAnimator(
    firstFrame: Texture | undefined,
    frames: Texture[],
  ): SpriteAnimator {
    const anim = new SpriteAnimator(firstFrame);
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

      const scale = FIELDER_SCALES[pos] ?? 0.10;
      const shouldFlip = FIELDER_FLIP[pos] ?? false;

      let anim: SpriteAnimator;

      if (pos === 'P') {
        anim = this._makeAnimator(
          this.pitcherFrames[PITCHER_V2_FRAMES.standing],
          this.pitcherFrames,
        );
        anim.setFrame(PITCHER_V2_FRAMES.standing);
      } else if (pos === 'C') {
        anim = this._makeAnimator(
          this.catcherUmpireFrames[CATCHER_UMP_V2_FRAMES.catcherSquat],
          this.catcherUmpireFrames,
        );
        anim.setFrame(CATCHER_UMP_V2_FRAMES.catcherSquat);
      } else {
        anim = this._makeAnimator(
          this.fielderFrames[FIELDER_V2_FRAMES.ready],
          this.fielderFrames,
        );
        anim.setFrame(FIELDER_V2_FRAMES.ready);
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
      this.batterFrames[BATTER_V2_FRAMES.stance],
      this.batterFrames,
    );
    anim.setPosition(batterX, batterY);
    anim.setScale(BATTER_SCALE);
    anim.setFrame(BATTER_V2_FRAMES.stance);
    anim.setFlip(isLeftHanded);

    this._batter = anim;
  }

  // ── Catcher ───────────────────────────────────────────────────────

  setCatcher(): void {
    if (!this._loaded) return;
    if (this._catcher !== null) {
      this._catcher.setFrame(CATCHER_UMP_V2_FRAMES.catcherSquat);
    }
  }

  // ── Umpire ────────────────────────────────────────────────────────

  setUmpire(): void {
    if (!this._loaded) return;

    if (this._umpire !== null) {
      this._removeAnimator(this._umpire);
    }

    const anim = this._makeAnimator(
      this.catcherUmpireFrames[CATCHER_UMP_V2_FRAMES.umpireStanding],
      this.catcherUmpireFrames,
    );
    anim.setPosition(HOME_X + 18, HOME_Y + 30);
    anim.setScale(UMPIRE_SCALE * 0.85);
    anim.setFrame(CATCHER_UMP_V2_FRAMES.umpireStanding);

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
      this.runnerFrames[RUNNER_V2_FRAMES.run1],
      this.runnerFrames,
    );
    anim.setPosition(coord.x, coord.y);
    anim.setScale(RUNNER_SCALE);
    anim.setFrame(RUNNER_V2_FRAMES.run1);

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
  // Full 12-frame windup cycle: frames 0→11 over 1200ms (slowed for drama)
  // Includes brief pause at leg kick peak for TLR2/KGJ feel

  async animatePitcherWindup(): Promise<void> {
    if (!this._loaded || this._pitcher === null || this._destroyed) return;

    const pitcher = this._pitcher;

    // Phase 1: Set → leg kick peak (frames 0-4, 500ms)
    const windupPhase1 = this.pitcherFrames.slice(0, 5)
      .filter((t): t is Texture => t !== undefined);
    await pitcher.playAnimation(windupPhase1, 500, false);
    if (this._destroyed) return;

    // Brief hold at peak of leg kick for dramatic tension
    await _delay(150);
    if (this._destroyed) return;

    // Phase 2: Delivery (frames 5-11, 550ms)
    const windupPhase2 = this.pitcherFrames.slice(5)
      .filter((t): t is Texture => t !== undefined);
    await pitcher.playAnimation(windupPhase2, 550, false);

    if (!this._destroyed) {
      pitcher.setFrame(PITCHER_V2_FRAMES.standing);
    }
  }

  // ── Animation: Batter ─────────────────────────────────────────────
  // Swing frames 0–7 over 500ms, then running frames 8–11

  async animateBatterSwing(_timing?: string): Promise<void> {
    if (!this._loaded || this._batter === null || this._destroyed) return;

    const batter = this._batter;

    // Swing phase: frames 0–7 (stance → contact → follow-through)
    const swingFrames = this.batterFrames.slice(
      BATTER_V2_FRAMES.stance,
      BATTER_V2_FRAMES.watching + 1,  // frames 0–8 inclusive
    ).filter((t): t is Texture => t !== undefined);

    await batter.playAnimation(swingFrames, 500, false);
    if (this._destroyed) return;

    batter.setFrame(BATTER_V2_FRAMES.followFull);

    await _delay(300);
    if (!this._destroyed) {
      batter.setFrame(BATTER_V2_FRAMES.stance);
    }
  }

  /**
   * After contact on a hit, transition batter to running frames (8–11).
   */
  async animateBatterRunning(): Promise<void> {
    if (!this._loaded || this._batter === null || this._destroyed) return;

    const batter = this._batter;

    // Running phase: frames 8–11 (drop bat → run cycle)
    const runFrames = [
      this.batterFrames[BATTER_V2_FRAMES.watching],
      this.batterFrames[BATTER_V2_FRAMES.dropBat],
      this.batterFrames[BATTER_V2_FRAMES.running1],
      this.batterFrames[BATTER_V2_FRAMES.running2],
    ].filter((t): t is Texture => t !== undefined);

    // Loop the run cycle
    await batter.playAnimation(runFrames, 400, true);
  }

  async animateBatterTake(): Promise<void> {
    if (!this._loaded || this._batter === null || this._destroyed) return;
    this._batter.setFrame(BATTER_V2_FRAMES.stance);
    await _delay(300);
  }

  // ── Fielder movement ─────────────────────────────────────────────
  // Move a fielder sprite from its current position to a target (for chasing balls).

  async moveFielderTo(
    position: string,
    targetX: number,
    targetY: number,
    duration: number,
  ): Promise<void> {
    if (!this._loaded || this._destroyed) return;

    const anim = this.fielderSprites.get(position);
    if (anim === undefined) return;

    const sprite = anim.getSprite();
    const startX = sprite.x;
    const startY = sprite.y;
    const startTime = performance.now();

    // Flip to face direction of travel
    const movingLeft = targetX < startX;
    anim.setFlip(movingLeft);

    // Play running animation (use ready→bend→scoop as a running cycle)
    const runFrames = [
      this.fielderFrames[FIELDER_V2_FRAMES.ready],
      this.fielderFrames[FIELDER_V2_FRAMES.crowHop],
      this.fielderFrames[FIELDER_V2_FRAMES.ready],
      this.fielderFrames[FIELDER_V2_FRAMES.throwing],
    ].filter((t): t is Texture => t !== undefined);

    const runPromise = anim.playAnimation(runFrames, 300, true);

    await new Promise<void>((resolve) => {
      const onTick = () => {
        if (this._destroyed || !this.fielderSprites.has(position)) {
          Ticker.shared.remove(onTick);
          resolve();
          return;
        }
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / Math.max(1, duration), 1);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        anim.setPosition(
          startX + (targetX - startX) * e,
          startY + (targetY - startY) * e,
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
    if (!this._destroyed && this.fielderSprites.has(position)) {
      anim.setFrame(FIELDER_V2_FRAMES.ready);
    }
  }

  /** Return a fielder to its default position (fire-and-forget). */
  async resetFielderPosition(position: string, duration: number): Promise<void> {
    if (!this._loaded || this._destroyed) return;

    const defaults = FIELDER_DEFAULTS[position];
    if (!defaults) return;

    const anim = this.fielderSprites.get(position);
    if (anim === undefined) return;

    const sprite = anim.getSprite();
    const startX = sprite.x;
    const startY = sprite.y;
    const startTime = performance.now();

    await new Promise<void>((resolve) => {
      const onTick = () => {
        if (this._destroyed) {
          Ticker.shared.remove(onTick);
          resolve();
          return;
        }
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / Math.max(1, duration), 1);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        anim.setPosition(
          startX + (defaults.x - startX) * e,
          startY + (defaults.y - startY) * e,
        );
        if (t >= 1) {
          Ticker.shared.remove(onTick);
          resolve();
        }
      };
      Ticker.shared.add(onTick);
    });

    if (!this._destroyed) {
      // Restore original flip
      const flip = FIELDER_FLIP[position] ?? false;
      anim.setFlip(flip);
      anim.setFrame(FIELDER_V2_FRAMES.ready);
    }
  }

  // ── Batter walkup ──────────────────────────────────────────────────
  // Batter enters from the right side of screen to the batter's box.

  async animateBatterWalkup(): Promise<void> {
    if (!this._loaded || this._batter === null || this._destroyed) return;

    const batter = this._batter;
    const sprite = batter.getSprite();
    const targetX = sprite.x;
    const targetY = sprite.y;

    // Start off-screen right
    sprite.x = 480;
    sprite.y = targetY;

    batter.setFrame(BATTER_V2_FRAMES.stance);
    const startTime = performance.now();
    const duration = 600;

    await new Promise<void>((resolve) => {
      const onTick = () => {
        if (this._destroyed) {
          Ticker.shared.remove(onTick);
          resolve();
          return;
        }
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
        sprite.x = 480 + (targetX - 480) * e;
        if (t >= 1) {
          Ticker.shared.remove(onTick);
          resolve();
        }
      };
      Ticker.shared.add(onTick);
    });

    if (!this._destroyed) {
      batter.setFrame(BATTER_V2_FRAMES.stance);
    }
  }

  // ── Animation: Fielders ───────────────────────────────────────────
  // Ready(0), then catch sequence: bendGrounder(5)→scooping(6)→standingUp(7)→crowHop(8) over 600ms

  async animateFielderCatch(position: string): Promise<void> {
    if (!this._loaded || this._destroyed) return;

    const anim = this.fielderSprites.get(position);
    if (anim === undefined) return;

    const catchFrames = [
      this.fielderFrames[FIELDER_V2_FRAMES.ready],
      this.fielderFrames[FIELDER_V2_FRAMES.bendGrounder],
      this.fielderFrames[FIELDER_V2_FRAMES.scooping],
      this.fielderFrames[FIELDER_V2_FRAMES.standingUp],
      this.fielderFrames[FIELDER_V2_FRAMES.crowHop],
      this.fielderFrames[FIELDER_V2_FRAMES.catchFly],
    ].filter((t): t is Texture => t !== undefined);

    await anim.playAnimation(catchFrames, 600, false);
    if (!this._destroyed) {
      anim.setFrame(FIELDER_V2_FRAMES.ready);
    }
  }

  async animateFielderThrow(position: string): Promise<void> {
    if (!this._loaded || this._destroyed) return;

    const anim = this.fielderSprites.get(position);
    if (anim === undefined) return;

    const throwFrames = [
      this.fielderFrames[FIELDER_V2_FRAMES.crowHop],
      this.fielderFrames[FIELDER_V2_FRAMES.throwing],
      this.fielderFrames[FIELDER_V2_FRAMES.throwFollow],
      this.fielderFrames[FIELDER_V2_FRAMES.ready],
    ].filter((t): t is Texture => t !== undefined);

    await anim.playAnimation(throwFrames, 450, false);
    if (!this._destroyed) {
      anim.setFrame(FIELDER_V2_FRAMES.ready);
    }
  }

  // ── Animation: Runners ────────────────────────────────────────────
  // Running: alternate run1(0)→run2(1)→run3(2)→run4(3)
  // Slide: slideStart(4)→feetSlide(5)
  // Dive: headfirstDive(6)

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

    // Running cycle: 4-frame loop (run1→run2→run3→run4)
    const runCycleFrames = [
      this.runnerFrames[RUNNER_V2_FRAMES.run1],
      this.runnerFrames[RUNNER_V2_FRAMES.run2],
      this.runnerFrames[RUNNER_V2_FRAMES.run3],
      this.runnerFrames[RUNNER_V2_FRAMES.run4],
    ].filter((t): t is Texture => t !== undefined);

    const duration = 600;
    const startTime = performance.now();

    const runPromise = anim.playAnimation(runCycleFrames, 300, true);

    await new Promise<void>((resolve) => {
      const onTick = (_ticker: Ticker) => {
        // Guard: stop if scene destroyed or this runner sprite was removed
        if (this._destroyed || !this.runnerSprites.has(fromBase)) {
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
      anim.setFrame(RUNNER_V2_FRAMES.standingOnBase);
      this.runnerSprites.delete(fromBase);
      this.runnerSprites.set(toBase, anim);
    }
  }

  async animateRunnerSlide(base: number): Promise<void> {
    if (!this._loaded || this._destroyed) return;

    const anim = this.runnerSprites.get(base);
    if (anim === undefined) return;

    const slideFrames = [
      this.runnerFrames[RUNNER_V2_FRAMES.run4],
      this.runnerFrames[RUNNER_V2_FRAMES.slideStart],
      this.runnerFrames[RUNNER_V2_FRAMES.feetSlide],
      this.runnerFrames[RUNNER_V2_FRAMES.headfirstDive],
    ].filter((t): t is Texture => t !== undefined);

    await anim.playAnimation(slideFrames, 500, false);
    if (!this._destroyed) {
      anim.setFrame(RUNNER_V2_FRAMES.standingOnBase);
    }
  }

  // ── Animation: Umpire ─────────────────────────────────────────────

  async animateUmpireStrikeCall(): Promise<void> {
    if (!this._loaded || this._umpire === null || this._destroyed) return;

    const umpire = this._umpire;

    const strikeFrames = [
      this.catcherUmpireFrames[CATCHER_UMP_V2_FRAMES.umpireStanding],
      this.catcherUmpireFrames[CATCHER_UMP_V2_FRAMES.umpireStrike],
      this.catcherUmpireFrames[CATCHER_UMP_V2_FRAMES.umpireOut],
      this.catcherUmpireFrames[CATCHER_UMP_V2_FRAMES.umpireStanding],
    ].filter((t): t is Texture => t !== undefined);

    await umpire.playAnimation(strikeFrames, 600, false);
    if (!this._destroyed) {
      umpire.setFrame(CATCHER_UMP_V2_FRAMES.umpireStanding);
    }
  }

  async animateUmpireBallCall(): Promise<void> {
    if (!this._loaded || this._umpire === null || this._destroyed) return;

    const umpire = this._umpire;
    const ballFrames = [
      this.catcherUmpireFrames[CATCHER_UMP_V2_FRAMES.umpireStanding],
      this.catcherUmpireFrames[CATCHER_UMP_V2_FRAMES.umpireBall],
      this.catcherUmpireFrames[CATCHER_UMP_V2_FRAMES.umpireStanding],
    ].filter((t): t is Texture => t !== undefined);

    await umpire.playAnimation(ballFrames, 400, false);
    if (!this._destroyed) {
      umpire.setFrame(CATCHER_UMP_V2_FRAMES.umpireStanding);
    }
  }

  // ── Animation: Catcher receive ────────────────────────────────────

  async animateCatcherReceive(): Promise<void> {
    if (!this._loaded || this._catcher === null || this._destroyed) return;

    const catcher = this._catcher;
    const receiveFrames = [
      this.catcherUmpireFrames[CATCHER_UMP_V2_FRAMES.catcherSquat],
      this.catcherUmpireFrames[CATCHER_UMP_V2_FRAMES.catcherReachLeft],
      this.catcherUmpireFrames[CATCHER_UMP_V2_FRAMES.catcherReachRight],
      this.catcherUmpireFrames[CATCHER_UMP_V2_FRAMES.catcherSquat],
    ].filter((t): t is Texture => t !== undefined);

    await catcher.playAnimation(receiveFrames, 300, false);
    if (!this._destroyed) {
      catcher.setFrame(CATCHER_UMP_V2_FRAMES.catcherSquat);
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────

  resetToReady(): void {
    if (!this._loaded) return;

    for (const [pos, anim] of this.fielderSprites.entries()) {
      anim.stop();
      if (pos === 'P') {
        anim.setFrame(PITCHER_V2_FRAMES.standing);
      } else if (pos === 'C') {
        anim.setFrame(CATCHER_UMP_V2_FRAMES.catcherSquat);
      } else {
        anim.setFrame(FIELDER_V2_FRAMES.ready);
      }
    }

    if (this._batter !== null) {
      this._batter.stop();
      this._batter.setFrame(BATTER_V2_FRAMES.stance);
    }
    if (this._umpire !== null) {
      this._umpire.stop();
      this._umpire.setFrame(CATCHER_UMP_V2_FRAMES.umpireStanding);
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

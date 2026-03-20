import { Application, Assets, Graphics, Text, Container, Sprite, Ticker } from 'pixi.js';
import { PlayerScene } from './players/PlayerScene.ts';
import { SpritePlayerScene } from './sprites/SpritePlayerScene.ts';
import {
  tweenBezier,
  tweenParabolic,
  tweenGround,
  tweenAlpha,
  tweenTo,
  Easing,
} from './Tween.ts';
import type { Point } from './Tween.ts';
import { loadSceneAssets, clearSceneAssets } from './sprites/SceneAssets.ts';

// ── Canvas dimensions ─────────────────────────────────────────────────────
// The field background image (gameplayfield2.png) fills this viewport.
// All coordinate constants below are tuned to match the visual positions
// of field elements inside gameplayfield2.png (1280×720 pixel art).
// The viewport is still 600×500 to match prior component sizing.

const WIDTH = 600;
const HEIGHT = 500;

// ── Coordinate constants ──────────────────────────────────────────────────
// Derived from gameplayfield2.png: behind-home-plate perspective.
// Percentages: home plate ≈ 50% x, 85% y; mound ≈ 50% x, 62% y
// 1B ≈ 65% x, 67% y; 2B ≈ 50% x, 47% y; 3B ≈ 35% x, 67% y

const HOME_X = 300;     // 50% of 600
const HOME_Y = 425;     // 85% of 500

const MOUND_X = 300;    // 50% of 600
const MOUND_Y = 310;    // 62% of 500

const BASE_1_X = 390;   // 65% of 600
const BASE_1_Y = 335;   // 67% of 500

const BASE_2_X = 300;   // 50% of 600
const BASE_2_Y = 235;   // 47% of 500

const BASE_3_X = 210;   // 35% of 600
const BASE_3_Y = 335;   // 67% of 500

// ── Fielder positions ──────────────────────────────────────────────────────
const FIELDER_POSITIONS: Record<string, { x: number; y: number }> = {
  P:    { x: MOUND_X,  y: MOUND_Y },
  C:    { x: HOME_X,   y: HOME_Y + 12 },
  '1B': { x: 382,      y: 330 },
  '2B': { x: 345,      y: 268 },
  SS:   { x: 255,      y: 268 },
  '3B': { x: 218,      y: 330 },
  LF:   { x: 160,      y: 215 },
  CF:   { x: 300,      y: 190 },
  RF:   { x: 440,      y: 215 },
};

// ── Hit trajectory helpers ────────────────────────────────────────────────
type HitType = 'ground_ball' | 'line_drive' | 'fly_ball' | 'popup' | 'home_run';

function hitLandingPoint(
  type: HitType,
  angleDeg: number,
  distance: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const maxDist = type === 'home_run' ? 320 : type === 'popup' ? 80 : 260;
  const d = distance * maxDist;
  return {
    x: HOME_X + Math.cos(rad) * d,
    y: HOME_Y + Math.sin(rad) * d,
  };
}

// ── DiamondRenderer class ─────────────────────────────────────────────────

export class DiamondRenderer {
  private app: Application | null = null;
  private root: Container | null = null;

  // Layers (bottom → top)
  private backgroundLayer: Container | null = null;
  private playerLayer: Container | null = null;
  private ballLayer: Container | null = null;
  private effectsLayer: Container | null = null;
  private labelLayer: Container | null = null;

  // Player scenes
  private playerScene: PlayerScene;
  private spriteScene: SpritePlayerScene | null = null;
  private _spriteMode = false;

  // State
  private fielderLabels: Map<string, Text> = new Map();
  private ballGraphic: Graphics | null = null;
  private ballGlow: Graphics | null = null;
  private _trailDots: Graphics[] = [];
  private _trailPositions: { x: number; y: number }[] = [];
  private _ballColor = 0xffffff;

  private _animating = false;
  // Note: _destroyed is not private so it satisfies the tween guard interface { _destroyed: boolean }
  _destroyed = false;

  /** Captured once after initInContainer — the "full field" scale/position. */
  private _baseTransform = { scaleX: 1, scaleY: 1, x: 0, y: 0 };

  // ── Constructor ────────────────────────────────────────────────────────

  constructor() {
    this.playerScene = new PlayerScene();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  /**
   * Initialize Pixi inside a container div. Loads the gameplayfield2.png
   * background image as the sole field graphic.
   */
  async initInContainer(container: HTMLDivElement, width: number, height: number): Promise<void> {
    const app = new Application();
    await app.init({
      width,
      height,
      background: 0x0a0f1a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    if (this._destroyed) {
      app.destroy(true, { children: true });
      return;
    }

    container.appendChild(app.canvas);
    (app.canvas as HTMLCanvasElement).style.display = 'block';
    (app.canvas as HTMLCanvasElement).style.width = '100%';
    (app.canvas as HTMLCanvasElement).style.height = '100%';

    this.app = app;
    this.root = new Container();
    app.stage.addChild(this.root);

    // Scale root to fill canvas — keep aspect ratio of our 600×500 viewport
    const sx = width / WIDTH;
    const sy = height / HEIGHT;
    const scale = Math.min(sx, sy);
    this.root.scale.set(scale);
    this.root.x = (width - WIDTH * scale) / 2;
    this.root.y = (height - HEIGHT * scale) / 2;

    // Capture base transform for AtBatCamera
    this._baseTransform = { scaleX: scale, scaleY: scale, x: this.root.x, y: this.root.y };

    this._createLayers();

    // Load background field image
    await this._loadFieldBackground();

    if (this._destroyed) return;

    this._initProceduralScene(app);
    this._createBall();
  }

  /** @deprecated Use initInContainer instead */
  async init(canvas: HTMLCanvasElement, width: number, height: number): Promise<void> {
    const app = new Application();
    await app.init({
      canvas,
      width,
      height,
      background: 0x0a0f1a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    if (this._destroyed) {
      app.destroy(true, { children: true });
      return;
    }

    this.app = app;
    this.root = new Container();
    app.stage.addChild(this.root);

    const sx = width / WIDTH;
    const sy = height / HEIGHT;
    const scale = Math.min(sx, sy);
    this.root.scale.set(scale);
    this.root.x = (width - WIDTH * scale) / 2;
    this.root.y = (height - HEIGHT * scale) / 2;

    // Capture base transform for AtBatCamera
    this._baseTransform = { scaleX: scale, scaleY: scale, x: this.root.x, y: this.root.y };

    this._createLayers();
    await this._loadFieldBackground();

    if (this._destroyed) return;

    this._initProceduralScene(app);
    this._createBall();
  }

  // ── Layer setup ───────────────────────────────────────────────────────

  private _createLayers(): void {
    if (!this.root) return;

    // Z-order (bottom → top):
    //   backgroundLayer → playerLayer → ballLayer → effectsLayer → labelLayer
    this.backgroundLayer = new Container();
    this.playerLayer     = new Container();
    this.ballLayer       = new Container();
    this.effectsLayer    = new Container();
    this.labelLayer      = new Container();

    this.root.addChild(this.backgroundLayer);  // 0 — field background image
    this.root.addChild(this.playerLayer);      // 1 — player sprites / procedural figures
    this.root.addChild(this.ballLayer);        // 2 — ball
    this.root.addChild(this.effectsLayer);     // 3 — particle effects
    this.root.addChild(this.labelLayer);       // 4 — text labels
  }

  // ── Field background ──────────────────────────────────────────────────

  /**
   * Load gameplayfield2.png as a background sprite that fills the 600×500 viewport.
   * Uses "cover" mode: scales uniformly so the image fills the viewport (cropping edges).
   */
  private async _loadFieldBackground(): Promise<void> {
    if (!this.backgroundLayer) return;

    try {
      const texture = await Assets.load('/sprites/gameplayfield2.png');
      if (this._destroyed) return;

      const sprite = new Sprite(texture);

      // Cover mode: scale to fill WIDTH×HEIGHT maintaining aspect ratio
      const imgW = texture.width;
      const imgH = texture.height;
      const scaleX = WIDTH / imgW;
      const scaleY = HEIGHT / imgH;
      const coverScale = Math.max(scaleX, scaleY);
      sprite.scale.set(coverScale);

      // Center the image within the viewport
      sprite.x = (WIDTH - imgW * coverScale) / 2;
      sprite.y = (HEIGHT - imgH * coverScale) / 2;

      this.backgroundLayer.addChild(sprite);
    } catch (err) {
      console.warn('[DiamondRenderer] Failed to load gameplayfield2.png:', err);
      // Fallback: dark navy background (already set as app background color)
    }
  }

  // ── Player scene init ─────────────────────────────────────────────────

  private _initProceduralScene(app: Application): void {
    if (!this.playerLayer) return;
    const layer = this.playerScene.createScene(app);
    this.playerLayer.addChild(layer);
    this._spriteMode = false;
  }

  /**
   * Asynchronously load sprite sheets and switch to sprite-based players.
   */
  async loadSprites(): Promise<boolean> {
    if (this._destroyed || !this.playerLayer) return false;

    try {
      const spriteScene = new SpritePlayerScene();
      const spriteLayer = await spriteScene.createScene(this.app!);

      if (this._destroyed) {
        spriteScene.destroy();
        return false;
      }

      // Hide the procedural layer, add sprite layer on top
      if (this.playerLayer.children.length > 0) {
        this.playerLayer.children[0].visible = false;
      }
      this.playerLayer.addChild(spriteLayer);
      this.spriteScene = spriteScene;
      this._spriteMode = true;
      return true;
    } catch (err) {
      console.warn('[DiamondRenderer] Sprite load failed, using procedural figures:', err);
      return false;
    }
  }

  /**
   * loadSceneSprites is kept as a no-op for backwards compatibility.
   * The field is now a single background image; no separate scene assets needed.
   */
  async loadSceneSprites(): Promise<boolean> {
    return true;
  }

  /** SceneAssets getter — still needed by PlaySequencer for homerun/dust sprite effects. */
  async getSceneAssets() {
    try {
      return await loadSceneAssets();
    } catch {
      return null;
    }
  }

  /** No-op weather setter (weather is baked into the background image). */
  async setWeather(_type: string): Promise<void> {
    // Weather is baked into gameplayfield2.png (night game). No-op.
  }

  /**
   * Toggle between sprite-based and procedural player figures at runtime.
   */
  setSpriteMode(enabled: boolean): void {
    if (enabled && this.spriteScene === null) {
      console.warn('[DiamondRenderer] setSpriteMode(true) called but sprites not loaded.');
      return;
    }
    this._spriteMode = enabled;

    if (this.playerLayer && this.playerLayer.children.length >= 2) {
      this.playerLayer.children[0].visible = !enabled;
      this.playerLayer.children[1].visible = enabled;
    }
  }

  get spriteMode(): boolean {
    return this._spriteMode;
  }

  getSpriteScene(): SpritePlayerScene | null {
    return this._spriteMode ? this.spriteScene : null;
  }

  destroy(): void {
    this._destroyed = true;
    if (this.app) {
      this.app.ticker.stop();
    }
    this.playerScene.destroy();
    this.spriteScene?.destroy();
    this.spriteScene = null;
    clearSceneAssets();
    if (this.app) {
      const canvas = this.app.canvas as HTMLCanvasElement;
      canvas.parentElement?.removeChild(canvas);
      this.app.destroy(true, { children: true });
      this.app = null;
    }
    this.root = null;
    this.fielderLabels.clear();
    this.ballGraphic = null;
  }

  // ── Effects layer ─────────────────────────────────────────────────────

  getEffectsLayer(): Container {
    return this.effectsLayer!;
  }

  getApp(): Application | null {
    return this.app;
  }

  getRoot(): Container | null {
    return this.root;
  }

  /** Return the base scale and position captured at init — the "full field" state
   *  that AtBatCamera uses as its zoom-out target. */
  getRootBaseTransform(): { scaleX: number; scaleY: number; x: number; y: number } {
    return { ...this._baseTransform };
  }

  // ── Public API ────────────────────────────────────────────────────────

  drawFielders(positions: string[]): void {
    if (this._spriteMode && this.spriteScene !== null) {
      this.spriteScene.positionFielders(positions);
    } else {
      this.playerScene.positionFielders(positions);
    }

    // Position labels
    if (!this.labelLayer) return;
    for (const lbl of this.fielderLabels.values()) lbl.destroy();
    this.fielderLabels.clear();

    for (const pos of positions) {
      const coord = FIELDER_POSITIONS[pos];
      if (!coord) continue;

      const label = new Text({
        text: pos,
        style: {
          fontSize: 8,
          fontFamily: 'IBM Plex Mono, monospace',
          fill: 0xaaaaaa,
          fontWeight: 'bold',
        },
      });
      label.anchor.set(0.5, 0);
      label.x = coord.x;
      label.y = coord.y + 14;
      this.labelLayer.addChild(label);
      this.fielderLabels.set(pos, label);
    }
  }

  updateBases(bases: { first: boolean; second: boolean; third: boolean }): void {
    const runnerBases: [boolean, number][] = [
      [bases.first, 1],
      [bases.second, 2],
      [bases.third, 3],
    ];

    if (this._spriteMode && this.spriteScene !== null) {
      this.spriteScene.clearRunners();
      for (const [occupied, baseNum] of runnerBases) {
        if (!occupied) continue;
        this.spriteScene.addRunner(baseNum);
      }
    } else {
      this.playerScene.clearRunners();
      for (const [occupied, baseNum] of runnerBases) {
        if (!occupied) continue;
        this.playerScene.addRunner(baseNum);
      }
    }
  }

  updateFielders(positions: string[]): void {
    this.drawFielders(positions);
  }

  highlightBase(base: number): void {
    if (!this.effectsLayer) return;

    const coords: Record<number, { x: number; y: number }> = {
      1: { x: BASE_1_X, y: BASE_1_Y },
      2: { x: BASE_2_X, y: BASE_2_Y },
      3: { x: BASE_3_X, y: BASE_3_Y },
    };

    const pos = coords[base];
    if (!pos) return;

    const glow = new Graphics();
    glow.circle(pos.x, pos.y, 16);
    glow.fill({ color: 0xd4a843, alpha: 0.45 });
    this.effectsLayer.addChild(glow);

    setTimeout(() => {
      if (!this._destroyed && glow.parent) {
        glow.destroy();
      }
    }, 1500);
  }

  reset(): void {
    if (this.effectsLayer) {
      this.effectsLayer.removeChildren().forEach((c) => c.destroy());
    }

    if (this.ballGraphic) {
      this.ballGraphic.visible = false;
    }

    this._animating = false;
  }

  get isAnimating(): boolean {
    return this._animating;
  }

  // ── Ball ──────────────────────────────────────────────────────────────

  private _createBall(): void {
    if (!this.ballLayer) return;

    // Trail dots (behind ball, decreasing alpha)
    const trailAlphas = [0.35, 0.25, 0.18, 0.12, 0.07];
    for (let i = 0; i < 5; i++) {
      const dot = new Graphics();
      dot.circle(0, 0, 3);
      dot.fill({ color: this._ballColor, alpha: trailAlphas[i] });
      dot.visible = false;
      this.ballLayer.addChild(dot);
      this._trailDots.push(dot);
      this._trailPositions.push({ x: 0, y: 0 });
    }

    // Glow ring (behind core ball)
    const glow = new Graphics();
    glow.circle(0, 0, 10);
    glow.fill({ color: 0xffffff, alpha: 0.25 });
    glow.visible = false;
    this.ballLayer.addChild(glow);
    this.ballGlow = glow;

    // Core ball — bigger than before (5px radius)
    const ball = new Graphics();
    ball.circle(0, 0, 5);
    ball.fill({ color: 0xffffff });
    ball.visible = false;
    this.ballLayer.addChild(ball);
    this.ballGraphic = ball;
  }

  getBall(): Graphics | null {
    return this.ballGraphic;
  }

  /** Set the ball glow and trail color for pitch-type differentiation. */
  setBallColor(color: number): void {
    this._ballColor = color;
    // Rebuild glow with new color
    if (this.ballGlow && !this.ballGlow.destroyed) {
      this.ballGlow.clear();
      this.ballGlow.circle(0, 0, 10);
      this.ballGlow.fill({ color, alpha: 0.25 });
    }
    // Rebuild trail dots with new color
    const trailAlphas = [0.35, 0.25, 0.18, 0.12, 0.07];
    for (let i = 0; i < this._trailDots.length; i++) {
      const dot = this._trailDots[i];
      if (dot && !dot.destroyed) {
        dot.clear();
        dot.circle(0, 0, 3);
        dot.fill({ color, alpha: trailAlphas[i] ?? 0.1 });
      }
    }
  }

  /** Update trail positions — call on each animation tick. */
  private _updateTrail(x: number, y: number): void {
    // Shift positions down the ring buffer
    for (let i = this._trailPositions.length - 1; i > 0; i--) {
      const prev = this._trailPositions[i - 1];
      if (prev) this._trailPositions[i] = { x: prev.x, y: prev.y };
    }
    if (this._trailPositions.length > 0) {
      this._trailPositions[0] = { x, y };
    }
    // Update dot positions
    for (let i = 0; i < this._trailDots.length; i++) {
      const dot = this._trailDots[i];
      const pos = this._trailPositions[i];
      if (dot && pos) {
        dot.x = pos.x;
        dot.y = pos.y;
      }
    }
    // Sync glow position with ball
    if (this.ballGlow && !this.ballGlow.destroyed) {
      this.ballGlow.x = x;
      this.ballGlow.y = y;
    }
  }

  /** Reset trail to a single point (prevents streaking on ball reposition). */
  private _resetTrail(x: number, y: number): void {
    for (let i = 0; i < this._trailPositions.length; i++) {
      this._trailPositions[i] = { x, y };
    }
    for (const dot of this._trailDots) {
      if (dot && !dot.destroyed) {
        dot.x = x;
        dot.y = y;
      }
    }
    if (this.ballGlow && !this.ballGlow.destroyed) {
      this.ballGlow.x = x;
      this.ballGlow.y = y;
    }
  }

  showBall(): void {
    if (this.ballGraphic) this.ballGraphic.visible = true;
    if (this.ballGlow) this.ballGlow.visible = true;
    for (const dot of this._trailDots) {
      if (dot) dot.visible = true;
    }
  }

  hideBall(): void {
    if (this.ballGraphic) this.ballGraphic.visible = false;
    if (this.ballGlow) this.ballGlow.visible = false;
    for (const dot of this._trailDots) {
      if (dot) dot.visible = false;
    }
  }

  async fadeBall(duration: number): Promise<void> {
    if (!this.ballGraphic) return;
    const ball = this.ballGraphic;
    ball.visible = true;
    await tweenAlpha(ball, ball.alpha, 0, duration, Easing.easeOut, this);
    if (!this._destroyed) ball.visible = false;
    ball.alpha = 1;
  }

  async moveBallTo(x: number, y: number, duration: number): Promise<void> {
    if (!this.ballGraphic || this._destroyed) return;
    const ball = this.ballGraphic;
    ball.visible = true;
    await tweenTo(ball, { x, y }, duration, Easing.easeOutCubic, this);
  }

  async animateBallBezier(
    start: Point,
    control: Point,
    end: Point,
    duration: number,
  ): Promise<void> {
    if (!this.ballGraphic || this._destroyed) return;

    const ball = this.ballGraphic;
    ball.x = start.x;
    ball.y = start.y;
    ball.scale.set(1);
    ball.alpha = 1;
    this._resetTrail(start.x, start.y);
    this.showBall();
    this._animating = true;

    // Use a custom tick callback to update trail during bezier
    let elapsed = 0;
    await new Promise<void>((resolve) => {
      const onTick = (ticker: Ticker) => {
        if (this._destroyed) {
          Ticker.shared.remove(onTick);
          resolve();
          return;
        }
        elapsed += ticker.deltaMS;
        const rawT = Math.min(elapsed / Math.max(1, duration), 1);
        const mt = 1 - rawT;
        ball.x = mt * mt * start.x + 2 * mt * rawT * control.x + rawT * rawT * end.x;
        ball.y = mt * mt * start.y + 2 * mt * rawT * control.y + rawT * rawT * end.y;
        this._updateTrail(ball.x, ball.y);
        if (rawT >= 1) {
          Ticker.shared.remove(onTick);
          resolve();
        }
      };
      Ticker.shared.add(onTick);
    });

    this._animating = false;
  }

  async animateBallParabolic(
    start: Point,
    end: Point,
    peakHeight: number,
    duration: number,
  ): Promise<void> {
    if (!this.ballGraphic || this._destroyed) return;

    const ball = this.ballGraphic;
    ball.x = start.x;
    ball.y = start.y;
    ball.scale.set(1);
    ball.alpha = 1;
    this._resetTrail(start.x, start.y);
    this.showBall();
    this._animating = true;

    const shadow = new Graphics();
    shadow.ellipse(0, 0, 6, 3);
    shadow.fill({ color: 0x000000, alpha: 0.4 });
    shadow.x = start.x;
    shadow.y = start.y + 3;
    this.ballLayer?.addChildAt(shadow, 0);

    await tweenParabolic(
      ball,
      start,
      end,
      peakHeight,
      duration,
      this,
      (_t, heightFraction) => {
        ball.scale.set(1 - heightFraction * 0.45);
        const groundY = start.y + (end.y - start.y) * _t;
        shadow.x = ball.x;
        shadow.y = groundY + 3;
        shadow.scale.set(1 + heightFraction * 0.7);
        shadow.alpha = Math.max(0.08, 0.4 - heightFraction * 0.2);
        this._updateTrail(ball.x, ball.y);
      },
    );

    if (!this._destroyed) {
      shadow.destroy();
      ball.scale.set(1);
    }
    this._animating = false;
  }

  async animateBallGround(
    start: Point,
    end: Point,
    duration: number,
    exitVelo = 80,
  ): Promise<void> {
    if (!this.ballGraphic || this._destroyed) return;

    const ball = this.ballGraphic;
    ball.x = start.x;
    ball.y = start.y;
    ball.scale.set(1);
    ball.alpha = 1;
    this._resetTrail(start.x, start.y);
    this.showBall();
    this._animating = true;

    // Custom ground tween with trail tracking
    let elapsed = 0;
    await new Promise<void>((resolve) => {
      const onTick = (ticker: Ticker) => {
        if (this._destroyed) {
          Ticker.shared.remove(onTick);
          resolve();
          return;
        }
        elapsed += ticker.deltaMS;
        const t = Math.min(elapsed / Math.max(1, duration), 1);
        const ease = Easing.easeOutExpo(t);
        ball.x = start.x + (end.x - start.x) * ease;
        const speed = Math.min(1, Math.max(0, (exitVelo - 60) / 50));
        const hopCount = speed > 0.7 ? 1.5 : speed > 0.4 ? 2.5 : 3.5;
        const amplitude = speed > 0.7 ? 7 : speed > 0.4 ? 4 : 2.5;
        const decay = 1 - t;
        const hop = Math.max(0, Math.sin(t * Math.PI * hopCount) * amplitude * decay);
        ball.y = start.y + (end.y - start.y) * ease - hop;
        this._updateTrail(ball.x, ball.y);
        if (t >= 1) {
          Ticker.shared.remove(onTick);
          resolve();
        }
      };
      Ticker.shared.add(onTick);
    });

    this._animating = false;
  }

  async animateBallHomeRun(angleDeg: number, distNorm: number): Promise<void> {
    if (!this.ballGraphic || this._destroyed) return;

    const rad = ((angleDeg - 90) * Math.PI) / 180;
    const travelDist = 280 + distNorm * 60;
    const end: Point = {
      x: HOME_X + Math.cos(rad) * travelDist,
      y: HOME_Y + Math.sin(rad) * travelDist,
    };
    const start: Point = { x: HOME_X, y: HOME_Y };

    const peakHeight = 100 + distNorm * 30;
    const duration = 900 + distNorm * 200;

    const ball = this.ballGraphic;
    ball.x = start.x;
    ball.y = start.y;
    ball.scale.set(1);
    ball.alpha = 1;
    this._resetTrail(start.x, start.y);
    this.showBall();
    this._animating = true;

    const shadow = new Graphics();
    shadow.ellipse(0, 0, 6, 3);
    shadow.fill({ color: 0x000000, alpha: 0.4 });
    this.ballLayer?.addChildAt(shadow, 0);

    let apexFlashed = false;
    let wallFlashed = false;

    await tweenParabolic(
      ball,
      start,
      end,
      peakHeight,
      duration,
      this,
      (t, heightFraction) => {
        ball.scale.set(1 - heightFraction * 0.55);
        const groundY = start.y + (end.y - start.y) * t;
        shadow.x = ball.x;
        shadow.y = groundY + 3;
        shadow.scale.set(1 + heightFraction * 0.8);
        shadow.alpha = Math.max(0.05, 0.4 - heightFraction * 0.2);
        this._updateTrail(ball.x, ball.y);

        if (!apexFlashed && t >= 0.48 && t <= 0.52) {
          apexFlashed = true;
          this._spawnSparkle(ball.x, ball.y, 0xd4a843, 16);
        }
        if (!wallFlashed && t >= 0.80) {
          wallFlashed = true;
          this._showScreenFlash(0xffd700, 0.22);
        }
      },
    );

    if (!this._destroyed) {
      shadow.destroy();
      ball.scale.set(1);
    }
    this._animating = false;
  }

  showContactFlash(x: number, y: number): void {
    if (!this.ballLayer || this._destroyed) return;
    this._spawnSparkle(x, y, 0xffffff, 15);
  }

  showHomeRunFlash(): void {
    if (this._destroyed) return;
    this._showScreenFlash(0xffd700, 0.25);
  }

  /** Screen shake effect — rapidly offsets root container. */
  screenShake(intensity: number, durationMs: number): void {
    if (!this.root || this._destroyed) return;
    const root = this.root;
    const origX = root.x;
    const origY = root.y;
    let elapsed = 0;

    const onTick = (ticker: Ticker) => {
      if (this._destroyed) {
        Ticker.shared.remove(onTick);
        root.x = origX;
        root.y = origY;
        return;
      }
      elapsed += ticker.deltaMS;
      if (elapsed >= durationMs) {
        Ticker.shared.remove(onTick);
        root.x = origX;
        root.y = origY;
        return;
      }
      const decay = 1 - elapsed / durationMs;
      root.x = origX + (Math.random() - 0.5) * 2 * intensity * decay;
      root.y = origY + (Math.random() - 0.5) * 2 * intensity * decay;
    };
    Ticker.shared.add(onTick);
  }

  // ── Private effects helpers ───────────────────────────────────────────

  private _spawnSparkle(cx: number, cy: number, color: number, count: number): void {
    if (!this.ballLayer) return;
    const layer = this.ballLayer;

    for (let i = 0; i < count; i++) {
      const spark = new Graphics();
      spark.circle(0, 0, 2);
      spark.fill({ color });
      spark.x = cx;
      spark.y = cy;
      layer.addChild(spark);

      const angle = (i / count) * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      let life = 0;
      const lifetime = 380;

      const onTick = (ticker: Ticker) => {
        if (this._destroyed || spark.destroyed) {
          Ticker.shared.remove(onTick);
          return;
        }
        life += ticker.deltaMS;
        const tl = life / lifetime;
        spark.x += vx;
        spark.y += vy + tl * 0.5;
        spark.alpha = Math.max(0, 1 - tl);
        if (tl >= 1) {
          Ticker.shared.remove(onTick);
          if (spark.parent) spark.parent.removeChild(spark);
          spark.destroy();
        }
      };
      Ticker.shared.add(onTick);
    }
  }

  private _showScreenFlash(color: number, maxAlpha: number): void {
    if (!this.root) return;
    const flash = new Graphics();
    flash.rect(-50, -50, 700, 600);
    flash.fill({ color, alpha: maxAlpha });
    this.root.addChild(flash);

    let life = 0;
    const lifetime = 450;

    const onTick = (ticker: Ticker) => {
      if (this._destroyed || flash.destroyed) {
        Ticker.shared.remove(onTick);
        return;
      }
      life += ticker.deltaMS;
      flash.alpha = maxAlpha * (1 - life / lifetime);
      if (life >= lifetime) {
        Ticker.shared.remove(onTick);
        if (flash.parent) flash.parent.removeChild(flash);
        flash.destroy();
      }
    };
    Ticker.shared.add(onTick);
  }

  // ── Animations (for backwards-compat callers) ─────────────────────────

  animatePitch(): Promise<void> {
    return this.animateBallTravel(
      { x: MOUND_X, y: MOUND_Y },
      { x: HOME_X, y: HOME_Y },
      320,
    );
  }

  animateHit(type: HitType, angle: number, distance: number): Promise<void> {
    const landing = hitLandingPoint(type, angle, distance);
    landing.x = Math.max(20, Math.min(WIDTH - 20, landing.x));
    landing.y = Math.max(20, Math.min(HEIGHT - 20, landing.y));

    const duration = type === 'popup' ? 600 : type === 'home_run' ? 900 : 500;
    return this.animateBallTravel({ x: HOME_X, y: HOME_Y }, landing, duration);
  }

  animateFielding(fielderPos: string): Promise<void> {
    const coord = FIELDER_POSITIONS[fielderPos];
    if (!coord) return Promise.resolve();

    return this.animateBallTravel(
      { x: coord.x, y: coord.y },
      { x: BASE_1_X, y: BASE_1_Y },
      280,
    );
  }

  private animateBallTravel(
    from: { x: number; y: number },
    to: { x: number; y: number },
    durationMs: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!this.ballGraphic || !this.app) {
        resolve();
        return;
      }

      this._animating = true;
      const ball = this.ballGraphic;
      ball.x = from.x;
      ball.y = from.y;
      ball.visible = true;

      let elapsed = 0;

      const onTick = (ticker: Ticker) => {
        if (this._destroyed) {
          this.app?.ticker.remove(onTick);
          resolve();
          return;
        }

        elapsed += ticker.deltaMS;
        const t = Math.min(elapsed / durationMs, 1);
        const ease = 1 - Math.pow(1 - t, 3);

        ball.x = from.x + (to.x - from.x) * ease;
        ball.y = from.y + (to.y - from.y) * ease;

        if (t >= 1) {
          this.app?.ticker.remove(onTick);
          setTimeout(() => {
            if (!this._destroyed && ball.parent) {
              ball.visible = false;
            }
            this._animating = false;
            resolve();
          }, 200);
        }
      };

      this.app.ticker.add(onTick);
    });
  }
}

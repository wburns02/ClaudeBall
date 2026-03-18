import { Application, Graphics, Text, Container, Ticker } from 'pixi.js';
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

// ── Coordinate constants ──────────────────────────────────────────────
// The diamond is rendered in a 600x500 viewport with home plate near the bottom-center.

const WIDTH = 600;
const HEIGHT = 500;

// Home plate anchor — everything radiates from here
const HOME_X = 300;
const HOME_Y = 420;

// Base coordinates (diamond rotated 45°)
const BASE_1_X = 420;
const BASE_1_Y = 300;
const BASE_2_X = 300;
const BASE_2_Y = 190;
const BASE_3_X = 180;
const BASE_3_Y = 300;

// Mound
const MOUND_X = 300;
const MOUND_Y = 310;

// ── Color palette ─────────────────────────────────────────────────────
const COLORS = {
  background: 0x1a2235,
  outfieldGrass: 0x2d5a3d,
  infieldDirt: 0x8b6914,
  white: 0xffffff,
  ball: 0xffffff,
  runner: 0xd4a843,
  fielder: 0xe8e0d4,
  foulLine: 0xffffff,
  mound: 0x8b6914,
  basePath: 0xc4a44a,
  labelText: 0xaaaaaa,
} as const;

// ── Fielder default positions (x, y) ─────────────────────────────────
const FIELDER_POSITIONS: Record<string, { x: number; y: number }> = {
  P: { x: MOUND_X, y: MOUND_Y },
  C: { x: HOME_X, y: HOME_Y + 25 },
  '1B': { x: 410, y: 295 },
  '2B': { x: 355, y: 240 },
  SS: { x: 245, y: 240 },
  '3B': { x: 190, y: 295 },
  LF: { x: 130, y: 150 },
  CF: { x: 300, y: 90 },
  RF: { x: 470, y: 150 },
};

// ── Hit trajectory helpers ────────────────────────────────────────────
type HitType = 'ground_ball' | 'line_drive' | 'fly_ball' | 'popup' | 'home_run';

function hitLandingPoint(
  type: HitType,
  angleDeg: number,
  distance: number,
): { x: number; y: number } {
  // Angle: 0 = straight up center, -45 = left field line, +45 = right field line
  // Distance: 0-1 normalized (1 = fence ~400ft)
  const rad = ((angleDeg - 90) * Math.PI) / 180; // -90 so 0° = up
  const maxDist = type === 'home_run' ? 320 : type === 'popup' ? 80 : 260;
  const d = distance * maxDist;
  return {
    x: HOME_X + Math.cos(rad) * d,
    y: HOME_Y + Math.sin(rad) * d,
  };
}

// ── DiamondRenderer class ─────────────────────────────────────────────

export class DiamondRenderer {
  private app: Application | null = null;
  private root: Container | null = null;

  // Layers
  private grassLayer: Graphics | null = null;
  private dirtLayer: Graphics | null = null;
  private lineLayer: Graphics | null = null;
  private baseLayer: Container | null = null;
  private fielderLayer: Container | null = null;
  private runnerLayer: Container | null = null;
  private ballLayer: Container | null = null;
  private labelLayer: Container | null = null;

  // Player scenes — procedural (always created) and sprite-based (async loaded)
  private playerScene: PlayerScene;
  private spriteScene: SpritePlayerScene | null = null;
  private _spriteMode = false;

  // State
  private fielderDots: Map<string, Graphics> = new Map();
  private fielderLabels: Map<string, Text> = new Map();
  private baseDiamonds: Map<number, Graphics> = new Map();
  private runnerDots: Map<string, Graphics> = new Map();
  private baseHighlights: Map<number, Graphics> = new Map();
  private ballGraphic: Graphics | null = null;

  private _animating = false;
  // Note: _destroyed is not private so it satisfies the tween guard interface { _destroyed: boolean }
  _destroyed = false;

  // ── Constructor ────────────────────────────────────────────────────

  constructor() {
    this.playerScene = new PlayerScene();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────

  /**
   * Initialize Pixi inside a container div — Pixi creates its own canvas element.
   * This avoids React StrictMode WebGL context collision from canvas reuse.
   */
  async initInContainer(container: HTMLDivElement, width: number, height: number): Promise<void> {
    const app = new Application();
    await app.init({
      width,
      height,
      background: COLORS.background,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Guard against destroy() being called during async init (e.g. React StrictMode)
    if (this._destroyed) {
      app.destroy(true, { children: true });
      return;
    }

    // Append Pixi's own canvas into the container div
    container.appendChild(app.canvas);
    (app.canvas as HTMLCanvasElement).style.display = 'block';
    (app.canvas as HTMLCanvasElement).style.width = '100%';
    (app.canvas as HTMLCanvasElement).style.height = '100%';

    this.app = app;
    this.root = new Container();
    app.stage.addChild(this.root);

    // Scale to fit requested size
    const sx = width / WIDTH;
    const sy = height / HEIGHT;
    const scale = Math.min(sx, sy);
    this.root.scale.set(scale);
    this.root.x = (width - WIDTH * scale) / 2;
    this.root.y = (height - HEIGHT * scale) / 2;

    this.createLayers();
    this.drawField();
    this.drawBases();
    this._initProceduralScene(app);

    if (this._destroyed) return;
    this.createBall();
  }

  /** @deprecated Use initInContainer instead */
  async init(canvas: HTMLCanvasElement, width: number, height: number): Promise<void> {
    const app = new Application();
    await app.init({
      canvas,
      width,
      height,
      background: COLORS.background,
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

    this.createLayers();
    this.drawField();
    this.drawBases();
    this._initProceduralScene(app);

    if (this._destroyed) return;
    this.createBall();
  }

  /** Initialize the sync procedural player scene as the default / fallback. */
  private _initProceduralScene(app: Application): void {
    if (!this.fielderLayer) return;
    const layer = this.playerScene.createScene(app);
    this.fielderLayer.addChild(layer);
    this._spriteMode = false;
  }

  /**
   * Asynchronously load sprite sheets and switch to sprite-based players.
   * Call this after `init()` resolves. Falls back to procedural if loading fails.
   * Returns true if sprites loaded successfully, false on failure/abort.
   */
  async loadSprites(): Promise<boolean> {
    if (this._destroyed || !this.fielderLayer) return false;

    try {
      const spriteScene = new SpritePlayerScene();
      const spriteLayer = await spriteScene.createScene(this.app!);

      if (this._destroyed) {
        spriteScene.destroy();
        return false;
      }

      // Add sprite layer above the procedural layer (which stays hidden as fallback)
      if (this.fielderLayer.children.length > 0) {
        this.fielderLayer.children[0].visible = false;
      }
      this.fielderLayer.addChild(spriteLayer);
      this.spriteScene = spriteScene;
      this._spriteMode = true;
      return true;
    } catch (err) {
      console.warn('[DiamondRenderer] Sprite load failed, using procedural figures:', err);
      return false;
    }
  }

  /**
   * Toggle between sprite-based and procedural player figures at runtime.
   * Pass `true` to use sprites (if loaded), `false` for procedural vectors.
   */
  setSpriteMode(enabled: boolean): void {
    if (enabled && this.spriteScene === null) {
      console.warn('[DiamondRenderer] setSpriteMode(true) called but sprites not loaded.');
      return;
    }
    this._spriteMode = enabled;

    // Show/hide the appropriate layers
    // The procedural scene layer is always the first child of fielderLayer,
    // sprite layer (if loaded) is the second child.
    if (this.fielderLayer && this.fielderLayer.children.length >= 2) {
      // First child: procedural layer
      this.fielderLayer.children[0].visible = !enabled;
      // Second child: sprite layer
      this.fielderLayer.children[1].visible = enabled;
    }
  }

  get spriteMode(): boolean {
    return this._spriteMode;
  }

  /** Returns the active SpritePlayerScene when in sprite mode, or null. */
  getSpriteScene(): import('./sprites/SpritePlayerScene.ts').SpritePlayerScene | null {
    return this._spriteMode ? this.spriteScene : null;
  }

  destroy(): void {
    this._destroyed = true;
    // Stop the ticker before destroying scenes to avoid in-flight render errors
    if (this.app) {
      this.app.ticker.stop();
    }
    this.playerScene.destroy();
    this.spriteScene?.destroy();
    this.spriteScene = null;
    if (this.app) {
      // Remove Pixi's canvas from its parent container before destroying,
      // so the next Pixi instance gets a clean container div.
      const canvas = this.app.canvas as HTMLCanvasElement;
      canvas.parentElement?.removeChild(canvas);
      this.app.destroy(true, { children: true });
      this.app = null;
    }
    this.root = null;
    this.fielderDots.clear();
    this.fielderLabels.clear();
    this.baseDiamonds.clear();
    this.runnerDots.clear();
    this.baseHighlights.clear();
    this.ballGraphic = null;
  }

  // ── Layer setup ───────────────────────────────────────────────────

  private createLayers(): void {
    if (!this.root) return;

    this.grassLayer = new Graphics();
    this.dirtLayer = new Graphics();
    this.lineLayer = new Graphics();
    this.baseLayer = new Container();
    this.fielderLayer = new Container();
    this.runnerLayer = new Container();
    this.ballLayer = new Container();
    this.labelLayer = new Container();

    this.root.addChild(this.grassLayer);
    this.root.addChild(this.dirtLayer);
    this.root.addChild(this.lineLayer);
    this.root.addChild(this.baseLayer);
    this.root.addChild(this.fielderLayer);
    this.root.addChild(this.labelLayer);
    this.root.addChild(this.runnerLayer);
    this.root.addChild(this.ballLayer);
  }

  // ── Field drawing ─────────────────────────────────────────────────

  private drawField(): void {
    this.drawOutfieldGrass();
    this.drawInfieldDirt();
    this.drawBasePaths();
    this.drawFoulLines();
    this.drawBatterBoxes();
    this.drawOnDeckCircles();
    this.drawMound();
  }

  private drawOutfieldGrass(): void {
    const g = this.grassLayer;
    if (!g) return;

    // Outfield is a large pie-slice / fan shape from home plate
    g.moveTo(HOME_X, HOME_Y);
    g.lineTo(HOME_X - 320, HOME_Y - 320);
    g.arc(HOME_X, HOME_Y, 340, Math.PI * 1.25, Math.PI * 1.75, false);
    g.lineTo(HOME_X, HOME_Y);
    g.fill({ color: COLORS.outfieldGrass });

    // Infield grass patch — draw directly into the same grassLayer Graphics
    // (instead of inserting a new child at a specific index, which can cause
    // Pixi 8 rendering issues when the layer order shifts after async init)
    g.circle(MOUND_X, MOUND_Y - 10, 28);
    g.fill({ color: COLORS.outfieldGrass });
  }

  private drawInfieldDirt(): void {
    const g = this.dirtLayer;
    if (!g) return;

    // Diamond-shaped infield dirt area (slightly larger than the base paths)
    const pad = 32;
    g.moveTo(HOME_X, HOME_Y + pad);
    g.lineTo(BASE_1_X + pad, BASE_1_Y);
    g.lineTo(BASE_2_X, BASE_2_Y - pad);
    g.lineTo(BASE_3_X - pad, BASE_3_Y);
    g.closePath();
    g.fill({ color: COLORS.infieldDirt });

    // Dirt cutouts around bases (circles at each base)
    g.circle(HOME_X, HOME_Y, 18);
    g.fill({ color: COLORS.infieldDirt });
    g.circle(BASE_1_X, BASE_1_Y, 14);
    g.fill({ color: COLORS.infieldDirt });
    g.circle(BASE_2_X, BASE_2_Y, 14);
    g.fill({ color: COLORS.infieldDirt });
    g.circle(BASE_3_X, BASE_3_Y, 14);
    g.fill({ color: COLORS.infieldDirt });

    // Home plate area — wider dirt arc
    g.moveTo(HOME_X - 60, HOME_Y);
    g.arc(HOME_X, HOME_Y, 60, Math.PI, 0, false);
    g.lineTo(HOME_X - 60, HOME_Y);
    g.fill({ color: COLORS.infieldDirt });
  }

  private drawBasePaths(): void {
    const g = this.lineLayer;
    if (!g) return;

    // Base paths (thin lines connecting bases)
    const pathColor = { width: 1.5, color: COLORS.basePath, alpha: 0.3 };

    g.moveTo(HOME_X, HOME_Y);
    g.lineTo(BASE_1_X, BASE_1_Y);
    g.stroke(pathColor);

    g.moveTo(BASE_1_X, BASE_1_Y);
    g.lineTo(BASE_2_X, BASE_2_Y);
    g.stroke(pathColor);

    g.moveTo(BASE_2_X, BASE_2_Y);
    g.lineTo(BASE_3_X, BASE_3_Y);
    g.stroke(pathColor);

    g.moveTo(BASE_3_X, BASE_3_Y);
    g.lineTo(HOME_X, HOME_Y);
    g.stroke(pathColor);
  }

  private drawFoulLines(): void {
    const g = this.lineLayer;
    if (!g) return;

    const lineStyle = { width: 2, color: COLORS.foulLine, alpha: 0.85 };

    // Left field foul line — from home plate through 3B to the wall
    g.moveTo(HOME_X, HOME_Y);
    g.lineTo(HOME_X - 300, HOME_Y - 300);
    g.stroke(lineStyle);

    // Right field foul line — from home plate through 1B to the wall
    g.moveTo(HOME_X, HOME_Y);
    g.lineTo(HOME_X + 300, HOME_Y - 300);
    g.stroke(lineStyle);
  }

  private drawBatterBoxes(): void {
    const g = this.lineLayer;
    if (!g) return;

    const boxStyle = { width: 1, color: COLORS.white, alpha: 0.5 };
    const boxW = 14;
    const boxH = 28;

    // Left batter's box
    g.rect(HOME_X - boxW - 10, HOME_Y - boxH / 2, boxW, boxH);
    g.stroke(boxStyle);

    // Right batter's box
    g.rect(HOME_X + 10, HOME_Y - boxH / 2, boxW, boxH);
    g.stroke(boxStyle);
  }

  private drawOnDeckCircles(): void {
    const g = this.lineLayer;
    if (!g) return;

    const circleStyle = { width: 1, color: COLORS.white, alpha: 0.3 };

    // Left on-deck circle (behind 3B side)
    g.circle(HOME_X - 90, HOME_Y + 30, 12);
    g.stroke(circleStyle);

    // Right on-deck circle (behind 1B side)
    g.circle(HOME_X + 90, HOME_Y + 30, 12);
    g.stroke(circleStyle);
  }

  private drawMound(): void {
    const g = this.dirtLayer;
    if (!g) return;

    // Pitcher's mound — small dirt circle
    g.circle(MOUND_X, MOUND_Y, 12);
    g.fill({ color: COLORS.mound });

    // Pitching rubber — small white rectangle
    const rubber = new Graphics();
    rubber.rect(MOUND_X - 6, MOUND_Y - 1.5, 12, 3);
    rubber.fill({ color: COLORS.white, alpha: 0.8 });
    this.lineLayer?.addChild(rubber);
  }

  // ── Bases ─────────────────────────────────────────────────────────

  private drawBases(): void {
    if (!this.baseLayer) return;

    const baseSize = 8;
    const coords: [number, { x: number; y: number }][] = [
      [1, { x: BASE_1_X, y: BASE_1_Y }],
      [2, { x: BASE_2_X, y: BASE_2_Y }],
      [3, { x: BASE_3_X, y: BASE_3_Y }],
    ];

    for (const [num, pos] of coords) {
      const g = new Graphics();
      // Draw a rotated square (diamond shape) for each base
      g.moveTo(pos.x, pos.y - baseSize);
      g.lineTo(pos.x + baseSize, pos.y);
      g.lineTo(pos.x, pos.y + baseSize);
      g.lineTo(pos.x - baseSize, pos.y);
      g.closePath();
      g.fill({ color: COLORS.white });
      this.baseLayer.addChild(g);
      this.baseDiamonds.set(num, g);
    }

    // Home plate — pentagon
    const hp = new Graphics();
    const hx = HOME_X;
    const hy = HOME_Y;
    hp.moveTo(hx, hy - 6);
    hp.lineTo(hx + 6, hy - 2);
    hp.lineTo(hx + 6, hy + 4);
    hp.lineTo(hx - 6, hy + 4);
    hp.lineTo(hx - 6, hy - 2);
    hp.closePath();
    hp.fill({ color: COLORS.white });
    this.baseLayer.addChild(hp);
  }

  // ── Fielders ──────────────────────────────────────────────────────

  drawFielders(positions: string[]): void {
    // Delegate to whichever player scene is active
    if (this._spriteMode && this.spriteScene !== null) {
      this.spriteScene.positionFielders(positions);
    } else {
      this.playerScene.positionFielders(positions);
    }

    // Keep labels for positions in the label layer (text overlays remain)
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
          fill: COLORS.labelText,
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

  // ── Public API ────────────────────────────────────────────────────

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
    if (!this.baseLayer) return;

    // Remove previous highlight for this base
    const existing = this.baseHighlights.get(base);
    if (existing) {
      existing.destroy();
      this.baseHighlights.delete(base);
    }

    const coords: Record<number, { x: number; y: number }> = {
      1: { x: BASE_1_X, y: BASE_1_Y },
      2: { x: BASE_2_X, y: BASE_2_Y },
      3: { x: BASE_3_X, y: BASE_3_Y },
    };

    const pos = coords[base];
    if (!pos) return;

    const glow = new Graphics();
    glow.circle(pos.x, pos.y, 16);
    glow.fill({ color: COLORS.runner, alpha: 0.35 });
    this.baseLayer.addChild(glow);
    this.baseHighlights.set(base, glow);

    // Auto-remove highlight after 1.5s
    setTimeout(() => {
      if (!this._destroyed && glow.parent) {
        glow.destroy();
        this.baseHighlights.delete(base);
      }
    }, 1500);
  }

  reset(): void {
    // Clear runners
    for (const dot of this.runnerDots.values()) dot.destroy();
    this.runnerDots.clear();

    // Clear highlights
    for (const glow of this.baseHighlights.values()) glow.destroy();
    this.baseHighlights.clear();

    // Hide ball
    if (this.ballGraphic) {
      this.ballGraphic.visible = false;
    }

    this._animating = false;
  }

  get isAnimating(): boolean {
    return this._animating;
  }

  // ── Ball ──────────────────────────────────────────────────────────

  private createBall(): void {
    if (!this.ballLayer) return;
    const ball = new Graphics();
    ball.circle(0, 0, 4);
    ball.fill({ color: COLORS.ball });
    ball.visible = false;
    this.ballLayer.addChild(ball);
    this.ballGraphic = ball;
  }

  // ── Public ball API (for PlaySequencer) ──────────────────────────

  /** Returns the ball Graphics object. */
  getBall(): Graphics | null {
    return this.ballGraphic;
  }

  /** Make the ball visible. */
  showBall(): void {
    if (this.ballGraphic) this.ballGraphic.visible = true;
  }

  /** Hide the ball immediately. */
  hideBall(): void {
    if (this.ballGraphic) this.ballGraphic.visible = false;
  }

  /** Smoothly fade out and hide the ball. */
  async fadeBall(duration: number): Promise<void> {
    if (!this.ballGraphic) return;
    const ball = this.ballGraphic;
    ball.visible = true;
    await tweenAlpha(ball, ball.alpha, 0, duration, Easing.easeOut, this);
    if (!this._destroyed) ball.visible = false;
    ball.alpha = 1;
  }

  /** Tween ball to target position. */
  async moveBallTo(x: number, y: number, duration: number): Promise<void> {
    if (!this.ballGraphic || this._destroyed) return;
    const ball = this.ballGraphic;
    ball.visible = true;
    await tweenTo(ball, { x, y }, duration, Easing.easeOutCubic, this);
  }

  /**
   * Animate ball along a quadratic bezier path.
   * Ball is made visible at start and stays visible after (caller must hideBall).
   */
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
    ball.visible = true;
    this._animating = true;

    await tweenBezier(ball, start, control, end, duration, Easing.linear, this);

    this._animating = false;
  }

  /**
   * Animate ball along a parabolic arc (fly balls, home runs).
   * Ball scales smaller at apex (depth simulation). Shadow shown beneath.
   */
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
    ball.visible = true;
    this._animating = true;

    // Create shadow
    const shadow = new Graphics();
    shadow.ellipse(0, 0, 5, 3);
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
        // Ball shrinks at apex (depth illusion)
        ball.scale.set(1 - heightFraction * 0.45);
        // Shadow moves along ground line
        const groundY = start.y + (end.y - start.y) * _t;
        shadow.x = ball.x;
        shadow.y = groundY + 3;
        shadow.scale.set(1 + heightFraction * 0.7);
        shadow.alpha = Math.max(0.05, 0.35 - heightFraction * 0.2);
      },
    );

    if (!this._destroyed) {
      shadow.destroy();
      ball.scale.set(1);
    }
    this._animating = false;
  }

  /**
   * Animate ball as a rolling/bouncing ground ball.
   */
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
    ball.visible = true;
    this._animating = true;

    await tweenGround(ball, start, end, duration, exitVelo, this);

    this._animating = false;
  }

  /**
   * Home-run ball arc — travels out of the park with apex sparkle and wall flash.
   */
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
    ball.visible = true;
    this._animating = true;

    const shadow = new Graphics();
    shadow.ellipse(0, 0, 5, 3);
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
        shadow.alpha = Math.max(0, 0.35 - heightFraction * 0.2);

        if (!apexFlashed && t >= 0.48 && t <= 0.52) {
          apexFlashed = true;
          this._spawnSparkle(ball.x, ball.y, 0xd4a843, 12);
        }
        if (!wallFlashed && t >= 0.80) {
          wallFlashed = true;
          this._showScreenFlash(0xffd700, 0.18);
        }
      },
    );

    if (!this._destroyed) {
      shadow.destroy();
      ball.scale.set(1);
    }
    this._animating = false;
  }

  /**
   * Show a contact flash (spark burst) at the bat-ball contact point.
   */
  showContactFlash(x: number, y: number): void {
    if (!this.ballLayer || this._destroyed) return;
    this._spawnSparkle(x, y, 0xffffff, 10);
  }

  /**
   * Show a brief golden screen flash for home runs.
   */
  showHomeRunFlash(): void {
    if (this._destroyed) return;
    this._showScreenFlash(0xffd700, 0.22);
  }

  // ── Private effects helpers ───────────────────────────────────────

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

  // ── Animations ────────────────────────────────────────────────────

  animatePitch(): Promise<void> {
    return this.animateBallTravel(
      { x: MOUND_X, y: MOUND_Y },
      { x: HOME_X, y: HOME_Y },
      320, // duration ms
    );
  }

  animateHit(type: HitType, angle: number, distance: number): Promise<void> {
    const landing = hitLandingPoint(type, angle, distance);

    // Clamp landing point inside viewport
    landing.x = Math.max(20, Math.min(WIDTH - 20, landing.x));
    landing.y = Math.max(20, Math.min(HEIGHT - 20, landing.y));

    const duration = type === 'popup' ? 600 : type === 'home_run' ? 900 : 500;

    return this.animateBallTravel(
      { x: HOME_X, y: HOME_Y },
      landing,
      duration,
    );
  }

  animateFielding(fielderPos: string): Promise<void> {
    const coord = FIELDER_POSITIONS[fielderPos];
    if (!coord) return Promise.resolve();

    // Animate the fielder's throw to 1B (most common)
    return this.animateBallTravel(
      { x: coord.x, y: coord.y },
      { x: BASE_1_X, y: BASE_1_Y },
      280,
    );
  }

  // ── Core ball animation ───────────────────────────────────────────

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

        // Ease-out cubic
        const ease = 1 - Math.pow(1 - t, 3);

        ball.x = from.x + (to.x - from.x) * ease;
        ball.y = from.y + (to.y - from.y) * ease;

        if (t >= 1) {
          this.app?.ticker.remove(onTick);
          // Hold the ball briefly at landing, then hide
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

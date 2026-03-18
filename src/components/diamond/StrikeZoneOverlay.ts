import { Container, Graphics, Ticker } from 'pixi.js';
import type { Application } from 'pixi.js';

// ── Constants ─────────────────────────────────────────────────────────

/** Strike zone dimensions in Pixi world-space pixels. */
const ZONE_WIDTH = 52;
const ZONE_HEIGHT = 64;
const CELL_COLS = 3;
const CELL_ROWS = 3;
const CELL_W = ZONE_WIDTH / CELL_COLS;
const CELL_H = ZONE_HEIGHT / CELL_ROWS;

/** Zone is centered on home plate. Center offset from home plate anchor. */
const ZONE_OFFSET_Y = -38; // above home plate

const COLORS = {
  zoneBorder:     0xe8e0d4, // cream
  zoneBorderAlpha: 0.30,
  innerCell:      0xe8e0d4,
  innerCellAlpha: 0.06,
  strikeLocDot:   0xd4a843, // gold
  ballLocDot:     0x4d8ac4, // blue
  targetDot:      0xe8e0d4, // cream
  cellHighlight:  0xd4a843,
} as const;

const FADE_DURATION = 200; // ms for show/hide fade

export interface ZonePoint {
  /** 0.0–1.0 normalized within the strike zone (0,0 = top-left). */
  x: number;
  y: number;
}

// ── StrikeZoneOverlay ─────────────────────────────────────────────────

/**
 * Pixi.js overlay that draws a 3×3 semi-transparent strike zone grid
 * anchored to home plate.
 *
 * Usage:
 *   const zone = new StrikeZoneOverlay(app, { x: 300, y: 420 });
 *   zone.show();
 *   zone.highlightCell(1, 1);
 *   zone.showPitchResult(target, actual, inZone);
 *   zone.hide();
 *   zone.destroy();
 */
export class StrikeZoneOverlay {
  private app: Application;
  private container: Container;
  private zoneGraphics: Graphics;
  private cellHighlightGraphics: Graphics;
  private locationDots: Graphics;

  /** Top-left corner of the zone in world space. */
  private zoneX: number;
  private zoneY: number;

  private _visible = false;
  private _alpha = 0;
  private _targetAlpha = 0;

  constructor(app: Application, homePos: { x: number; y: number }) {
    this.app = app;
    this.zoneX = homePos.x - ZONE_WIDTH / 2;
    this.zoneY = homePos.y + ZONE_OFFSET_Y - ZONE_HEIGHT / 2;

    this.container = new Container();
    this.container.alpha = 0;
    this.app.stage.addChild(this.container);

    this.zoneGraphics = new Graphics();
    this.cellHighlightGraphics = new Graphics();
    this.locationDots = new Graphics();

    this.container.addChild(this.zoneGraphics);
    this.container.addChild(this.cellHighlightGraphics);
    this.container.addChild(this.locationDots);

    this.drawZoneGrid();
    this.startFadeTicker();
  }

  // ── Drawing ──────────────────────────────────────────────────────

  private drawZoneGrid(): void {
    const g = this.zoneGraphics;
    g.clear();

    const x0 = this.zoneX;
    const y0 = this.zoneY;

    // Fill the inner center cell subtly
    g.rect(x0 + CELL_W, y0 + CELL_H, CELL_W, CELL_H);
    g.fill({ color: COLORS.innerCell, alpha: COLORS.innerCellAlpha });

    // Outer border
    g.rect(x0, y0, ZONE_WIDTH, ZONE_HEIGHT);
    g.stroke({ width: 1.5, color: COLORS.zoneBorder, alpha: COLORS.zoneBorderAlpha });

    // Internal grid lines (2 horizontal + 2 vertical)
    for (let col = 1; col < CELL_COLS; col++) {
      g.moveTo(x0 + col * CELL_W, y0);
      g.lineTo(x0 + col * CELL_W, y0 + ZONE_HEIGHT);
      g.stroke({ width: 0.8, color: COLORS.zoneBorder, alpha: COLORS.zoneBorderAlpha * 0.6 });
    }
    for (let row = 1; row < CELL_ROWS; row++) {
      g.moveTo(x0, y0 + row * CELL_H);
      g.lineTo(x0 + ZONE_WIDTH, y0 + row * CELL_H);
      g.stroke({ width: 0.8, color: COLORS.zoneBorder, alpha: COLORS.zoneBorderAlpha * 0.6 });
    }
  }

  // ── Fade ticker ───────────────────────────────────────────────────

  private startFadeTicker(): void {
    const onTick = (ticker: Ticker) => {
      if (this._alpha === this._targetAlpha) return;

      const step = (ticker.deltaMS / FADE_DURATION);
      if (this._targetAlpha > this._alpha) {
        this._alpha = Math.min(this._alpha + step, this._targetAlpha);
      } else {
        this._alpha = Math.max(this._alpha - step, this._targetAlpha);
      }
      this.container.alpha = this._alpha;
    };

    this.app.ticker.add(onTick);
    // Store for cleanup — we keep a reference via closure; destroy() will handle it.
    (this as unknown as { _fadeTick: typeof onTick })._fadeTick = onTick;
  }

  // ── Public API ────────────────────────────────────────────────────

  /** Fade the zone in. */
  show(): void {
    this._visible = true;
    this._targetAlpha = 1;
    this.container.visible = true;
  }

  /** Fade the zone out. */
  hide(): void {
    this._visible = false;
    this._targetAlpha = 0;
  }

  get isVisible(): boolean {
    return this._visible;
  }

  /**
   * Briefly highlight one 3×3 cell (row/col 0-based).
   * Fades out automatically after 600ms.
   */
  highlightCell(row: number, col: number): void {
    const g = this.cellHighlightGraphics;
    g.clear();

    const clampedRow = Math.max(0, Math.min(CELL_ROWS - 1, row));
    const clampedCol = Math.max(0, Math.min(CELL_COLS - 1, col));

    const cx = this.zoneX + clampedCol * CELL_W;
    const cy = this.zoneY + clampedRow * CELL_H;

    g.rect(cx, cy, CELL_W, CELL_H);
    g.fill({ color: COLORS.cellHighlight, alpha: 0.45 });

    setTimeout(() => {
      g.clear();
    }, 600);
  }

  /**
   * Show where the pitch crossed: where the pitcher aimed (targetPos)
   * vs where it actually went (actualPos). Both are normalized zone coords 0–1.
   *
   * Gold dot = strike location. Blue dot = ball location.
   */
  showPitchResult(
    targetPos: ZonePoint,
    actualPos: ZonePoint,
    inZone: boolean,
  ): void {
    const g = this.locationDots;
    g.clear();

    const toWorld = (pt: ZonePoint) => ({
      x: this.zoneX + pt.x * ZONE_WIDTH,
      y: this.zoneY + pt.y * ZONE_HEIGHT,
    });

    // Target dot (cream, smaller)
    const tw = toWorld(targetPos);
    g.circle(tw.x, tw.y, 3);
    g.fill({ color: COLORS.targetDot, alpha: 0.5 });

    // Actual location dot
    const aw = toWorld(actualPos);
    const dotColor = inZone ? COLORS.strikeLocDot : COLORS.ballLocDot;
    g.circle(aw.x, aw.y, 4.5);
    g.fill({ color: dotColor, alpha: 0.95 });

    // Ring around actual
    g.circle(aw.x, aw.y, 6);
    g.stroke({ width: 1, color: dotColor, alpha: 0.4 });

    // Auto-clear after 1.2s
    setTimeout(() => {
      g.clear();
    }, 1200);
  }

  /** Remove from stage and clean up. */
  destroy(): void {
    const fadeTick = (this as unknown as { _fadeTick?: (t: Ticker) => void })._fadeTick;
    if (fadeTick) this.app.ticker.remove(fadeTick);
    this.container.destroy({ children: true });
  }
}

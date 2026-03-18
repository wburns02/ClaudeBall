// ── PlayerScene.ts ────────────────────────────────────────────────────────
// Manages all player figures on the diamond: fielders, batter, catcher,
// umpire, and base runners.

import type { Application } from 'pixi.js';
import { Container } from 'pixi.js';
import { PlayerFigure } from './PlayerFigure.ts';
import { createUmpireFigure } from './UmpireAnimation.ts';
import type { Position } from '@/engine/types/enums.ts';

// ── Coordinate constants (mirror DiamondRenderer) ─────────────────────────
// Tuned for gameplayfield2.png (behind-home-plate perspective).

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
  P:   { x: MOUND_X, y: MOUND_Y },
  C:   { x: HOME_X, y: HOME_Y + 22 },
  '1B': { x: 382, y: 330 },
  '2B': { x: 345, y: 268 },
  SS:  { x: 255, y: 268 },
  '3B': { x: 218, y: 330 },
  LF:  { x: 150, y: 158 },
  CF:  { x: 300, y: 100 },
  RF:  { x: 450, y: 158 },
};

// Scale factors for depth perspective
const FIELDER_SCALES: Record<string, number> = {
  P:   0.95,
  C:   1.0,
  '1B': 0.95,
  '2B': 0.88,
  SS:  0.88,
  '3B': 0.95,
  LF:  0.78,
  CF:  0.75,
  RF:  0.78,
};

// ── Team color defaults ────────────────────────────────────────────────────

const DEFAULT_HOME_COLOR = '#1a3a6c';   // navy
const DEFAULT_HOME_ALT = '#d4a843';     // gold
const DEFAULT_AWAY_COLOR = '#8b1a1a';   // red
const DEFAULT_AWAY_ALT = '#f5f5f5';     // white

// ── PlayerScene class ─────────────────────────────────────────────────────

export class PlayerScene {
  private layer: Container;

  // Figure maps
  private fielders: Map<string, PlayerFigure> = new Map();
  private runners: Map<number, PlayerFigure> = new Map();
  private _batter: PlayerFigure | null = null;
  private _catcher: PlayerFigure | null = null;
  private _umpire: PlayerFigure | null = null;

  // Team colors
  private homeColor: string;
  private homeAlt: string;
  private awayColor: string;
  private awayAlt: string;

  constructor() {
    this.layer = new Container();
    this.homeColor = DEFAULT_HOME_COLOR;
    this.homeAlt = DEFAULT_HOME_ALT;
    this.awayColor = DEFAULT_AWAY_COLOR;
    this.awayAlt = DEFAULT_AWAY_ALT;
  }

  // ── Setup ──────────────────────────────────────────────────────────

  createScene(
    _app: Application,
    homeTeamColor: string = DEFAULT_HOME_COLOR,
    awayTeamColor: string = DEFAULT_AWAY_COLOR,
    homeAltColor: string = DEFAULT_HOME_ALT,
    awayAltColor: string = DEFAULT_AWAY_ALT,
  ): Container {
    this.homeColor = homeTeamColor;
    this.homeAlt = homeAltColor;
    this.awayColor = awayTeamColor;
    this.awayAlt = awayAltColor;

    // Create all 9 fielders (home team on defense)
    this.positionFielders(['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']);

    // Create batter (away team batting)
    this.setBatter(false);

    // Catcher (home team, already a fielder but we track separately)
    this._catcher = this.fielders.get('C') ?? null;

    // Umpire
    this.setUmpire();

    return this.layer;
  }

  // ── Fielders ──────────────────────────────────────────────────────

  positionFielders(positions: string[]): void {
    // Clear existing fielders
    for (const fig of this.fielders.values()) {
      this.layer.removeChild(fig.getContainer());
      fig.destroy();
    }
    this.fielders.clear();

    for (const pos of positions) {
      const coord = FIELDER_DEFAULTS[pos];
      if (!coord) continue;

      const scale = FIELDER_SCALES[pos] ?? 0.9;
      const fig = new PlayerFigure(this.homeColor, this.homeAlt, false);
      fig.setPosition(coord.x, coord.y);
      fig.setScale(scale);
      fig.setPose('fielding_ready');

      // Pitcher faces home plate
      if (pos === 'P') {
        fig.setFacing('down');
      }
      // Outfielders face inward
      if (['LF', 'CF', 'RF'].includes(pos)) {
        fig.setPose('ready');
        fig.setScale(scale);
      }

      this.fielders.set(pos, fig);
      this.layer.addChild(fig.getContainer());
    }

    // Re-attach catcher reference
    this._catcher = this.fielders.get('C') ?? null;
  }

  // ── Batter ────────────────────────────────────────────────────────

  setBatter(isLeftHanded: boolean): void {
    if (this._batter) {
      this.layer.removeChild(this._batter.getContainer());
      this._batter.destroy();
    }

    const batter = new PlayerFigure(this.awayColor, this.awayAlt, isLeftHanded);

    // Position in left or right batter's box
    const batterX = isLeftHanded ? HOME_X + 18 : HOME_X - 18;
    const batterY = HOME_Y - 5;

    batter.setPosition(batterX, batterY);
    batter.setPose('batting_stance');
    batter.setFacing(isLeftHanded ? 'right' : 'left');
    batter.setScale(1.0);

    this._batter = batter;
    this.layer.addChild(batter.getContainer());
  }

  // ── Catcher ───────────────────────────────────────────────────────

  setCatcher(): void {
    // Catcher is already created as part of fielders
    if (this._catcher) {
      this._catcher.setPose('catcher_crouch');
    }
  }

  // ── Umpire ────────────────────────────────────────────────────────

  setUmpire(): void {
    if (this._umpire) {
      this.layer.removeChild(this._umpire.getContainer());
      this._umpire.destroy();
    }

    const umpire = createUmpireFigure();
    umpire.setPosition(HOME_X, HOME_Y + 35);
    umpire.setPose('crouch');
    umpire.setScale(0.95);

    this._umpire = umpire;
    this.layer.addChild(umpire.getContainer());
  }

  // ── Runners ───────────────────────────────────────────────────────

  addRunner(base: number): PlayerFigure {
    // Remove existing runner at that base if any
    this.removeRunner(base);

    const baseCoords: Record<number, { x: number; y: number }> = {
      0: { x: HOME_X, y: HOME_Y },
      1: { x: BASE_1_X, y: BASE_1_Y - 12 },
      2: { x: BASE_2_X, y: BASE_2_Y - 12 },
      3: { x: BASE_3_X, y: BASE_3_Y - 12 },
    };

    const coord = baseCoords[base] ?? { x: HOME_X, y: HOME_Y };
    const runner = new PlayerFigure(this.awayColor, this.awayAlt, false);
    runner.setPosition(coord.x, coord.y);
    runner.setPose('ready');
    runner.setScale(0.95);

    this.runners.set(base, runner);
    this.layer.addChild(runner.getContainer());
    return runner;
  }

  removeRunner(base: number): void {
    const runner = this.runners.get(base);
    if (runner) {
      this.layer.removeChild(runner.getContainer());
      runner.destroy();
      this.runners.delete(base);
    }
  }

  clearRunners(): void {
    for (const base of this.runners.keys()) {
      this.removeRunner(base);
    }
  }

  // ── Getters ───────────────────────────────────────────────────────

  getFielder(position: Position): PlayerFigure | null {
    return this.fielders.get(position) ?? null;
  }

  getFielderByKey(key: string): PlayerFigure | null {
    return this.fielders.get(key) ?? null;
  }

  getBatter(): PlayerFigure | null {
    return this._batter;
  }

  getCatcher(): PlayerFigure | null {
    return this._catcher;
  }

  getUmpire(): PlayerFigure | null {
    return this._umpire;
  }

  getRunner(base: number): PlayerFigure | null {
    return this.runners.get(base) ?? null;
  }

  getLayer(): Container {
    return this.layer;
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  destroy(): void {
    for (const fig of this.fielders.values()) fig.destroy();
    this.fielders.clear();

    for (const runner of this.runners.values()) runner.destroy();
    this.runners.clear();

    this._batter?.destroy();
    this._batter = null;

    this._umpire?.destroy();
    this._umpire = null;

    this._catcher = null;

    this.layer.destroy({ children: true });
  }
}

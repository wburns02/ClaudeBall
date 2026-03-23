// ── PlaySequencer.ts ──────────────────────────────────────────────────────────
// Orchestrates every on-field play as a fully choreographed animation sequence.
// Each public method is an async chain that awaits every step in order and
// ALWAYS resolves — no hanging promises.
//
// Coordinate constants (mirror DiamondRenderer):
//   HOME_X=300  HOME_Y=420   MOUND_X=300  MOUND_Y=310
//   BASE_1_X=420 BASE_1_Y=300  BASE_2_X=300 BASE_2_Y=190  BASE_3_X=180 BASE_3_Y=300
//   Outfield: LF(130,150) CF(300,90) RF(470,150)

import type { GameEvent } from '@/engine/types/index.ts';
import type { DiamondRenderer } from './DiamondRenderer.ts';
import type { SpritePlayerScene } from './sprites/SpritePlayerScene.ts';
import { delay } from './Tween.ts';
import type { Point } from './Tween.ts';
import { soundEngine, crowdAmbience } from '@/audio/index.ts';
import {
  spawnBatCrack,
  spawnDustCloud,
  spawnCatchPop,
  spawnSlideSpray,
  spawnStrikeoutK,
  spawnHomeRunFireworks,
} from './effects/index.ts';
import { Sprite, Ticker } from 'pixi.js';
import { HOMERUN_EFFECT_FRAMES, DUST_CROP_RECTS } from './sprites/SpriteConfig.ts';
import type { AtBatCamera } from './AtBatCamera.ts';
import type { AtBatOverlayState } from '../game/AtBatOverlay.tsx';

// ── Coordinate constants ──────────────────────────────────────────────────────
// Mirrors DiamondRenderer.ts — tuned for gameplayfield2.png positions.
//   HOME_X=300  HOME_Y=425   MOUND_X=300  MOUND_Y=310
//   BASE_1_X=390 BASE_1_Y=335  BASE_2_X=300 BASE_2_Y=235  BASE_3_X=210 BASE_3_Y=335
//   Outfield: LF(150,158) CF(300,100) RF(450,158)

const WIDTH = 600;
const HEIGHT = 500;
const HOME_X = 300;
const HOME_Y = 425;
const MOUND_X = 300;
const MOUND_Y = 310;
const BASE_1_X = 390;
const BASE_1_Y = 335;
const BASE_2_X = 300;
const BASE_2_Y = 235;
const BASE_3_X = 210;
const BASE_3_Y = 335;

const FIELDER_POSITIONS: Record<string, Point> = {
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

// ── PitchType config for bezier curves (matches PitchAnimator.ts) ─────────────

interface BezierConfig {
  ctrlOffsetX: number;
  ctrlOffsetY: number;
}

const PITCH_BEZIER: Record<string, BezierConfig> = {
  fastball:    { ctrlOffsetX: 0,    ctrlOffsetY: -8  },
  sinker:      { ctrlOffsetX: 4,    ctrlOffsetY: 20  },
  cutter:      { ctrlOffsetX: -14,  ctrlOffsetY: 0   },
  slider:      { ctrlOffsetX: -30,  ctrlOffsetY: 10  },
  curveball:   { ctrlOffsetX: 10,   ctrlOffsetY: -50 },
  changeup:    { ctrlOffsetX: 6,    ctrlOffsetY: 5   },
  splitter:    { ctrlOffsetX: 0,    ctrlOffsetY: 40  },
  knuckleball: { ctrlOffsetX: 18,   ctrlOffsetY: 18  },
};

// ── Pitch-type color map (for ball glow + trail) ─────────────────────────────

const PITCH_COLORS: Record<string, number> = {
  fastball:    0xFF4444,   // red
  sinker:      0xFF6633,   // orange-red
  cutter:      0xFF8800,   // orange
  slider:      0x4488FF,   // blue
  curveball:   0x44CC44,   // green
  changeup:    0xFFCC00,   // yellow
  splitter:    0xCC44FF,   // purple
  knuckleball: 0xFFFFFF,   // white (unpredictable)
};

// ── Spray angle helpers ───────────────────────────────────────────────────────

/** Derive a deterministic angle (-40 to +40°) from a description string. */
function hashAngle(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return ((Math.abs(h) % 80) - 40);
}

function sprayLandingPoint(angleDeg: number, distNorm: number, maxDist = 260): Point {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const d = distNorm * maxDist;
  return {
    x: HOME_X + Math.cos(rad) * d,
    y: HOME_Y + Math.sin(rad) * d,
  };
}

function pickInfielder(angle: number): string {
  if (angle < -20) return '3B';
  if (angle > 20) return '1B';
  return angle < 0 ? 'SS' : '2B';
}

function pickOutfielder(angle: number): string {
  if (angle < -20) return 'LF';
  if (angle > 20) return 'RF';
  return 'CF';
}

// ── PlaySequencer ─────────────────────────────────────────────────────────────

export class PlaySequencer {
  private renderer: DiamondRenderer;

  /** Speed multiplier: 1.0 = normal, 2.0 = 2× faster, 0 = instant skip */
  speedFactor = 1.0;

  /** When true, all animations are skipped (instant state updates only). */
  skipAnimations = false;

  private _destroyed = false;

  /** Optional camera controller for at-bat zoom. Set externally after init. */
  camera: AtBatCamera | null = null;

  /** Optional callback to push overlay state updates to React. Set externally. */
  onOverlayUpdate: ((state: Partial<AtBatOverlayState>) => void) | null = null;

  /** Tracks overlay state (accumulated across calls). */
  private _overlayState: AtBatOverlayState = {
    visible: false,
    pitchType: '',
    pitchSpeedMph: 0,
    resultText: '',
    balls: 0,
    strikes: 0,
    batterName: '',
    pitcherName: '',
    pitchCount: 0,
  };

  /** Incremental pitch count per sequencer instance. */
  private _pitchCount = 0;

  /** Track first pitch of at-bat for camera zoom-in (only zoom on first pitch). */
  private _isFirstPitchOfAB = true;

  /** Track at-bat pitch count for between-pitch ritual (skip ritual on first pitch). */
  private _abPitchIndex = 0;

  /** Current batter name for detecting new at-bats. */
  private _currentBatterName = '';

  constructor(renderer: DiamondRenderer) {
    this.renderer = renderer;
  }

  destroy(): void {
    this._destroyed = true;
    this.camera = null;
    this.onOverlayUpdate = null;
  }

  // ── Overlay helpers ────────────────────────────────────────────────────────

  private _updateOverlay(patch: Partial<AtBatOverlayState>): void {
    this._overlayState = { ...this._overlayState, ...patch };
    this.onOverlayUpdate?.(this._overlayState);
  }

  private _showPitchFlash(pitchType: string, speedMph: number): void {
    this._pitchCount++;
    this._updateOverlay({
      pitchType,
      pitchSpeedMph: speedMph,
      pitchCount: this._pitchCount,
      // Clear any prior result
      resultText: '',
    });
  }

  private _showResultFlash(text: string): void {
    this._updateOverlay({ resultText: text, pitchType: '', pitchSpeedMph: 0 });
  }

  /** Set batter/pitcher names for the overlay HUD. Detects new at-bats. */
  setAtBatNames(batterName: string, pitcherName: string): void {
    if (batterName && batterName !== this._currentBatterName) {
      this._currentBatterName = batterName;
      this._isFirstPitchOfAB = true;
      this._abPitchIndex = 0;
    }
    this._updateOverlay({ batterName, pitcherName });
  }

  /** Reset pitch count (call at start of each new pitcher appearance). */
  resetPitchCount(): void {
    this._pitchCount = 0;
  }

  // ── Duration helper ────────────────────────────────────────────────────────

  private dur(ms: number): number {
    if (this.skipAnimations) return 0;
    return ms / Math.max(0.1, this.speedFactor);
  }

  // ── Effects layer helper ───────────────────────────────────────────────────
  // Returns the effects Container so particle spawners can use it as parent.

  private _fx() {
    return this.renderer.getEffectsLayer();
  }

  // ── Main dispatch ──────────────────────────────────────────────────────────

  /** Primary entry point — dispatches the correct sequence for any GameEvent. */
  async playEvent(event: GameEvent): Promise<void> {
    if (this._destroyed) return;

    switch (event.type) {
      case 'pitch':
        // Update overlay count from event data
        this._updateOverlay({ balls: event.balls, strikes: event.strikes });
        await this._dispatchPitchEvent(event);
        break;

      case 'at_bat_result':
        await this._dispatchAtBatResult(event);
        break;

      case 'inning_change':
        await this.playInningChange();
        break;

      default:
        break;
    }
  }

  // ── Pitch event dispatch ────────────────────────────────────────────────────

  private async _dispatchPitchEvent(
    event: Extract<GameEvent, { type: 'pitch' }>,
  ): Promise<void> {
    const result = event.result;
    const pitchType = event.pitchType ?? 'fastball';

    if (result === 'ball') {
      await this.playBallPitch(pitchType);
    } else if (result === 'called_strike') {
      await this.playStrikeCalled(pitchType);
    } else if (result === 'swinging_strike' || result === 'strike') {
      await this.playStrikeSwinging(pitchType);
    } else if (result === 'foul') {
      await this.playFoulBall(pitchType);
    } else {
      await this.playBallPitch(pitchType);
    }
  }

  // ── At-bat result dispatch ─────────────────────────────────────────────────

  private async _dispatchAtBatResult(
    event: Extract<GameEvent, { type: 'at_bat_result' }>,
  ): Promise<void> {
    const result = event.result;
    const angle = hashAngle(event.description);

    if (result === 'strikeout') {
      await this.playStrikeout(false);
    } else if (result === 'walk' || result === 'hit_by_pitch') {
      await this.playWalk();
    } else if (result === 'home_run') {
      await this.playHomeRun(0.9 + Math.random() * 0.1);
    } else if (result === 'single') {
      await this.playBallInPlay('single', pickInfielder(angle), 0.4);
    } else if (result === 'double') {
      await this.playBallInPlay('double', pickOutfielder(angle), 0.65);
    } else if (result === 'triple') {
      await this.playBallInPlay('triple', pickOutfielder(angle), 0.85);
    } else if (result === 'groundout' || result === 'double_play' || result === 'fielders_choice') {
      await this.playBallInPlay('groundout', pickInfielder(angle), 0.3);
    } else if (result === 'flyout' || result === 'sacrifice_fly') {
      await this.playBallInPlay('flyout', pickOutfielder(angle), 0.55);
    } else if (result === 'lineout') {
      await this.playBallInPlay('lineout', pickInfielder(angle), 0.35);
    } else if (result === 'popout' || result === 'sacrifice_bunt') {
      await this.playBallInPlay('popout', 'SS', 0.2);
    } else {
      // Generic catch-all
      await this.playBallInPlay('groundout', 'SS', 0.3);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Choreographed sequences ──────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  // ── Ball pitch (~2800ms) ──────────────────────────────────────────────────
  // 1. Between-pitch ritual (400ms, skip on first pitch of AB)
  // 2. Pitcher winds up (1200ms)
  // 3. Ball travels to plate (650ms)
  // 4. Catcher receives (200ms)
  // 5. Umpire calls ball (500ms)
  // 6. Result hold (300ms)

  async playBallPitch(pitchType = 'fastball'): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();

    // Between-pitch ritual (skip on first pitch of AB)
    await this._betweenPitchRitual();

    // Zoom to at-bat view (only on first pitch of AB)
    await this._zoomInForPitch();
    this._showPitchFlash(pitchType, this._randomPitchSpeed(pitchType));

    // Set ball color for pitch type
    this.renderer.setBallColor(PITCH_COLORS[pitchType] ?? 0xFFFFFF);

    // Pitcher windup
    await this._pitcherWindup(ss);
    if (this._destroyed) return;

    // Ball travels — whoosh when released
    soundEngine.playPitchThrow();
    await this._throwBallToPlate(pitchType);
    if (this._destroyed) return;

    // Catcher receives (leather pop), umpire calls ball
    soundEngine.playBallInGlove();
    spawnCatchPop(this.renderer.getApp()!, HOME_X, HOME_Y, this._fx());
    await this._catcherReceive(ss);

    if (!this._destroyed && ss) {
      await ss.animateUmpireBallCall();
    }
    soundEngine.playUmpireBall();
    this._showResultFlash('BALL!');

    this.renderer.hideBall();
    await delay(this.dur(400));
  }

  // ── Called strike (~2800ms) ────────────────────────────────────────────────

  async playStrikeCalled(pitchType = 'fastball'): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();

    await this._betweenPitchRitual();
    await this._zoomInForPitch();
    this._showPitchFlash(pitchType, this._randomPitchSpeed(pitchType));
    this.renderer.setBallColor(PITCH_COLORS[pitchType] ?? 0xFFFFFF);

    await this._pitcherWindup(ss);
    if (this._destroyed) return;

    soundEngine.playPitchThrow();
    await this._throwBallToPlate(pitchType);
    if (this._destroyed) return;

    soundEngine.playBallInGlove();
    spawnCatchPop(this.renderer.getApp()!, HOME_X, HOME_Y, this._fx());
    await this._catcherReceive(ss);
    if (this._destroyed) return;

    soundEngine.playUmpireStrike();
    this._showResultFlash('STRIKE!');
    if (ss) await ss.animateUmpireStrikeCall();

    // Build crowd on 2-strike counts
    if (this._overlayState.strikes >= 2) {
      soundEngine.playCrowdBuild(1200);
      crowdAmbience.setIntensity(7);
    }

    this.renderer.hideBall();
    await delay(this.dur(400));
  }

  // ── Swinging strike (~3000ms) ─────────────────────────────────────────────

  async playStrikeSwinging(pitchType = 'slider'): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();

    await this._betweenPitchRitual();
    await this._zoomInForPitch();
    this._showPitchFlash(pitchType, this._randomPitchSpeed(pitchType));
    this.renderer.setBallColor(PITCH_COLORS[pitchType] ?? 0xFFFFFF);

    await this._pitcherWindup(ss);
    if (this._destroyed) return;

    // Ball and swing run concurrently; swing fires slightly after ball starts
    soundEngine.playPitchThrow();
    const ballPromise = this._throwBallToPlate(pitchType);
    const swingPromise = (async () => {
      await delay(this.dur(350));
      soundEngine.playStrikeoutSwing();
      if (!this._destroyed && ss) await ss.animateBatterSwing('late');
    })();

    await Promise.all([ballPromise, swingPromise]);
    if (this._destroyed) return;

    soundEngine.playUmpireStrike();
    this._showResultFlash('STRIKE!');
    spawnCatchPop(this.renderer.getApp()!, HOME_X, HOME_Y, this._fx());
    await this._catcherReceive(ss);

    // Build crowd on 2-strike counts
    if (this._overlayState.strikes >= 2) {
      soundEngine.playCrowdBuild(1000);
      crowdAmbience.setIntensity(7);
    }

    this.renderer.hideBall();
    await delay(this.dur(400));
  }

  // ── Foul ball (~3000ms) ────────────────────────────────────────────────────

  async playFoulBall(pitchType = 'curveball'): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();

    await this._betweenPitchRitual();
    await this._zoomInForPitch();
    this._showPitchFlash(pitchType, this._randomPitchSpeed(pitchType));
    this.renderer.setBallColor(PITCH_COLORS[pitchType] ?? 0xFFFFFF);

    await this._pitcherWindup(ss);
    if (this._destroyed) return;

    const ballPromise = this._throwBallToPlate(pitchType);
    const swingPromise = (async () => {
      await delay(this.dur(360));
      if (!this._destroyed && ss) await ss.animateBatterSwing('normal');
    })();
    await Promise.all([ballPromise, swingPromise]);
    if (this._destroyed) return;

    // Contact flash + bat crack + screen shake
    this._showResultFlash('FOUL!');
    this.renderer.showContactFlash(HOME_X, HOME_Y - 10);
    this.renderer.screenShake(2, 100);
    soundEngine.playBatCrack();
    soundEngine.playCrowdOoh();
    spawnBatCrack(this.renderer.getApp()!, HOME_X, HOME_Y - 10, this._fx());

    // Ball pops foul
    const foulTarget: Point = { x: HOME_X + 80 + Math.random() * 40, y: HOME_Y + 30 };
    await this._animateFoulBall(foulTarget);

    await delay(this.dur(400));
    this.renderer.hideBall();
  }

  // ── Ball in play ───────────────────────────────────────────────────────────
  // Covers: groundout, single, double, triple, flyout, lineout, popout

  async playBallInPlay(
    hitType: string,
    fielderPos: string,
    distNorm: number,
  ): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();
    const angle = 0;

    // Between-pitch ritual + zoom
    await this._betweenPitchRitual();
    await this._zoomInForPitch();

    // Pick a realistic pitch type for contact plays
    const pitchTypes = ['fastball', 'slider', 'curveball', 'changeup', 'sinker', 'cutter'];
    const contactPitch = pitchTypes[Math.floor(Math.random() * pitchTypes.length)] ?? 'fastball';
    this._showPitchFlash(contactPitch, this._randomPitchSpeed(contactPitch));
    this.renderer.setBallColor(PITCH_COLORS[contactPitch] ?? 0xFFFFFF);

    // Pitcher winds up
    await this._pitcherWindup(ss);
    if (this._destroyed) return;

    // Ball to plate, batter swings simultaneously
    soundEngine.playPitchThrow();
    const ballToPlate = this._throwBallToPlate(contactPitch);
    const swingDelay = (async () => {
      await delay(this.dur(350));
      if (!this._destroyed && ss) await ss.animateBatterSwing('perfect');
    })();
    await Promise.all([ballToPlate, swingDelay]);
    if (this._destroyed) return;

    // Contact flash + bat crack + screen shake + crowd ooh
    this._showResultFlash('IN PLAY!');
    this.renderer.showContactFlash(HOME_X - 10, HOME_Y - 15);
    this.renderer.screenShake(3, 150);
    soundEngine.playBatCrack();
    soundEngine.playCrowdOoh();
    spawnBatCrack(this.renderer.getApp()!, HOME_X - 10, HOME_Y - 15, this._fx());

    // Reset crowd after 2-strike build
    crowdAmbience.setIntensity(5);

    // Zoom back to field so we can see the ball in play
    void this._zoomOutToField(this.dur(500));

    // Route based on hit type
    if (hitType === 'groundout' || hitType === 'fielders_choice' || hitType === 'double_play') {
      await this._playGroundout(fielderPos, angle, distNorm, ss);
    } else if (hitType === 'single') {
      if (ss) void ss.animateBatterRunning?.();
      soundEngine.playCrowdGroan();
      await this._playSingle(fielderPos, angle, distNorm, ss);
    } else if (hitType === 'double' || hitType === 'triple') {
      if (ss) void ss.animateBatterRunning?.();
      soundEngine.playCrowdCheer('medium');
      await this._playExtraBase(fielderPos, angle, distNorm, ss, hitType);
    } else if (hitType === 'flyout' || hitType === 'lineout') {
      await this._playFlyout(fielderPos, angle, distNorm, ss);
    } else if (hitType === 'popout') {
      await this._playPopout(fielderPos, ss);
    } else {
      await this._playGroundout(fielderPos, angle, distNorm, ss);
    }

    this.renderer.hideBall();
    // Post-play pause
    await delay(this.dur(400));
  }

  // ── Home run (~6000ms) ─────────────────────────────────────────────────────
  // Dramatic full sequence with camera tracking and crowd eruption.

  async playHomeRun(distance: number): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();
    const angle = (Math.random() - 0.5) * 40;

    // Between-pitch ritual + zoom
    await this._betweenPitchRitual();
    await this._zoomInForPitch();

    const pitchType = 'fastball';
    this._showPitchFlash(pitchType, this._randomPitchSpeed(pitchType));
    this.renderer.setBallColor(PITCH_COLORS[pitchType] ?? 0xFF4444);

    await this._pitcherWindup(ss);
    if (this._destroyed) return;

    soundEngine.playPitchThrow();
    const ballToPlate = this._throwBallToPlate(pitchType);
    const swingDelay = (async () => {
      await delay(this.dur(330));
      if (!this._destroyed && ss) await ss.animateBatterSwing('perfect');
    })();
    await Promise.all([ballToPlate, swingDelay]);
    if (this._destroyed) return;

    // BIG contact flash + screen shake + bat crack
    this._showResultFlash('HOME RUN!');
    this.renderer.showContactFlash(HOME_X - 12, HOME_Y - 18);
    this.renderer.showHomeRunFlash();
    this.renderer.screenShake(5, 200);
    soundEngine.playBatCrack(1.4);
    spawnBatCrack(this.renderer.getApp()!, HOME_X - 12, HOME_Y - 18, this._fx());
    if (ss) {
      void ss.animateBatterRunning?.();
      // Animate runner doing full home run trot (fire-and-forget)
      ss.addRunner(0);
      void (async () => {
        await ss.animateRunnerAdvance(0, 1);
        if (!this._destroyed) await ss.animateRunnerAdvance(1, 2);
        if (!this._destroyed) await ss.animateRunnerAdvance(2, 3);
        if (!this._destroyed) ss.removeRunner(3); // crosses home
      })();
    }

    // Quick zoom out to field (400ms), then pan to follow ball
    this._updateOverlay({ visible: false });
    await this._zoomOutToField(this.dur(400));

    // Pan camera to outfield to follow ball arc
    const outfieldDir = angle < -10 ? 'left' : angle > 10 ? 'right' : 'center';
    const panTarget = outfieldDir === 'left' ? { x: 150, y: 158 }
      : outfieldDir === 'right' ? { x: 450, y: 158 }
      : { x: 300, y: 100 };
    void this.camera?.panToPoint(panTarget.x, panTarget.y, 1.3, this.dur(700));

    // Ball arcs out of the park
    await this.renderer.animateBallHomeRun(angle, distance);
    if (this._destroyed) return;

    // Crowd eruption + horn blast
    crowdAmbience.spike(10, 3000, 5);
    soundEngine.playCrowdCheer('roar');
    soundEngine.playHomeRunHorn();

    const hrApp = this.renderer.getApp();
    if (hrApp) {
      spawnHomeRunFireworks(hrApp, 600, 500, this._fx());
    }

    const spriteEffectsPromise = this._playHomeRunSpriteEffects();

    await delay(this.dur(300));
    this.renderer.hideBall();

    // Slow pull back to full field (1000ms)
    void this._zoomOutToField(this.dur(1000));

    // Wait for celebration + dramatic hold
    await spriteEffectsPromise;
    await delay(this.dur(1500));
  }

  // ── Strikeout (~2000ms after last pitch) ──────────────────────────────────
  // Dramatic umpire punch-out with crowd eruption and camera hold.

  async playStrikeout(looking: boolean): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();

    this._showResultFlash('STRIKEOUT!');

    if (!looking && ss) {
      await ss.animateBatterSwing('late');
      if (this._destroyed) return;
    }

    // Dramatic K flash
    spawnStrikeoutK(this.renderer.getApp()!, HOME_X, HOME_Y - 60, looking, this._fx());

    // Crowd eruption + umpire call
    crowdAmbience.spike(9, 2000, 4);
    soundEngine.playCrowdCheer('roar');

    if (ss) {
      await ss.animateUmpireStrikeCall();
      if (this._destroyed) return;
      // Hold the dramatic zoom for longer
      await delay(this.dur(1000));
    } else {
      await delay(this.dur(1200));
    }

    // Zoom back out for next batter
    await this._zoomOutToField(this.dur(600));
    // Dramatic post-strikeout pause
    await delay(this.dur(500));
  }

  // ── Walk (~1200ms) ─────────────────────────────────────────────────────────

  async playWalk(): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();

    this._showResultFlash('WALK!');
    crowdAmbience.setIntensity(4);

    if (ss) {
      await ss.animateBatterTake();
      if (this._destroyed) return;
    }

    await delay(this.dur(500));

    // Slow zoom out as batter walks to first
    await this._zoomOutToField(this.dur(600));
    await delay(this.dur(300));
  }

  // ── Inning change (~1200ms) ────────────────────────────────────────────────

  async playInningChange(): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();

    // Reset at-bat tracking for new half-inning
    this._isFirstPitchOfAB = true;
    this._abPitchIndex = 0;
    this._currentBatterName = '';

    // Smooth zoom out instead of snap
    if (this.camera) {
      this._updateOverlay({ visible: false, resultText: '', pitchType: '', pitchSpeedMph: 0 });
      if (this.camera.isZoomedIn) {
        await this.camera.zoomToField(this.dur(500));
      } else {
        this.camera.snapToField();
      }
    }

    this.renderer.reset();
    if (ss) ss.resetToReady();

    // Between-inning atmosphere: organ charge + crowd swell
    soundEngine.playOrganCharge();
    crowdAmbience.spike(6, 800, 4);
    soundEngine.playCrowdCheer('light');

    await delay(this.dur(600));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Internal sub-sequences ───────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  // ── Camera zoom helpers ───────────────────────────────────────────────────

  private async _zoomInForPitch(): Promise<void> {
    if (!this.camera || this.skipAnimations) return;
    this._updateOverlay({ visible: true });
    // Zoom in if not already zoomed — stay zoomed between pitches in same AB
    if (!this.camera.isZoomedIn) {
      await this.camera.zoomToAtBat(this.dur(700));
    }
  }

  private async _zoomOutToField(durationMs?: number): Promise<void> {
    if (!this.camera || this.skipAnimations) return;
    this._updateOverlay({ visible: false, resultText: '', pitchType: '', pitchSpeedMph: 0 });
    await this.camera.zoomToField(durationMs ?? this.dur(700));
  }

  // ── Between-pitch ritual ─────────────────────────────────────────────────
  // Adds a brief pause between pitches representing batter stepping in and
  // pitcher getting the sign. Skipped on the first pitch of the at-bat.

  private async _betweenPitchRitual(): Promise<void> {
    if (this._destroyed || this.skipAnimations) return;
    this._abPitchIndex++;
    if (this._abPitchIndex <= 1) return; // Skip on first pitch of AB

    // Batter steps in (300ms) + pitcher gets sign (300ms)
    await delay(this.dur(300));
    if (this._destroyed) return;
    await delay(this.dur(300));
  }

  // ── Batter walkup for new batters ──────────────────────────────────────

  private async _playBatterWalkup(): Promise<void> {
    if (this._destroyed || this.skipAnimations) return;
    const ss = this.renderer.getSpriteScene();
    if (!ss) return;
    await ss.animateBatterWalkup();
  }

  // ── Random pitch speed for flash display ──────────────────────────────────
  private _randomPitchSpeed(pitchType: string): number {
    const ranges: Record<string, [number, number]> = {
      fastball: [89, 97],
      slider: [80, 88],
      curveball: [72, 80],
      changeup: [78, 86],
      sinker: [87, 94],
      cutter: [85, 92],
    };
    const [lo, hi] = ranges[pitchType] ?? [80, 95];
    return Math.round(lo + Math.random() * (hi - lo));
  }

  // ── Pitcher windup helper ─────────────────────────────────────────────────

  private async _pitcherWindup(ss: SpritePlayerScene | null): Promise<void> {
    if (this._destroyed) return;
    if (ss) {
      await ss.animatePitcherWindup();
    } else {
      await delay(this.dur(1000));
    }
  }

  // ── Ball pitch along bezier to plate ──────────────────────────────────────

  private async _throwBallToPlate(pitchType: string): Promise<void> {
    if (this._destroyed) return;

    const cfg = PITCH_BEZIER[pitchType] ?? PITCH_BEZIER.fastball!;
    const start: Point = { x: MOUND_X, y: MOUND_Y };
    const end: Point   = { x: HOME_X,  y: HOME_Y  };
    const mid: Point   = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const ctrl: Point  = {
      x: mid.x + (cfg?.ctrlOffsetX ?? 0),
      y: mid.y + (cfg?.ctrlOffsetY ?? 0),
    };

    await this.renderer.animateBallBezier(start, ctrl, end, this.dur(650));
  }

  // ── Catcher receive frame swap ─────────────────────────────────────────────

  private async _catcherReceive(ss: SpritePlayerScene | null): Promise<void> {
    if (this._destroyed) return;
    if (ss) {
      await ss.animateCatcherReceive();
    } else {
      await delay(this.dur(100));
    }
  }

  // ── Foul ball trajectory (pops to the side) ───────────────────────────────

  private async _animateFoulBall(target: Point): Promise<void> {
    if (this._destroyed) return;

    const start: Point = { x: HOME_X, y: HOME_Y };
    const ctrl: Point  = { x: (start.x + target.x) / 2, y: HOME_Y - 60 };

    await this.renderer.animateBallBezier(start, ctrl, target, this.dur(380));
    await this.renderer.fadeBall(this.dur(150));
  }

  // ── Groundout sub-sequence ────────────────────────────────────────────────
  // Ball rolls toward fielder, fielder fields + throws to 1B

  private async _playGroundout(
    fielderPos: string,
    angle: number,
    distNorm: number,
    ss: SpritePlayerScene | null,
  ): Promise<void> {
    if (this._destroyed) return;

    const landing = sprayLandingPoint(angle, distNorm, 200);
    const clampedLanding = {
      x: Math.max(50, Math.min(550, landing.x)),
      y: Math.max(50, Math.min(450, landing.y)),
    };

    const fielderCoord = FIELDER_POSITIONS[fielderPos] ?? FIELDER_POSITIONS.SS!;

    // Fielder starts running to ball landing point concurrently with ball rolling
    const fielderMovePromise = ss
      ? ss.moveFielderTo(fielderPos, clampedLanding.x, clampedLanding.y, this.dur(450))
      : Promise.resolve();

    await Promise.all([
      this.renderer.animateBallGround(
        { x: HOME_X, y: HOME_Y },
        clampedLanding,
        this.dur(550),
      ),
      fielderMovePromise,
    ]);
    if (this._destroyed) return;

    // Dust cloud where ball hits the dirt
    spawnDustCloud(this.renderer.getApp()!, clampedLanding.x, clampedLanding.y, 'medium', this._fx());
    void this._spawnSpriteDust(clampedLanding.x, clampedLanding.y, 'mediumPuff', 350);

    // Fielder catch animation
    const fielderAnim = ss ? ss.animateFielderCatch(fielderPos) : Promise.resolve();
    await fielderAnim;
    if (this._destroyed) return;

    spawnCatchPop(this.renderer.getApp()!, clampedLanding.x, clampedLanding.y, this._fx());
    soundEngine.playBallInGlove();

    // Fielder throws to 1B
    if (ss) {
      const throwAnim = ss.animateFielderThrow(fielderPos);
      const ballAnim = this.renderer.animateBallBezier(
        clampedLanding,
        { x: (clampedLanding.x + BASE_1_X) / 2, y: (clampedLanding.y + BASE_1_Y) / 2 - 20 },
        { x: BASE_1_X, y: BASE_1_Y },
        this.dur(380),
      );
      await Promise.all([throwAnim, ballAnim]);
    } else {
      await this.renderer.animateBallBezier(
        clampedLanding,
        { x: (clampedLanding.x + BASE_1_X) / 2, y: (clampedLanding.y + BASE_1_Y) / 2 - 20 },
        { x: BASE_1_X, y: BASE_1_Y },
        this.dur(380),
      );
    }

    // Catch at 1B
    spawnCatchPop(this.renderer.getApp()!, BASE_1_X, BASE_1_Y, this._fx());
    spawnDustCloud(this.renderer.getApp()!, BASE_1_X, BASE_1_Y, 'light', this._fx());
    soundEngine.playBallInGlove();
    soundEngine.playCrowdCheer('light');

    // Fire-and-forget: fielder returns to default position
    if (ss) void ss.resetFielderPosition(fielderPos, this.dur(500));

    await delay(this.dur(350));
  }

  // ── Single sub-sequence ───────────────────────────────────────────────────
  // Ball gets through infield, outfielder runs to it

  private async _playSingle(
    fielderPos: string,
    angle: number,
    distNorm: number,
    ss: SpritePlayerScene | null,
  ): Promise<void> {
    if (this._destroyed) return;

    const landing = sprayLandingPoint(angle, distNorm, 230);
    const clamped = {
      x: Math.max(30, Math.min(570, landing.x)),
      y: Math.max(30, Math.min(460, landing.y)),
    };

    // Pan camera slightly toward where the ball is going
    if (this.camera) {
      void this.camera.panToPoint(
        (HOME_X + clamped.x) / 2,
        (HOME_Y + clamped.y) / 2,
        1.15,
        this.dur(600),
      );
    }

    // Outfielder runs to the ball concurrently with ball rolling
    const fielderMovePromise = ss
      ? ss.moveFielderTo(fielderPos, clamped.x, clamped.y, this.dur(550))
      : Promise.resolve();

    await Promise.all([
      this.renderer.animateBallGround(
        { x: HOME_X, y: HOME_Y },
        clamped,
        this.dur(600),
      ),
      fielderMovePromise,
    ]);
    if (this._destroyed) return;

    // Animate batter running to 1B concurrently with fielder catching
    if (ss) {
      // Add batter as runner heading to 1B
      ss.addRunner(0); // runner at home
      void ss.animateRunnerAdvance(0, 1); // fire-and-forget: home → 1B
    }

    // Outfielder catches the ball
    const catchAnim = ss ? ss.animateFielderCatch(fielderPos) : Promise.resolve();
    await catchAnim;
    soundEngine.playBallInGlove();
    spawnCatchPop(this.renderer.getApp()!, clamped.x, clamped.y, this._fx());
    spawnDustCloud(this.renderer.getApp()!, BASE_1_X, BASE_1_Y, 'light', this._fx());

    // Fire-and-forget: fielder returns
    if (ss) void ss.resetFielderPosition(fielderPos, this.dur(600));

    if (this._destroyed) return;
    await delay(this.dur(300));
  }

  // ── Extra-base hit (double/triple) ────────────────────────────────────────

  private async _playExtraBase(
    fielderPos: string,
    angle: number,
    distNorm: number,
    ss: SpritePlayerScene | null,
    hitType: string,
  ): Promise<void> {
    if (this._destroyed) return;

    const landing = sprayLandingPoint(angle, distNorm, 260);
    const clamped = {
      x: Math.max(20, Math.min(580, landing.x)),
      y: Math.max(20, Math.min(470, landing.y)),
    };

    // Pan camera to follow the ball into the gap
    if (this.camera) {
      void this.camera.panToPoint(clamped.x, clamped.y, 1.2, this.dur(700));
    }

    // Line drive arc
    const ctrl: Point = {
      x: (HOME_X + clamped.x) / 2,
      y: HOME_Y - 30,
    };

    // Fielder runs deep to retrieve
    const fielderMovePromise = ss
      ? ss.moveFielderTo(fielderPos, clamped.x, clamped.y, this.dur(600))
      : Promise.resolve();

    await Promise.all([
      this.renderer.animateBallBezier(
        { x: HOME_X, y: HOME_Y },
        ctrl,
        clamped,
        this.dur(hitType === 'triple' ? 650 : 550),
      ),
      fielderMovePromise,
    ]);
    if (this._destroyed) return;

    // Animate batter running the bases concurrently with fielder catching
    if (ss) {
      ss.addRunner(0); // runner at home
      if (hitType === 'triple') {
        // Run home → 1B → 2B → 3B
        void (async () => {
          await ss.animateRunnerAdvance(0, 1);
          if (!this._destroyed) await ss.animateRunnerAdvance(1, 2);
          if (!this._destroyed) await ss.animateRunnerAdvance(2, 3);
        })();
      } else {
        // Double: run home → 1B → 2B
        void (async () => {
          await ss.animateRunnerAdvance(0, 1);
          if (!this._destroyed) await ss.animateRunnerAdvance(1, 2);
        })();
      }
    }

    const catchAnim = ss ? ss.animateFielderCatch(fielderPos) : Promise.resolve();
    await catchAnim;
    soundEngine.playBallInGlove();
    if (this._destroyed) return;

    // Slide spray at the destination base
    const slideBase = hitType === 'triple'
      ? { x: BASE_3_X, y: BASE_3_Y }
      : { x: BASE_2_X, y: BASE_2_Y };
    const slideDir = hitType === 'triple' ? 'right' : 'left';
    spawnSlideSpray(this.renderer.getApp()!, slideBase.x, slideBase.y, slideDir, this._fx());
    spawnDustCloud(this.renderer.getApp()!, slideBase.x, slideBase.y, 'heavy', this._fx());

    // Fire-and-forget: fielder returns
    if (ss) void ss.resetFielderPosition(fielderPos, this.dur(700));

    await delay(this.dur(400));
  }

  // ── Flyout sub-sequence ───────────────────────────────────────────────────

  private async _playFlyout(
    fielderPos: string,
    angle: number,
    distNorm: number,
    ss: SpritePlayerScene | null,
  ): Promise<void> {
    if (this._destroyed) return;

    const landing = sprayLandingPoint(angle, distNorm, 250);
    const clamped = {
      x: Math.max(20, Math.min(580, landing.x)),
      y: Math.max(20, Math.min(460, landing.y)),
    };

    // Subtle camera pan toward the fielder
    if (this.camera) {
      void this.camera.panToPoint(
        (HOME_X + clamped.x) / 2,
        (HOME_Y + clamped.y) / 2,
        1.1,
        this.dur(600),
      );
    }

    // Fielder runs to landing spot concurrently with ball arc
    const fielderMovePromise = ss
      ? ss.moveFielderTo(fielderPos, clamped.x, clamped.y, this.dur(650))
      : Promise.resolve();

    await Promise.all([
      this.renderer.animateBallParabolic(
        { x: HOME_X, y: HOME_Y },
        clamped,
        80 + distNorm * 40,
        this.dur(850),
      ),
      fielderMovePromise,
    ]);
    if (this._destroyed) return;

    // Fielder catches — crowd cheers
    const catchAnim = ss ? ss.animateFielderCatch(fielderPos) : Promise.resolve();
    await catchAnim;
    soundEngine.playBallInGlove();
    soundEngine.playCrowdCheer('medium');
    spawnCatchPop(this.renderer.getApp()!, clamped.x, clamped.y, this._fx());

    // Fire-and-forget: fielder returns
    if (ss) void ss.resetFielderPosition(fielderPos, this.dur(600));

    if (this._destroyed) return;
    await delay(this.dur(350));
  }

  // ── Popout sub-sequence ───────────────────────────────────────────────────

  private async _playPopout(
    fielderPos: string,
    ss: SpritePlayerScene | null,
  ): Promise<void> {
    if (this._destroyed) return;

    const popTarget: Point = {
      x: HOME_X + (Math.random() - 0.5) * 50,
      y: HOME_Y - 35,
    };

    // Infielder drifts to the pop-up landing point
    const fielderMovePromise = ss
      ? ss.moveFielderTo(fielderPos, popTarget.x, popTarget.y, this.dur(500))
      : Promise.resolve();

    await Promise.all([
      this.renderer.animateBallParabolic(
        { x: HOME_X, y: HOME_Y },
        popTarget,
        100,
        this.dur(1000),
      ),
      fielderMovePromise,
    ]);
    if (this._destroyed) return;

    const catchAnim = ss ? ss.animateFielderCatch(fielderPos) : Promise.resolve();
    await catchAnim;
    soundEngine.playBallInGlove();
    soundEngine.playCrowdCheer('light');
    spawnCatchPop(this.renderer.getApp()!, popTarget.x, popTarget.y, this._fx());

    // Fire-and-forget: fielder returns
    if (ss) void ss.resetFielderPosition(fielderPos, this.dur(400));

    if (this._destroyed) return;
    await delay(this.dur(300));
  }

  // ── Sprite-based home-run celebration overlay ─────────────────────────────
  // Shows the 6 homerun1.png frames as overlays in sequence.
  // Frame 5 ("HOME RUN!" text) is displayed prominently center-screen for 2s.

  private async _playHomeRunSpriteEffects(): Promise<void> {
    if (this._destroyed) return;

    const assets = await this.renderer.getSceneAssets();
    if (!assets || assets.homerunFrames.length === 0) return;

    const app = this.renderer.getApp();
    const fx = this._fx();
    if (!app || !fx) return;

    const frames = assets.homerunFrames;
    const fxKeys = Object.keys(HOMERUN_EFFECT_FRAMES) as (keyof typeof HOMERUN_EFFECT_FRAMES)[];

    // Show firework frames (0–3) briefly as scattered overlays, staggered
    const fireworkIndices = [
      HOMERUN_EFFECT_FRAMES.goldFirework,
      HOMERUN_EFFECT_FRAMES.colorFirework,
      HOMERUN_EFFECT_FRAMES.confetti,
      HOMERUN_EFFECT_FRAMES.starBurst,
    ];

    for (const idx of fireworkIndices) {
      if (this._destroyed) return;
      const tex = frames[idx];
      if (!tex || tex === undefined) continue;

      const sprite = new Sprite(tex);
      // Random position in upper half of field
      const sw = 80 + Math.random() * 60;
      sprite.width = sw;
      sprite.height = sw * (tex.height / tex.width);
      sprite.x = 60 + Math.random() * (WIDTH - 180);
      sprite.y = 30 + Math.random() * 140;
      sprite.alpha = 0;
      fx.addChild(sprite);

      // Fade in quickly, hold, fade out
      void this._fadeSprite(sprite, 150, 300, 250);
      await delay(this.dur(120));
    }

    if (this._destroyed) return;

    // Show "HOME RUN!" text (frame 5) prominently centered for 2 seconds
    const textTex = frames[HOMERUN_EFFECT_FRAMES.homeRunText];
    if (textTex) {
      const textSprite = new Sprite(textTex);
      const tsW = 220;
      const tsH = tsW * (textTex.height / textTex.width);
      textSprite.width = tsW;
      textSprite.height = tsH;
      textSprite.x = WIDTH / 2 - tsW / 2;
      textSprite.y = HEIGHT / 2 - tsH / 2 - 40; // slightly above center
      textSprite.alpha = 0;
      fx.addChild(textSprite);
      await this._fadeSprite(textSprite, 200, this.dur(1800), 400);
    }

    // Crowd wave (frame 4) at the top
    if (!this._destroyed) {
      const waveTex = frames[HOMERUN_EFFECT_FRAMES.crowdWave];
      if (waveTex) {
        const wave = new Sprite(waveTex);
        wave.width = WIDTH;
        wave.height = 60;
        wave.x = 0;
        wave.y = 0;
        wave.alpha = 0;
        fx.addChild(wave);
        void this._fadeSprite(wave, 300, this.dur(1200), 500);
      }
    }

    // Wait for "HOME RUN!" text to finish
    await delay(this.dur(2400));
    void fxKeys; // satisfy lint (used for type narrowing above)
  }

  /** Fade a sprite in → hold → fade out, then destroy it. Non-blocking helper. */
  private async _fadeSprite(
    sprite: Sprite,
    fadeInMs: number,
    holdMs: number,
    fadeOutMs: number,
  ): Promise<void> {
    // Fade in
    await this._animateAlpha(sprite, 0, 1, fadeInMs);
    if (this._destroyed || sprite.destroyed) return;
    // Hold
    await delay(holdMs);
    if (this._destroyed || sprite.destroyed) return;
    // Fade out
    await this._animateAlpha(sprite, 1, 0, fadeOutMs);
    if (!sprite.destroyed && sprite.parent) {
      sprite.parent.removeChild(sprite);
      sprite.destroy();
    }
  }

  private _animateAlpha(
    target: { alpha: number; destroyed?: boolean },
    from: number,
    to: number,
    durationMs: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      let elapsed = 0;
      target.alpha = from;
      const onTick = (ticker: Ticker) => {
        if (this._destroyed || (target.destroyed)) {
          Ticker.shared.remove(onTick);
          resolve();
          return;
        }
        elapsed += ticker.deltaMS;
        const t = Math.min(elapsed / Math.max(1, durationMs), 1);
        target.alpha = from + (to - from) * t;
        if (t >= 1) {
          Ticker.shared.remove(onTick);
          resolve();
        }
      };
      Ticker.shared.add(onTick);
    });
  }

  // ── Sprite-based dust overlay ─────────────────────────────────────────────
  // Shows a dust sprite from dirtdust2.png at (x, y) and fades it out.

  private async _spawnSpriteDust(
    x: number,
    y: number,
    dustKey: keyof typeof DUST_CROP_RECTS = 'mediumPuff',
    holdMs = 350,
  ): Promise<void> {
    if (this._destroyed) return;

    const assets = await this.renderer.getSceneAssets();
    if (!assets) return;

    const tex = assets.dustTextures[dustKey];
    if (!tex) return;

    const fx = this._fx();
    if (!fx) return;

    const sprite = new Sprite(tex);
    const sw = 50;
    sprite.width = sw;
    sprite.height = sw * (tex.height / Math.max(1, tex.width));
    sprite.x = x - sw / 2;
    sprite.y = y - sprite.height / 2;
    sprite.alpha = 0;
    fx.addChild(sprite);

    void this._fadeSprite(sprite, 80, holdMs, 300);
  }
}

// ── Augment SpritePlayerScene with new helpers ────────────────────────────────
// We duck-punch the type here so the sequencer can call methods we'll add below.
// The actual implementations live in SpritePlayerScene.ts additions.

declare module './sprites/SpritePlayerScene.ts' {
  interface SpritePlayerScene {
    animateCatcherReceive(): Promise<void>;
  }
}

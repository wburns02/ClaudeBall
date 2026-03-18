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
import { soundEngine } from '@/audio/index.ts';

// ── Coordinate constants ──────────────────────────────────────────────────────

const HOME_X = 300;
const HOME_Y = 420;
const MOUND_X = 300;
const MOUND_Y = 310;
const BASE_1_X = 420;
const BASE_1_Y = 300;

const FIELDER_POSITIONS: Record<string, Point> = {
  P:    { x: MOUND_X,  y: MOUND_Y },
  C:    { x: HOME_X,   y: HOME_Y + 25 },
  '1B': { x: 410,      y: 295 },
  '2B': { x: 355,      y: 240 },
  SS:   { x: 245,      y: 240 },
  '3B': { x: 190,      y: 295 },
  LF:   { x: 130,      y: 150 },
  CF:   { x: 300,      y: 90 },
  RF:   { x: 470,      y: 150 },
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

  constructor(renderer: DiamondRenderer) {
    this.renderer = renderer;
  }

  destroy(): void {
    this._destroyed = true;
  }

  // ── Duration helper ────────────────────────────────────────────────────────

  private dur(ms: number): number {
    if (this.skipAnimations) return 0;
    return ms / Math.max(0.1, this.speedFactor);
  }

  // ── Main dispatch ──────────────────────────────────────────────────────────

  /** Primary entry point — dispatches the correct sequence for any GameEvent. */
  async playEvent(event: GameEvent): Promise<void> {
    if (this._destroyed) return;

    switch (event.type) {
      case 'pitch':
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

    if (result === 'ball') {
      await this.playBallPitch();
    } else if (result === 'called_strike') {
      await this.playStrikeCalled();
    } else if (result === 'swinging_strike' || result === 'strike') {
      await this.playStrikeSwinging();
    } else if (result === 'foul') {
      await this.playFoulBall();
    } else {
      // Fallback: plain pitch
      await this.playBallPitch();
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

  // ── Ball pitch (~1500ms) ──────────────────────────────────────────────────
  // 1. Pitcher winds up (600ms)
  // 2. Ball travels to plate (400ms)
  // 3. Catcher receives (100ms)
  // 4. Umpire calls ball (400ms)

  async playBallPitch(): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();

    // Step 1: pitcher windup
    await this._pitcherWindup(ss);

    if (this._destroyed) return;

    // Step 2: ball travels — whoosh when released
    soundEngine.playPitchThrow();
    await this._throwBallToPlate('fastball');

    if (this._destroyed) return;

    // Step 3 + 4: catcher receives (leather pop), umpire calls ball
    soundEngine.playBallInGlove();
    await Promise.all([
      this._catcherReceive(ss),
      delay(this.dur(50)),
    ]);

    if (!this._destroyed && ss) {
      await ss.animateUmpireBallCall();
    }
    soundEngine.playUmpireBall();

    this.renderer.hideBall();
  }

  // ── Called strike (~1500ms) ────────────────────────────────────────────────
  // Same as ball pitch but umpire does strike call

  async playStrikeCalled(): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();

    await this._pitcherWindup(ss);
    if (this._destroyed) return;

    soundEngine.playPitchThrow();
    await this._throwBallToPlate('fastball');
    if (this._destroyed) return;

    soundEngine.playBallInGlove();
    await this._catcherReceive(ss);
    if (this._destroyed) return;

    soundEngine.playUmpireStrike();
    if (ss) await ss.animateUmpireStrikeCall();

    this.renderer.hideBall();
  }

  // ── Swinging strike (~1500ms) ─────────────────────────────────────────────
  // 1. Pitcher winds up (600ms)
  // 2. Ball travels — batter swing fires at ~300ms mark (350ms)
  // 3. Catcher catches (100ms)
  // 4. Brief pause (150ms)

  async playStrikeSwinging(): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();

    await this._pitcherWindup(ss);
    if (this._destroyed) return;

    // Ball and swing run concurrently; swing fires slightly after ball starts
    soundEngine.playPitchThrow();
    const ballPromise = this._throwBallToPlate('fastball');
    const swingPromise = (async () => {
      await delay(this.dur(280));
      soundEngine.playStrikeoutSwing();
      if (!this._destroyed && ss) await ss.animateBatterSwing('late');
    })();

    await Promise.all([ballPromise, swingPromise]);
    if (this._destroyed) return;

    soundEngine.playUmpireStrike();
    await this._catcherReceive(ss);
    await delay(this.dur(150));

    this.renderer.hideBall();
  }

  // ── Foul ball (~1800ms) ────────────────────────────────────────────────────
  // 1. Pitcher winds up (600ms)
  // 2. Ball to plate (350ms), batter swings (fire at 300ms)
  // 3. Contact flash at plate
  // 4. Ball pops off to foul territory and fades (400ms)
  // 5. Reset (200ms)

  async playFoulBall(): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();

    await this._pitcherWindup(ss);
    if (this._destroyed) return;

    const ballPromise = this._throwBallToPlate('fastball');
    const swingPromise = (async () => {
      await delay(this.dur(290));
      if (!this._destroyed && ss) await ss.animateBatterSwing('normal');
    })();
    await Promise.all([ballPromise, swingPromise]);
    if (this._destroyed) return;

    // Contact flash at plate
    this.renderer.showContactFlash(HOME_X, HOME_Y - 10);
    soundEngine.playBatCrack();

    // Ball pops foul — to the right side (1B side)
    const foulTarget: Point = { x: HOME_X + 80 + Math.random() * 40, y: HOME_Y + 30 };
    await this._animateFoulBall(foulTarget);

    await delay(this.dur(200));
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
    const angle = 0; // neutral angle for generic plays

    // Step 1: pitcher winds up (shorter for contact plays)
    if (ss) {
      await ss.animatePitcherWindup();
    } else {
      await delay(this.dur(500));
    }
    if (this._destroyed) return;

    // Step 2: ball to plate, batter swings simultaneously
    const ballToPlate = this._throwBallToPlate('fastball');
    const swingDelay = (async () => {
      await delay(this.dur(280));
      if (!this._destroyed && ss) await ss.animateBatterSwing('perfect');
    })();
    await Promise.all([ballToPlate, swingDelay]);
    if (this._destroyed) return;

    // Step 3: contact flash + bat crack sound
    this.renderer.showContactFlash(HOME_X - 10, HOME_Y - 15);
    soundEngine.playBatCrack();

    // Step 4+: route based on hit type
    if (hitType === 'groundout' || hitType === 'fielders_choice' || hitType === 'double_play') {
      await this._playGroundout(fielderPos, angle, distNorm, ss);
    } else if (hitType === 'single') {
      await this._playSingle(fielderPos, angle, distNorm, ss);
    } else if (hitType === 'double' || hitType === 'triple') {
      await this._playExtraBase(fielderPos, angle, distNorm, ss, hitType);
    } else if (hitType === 'flyout' || hitType === 'lineout') {
      await this._playFlyout(fielderPos, angle, distNorm, ss);
    } else if (hitType === 'popout') {
      await this._playPopout(fielderPos, ss);
    } else {
      // fallback
      await this._playGroundout(fielderPos, angle, distNorm, ss);
    }

    this.renderer.hideBall();
  }

  // ── Home run (~3500ms) ─────────────────────────────────────────────────────
  // 1. Pitcher winds up (500ms)
  // 2. Ball to plate (300ms)
  // 3. Batter swings — BIG contact flash (300ms)
  // 4. Ball arcs high into outfield (800ms)
  // 5. Ball clears wall — flash (200ms)
  // 6. Brief celebration (200ms)

  async playHomeRun(distance: number): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();
    const angle = (Math.random() - 0.5) * 40;

    if (ss) {
      await ss.animatePitcherWindup();
    } else {
      await delay(this.dur(500));
    }
    if (this._destroyed) return;

    const ballToPlate = this._throwBallToPlate('fastball');
    const swingDelay = (async () => {
      await delay(this.dur(260));
      if (!this._destroyed && ss) await ss.animateBatterSwing('perfect');
    })();
    await Promise.all([ballToPlate, swingDelay]);
    if (this._destroyed) return;

    // Big contact flash + loud bat crack
    this.renderer.showContactFlash(HOME_X - 12, HOME_Y - 18);
    this.renderer.showHomeRunFlash();
    soundEngine.playBatCrack(1.4);

    // Ball arcs out of the park
    await this.renderer.animateBallHomeRun(angle, distance);
    if (this._destroyed) return;

    // Horn blast after ball clears the wall
    soundEngine.playHomeRunHorn();
    await delay(this.dur(200));
    this.renderer.hideBall();
  }

  // ── Strikeout (~1000ms after last pitch) ──────────────────────────────────
  // 1. Umpire dramatic punch-out (600ms)
  // 2. Batter reset (400ms)

  async playStrikeout(looking: boolean): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();

    if (!looking && ss) {
      // swinging strikeout — show swing first
      await ss.animateBatterSwing('late');
      if (this._destroyed) return;
    }

    if (ss) {
      soundEngine.playCrowdCheer('roar');
      await ss.animateUmpireStrikeCall();
      if (this._destroyed) return;
      await delay(this.dur(400));
    } else {
      soundEngine.playCrowdCheer('roar');
      await delay(this.dur(600));
    }
  }

  // ── Walk (~800ms) ─────────────────────────────────────────────────────────

  async playWalk(): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();

    if (ss) {
      await ss.animateBatterTake();
      if (this._destroyed) return;
    }

    await delay(this.dur(400));
  }

  // ── Inning change (~600ms) ────────────────────────────────────────────────

  async playInningChange(): Promise<void> {
    if (this._destroyed) return;
    const ss = this.renderer.getSpriteScene();

    this.renderer.reset();
    if (ss) ss.resetToReady();
    soundEngine.playOrganCharge();
    await delay(this.dur(300));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Internal sub-sequences ───────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  // ── Pitcher windup helper ─────────────────────────────────────────────────

  private async _pitcherWindup(ss: SpritePlayerScene | null): Promise<void> {
    if (this._destroyed) return;
    if (ss) {
      await ss.animatePitcherWindup();
    } else {
      await delay(this.dur(600));
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

    await this.renderer.animateBallBezier(start, ctrl, end, this.dur(400));
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

    // Ball rolls to fielder (ground ball)
    const fielderCoord = FIELDER_POSITIONS[fielderPos] ?? FIELDER_POSITIONS.SS!;

    await this.renderer.animateBallGround(
      { x: HOME_X, y: HOME_Y },
      clampedLanding,
      this.dur(480),
    );
    if (this._destroyed) return;

    // Fielder animates (field + crow hop + throw) concurrently with ball throw
    const fielderAnim = ss ? ss.animateFielderCatch(fielderPos) : Promise.resolve();

    await fielderAnim;
    if (this._destroyed) return;

    // Fielder throws to 1B
    if (ss) {
      const throwAnim = ss.animateFielderThrow(fielderPos);
      const ballAnim = this.renderer.animateBallBezier(
        fielderCoord,
        { x: (fielderCoord.x + BASE_1_X) / 2, y: (fielderCoord.y + BASE_1_Y) / 2 - 20 },
        { x: BASE_1_X, y: BASE_1_Y },
        this.dur(320),
      );
      await Promise.all([throwAnim, ballAnim]);
    } else {
      await this.renderer.animateBallBezier(
        fielderCoord,
        { x: (fielderCoord.x + BASE_1_X) / 2, y: (fielderCoord.y + BASE_1_Y) / 2 - 20 },
        { x: BASE_1_X, y: BASE_1_Y },
        this.dur(320),
      );
    }

    await delay(this.dur(200));
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

    // Ball rolls to outfield
    await this.renderer.animateBallGround(
      { x: HOME_X, y: HOME_Y },
      clamped,
      this.dur(500),
    );
    if (this._destroyed) return;

    // Outfielder runs to ball, runner advances concurrently
    const catchAnim = ss ? ss.animateFielderCatch(fielderPos) : Promise.resolve();
    await catchAnim;
    soundEngine.playBallInGlove();

    if (this._destroyed) return;
    await delay(this.dur(200));
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

    // Line drive arc
    const ctrl: Point = {
      x: (HOME_X + clamped.x) / 2,
      y: HOME_Y - 30,
    };

    await this.renderer.animateBallBezier(
      { x: HOME_X, y: HOME_Y },
      ctrl,
      clamped,
      this.dur(hitType === 'triple' ? 550 : 450),
    );
    if (this._destroyed) return;

    const catchAnim = ss ? ss.animateFielderCatch(fielderPos) : Promise.resolve();
    await catchAnim;
    if (this._destroyed) return;

    await delay(this.dur(250));
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

    await this.renderer.animateBallParabolic(
      { x: HOME_X, y: HOME_Y },
      clamped,
      80 + distNorm * 40,
      this.dur(750),
    );
    if (this._destroyed) return;

    const catchAnim = ss ? ss.animateFielderCatch(fielderPos) : Promise.resolve();
    await catchAnim;
    soundEngine.playBallInGlove();
    if (this._destroyed) return;

    await delay(this.dur(200));
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

    await this.renderer.animateBallParabolic(
      { x: HOME_X, y: HOME_Y },
      popTarget,
      100,
      this.dur(900),
    );
    if (this._destroyed) return;

    const catchAnim = ss ? ss.animateFielderCatch(fielderPos) : Promise.resolve();
    await catchAnim;
    if (this._destroyed) return;

    await delay(this.dur(150));
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

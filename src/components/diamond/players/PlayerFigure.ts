// ── PlayerFigure.ts ───────────────────────────────────────────────────────
// Ken Griffey Jr. Winning Run-style procedural player figures.
// 16-bit aesthetic: chunky proportions, bold outlines, detailed uniforms.
// Built with Pixi.js 8 Graphics — each figure is a Container of body parts.

import { Container, Graphics } from 'pixi.js';
import {
  type PoseData,
  type PlayerPose,
  POSE_LIBRARY,
  interpolatePose,
  easeInOut,
} from './AnimationKeyframes.ts';

// ── Figure dimensions (px at default scale) ───────────────────────────────
// Designed to look like 16-bit SNES sprites at game scale.

const HEAD_R = 7;         // head radius — big-head SNES style
const NECK_H = 2;
const TORSO_W = 14;       // jersey width (wide shoulders)
const TORSO_H = 14;       // jersey height
const SHOULDER_W = 16;    // full shoulder width (wider than torso)
const ARM_W = 4;          // arm thickness
const ARM_LEN = 13;       // total arm length (upper + forearm)
const UPPER_ARM = 6;      // shoulder to elbow
const FOREARM = 7;        // elbow to hand
const LEG_W = 5;          // leg/pant thickness
const LEG_LEN = 14;       // total leg length
const UPPER_LEG = 7;      // hip to knee
const LOWER_LEG = 7;      // knee to foot
const SHOE_W = 7;         // shoe width
const SHOE_H = 3;         // shoe height
const GLOVE_R = 4;        // glove radius
const CAP_W = 14;         // cap width
const CAP_H = 5;          // cap crown height
const BRIM_W = 9;         // brim extends forward
const BAT_LEN = 22;       // bat length (for batters)
const BAT_W = 2.5;        // bat handle width
const BAT_BARREL = 4;     // bat barrel width
const BELT_H = 2;         // belt stripe height
const OUTLINE = 1.2;      // dark outline width (SNES style)

// Y-offsets within the container (pivot at feet)
const FEET_Y = 0;
const ANKLE_Y = FEET_Y - SHOE_H;
const KNEE_Y = ANKLE_Y - LOWER_LEG;
const HIP_Y = KNEE_Y - UPPER_LEG;
const BELT_Y = HIP_Y;
const SHOULDER_Y = HIP_Y - TORSO_H;
const NECK_Y = SHOULDER_Y - NECK_H;
const HEAD_Y = NECK_Y - HEAD_R;

// ── Color utilities ──────────────────────────────────────────────────────

function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function darken(color: number, factor = 0.6): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

function lighten(color: number, factor = 1.3): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.floor((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ── Skin tone palette ─────────────────────────────────────────────────────
const SKIN = 0xf0c898;
const SKIN_SHADOW = 0xd4a870;

// ── Uniform colors ────────────────────────────────────────────────────────
const PANTS_COLOR = 0xf0ece6;        // off-white baseball pants
const PANTS_SHADOW = 0xd0ccc4;       // pants shadow
const SHOE_COLOR = 0x222222;          // dark cleats
const BELT_COLOR = 0x1a1a1a;         // black belt
const GLOVE_COLOR = 0x8b4513;        // brown leather
const GLOVE_SHADOW = 0x6b3410;       // leather shadow
const BAT_COLOR = 0xc4a060;          // natural wood
const BAT_SHADOW = 0x9a7840;         // wood shadow
const BAT_GRIP = 0x333333;           // grip tape
const OUTLINE_COLOR = 0x111118;      // near-black outline (SNES style)

// ── PlayerFigure class ────────────────────────────────────────────────────

export class PlayerFigure {
  private container: Container;

  // Body part containers (pivoted at joints for rotation)
  private headGroup: Container;    // head + cap + face
  private torsoGfx: Graphics;     // jersey + belt
  private leftArmGroup: Container; // upper arm + forearm + hand/glove
  private rightArmGroup: Container;
  private leftLegGroup: Container; // upper leg + lower leg + shoe
  private rightLegGroup: Container;
  private batGfx: Graphics | null = null;  // bat (batter only)

  // Shadow underneath the player
  private shadow: Graphics;

  // Colors
  private jerseyColor: number;
  private jerseyDark: number;
  private jerseyLight: number;
  private capColor: number;
  private _isLeftHanded: boolean;
  private _hasBat = false;

  // Current pose
  private currentPose: PoseData;

  constructor(teamColor: string, secondaryColor: string, isLeftHanded: boolean) {
    this.jerseyColor = hexToNum(teamColor);
    this.jerseyDark = darken(this.jerseyColor, 0.65);
    this.jerseyLight = lighten(this.jerseyColor, 1.25);
    this.capColor = hexToNum(secondaryColor);
    this._isLeftHanded = isLeftHanded;
    this.currentPose = { ...POSE_LIBRARY['standing'] };

    this.container = new Container();

    // Ground shadow (ellipse under feet)
    this.shadow = new Graphics();
    this._drawShadow();
    this.container.addChild(this.shadow);

    // Build body parts in painter's order (back to front)
    // Legs → torso → arms → head
    this.leftLegGroup = this._buildLeg();
    this.rightLegGroup = this._buildLeg();
    this.torsoGfx = this._drawTorso();
    this.leftArmGroup = this._buildArm(isLeftHanded ? false : true);  // glove hand
    this.rightArmGroup = this._buildArm(isLeftHanded ? true : false);
    this.headGroup = this._buildHead();

    // Position joints relative to body center (pivot at feet)
    this.leftLegGroup.x = -3;
    this.leftLegGroup.y = HIP_Y;
    this.rightLegGroup.x = 3;
    this.rightLegGroup.y = HIP_Y;

    this.torsoGfx.x = 0;
    this.torsoGfx.y = SHOULDER_Y;

    this.leftArmGroup.x = -SHOULDER_W / 2;
    this.leftArmGroup.y = SHOULDER_Y + 2;
    this.rightArmGroup.x = SHOULDER_W / 2;
    this.rightArmGroup.y = SHOULDER_Y + 2;

    this.headGroup.x = 0;
    this.headGroup.y = HEAD_Y;

    // Add in painter's order
    this.container.addChild(this.leftLegGroup);
    this.container.addChild(this.rightLegGroup);
    this.container.addChild(this.torsoGfx);
    this.container.addChild(this.leftArmGroup);
    this.container.addChild(this.rightArmGroup);
    this.container.addChild(this.headGroup);

    this.setPose('standing');
  }

  // ── Shadow ─────────────────────────────────────────────────────────

  private _drawShadow(): void {
    this.shadow.clear();
    this.shadow.ellipse(0, 2, 10, 3);
    this.shadow.fill({ color: 0x000000, alpha: 0.25 });
  }

  // ── Torso (jersey + belt) ─────────────────────────────────────────

  private _drawTorso(): Graphics {
    const g = new Graphics();

    // Outline
    g.roundRect(-TORSO_W / 2 - OUTLINE, -OUTLINE, TORSO_W + OUTLINE * 2, TORSO_H + BELT_H + OUTLINE * 2, 2);
    g.fill({ color: OUTLINE_COLOR });

    // Jersey body — slight V-shape (wider at shoulders)
    g.beginPath();
    g.moveTo(-SHOULDER_W / 2, 0);                    // left shoulder
    g.lineTo(SHOULDER_W / 2, 0);                     // right shoulder
    g.lineTo(TORSO_W / 2, TORSO_H);                  // right hip
    g.lineTo(-TORSO_W / 2, TORSO_H);                 // left hip
    g.closePath();
    g.fill({ color: this.jerseyColor });

    // Jersey shadow (bottom half slightly darker)
    g.beginPath();
    g.moveTo(-TORSO_W / 2 - 1, TORSO_H * 0.5);
    g.lineTo(TORSO_W / 2 + 1, TORSO_H * 0.5);
    g.lineTo(TORSO_W / 2, TORSO_H);
    g.lineTo(-TORSO_W / 2, TORSO_H);
    g.closePath();
    g.fill({ color: this.jerseyDark, alpha: 0.3 });

    // Button line down center
    g.rect(-0.5, 2, 1, TORSO_H - 4);
    g.fill({ color: this.jerseyLight, alpha: 0.5 });

    // Sleeve cuffs (decorative bands at shoulder)
    g.rect(-SHOULDER_W / 2, 0, SHOULDER_W, 2);
    g.fill({ color: this.jerseyLight, alpha: 0.3 });

    // Belt
    g.rect(-TORSO_W / 2, TORSO_H, TORSO_W, BELT_H);
    g.fill({ color: BELT_COLOR });
    // Belt buckle
    g.rect(-1.5, TORSO_H, 3, BELT_H);
    g.fill({ color: 0x888888 });

    return g;
  }

  // ── Leg (upper + lower + shoe) ────────────────────────────────────

  private _buildLeg(): Container {
    const c = new Container();
    const g = new Graphics();

    // Outline for entire leg
    g.roundRect(-LEG_W / 2 - OUTLINE, -OUTLINE, LEG_W + OUTLINE * 2, LEG_LEN + SHOE_H + OUTLINE * 2, 2);
    g.fill({ color: OUTLINE_COLOR });

    // Upper leg (pants)
    g.roundRect(-LEG_W / 2, 0, LEG_W, UPPER_LEG, 1);
    g.fill({ color: PANTS_COLOR });

    // Knee shadow
    g.rect(-LEG_W / 2, UPPER_LEG - 2, LEG_W, 2);
    g.fill({ color: PANTS_SHADOW, alpha: 0.4 });

    // Lower leg (pants continue)
    g.roundRect(-LEG_W / 2, UPPER_LEG, LEG_W, LOWER_LEG, 1);
    g.fill({ color: PANTS_COLOR });

    // Stirrup/sock detail
    g.rect(-LEG_W / 2, UPPER_LEG + LOWER_LEG - 3, LEG_W, 3);
    g.fill({ color: this.jerseyColor, alpha: 0.6 });

    // Shoe/cleat
    g.roundRect(-SHOE_W / 2, LEG_LEN, SHOE_W, SHOE_H, 1);
    g.fill({ color: SHOE_COLOR });
    // Sole highlight
    g.rect(-SHOE_W / 2, LEG_LEN + SHOE_H - 1, SHOE_W, 1);
    g.fill({ color: 0x444444 });

    c.addChild(g);
    return c;
  }

  // ── Arm (sleeve + forearm + hand/glove) ───────────────────────────

  private _buildArm(hasGlove: boolean): Container {
    const c = new Container();
    const g = new Graphics();

    // Outline
    g.roundRect(-ARM_W / 2 - OUTLINE, -OUTLINE, ARM_W + OUTLINE * 2, ARM_LEN + OUTLINE * 2, 2);
    g.fill({ color: OUTLINE_COLOR });

    // Upper arm (jersey sleeve)
    g.roundRect(-ARM_W / 2, 0, ARM_W, UPPER_ARM, 1.5);
    g.fill({ color: this.jerseyColor });
    // Sleeve cuff
    g.rect(-ARM_W / 2, UPPER_ARM - 1.5, ARM_W, 1.5);
    g.fill({ color: this.jerseyDark, alpha: 0.5 });

    // Forearm (skin)
    g.roundRect(-ARM_W / 2 + 0.5, UPPER_ARM, ARM_W - 1, FOREARM, 1);
    g.fill({ color: SKIN });
    // Forearm shadow
    g.rect(-ARM_W / 2 + 0.5, UPPER_ARM, (ARM_W - 1) / 2, FOREARM);
    g.fill({ color: SKIN_SHADOW, alpha: 0.3 });

    // Hand
    if (hasGlove) {
      // Glove — brown leather circle
      const gloveG = new Graphics();
      // Outline
      gloveG.circle(0, ARM_LEN + GLOVE_R - 1, GLOVE_R + OUTLINE);
      gloveG.fill({ color: OUTLINE_COLOR });
      // Glove body
      gloveG.circle(0, ARM_LEN + GLOVE_R - 1, GLOVE_R);
      gloveG.fill({ color: GLOVE_COLOR });
      // Pocket detail
      gloveG.circle(0.5, ARM_LEN + GLOVE_R - 0.5, GLOVE_R * 0.55);
      gloveG.fill({ color: GLOVE_SHADOW, alpha: 0.5 });
      // Webbing line
      gloveG.rect(-0.5, ARM_LEN - 1, 1, GLOVE_R);
      gloveG.fill({ color: GLOVE_SHADOW, alpha: 0.4 });
      c.addChild(g);
      c.addChild(gloveG);
    } else {
      // Bare hand (skin circle)
      g.circle(0, ARM_LEN, 2.5);
      g.fill({ color: SKIN });
      c.addChild(g);
    }

    return c;
  }

  // ── Head (face + cap/helmet) ──────────────────────────────────────

  private _buildHead(): Container {
    const c = new Container();
    const g = new Graphics();

    // Head outline
    g.ellipse(0, 0, HEAD_R + OUTLINE, HEAD_R * 1.1 + OUTLINE);
    g.fill({ color: OUTLINE_COLOR });

    // Head (skin oval)
    g.ellipse(0, 0, HEAD_R, HEAD_R * 1.1);
    g.fill({ color: SKIN });

    // Ear bumps (subtle)
    g.circle(-HEAD_R + 1, 1, 2);
    g.fill({ color: SKIN_SHADOW });
    g.circle(HEAD_R - 1, 1, 2);
    g.fill({ color: SKIN_SHADOW });

    // Eyes (two small dark dots)
    g.circle(-2.5, -1, 1);
    g.fill({ color: 0x222222 });
    g.circle(2.5, -1, 1);
    g.fill({ color: 0x222222 });

    // Cap/helmet
    const capG = new Graphics();
    // Cap outline
    capG.roundRect(-CAP_W / 2 - OUTLINE, -CAP_H - OUTLINE, CAP_W + OUTLINE * 2, CAP_H + OUTLINE + 1, 3);
    capG.fill({ color: OUTLINE_COLOR });
    // Cap crown
    capG.roundRect(-CAP_W / 2, -CAP_H, CAP_W, CAP_H + 1, 3);
    capG.fill({ color: this.capColor });
    // Cap highlight
    capG.roundRect(-CAP_W / 2 + 2, -CAP_H + 1, CAP_W - 4, 2, 1);
    capG.fill({ color: lighten(this.capColor, 1.3), alpha: 0.35 });
    // Brim
    capG.ellipse(0, 1, BRIM_W, 2.5);
    capG.fill({ color: darken(this.capColor, 0.7) });
    // Button on top
    capG.circle(0, -CAP_H, 1);
    capG.fill({ color: lighten(this.capColor, 1.4), alpha: 0.5 });

    capG.y = -HEAD_R * 0.6;

    c.addChild(g);
    c.addChild(capG);
    return c;
  }

  // ── Bat ────────────────────────────────────────────────────────────

  showBat(): void {
    if (this.batGfx) return;
    this._hasBat = true;

    const g = new Graphics();
    // Bat outline
    g.roundRect(-BAT_W / 2 - OUTLINE, -BAT_LEN - OUTLINE, BAT_W + OUTLINE * 2, BAT_LEN + OUTLINE * 2, 1);
    g.fill({ color: OUTLINE_COLOR });

    // Handle (grip tape)
    g.roundRect(-BAT_W / 2, -5, BAT_W, 5, 0.5);
    g.fill({ color: BAT_GRIP });

    // Shaft (natural wood)
    g.roundRect(-BAT_W / 2, -BAT_LEN + BAT_BARREL + 2, BAT_W, BAT_LEN - BAT_BARREL - 7, 0.5);
    g.fill({ color: BAT_COLOR });

    // Barrel (thicker end)
    g.roundRect(-BAT_BARREL / 2, -BAT_LEN, BAT_BARREL, BAT_BARREL + 2, 1.5);
    g.fill({ color: BAT_COLOR });
    // Barrel shadow
    g.roundRect(-BAT_BARREL / 2, -BAT_LEN, BAT_BARREL / 2, BAT_BARREL + 2, 1);
    g.fill({ color: BAT_SHADOW, alpha: 0.3 });

    // Knob at bottom
    g.circle(0, 0, BAT_W / 2 + 0.5);
    g.fill({ color: BAT_GRIP });

    this.batGfx = g;

    // Attach bat to the batting hand arm
    if (this._isLeftHanded) {
      this.leftArmGroup.addChild(g);
    } else {
      this.rightArmGroup.addChild(g);
    }

    // Position bat relative to hand
    g.x = 0;
    g.y = ARM_LEN - 2;
  }

  hideBat(): void {
    if (!this.batGfx) return;
    this._hasBat = false;
    this.batGfx.destroy();
    this.batGfx = null;
  }

  // ── Public API ─────────────────────────────────────────────────────

  getContainer(): Container {
    return this.container;
  }

  setPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  setScale(s: number): void {
    this.container.scale.set(s);
  }

  setPose(pose: PlayerPose): void {
    const data = POSE_LIBRARY[pose];
    if (!data) return;
    this.currentPose = { ...data };
    this._applyPose(this.currentPose);

    // Auto show/hide bat based on pose
    if (pose === 'batting_stance' || pose === 'batting_swing_1' || pose === 'batting_swing_2' || pose === 'batting_swing_3') {
      this.showBat();
    }
  }

  getPoseData(): PoseData {
    return { ...this.currentPose };
  }

  applyPoseData(data: PoseData): void {
    this.currentPose = { ...data };
    this._applyPose(data);
  }

  setFacing(direction: 'left' | 'right' | 'up' | 'down'): void {
    switch (direction) {
      case 'left':
        this.container.scale.x = -Math.abs(this.container.scale.x);
        break;
      case 'right':
        this.container.scale.x = Math.abs(this.container.scale.x);
        break;
      case 'up':
      case 'down':
        this.container.scale.x = Math.abs(this.container.scale.x);
        break;
    }
  }

  get isLeftHanded(): boolean {
    return this._isLeftHanded;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  // ── Pose application ───────────────────────────────────────────────

  private _applyPose(pose: PoseData): void {
    // Arms: pivot at shoulder, rotate
    this.leftArmGroup.rotation = degToRad(pose.leftArm + 90);
    this.rightArmGroup.rotation = degToRad(pose.rightArm + 90);

    // Legs: pivot at hip
    this.leftLegGroup.rotation = degToRad(pose.leftLeg);
    this.rightLegGroup.rotation = degToRad(pose.rightLeg);

    // Torso lean
    this.torsoGfx.rotation = degToRad(pose.torsoLean * 0.5);

    // Head tilt (follows torso lean slightly)
    this.headGroup.rotation = degToRad(pose.headTilt * 0.5);

    // Dynamic positioning with torso lean
    const leanOffset = Math.sin(degToRad(pose.torsoLean)) * TORSO_H * 0.4;
    this.leftArmGroup.y = SHOULDER_Y + 2 - leanOffset * 0.5;
    this.rightArmGroup.y = SHOULDER_Y + 2 - leanOffset * 0.5;
    this.headGroup.y = HEAD_Y - leanOffset;

    // Z-sorting: when leaning forward, arms go behind torso
    if (pose.torsoLean < -15) {
      // Reaching/diving — make sure front arm shows
      this.container.setChildIndex(this.torsoGfx, 2);
    }
  }

  // ── Tween to a new pose ────────────────────────────────────────────

  tweenToPose(
    targetPose: PlayerPose,
    durationMs: number,
    easeFn: (t: number) => number = easeInOut,
  ): Promise<void> {
    const from = { ...this.currentPose };
    const to = POSE_LIBRARY[targetPose];
    if (!to) return Promise.resolve();

    const startTime = performance.now();

    return new Promise((resolve) => {
      const tick = () => {
        const elapsed = performance.now() - startTime;
        const raw = Math.min(elapsed / durationMs, 1);
        const t = easeFn(raw);

        const interp = interpolatePose(from, to, t);
        this.applyPoseData(interp);

        if (raw < 1) {
          requestAnimationFrame(tick);
        } else {
          this.currentPose = { ...to };
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  tweenToPoseData(
    to: PoseData,
    durationMs: number,
    easeFn: (t: number) => number = easeInOut,
  ): Promise<void> {
    const from = { ...this.currentPose };
    const startTime = performance.now();

    return new Promise((resolve) => {
      const tick = () => {
        const elapsed = performance.now() - startTime;
        const raw = Math.min(elapsed / durationMs, 1);
        const t = easeFn(raw);

        const interp = interpolatePose(from, to, t);
        this.applyPoseData(interp);

        if (raw < 1) {
          requestAnimationFrame(tick);
        } else {
          this.currentPose = { ...to };
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }
}

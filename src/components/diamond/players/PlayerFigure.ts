// ── PlayerFigure.ts ───────────────────────────────────────────────────────
// Base class for procedural vector player figures built with Pixi.js 8 Graphics.
// Each figure is a Container of Graphics children representing body parts.

import { Container, Graphics } from 'pixi.js';
import {
  type PoseData,
  type PlayerPose,
  POSE_LIBRARY,
  interpolatePose,
  easeInOut,
} from './AnimationKeyframes.ts';

// ── Figure dimensions (px at default scale) ───────────────────────────────

const HEAD_RADIUS = 4.5;
const TORSO_W = 6;
const TORSO_H = 10;
const ARM_LEN = 8;
const LEG_LEN = 10;
const CAP_W = 7;
const CAP_H = 3;
const GLOVE_R = 2.5;

// Y-offsets within the container (pivot at feet / base of figure)
const FEET_Y = 0;
const HIP_Y = FEET_Y - LEG_LEN;
const SHOULDER_Y = HIP_Y - TORSO_H;
const HEAD_Y = SHOULDER_Y - HEAD_RADIUS - 1;

// ── Hex color string to Pixi number ──────────────────────────────────────

function hexToNum(hex: string): number {
  const cleaned = hex.replace('#', '');
  return parseInt(cleaned, 16);
}

function darken(hex: string, factor = 0.6): number {
  const n = hexToNum(hex);
  const r = Math.floor(((n >> 16) & 0xff) * factor);
  const g = Math.floor(((n >> 8) & 0xff) * factor);
  const b = Math.floor((n & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

function lighten(hex: string, factor = 1.4): number {
  const n = hexToNum(hex);
  const r = Math.min(255, Math.floor(((n >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.floor(((n >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.floor((n & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

// ── Angle conversion ──────────────────────────────────────────────────────

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ── PlayerFigure class ────────────────────────────────────────────────────

export class PlayerFigure {
  private container: Container;

  // Body part containers (each pivoted at joint)
  private head: Graphics;
  private cap: Graphics;
  private torso: Graphics;
  private leftArm: Container;   // pivot at shoulder
  private rightArm: Container;
  private leftLeg: Container;   // pivot at hip
  private rightLeg: Container;
  private glove: Graphics;      // child of leftArm (or right if right-handed)

  // Colors
  private primaryColor: number;
  private secondaryColor: number;
  private _isLeftHanded: boolean;

  // Current pose data (for interpolation)
  private currentPose: PoseData;

  constructor(teamColor: string, secondaryColor: string, isLeftHanded: boolean) {
    this.primaryColor = hexToNum(teamColor);
    this.secondaryColor = hexToNum(secondaryColor);
    this._isLeftHanded = isLeftHanded;
    this.currentPose = { ...POSE_LIBRARY['standing'] };

    this.container = new Container();

    // Build in back-to-front order: legs, torso, arms, head
    this.leftLeg = this._makeLimb(ARM_LEN, LEG_LEN, 0xf5d0a0, false);
    this.rightLeg = this._makeLimb(ARM_LEN, LEG_LEN, 0xf5d0a0, false);
    this.torso = this._makeTorso();
    this.leftArm = this._makeLimb(4, ARM_LEN, lighten(teamColor, 1.1), false);
    this.rightArm = this._makeLimb(4, ARM_LEN, lighten(teamColor, 1.1), false);
    this.glove = this._makeGlove();
    this.head = this._makeHead();
    this.cap = this._makeCap();

    // Attach glove to the glove-hand arm
    if (isLeftHanded) {
      this.rightArm.addChild(this.glove);
    } else {
      this.leftArm.addChild(this.glove);
    }

    // Set pivot points (joint origins)
    this.leftLeg.pivot.set(0, 0);
    this.rightLeg.pivot.set(0, 0);
    this.leftArm.pivot.set(0, 0);
    this.rightArm.pivot.set(0, 0);

    // Position joints
    this.leftLeg.x = -2;
    this.leftLeg.y = HIP_Y;
    this.rightLeg.x = 2;
    this.rightLeg.y = HIP_Y;

    this.torso.x = -TORSO_W / 2;
    this.torso.y = SHOULDER_Y;

    this.leftArm.x = -TORSO_W / 2;
    this.leftArm.y = SHOULDER_Y + 1;
    this.rightArm.x = TORSO_W / 2;
    this.rightArm.y = SHOULDER_Y + 1;

    this.head.x = 0;
    this.head.y = HEAD_Y;

    this.cap.x = 0;
    this.cap.y = HEAD_Y - HEAD_RADIUS + 1;

    // Add children in painter's order
    this.container.addChild(this.leftLeg);
    this.container.addChild(this.rightLeg);
    this.container.addChild(this.torso);
    this.container.addChild(this.leftArm);
    this.container.addChild(this.rightArm);
    this.container.addChild(this.head);
    this.container.addChild(this.cap);

    // Apply default pose
    this.setPose('standing');
  }

  // ── Factory helpers ────────────────────────────────────────────────

  private _makeTorso(): Graphics {
    const g = new Graphics();
    // Jersey body
    g.rect(0, 0, TORSO_W, TORSO_H);
    g.fill({ color: this.primaryColor });
    // Subtle outline
    g.rect(0, 0, TORSO_W, TORSO_H);
    g.stroke({ color: darken('#ffffff', 0.6), width: 0.5, alpha: 0.4 });
    return g;
  }

  private _makeLimb(_width: number, length: number, color: number, _isArm: boolean): Container {
    const c = new Container();
    const g = new Graphics();
    // Draw limb as a thick line / rounded rect
    g.roundRect(-1.5, 0, 3, length, 1.5);
    g.fill({ color });
    c.addChild(g);
    return c;
  }

  private _makeGlove(): Graphics {
    const g = new Graphics();
    g.circle(0, ARM_LEN - 1, GLOVE_R + 1);
    g.fill({ color: darken('#8b4513', 0.9) });
    return g;
  }

  private _makeHead(): Graphics {
    const g = new Graphics();
    // Skin-tone oval
    g.ellipse(0, 0, HEAD_RADIUS, HEAD_RADIUS * 1.1);
    g.fill({ color: 0xf0c898 });
    return g;
  }

  private _makeCap(): Graphics {
    const g = new Graphics();
    // Brim
    g.ellipse(0, 2, CAP_W / 2 + 2, 2);
    g.fill({ color: this.secondaryColor });
    // Cap crown
    g.roundRect(-CAP_W / 2, -CAP_H, CAP_W, CAP_H + 1, 2);
    g.fill({ color: this.secondaryColor });
    return g;
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
        // Up/down facing uses the same orientation; slight scale tweak for depth
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
    // Arms: pivot at shoulder (top of arm), rotate around that point
    this.leftArm.rotation = degToRad(pose.leftArm + 90); // +90 so 0=straight down
    this.rightArm.rotation = degToRad(pose.rightArm + 90);

    // Legs: pivot at hip
    this.leftLeg.rotation = degToRad(pose.leftLeg);
    this.rightLeg.rotation = degToRad(pose.rightLeg);

    // Torso lean: slight tilt of torso container
    this.torso.rotation = degToRad(pose.torsoLean * 0.5);

    // Head tilt
    this.head.rotation = degToRad(pose.headTilt * 0.5);
    this.cap.rotation = degToRad(pose.headTilt * 0.5);

    // Move shoulder positions with torso lean
    const leanOffset = Math.sin(degToRad(pose.torsoLean)) * TORSO_H * 0.4;
    this.leftArm.y = SHOULDER_Y + 1 - leanOffset * 0.5;
    this.rightArm.y = SHOULDER_Y + 1 - leanOffset * 0.5;
    this.head.y = HEAD_Y - leanOffset;
    this.cap.y = HEAD_Y - HEAD_RADIUS + 1 - leanOffset;
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

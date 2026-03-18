import type { PitchType, ContactType, HitResult, Position } from './enums.ts';
import type { AtBatResult } from '../core/AtBatResolver.ts';
import type { PitchOutcome } from '../core/PitchEngine.ts';
import type { GameEvent } from './game.ts';

// ─── Swing / Take input ───────────────────────────────────────────────────────

export type SwingType = 'normal' | 'power' | 'contact' | 'bunt';
export type SwingTiming = 'very_early' | 'early' | 'perfect' | 'late' | 'very_late';

export interface UserSwingInput {
  action: 'swing' | 'take';
  swingType?: SwingType;
  timing?: SwingTiming;
}

// ─── Pitch input ──────────────────────────────────────────────────────────────

export interface UserPitchInput {
  pitchType: PitchType;
  /** 0-based row/col on a 5×5 grid; inner 3×3 (rows 1-3, cols 1-3) = in zone */
  targetZone: { row: number; col: number };
  /** 0.0 = worst, 1.0 = perfect meter */
  meterAccuracy?: number;
}

// ─── Animation data passed to UI ─────────────────────────────────────────────

export interface PitchAnimationData {
  pitchType: PitchType;
  velocity: number;
  startPos: { x: number; y: number };
  endPos: { x: number; y: number };
  targetPos?: { x: number; y: number };
  inZone: boolean;
  swung: boolean;
  contactData?: {
    type: ContactType;
    exitVelo: number;
    launchAngle: number;
    sprayAngle: number;
    distance: number;
    fieldedBy: Position;
    isOut: boolean;
    hitResult?: HitResult;
  };
}

// ─── Per-pitch step result ────────────────────────────────────────────────────

export interface PitchStepResult {
  pitchOutcome: PitchOutcome;
  count: { balls: number; strikes: number };
  atBatOver: boolean;
  atBatResult?: AtBatResult;
  animationData: PitchAnimationData;
  events: GameEvent[];
}

// ─── Overall interactive game phase ──────────────────────────────────────────

export type GamePhaseInteractive =
  | 'idle'
  | 'awaiting_pitch'
  | 'awaiting_swing'
  | 'cpu_pitch'
  | 'animating'
  | 'post_pitch'
  | 'post_ab'
  | 'game_over';

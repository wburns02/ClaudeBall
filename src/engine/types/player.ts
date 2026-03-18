import type { Position, Hand, PitchType } from './enums.ts';

export interface BattingRatings {
  contact_L: number;   // 1-100
  contact_R: number;
  power_L: number;
  power_R: number;
  eye: number;         // plate discipline
  avoid_k: number;     // strikeout avoidance
  gap_power: number;
  speed: number;
  steal: number;
  bunt: number;
  clutch: number;
}

export interface PitchingRatings {
  stuff: number;
  movement: number;
  control: number;
  stamina: number;
  velocity: number;    // actual mph (85-102)
  hold_runners: number;
  groundball_pct: number; // tendency 1-100 (50 = neutral)
  repertoire: PitchType[];
}

export interface FieldingRatings {
  position: Position;
  range: number;
  arm_strength: number;
  arm_accuracy: number;
  turn_dp: number;
  error_rate: number;  // lower is better (1-100 scale, 1 = gold glove)
}

export interface MentalRatings {
  intelligence: number;
  work_ethic: number;
  durability: number;
  consistency: number;
  composure: number;
  leadership: number;
}

export interface PlayerState {
  fatigue: number;     // 0 = fresh, 100 = exhausted
  morale: number;      // 0-100
  pitchCount: number;
  isInjured: boolean;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  position: Position;
  bats: Hand;
  throws: Hand;
  age: number;
  batting: BattingRatings;
  pitching: PitchingRatings;
  fielding: FieldingRatings[];
  mental: MentalRatings;
  state: PlayerState;
}

export function getPlayerName(p: Player): string {
  return `${p.firstName} ${p.lastName}`;
}

export function getFieldingForPosition(p: Player, pos: Position): FieldingRatings | undefined {
  return p.fielding.find(f => f.position === pos);
}

import type { Team } from './team.ts';
import type { HalfInning, GamePhase, Base } from './enums.ts';

export interface BaseState {
  first: string | null;   // player ID or null
  second: string | null;
  third: string | null;
}

export interface InningState {
  inning: number;
  half: HalfInning;
  outs: number;
  balls: number;
  strikes: number;
  bases: BaseState;
}

export interface GameScore {
  away: number[];   // runs per inning
  home: number[];
}

export interface BoxScorePlayer {
  playerId: string;
  name: string;
  position: string;
  ab: number;
  r: number;
  h: number;
  rbi: number;
  bb: number;
  so: number;
  hr: number;
  doubles: number;
  triples: number;
  sb: number;
  avg: string;      // display only
}

export interface BoxScorePitcher {
  playerId: string;
  name: string;
  ip: string;       // "6.2" format
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  hr: number;
  pitchCount: number;
  decision: 'W' | 'L' | 'S' | 'H' | '';
}

export interface BoxScore {
  awayBatters: BoxScorePlayer[];
  homeBatters: BoxScorePlayer[];
  awayPitchers: BoxScorePitcher[];
  homePitchers: BoxScorePitcher[];
}

export interface GameState {
  id: string;
  phase: GamePhase;
  away: Team;
  home: Team;
  inning: InningState;
  score: GameScore;
  boxScore: BoxScore;
  events: GameEvent[];
  currentBatterIndex: { away: number; home: number };
  seed: number;
}

// Discriminated union for game events
export type GameEvent =
  | { type: 'pitch'; description: string; balls: number; strikes: number; result: string; pitchType?: string; velocity?: number }
  | { type: 'at_bat_result'; description: string; batter: string; pitcher: string; result: string; rbiCount: number }
  | { type: 'baserunning'; description: string; runner: string }
  | { type: 'pitching_change'; description: string; outgoing: string; incoming: string }
  | { type: 'pinch_hit'; description: string; pinchHitter: string; forPlayer: string; battingSpot: number }
  | { type: 'defensive_sub'; description: string; incoming: string; outgoing: string; position: string }
  | { type: 'inning_change'; description: string; inning: number; half: HalfInning }
  | { type: 'game_end'; description: string; awayScore: number; homeScore: number }
  | { type: 'steal_attempt'; description: string; runner: string; success: boolean; base: Base }
  | { type: 'error'; description: string; fielder: string };

export function createEmptyBaseState(): BaseState {
  return { first: null, second: null, third: null };
}

export function runnersOn(bases: BaseState): number {
  return (bases.first ? 1 : 0) + (bases.second ? 1 : 0) + (bases.third ? 1 : 0);
}

export function isBasesLoaded(bases: BaseState): boolean {
  return bases.first !== null && bases.second !== null && bases.third !== null;
}

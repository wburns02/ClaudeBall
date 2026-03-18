/**
 * Lahman Historical Data Loader
 * Lazy-loads decade JSON files and converts them into full Team/Player objects.
 */

import type { Team } from '../types/team.ts';
import type { Player } from '../types/player.ts';
import type { Position, Hand, PitchType } from '../types/enums.ts';

// ── Preprocessed JSON types ──────────────────────────────────────────────

interface LahmanBattingRatings {
  contact_L: number;
  contact_R: number;
  power_L: number;
  power_R: number;
  eye: number;
  avoid_k: number;
  gap_power: number;
  speed: number;
  steal: number;
  bunt: number;
  clutch: number;
}

interface LahmanPitchingRatings {
  stuff: number;
  movement: number;
  control: number;
  stamina: number;
  velocity: number;
  hold_runners: number;
  groundball_pct: number;
  repertoire: string[];
}

interface LahmanFieldingRating {
  position: string;
  range: number;
  arm_strength: number;
  arm_accuracy: number;
  turn_dp: number;
  error_rate: number;
}

interface LahmanMentalRatings {
  intelligence: number;
  work_ethic: number;
  durability: number;
  consistency: number;
  composure: number;
  leadership: number;
}

interface LahmanPlayer {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  position: string;
  bats: string;
  throws: string;
  age: number;
  batting: LahmanBattingRatings;
  pitching: LahmanPitchingRatings;
  fielding: LahmanFieldingRating[];
  mental: LahmanMentalRatings;
  state: { fatigue: number; morale: number; pitchCount: number; isInjured: boolean };
}

interface LahmanTeam {
  id: string;
  name: string;
  abbreviation: string;
  city: string;
  primaryColor: string;
  secondaryColor: string;
  league: string;
  wins: number;
  losses: number;
  roster: { players: LahmanPlayer[] };
  lineup: { playerId: string; position: string }[];
  pitcherId: string;
  bullpen: string[];
}

interface LahmanSeasonData {
  teams: LahmanTeam[];
}

interface LahmanDecadeData {
  seasons: Record<string, LahmanSeasonData>;
}

// ── Public types ──────────────────────────────────────────────────────────

export interface HistoricalSeason {
  year: number;
  teams: HistoricalTeam[];
}

export interface HistoricalTeam extends Team {
  league: string;
  wins: number;
  losses: number;
}

// ── Cache ─────────────────────────────────────────────────────────────────

const decadeCache = new Map<string, LahmanDecadeData>();

function decadeLabel(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

// ── Conversion helpers ────────────────────────────────────────────────────

function toValidPosition(pos: string): Position {
  const valid: Position[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
  return valid.includes(pos as Position) ? (pos as Position) : 'DH';
}

function toHand(h: string): Hand {
  if (h === 'L') return 'L';
  if (h === 'S') return 'S';
  return 'R';
}

function toPitchTypes(arr: string[]): PitchType[] {
  const valid: PitchType[] = ['fastball', 'sinker', 'cutter', 'slider', 'curveball', 'changeup', 'splitter', 'knuckleball'];
  return arr.filter((p): p is PitchType => valid.includes(p as PitchType));
}

function convertPlayer(lp: LahmanPlayer): Player {
  return {
    id: lp.id,
    firstName: lp.firstName,
    lastName: lp.lastName,
    number: lp.number,
    position: toValidPosition(lp.position),
    bats: toHand(lp.bats),
    throws: toHand(lp.throws),
    age: lp.age,
    batting: lp.batting,
    pitching: {
      ...lp.pitching,
      repertoire: toPitchTypes(lp.pitching.repertoire),
    },
    fielding: lp.fielding.map(f => ({
      position: toValidPosition(f.position),
      range: f.range,
      arm_strength: f.arm_strength,
      arm_accuracy: f.arm_accuracy,
      turn_dp: f.turn_dp,
      error_rate: f.error_rate,
    })),
    mental: lp.mental,
    state: lp.state,
  };
}

function convertTeam(lt: LahmanTeam): HistoricalTeam {
  return {
    id: lt.id,
    name: lt.name,
    abbreviation: lt.abbreviation,
    city: lt.city,
    primaryColor: lt.primaryColor,
    secondaryColor: lt.secondaryColor,
    league: lt.league,
    wins: lt.wins,
    losses: lt.losses,
    roster: { players: lt.roster.players.map(convertPlayer) },
    lineup: lt.lineup.map(s => ({ playerId: s.playerId, position: toValidPosition(s.position) })),
    pitcherId: lt.pitcherId,
    bullpen: lt.bullpen,
  };
}

// ── Public API ────────────────────────────────────────────────────────────

/** Lazy-load a decade's JSON. Caches in memory after first load. */
export async function loadDecade(label: string): Promise<LahmanDecadeData> {
  if (decadeCache.has(label)) {
    return decadeCache.get(label)!;
  }
  const res = await fetch(`/data/lahman/${label}.json`);
  if (!res.ok) throw new Error(`Failed to load decade ${label}: ${res.status}`);
  const data = await res.json() as LahmanDecadeData;
  decadeCache.set(label, data);
  return data;
}

/** Get all teams for a specific historical year, converted to game engine types. */
export async function getHistoricalSeason(year: number): Promise<HistoricalSeason> {
  const label = decadeLabel(year);
  const decade = await loadDecade(label);
  const season = decade.seasons[year.toString()];
  if (!season) throw new Error(`No season data for year ${year}`);
  return {
    year,
    teams: season.teams.map(convertTeam),
  };
}

/** List which years are available within the loaded/available data range. */
export const AVAILABLE_YEAR_RANGE = { min: 1900, max: 2019 } as const;

/** Get available decades */
export function getAvailableDecades(): string[] {
  const decades: string[] = [];
  for (let y = AVAILABLE_YEAR_RANGE.min; y <= AVAILABLE_YEAR_RANGE.max; y += 10) {
    decades.push(decadeLabel(y));
  }
  return decades;
}

/** Pre-cache a decade (call ahead of time) */
export async function prefetchDecade(year: number): Promise<void> {
  const label = decadeLabel(year);
  if (!decadeCache.has(label)) {
    await loadDecade(label);
  }
}

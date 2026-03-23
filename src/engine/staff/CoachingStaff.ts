/**
 * Coaching Staff Engine — generates coaches, calculates staff bonuses.
 * Pure TypeScript, no React deps.
 */
import type { RandomProvider } from '@/engine/core/RandomProvider.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CoachRole = 'manager' | 'hitting' | 'pitching' | 'bench' | 'bullpen' | 'baserunning' | 'scout';

export interface CoachRatings {
  teaching: number;      // 1-100 — how well they develop players
  strategy: number;      // 1-100 — game-day decision quality
  motivation: number;    // 1-100 — morale and clubhouse impact
  evaluation: number;    // 1-100 — talent assessment accuracy
}

export interface Coach {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  role: CoachRole;
  ratings: CoachRatings;
  experience: number;       // years of coaching experience
  specialty: string;        // e.g. "Power Development", "Pitch Framing"
  salary: number;           // annual salary in thousands
  contractYears: number;    // years remaining
  personality: 'fiery' | 'calm' | 'analytical' | 'motivator' | 'old-school';
}

export interface StaffBonus {
  battingDev: number;       // % bonus to batting development
  pitchingDev: number;      // % bonus to pitching development
  morale: number;           // flat morale boost per sim
  gameStrategy: number;     // % bonus to in-game decisions
  scoutAccuracy: number;    // % bonus to scouting accuracy
}

// ── Constants ────────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Tony', 'Bobby', 'Jim', 'Dave', 'Mike', 'Joe', 'Tom', 'Rick', 'Pat', 'Bill',
  'Larry', 'Kevin', 'Steve', 'Don', 'Ron', 'Gary', 'Frank', 'Ray', 'Carl', 'Ed',
  'Dusty', 'Buck', 'Skip', 'Whitey', 'Sparky', 'Lou', 'Ozzie', 'Tito', 'Terry', 'Bud',
];

const LAST_NAMES = [
  'Baker', 'Cox', 'Torre', 'Martinez', 'Johnson', 'Williams', 'Anderson', 'Davis',
  'Mitchell', 'Thompson', 'Garcia', 'Rodriguez', 'Wilson', 'Moore', 'Taylor',
  'Clark', 'Lewis', 'Robinson', 'Harris', 'Young', 'Allen', 'King', 'Wright',
  'Scott', 'Green', 'Adams', 'Hill', 'Nelson', 'Carter', 'Phillips',
];

const SPECIALTIES: Record<CoachRole, string[]> = {
  manager: ['Game Management', 'Lineup Optimization', 'Bullpen Usage', 'In-Game Strategy', 'Clubhouse Leadership'],
  hitting: ['Power Development', 'Contact Hitting', 'Plate Discipline', 'Situational Hitting', 'Launch Angle'],
  pitching: ['Pitch Development', 'Arm Care', 'Command Focus', 'Velocity Training', 'Pitch Sequencing'],
  bench: ['Defensive Alignment', 'Pinch-Hit Strategy', 'Platoon Matchups', 'Late-Game Tactics', 'Player Mentoring'],
  bullpen: ['Closer Development', 'Pitch Efficiency', 'Recovery Programs', 'High-Leverage Usage', 'Setup Roles'],
  baserunning: ['Stolen Base Reads', 'First-to-Third Aggression', 'Lead Management', 'Tag-Up Timing', 'Speed Development'],
  scout: ['Amateur Scouting', 'Pro Scouting', 'International Markets', 'Analytics Integration', 'Projection Models'],
};

const PERSONALITIES: Coach['personality'][] = ['fiery', 'calm', 'analytical', 'motivator', 'old-school'];

export const ROLE_LABELS: Record<CoachRole, string> = {
  manager: 'Manager',
  hitting: 'Hitting Coach',
  pitching: 'Pitching Coach',
  bench: 'Bench Coach',
  bullpen: 'Bullpen Coach',
  baserunning: 'Baserunning Coach',
  scout: 'Head Scout',
};

export const ROLE_ORDER: CoachRole[] = ['manager', 'hitting', 'pitching', 'bench', 'bullpen', 'baserunning', 'scout'];

// ── Generation ──────────────────────────────────────────────────────────────

function pick<T>(arr: readonly T[], rng: RandomProvider): T {
  return arr[Math.floor(rng.next() * arr.length)];
}

function randRange(min: number, max: number, rng: RandomProvider): number {
  return Math.floor(rng.next() * (max - min + 1)) + min;
}

function generateRatings(tier: 'elite' | 'good' | 'average' | 'below', rng: RandomProvider): CoachRatings {
  const bases = { elite: [70, 95], good: [55, 80], average: [35, 65], below: [20, 50] };
  const [min, max] = bases[tier];
  return {
    teaching: randRange(min, max, rng),
    strategy: randRange(min, max, rng),
    motivation: randRange(min, max, rng),
    evaluation: randRange(min, max, rng),
  };
}

export function generateCoach(role: CoachRole, rng: RandomProvider, tier?: 'elite' | 'good' | 'average' | 'below'): Coach {
  const t = tier ?? (rng.next() < 0.15 ? 'elite' : rng.next() < 0.45 ? 'good' : rng.next() < 0.8 ? 'average' : 'below');
  const age = randRange(38, 72, rng);
  const experience = Math.max(1, age - randRange(30, 42, rng));
  const salary = t === 'elite' ? randRange(800, 1500, rng) :
    t === 'good' ? randRange(400, 800, rng) :
    t === 'average' ? randRange(200, 450, rng) :
    randRange(100, 250, rng);

  return {
    id: `coach-${role}-${Date.now()}-${Math.floor(rng.next() * 10000)}`,
    firstName: pick(FIRST_NAMES, rng),
    lastName: pick(LAST_NAMES, rng),
    age,
    role,
    ratings: generateRatings(t, rng),
    experience,
    specialty: pick(SPECIALTIES[role], rng),
    salary,
    contractYears: randRange(1, 3, rng),
    personality: pick(PERSONALITIES, rng),
  };
}

export function generateStaff(rng: RandomProvider): Coach[] {
  return ROLE_ORDER.map(role => generateCoach(role, rng));
}

export function generateHiringPool(role: CoachRole, count: number, rng: RandomProvider): Coach[] {
  return Array.from({ length: count }, () => generateCoach(role, rng));
}

// ── Staff Bonus Calculation ───────────────────────────────────────────────────

export function calculateStaffBonus(staff: Coach[]): StaffBonus {
  const get = (role: CoachRole) => staff.find(c => c.role === role);

  const manager = get('manager');
  const hitting = get('hitting');
  const pitching = get('pitching');
  const bench = get('bench');
  const bullpen = get('bullpen');
  const baserunning = get('baserunning');
  const scout = get('scout');

  // Batting development: hitting coach teaching + manager motivation
  const battingDev = Math.round(
    ((hitting?.ratings.teaching ?? 40) * 0.6 + (manager?.ratings.motivation ?? 40) * 0.2 + (bench?.ratings.teaching ?? 40) * 0.2) / 100 * 15
  );

  // Pitching development: pitching coach teaching + bullpen coach
  const pitchingDev = Math.round(
    ((pitching?.ratings.teaching ?? 40) * 0.6 + (bullpen?.ratings.teaching ?? 40) * 0.25 + (manager?.ratings.motivation ?? 40) * 0.15) / 100 * 15
  );

  // Morale: manager motivation + bench coach motivation
  const morale = Math.round(
    ((manager?.ratings.motivation ?? 40) * 0.5 + (bench?.ratings.motivation ?? 40) * 0.3 + (hitting?.ratings.motivation ?? 40) * 0.1 + (pitching?.ratings.motivation ?? 40) * 0.1) / 100 * 10
  );

  // Game strategy: manager strategy + bench strategy
  const gameStrategy = Math.round(
    ((manager?.ratings.strategy ?? 40) * 0.5 + (bench?.ratings.strategy ?? 40) * 0.2 + (baserunning?.ratings.strategy ?? 40) * 0.15 + (bullpen?.ratings.strategy ?? 40) * 0.15) / 100 * 12
  );

  // Scout accuracy: scout evaluation
  const scoutAccuracy = Math.round(
    ((scout?.ratings.evaluation ?? 40) * 0.7 + (manager?.ratings.evaluation ?? 40) * 0.3) / 100 * 20
  );

  return { battingDev, pitchingDev, morale, gameStrategy, scoutAccuracy };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function overallRating(coach: Coach): number {
  const r = coach.ratings;
  return Math.round((r.teaching + r.strategy + r.motivation + r.evaluation) / 4);
}

export function ratingColor(value: number): string {
  if (value >= 80) return '#d4a843'; // gold
  if (value >= 65) return '#22c55e'; // green
  if (value >= 50) return '#e8e0d4'; // cream
  if (value >= 35) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

export function ratingLabel(value: number): string {
  if (value >= 80) return 'Elite';
  if (value >= 65) return 'Good';
  if (value >= 50) return 'Average';
  if (value >= 35) return 'Below Avg';
  return 'Poor';
}

export function personalityIcon(p: Coach['personality']): string {
  return { fiery: 'F', calm: 'C', analytical: 'A', motivator: 'M', 'old-school': 'O' }[p];
}

export function personalityColor(p: Coach['personality']): string {
  return { fiery: '#ef4444', calm: '#3b82f6', analytical: '#8b5cf6', motivator: '#22c55e', 'old-school': '#d4a843' }[p];
}

export function totalStaffSalary(staff: Coach[]): number {
  return staff.reduce((sum, c) => sum + c.salary, 0);
}

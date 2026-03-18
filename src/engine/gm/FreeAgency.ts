import type { Player } from '../types/player.ts';
import type { Position, Hand, PitchType } from '../types/enums.ts';
import type { RandomProvider } from '../core/RandomProvider.ts';

export interface FreeAgent {
  player: Player;
  askingSalary: number;  // annual salary in thousands (e.g. 1500 = $1.5M)
  yearsDesired: number;
}

export interface SigningResult {
  success: boolean;
  reason?: string;
  player?: Player;
}

const FIRST_NAMES = [
  'Marcus', 'Andre', 'Devon', 'Elias', 'Tomas', 'Luis', 'Carlos', 'Malik',
  'Jamal', 'Connor', 'Diego', 'Ryu', 'Hiro', 'Dante', 'Orlando', 'Brent',
  'Cole', 'Austin', 'Caleb', 'Nolan', 'Tyler', 'Chase', 'Hunter', 'Bryce',
  'Yoshi', 'Miguel', 'Raul', 'Pedro', 'Felix', 'Cesar', 'Kenji', 'Darius',
];

const LAST_NAMES = [
  'Johnson', 'Williams', 'Garcia', 'Martinez', 'Rodriguez', 'Davis', 'Wilson',
  'Anderson', 'Taylor', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin',
  'Thompson', 'Moore', 'Young', 'Allen', 'King', 'Wright', 'Lopez', 'Hill',
  'Scott', 'Green', 'Adams', 'Baker', 'Nelson', 'Carter', 'Mitchell', 'Perez',
  'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards',
];

const POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'P'];
const PITCH_TYPES: PitchType[] = ['fastball', 'slider', 'curveball', 'changeup', 'sinker', 'cutter', 'splitter'];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function generatePlayer(id: string, rng: RandomProvider): Player {
  const pos = rng.pick(POSITIONS);
  const isPitcher = pos === 'P';
  const age = rng.nextInt(22, 36);
  const hands: Hand[] = ['L', 'R', 'S'];
  const bats = rng.pick(hands);
  const throws: Hand = rng.chance(0.3) ? 'L' : 'R';

  // Skill tier: 0=scrub, 1=fringe, 2=average, 3=good, 4=star
  const tier = rng.weightedPick([0, 1, 2, 3, 4], [10, 25, 35, 20, 10]);
  const baseMean = [42, 52, 62, 72, 82][tier];
  const spread = 10;

  const r = () => clamp(rng.nextGaussian(baseMean, spread), 30, 99);

  const repertoire: PitchType[] = ['fastball'];
  const pitchCount = rng.nextInt(2, 4);
  const shuffled = [...PITCH_TYPES.slice(1)].sort(() => rng.next() - 0.5);
  for (let i = 0; i < pitchCount - 1 && i < shuffled.length; i++) {
    repertoire.push(shuffled[i]);
  }

  return {
    id,
    firstName: rng.pick(FIRST_NAMES),
    lastName: rng.pick(LAST_NAMES),
    number: rng.nextInt(1, 99),
    position: pos,
    bats,
    throws,
    age,
    batting: isPitcher
      ? { contact_L: 15, contact_R: 18, power_L: 10, power_R: 12, eye: 15, avoid_k: 12, gap_power: 10, speed: 25, steal: 5, bunt: 30, clutch: 25 }
      : { contact_L: r(), contact_R: r(), power_L: r(), power_R: r(), eye: r(), avoid_k: r(), gap_power: r(), speed: r(), steal: clamp(rng.nextGaussian(40, 20), 5, 90), bunt: clamp(rng.nextGaussian(35, 15), 5, 80), clutch: r() },
    pitching: isPitcher
      ? { stuff: r(), movement: r(), control: r(), stamina: r(), velocity: clamp(rng.nextGaussian(91, 4), 82, 102), hold_runners: r(), groundball_pct: rng.nextInt(30, 70), repertoire }
      : { stuff: 35, movement: 35, control: 35, stamina: 30, velocity: 85, hold_runners: 30, groundball_pct: 50, repertoire: ['fastball'] },
    fielding: [{
      position: pos,
      range: r(),
      arm_strength: r(),
      arm_accuracy: r(),
      turn_dp: r(),
      error_rate: clamp(rng.nextGaussian(35, 15), 5, 70),
    }],
    mental: { intelligence: r(), work_ethic: r(), durability: r(), consistency: r(), composure: r(), leadership: r() },
    state: { fatigue: 0, morale: rng.nextInt(50, 90), pitchCount: 0, isInjured: false },
  };
}

function estimateSalary(player: Player): number {
  // Rough salary in thousands: star players ~8000k, scrubs ~500k
  const isPitcher = player.position === 'P';
  let rating: number;
  if (isPitcher) {
    const p = player.pitching;
    rating = (p.stuff + p.movement + p.control + p.stamina) / 4;
  } else {
    const b = player.batting;
    rating = (b.contact_L + b.contact_R + b.power_L + b.power_R + b.eye + b.avoid_k + b.gap_power + b.speed) / 8;
  }
  // Exponential salary curve
  const base = Math.pow((rating / 100), 2.5) * 12000;
  return Math.max(500, Math.round(base / 100) * 100);
}

export class FreeAgentPool {
  private agents: Map<string, FreeAgent> = new Map();

  add(fa: FreeAgent): void {
    this.agents.set(fa.player.id, fa);
  }

  remove(playerId: string): void {
    this.agents.delete(playerId);
  }

  getAll(): FreeAgent[] {
    return Array.from(this.agents.values());
  }

  get(playerId: string): FreeAgent | undefined {
    return this.agents.get(playerId);
  }

  get size(): number {
    return this.agents.size;
  }
}

/**
 * Generate a pool of random free agents.
 */
export function generateFreeAgents(count: number, rng: RandomProvider): FreeAgentPool {
  const pool = new FreeAgentPool();
  for (let i = 0; i < count; i++) {
    const id = `fa-${Date.now()}-${i}`;
    const player = generatePlayer(id, rng);
    const askingSalary = estimateSalary(player);
    const yearsDesired = rng.nextInt(1, 4);
    pool.add({ player, askingSalary, yearsDesired });
  }
  return pool;
}

export interface Contract {
  playerId: string;
  teamId: string;
  years: number;
  salary: number; // per year in thousands
  signedDay: number;
}

/**
 * Sign a free agent to a team roster.
 * Mutates the team's roster directly.
 * Returns the signed player on success.
 */
export function signPlayer(
  pool: FreeAgentPool,
  teamRosterPlayers: Player[],
  _teamId: string,
  playerId: string,
  _years: number,
  salary: number
): SigningResult {
  const fa = pool.get(playerId);
  if (!fa) return { success: false, reason: 'Player not in free agent pool' };

  // Check if salary is acceptable (within 20% of asking)
  if (salary < fa.askingSalary * 0.8) {
    return { success: false, reason: `Player wants at least $${Math.round(fa.askingSalary * 0.8)}k/year` };
  }

  pool.remove(playerId);
  const signedPlayer = { ...fa.player };
  teamRosterPlayers.push(signedPlayer);

  return { success: true, player: signedPlayer };
}

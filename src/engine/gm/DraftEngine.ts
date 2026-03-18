import type { Player } from '../types/player.ts';
import type { Position, Hand, PitchType } from '../types/enums.ts';
import type { RandomProvider } from '../core/RandomProvider.ts';

export interface DraftProspect {
  id: string;
  firstName: string;
  lastName: string;
  position: Position;
  age: number;
  /** Overall current ability 1-100 */
  currentRating: number;
  /** Ceiling potential 1-100 */
  potentialRating: number;
  /** Scouting description */
  summary: string;
}

export interface DraftPick {
  round: number;
  pickInRound: number;
  overallPick: number;
  teamId: string;
  prospectId: string | null; // null = pick not yet made
}

export interface DraftClass {
  year: number;
  prospects: DraftProspect[];
  picks: DraftPick[];
}

const FIRST_NAMES = [
  'Ethan', 'Logan', 'Ryan', 'Noah', 'Mason', 'Liam', 'Aiden', 'Jacob',
  'Jackson', 'Lucas', 'James', 'Elijah', 'Oliver', 'Benjamin', 'Sebastian',
  'Matthew', 'Henry', 'Alexander', 'Daniel', 'Michael', 'Owen', 'Samuel',
  'David', 'Joseph', 'Carter', 'Wyatt', 'John', 'Luke', 'Gabriel', 'Anthony',
];

const LAST_NAMES = [
  'Anderson', 'Brown', 'Clark', 'Davis', 'Evans', 'Fisher', 'Grant', 'Hayes',
  'Ingram', 'James', 'Klein', 'Lane', 'Morgan', 'Nash', 'Owen', 'Price',
  'Quinn', 'Reed', 'Stone', 'Torres', 'Underwood', 'Vega', 'Wade', 'Xu',
  'York', 'Zhang', 'Howell', 'Barker', 'Simmons', 'Fowler', 'Berry', 'Long',
];

const POSITION_POOL: Position[] = [
  'P', 'P', 'P', 'P',   // pitchers are most common in drafts
  'C', 'C',
  '1B', '2B', '3B', 'SS',
  'LF', 'CF', 'RF', 'DH',
];

const SUMMARIES_BY_TIER: Record<number, string[]> = {
  1: ['Raw tools, high-risk pick', 'Long development path ahead', 'Needs seasoning in minors'],
  2: ['Solid prospect with ceiling', 'Good athlete, developing skill set', 'Project player with upside'],
  3: ['Ready for upper minors', 'Balanced skill set, consistent performer', 'Safe pick with moderate upside'],
  4: ['Top-100 prospect nationally', 'Premium tools across the board', 'Could contribute quickly'],
  5: ['Generational talent', 'Franchise cornerstone candidate', 'Can\'t-miss prospect'],
};

const PITCH_TYPES: PitchType[] = ['fastball', 'slider', 'curveball', 'changeup', 'sinker', 'cutter', 'splitter'];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function makeDraftProspect(id: string, overallPick: number, teamsCount: number, rng: RandomProvider): DraftProspect {
  const pos = rng.pick(POSITION_POOL);
  const age = rng.nextInt(18, 23);

  // Tier 5 = first few picks, tier 1 = late round
  const tier = Math.max(1, 5 - Math.floor(overallPick / (teamsCount * 1.2)));
  const clampedTier = Math.min(5, tier) as 1 | 2 | 3 | 4 | 5;

  const potentialBase = [50, 60, 68, 78, 88][clampedTier - 1];
  const potentialRating = clamp(rng.nextGaussian(potentialBase, 6), 40, 99);
  // Current rating: younger = further from potential
  const developmentPct = rng.nextFloat(0.35, 0.70);
  const currentRating = clamp(potentialRating * developmentPct, 25, 80);

  const summaryList = SUMMARIES_BY_TIER[clampedTier] ?? SUMMARIES_BY_TIER[3];
  const summary = rng.pick(summaryList);

  return {
    id,
    firstName: rng.pick(FIRST_NAMES),
    lastName: rng.pick(LAST_NAMES),
    position: pos,
    age,
    currentRating,
    potentialRating,
    summary,
  };
}

/**
 * Generate a full draft class with N rounds for M teams.
 */
export function generateDraftClass(rounds: number, teamsCount: number, rng: RandomProvider, year: number = 2026): DraftClass {
  const totalPicks = rounds * teamsCount;
  const prospects: DraftProspect[] = [];
  const picks: DraftPick[] = [];

  let overall = 0;
  for (let round = 1; round <= rounds; round++) {
    for (let pick = 1; pick <= teamsCount; pick++) {
      overall++;
      const id = `draft-${year}-${overall}`;
      prospects.push(makeDraftProspect(id, overall, teamsCount, rng));
      picks.push({
        round,
        pickInRound: pick,
        overallPick: overall,
        teamId: '', // to be assigned
        prospectId: null,
      });
    }
  }

  // Sanity check
  if (prospects.length !== totalPicks) throw new Error('Draft class mismatch');

  return { year, prospects, picks };
}

/**
 * Convert a draft prospect into a full Player object when picked.
 */
export function makePick(
  draftClass: DraftClass,
  teamId: string,
  prospectId: string
): Player | null {
  const prospect = draftClass.prospects.find(p => p.id === prospectId);
  if (!prospect) return null;

  // Mark pick
  const pickEntry = draftClass.picks.find(pk => pk.prospectId === null && pk.teamId === teamId);
  if (pickEntry) {
    pickEntry.prospectId = prospectId;
  }

  const isPitcher = prospect.position === 'P';
  const cr = prospect.currentRating;
  const r = (spread = 10) => clamp(cr + (Math.random() - 0.5) * spread * 2, 25, 95);

  const repertoire: PitchType[] = ['fastball'];
  const pitchCount = Math.floor(Math.random() * 3) + 1;
  const shuffled = [...PITCH_TYPES.slice(1)].sort(() => Math.random() - 0.5);
  for (let i = 0; i < pitchCount; i++) {
    if (shuffled[i]) repertoire.push(shuffled[i]);
  }

  const bats: Hand = Math.random() < 0.25 ? 'S' : (Math.random() < 0.33 ? 'L' : 'R');
  const throws: Hand = Math.random() < 0.25 ? 'L' : 'R';

  return {
    id: prospect.id,
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    number: Math.floor(Math.random() * 98) + 1,
    position: prospect.position,
    bats,
    throws,
    age: prospect.age,
    batting: isPitcher
      ? { contact_L: 15, contact_R: 18, power_L: 10, power_R: 12, eye: 15, avoid_k: 12, gap_power: 10, speed: 25, steal: 5, bunt: 30, clutch: 25 }
      : { contact_L: r(), contact_R: r(), power_L: r(), power_R: r(), eye: r(), avoid_k: r(), gap_power: r(), speed: r(), steal: r(15), bunt: r(15), clutch: r() },
    pitching: isPitcher
      ? { stuff: r(), movement: r(), control: r(), stamina: r(), velocity: clamp(88 + (cr - 50) / 10, 82, 102), hold_runners: r(), groundball_pct: Math.floor(Math.random() * 40) + 30, repertoire }
      : { stuff: 35, movement: 35, control: 35, stamina: 30, velocity: 85, hold_runners: 30, groundball_pct: 50, repertoire: ['fastball'] },
    fielding: [{
      position: prospect.position,
      range: r(),
      arm_strength: r(),
      arm_accuracy: r(),
      turn_dp: r(),
      error_rate: clamp(70 - cr * 0.4, 10, 65),
    }],
    mental: { intelligence: r(8), work_ethic: r(8), durability: r(8), consistency: r(8), composure: r(8), leadership: r(8) },
    state: { fatigue: 0, morale: 80, pitchCount: 0, isInjured: false },
  };
}

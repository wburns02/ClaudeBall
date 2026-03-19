import type { Player } from '../types/player.ts';
import type { Position, Hand, PitchType } from '../types/enums.ts';
import type { RandomProvider } from '../core/RandomProvider.ts';

export type ScoutGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D';
export type ProspectRisk = 'SAFE' | 'MEDIUM' | 'HIGH';

export interface ProspectTools {
  // Hitter tools
  hit: number;          // 20-80 hit tool (bat-to-ball)
  power: number;        // 20-80 raw power
  run: number;          // 20-80 speed/baserunning
  arm: number;          // 20-80 arm strength
  field: number;        // 20-80 fielding ability
  // Pitcher tools
  fastball: number;     // 20-80 fastball velocity/life
  breaker: number;      // 20-80 breaking ball
  changeup: number;     // 20-80 changeup
  command: number;      // 20-80 command/control
}

export interface DraftProspect {
  id: string;
  firstName: string;
  lastName: string;
  position: Position;
  age: number;
  bats: Hand;
  throws: Hand;
  /** Overall current ability 1-100 */
  currentRating: number;
  /** Ceiling potential 1-100 */
  potentialRating: number;
  /** 20-80 tool grades */
  tools: ProspectTools;
  /** Letter grade summary */
  scoutGrade: ScoutGrade;
  /** Risk profile */
  risk: ProspectRisk;
  /** School/origin */
  school: string;
  /** Scouting description */
  summary: string;
  /** Detailed scout blurb */
  scoutReport: string;
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

const SCHOOLS = [
  'Vanderbilt', 'LSU', 'Florida', 'Texas', 'Stanford', 'UCLA', 'Mississippi St.',
  'Arkansas', 'Oregon St.', 'Arizona St.', 'NC State', 'Florida St.', 'Louisville',
  'TCU', 'Ole Miss', 'Georgia', 'South Carolina', 'Miami (FL)', 'Cal Poly', 'Dallas Baptist',
  'Oral Roberts', 'Wake Forest', 'Notre Dame', 'Virginia', 'Clemson',
  'Servite HS', 'IMG Academy', 'Bishop Gorman HS', 'Rockwall HS', 'Corona HS',
  'Bartow HS', 'Winder-Barrow HS', 'Toms River North HS', 'Westbury Christian HS',
];

const SCOUT_REPORTS_HITTER: Record<number, string[]> = {
  5: [
    'A generational hitter with elite bat speed and plus-plus raw power. The hit tool plays to an 80 and he has the chance to be a middle-of-the-order force from day one. No obvious weaknesses.',
    'Pure hitter with rare plate discipline for his age. Stays through the zone exceptionally well, producing loud contact to all fields. Plus runner who profiles center long-term.',
    'The best bat in this class. Exceptional balance in the box, quick hands, and barrels the ball with regularity. Projects as a perennial All-Star candidate.',
  ],
  4: [
    'High-ceiling prospect with plus tools across the board. The power hasn\'t fully clicked yet but the raw strength is undeniable. Strong plate discipline and solid average arm.',
    'Advanced hitter for his age with a clean, repeatable swing. The pull-side power will lead to consistent extra-base damage. Runs well and shows above-average range in center.',
    'Plus-plus speed tool makes him a weapon at the top of any lineup. Makes consistent contact and the power is emerging. Projects as a 20-20 type with continued development.',
  ],
  3: [
    'Solid all-around hitter with no loud tools but no real weaknesses either. The hit tool is average-to-above and the power flashes plus on occasion. Safe floor with moderate upside.',
    'Good bat-to-ball skills and a patient approach at the plate. Doesn\'t have the highest ceiling but profiles as a quality regular who contributes in multiple ways.',
    'Line-drive hitter who uses the whole field. The raw power is below average but he compensates with excellent contact rates and above-average plate discipline.',
  ],
  2: [
    'Project bat with some intriguing tools but significant development remaining. The raw power stands out, though the hit tool is currently below average. High-risk, high-reward type.',
    'Athletic player with an unfinished offensive profile. Quick hands and some pull-side pop, but the swing has length that will require refinement against quality velocity.',
    'Good athlete who needs reps. The speed and arm play regardless, and if the bat develops, there\'s a regular here. Could take 3-4 years to reach potential.',
  ],
  1: [
    'Raw prep bat who\'s years away. The arm strength is legitimate and the speed is above average, but the bat needs extensive work. Long-term project for a patient organization.',
    'Lean and athletic, but the hit tool is very raw. Strikes out at a high rate and needs to tighten up his zone management significantly to profile at the next level.',
    'Late bloomer with some intriguing tools but an extremely underdeveloped offensive profile. Will need a full overhaul of his swing mechanics before contributing.',
  ],
};

const SCOUT_REPORTS_PITCHER: Record<number, string[]> = {
  5: [
    'Electric stuff with a 70-grade fastball that plays up due to elite extension. The breaking ball is a true swing-and-miss offering and the changeup is already above average. Could move quickly.',
    'Premium arm with three plus pitches and the command to deploy them all. Projects as a #1 starter with frontline ceiling. The entire package is here right now.',
    'Rare combination of pure stuff and advanced feel for pitching. The fastball/slider combo is devastating, and the changeup gives him a weapon against lefties. Ace upside.',
  ],
  4: [
    'Mid-90s velocity with a plus slider that generates plenty of swings-and-misses. The command needs refinement but the pure stuff is undeniable. High-leverage arm long-term.',
    'Plus fastball that rides up in the zone and a curveball that shows plus-plus flashes. Starter ceiling if the changeup continues to develop; high-end reliever floor.',
    'Three-pitch mix with above-average velocity and improving command. The breaking ball grades plus and he\'s made strides with his changeup. Projects as a solid mid-rotation arm.',
  ],
  3: [
    'Solid four-pitch starter with average-to-above velocity and reliable command. Doesn\'t miss as many bats as you\'d like but gets plenty of weak contact. Safe, rotational arm.',
    'Polished college pitcher who relies on command and deception over raw stuff. Could move quickly through the system. Mid-rotation ceiling with a solid floor.',
    'Athletic pitcher with a clean delivery and developing secondary offerings. The fastball sits 91-93 and the slider shows average-to-plus potential. Needs refinement but the base is solid.',
  ],
  2: [
    'Power arm who\'s been inconsistent with his mechanics. When it clicks, the stuff is plus-plus, but the command needs major work. Projects as a reliever if he can\'t harness the arsenal.',
    'Big frame with projection remaining. The fastball can touch 95 but more often sits 89-91. Will need time to develop the secondary stuff and refine his delivery.',
    'High-effort delivery raises durability concerns, but the stuff plays when healthy. The slider is a potential plus offering. Could be a late-innings arm if moved to relief.',
  ],
  1: [
    'Raw arm with premium velocity but no feel for the strike zone or off-speed pitches yet. Years away from contributing. Significant mechanical work needed.',
    'Athletic body with a long arm action. The fastball flashes 94 but consistency is lacking. Currently projects as a reliever long-term, but there\'s a starter to develop if things click.',
    'The arm strength is legitimate, but the command and secondary offerings are extremely underdeveloped. Multi-year development project.',
  ],
};

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

function to80Scale(val: number, tier: number, spread = 8): number {
  // Convert 1-100 rating to 20-80 scouting scale with tier-based center
  const center = [30, 40, 50, 60, 70][tier - 1] ?? 50;
  return clamp(Math.round(center + (val - 50) / 5 + (Math.random() - 0.5) * spread), 20, 80);
}

function gradeFromPotential(pot: number): ScoutGrade {
  if (pot >= 92) return 'A+';
  if (pot >= 85) return 'A';
  if (pot >= 80) return 'A-';
  if (pot >= 75) return 'B+';
  if (pot >= 70) return 'B';
  if (pot >= 65) return 'B-';
  if (pot >= 60) return 'C+';
  if (pot >= 55) return 'C';
  if (pot >= 48) return 'C-';
  return 'D';
}

function makeDraftProspect(id: string, overallPick: number, teamsCount: number, rng: RandomProvider): DraftProspect {
  const pos = rng.pick(POSITION_POOL);
  const age = rng.nextInt(17, 23);
  const bats: Hand = rng.next() < 0.25 ? 'S' : rng.next() < 0.33 ? 'L' : 'R';
  const throws: Hand = rng.next() < 0.2 ? 'L' : 'R';

  // Tier 5 = first few picks, tier 1 = late round
  const tier = Math.max(1, 5 - Math.floor(overallPick / (teamsCount * 1.2)));
  const clampedTier = Math.min(5, tier) as 1 | 2 | 3 | 4 | 5;

  const potentialBase = [50, 60, 68, 78, 88][clampedTier - 1];
  const potentialRating = clamp(rng.nextGaussian(potentialBase, 6), 40, 99);
  // Current rating: younger = further from potential
  const developmentPct = rng.nextFloat(0.35, 0.70);
  const currentRating = clamp(potentialRating * developmentPct, 25, 80);

  // Risk: younger + lower tier = higher risk
  const riskScore = (6 - clampedTier) * 20 + Math.max(0, 21 - age) * 5;
  const risk: ProspectRisk = riskScore > 60 ? 'HIGH' : riskScore > 30 ? 'MEDIUM' : 'SAFE';

  // Generate 20-80 tool grades
  const isPitcher = pos === 'P';
  const tools: ProspectTools = isPitcher ? {
    hit: 25, power: 25, run: to80Scale(40, clampedTier),
    arm: to80Scale(potentialRating, clampedTier, 10),
    field: to80Scale(50, clampedTier),
    fastball: to80Scale(potentialRating, clampedTier, 12),
    breaker: to80Scale(potentialRating * 0.9, clampedTier, 15),
    changeup: to80Scale(potentialRating * 0.75, clampedTier, 18),
    command: to80Scale(potentialRating * 0.85, clampedTier, 15),
  } : {
    hit: to80Scale(potentialRating * 0.9, clampedTier, 12),
    power: to80Scale(potentialRating * 0.85, clampedTier, 15),
    run: to80Scale(rng.nextInt(30, 80), clampedTier, 8),
    arm: to80Scale(rng.nextInt(35, 75), clampedTier, 10),
    field: to80Scale(rng.nextInt(35, 75), clampedTier, 10),
    fastball: 25, breaker: 25, changeup: 25, command: 25,
  };

  const summaryList = SUMMARIES_BY_TIER[clampedTier] ?? SUMMARIES_BY_TIER[3];
  const summary = rng.pick(summaryList);
  const reportList = (isPitcher ? SCOUT_REPORTS_PITCHER : SCOUT_REPORTS_HITTER)[clampedTier] ?? [];
  const scoutReport = rng.pick(reportList) ?? summary;

  return {
    id,
    firstName: rng.pick(FIRST_NAMES),
    lastName: rng.pick(LAST_NAMES),
    position: pos,
    age,
    bats,
    throws,
    currentRating,
    potentialRating,
    tools,
    scoutGrade: gradeFromPotential(potentialRating),
    risk,
    school: rng.pick(SCHOOLS),
    summary,
    scoutReport,
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

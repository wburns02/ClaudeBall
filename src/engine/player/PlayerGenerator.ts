import type { Player, BattingRatings, PitchingRatings, FieldingRatings, MentalRatings } from '../types/player.ts';
import type { Position, Hand, PitchType } from '../types/enums.ts';
import { RandomProvider } from '../core/RandomProvider.ts';
import { clamp } from '../util/helpers.ts';
import { uuid } from '../util/helpers.ts';

export type Archetype =
  | 'Power Hitter'
  | 'Contact Specialist'
  | 'Speed Demon'
  | 'Ace Pitcher'
  | 'Closer'
  | 'Two-Way Player';

export interface ArchetypeTemplate {
  archetype: Archetype;
  description: string;
  color: string;           // Tailwind border/accent color (raw hex)
  positions: Position[];   // Suggested positions
  batting: BattingRatings;
  pitching: PitchingRatings;
  fielding: Omit<FieldingRatings, 'position'>;
  mental: MentalRatings;
  potential: number;       // 1-100
}

export const ARCHETYPE_TEMPLATES: ArchetypeTemplate[] = [
  {
    archetype: 'Power Hitter',
    description: 'Built to hit the ball over the fence. Sacrifices contact for raw power.',
    color: '#ef4444',
    positions: ['1B', '3B', 'DH', 'LF', 'RF'],
    batting: {
      contact_L: 52, contact_R: 55, power_L: 82, power_R: 85,
      eye: 50, avoid_k: 38, gap_power: 80, speed: 35, steal: 10, bunt: 15, clutch: 70,
    },
    pitching: { stuff: 30, movement: 30, control: 30, stamina: 30, velocity: 86, hold_runners: 30, groundball_pct: 50, repertoire: ['fastball'] },
    fielding: { range: 45, arm_strength: 55, arm_accuracy: 50, turn_dp: 40, error_rate: 45 },
    mental: { intelligence: 50, work_ethic: 55, durability: 60, consistency: 50, composure: 60, leadership: 50 },
    potential: 75,
  },
  {
    archetype: 'Contact Specialist',
    description: 'Puts the ball in play every time. High average, rarely strikes out.',
    color: '#22c55e',
    positions: ['2B', 'SS', 'CF', 'LF', '1B'],
    batting: {
      contact_L: 80, contact_R: 82, power_L: 35, power_R: 38,
      eye: 75, avoid_k: 80, gap_power: 45, speed: 65, steal: 50, bunt: 65, clutch: 60,
    },
    pitching: { stuff: 30, movement: 30, control: 30, stamina: 30, velocity: 85, hold_runners: 30, groundball_pct: 50, repertoire: ['fastball'] },
    fielding: { range: 65, arm_strength: 52, arm_accuracy: 65, turn_dp: 70, error_rate: 22 },
    mental: { intelligence: 72, work_ethic: 70, durability: 65, consistency: 78, composure: 65, leadership: 55 },
    potential: 70,
  },
  {
    archetype: 'Speed Demon',
    description: 'Legs can change a game. Exceptional speed and baserunning instincts.',
    color: '#f59e0b',
    positions: ['CF', 'SS', '2B', 'LF'],
    batting: {
      contact_L: 65, contact_R: 68, power_L: 28, power_R: 30,
      eye: 60, avoid_k: 62, gap_power: 55, speed: 92, steal: 90, bunt: 72, clutch: 55,
    },
    pitching: { stuff: 30, movement: 30, control: 30, stamina: 30, velocity: 85, hold_runners: 30, groundball_pct: 50, repertoire: ['fastball'] },
    fielding: { range: 90, arm_strength: 58, arm_accuracy: 62, turn_dp: 72, error_rate: 18 },
    mental: { intelligence: 70, work_ethic: 68, durability: 72, consistency: 65, composure: 60, leadership: 50 },
    potential: 68,
  },
  {
    archetype: 'Ace Pitcher',
    description: 'Dominates hitters with a full arsenal. The ace of any staff.',
    color: '#3b82f6',
    positions: ['P'],
    batting: {
      contact_L: 18, contact_R: 20, power_L: 12, power_R: 14,
      eye: 20, avoid_k: 15, gap_power: 10, speed: 28, steal: 5, bunt: 30, clutch: 30,
    },
    pitching: {
      stuff: 78, movement: 72, control: 70, stamina: 78,
      velocity: 95, hold_runners: 60, groundball_pct: 50,
      repertoire: ['fastball', 'slider', 'curveball', 'changeup'],
    },
    fielding: { range: 48, arm_strength: 62, arm_accuracy: 55, turn_dp: 40, error_rate: 40 },
    mental: { intelligence: 72, work_ethic: 80, durability: 70, consistency: 68, composure: 72, leadership: 65 },
    potential: 85,
  },
  {
    archetype: 'Closer',
    description: 'Unhittable in short bursts. Made for high-leverage situations.',
    color: '#a855f7',
    positions: ['P'],
    batting: {
      contact_L: 15, contact_R: 18, power_L: 10, power_R: 12,
      eye: 15, avoid_k: 12, gap_power: 8, speed: 22, steal: 5, bunt: 20, clutch: 28,
    },
    pitching: {
      stuff: 85, movement: 65, control: 68, stamina: 40,
      velocity: 98, hold_runners: 72, groundball_pct: 45,
      repertoire: ['fastball', 'slider', 'cutter'],
    },
    fielding: { range: 45, arm_strength: 60, arm_accuracy: 52, turn_dp: 38, error_rate: 42 },
    mental: { intelligence: 65, work_ethic: 72, durability: 55, consistency: 62, composure: 85, leadership: 58 },
    potential: 80,
  },
  {
    archetype: 'Two-Way Player',
    description: 'Rare talent: can hit AND pitch at an elite level. Versatile but needs time.',
    color: '#d4a843',
    positions: ['P', 'CF', 'RF', 'DH'],
    batting: {
      contact_L: 60, contact_R: 62, power_L: 58, power_R: 62,
      eye: 55, avoid_k: 52, gap_power: 60, speed: 60, steal: 45, bunt: 40, clutch: 62,
    },
    pitching: {
      stuff: 65, movement: 58, control: 60, stamina: 62,
      velocity: 93, hold_runners: 52, groundball_pct: 50,
      repertoire: ['fastball', 'slider', 'changeup'],
    },
    fielding: { range: 65, arm_strength: 68, arm_accuracy: 62, turn_dp: 50, error_rate: 30 },
    mental: { intelligence: 75, work_ethic: 88, durability: 70, consistency: 65, composure: 70, leadership: 72 },
    potential: 90,
  },
];

export interface GeneratePlayerOptions {
  firstName: string;
  lastName: string;
  position: Position;
  bats: Hand;
  throws: Hand;
  archetype: Archetype;
  age?: number;
}

/** Create a custom player from character-creator options. */
export function generatePlayer(opts: GeneratePlayerOptions): Player {
  const template = ARCHETYPE_TEMPLATES.find(t => t.archetype === opts.archetype)!;
  const pos = opts.position;

  return {
    id: uuid(),
    firstName: opts.firstName,
    lastName: opts.lastName,
    number: Math.floor(Math.random() * 99) + 1,
    position: pos,
    bats: opts.bats,
    throws: opts.throws,
    age: opts.age ?? 21,
    batting: { ...template.batting },
    pitching: { ...template.pitching },
    fielding: [{ ...template.fielding, position: pos }],
    mental: { ...template.mental },
    state: { fatigue: 0, morale: 80, pitchCount: 0, isInjured: false },
  };
}

const FIRST_NAMES = [
  'Carlos', 'Jaylen', 'Marcus', 'Derek', 'Tyler', 'Rafael', 'Koji',
  'Dmitri', 'Brandon', 'Terrence', 'Jake', 'Miguel', 'Darnell', 'Luis',
  'Aaron', 'Hector', 'Trevor', 'DeShawn', 'Rodrigo', 'Kenji',
];
const LAST_NAMES = [
  'Rivera', 'Thompson', 'Brooks', 'Mendoza', 'Guerrero', 'Morrison',
  'Tanaka', 'Volkov', 'Washington', 'Mitchell', 'Chen', 'Santos',
  'Williams', 'Jackson', 'Romero', 'Nakamura', 'Johnson', 'Davis',
  'Martinez', 'Robinson',
];

const HANDS: Hand[] = ['L', 'R', 'R', 'R', 'S']; // weighted toward R

/** Generate a random minor-league prospect. */
export function generateProspect(rng: RandomProvider): Player {
  const archTemplate = rng.pick(ARCHETYPE_TEMPLATES);
  const pos = rng.pick(archTemplate.positions);
  const bats = rng.pick(HANDS);
  const thr: Hand = rng.chance(0.1) ? 'L' : 'R';
  const age = rng.nextInt(19, 23);
  const scale = rng.nextFloat(0.75, 0.95); // minor-leaguers are lower-rated

  const sc = (v: number) => clamp(Math.round(v * scale), 10, 99);
  const tb = archTemplate.batting;
  const scaledBatting: BattingRatings = {
    contact_L: sc(tb.contact_L), contact_R: sc(tb.contact_R),
    power_L:   sc(tb.power_L),   power_R:   sc(tb.power_R),
    eye:       sc(tb.eye),       avoid_k:   sc(tb.avoid_k),
    gap_power: sc(tb.gap_power), speed:     sc(tb.speed),
    steal:     sc(tb.steal),     bunt:      sc(tb.bunt),
    clutch:    sc(tb.clutch),
  };

  const scaledPitching: PitchingRatings = {
    ...archTemplate.pitching,
    stuff: clamp(Math.round(archTemplate.pitching.stuff * scale), 10, 99),
    movement: clamp(Math.round(archTemplate.pitching.movement * scale), 10, 99),
    control: clamp(Math.round(archTemplate.pitching.control * scale), 10, 99),
    stamina: clamp(Math.round(archTemplate.pitching.stamina * scale), 10, 99),
    velocity: clamp(Math.round(archTemplate.pitching.velocity * scale), 78, 102),
  };

  const pitchTypes: PitchType[] = archTemplate.pitching.repertoire.slice(0, rng.nextInt(1, 3));

  return {
    id: uuid(),
    firstName: rng.pick(FIRST_NAMES),
    lastName: rng.pick(LAST_NAMES),
    number: rng.nextInt(1, 99),
    position: pos,
    bats,
    throws: thr,
    age,
    batting: scaledBatting,
    pitching: { ...scaledPitching, repertoire: pitchTypes },
    fielding: [{ ...archTemplate.fielding, position: pos, range: clamp(Math.round(archTemplate.fielding.range * scale), 20, 99) }],
    mental: {
      intelligence: clamp(Math.round(archTemplate.mental.intelligence * scale), 30, 99),
      work_ethic: clamp(Math.round(archTemplate.mental.work_ethic * scale), 30, 99),
      durability: clamp(Math.round(archTemplate.mental.durability * scale), 30, 99),
      consistency: clamp(Math.round(archTemplate.mental.consistency * scale), 30, 99),
      composure: clamp(Math.round(archTemplate.mental.composure * scale), 30, 99),
      leadership: clamp(Math.round(archTemplate.mental.leadership * scale), 20, 99),
    },
    state: { fatigue: 0, morale: 75, pitchCount: 0, isInjured: false },
  };
}

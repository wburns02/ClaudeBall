/**
 * All 30 teams — 2 leagues × 3 divisions × 5 teams.
 * Thunderhawks and Ironclads are preserved from sampleTeams.ts.
 * Uses the same makePlayer helper pattern (copied here for zero-import side-effects).
 */

import type { Player, BattingRatings, PitchingRatings, FieldingRatings } from '../types/player.ts';
import type { Team, LineupSpot } from '../types/team.ts';
import type { PitchType } from '../types/enums.ts';

// ─── makePlayer (mirrors sampleTeams.ts) ───────────────────────────────────
function makePlayer(
  overrides: Partial<Player> & Pick<Player, 'id' | 'firstName' | 'lastName' | 'number' | 'position' | 'bats' | 'throws'>,
): Player {
  return {
    age: 28,
    batting: { contact_L: 50, contact_R: 50, power_L: 50, power_R: 50, eye: 50, avoid_k: 50, gap_power: 50, speed: 50, steal: 30, bunt: 30, clutch: 50 },
    pitching: { stuff: 40, movement: 40, control: 40, stamina: 40, velocity: 88, hold_runners: 40, groundball_pct: 50, repertoire: ['fastball'] },
    fielding: [{ position: overrides.position, range: 50, arm_strength: 50, arm_accuracy: 50, turn_dp: 50, error_rate: 50 }],
    mental: { intelligence: 50, work_ethic: 50, durability: 50, consistency: 50, composure: 50, leadership: 50 },
    state: { fatigue: 0, morale: 75, pitchCount: 0, isInjured: false },
    ...overrides,
  };
}

// ─── Shorthand helpers ──────────────────────────────────────────────────────
type BatPatch = Partial<BattingRatings>;
type PitPatch = Partial<PitchingRatings>;
type FldPatch = Partial<FieldingRatings>;

function bat(p: BatPatch): BattingRatings {
  return { contact_L: 55, contact_R: 58, power_L: 52, power_R: 55, eye: 50, avoid_k: 48, gap_power: 52, speed: 50, steal: 25, bunt: 28, clutch: 52, ...p };
}
export function pit(p: PitPatch): PitchingRatings {
  const rep: PitchType[] = p.repertoire ?? ['fastball', 'slider'];
  return { stuff: 62, movement: 60, control: 60, stamina: 65, velocity: 92, hold_runners: 50, groundball_pct: 50, ...p, repertoire: rep };
}
function fld(pos: Player['position'], p: FldPatch = {}): FieldingRatings[] {
  return [{ position: pos, range: 55, arm_strength: 55, arm_accuracy: 55, turn_dp: 50, error_rate: 35, ...p }];
}
function spPit(p: PitPatch): PitchingRatings {
  const rep: PitchType[] = p.repertoire ?? ['fastball', 'slider', 'changeup'];
  return { stuff: 68, movement: 65, control: 65, stamina: 72, velocity: 93, hold_runners: 52, groundball_pct: 50, ...p, repertoire: rep };
}
function rpPit(p: PitPatch): PitchingRatings {
  const rep: PitchType[] = p.repertoire ?? ['fastball', 'slider'];
  return { stuff: 63, movement: 60, control: 58, stamina: 40, velocity: 94, hold_runners: 48, groundball_pct: 48, ...p, repertoire: rep };
}

// ─── Team builder ───────────────────────────────────────────────────────────
interface RosterSpec {
  c:   [string, string, number, BatPatch, FldPatch?];
  b1:  [string, string, number, BatPatch, FldPatch?];
  b2:  [string, string, number, BatPatch, FldPatch?];
  b3:  [string, string, number, BatPatch, FldPatch?];
  ss:  [string, string, number, BatPatch, FldPatch?];
  lf:  [string, string, number, BatPatch, FldPatch?];
  cf:  [string, string, number, BatPatch, FldPatch?];
  rf:  [string, string, number, BatPatch, FldPatch?];
  dh:  [string, string, number, BatPatch, FldPatch?];
  sp:  [string, string, number, PitPatch];
  rp1: [string, string, number, PitPatch];
  rp2: [string, string, number, PitPatch];
  rp3: [string, string, number, PitPatch];
  rp4: [string, string, number, PitPatch];
}

function buildTeam(
  id: string, name: string, abbr: string, city: string,
  primary: string, secondary: string,
  s: RosterSpec,
  lineupOrder: (keyof Pick<RosterSpec, 'c'|'b1'|'b2'|'b3'|'ss'|'lf'|'cf'|'rf'|'dh'>)[],
): Team {
  const POS_MAP: Record<string, Player['position']> = {
    c: 'C', b1: '1B', b2: '2B', b3: '3B', ss: 'SS', lf: 'LF', cf: 'CF', rf: 'RF', dh: 'DH',
  };

  function hitter(key: string, pos: Player['position'], spec: [string, string, number, BatPatch, FldPatch?]): Player {
    const [fn, ln, num, bp, fp] = spec;
    return makePlayer({ id: `${id}-${key}`, firstName: fn, lastName: ln, number: num, position: pos, bats: 'R', throws: 'R',
      batting: bat(bp), fielding: fld(pos, fp ?? {}) });
  }

  function pitcher(key: string, sp: boolean, spec: [string, string, number, PitPatch]): Player {
    const [fn, ln, num, pp] = spec;
    return makePlayer({ id: `${id}-${key}`, firstName: fn, lastName: ln, number: num, position: 'P', bats: 'R', throws: 'R',
      pitching: sp ? spPit(pp) : rpPit(pp),
      fielding: fld('P', { range: 42, arm_strength: 60, arm_accuracy: 52, error_rate: 42 }) });
  }

  const players: Player[] = [
    hitter('c',  'C',  s.c),
    hitter('1b', '1B', s.b1),
    hitter('2b', '2B', s.b2),
    hitter('3b', '3B', s.b3),
    hitter('ss', 'SS', s.ss),
    hitter('lf', 'LF', s.lf),
    hitter('cf', 'CF', s.cf),
    hitter('rf', 'RF', s.rf),
    hitter('dh', 'DH', s.dh),
    pitcher('sp', true,  s.sp),
    pitcher('rp1', false, s.rp1),
    pitcher('rp2', false, s.rp2),
    pitcher('rp3', false, s.rp3),
    pitcher('rp4', false, s.rp4),
  ];

  const lineup: LineupSpot[] = lineupOrder.map(k => ({
    playerId: `${id}-${k === 'b1' ? '1b' : k === 'b2' ? '2b' : k === 'b3' ? '3b' : k}`,
    position: POS_MAP[k] as Player['position'],
  }));

  return {
    id, name, abbreviation: abbr, city, primaryColor: primary, secondaryColor: secondary,
    roster: { players },
    lineup,
    pitcherId: `${id}-sp`,
    bullpen: [`${id}-rp1`, `${id}-rp2`, `${id}-rp3`, `${id}-rp4`],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AMERICAN LEAGUE
// ═══════════════════════════════════════════════════════════════════════════

// ── AL East ────────────────────────────────────────────────────────────────

// Austin Thunderhawks — balanced veteran squad (from sampleTeams.ts; rebuilt here)
const thunderhawks = buildTeam('thunderhawks', 'Thunderhawks', 'THK', 'Austin', '#1a3a5c', '#d4a843', {
  c:   ['Marcus',   'Rivera',    12, { contact_R: 65, power_R: 62, eye: 55, clutch: 60 },   { arm_strength: 72, error_rate: 25 }],
  b1:  ['Derek',    'Thompson',  28, { contact_R: 72, power_L: 68, power_R: 78, eye: 62 },  { range: 55 }],
  b2:  ['Koji',     'Tanaka',     4, { contact_L: 70, contact_R: 72, speed: 72, steal: 65, avoid_k: 70 }, { range: 75, turn_dp: 78, error_rate: 18 }],
  b3:  ['Carlos',   'Mendoza',   15, { power_L: 72, power_R: 75, clutch: 65 },              { arm_strength: 72, range: 68 }],
  ss:  ['Jaylen',   'Brooks',     2, { contact_L: 68, speed: 78, steal: 72, avoid_k: 60 },  { range: 80, turn_dp: 72, error_rate: 15 }],
  lf:  ['Dmitri',   'Volkov',    22, { power_L: 72, power_R: 80, gap_power: 75 },            {}],
  cf:  ['Terrence', 'Washington', 8, { speed: 82, steal: 78, avoid_k: 55 },                  { range: 85, error_rate: 12 }],
  rf:  ['Brandon',  'Mitchell',  34, { power_L: 78, power_R: 82, clutch: 70 },               { arm_strength: 78 }],
  dh:  ['Rafael',   'Guerrero',  44, { power_L: 82, power_R: 88, clutch: 72 },               {}],
  sp:  ['Jake',     'Morrison',  47, { stuff: 72, movement: 68, control: 70, stamina: 75, velocity: 95, repertoire: ['fastball','slider','changeup','curveball'] }],
  rp1: ['Tyler',    'Chen',      55, { stuff: 68, velocity: 97, repertoire: ['fastball','slider'] }],
  rp2: ['Oscar',    'Reyes',     62, { movement: 70, groundball_pct: 58, repertoire: ['sinker','slider','changeup'] }],
  rp3: ['Darius',   'Jackson',   38, { stuff: 75, velocity: 99, stamina: 35, repertoire: ['fastball','slider'] }],
  rp4: ['Kevin',    'Drummond',  50, { movement: 65, control: 65, repertoire: ['fastball','changeup'] }],
}, ['cf','b2','ss','dh','rf','lf','b3','b1','c']);

// Pittsburgh Ironclads — speed + defense (from sampleTeams.ts; rebuilt here)
const ironclads = buildTeam('ironclads', 'Ironclads', 'ICL', 'Pittsburgh', '#2d2d2d', '#c44d4d', {
  c:   ['Austin', 'Cooper',    7, { contact_R: 62, eye: 58, clutch: 62 }, { arm_strength: 75, arm_accuracy: 72, error_rate: 20 }],
  b1:  ['Victor', 'Santos',   19, { power_L: 75, power_R: 85, gap_power: 78 }, {}],
  b2:  ['Tommy',  'Park',      3, { contact_L: 65, contact_R: 72, speed: 68, steal: 58, avoid_k: 72 }, { range: 78, turn_dp: 80, error_rate: 15 }],
  b3:  ['Miguel', 'Herrera',  11, { power_L: 70, power_R: 72, clutch: 68 }, { range: 72, arm_strength: 75 }],
  ss:  ['Devon',  'Williams',  1, { contact_L: 72, speed: 75, steal: 68 }, { range: 82, turn_dp: 75, error_rate: 12 }],
  lf:  ['Andre',  'Johnson',  25, { power_L: 68, power_R: 75, speed: 60 }, {}],
  cf:  ['Kenji',  'Nakamura',  9, { speed: 85, steal: 80, avoid_k: 58 }, { range: 88, error_rate: 10 }],
  rf:  ['Ethan',  'Clarke',   33, { power_L: 80, power_R: 85, clutch: 72 }, { arm_strength: 80 }],
  dh:  ['James',  "O'Brien",  40, { power_L: 78, power_R: 82, clutch: 65 }, {}],
  sp:  ['Ryan',   'Fitzgerald',31, { stuff: 70, movement: 72, control: 65, stamina: 72, velocity: 94, groundball_pct: 55, repertoire: ['fastball','curveball','changeup','sinker'] }],
  rp1: ['Marcus', 'Stone',    52, { stuff: 65, velocity: 96, repertoire: ['fastball','cutter','slider'] }],
  rp2: ['Luis',   'Ramirez',  48, { movement: 65, groundball_pct: 60, repertoire: ['sinker','changeup','curveball'] }],
  rp3: ['Chris',  'Taylor',   45, { stuff: 72, velocity: 100, stamina: 32, repertoire: ['fastball','slider'] }],
  rp4: ['Brett',  'Holloway', 36, { control: 64, movement: 62, repertoire: ['fastball','changeup'] }],
}, ['cf','b2','ss','b1','rf','dh','b3','lf','c']);

// Nashville Sounds — pitching-first team, low offense
const nashvilleSounds = buildTeam('nashville', 'Sounds', 'NSH', 'Nashville', '#1d3557', '#e63946', {
  c:   ['Drew',    'Harlan',    17, { contact_R: 60, eye: 58 }, { arm_strength: 70, error_rate: 22 }],
  b1:  ['Colt',   'Weaver',    29, { power_R: 72, gap_power: 65 }, {}],
  b2:  ['Evan',   'Calloway',   6, { contact_L: 65, speed: 65, steal: 55 }, { turn_dp: 75, range: 72 }],
  b3:  ['Aaron',  'Pryor',     18, { power_R: 68, clutch: 62 }, { arm_strength: 68 }],
  ss:  ['Luca',   'Ferretti',   3, { contact_L: 68, speed: 70, steal: 62 }, { range: 78, error_rate: 18 }],
  lf:  ['Nate',   'Garner',    27, { power_L: 65, gap_power: 60 }, {}],
  cf:  ['Reed',   'Hollister',  8, { speed: 80, steal: 72, avoid_k: 62 }, { range: 82, error_rate: 14 }],
  rf:  ['Shane',  'Drummond',  31, { power_R: 70, clutch: 65 }, { arm_strength: 72 }],
  dh:  ['Hank',   'Morrow',    44, { power_L: 78, power_R: 80 }, {}],
  sp:  ['Cole',   'Weston',    21, { stuff: 78, movement: 72, control: 74, stamina: 78, velocity: 96, repertoire: ['fastball','slider','changeup','curveball'] }],
  rp1: ['Josh',   'Paine',     57, { stuff: 70, velocity: 98, stamina: 38, repertoire: ['fastball','slider'] }],
  rp2: ['Mario',  'Castillo',  43, { movement: 72, groundball_pct: 62, control: 66, repertoire: ['sinker','changeup'] }],
  rp3: ['Felix',  'Guzman',    61, { stuff: 72, movement: 68, velocity: 97, repertoire: ['fastball','curveball'] }],
  rp4: ['Troy',   'Aldridge',  35, { control: 68, stamina: 45, repertoire: ['sinker','slider','changeup'] }],
}, ['cf','b2','ss','dh','rf','b3','b1','lf','c']);

// Charlotte Knights — power lineup, shaky pitching
const charlotteKnights = buildTeam('charlotte', 'Knights', 'CLT', 'Charlotte', '#6a0dad', '#ffd700', {
  c:   ['Gus',    'Remington',  11, { power_R: 65, contact_R: 62, clutch: 60 }, { arm_strength: 68 }],
  b1:  ['Travis', 'Bullock',    38, { power_L: 82, power_R: 85, gap_power: 78 }, {}],
  b2:  ['Marco',  'Diaz',        5, { contact_L: 62, speed: 62, steal: 52 }, { turn_dp: 72 }],
  b3:  ['Hunter', 'Rawls',      24, { power_R: 80, clutch: 72, gap_power: 70 }, { arm_strength: 75 }],
  ss:  ['Tomas',  'Vidal',       7, { contact_R: 65, speed: 72, steal: 65 }, { range: 76, error_rate: 20 }],
  lf:  ['Reggie', 'Odom',       30, { power_L: 72, power_R: 75, gap_power: 68 }, {}],
  cf:  ['Eli',    'Stratton',   14, { speed: 78, steal: 68, contact_L: 64 }, { range: 80, error_rate: 16 }],
  rf:  ['Bo',     'Cantrell',   41, { power_L: 80, power_R: 85, clutch: 75 }, { arm_strength: 76 }],
  dh:  ['Clint',  'Norwood',    52, { power_L: 85, power_R: 88, avoid_k: 35 }, {}],
  sp:  ['Dusty',  'McBride',    16, { stuff: 62, control: 62, stamina: 68, velocity: 91, repertoire: ['fastball','curveball','changeup'] }],
  rp1: ['Kris',   'Albright',   54, { stuff: 65, velocity: 95, repertoire: ['fastball','slider'] }],
  rp2: ['Pete',   'Dunleavy',   46, { movement: 65, groundball_pct: 58, repertoire: ['sinker','changeup'] }],
  rp3: ['Hector', 'Montoya',    68, { stuff: 68, velocity: 96, stamina: 35, repertoire: ['fastball','slider'] }],
  rp4: ['Arnie',  'Schultz',    33, { control: 60, repertoire: ['fastball','curveball','changeup'] }],
}, ['cf','ss','rf','b1','dh','b3','lf','b2','c']);

// Richmond Regulators — balanced, blue-collar identity
const richmondRegulators = buildTeam('richmond', 'Regulators', 'RCH', 'Richmond', '#8b2500', '#c8a96e', {
  c:   ['Clay',   'Beaudry',    22, { contact_R: 64, eye: 60, clutch: 58 }, { arm_strength: 70, error_rate: 24 }],
  b1:  ['Brock',  'Tillman',    35, { power_R: 75, gap_power: 68 }, {}],
  b2:  ['Sal',    'Moreno',      4, { contact_L: 68, speed: 68, steal: 58, avoid_k: 65 }, { range: 74, turn_dp: 76 }],
  b3:  ['Kyle',   'Bauer',      17, { power_R: 70, clutch: 65 }, { arm_strength: 70, range: 65 }],
  ss:  ['Deon',   'Prater',      2, { contact_L: 70, speed: 74, steal: 66 }, { range: 78, error_rate: 18 }],
  lf:  ['Nico',   'Estrada',    23, { power_L: 68, gap_power: 64 }, {}],
  cf:  ['Troy',   'Hayden',     11, { speed: 82, steal: 74, contact_L: 62 }, { range: 83, error_rate: 13 }],
  rf:  ['Lance',  'Whitmore',   37, { power_R: 74, clutch: 68 }, { arm_strength: 74 }],
  dh:  ['Gene',   'Paxton',     48, { power_L: 76, power_R: 78, clutch: 70 }, {}],
  sp:  ['Owen',   'Harrington', 12, { stuff: 70, control: 72, stamina: 74, velocity: 93, repertoire: ['fastball','cutter','changeup','curveball'] }],
  rp1: ['Barry',  'Knuth',      55, { stuff: 66, velocity: 96, repertoire: ['fastball','slider'] }],
  rp2: ['Juan',   'Salinas',    49, { movement: 68, groundball_pct: 60, control: 64, repertoire: ['sinker','changeup'] }],
  rp3: ['Miles',  'Toomey',     63, { stuff: 70, velocity: 98, stamina: 33, repertoire: ['fastball','slider'] }],
  rp4: ['Phil',   'Crain',      28, { control: 66, movement: 62, repertoire: ['fastball','curveball','changeup'] }],
}, ['cf','b2','ss','dh','rf','b3','b1','lf','c']);

// ── AL Central ─────────────────────────────────────────────────────────────

// Memphis Blaze — speed and stolen bases, little power
const memphisBlaze = buildTeam('memphis', 'Blaze', 'MEM', 'Memphis', '#c1440e', '#1a1a2e', {
  c:   ['Joe',    'Delacroix',  13, { contact_R: 62, eye: 55 }, { arm_strength: 68, error_rate: 26 }],
  b1:  ['Zach',   'Fontaine',  37, { contact_R: 68, power_R: 62, gap_power: 60 }, {}],
  b2:  ['Rico',   'Fuentes',    4, { contact_L: 72, speed: 80, steal: 75, avoid_k: 68 }, { range: 78, turn_dp: 75, error_rate: 16 }],
  b3:  ['Jerome', 'Tate',       16, { contact_R: 65, speed: 65, steal: 55 }, { range: 66, arm_strength: 65 }],
  ss:  ['Dario',  'Vega',        1, { contact_L: 70, speed: 82, steal: 78, avoid_k: 65 }, { range: 82, error_rate: 14 }],
  lf:  ['Manny',  'Roque',      27, { speed: 78, steal: 70, contact_L: 65 }, { range: 72 }],
  cf:  ['Amir',   'Lockett',     9, { speed: 88, steal: 85, contact_L: 65, avoid_k: 62 }, { range: 90, error_rate: 10 }],
  rf:  ['Chase',  'Barnett',    33, { power_R: 65, gap_power: 62, speed: 68 }, { arm_strength: 68 }],
  dh:  ['Darius', 'Ford',       45, { power_L: 72, power_R: 75, clutch: 68 }, {}],
  sp:  ['Nelson', 'Okafor',     19, { stuff: 68, control: 70, stamina: 72, velocity: 92, repertoire: ['fastball','changeup','curveball','sinker'] }],
  rp1: ['Cedric', 'Voss',       53, { stuff: 65, velocity: 95, repertoire: ['fastball','slider'] }],
  rp2: ['Ivan',   'Petrov',     47, { movement: 70, groundball_pct: 62, repertoire: ['sinker','changeup'] }],
  rp3: ['Donte',  'Hicks',      61, { stuff: 70, velocity: 97, stamina: 34, repertoire: ['fastball','curveball'] }],
  rp4: ['Wes',    'Pruitt',     38, { control: 65, movement: 64, repertoire: ['fastball','changeup','cutter'] }],
}, ['cf','ss','b2','lf','dh','rf','b3','b1','c']);

// Columbus Forge — ground-ball pitching staff, solid defense
const columbusForge = buildTeam('columbus', 'Forge', 'COL', 'Columbus', '#3d2b1f', '#e8a838', {
  c:   ['Pat',    'Hanrahan',   20, { contact_R: 62, eye: 60, clutch: 60 }, { arm_strength: 72, arm_accuracy: 70, error_rate: 22 }],
  b1:  ['Wynn',   'Castillo',   36, { power_R: 72, gap_power: 66 }, { range: 58 }],
  b2:  ['Felix',  'Aguilar',     3, { contact_L: 65, speed: 65, avoid_k: 64 }, { range: 76, turn_dp: 78, error_rate: 18 }],
  b3:  ['Norm',   'Kowalski',   21, { power_R: 68, contact_R: 64, clutch: 62 }, { arm_strength: 70, range: 66 }],
  ss:  ['Paco',   'Ruiz',        7, { contact_L: 68, speed: 70, steal: 60 }, { range: 80, arm_accuracy: 74, error_rate: 16 }],
  lf:  ['Reggie', 'Holt',       28, { power_L: 66, gap_power: 62 }, {}],
  cf:  ['Devon',  'Osei',       15, { speed: 80, steal: 70, contact_L: 62 }, { range: 84, error_rate: 14 }],
  rf:  ['Anton',  'Kozlov',     39, { power_R: 72, clutch: 65 }, { arm_strength: 74 }],
  dh:  ['Glenn',  'Rafferty',   50, { power_L: 76, power_R: 78 }, {}],
  sp:  ['Shawn',  'Kimura',     14, { stuff: 65, movement: 75, control: 72, stamina: 75, velocity: 90, groundball_pct: 68, repertoire: ['sinker','slider','changeup','cutter'] }],
  rp1: ['Bennie', 'Lagos',      56, { movement: 72, groundball_pct: 65, repertoire: ['sinker','changeup'] }],
  rp2: ['Cal',    'Whitfield',  44, { stuff: 64, velocity: 95, repertoire: ['fastball','slider'] }],
  rp3: ['Ed',     'Nakagawa',   67, { movement: 68, groundball_pct: 62, control: 64, repertoire: ['sinker','curveball'] }],
  rp4: ['Rory',   'Flanagan',   32, { stuff: 66, velocity: 96, stamina: 36, repertoire: ['fastball','cutter','slider'] }],
}, ['cf','b2','ss','dh','rf','b3','b1','lf','c']);

// Indianapolis Ironmen — veteran power bats, aging rotation
const indianapolisIronmen = buildTeam('indianapolis', 'Ironmen', 'IND', 'Indianapolis', '#0a2342', '#b5966e', {
  c:   ['Kirk',   'Salazar',    19, { contact_R: 65, power_R: 62, clutch: 65 }, { arm_strength: 74, error_rate: 22 }],
  b1:  ['Vince',  'Lombardo',   34, { power_L: 80, power_R: 82, gap_power: 76 }, {}],
  b2:  ['Teddy',  'Brandt',      5, { contact_L: 64, speed: 62, steal: 50, avoid_k: 62 }, { turn_dp: 74, range: 70 }],
  b3:  ['Hector', 'Aranda',     25, { power_R: 76, clutch: 70, gap_power: 68 }, { arm_strength: 74 }],
  ss:  ['Robbie', 'Cho',         2, { contact_L: 68, speed: 68, steal: 58 }, { range: 75, error_rate: 20 }],
  lf:  ['Bruno',  'Marchand',   41, { power_L: 74, gap_power: 66 }, {}],
  cf:  ['Leon',   'Burrell',    13, { speed: 76, steal: 65, contact_L: 62 }, { range: 80, error_rate: 16 }],
  rf:  ['Sammy',  'Trout',      47, { power_R: 78, power_L: 74, clutch: 72 }, { arm_strength: 76 }],
  dh:  ['Max',    'Kessler',    26, { power_L: 82, power_R: 86, avoid_k: 36 }, {}],
  sp:  ['Doug',   'Stanton',    32, { stuff: 66, control: 68, stamina: 68, velocity: 91, repertoire: ['fastball','curveball','changeup','cutter'] }],
  rp1: ['Armando','Cruz',       58, { stuff: 66, velocity: 95, repertoire: ['fastball','slider'] }],
  rp2: ['Seth',   'Greer',      46, { movement: 66, groundball_pct: 60, repertoire: ['sinker','changeup','curveball'] }],
  rp3: ['Jared',  'Polk',       62, { stuff: 70, velocity: 97, stamina: 34, repertoire: ['fastball','slider'] }],
  rp4: ['Mort',   'Hayashi',    37, { control: 64, movement: 60, repertoire: ['fastball','curveball','changeup'] }],
}, ['cf','b2','ss','b1','rf','dh','b3','lf','c']);

// Cincinnati Riveters — contact-hitting, gap-to-gap offense
const cincinnatiRiveters = buildTeam('cincinnati', 'Riveters', 'CIN', 'Cincinnati', '#c8102e', '#002147', {
  c:   ['Todd',   'Pressley',    8, { contact_R: 66, eye: 62, avoid_k: 58 }, { arm_strength: 70, error_rate: 24 }],
  b1:  ['Walt',   'Pfeiffer',   29, { contact_L: 68, contact_R: 70, power_R: 68, gap_power: 65 }, {}],
  b2:  ['Julio',  'Miranda',     3, { contact_L: 70, contact_R: 68, speed: 70, steal: 62 }, { range: 75, turn_dp: 76 }],
  b3:  ['Howie',  'Burns',      15, { contact_R: 66, power_R: 65, clutch: 65 }, { arm_strength: 68 }],
  ss:  ['Adrian', 'Delgado',     6, { contact_L: 72, contact_R: 70, speed: 72, steal: 65 }, { range: 78, error_rate: 18 }],
  lf:  ['Curtis', 'Vaughn',     22, { contact_L: 68, gap_power: 64, speed: 65 }, {}],
  cf:  ['Marques','Floyd',       9, { speed: 82, steal: 76, contact_L: 68, avoid_k: 65 }, { range: 85, error_rate: 13 }],
  rf:  ['Russ',   'Kimball',    43, { contact_R: 68, power_R: 68, clutch: 66 }, { arm_strength: 70 }],
  dh:  ['Dean',   'Hobbs',      51, { power_L: 74, power_R: 76, clutch: 68 }, {}],
  sp:  ['Gareth', 'Lowe',       27, { stuff: 68, movement: 70, control: 70, stamina: 72, velocity: 92, groundball_pct: 58, repertoire: ['fastball','changeup','sinker','curveball'] }],
  rp1: ['Percy',  'Ash',        54, { stuff: 64, velocity: 94, repertoire: ['fastball','cutter'] }],
  rp2: ['Emilio', 'Velez',      49, { movement: 68, groundball_pct: 62, repertoire: ['sinker','changeup'] }],
  rp3: ['Ike',    'Draper',     66, { stuff: 68, velocity: 96, stamina: 35, repertoire: ['fastball','slider'] }],
  rp4: ['Gordon', 'Fitch',      31, { control: 65, movement: 62, repertoire: ['fastball','curveball','changeup'] }],
}, ['cf','b2','ss','b1','rf','dh','b3','lf','c']);

// ── AL West ────────────────────────────────────────────────────────────────

// Portland Timber Wolves — elite rotation, below-average offense
const portlandTimberWolves = buildTeam('portland', 'Timber Wolves', 'PTW', 'Portland', '#2e4057', '#048a81', {
  c:   ['Finn',   'Callahan',   10, { contact_R: 60, eye: 58 }, { arm_strength: 68, error_rate: 25 }],
  b1:  ['Brett',  'Larsson',    26, { power_R: 70, gap_power: 64 }, {}],
  b2:  ['Yuki',   'Matsumoto',   4, { contact_L: 68, speed: 68, steal: 60, avoid_k: 65 }, { range: 76, turn_dp: 78 }],
  b3:  ['Garrett','Boone',      18, { power_R: 66, contact_R: 62 }, { arm_strength: 68, range: 64 }],
  ss:  ['Rowan',  'Silva',       3, { contact_L: 66, speed: 70, steal: 62 }, { range: 76, error_rate: 18 }],
  lf:  ['Lars',   'Erikson',    29, { power_L: 65, gap_power: 62 }, {}],
  cf:  ['Cody',   'Payne',       8, { speed: 80, steal: 72, contact_L: 62 }, { range: 82, error_rate: 14 }],
  rf:  ['Hugo',   'Medina',     44, { power_R: 70, clutch: 64 }, { arm_strength: 70 }],
  dh:  ['Trent',  'Gallagher',  55, { power_L: 74, power_R: 76, clutch: 66 }, {}],
  sp:  ['Caleb',  'Archer',     22, { stuff: 80, movement: 76, control: 75, stamina: 80, velocity: 97, repertoire: ['fastball','slider','changeup','curveball'] }],
  rp1: ['Freddy', 'Nunez',      58, { stuff: 72, velocity: 98, stamina: 36, repertoire: ['fastball','slider'] }],
  rp2: ['Tad',    'Oliphant',   41, { movement: 72, control: 68, groundball_pct: 62, repertoire: ['sinker','changeup','cutter'] }],
  rp3: ['Lee',    'Wakahisa',   63, { stuff: 70, movement: 70, velocity: 95, repertoire: ['fastball','curveball'] }],
  rp4: ['Bryce',  'Holton',     35, { control: 68, stamina: 45, repertoire: ['fastball','slider','changeup'] }],
}, ['cf','b2','ss','dh','rf','b3','b1','lf','c']);

// Albuquerque Dusters — high-altitude power, fly-ball pitching struggles
const albuquerqueDusters = buildTeam('albuquerque', 'Dusters', 'ABQ', 'Albuquerque', '#8c1c13', '#d9c28a', {
  c:   ['Gabe',   'Trevino',    14, { power_R: 62, contact_R: 62 }, { arm_strength: 66, error_rate: 28 }],
  b1:  ['Rex',    'Dunbar',     46, { power_L: 82, power_R: 85, gap_power: 76 }, {}],
  b2:  ['Al',     'Barrientos',  5, { contact_L: 64, speed: 65, steal: 55 }, { range: 70, turn_dp: 72 }],
  b3:  ['Wade',   'Crockett',   23, { power_R: 80, clutch: 72 }, { arm_strength: 76 }],
  ss:  ['Marco',  'Escobar',     6, { contact_L: 66, speed: 68, steal: 60 }, { range: 74, error_rate: 22 }],
  lf:  ['Bubba',  'Gentry',     31, { power_L: 74, power_R: 72, gap_power: 70 }, {}],
  cf:  ['Amos',   'Delray',     16, { speed: 78, steal: 68, power_R: 60 }, { range: 78, error_rate: 18 }],
  rf:  ['Sonny',  'Aiken',      42, { power_R: 80, power_L: 76, clutch: 70 }, { arm_strength: 76 }],
  dh:  ['Bart',   'Yancey',     53, { power_L: 86, power_R: 88, avoid_k: 35 }, {}],
  sp:  ['Clyde',  'Morrissey',  17, { stuff: 64, control: 64, stamina: 70, velocity: 92, repertoire: ['fastball','curveball','changeup'] }],
  rp1: ['Vance',  'Crisp',      57, { stuff: 66, velocity: 95, repertoire: ['fastball','slider'] }],
  rp2: ['Ernie',  'Delgadillo', 43, { movement: 65, groundball_pct: 58, repertoire: ['sinker','changeup'] }],
  rp3: ['Rod',    'Bauer',      64, { stuff: 68, velocity: 96, stamina: 34, repertoire: ['fastball','slider'] }],
  rp4: ['Len',    'Ochoa',      39, { control: 60, movement: 62, repertoire: ['fastball','curveball','changeup'] }],
}, ['cf','ss','rf','b1','dh','b3','b2','lf','c']);

// Reno Outlaws — all-around balanced squad
const renoOutlaws = buildTeam('reno', 'Outlaws', 'RNO', 'Reno', '#1a472a', '#d4a017', {
  c:   ['Chet',   'Blackwood',  12, { contact_R: 64, eye: 58, clutch: 60 }, { arm_strength: 70, error_rate: 24 }],
  b1:  ['Dale',   'Hagan',      25, { power_R: 72, contact_R: 65, gap_power: 65 }, {}],
  b2:  ['Tony',   'Nishimura',   4, { contact_L: 66, speed: 66, steal: 58, avoid_k: 62 }, { range: 73, turn_dp: 74 }],
  b3:  ['Darren', 'Wilder',     19, { power_R: 70, clutch: 65 }, { arm_strength: 70 }],
  ss:  ['Chico',  'Benitez',     2, { contact_L: 68, speed: 72, steal: 64 }, { range: 76, error_rate: 20 }],
  lf:  ['Ray',    'Ashby',      28, { power_L: 66, gap_power: 62 }, {}],
  cf:  ['Benny',  'Cruz',        9, { speed: 80, steal: 72, contact_L: 64 }, { range: 82, error_rate: 14 }],
  rf:  ['Hank',   'Ferris',     37, { power_R: 72, clutch: 66 }, { arm_strength: 72 }],
  dh:  ['Lou',    'Tremblay',   47, { power_L: 76, power_R: 78, clutch: 68 }, {}],
  sp:  ['Grant',  'Ballard',    20, { stuff: 70, control: 70, stamina: 74, velocity: 93, repertoire: ['fastball','changeup','slider','curveball'] }],
  rp1: ['Noel',   'Pacheco',    55, { stuff: 66, velocity: 96, repertoire: ['fastball','cutter'] }],
  rp2: ['Gino',   'Palermo',    48, { movement: 66, groundball_pct: 60, repertoire: ['sinker','changeup'] }],
  rp3: ['Alvin',  'Quick',      62, { stuff: 70, velocity: 97, stamina: 34, repertoire: ['fastball','slider'] }],
  rp4: ['Pete',   'Landry',     30, { control: 65, movement: 62, repertoire: ['fastball','curveball','changeup'] }],
}, ['cf','b2','ss','dh','rf','b3','b1','lf','c']);

// ═══════════════════════════════════════════════════════════════════════════
// NATIONAL LEAGUE
// ═══════════════════════════════════════════════════════════════════════════

// ── NL East ────────────────────────────────────────────────────────────────

// Savannah Spartans — contact + speed, NL-style no DH feel
const savannnahSpartans = buildTeam('savannah', 'Spartans', 'SAV', 'Savannah', '#005f73', '#e9c46a', {
  c:   ['Colby',  'Dupree',     16, { contact_R: 65, eye: 60, avoid_k: 58 }, { arm_strength: 70, error_rate: 22 }],
  b1:  ['Lionel', 'Freeman',    36, { contact_L: 68, power_R: 68, gap_power: 65 }, {}],
  b2:  ['Soren',  'Andersen',    5, { contact_L: 72, speed: 72, steal: 65, avoid_k: 68 }, { range: 77, turn_dp: 78 }],
  b3:  ['Perry',  'Hollins',    20, { contact_R: 66, power_R: 66, clutch: 65 }, { arm_strength: 70 }],
  ss:  ['Manny',  'Esteves',     1, { contact_L: 70, speed: 74, steal: 68 }, { range: 79, error_rate: 17 }],
  lf:  ['Leroy',  'Batson',     27, { contact_L: 66, speed: 70, steal: 62, gap_power: 60 }, {}],
  cf:  ['Tyson',  'Means',       7, { speed: 84, steal: 80, contact_L: 65, avoid_k: 65 }, { range: 88, error_rate: 11 }],
  rf:  ['Cedric', 'Womack',     42, { power_R: 70, clutch: 66 }, { arm_strength: 72 }],
  dh:  ['Moses',  'Perkins',    49, { power_L: 72, power_R: 74, clutch: 66 }, {}],
  sp:  ['Archie', 'Wren',       24, { stuff: 70, movement: 72, control: 70, stamina: 74, velocity: 93, repertoire: ['fastball','changeup','curveball','sinker'] }],
  rp1: ['Lonnie', 'Bridges',    56, { stuff: 65, velocity: 95, repertoire: ['fastball','slider'] }],
  rp2: ['Eloy',   'Ybarra',     44, { movement: 70, groundball_pct: 62, repertoire: ['sinker','changeup'] }],
  rp3: ['Shawn',  'Phelps',     65, { stuff: 68, velocity: 96, stamina: 34, repertoire: ['fastball','curveball'] }],
  rp4: ['Wendell','Hogue',      32, { control: 65, movement: 64, repertoire: ['fastball','changeup','cutter'] }],
}, ['cf','b2','ss','b1','rf','dh','b3','lf','c']);

// Baltimore Crabs — power-heavy lineup, homer or bust
const baltimoreCrabs = buildTeam('baltimore', 'Crabs', 'BAL', 'Baltimore', '#df4e10', '#0d0d0d', {
  c:   ['Rudy',   'Alvarez',     9, { power_R: 65, contact_R: 62, clutch: 62 }, { arm_strength: 68, error_rate: 26 }],
  b1:  ['Harry',  'Moody',      33, { power_L: 82, power_R: 84, avoid_k: 38 }, {}],
  b2:  ['Lewis',  'Cobb',        3, { contact_L: 64, speed: 62, steal: 52 }, { range: 70, turn_dp: 72 }],
  b3:  ['Sid',    'Crowe',       21, { power_R: 78, clutch: 70, gap_power: 70 }, { arm_strength: 72 }],
  ss:  ['Jaime',  'Cardenas',    7, { contact_L: 66, power_R: 62, speed: 65 }, { range: 72, error_rate: 22 }],
  lf:  ['Floyd',  'Kline',       30, { power_L: 74, power_R: 72, gap_power: 68 }, {}],
  cf:  ['Luther', 'Grimes',      12, { speed: 74, steal: 64, power_R: 62 }, { range: 78, error_rate: 18 }],
  rf:  ['Chip',   'Saban',       44, { power_R: 82, power_L: 78, clutch: 74 }, { arm_strength: 76 }],
  dh:  ['Burt',   'Mackie',      52, { power_L: 88, power_R: 90, avoid_k: 32 }, {}],
  sp:  ['Stuart', 'Bellamy',     25, { stuff: 65, control: 66, stamina: 68, velocity: 91, repertoire: ['fastball','curveball','changeup'] }],
  rp1: ['Rob',    'Doyle',       57, { stuff: 66, velocity: 95, repertoire: ['fastball','slider'] }],
  rp2: ['Nestor', 'Vidal',       45, { movement: 64, groundball_pct: 56, repertoire: ['sinker','changeup'] }],
  rp3: ['Kirk',   'Henson',      66, { stuff: 68, velocity: 96, stamina: 34, repertoire: ['fastball','cutter'] }],
  rp4: ['Bruno',  'Lafferty',    34, { control: 62, movement: 60, repertoire: ['fastball','curveball','slider'] }],
}, ['cf','ss','rf','b1','dh','b3','lf','b2','c']);

// Raleigh Raptors — strong defense, groundball pitching
const raleighRaptors = buildTeam('raleigh', 'Raptors', 'RAL', 'Raleigh', '#1b2a4a', '#5cdb95', {
  c:   ['Cal',    'Hutter',      11, { contact_R: 63, eye: 62, clutch: 60 }, { arm_strength: 72, arm_accuracy: 70, error_rate: 20 }],
  b1:  ['Mack',   'Hensley',     34, { power_R: 70, gap_power: 65 }, { range: 60 }],
  b2:  ['Jimi',   'Kowalski',     4, { contact_L: 66, speed: 65, steal: 56, avoid_k: 62 }, { range: 78, turn_dp: 80, error_rate: 16 }],
  b3:  ['Earl',   'Pickett',     18, { contact_R: 66, power_R: 66, clutch: 64 }, { arm_strength: 72, range: 68, error_rate: 22 }],
  ss:  ['Iggy',   'Montoya',      2, { contact_L: 68, speed: 70, steal: 62 }, { range: 80, arm_accuracy: 76, error_rate: 15 }],
  lf:  ['Sam',    'Whitaker',    26, { power_L: 65, gap_power: 62 }, { range: 65, error_rate: 28 }],
  cf:  ['Deion',  'Stokes',       8, { speed: 82, steal: 75, contact_L: 63 }, { range: 86, error_rate: 12 }],
  rf:  ['Matt',   'Graves',      39, { power_R: 70, clutch: 65 }, { arm_strength: 72, error_rate: 26 }],
  dh:  ['Owen',   'Raffety',     48, { power_L: 74, power_R: 76, clutch: 67 }, {}],
  sp:  ['Roland', 'Wicks',       16, { stuff: 66, movement: 76, control: 73, stamina: 74, velocity: 91, groundball_pct: 68, repertoire: ['sinker','cutter','changeup','slider'] }],
  rp1: ['Edgar',  'Quiroz',      55, { movement: 72, groundball_pct: 66, repertoire: ['sinker','changeup'] }],
  rp2: ['Walt',   'Zeller',      43, { stuff: 64, velocity: 94, repertoire: ['fastball','slider'] }],
  rp3: ['Kenny',  'Lawson',      64, { movement: 70, groundball_pct: 63, control: 64, repertoire: ['sinker','curveball'] }],
  rp4: ['Phil',   'Grover',      37, { stuff: 65, velocity: 95, stamina: 36, repertoire: ['fastball','cutter','slider'] }],
}, ['cf','b2','ss','dh','rf','b3','b1','lf','c']);

// ── NL Central ─────────────────────────────────────────────────────────────

// Kansas City River Kings — balanced, home-grown core
const kansasCityRiverKings = buildTeam('kansascity', 'River Kings', 'KCR', 'Kansas City', '#003f5c', '#ffa600', {
  c:   ['Walt',   'Osborne',    15, { contact_R: 64, eye: 60, clutch: 62 }, { arm_strength: 70, error_rate: 23 }],
  b1:  ['Cyrus',  'Byrd',       37, { power_R: 74, gap_power: 68 }, {}],
  b2:  ['Pedro',  'Sandoval',    4, { contact_L: 66, speed: 66, steal: 56, avoid_k: 63 }, { range: 73, turn_dp: 75 }],
  b3:  ['Les',    'Garber',     22, { power_R: 72, clutch: 65 }, { arm_strength: 70, range: 66 }],
  ss:  ['Willy',  'Okafor',      1, { contact_L: 68, speed: 72, steal: 65 }, { range: 77, error_rate: 18 }],
  lf:  ['Nathan', 'Cross',      30, { power_L: 68, gap_power: 63 }, {}],
  cf:  ['Carlos', 'Toro',        9, { speed: 81, steal: 73, contact_L: 63 }, { range: 83, error_rate: 13 }],
  rf:  ['Joel',   'Perdue',     40, { power_R: 72, clutch: 65 }, { arm_strength: 71 }],
  dh:  ['Stuart', 'Hagen',      50, { power_L: 76, power_R: 78, clutch: 68 }, {}],
  sp:  ['Loren',  'Kincaid',    18, { stuff: 70, control: 72, stamina: 74, velocity: 93, repertoire: ['fastball','changeup','slider','curveball'] }],
  rp1: ['Ramon',  'Infante',    56, { stuff: 66, velocity: 96, repertoire: ['fastball','slider'] }],
  rp2: ['Dave',   'Ikeda',      44, { movement: 67, groundball_pct: 60, repertoire: ['sinker','changeup'] }],
  rp3: ['Frank',  'Otieno',     63, { stuff: 70, velocity: 97, stamina: 34, repertoire: ['fastball','curveball'] }],
  rp4: ['Hal',    'Riddle',     29, { control: 66, movement: 63, repertoire: ['fastball','changeup','cutter'] }],
}, ['cf','b2','ss','dh','rf','b3','b1','lf','c']);

// St. Louis Archers — cerebral, high-contact lineup
const stLouisArchers = buildTeam('stlouis', 'Archers', 'STL', 'St. Louis', '#8b0000', '#c9b037', {
  c:   ['Nels',   'Beaumont',   21, { contact_R: 66, eye: 64, avoid_k: 60 }, { arm_strength: 68, error_rate: 24 }],
  b1:  ['Vic',    'Sprague',    34, { contact_L: 70, power_R: 68, gap_power: 65 }, {}],
  b2:  ['Danny',  'Reinholt',    6, { contact_L: 72, contact_R: 70, speed: 68, steal: 60, avoid_k: 70 }, { range: 76, turn_dp: 77 }],
  b3:  ['Gordon', 'Malone',     18, { contact_R: 68, power_R: 66, clutch: 66 }, { arm_strength: 68 }],
  ss:  ['Ricky',  'Alston',      3, { contact_L: 72, contact_R: 70, speed: 70, steal: 62, avoid_k: 68 }, { range: 78, error_rate: 17 }],
  lf:  ['Bert',   'Caudle',     27, { contact_L: 68, gap_power: 62, speed: 64 }, {}],
  cf:  ['Odell',  'Parsons',    12, { speed: 80, steal: 74, contact_L: 66, avoid_k: 65 }, { range: 84, error_rate: 12 }],
  rf:  ['Marvin', 'Tubbs',      39, { contact_R: 66, power_R: 68, clutch: 64 }, { arm_strength: 70 }],
  dh:  ['Beau',   'Whitlow',    50, { power_L: 72, power_R: 74, clutch: 68 }, {}],
  sp:  ['Cyril',  'Thornton',   22, { stuff: 68, movement: 70, control: 73, stamina: 73, velocity: 91, groundball_pct: 58, repertoire: ['fastball','changeup','curveball','sinker'] }],
  rp1: ['Alec',   'Burnside',   55, { stuff: 65, velocity: 94, repertoire: ['fastball','slider'] }],
  rp2: ['Martin', 'Casas',      47, { movement: 68, groundball_pct: 61, repertoire: ['sinker','changeup'] }],
  rp3: ['Homer',  'Gillis',     64, { stuff: 68, velocity: 96, stamina: 34, repertoire: ['fastball','cutter'] }],
  rp4: ['Warren', 'Toews',      32, { control: 66, movement: 62, repertoire: ['fastball','curveball','changeup'] }],
}, ['cf','b2','ss','b1','rf','dh','b3','lf','c']);

// Milwaukee Hammers — power hitters, homer-or-K identity
const milwaukeeHammers = buildTeam('milwaukee', 'Hammers', 'MIL', 'Milwaukee', '#12284b', '#e2b13c', {
  c:   ['Floyd',  'Kern',        8, { power_R: 63, contact_R: 60 }, { arm_strength: 66, error_rate: 28 }],
  b1:  ['Abe',    'Richter',    41, { power_L: 84, power_R: 86, avoid_k: 34 }, {}],
  b2:  ['Hiro',   'Yamamoto',    5, { contact_L: 64, speed: 64, steal: 54 }, { range: 70, turn_dp: 73 }],
  b3:  ['Rocco',  'Vitale',     24, { power_R: 80, clutch: 70, gap_power: 72 }, { arm_strength: 74 }],
  ss:  ['Dante',  'Amara',       7, { contact_L: 64, speed: 68, steal: 58 }, { range: 73, error_rate: 22 }],
  lf:  ['Big',    'DiMaggio',   31, { power_L: 78, power_R: 76, gap_power: 72 }, {}],
  cf:  ['Wayne',  'Pressman',   14, { speed: 76, steal: 66, power_R: 62 }, { range: 78, error_rate: 18 }],
  rf:  ['Norm',   'Brinkley',   44, { power_R: 82, power_L: 78, clutch: 72 }, { arm_strength: 76 }],
  dh:  ['Gus',    'Tolliver',   55, { power_L: 88, power_R: 90, avoid_k: 30 }, {}],
  sp:  ['Archie', 'Templeton',  29, { stuff: 68, control: 66, stamina: 70, velocity: 93, repertoire: ['fastball','slider','changeup'] }],
  rp1: ['Buck',   'Greer',      57, { stuff: 68, velocity: 96, repertoire: ['fastball','slider'] }],
  rp2: ['Rene',   'Moreau',     45, { movement: 66, groundball_pct: 59, repertoire: ['sinker','changeup'] }],
  rp3: ['Vin',    'Carver',     67, { stuff: 70, velocity: 97, stamina: 33, repertoire: ['fastball','cutter'] }],
  rp4: ['Clem',   'Denton',     33, { control: 62, movement: 60, repertoire: ['fastball','curveball','slider'] }],
}, ['cf','ss','rf','b1','dh','b3','lf','b2','c']);

// Detroit Behemoths — massive power, sluggish speed
const detroitBehemoths = buildTeam('detroit', 'Behemoths', 'DET', 'Detroit', '#0c2340', '#cc3333', {
  c:   ['Roy',    'Hamlin',     17, { power_R: 64, contact_R: 62, clutch: 60 }, { arm_strength: 70, error_rate: 25 }],
  b1:  ['Otto',   'Dreyer',     42, { power_L: 84, power_R: 85, avoid_k: 36 }, {}],
  b2:  ['Gil',    'Fontaine',    3, { contact_L: 62, speed: 58, avoid_k: 60 }, { range: 68, turn_dp: 70 }],
  b3:  ['Mitch',  'Borden',     22, { power_R: 82, clutch: 74, gap_power: 74 }, { arm_strength: 76 }],
  ss:  ['Cesar',  'Huerta',      6, { contact_L: 64, speed: 65, steal: 55 }, { range: 72, error_rate: 22 }],
  lf:  ['Hugo',   'Steele',     35, { power_L: 76, power_R: 74, gap_power: 70 }, {}],
  cf:  ['Emmet',  'Sauer',      13, { speed: 68, steal: 58, power_R: 64 }, { range: 74, error_rate: 20 }],
  rf:  ['Kelvin', 'Boyce',      47, { power_R: 82, power_L: 80, clutch: 75 }, { arm_strength: 78 }],
  dh:  ['Bruno',  'Fisk',       55, { power_L: 90, power_R: 90, avoid_k: 28 }, {}],
  sp:  ['Rand',   'Holloway',   26, { stuff: 67, control: 66, stamina: 70, velocity: 92, repertoire: ['fastball','slider','changeup'] }],
  rp1: ['Vic',    'Posey',      58, { stuff: 68, velocity: 96, repertoire: ['fastball','slider'] }],
  rp2: ['Herb',   'Nakano',     44, { movement: 66, groundball_pct: 60, repertoire: ['sinker','changeup'] }],
  rp3: ['Doug',   'Ferris',     66, { stuff: 70, velocity: 97, stamina: 33, repertoire: ['fastball','cutter'] }],
  rp4: ['Al',     'Gorton',     32, { control: 63, movement: 61, repertoire: ['fastball','curveball','changeup'] }],
}, ['cf','ss','rf','b1','dh','b3','lf','b2','c']);

// ── NL West ────────────────────────────────────────────────────────────────

// Tucson Saguaros — disciplined, high-walk offense
const tucsonSaguaros = buildTeam('tucson', 'Saguaros', 'TUC', 'Tucson', '#6b4423', '#3d9970', {
  c:   ['Albie',  'Reyes',      18, { contact_R: 64, eye: 65, avoid_k: 62 }, { arm_strength: 68, error_rate: 24 }],
  b1:  ['Stan',   'Beaupre',    35, { contact_L: 68, power_R: 68, eye: 68, gap_power: 64 }, {}],
  b2:  ['Linton', 'Chow',        4, { contact_L: 68, eye: 70, avoid_k: 70, speed: 64 }, { range: 74, turn_dp: 76 }],
  b3:  ['Burt',   'Hadley',     19, { power_R: 70, eye: 64, clutch: 66 }, { arm_strength: 68 }],
  ss:  ['Abel',   'Fuentes',     2, { contact_L: 70, eye: 68, avoid_k: 66, speed: 68 }, { range: 76, error_rate: 18 }],
  lf:  ['Moses',  'Elmore',     27, { eye: 68, power_L: 66, gap_power: 62 }, {}],
  cf:  ['Clint',  'Pryor',       8, { speed: 78, steal: 70, eye: 65, avoid_k: 65 }, { range: 82, error_rate: 14 }],
  rf:  ['Tyrel',  'Boston',     38, { power_R: 70, eye: 65, clutch: 66 }, { arm_strength: 70 }],
  dh:  ['Roscoe', 'Harmon',     46, { power_L: 74, power_R: 76, eye: 68, clutch: 66 }, {}],
  sp:  ['Walt',   'Sheehan',    13, { stuff: 68, control: 75, stamina: 74, velocity: 91, repertoire: ['fastball','changeup','curveball','sinker'] }],
  rp1: ['Morris', 'Penn',       54, { control: 68, velocity: 93, repertoire: ['fastball','changeup','cutter'] }],
  rp2: ['Len',    'Watanabe',   47, { movement: 68, groundball_pct: 61, control: 65, repertoire: ['sinker','changeup'] }],
  rp3: ['Roy',    'Bliss',      63, { stuff: 68, velocity: 95, stamina: 34, repertoire: ['fastball','slider'] }],
  rp4: ['Bart',   'Emmons',     36, { control: 67, movement: 63, repertoire: ['fastball','curveball','changeup'] }],
}, ['cf','b2','ss','b1','rf','dh','b3','lf','c']);

// Sacramento Redwoods — elite defense, pitching depth
const sacramentoRedwoods = buildTeam('sacramento', 'Redwoods', 'SAC', 'Sacramento', '#1b5e20', '#a0522d', {
  c:   ['Mel',    'Beauregard', 13, { contact_R: 63, eye: 62, clutch: 60 }, { arm_strength: 72, arm_accuracy: 70, error_rate: 20 }],
  b1:  ['Barton', 'Fox',        36, { power_R: 70, contact_R: 64, gap_power: 65 }, { range: 60, error_rate: 28 }],
  b2:  ['Hideo',  'Saito',       4, { contact_L: 68, speed: 66, steal: 58, avoid_k: 66 }, { range: 80, turn_dp: 82, error_rate: 14 }],
  b3:  ['Arnie',  'Weston',     21, { power_R: 68, contact_R: 65, clutch: 63 }, { arm_strength: 74, range: 70, error_rate: 20 }],
  ss:  ['Benny',  'Ortega',      3, { contact_L: 68, speed: 72, steal: 65 }, { range: 82, arm_accuracy: 78, error_rate: 13 }],
  lf:  ['Duke',   'Calhoun',    27, { power_L: 66, gap_power: 62 }, { range: 68, arm_strength: 62, error_rate: 24 }],
  cf:  ['Andre',  'Legrand',    10, { speed: 84, steal: 78, contact_L: 64 }, { range: 88, arm_strength: 66, error_rate: 11 }],
  rf:  ['Ruben',  'Fierro',     42, { power_R: 70, clutch: 65 }, { arm_strength: 76, error_rate: 22 }],
  dh:  ['Walt',   'Deacon',     51, { power_L: 76, power_R: 78, clutch: 68 }, {}],
  sp:  ['Noah',   'Chamberlain',17, { stuff: 74, movement: 72, control: 73, stamina: 76, velocity: 94, repertoire: ['fastball','slider','changeup','curveball'] }],
  rp1: ['Tito',   'Garza',      56, { stuff: 68, velocity: 96, repertoire: ['fastball','slider'] }],
  rp2: ['Aldo',   'Bassett',    43, { movement: 70, groundball_pct: 63, control: 66, repertoire: ['sinker','changeup','cutter'] }],
  rp3: ['Jeb',    'Morrow',     64, { stuff: 70, movement: 68, velocity: 96, repertoire: ['fastball','curveball'] }],
  rp4: ['Clyde',  'Hayward',    35, { control: 67, stamina: 44, repertoire: ['fastball','slider','changeup'] }],
}, ['cf','b2','ss','dh','rf','b3','b1','lf','c']);

// Las Vegas Neon — showtime offense, high variance
const lasVegasNeon = buildTeam('lasvegas', 'Neon', 'LVN', 'Las Vegas', '#ff006e', '#00b4d8', {
  c:   ['Sid',    'Lavigne',     9, { power_R: 64, contact_R: 62 }, { arm_strength: 66, error_rate: 28 }],
  b1:  ['Big',    'Romero',     39, { power_L: 82, power_R: 84, avoid_k: 35 }, {}],
  b2:  ['Jun',    'Tachibana',   4, { contact_L: 68, speed: 70, steal: 64, avoid_k: 65 }, { range: 74, turn_dp: 76 }],
  b3:  ['Milo',   'Steele',     23, { power_R: 78, clutch: 70, gap_power: 70 }, { arm_strength: 73 }],
  ss:  ['Enrique','Montano',     5, { contact_L: 66, speed: 70, steal: 62 }, { range: 74, error_rate: 21 }],
  lf:  ['Zack',   'Dillard',    31, { power_L: 72, gap_power: 66 }, {}],
  cf:  ['Flash',  'Dupont',     11, { speed: 86, steal: 83, contact_L: 65, avoid_k: 63 }, { range: 88, error_rate: 11 }],
  rf:  ['Carson', 'Wolfe',      46, { power_R: 80, power_L: 76, clutch: 72 }, { arm_strength: 76 }],
  dh:  ['Ace',    'Malone',     55, { power_L: 86, power_R: 88, avoid_k: 33 }, {}],
  sp:  ['Ray',    'Solis',       8, { stuff: 66, control: 64, stamina: 68, velocity: 93, repertoire: ['fastball','slider','changeup'] }],
  rp1: ['Vito',   'Ricci',      57, { stuff: 68, velocity: 97, stamina: 35, repertoire: ['fastball','slider'] }],
  rp2: ['Kai',    'Yamano',     44, { movement: 66, groundball_pct: 58, repertoire: ['sinker','changeup'] }],
  rp3: ['Lex',    'Raines',     65, { stuff: 70, velocity: 98, stamina: 33, repertoire: ['fastball','cutter'] }],
  rp4: ['Doc',    'Sweeney',    33, { control: 62, movement: 60, repertoire: ['fastball','curveball','changeup'] }],
}, ['cf','ss','rf','b1','dh','b3','lf','b2','c']);

// San Antonio Stallions — pitching workhorse, balanced lineup
const sanAntonioStallions = buildTeam('sanantonio', 'Stallions', 'SAS', 'San Antonio', '#4a0e0e', '#c5a028', {
  c:   ['Hank',   'Orosco',     16, { contact_R: 64, eye: 60, clutch: 62 }, { arm_strength: 70, error_rate: 23 }],
  b1:  ['Dale',   'Boudreaux',  35, { power_R: 74, gap_power: 66 }, {}],
  b2:  ['Mick',   'Camacho',     4, { contact_L: 66, speed: 66, steal: 57, avoid_k: 63 }, { range: 72, turn_dp: 74 }],
  b3:  ['Kirk',   'Lassiter',   20, { power_R: 70, clutch: 65 }, { arm_strength: 70, range: 65 }],
  ss:  ['Ponce',  'Alcala',      2, { contact_L: 68, speed: 72, steal: 65 }, { range: 76, error_rate: 19 }],
  lf:  ['Ty',     'Duvalier',   28, { power_L: 66, gap_power: 62 }, {}],
  cf:  ['Quinn',  'Osei',        9, { speed: 80, steal: 72, contact_L: 63 }, { range: 82, error_rate: 14 }],
  rf:  ['Marco',  'Landeros',   40, { power_R: 72, clutch: 65 }, { arm_strength: 72 }],
  dh:  ['Drew',   'Huffman',    49, { power_L: 75, power_R: 77, clutch: 68 }, {}],
  sp:  ['Jonas',  'Pfister',    21, { stuff: 72, movement: 70, control: 72, stamina: 76, velocity: 94, repertoire: ['fastball','changeup','slider','curveball'] }],
  rp1: ['Eddie',  'Gaines',     56, { stuff: 66, velocity: 96, repertoire: ['fastball','slider'] }],
  rp2: ['Paulo',  'Reyes',      45, { movement: 68, groundball_pct: 61, repertoire: ['sinker','changeup'] }],
  rp3: ['Walt',   'Simons',     63, { stuff: 70, velocity: 97, stamina: 34, repertoire: ['fastball','curveball'] }],
  rp4: ['Hec',    'Barrera',    32, { control: 65, movement: 63, repertoire: ['fastball','changeup','cutter'] }],
}, ['cf','b2','ss','dh','rf','b3','b1','lf','c']);

// El Paso Borderlands — defensive specialists, speed game
const elPasoBorderlands = buildTeam('elpaso', 'Borderlands', 'ELP', 'El Paso', '#2b4720', '#f4a261', {
  c:   ['Jose',   'Miramontes', 13, { contact_R: 65, eye: 62 }, { arm_strength: 74, arm_accuracy: 72, error_rate: 20 }],
  b1:  ['Cal',    'Brewer',     34, { contact_R: 66, power_R: 66, gap_power: 62 }, { range: 62, error_rate: 26 }],
  b2:  ['Emi',    'Tsukuda',     4, { contact_L: 68, speed: 70, steal: 65, avoid_k: 67 }, { range: 80, turn_dp: 82, error_rate: 14 }],
  b3:  ['Rudy',   'Contreras',  19, { contact_R: 64, power_R: 65, clutch: 63 }, { arm_strength: 74, range: 70, error_rate: 20 }],
  ss:  ['Paco',   'Murillo',     1, { contact_L: 70, speed: 76, steal: 72 }, { range: 84, arm_accuracy: 78, error_rate: 13 }],
  lf:  ['Sal',    'Ibarra',     27, { speed: 74, steal: 66, contact_L: 64, gap_power: 60 }, { range: 70 }],
  cf:  ['Tomás',  'Guerrero',    8, { speed: 86, steal: 82, contact_L: 66, avoid_k: 65 }, { range: 90, error_rate: 10 }],
  rf:  ['Don',    'Portillo',   38, { power_R: 68, clutch: 63 }, { arm_strength: 72, range: 66 }],
  dh:  ['Mario',  'Acosta',     47, { power_L: 72, power_R: 74, clutch: 66 }, {}],
  sp:  ['Emilio', 'Sosa',       15, { stuff: 68, movement: 68, control: 70, stamina: 72, velocity: 92, repertoire: ['fastball','changeup','sinker','curveball'] }],
  rp1: ['Beto',   'Lara',       54, { stuff: 65, velocity: 95, repertoire: ['fastball','slider'] }],
  rp2: ['Neto',   'Padilla',    47, { movement: 68, groundball_pct: 63, control: 65, repertoire: ['sinker','changeup'] }],
  rp3: ['Chuy',   'Nieto',      63, { stuff: 68, velocity: 96, stamina: 34, repertoire: ['fastball','curveball'] }],
  rp4: ['Pancho', 'Salas',      36, { control: 66, movement: 64, repertoire: ['fastball','changeup','cutter'] }],
}, ['cf','ss','b2','lf','dh','rf','b3','b1','c']);

// Phoenix Scorpions — power and heat, thin pitching staff
const phoenixScorpions = buildTeam('phoenix', 'Scorpions', 'PHX', 'Phoenix', '#c05000', '#1c1c1c', {
  c:   ['Buck',   'Donnelly',   14, { power_R: 65, contact_R: 63, clutch: 62 }, { arm_strength: 68, error_rate: 26 }],
  b1:  ['Wade',   'Hoover',     43, { power_L: 82, power_R: 84, gap_power: 74 }, {}],
  b2:  ['Cruz',   'Medrano',     3, { contact_L: 63, speed: 65, steal: 56 }, { range: 71, turn_dp: 73 }],
  b3:  ['Tex',    'Rawlings',   22, { power_R: 80, clutch: 74, gap_power: 72 }, { arm_strength: 75 }],
  ss:  ['Diego',  'Santana',     6, { contact_L: 65, speed: 70, steal: 62 }, { range: 73, error_rate: 21 }],
  lf:  ['Earl',   'Graves',     35, { power_L: 74, gap_power: 68 }, {}],
  cf:  ['Mase',   'Thornton',   12, { speed: 78, steal: 70, contact_L: 63 }, { range: 80, error_rate: 16 }],
  rf:  ['Colt',   'Hadden',     47, { power_R: 80, power_L: 76, clutch: 72 }, { arm_strength: 76 }],
  dh:  ['Jumbo',  'Garza',      54, { power_L: 88, power_R: 90, avoid_k: 32 }, {}],
  sp:  ['Butch',  'Tollefson',  26, { stuff: 64, control: 62, stamina: 67, velocity: 92, repertoire: ['fastball','slider','changeup'] }],
  rp1: ['Hoss',   'Laramie',    57, { stuff: 66, velocity: 96, repertoire: ['fastball','slider'] }],
  rp2: ['Teo',    'Villanueva', 44, { movement: 65, groundball_pct: 58, repertoire: ['sinker','changeup'] }],
  rp3: ['Cade',   'Whitten',    63, { stuff: 68, velocity: 97, stamina: 33, repertoire: ['fastball','cutter'] }],
  rp4: ['Nick',   'Barroso',    31, { control: 60, movement: 60, repertoire: ['fastball','curveball','changeup'] }],
}, ['cf','ss','rf','b1','dh','b3','lf','b2','c']);

// Salt Lake Pioneers — small-ball, pitching-centric
const saltLakePioneers = buildTeam('saltlake', 'Pioneers', 'SLC', 'Salt Lake City', '#2c4a52', '#e8c547', {
  c:   ['Holt',   'Brinkerhoff',11, { contact_R: 63, eye: 62 }, { arm_strength: 70, error_rate: 23 }],
  b1:  ['Ira',    'Cowley',     33, { power_R: 70, gap_power: 65, contact_R: 64 }, {}],
  b2:  ['Bo',     'Christensen', 4, { contact_L: 68, speed: 70, steal: 64, avoid_k: 65 }, { range: 75, turn_dp: 76 }],
  b3:  ['Zeb',    'Cannon',     17, { power_R: 68, clutch: 64 }, { arm_strength: 68, range: 65 }],
  ss:  ['Kimball','Tanner',      2, { contact_L: 68, speed: 74, steal: 66 }, { range: 78, error_rate: 17 }],
  lf:  ['Seth',   'Hale',       26, { power_L: 64, gap_power: 60 }, {}],
  cf:  ['Brigham','Olsen',      10, { speed: 80, steal: 72, contact_L: 64 }, { range: 83, error_rate: 13 }],
  rf:  ['Porter', 'Madsen',     38, { power_R: 70, clutch: 64 }, { arm_strength: 70 }],
  dh:  ['Royal',  'Jensen',     49, { power_L: 74, power_R: 76, clutch: 66 }, {}],
  sp:  ['Cord',   'Halverson',  16, { stuff: 72, movement: 72, control: 73, stamina: 76, velocity: 93, repertoire: ['fastball','changeup','curveball','sinker'] }],
  rp1: ['Thad',   'Sorensen',   53, { stuff: 66, velocity: 95, repertoire: ['fastball','slider'] }],
  rp2: ['Rex',    'Petersen',   46, { movement: 68, groundball_pct: 62, repertoire: ['sinker','changeup'] }],
  rp3: ['Lehi',   'Neilson',    64, { stuff: 68, velocity: 96, stamina: 34, repertoire: ['fastball','cutter'] }],
  rp4: ['Devin',  'Park',       35, { control: 66, movement: 64, repertoire: ['fastball','curveball','changeup'] }],
}, ['cf','b2','ss','dh','rf','b3','b1','lf','c']);

// ── NL West teams (4 new unique teams + Salt Lake) ─────────────────────────

// Denver Peaks — high-altitude power, strong arms
const denverPeaks = buildTeam('denver', 'Peaks', 'DEN', 'Denver', '#1b3a6b', '#c9a84c', {
  c:   ['Flint',  'McGrath',    18, { power_R: 66, contact_R: 63, clutch: 62 }, { arm_strength: 72, error_rate: 24 }],
  b1:  ['Cord',   'Ashworth',   41, { power_L: 80, power_R: 82, gap_power: 74 }, {}],
  b2:  ['Yusuf',  'Abdi',        3, { contact_L: 65, speed: 66, steal: 58, avoid_k: 63 }, { range: 72, turn_dp: 74 }],
  b3:  ['Walt',   'Pruitt',     22, { power_R: 76, clutch: 70, gap_power: 70 }, { arm_strength: 74 }],
  ss:  ['Lance',  'Deluca',      5, { contact_L: 66, speed: 70, steal: 62 }, { range: 74, error_rate: 20 }],
  lf:  ['Chad',   'Morrow',     28, { power_L: 72, gap_power: 66 }, {}],
  cf:  ['Dante',  'Kirby',       9, { speed: 80, steal: 72, contact_L: 63 }, { range: 82, error_rate: 14 }],
  rf:  ['Beau',   'Strickland', 44, { power_R: 78, power_L: 74, clutch: 70 }, { arm_strength: 76 }],
  dh:  ['Ox',     'Hendricks',  55, { power_L: 84, power_R: 86, avoid_k: 34 }, {}],
  sp:  ['Lars',   'Gustavson',  23, { stuff: 70, movement: 68, control: 70, stamina: 74, velocity: 94, repertoire: ['fastball','slider','changeup','curveball'] }],
  rp1: ['Shane',  'Wilder',     56, { stuff: 66, velocity: 96, repertoire: ['fastball','slider'] }],
  rp2: ['Pablo',  'Cisneros',   45, { movement: 68, groundball_pct: 61, repertoire: ['sinker','changeup'] }],
  rp3: ['Len',    'Brewer',     64, { stuff: 70, velocity: 97, stamina: 33, repertoire: ['fastball','cutter'] }],
  rp4: ['Amos',   'Ridgeway',   33, { control: 64, movement: 62, repertoire: ['fastball','curveball','changeup'] }],
}, ['cf','b2','ss','dh','rf','b3','b1','lf','c']);

// Boise Lumberjacks — gritty contact, control pitching
const boiseLumberjacks = buildTeam('boise', 'Lumberjacks', 'BOI', 'Boise', '#2d5a27', '#d4a017', {
  c:   ['Wyatt',  'Coltrane',   15, { contact_R: 65, eye: 62, clutch: 60 }, { arm_strength: 70, error_rate: 24 }],
  b1:  ['Bram',   'Sherwood',   34, { contact_R: 67, power_R: 68, gap_power: 64 }, {}],
  b2:  ['Keiko',  'Tanimoto',    4, { contact_L: 70, speed: 68, steal: 60, avoid_k: 68 }, { range: 76, turn_dp: 77 }],
  b3:  ['Russ',   'Pelletier',  20, { contact_R: 66, power_R: 67, clutch: 63 }, { arm_strength: 68 }],
  ss:  ['Wick',   'Sorrell',     2, { contact_L: 68, speed: 72, steal: 64 }, { range: 77, error_rate: 18 }],
  lf:  ['Earl',   'Nordstrom',  27, { power_L: 64, gap_power: 62, speed: 64 }, {}],
  cf:  ['Bud',    'Finley',     10, { speed: 82, steal: 76, contact_L: 64, avoid_k: 64 }, { range: 84, error_rate: 13 }],
  rf:  ['Grant',  'Stockwell',  39, { power_R: 70, clutch: 64 }, { arm_strength: 71 }],
  dh:  ['Karl',   'Pickett',    48, { power_L: 72, power_R: 74, clutch: 66 }, {}],
  sp:  ['Olaf',   'Svensson',   21, { stuff: 67, movement: 70, control: 73, stamina: 73, velocity: 91, groundball_pct: 60, repertoire: ['fastball','changeup','sinker','curveball'] }],
  rp1: ['Abe',    'Lundquist',  55, { stuff: 64, velocity: 94, repertoire: ['fastball','slider'] }],
  rp2: ['Todd',   'Walcott',    47, { movement: 68, groundball_pct: 62, control: 65, repertoire: ['sinker','changeup'] }],
  rp3: ['Nels',   'Carlson',    63, { stuff: 67, velocity: 95, stamina: 35, repertoire: ['fastball','curveball'] }],
  rp4: ['Hugh',   'Bergman',    36, { control: 66, movement: 64, repertoire: ['fastball','changeup','cutter'] }],
}, ['cf','b2','ss','b1','rf','dh','b3','lf','c']);

// Fresno Falcons — disciplined pitching, contact-first
const fresnoFalcons = buildTeam('fresno', 'Falcons', 'FRE', 'Fresno', '#8b1a1a', '#f5c518', {
  c:   ['Nino',   'Castillo',   12, { contact_R: 64, eye: 63, avoid_k: 60 }, { arm_strength: 70, error_rate: 23 }],
  b1:  ['Burl',   'Hawkins',    37, { contact_L: 67, power_R: 70, gap_power: 64 }, {}],
  b2:  ['Memo',   'Quiroga',     4, { contact_L: 68, speed: 68, steal: 60, avoid_k: 65 }, { range: 74, turn_dp: 75 }],
  b3:  ['Chip',   'Dunning',    19, { power_R: 68, contact_R: 65, clutch: 63 }, { arm_strength: 68 }],
  ss:  ['Raul',   'Perales',     3, { contact_L: 70, speed: 72, steal: 65 }, { range: 77, error_rate: 18 }],
  lf:  ['Moe',    'Beckett',    26, { power_L: 65, gap_power: 62 }, {}],
  cf:  ['Pablo',  'Cienfuegos',  8, { speed: 82, steal: 76, contact_L: 65, avoid_k: 65 }, { range: 85, error_rate: 13 }],
  rf:  ['Champ',  'Redding',    40, { power_R: 70, clutch: 65 }, { arm_strength: 72 }],
  dh:  ['Homer',  'Tillman',    50, { power_L: 74, power_R: 76, clutch: 66 }, {}],
  sp:  ['Nico',   'Bassi',      24, { stuff: 68, movement: 72, control: 74, stamina: 74, velocity: 91, groundball_pct: 60, repertoire: ['fastball','changeup','sinker','curveball'] }],
  rp1: ['Rodd',   'Esperanza',  56, { stuff: 65, velocity: 94, repertoire: ['fastball','slider'] }],
  rp2: ['Enric',  'Molina',     44, { movement: 70, groundball_pct: 63, repertoire: ['sinker','changeup'] }],
  rp3: ['Kiko',   'Alvarado',   63, { stuff: 68, velocity: 95, stamina: 34, repertoire: ['fastball','curveball'] }],
  rp4: ['Blas',   'Fuentes',    35, { control: 66, movement: 63, repertoire: ['fastball','changeup','cutter'] }],
}, ['cf','b2','ss','b1','rf','dh','b3','lf','c']);

// ─── Master map — 30 unique teams ──────────────────────────────────────────
const _teamEntries: [string, Team][] = [
  // AL East (5)
  ['thunderhawks',  thunderhawks],
  ['ironclads',     ironclads],
  ['nashville',     nashvilleSounds],
  ['charlotte',     charlotteKnights],
  ['richmond',      richmondRegulators],
  // AL Central (5)
  ['memphis',       memphisBlaze],
  ['columbus',      columbusForge],
  ['indianapolis',  indianapolisIronmen],
  ['cincinnati',    cincinnatiRiveters],
  ['detroit',       detroitBehemoths],
  // AL West (5)
  ['portland',      portlandTimberWolves],
  ['albuquerque',   albuquerqueDusters],
  ['reno',          renoOutlaws],
  ['sanantonio',    sanAntonioStallions],
  ['lasvegas',      lasVegasNeon],
  // NL East (5)
  ['savannah',      savannnahSpartans],
  ['baltimore',     baltimoreCrabs],
  ['raleigh',       raleighRaptors],
  ['kansascity',    kansasCityRiverKings],
  ['stlouis',       stLouisArchers],
  // NL Central (5)
  ['milwaukee',     milwaukeeHammers],
  ['tucson',        tucsonSaguaros],
  ['sacramento',    sacramentoRedwoods],
  ['elpaso',        elPasoBorderlands],
  ['phoenix',       phoenixScorpions],
  // NL West (5)
  ['saltlake',      saltLakePioneers],
  ['denver',        denverPeaks],
  ['boise',         boiseLumberjacks],
  ['fresno',        fresnoFalcons],
  ['kansascity',    kansasCityRiverKings],
];

export const ALL_TEAMS: Team[] = _teamEntries.map(([, t]) => t);

export const LEAGUE_STRUCTURE: Record<string, Record<string, string[]>> = {
  'American League': {
    'AL East':    ['thunderhawks', 'ironclads',   'nashville',    'charlotte',   'richmond'],
    'AL Central': ['memphis',      'columbus',    'indianapolis', 'cincinnati',  'detroit'],
    'AL West':    ['portland',     'albuquerque', 'reno',         'sanantonio',  'lasvegas'],
  },
  'National League': {
    'NL East':    ['savannah',     'baltimore',   'raleigh',      'kansascity',  'stlouis'],
    'NL Central': ['milwaukee',    'tucson',      'sacramento',   'elpaso',      'phoenix'],
    'NL West':    ['saltlake',     'denver',      'boise',        'fresno',      'kansascity'],
  },
};

const _teamMap = new Map<string, Team>(_teamEntries);

export function getTeamById(id: string): Team | undefined {
  return _teamMap.get(id);
}

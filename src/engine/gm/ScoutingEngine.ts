import type { Player } from '../types/player.ts';
import type { RandomProvider } from '../core/RandomProvider.ts';

/** A team's scouting department. Accuracy 40–90; higher = less noise in grade reports. */
export interface ScoutingStaff {
  accuracy: number;         // 40–90 overall accuracy
  budget: number;           // annual cost in thousands (e.g. 5000 = $5M)
  level: 'skeleton' | 'average' | 'good' | 'elite';
  specialties: ScoutingSpecialty[];
}

export type ScoutingSpecialty = 'pitching' | 'hitting' | 'defense' | 'speed';

/** A scouted grade for a single attribute — may differ from true grade. */
export interface GradeReport {
  scoutedGrade: number;  // 20-80 what scout thinks (rounded to nearest 5)
  confidence: number;    // 0–100 (100 = certain, 0 = wild guess)
  margin: number;        // ±X error range (shown in UI as "55 ± 8")
}

/** Full scouting report for a player. */
export interface PlayerScoutingReport {
  playerId: string;
  teamId: string;
  day: number;               // season day report was generated
  accuracy: number;          // staff accuracy when scouted
  grades: Record<string, GradeReport>;
  overallGrade: GradeReport;
  projectedRole: string;
  riskLevel: 'LOW' | 'MED' | 'HIGH';
  scoutNotes: string[];
  isFoggy: boolean;          // true = uncertain/low confidence
}

/** Default (unscouted) staff when franchise starts */
export function defaultScoutingStaff(): ScoutingStaff {
  return {
    accuracy: 55,
    budget: 4000,
    level: 'average',
    specialties: [],
  };
}

export const STAFF_TIERS: Array<{
  level: ScoutingStaff['level'];
  label: string;
  accuracy: number;
  budget: number;
  description: string;
}> = [
  { level: 'skeleton', label: 'Skeleton Crew',  accuracy: 42, budget: 1500,  description: 'Two part-time scouts. Reports are unreliable.' },
  { level: 'average',  label: 'Average Staff',  accuracy: 55, budget: 4000,  description: 'Standard scouting department. Reasonable accuracy.' },
  { level: 'good',     label: 'Good Staff',     accuracy: 70, budget: 8500,  description: 'Strong coverage. Well-calibrated grades.' },
  { level: 'elite',    label: 'Elite Network',  accuracy: 85, budget: 16000, description: 'Full-time advanced scouts. Near-perfect accuracy.' },
];

/**
 * Generate a scouted grade with noise based on accuracy.
 * Higher accuracy = tighter noise distribution.
 */
export function scoutGrade(
  trueGrade: number,
  accuracy: number,
  rng: RandomProvider,
): GradeReport {
  // Noise std dev: 0 accuracy → ±15, 90 accuracy → ±2
  const sigma = 15 - (accuracy / 90) * 13;
  const noise = rng.nextGaussian(0, sigma);
  const raw = trueGrade + noise;
  // Round to nearest 5 (standard scouting step) and clamp
  const scoutedGrade = Math.round(Math.max(20, Math.min(80, raw)) / 5) * 5;
  const margin = Math.round(sigma * 1.5); // ±1.5σ approximates 87% CI
  const confidence = Math.round(Math.max(10, Math.min(100, 100 - sigma * 5)));
  return { scoutedGrade, confidence, margin };
}

/** Linear 0–100 → 20–80 (OFP scouting scale) */
function to80(val: number): number {
  return Math.round(Math.max(20, Math.min(80, 20 + (val / 100) * 60)) / 5) * 5;
}

/** Build a full scouting report for a player. */
export function generateScoutingReport(
  player: Player,
  teamId: string,
  day: number,
  staff: ScoutingStaff,
  rng: RandomProvider,
  isOwnPlayer: boolean = false,
): PlayerScoutingReport {
  const acc = isOwnPlayer ? 90 : staff.accuracy; // your own players always fully scouted

  const isPitcher = player.position === 'P';

  const grades: Record<string, GradeReport> = {};

  if (isPitcher) {
    const veloGrade = Math.max(20, Math.min(80, Math.round(((player.pitching.velocity - 85) / 15) * 60 + 20)));
    grades['Velocity']  = scoutGrade(veloGrade,              acc, rng);
    grades['Stuff']     = scoutGrade(to80(player.pitching.stuff),     acc + (staff.specialties.includes('pitching') ? 10 : 0), rng);
    grades['Movement']  = scoutGrade(to80(player.pitching.movement),  acc + (staff.specialties.includes('pitching') ? 10 : 0), rng);
    grades['Control']   = scoutGrade(to80(player.pitching.control),   acc, rng);
    grades['Stamina']   = scoutGrade(to80(player.pitching.stamina),   acc, rng);
  } else {
    const hitAcc   = acc + (staff.specialties.includes('hitting')  ? 10 : 0);
    const defAcc   = acc + (staff.specialties.includes('defense')  ? 10 : 0);
    const speedAcc = acc + (staff.specialties.includes('speed')    ? 10 : 0);
    const contact  = to80((player.batting.contact_L + player.batting.contact_R) / 2);
    const power    = to80((player.batting.power_L   + player.batting.power_R)   / 2);
    const fld      = player.fielding[0] ? to80(player.fielding[0].range) : 40;
    const arm      = player.fielding[0] ? to80(player.fielding[0].arm_strength) : 40;
    grades['Hit']    = scoutGrade(contact,              hitAcc,   rng);
    grades['Power']  = scoutGrade(power,                hitAcc,   rng);
    grades['Run']    = scoutGrade(to80(player.batting.speed), speedAcc, rng);
    grades['Field']  = scoutGrade(fld,                  defAcc,   rng);
    grades['Arm']    = scoutGrade(arm,                  defAcc,   rng);
    grades['Eye']    = scoutGrade(to80(player.batting.eye),   hitAcc,   rng);
  }

  // Overall grade from individual grades
  const gradeValues = Object.values(grades).map(g => g.scoutedGrade);
  const trueOverall = Math.round(gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length);
  const overallGrade = scoutGrade(trueOverall, Math.min(90, acc + 5), rng);

  // Projected role
  const proj = projectedRole(overallGrade.scoutedGrade, player.age, isPitcher);

  // Risk level: based on average confidence
  const avgConf = Object.values(grades).reduce((s, g) => s + g.confidence, 0) / Object.values(grades).length;
  const riskLevel = avgConf >= 70 ? 'LOW' : avgConf >= 45 ? 'MED' : 'HIGH';

  // Scout notes — flavor text based on grades and age
  const notes = buildScoutNotes(player, grades, overallGrade, isPitcher, acc, rng);

  const isFoggy = avgConf < 60;

  return {
    playerId: player.id,
    teamId,
    day,
    accuracy: acc,
    grades,
    overallGrade,
    projectedRole: proj,
    riskLevel,
    scoutNotes: notes,
    isFoggy,
  };
}

function projectedRole(overall: number, age: number, isPitcher: boolean): string {
  if (isPitcher) {
    if (overall >= 70) return age <= 25 ? 'Future Ace' : 'Ace';
    if (overall >= 60) return age <= 25 ? 'Future #2' : '#2 Starter';
    if (overall >= 52) return 'Back-of-Rotation';
    if (overall >= 44) return 'Swingman';
    return 'Bullpen Arm';
  }
  if (overall >= 70) return age <= 25 ? 'Future Star' : 'All-Star';
  if (overall >= 62) return age <= 25 ? 'High Upside' : 'Solid Starter';
  if (overall >= 52) return 'Regular Starter';
  if (overall >= 44) return 'Platoon Player';
  return 'Bench / 4A';
}

const NOTE_TEMPLATES = {
  fastball_plus: ['Mid-to-upper 90s fastball that plays up in the zone.', 'Heater has serious life — batters can\'t catch up.'],
  command_plus:  ['Pinpoint command. Dots corners at will.', 'Plus command keeps him ahead in counts all game.'],
  raw_power:     ['Plus-plus raw power, quick hands through the zone.', 'Massive exit velocity — ball jumps off the bat.'],
  hit_tool:      ['Smooth, repeatable swing with advanced bat-to-ball skill.', 'Excellent contact rates from both sides of the plate.'],
  speed:         ['Plus runner — 70 speed, threat on the bases.', 'Elite wheels, can beat out infield hits regularly.'],
  control_issue: ['Walks too many hitters. Command needs refinement.', 'Struggles to locate breaking ball consistently.'],
  injury_risk:   ['Delivery creates extra strain on the arm.', 'Short arm path raises durability questions.'],
  upside_bat:    ['Raw bat needs polish but the ceiling is enormous.', 'Tremendous upside if he learns to use all fields.'],
  vet_decline:   ['Skills fading. Best used in limited role.', 'Production declining with age — value is waning.'],
  toolsy:        ['All the tools are there — just needs reps.', 'Five-tool talent who needs development time.'],
  foggy_hitter:  ['Limited looks on this player — tough to grade fully.', 'Need more AB data to form confident opinion.'],
  foggy_pitcher: ['Only saw him in relief — need a full start to evaluate.', 'Small sample. Report confidence is low.'],
};

function buildScoutNotes(
  player: Player,
  grades: Record<string, GradeReport>,
  overall: GradeReport,
  isPitcher: boolean,
  accuracy: number,
  rng: RandomProvider,
): string[] {
  const notes: string[] = [];

  if (accuracy < 55) {
    const foggy = isPitcher ? NOTE_TEMPLATES.foggy_pitcher : NOTE_TEMPLATES.foggy_hitter;
    notes.push(rng.pick(foggy)!);
  }

  if (isPitcher) {
    if ((grades['Velocity']?.scoutedGrade ?? 0) >= 70) notes.push(rng.pick(NOTE_TEMPLATES.fastball_plus)!);
    if ((grades['Control']?.scoutedGrade ?? 0) >= 65) notes.push(rng.pick(NOTE_TEMPLATES.command_plus)!);
    if ((grades['Control']?.scoutedGrade ?? 0) <= 40) notes.push(rng.pick(NOTE_TEMPLATES.control_issue)!);
    if (player.age >= 34) notes.push(rng.pick(NOTE_TEMPLATES.vet_decline)!);
  } else {
    if ((grades['Power']?.scoutedGrade ?? 0) >= 65) notes.push(rng.pick(NOTE_TEMPLATES.raw_power)!);
    if ((grades['Hit']?.scoutedGrade ?? 0) >= 65) notes.push(rng.pick(NOTE_TEMPLATES.hit_tool)!);
    if ((grades['Run']?.scoutedGrade ?? 0) >= 65) notes.push(rng.pick(NOTE_TEMPLATES.speed)!);
    if (overall.scoutedGrade >= 60 && player.age <= 24) notes.push(rng.pick(NOTE_TEMPLATES.toolsy)!);
    if (player.age >= 34) notes.push(rng.pick(NOTE_TEMPLATES.vet_decline)!);
  }

  return notes.slice(0, 2); // cap at 2 notes
}


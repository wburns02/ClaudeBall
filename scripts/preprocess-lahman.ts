/**
 * Lahman Database Preprocessing Script
 * Reads the SQLite Lahman db, converts player stats to game ratings,
 * outputs one JSON file per decade into public/data/lahman/
 *
 * Usage: npx tsx scripts/preprocess-lahman.ts
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = '/mnt/win11/Fedora/lahman/lahman-baseball-mysql-master/lahmansbaseballdb.sqlite';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data', 'lahman');

// ── Types ──────────────────────────────────────────────────────────────────

interface LahmanBatter {
  playerID: string;
  yearID: number;
  teamID: string;
  AB: number;
  H: number;
  '2B': number;
  '3B': number;
  HR: number;
  BB: number;
  SO: number;
  SB: number;
  SF: number | null;
  SLG?: number;
  PA?: number;
}

interface LahmanPitcher {
  playerID: string;
  yearID: number;
  teamID: string;
  IPouts: number;
  SO: number;
  BB: number;
  HR: number;
  ER: number;
  GS: number;
  G: number;
}

interface LahmanPerson {
  playerID: string;
  nameFirst: string | null;
  nameLast: string | null;
  bats: string | null;
  throws: string | null;
  birthYear: number | null;
}

interface LahmanFielding {
  playerID: string;
  yearID: number;
  teamID: string;
  POS: string;
  G: number;
  InnOuts: number | null;
  PO: number | null;
  A: number | null;
  E: number | null;
}

interface LahmanTeam {
  yearID: number;
  teamID: string;
  lgID: string;
  name: string;
  W: number;
  L: number;
}

// Output types matching our game engine
interface OutBattingRatings {
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

interface OutPitchingRatings {
  stuff: number;
  movement: number;
  control: number;
  stamina: number;
  velocity: number;
  hold_runners: number;
  groundball_pct: number;
  repertoire: string[];
}

interface OutFieldingRating {
  position: string;
  range: number;
  arm_strength: number;
  arm_accuracy: number;
  turn_dp: number;
  error_rate: number;
}

interface OutMentalRatings {
  intelligence: number;
  work_ethic: number;
  durability: number;
  consistency: number;
  composure: number;
  leadership: number;
}

interface OutPlayer {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  position: string;
  bats: string;
  throws: string;
  age: number;
  batting: OutBattingRatings;
  pitching: OutPitchingRatings;
  fielding: OutFieldingRating[];
  mental: OutMentalRatings;
  state: { fatigue: number; morale: number; pitchCount: number; isInjured: boolean };
}

interface OutTeam {
  id: string;
  name: string;
  abbreviation: string;
  city: string;
  primaryColor: string;
  secondaryColor: string;
  league: string;
  wins: number;
  losses: number;
  roster: { players: OutPlayer[] };
  lineup: { playerId: string; position: string }[];
  pitcherId: string;
  bullpen: string[];
}

interface SeasonData {
  teams: OutTeam[];
}

interface DecadeData {
  seasons: Record<number, SeasonData>;
}

// ── Rating Formulas ────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Map a stat to 1-100 rating using era-normalized z-score */
function toRating(value: number, mean: number, stddev: number): number {
  if (stddev <= 0) return 50;
  const z = (value - mean) / stddev;
  // sigmoid maps: z=-2 → ~15, z=0 → 50, z=+2 → ~85
  return Math.round(Math.max(1, Math.min(100, 50 + 35 * (sigmoid(z * 1.5) * 2 - 1))));
}

/** Invert a rating (lower raw stat = better, e.g. error_rate, BB/9) */
function toRatingInverted(value: number, mean: number, stddev: number): number {
  return toRating(-value, -mean, stddev);
}

interface Stats {
  mean: number;
  stddev: number;
}

function calcStats(values: number[]): Stats {
  if (values.length === 0) return { mean: 0, stddev: 1 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return { mean, stddev: Math.sqrt(variance) || 1 };
}

// ── Position mapping ───────────────────────────────────────────────────────

const POS_MAP: Record<string, string> = {
  P: 'P', C: 'C', '1B': '1B', '2B': '2B', '3B': '3B',
  SS: 'SS', LF: 'LF', CF: 'CF', RF: 'RF',
  OF: 'LF', // map generic OF to LF
  DH: 'DH',
};

function mapPosition(pos: string): string {
  return POS_MAP[pos] ?? 'DH';
}

// ── Team color lookup ──────────────────────────────────────────────────────

const TEAM_COLORS: Record<string, { primary: string; secondary: string; city: string }> = {
  NYA: { primary: '#003087', secondary: '#e4002b', city: 'New York' },
  NYN: { primary: '#002d72', secondary: '#ff5910', city: 'New York' },
  BOS: { primary: '#bd3039', secondary: '#0d2b56', city: 'Boston' },
  LAN: { primary: '#005a9c', secondary: '#ef3e42', city: 'Los Angeles' },
  SLN: { primary: '#c41e3a', secondary: '#fedb00', city: 'St. Louis' },
  ATL: { primary: '#ce1141', secondary: '#13274f', city: 'Atlanta' },
  CHN: { primary: '#0e3386', secondary: '#cc3433', city: 'Chicago' },
  CHA: { primary: '#27251f', secondary: '#c4ced4', city: 'Chicago' },
  DET: { primary: '#0c2c56', secondary: '#fa4616', city: 'Detroit' },
  OAK: { primary: '#003831', secondary: '#efb21e', city: 'Oakland' },
  MIN: { primary: '#002b5c', secondary: '#d31145', city: 'Minnesota' },
  CLE: { primary: '#00385d', secondary: '#e31937', city: 'Cleveland' },
  BAL: { primary: '#df4601', secondary: '#000000', city: 'Baltimore' },
  SFN: { primary: '#fd5a1e', secondary: '#27251f', city: 'San Francisco' },
  CIN: { primary: '#c6011f', secondary: '#000000', city: 'Cincinnati' },
  HOU: { primary: '#002d62', secondary: '#eb6e1f', city: 'Houston' },
  PHI: { primary: '#e81828', secondary: '#002d72', city: 'Philadelphia' },
  PIT: { primary: '#fdb827', secondary: '#27251f', city: 'Pittsburgh' },
  SDN: { primary: '#2f241d', secondary: '#ffc425', city: 'San Diego' },
  MON: { primary: '#003087', secondary: '#e4002b', city: 'Montreal' },
  MIL: { primary: '#12284b', secondary: '#ffc52f', city: 'Milwaukee' },
  SEA: { primary: '#0c2c56', secondary: '#005c5c', city: 'Seattle' },
  TOR: { primary: '#003da5', secondary: '#e8291c', city: 'Toronto' },
  CAL: { primary: '#003263', secondary: '#b71234', city: 'California' },
  ANA: { primary: '#003263', secondary: '#b71234', city: 'Anaheim' },
  LAA: { primary: '#003263', secondary: '#ba0021', city: 'Los Angeles' },
  KCA: { primary: '#004687', secondary: '#c09a5b', city: 'Kansas City' },
  TEX: { primary: '#003278', secondary: '#c0111f', city: 'Texas' },
  MIA: { primary: '#00a3e0', secondary: '#ef3340', city: 'Miami' },
  FLO: { primary: '#0077c8', secondary: '#ff6600', city: 'Florida' },
  TBA: { primary: '#092c5c', secondary: '#8fbce6', city: 'Tampa Bay' },
  COL: { primary: '#33006f', secondary: '#c4ced4', city: 'Colorado' },
  ARI: { primary: '#a71930', secondary: '#e3d4ad', city: 'Arizona' },
  WAS: { primary: '#ab0003', secondary: '#14225a', city: 'Washington' },
  WSN: { primary: '#ab0003', secondary: '#14225a', city: 'Washington' },
  KC: { primary: '#004687', secondary: '#c09a5b', city: 'Kansas City' },
};

function getTeamColors(teamID: string): { primary: string; secondary: string; city: string } {
  return TEAM_COLORS[teamID] ?? { primary: '#1a3a5c', secondary: '#d4a843', city: teamID };
}

// ── Main Processing ────────────────────────────────────────────────────────

function processYear(
  db: Database.Database,
  year: number
): SeasonData | null {
  // Get teams for this year
  const teams = db.prepare(`
    SELECT yearID, teamID, lgID, name, W, L
    FROM teams
    WHERE yearID = ?
    ORDER BY lgID, W DESC
  `).all(year) as LahmanTeam[];

  if (teams.length === 0) return null;

  // Get all batters with enough PA
  const batters = db.prepare(`
    SELECT b.playerID, b.yearID, b.teamID,
           COALESCE(b.AB, 0) as AB,
           COALESCE(b.H, 0) as H,
           COALESCE(b."2B", 0) as "2B",
           COALESCE(b."3B", 0) as "3B",
           COALESCE(b.HR, 0) as HR,
           COALESCE(b.BB, 0) as BB,
           COALESCE(b.SO, 0) as SO,
           COALESCE(b.SB, 0) as SB,
           COALESCE(b.SF, 0) as SF
    FROM batting b
    WHERE b.yearID = ? AND b.AB >= 100
    ORDER BY b.AB DESC
  `).all(year) as LahmanBatter[];

  // Get all pitchers with enough IP (50 IP = 150 IPouts)
  const pitchers = db.prepare(`
    SELECT p.playerID, p.yearID, p.teamID,
           COALESCE(p.IPouts, 0) as IPouts,
           COALESCE(p.SO, 0) as SO,
           COALESCE(p.BB, 0) as BB,
           COALESCE(p.HR, 0) as HR,
           COALESCE(p.ER, 0) as ER,
           COALESCE(p.GS, 0) as GS,
           COALESCE(p.G, 0) as G
    FROM pitching p
    WHERE p.yearID = ? AND p.IPouts >= 45
    ORDER BY p.IPouts DESC
  `).all(year) as LahmanPitcher[];

  // Get people info
  const people = db.prepare(`
    SELECT playerID, nameFirst, nameLast, bats, throws, birthYear
    FROM people
  `).all() as LahmanPerson[];
  const peopleMap = new Map<string, LahmanPerson>(people.map(p => [p.playerID, p]));

  // Get fielding data
  const fielding = db.prepare(`
    SELECT f.playerID, f.yearID, f.teamID, f.POS,
           COALESCE(f.G, 0) as G,
           COALESCE(f.InnOuts, 0) as InnOuts,
           COALESCE(f.PO, 0) as PO,
           COALESCE(f.A, 0) as A,
           COALESCE(f.E, 0) as E
    FROM fielding f
    WHERE f.yearID = ?
  `).all(year) as LahmanFielding[];

  // Group fielding by player+team
  const fieldingByPlayer = new Map<string, LahmanFielding[]>();
  for (const f of fielding) {
    const key = `${f.playerID}:${f.teamID}`;
    if (!fieldingByPlayer.has(key)) fieldingByPlayer.set(key, []);
    fieldingByPlayer.get(key)!.push(f);
  }

  // Get appearances to determine primary position
  const appearances = db.prepare(`
    SELECT playerID, teamID,
           G_p, G_c, G_1b, G_2b, G_3b, G_ss, G_lf, G_cf, G_rf
    FROM appearances
    WHERE yearID = ?
  `).all(year) as Record<string, number | string>[];

  const appByPlayer = new Map<string, Record<string, number | string>>();
  for (const a of appearances) {
    appByPlayer.set(`${a.playerID}:${a.teamID}`, a);
  }

  // Compute league-wide stats for normalization
  function computeBatterStats() {
    const bas: number[] = [], isos: number[] = [], bbPcts: number[] = [],
          kPcts: number[] = [], sbRates: number[] = [], tripPcts: number[] = [];

    for (const b of batters) {
      const pa = b.AB + b.BB + (b.SF ?? 0);
      if (pa < 50) continue;
      const ba = b.H / Math.max(b.AB, 1);
      const slg = (b.H - b['2B'] - b['3B'] - b.HR + 2 * b['2B'] + 3 * b['3B'] + 4 * b.HR) / Math.max(b.AB, 1);
      const iso = slg - ba;
      const bbPct = b.BB / pa;
      const kPct = b.SO / pa;
      const sbRate = b.SB / Math.max(pa, 1) * 100;
      const tripPct = b['3B'] / Math.max(b.AB, 1);

      bas.push(ba);
      isos.push(iso);
      bbPcts.push(bbPct);
      kPcts.push(kPct);
      sbRates.push(sbRate);
      tripPcts.push(tripPct);
    }
    return {
      ba: calcStats(bas),
      iso: calcStats(isos),
      bbPct: calcStats(bbPcts),
      kPct: calcStats(kPcts),
      sbRate: calcStats(sbRates),
      tripPct: calcStats(tripPcts),
    };
  }

  function computePitcherStats() {
    const k9s: number[] = [], bb9s: number[] = [], hr9s: number[] = [], eras: number[] = [];

    for (const p of pitchers) {
      const ip = p.IPouts / 3;
      if (ip < 10) continue;
      const k9 = (p.SO / ip) * 9;
      const bb9 = (p.BB / ip) * 9;
      const hr9 = (p.HR / ip) * 9;
      const era = (p.ER / ip) * 9;

      k9s.push(k9);
      bb9s.push(bb9);
      hr9s.push(hr9);
      eras.push(era);
    }
    return {
      k9: calcStats(k9s),
      bb9: calcStats(bb9s),
      hr9: calcStats(hr9s),
      era: calcStats(eras),
    };
  }

  const batNorms = computeBatterStats();
  const pitNorms = computePitcherStats();

  // Get primary position from appearances
  function getPrimaryPosition(playerID: string, teamID: string, isPitcher: boolean): string {
    if (isPitcher) return 'P';
    const app = appByPlayer.get(`${playerID}:${teamID}`);
    if (!app) return 'DH';

    const posGames: [string, number][] = [
      ['C', Number(app['G_c']) || 0],
      ['1B', Number(app['G_1b']) || 0],
      ['2B', Number(app['G_2b']) || 0],
      ['3B', Number(app['G_3b']) || 0],
      ['SS', Number(app['G_ss']) || 0],
      ['LF', Number(app['G_lf']) || 0],
      ['CF', Number(app['G_cf']) || 0],
      ['RF', Number(app['G_rf']) || 0],
    ];
    posGames.sort((a, b) => b[1] - a[1]);
    return posGames[0][1] > 0 ? posGames[0][0] : 'DH';
  }

  // Build fielding ratings for a player
  function buildFieldingRatings(playerID: string, teamID: string, primaryPos: string): OutFieldingRating[] {
    const fldRecords = fieldingByPlayer.get(`${playerID}:${teamID}`) ?? [];
    if (fldRecords.length === 0) {
      return [{
        position: primaryPos,
        range: 50, arm_strength: 50, arm_accuracy: 50, turn_dp: 50, error_rate: 50,
      }];
    }

    const ratings: OutFieldingRating[] = [];
    for (const f of fldRecords) {
      const pos = mapPosition(f.POS);
      const po = f.PO ?? 0;
      const a = f.A ?? 0;
      const e = f.E ?? 0;
      const innOuts = f.InnOuts ?? 1;
      const fpct = (po + a) > 0 ? (po + a) / (po + a + e) : 0.95;
      const range = Math.round(Math.max(1, Math.min(100, ((po + a) / Math.max(innOuts / 27, 1)) * 10 + 30)));
      const errRate = Math.round(Math.max(1, Math.min(100, 100 - fpct * 100 * 3)));

      // Arm strength by position
      const armByPos: Record<string, number> = {
        C: 70, SS: 65, '3B': 65, RF: 72, CF: 60, LF: 55, '2B': 55, '1B': 48, P: 65, DH: 40,
      };
      const arm = armByPos[pos] ?? 55;

      ratings.push({
        position: pos,
        range: Math.max(20, Math.min(90, range)),
        arm_strength: arm,
        arm_accuracy: Math.max(30, Math.min(80, arm - 5)),
        turn_dp: pos === '2B' ? 70 : pos === 'SS' ? 68 : 45,
        error_rate: Math.max(5, Math.min(70, errRate)),
      });
    }

    // Ensure primary position is in the list
    if (!ratings.find(r => r.position === primaryPos)) {
      ratings.unshift({
        position: primaryPos,
        range: 50, arm_strength: 50, arm_accuracy: 50, turn_dp: 50, error_rate: 50,
      });
    }

    return ratings.slice(0, 3); // max 3 positions
  }

  // Build a batter player object
  function buildBatter(b: LahmanBatter, person: LahmanPerson | undefined, position: string): OutPlayer {
    const pa = b.AB + b.BB + (b.SF ?? 0);
    const ba = b.H / Math.max(b.AB, 1);
    const slg = (b.H - b['2B'] - b['3B'] - b.HR + 2 * b['2B'] + 3 * b['3B'] + 4 * b.HR) / Math.max(b.AB, 1);
    const iso = slg - ba;
    const bbPct = b.BB / Math.max(pa, 1);
    const kPct = b.SO / Math.max(pa, 1);
    const sbRate = b.SB / Math.max(pa, 1) * 100;
    const tripPct = b['3B'] / Math.max(b.AB, 1);

    const contactBase = toRating(ba, batNorms.ba.mean, batNorms.ba.stddev);
    const power = toRating(iso, batNorms.iso.mean, batNorms.iso.stddev);
    const eye = toRating(bbPct, batNorms.bbPct.mean, batNorms.bbPct.stddev);
    const avoidK = toRatingInverted(kPct, batNorms.kPct.mean, batNorms.kPct.stddev);
    const speed = Math.round((toRating(sbRate, batNorms.sbRate.mean, batNorms.sbRate.stddev) * 0.6 +
                              toRating(tripPct, batNorms.tripPct.mean, batNorms.tripPct.stddev) * 0.4));
    const steal = Math.round(speed * 0.8 + Math.random() * 10);

    const batsHand = person?.bats === 'L' ? 'L' : person?.bats === 'B' ? 'S' : 'R';
    // Split hand adjustments (simple approximation)
    const contactL = batsHand === 'R' ? Math.max(1, contactBase - 3) : contactBase;
    const contactR = batsHand === 'L' ? Math.max(1, contactBase - 3) : contactBase;
    const powerL = batsHand === 'R' ? Math.max(1, power - 3) : power;
    const powerR = batsHand === 'L' ? Math.max(1, power - 3) : power;

    const age = person?.birthYear ? year - person.birthYear : 28;
    const numHash = b.playerID.charCodeAt(0) * 3 + b.playerID.charCodeAt(4) * 7;

    return {
      id: `${b.teamID.toLowerCase()}-${b.playerID}`,
      firstName: person?.nameFirst ?? b.playerID.slice(0, 4),
      lastName: person?.nameLast ?? b.playerID.slice(4),
      number: (numHash % 99) + 1,
      position,
      bats: batsHand,
      throws: person?.throws === 'L' ? 'L' : 'R',
      age: Math.max(18, Math.min(45, age)),
      batting: {
        contact_L: Math.max(1, Math.min(99, contactL)),
        contact_R: Math.max(1, Math.min(99, contactR)),
        power_L: Math.max(1, Math.min(99, powerL)),
        power_R: Math.max(1, Math.min(99, powerR)),
        eye: Math.max(1, Math.min(99, eye)),
        avoid_k: Math.max(1, Math.min(99, avoidK)),
        gap_power: Math.max(1, Math.min(99, Math.round((power + contactBase) / 2))),
        speed: Math.max(1, Math.min(99, speed)),
        steal: Math.max(1, Math.min(99, Math.min(steal, 99))),
        bunt: Math.max(10, Math.min(70, Math.round(speed * 0.4 + avoidK * 0.2))),
        clutch: Math.max(30, Math.min(70, 50 + (numHash % 20) - 10)),
      },
      pitching: {
        stuff: 15, movement: 15, control: 15, stamina: 15,
        velocity: 80, hold_runners: 20, groundball_pct: 50, repertoire: ['fastball'],
      },
      fielding: buildFieldingRatings(b.playerID, b.teamID, position),
      mental: {
        intelligence: Math.max(30, Math.min(70, 50 + (numHash % 20) - 10)),
        work_ethic: 55,
        durability: Math.max(40, Math.min(80, 60 + (numHash % 20) - 10)),
        consistency: Math.max(35, Math.min(75, contactBase - 10)),
        composure: 50,
        leadership: Math.max(30, Math.min(70, 45 + (numHash % 20) - 10)),
      },
      state: { fatigue: 0, morale: 75, pitchCount: 0, isInjured: false },
    };
  }

  // Build a pitcher player object
  function buildPitcher(p: LahmanPitcher, person: LahmanPerson | undefined, isStarter: boolean): OutPlayer {
    const ip = p.IPouts / 3;
    const k9 = (p.SO / Math.max(ip, 1)) * 9;
    const bb9 = (p.BB / Math.max(ip, 1)) * 9;
    const hr9 = (p.HR / Math.max(ip, 1)) * 9;

    const stuff = toRating(k9, pitNorms.k9.mean, pitNorms.k9.stddev);
    const control = toRatingInverted(bb9, pitNorms.bb9.mean, pitNorms.bb9.stddev);
    const movement = toRatingInverted(hr9, pitNorms.hr9.mean, pitNorms.hr9.stddev);
    const stamina = isStarter ? Math.max(50, Math.min(90, Math.round(ip / 30 * 20 + 50))) : Math.max(30, Math.min(60, 45));

    // Estimate velocity from era and stuff
    const eraVelBase = year < 1920 ? 85 : year < 1960 ? 88 : year < 1990 ? 90 : year < 2010 ? 92 : 93;
    const velocity = Math.round(eraVelBase + (stuff - 50) / 10);

    // Repertoire by era
    let repertoire: string[];
    if (year < 1920) repertoire = ['fastball', 'curveball'];
    else if (year < 1950) repertoire = ['fastball', 'curveball', 'changeup'];
    else if (year < 1980) repertoire = ['fastball', 'slider', 'curveball', 'changeup'];
    else if (year < 2000) repertoire = ['fastball', 'slider', 'changeup', 'curveball'];
    else repertoire = ['fastball', 'slider', 'changeup', 'cutter'];

    const numHash = p.playerID.charCodeAt(0) * 3 + p.playerID.charCodeAt(4) * 7;
    const age = person?.birthYear ? year - person.birthYear : 28;

    return {
      id: `${p.teamID.toLowerCase()}-${p.playerID}`,
      firstName: person?.nameFirst ?? p.playerID.slice(0, 4),
      lastName: person?.nameLast ?? p.playerID.slice(4),
      number: (numHash % 99) + 1,
      position: 'P',
      bats: person?.bats === 'L' ? 'L' : 'R',
      throws: person?.throws === 'L' ? 'L' : 'R',
      age: Math.max(18, Math.min(45, age)),
      batting: {
        contact_L: 15, contact_R: 15, power_L: 10, power_R: 10,
        eye: 15, avoid_k: 12, gap_power: 10, speed: 25, steal: 5, bunt: 20, clutch: 25,
      },
      pitching: {
        stuff: Math.max(1, Math.min(99, stuff)),
        movement: Math.max(1, Math.min(99, movement)),
        control: Math.max(1, Math.min(99, control)),
        stamina: Math.max(1, Math.min(99, stamina)),
        velocity: Math.max(78, Math.min(102, velocity)),
        hold_runners: Math.max(30, Math.min(70, 50 + (numHash % 20) - 10)),
        groundball_pct: Math.max(30, Math.min(70, 50 + (numHash % 20) - 10)),
        repertoire: repertoire.slice(0, isStarter ? 4 : 2),
      },
      fielding: [{ position: 'P', range: 40, arm_strength: 60, arm_accuracy: 50, turn_dp: 35, error_rate: 45 }],
      mental: {
        intelligence: 55, work_ethic: 55, durability: 55, consistency: Math.max(30, Math.min(70, control - 10)),
        composure: Math.max(30, Math.min(70, 50 + (numHash % 20) - 10)), leadership: 50,
      },
      state: { fatigue: 0, morale: 75, pitchCount: 0, isInjured: false },
    };
  }

  // Build lineup for a team
  function buildLineup(players: OutPlayer[]): { lineup: { playerId: string; position: string }[]; pitcherId: string; bullpen: string[] } {
    const posPlayers = players.filter(p => p.position !== 'P');
    const pitchers = players.filter(p => p.position === 'P');

    // Sort pitchers: starters first (higher stamina), then relievers
    const starters = pitchers.filter(p => p.pitching.stamina >= 50).sort((a, b) => b.pitching.stuff - a.pitching.stuff);
    const relievers = pitchers.filter(p => p.pitching.stamina < 50).sort((a, b) => b.pitching.stuff - a.pitching.stuff);

    const sp = starters[0] ?? pitchers[0];
    const bullpen = [...starters.slice(1), ...relievers].slice(0, 7).map(p => p.id);

    // Build lineup order: leadoff=speed/eye, middle=power, bottom=weakest
    const posOrder = ['CF', 'SS', '2B', '1B', '3B', 'LF', 'RF', 'C', 'DH'];
    const lineup: { playerId: string; position: string }[] = [];

    const usedIds = new Set<string>();
    for (const pos of posOrder) {
      const player = posPlayers.find(p => p.position === pos && !usedIds.has(p.id));
      if (player) {
        lineup.push({ playerId: player.id, position: pos });
        usedIds.add(player.id);
      }
    }

    // Fill in remaining players if we don't have 9
    if (lineup.length < 9) {
      for (const p of posPlayers) {
        if (usedIds.has(p.id)) continue;
        if (lineup.length >= 9) break;
        lineup.push({ playerId: p.id, position: p.position });
        usedIds.add(p.id);
      }
    }

    return { lineup: lineup.slice(0, 9), pitcherId: sp?.id ?? '', bullpen };
  }

  // Process each team
  const outTeams: OutTeam[] = [];

  for (const team of teams) {
    const colors = getTeamColors(team.teamID);

    // Get batters for this team
    const teamBatters = batters.filter(b => b.teamID === team.teamID);

    // Get pitchers for this team
    const teamPitchers = pitchers.filter(p => p.teamID === team.teamID);

    if (teamBatters.length === 0 && teamPitchers.length === 0) continue;

    const players: OutPlayer[] = [];

    // Add batters (top 12 by AB)
    for (const b of teamBatters.slice(0, 12)) {
      const person = peopleMap.get(b.playerID);
      const isPitcher = teamPitchers.some(p => p.playerID === b.playerID);
      if (isPitcher) continue;
      const pos = getPrimaryPosition(b.playerID, b.teamID, false);
      players.push(buildBatter(b, person, pos));
    }

    // Add pitchers (top 10 by IPouts)
    const sortedPitchers = teamPitchers.sort((a, b) => b.IPouts - a.IPouts);
    for (const p of sortedPitchers.slice(0, 10)) {
      const person = peopleMap.get(p.playerID);
      const isStarter = p.GS >= 5;
      players.push(buildPitcher(p, person, isStarter));
    }

    // Ensure we have at least minimal viable roster
    if (players.filter(p => p.position !== 'P').length < 3) continue;
    if (players.filter(p => p.position === 'P').length < 1) continue;

    // Deduplicate by ID
    const seen = new Set<string>();
    const dedupPlayers = players.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    const { lineup, pitcherId, bullpen } = buildLineup(dedupPlayers);
    if (!pitcherId) continue;

    // Parse team name: "New York Yankees" → city="New York", name="Yankees"
    const nameParts = team.name.split(' ');
    const teamName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : team.name;
    const city = colors.city || nameParts.slice(0, -1).join(' ');

    outTeams.push({
      id: team.teamID.toLowerCase(),
      name: teamName,
      abbreviation: team.teamID.slice(0, 3).toUpperCase(),
      city,
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      league: team.lgID,
      wins: team.W,
      losses: team.L,
      roster: { players: dedupPlayers },
      lineup,
      pitcherId,
      bullpen,
    });
  }

  return { teams: outTeams };
}

// ── Entry point ────────────────────────────────────────────────────────────

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database not found at ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Process all decades from 1900-2019
  const START_YEAR = 1900;
  const END_YEAR = 2019;

  for (let decadeStart = START_YEAR; decadeStart <= END_YEAR; decadeStart += 10) {
    const decadeEnd = Math.min(decadeStart + 9, END_YEAR);
    const decadeLabel = `${decadeStart}s`;

    const decadeData: DecadeData = { seasons: {} };

    for (let year = decadeStart; year <= decadeEnd; year++) {
      process.stdout.write(`  Processing ${year}...`);
      const seasonData = processYear(db, year);
      if (seasonData && seasonData.teams.length > 0) {
        decadeData.seasons[year] = seasonData;
        console.log(` ${seasonData.teams.length} teams`);
      } else {
        console.log(` (skipped)`);
      }
    }

    if (Object.keys(decadeData.seasons).length > 0) {
      const outPath = path.join(OUTPUT_DIR, `${decadeLabel}.json`);
      fs.writeFileSync(outPath, JSON.stringify(decadeData));
      const size = fs.statSync(outPath).size;
      console.log(`Wrote ${outPath} (${(size / 1024).toFixed(0)}KB)`);
    }
  }

  db.close();
  console.log('\nDone! Lahman data preprocessed into public/data/lahman/');
}

main();

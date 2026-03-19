import type { Player } from '../types/player.ts';
import type { RandomProvider } from '../core/RandomProvider.ts';
import { clamp } from '../util/helpers.ts';

export type MinorLevel = 'A' | 'AA' | 'AAA';
export type CareerLevel = MinorLevel | 'MLB';

export interface SeasonStats {
  // Batting
  g: number; ab: number; r: number; h: number; doubles: number; triples: number;
  hr: number; rbi: number; bb: number; so: number; sb: number;
  avg: number; obp: number; slg: number; ops: number;
  // Pitching
  gs: number; ip: number; hits_allowed: number; er: number; bb_p: number; so_p: number;
  era: number; whip: number; wins: number; losses: number; saves: number;
}

export function emptySeasonStats(): SeasonStats {
  return {
    g: 0, ab: 0, r: 0, h: 0, doubles: 0, triples: 0,
    hr: 0, rbi: 0, bb: 0, so: 0, sb: 0,
    avg: 0, obp: 0, slg: 0, ops: 0,
    gs: 0, ip: 0, hits_allowed: 0, er: 0, bb_p: 0, so_p: 0,
    era: 0, whip: 0, wins: 0, losses: 0, saves: 0,
  };
}

export interface CareerStats {
  seasons: number;
  batting: Pick<SeasonStats, 'g' | 'ab' | 'r' | 'h' | 'doubles' | 'triples' | 'hr' | 'rbi' | 'bb' | 'so' | 'sb'>;
  pitching: Pick<SeasonStats, 'gs' | 'ip' | 'hits_allowed' | 'er' | 'bb_p' | 'so_p' | 'wins' | 'losses' | 'saves'>;
}

export function emptyCareerStats(): CareerStats {
  return {
    seasons: 0,
    batting: { g: 0, ab: 0, r: 0, h: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, bb: 0, so: 0, sb: 0 },
    pitching: { gs: 0, ip: 0, hits_allowed: 0, er: 0, bb_p: 0, so_p: 0, wins: 0, losses: 0, saves: 0 },
  };
}

// ─── Milestones ───────────────────────────────────────────────────────────────

export interface Milestone {
  id: string;
  label: string;
  description: string;
  year: number;
  achieved: boolean;
}

const MILESTONE_DEFS: { id: string; label: string; description: string; check: (cs: CareerStats, ss: SeasonStats, level: CareerLevel) => boolean }[] = [
  // Batting milestones
  { id: 'first_hit',      label: 'First Career Hit',     description: 'Record your first professional hit.',         check: (cs) => cs.batting.h >= 1 },
  { id: 'first_hr',       label: 'First Career HR',      description: 'Hit your first professional home run.',       check: (cs) => cs.batting.hr >= 1 },
  { id: 'first_rbi',      label: 'First Career RBI',     description: 'Drive in your first run.',                   check: (cs) => cs.batting.rbi >= 1 },
  { id: 'hit_100',        label: '100th Career Hit',     description: 'Collect 100 career hits.',                   check: (cs) => cs.batting.h >= 100 },
  { id: 'hr_50',          label: '50th Career HR',       description: 'Reach 50 career home runs.',                 check: (cs) => cs.batting.hr >= 50 },
  { id: 'hr_100',         label: '100th Career HR',      description: 'Reach 100 career home runs.',                check: (cs) => cs.batting.hr >= 100 },
  { id: 'hr_200',         label: '200th Career HR',      description: 'Reach 200 career home runs.',                check: (cs) => cs.batting.hr >= 200 },
  { id: 'hr_300',         label: '300th Career HR',      description: 'Reach 300 career home runs.',                check: (cs) => cs.batting.hr >= 300 },
  { id: 'hr_500',         label: '500th Career HR',      description: '500 career home runs — all-time great.',     check: (cs) => cs.batting.hr >= 500 },
  { id: 'ab_1000',        label: '1000th Career AB',     description: 'Reach 1,000 career at-bats.',                check: (cs) => cs.batting.ab >= 1000 },
  { id: 'ab_3000',        label: '3000th Career AB',     description: 'Reach 3,000 career at-bats.',                check: (cs) => cs.batting.ab >= 3000 },
  { id: 'hit_1000',       label: '1000th Career Hit',    description: 'Collect 1,000 career hits.',                 check: (cs) => cs.batting.h >= 1000 },
  { id: 'hit_2000',       label: '2000th Career Hit',    description: 'Collect 2,000 career hits.',                 check: (cs) => cs.batting.h >= 2000 },
  { id: 'hit_3000',       label: '3000th Career Hit',    description: '3,000 hits — HOF territory.',                check: (cs) => cs.batting.h >= 3000 },
  { id: 'rbi_500',        label: '500 Career RBI',       description: 'Drive in 500 career runs.',                  check: (cs) => cs.batting.rbi >= 500 },
  { id: 'rbi_1000',       label: '1000 Career RBI',      description: 'Drive in 1,000 career runs.',                check: (cs) => cs.batting.rbi >= 1000 },
  { id: 'rbi_1500',       label: '1500 Career RBI',      description: 'Drive in 1,500 career runs — legendary.',    check: (cs) => cs.batting.rbi >= 1500 },
  { id: 'sb_100',         label: '100 Career SB',        description: 'Steal 100 bases.',                           check: (cs) => cs.batting.sb >= 100 },
  { id: 'sb_300',         label: '300 Career SB',        description: 'Steal 300 bases.',                           check: (cs) => cs.batting.sb >= 300 },
  // Season achievements
  { id: 'season_30hr',    label: '30 HR Season',         description: 'Hit 30+ home runs in one season.',           check: (_, ss) => ss.hr >= 30 },
  { id: 'season_40hr',    label: '40 HR Season',         description: 'Hit 40+ home runs in one season.',           check: (_, ss) => ss.hr >= 40 },
  { id: 'season_50hr',    label: '50 HR Season',         description: 'Hit 50+ home runs in one season.',           check: (_, ss) => ss.hr >= 50 },
  { id: 'season_300avg',  label: '.300 Season',          description: 'Bat .300 or better for a full season.',      check: (_, ss) => ss.avg >= 0.300 && ss.ab >= 400 },
  { id: 'season_100rbi',  label: '100 RBI Season',       description: 'Drive in 100+ runs in one season.',          check: (_, ss) => ss.rbi >= 100 },
  // Level milestones
  { id: 'reached_aa',     label: 'Promoted to AA',       description: 'Earn a promotion to Double-A.',              check: (_, _ss, lvl) => lvl === 'AA' || lvl === 'AAA' || lvl === 'MLB' },
  { id: 'reached_aaa',    label: 'Promoted to AAA',      description: 'Earn a promotion to Triple-A.',              check: (_, _ss, lvl) => lvl === 'AAA' || lvl === 'MLB' },
  { id: 'reached_mlb',    label: 'Called to the Majors', description: 'Make it to the MLB — The Show.',             check: (_, _ss, lvl) => lvl === 'MLB' },
  // Pitching milestones
  { id: 'first_win',      label: 'First Career Win',     description: 'Record your first professional pitching win.',check: (cs) => cs.pitching.wins >= 1 },
  { id: 'win_50',         label: '50th Career Win',      description: 'Reach 50 career pitching wins.',             check: (cs) => cs.pitching.wins >= 50 },
  { id: 'win_100',        label: '100th Career Win',     description: 'Reach 100 career wins.',                     check: (cs) => cs.pitching.wins >= 100 },
  { id: 'win_200',        label: '200th Career Win',     description: 'Reach 200 career wins.',                     check: (cs) => cs.pitching.wins >= 200 },
  { id: 'win_300',        label: '300 Career Wins',      description: '300 wins — HOF territory.',                  check: (cs) => cs.pitching.wins >= 300 },
  { id: 'k_500',          label: '500 Career K',         description: 'Strike out 500 batters.',                    check: (cs) => cs.pitching.so_p >= 500 },
  { id: 'k_1000',         label: '1000 Career K',        description: 'Strike out 1,000 batters.',                  check: (cs) => cs.pitching.so_p >= 1000 },
  { id: 'k_2000',         label: '2000 Career K',        description: 'Strike out 2,000 batters — elite.',          check: (cs) => cs.pitching.so_p >= 2000 },
  { id: 'k_3000',         label: '3000 Career K',        description: 'Strike out 3,000 batters — HOF.',            check: (cs) => cs.pitching.so_p >= 3000 },
  { id: 'season_20win',   label: '20-Win Season',        description: 'Win 20+ games in one season.',               check: (_, ss) => ss.wins >= 20 },
  { id: 'season_sub2era', label: 'Sub-2.00 ERA Season',  description: 'Post an ERA below 2.00 for a full season.',  check: (_, ss) => ss.era < 2.00 && ss.gs >= 25 },
  { id: 'season_300k',    label: '300 K Season',         description: 'Strikeout 300 batters in one season.',       check: (_, ss) => ss.so_p >= 300 },
  // Awards / All-Star
  { id: 'all_star',       label: 'All-Star Selection',   description: 'Selected to the All-Star Game.',             check: (_cs, _ss, _lvl) => false }, // triggered externally
  { id: 'award_mvp',      label: 'MVP Award',            description: 'Win the Most Valuable Player award.',        check: () => false },
  { id: 'award_cy',       label: 'Cy Young Award',       description: 'Win the Cy Young Award.',                    check: () => false },
  { id: 'award_roty',     label: 'Rookie of the Year',   description: 'Win Rookie of the Year.',                    check: () => false },
  { id: 'award_gs',       label: 'Gold Glove',           description: 'Win the Gold Glove Award.',                  check: () => false },
];

export function checkMilestones(
  existing: Milestone[],
  careerStats: CareerStats,
  seasonStats: SeasonStats,
  level: CareerLevel,
  year: number,
): { milestones: Milestone[]; newlyAchieved: Milestone[] } {
  const existingMap = new Map(existing.map(m => [m.id, m]));
  const newlyAchieved: Milestone[] = [];

  const updated = MILESTONE_DEFS.map(def => {
    const prev = existingMap.get(def.id) ?? {
      id: def.id, label: def.label, description: def.description, year: 0, achieved: false,
    };
    if (prev.achieved) return prev;
    const nowAchieved = def.check(careerStats, seasonStats, level);
    if (nowAchieved) {
      const m: Milestone = { ...prev, achieved: true, year };
      newlyAchieved.push(m);
      return m;
    }
    return prev;
  });

  return { milestones: updated, newlyAchieved };
}

// ─── Season log ───────────────────────────────────────────────────────────────

export interface SeasonRecord {
  year: number;
  level: CareerLevel;
  team: string;
  stats: SeasonStats;
  awards: string[];
}

// ─── Team dynamics ────────────────────────────────────────────────────────────

export interface TeamDynamics {
  managerRelationship: number;   // 0-100
  teamChemistry: number;         // 0-100
  mediaAttention: number;        // 0-100
  morale: number;                // 0-100
  fanFavorite: boolean;
}

export function defaultTeamDynamics(): TeamDynamics {
  return { managerRelationship: 50, teamChemistry: 60, mediaAttention: 10, morale: 70, fanFavorite: false };
}

// ─── Contract ─────────────────────────────────────────────────────────────────

export interface Contract {
  teamName: string;
  yearsRemaining: number;
  totalYears: number;
  annualSalary: number;     // in thousands
  isFA: boolean;
}

export function rookieContract(teamName: string): Contract {
  return { teamName, yearsRemaining: 3, totalYears: 3, annualSalary: 710, isFA: false };
}

// ─── Training focus ───────────────────────────────────────────────────────────

export type TrainingFocus = 'Power' | 'Contact' | 'Speed' | 'Fielding' | 'Eye' | 'Stuff' | 'Control' | 'Stamina' | 'Velocity';

export interface TrainingPlan {
  primary: TrainingFocus;
  secondary: TrainingFocus;
  restDays: number; // 0-7
}

export function defaultTrainingPlan(): TrainingPlan {
  return { primary: 'Contact', secondary: 'Eye', restDays: 2 };
}

// ─── Hall of Fame ──────────────────────────────────────────────────────────────

export interface HofStatus {
  eligible: boolean;    // after 5 years of retirement
  inducted: boolean;
  inductionYear: number | null;
  hofScore: number;     // 0-100
  retirementYear: number | null;
}

export function emptyHofStatus(): HofStatus {
  return { eligible: false, inducted: false, inductionYear: null, hofScore: 0, retirementYear: null };
}

export function calcHofScore(cs: CareerStats, isPitcher: boolean): number {
  if (isPitcher) {
    let score = 0;
    score += Math.min(40, (cs.pitching.wins / 300) * 40);
    score += Math.min(30, (cs.pitching.so_p / 3000) * 30);
    score += Math.min(20, cs.seasons > 0 ? Math.min(1, (cs.pitching.er / cs.pitching.ip) * 9 < 3.0 ? 1 : 0) * 20 : 0);
    score += Math.min(10, (cs.seasons / 20) * 10);
    return Math.round(score);
  } else {
    let score = 0;
    score += Math.min(30, (cs.batting.h / 3000) * 30);
    score += Math.min(25, (cs.batting.hr / 500) * 25);
    score += Math.min(20, (cs.batting.rbi / 1500) * 20);
    score += Math.min(15, (cs.batting.sb / 300) * 15);
    const avg = cs.batting.ab > 0 ? cs.batting.h / cs.batting.ab : 0;
    score += Math.min(10, (avg / 0.300) * 10);
    return Math.round(Math.min(100, score));
  }
}

// ─── Full career state ────────────────────────────────────────────────────────

export interface CareerState {
  player: Player;
  currentTeam: string;
  year: number;
  level: CareerLevel;
  seasonStats: SeasonStats;
  careerStats: CareerStats;
  dayOfSeason: number;       // 0-140
  promotionPending: boolean;
  promotionMessage: string | null;
  recentEvents: string[];
  // New fields
  milestones: Milestone[];
  pendingMilestones: Milestone[];  // newly achieved, awaiting display
  seasonLog: SeasonRecord[];
  teamDynamics: TeamDynamics;
  contract: Contract;
  trainingPlan: TrainingPlan;
  hofStatus: HofStatus;
  retired: boolean;
  currentSeasonAwards: string[];
}

/** Level order for promotion checks */
const LEVEL_ORDER: CareerLevel[] = ['A', 'AA', 'AAA', 'MLB'];
const LEVEL_TEAMS: Record<CareerLevel, string[]> = {
  'A':   ['Lakewood Blue Claws', 'Peoria Chiefs', 'Bowling Green Hot Rods', 'Kane County Cougars'],
  'AA':  ['Biloxi Shuckers', 'Altoona Curve', 'Frisco RoughRiders', 'New Hampshire Fisher Cats'],
  'AAA': ['Iowa Cubs', 'Nashville Sounds', 'Round Rock Express', 'El Paso Chihuahuas'],
  'MLB': ['Chicago Cubs', 'New York Yankees', 'Los Angeles Dodgers', 'Houston Astros'],
};

/** Build a realistic team name for the player's organization at their level. */
export function getTeamForLevel(level: CareerLevel, rng: RandomProvider): string {
  return rng.pick(LEVEL_TEAMS[level]);
}

// ─── Core simulation ──────────────────────────────────────────────────────────

/** Simulate one game day. Returns event descriptions. */
export function simulateMinorLeagueDay(state: CareerState, rng: RandomProvider): CareerState {
  if (state.dayOfSeason >= 140) return state;

  const player = state.player;
  const isPitcher = player.position === 'P';
  const events: string[] = [];
  const stats = { ...state.seasonStats };

  // Media attention increases with good performance at MLB
  let dynamicsUpdate = { ...state.teamDynamics };

  if (isPitcher) {
    const isStartDay = state.dayOfSeason % 5 === 0;
    if (!isStartDay) {
      return {
        ...state,
        dayOfSeason: state.dayOfSeason + 1,
        recentEvents: [`Day ${state.dayOfSeason + 1}: Rest day`],
      };
    }

    const stuff = player.pitching.stuff;
    const ctrl  = player.pitching.control;
    const stam  = player.pitching.stamina;

    const ip = rng.nextFloat(Math.max(1, stam / 25), Math.min(7, stam / 12));
    const ipRounded = Math.round(ip * 3) / 3;

    const strikeoutRate = (stuff / 100) * 0.28 + 0.10;
    const walkRate      = ((100 - ctrl) / 100) * 0.12;
    const hitRate       = 0.26 - (stuff + ctrl) / 100 * 0.08;
    const erPerIP       = Math.max(0, (hitRate + walkRate) * 0.4);

    const ks = Math.round(ipRounded * strikeoutRate * rng.nextGaussian(1, 0.2));
    const bb = Math.round(ipRounded * walkRate * rng.nextGaussian(1, 0.3));
    const h  = Math.round(ipRounded * hitRate * rng.nextGaussian(1, 0.25));
    const er = Math.round(ipRounded * erPerIP * rng.nextGaussian(1, 0.35));
    const win = rng.chance(0.5);
    const save = !win && rng.chance(0.1);

    stats.gs    += 1;
    stats.ip    += ipRounded;
    stats.so_p  += Math.max(0, ks);
    stats.bb_p  += Math.max(0, bb);
    stats.hits_allowed += Math.max(0, h);
    stats.er    += Math.max(0, er);
    stats.wins  += win ? 1 : 0;
    stats.losses += !win && !save ? 1 : 0;
    stats.saves += save ? 1 : 0;

    stats.era  = stats.ip > 0 ? (stats.er / stats.ip) * 9 : 0;
    stats.whip = stats.ip > 0 ? (stats.hits_allowed + stats.bb_p) / stats.ip : 0;

    events.push(
      `Day ${state.dayOfSeason + 1}: ${win ? 'W' : save ? 'SV' : 'L'} — ${ipRounded.toFixed(1)} IP, ${Math.max(0, h)}H, ${Math.max(0, er)}ER, ${Math.max(0, ks)}K, ${Math.max(0, bb)}BB`
    );

    if (state.level === 'MLB' && win) {
      dynamicsUpdate.mediaAttention = Math.min(100, dynamicsUpdate.mediaAttention + 1);
    }
    if (state.level === 'MLB' && er > 5) {
      dynamicsUpdate.morale = Math.max(20, dynamicsUpdate.morale - 2);
    }
  } else {
    stats.g  += 1;

    const contact = (player.batting.contact_L + player.batting.contact_R) / 2;
    const power   = (player.batting.power_L + player.batting.power_R) / 2;
    const spd     = player.batting.speed;
    const eye     = player.batting.eye;

    const hitChance  = clamp(contact / 100 * 0.38, 0.15, 0.42);
    const walkChance = clamp(eye / 100 * 0.12, 0.03, 0.14);
    const kChance    = clamp((100 - player.batting.avoid_k) / 100 * 0.28, 0.1, 0.38);
    const hrChance   = clamp(power / 100 * 0.055, 0.005, 0.08);
    const sbChance   = clamp(spd / 100 * 0.25, 0.02, 0.35);

    const pa = rng.nextInt(3, 5);
    let dayH = 0; let dayHR = 0; let dayRBI = 0; let dayBB = 0; let daySO = 0; let dayAB = 0;

    for (let i = 0; i < pa; i++) {
      const roll = rng.next();
      if (roll < walkChance) {
        dayBB++;
      } else {
        dayAB++;
        const r2 = rng.next();
        if (r2 < hrChance) {
          dayH++; dayHR++; dayRBI += rng.nextInt(1, 4);
        } else if (r2 < hitChance) {
          dayH++;
          if (rng.chance(0.08)) stats.triples++;
          else if (rng.chance(0.2)) stats.doubles++;
        } else if (r2 < hitChance + kChance) {
          daySO++;
        }
      }
    }

    const sbAttempts = rng.chance(sbChance) ? 1 : 0;
    const dayR = rng.chance(dayH > 0 ? 0.4 : 0.1) ? 1 : 0;

    stats.ab  += dayAB;
    stats.h   += dayH;
    stats.hr  += dayHR;
    stats.rbi += dayRBI;
    stats.bb  += dayBB;
    stats.so  += daySO;
    stats.r   += dayR;
    stats.sb  += sbAttempts;

    stats.avg = stats.ab > 0 ? stats.h / stats.ab : 0;
    stats.obp = (stats.ab + stats.bb) > 0 ? (stats.h + stats.bb) / (stats.ab + stats.bb) : 0;
    const tb  = (stats.h - stats.doubles - stats.triples - stats.hr) + stats.doubles * 2 + stats.triples * 3 + stats.hr * 4;
    stats.slg = stats.ab > 0 ? tb / stats.ab : 0;
    stats.ops = stats.obp + stats.slg;

    const hitDesc = dayH > 0 ? `${dayH}-for-${dayAB}` : `0-for-${dayAB}`;
    const extras = [dayHR > 0 ? `${dayHR}HR` : '', dayRBI > 0 ? `${dayRBI}RBI` : '', dayBB > 0 ? `${dayBB}BB` : ''].filter(Boolean).join(', ');
    events.push(`Day ${state.dayOfSeason + 1}: ${hitDesc}${extras ? ` (${extras})` : ''}`);

    if (state.level === 'MLB' && dayHR > 0) {
      dynamicsUpdate.mediaAttention = Math.min(100, dynamicsUpdate.mediaAttention + 2);
      dynamicsUpdate.morale = Math.min(100, dynamicsUpdate.morale + 1);
    }
    if (state.level === 'MLB' && dayH === 0 && dayAB >= 4) {
      dynamicsUpdate.morale = Math.max(20, dynamicsUpdate.morale - 1);
    }
  }

  // Check for All-Star (mid-season, MLB only)
  let seasonAwards = [...state.currentSeasonAwards];
  if (state.level === 'MLB' && state.dayOfSeason === 70) {
    const isPitcher = player.position === 'P';
    const qualifies = isPitcher ? stats.era < 2.5 && stats.gs >= 12 : stats.avg > 0.310 && stats.g >= 50;
    if (qualifies && !seasonAwards.includes('All-Star')) {
      seasonAwards.push('All-Star');
      events.push('*** SELECTED FOR THE ALL-STAR GAME! ***');
    }
  }

  // Build a prospective career stats for milestone check (current season counted)
  const prospectiveCareer = buildProspectiveCareer(state.careerStats, stats);
  const { milestones: updatedMilestones, newlyAchieved } = checkMilestones(
    state.milestones,
    prospectiveCareer,
    stats,
    state.level,
    state.year,
  );

  for (const m of newlyAchieved) {
    events.push(`MILESTONE: ${m.label}!`);
  }

  return {
    ...state,
    seasonStats: stats,
    dayOfSeason: state.dayOfSeason + 1,
    recentEvents: events,
    promotionPending: false,
    promotionMessage: null,
    milestones: updatedMilestones,
    pendingMilestones: [...state.pendingMilestones, ...newlyAchieved],
    teamDynamics: dynamicsUpdate,
    currentSeasonAwards: seasonAwards,
  };
}

function buildProspectiveCareer(cs: CareerStats, ss: SeasonStats): CareerStats {
  return {
    seasons: cs.seasons,
    batting: {
      g: cs.batting.g + ss.g,
      ab: cs.batting.ab + ss.ab,
      r: cs.batting.r + ss.r,
      h: cs.batting.h + ss.h,
      doubles: cs.batting.doubles + ss.doubles,
      triples: cs.batting.triples + ss.triples,
      hr: cs.batting.hr + ss.hr,
      rbi: cs.batting.rbi + ss.rbi,
      bb: cs.batting.bb + ss.bb,
      so: cs.batting.so + ss.so,
      sb: cs.batting.sb + ss.sb,
    },
    pitching: {
      gs: cs.pitching.gs + ss.gs,
      ip: cs.pitching.ip + ss.ip,
      hits_allowed: cs.pitching.hits_allowed + ss.hits_allowed,
      er: cs.pitching.er + ss.er,
      bb_p: cs.pitching.bb_p + ss.bb_p,
      so_p: cs.pitching.so_p + ss.so_p,
      wins: cs.pitching.wins + ss.wins,
      losses: cs.pitching.losses + ss.losses,
      saves: cs.pitching.saves + ss.saves,
    },
  };
}

/** Check if the player qualifies for promotion. */
export function checkPromotion(state: CareerState): boolean {
  if (state.level === 'MLB') return false;
  const { seasonStats: s, player, level } = state;

  // Promotion thresholds by level
  const gamesRequired = level === 'A' ? 30 : level === 'AA' ? 35 : 40;
  const avgRequired   = level === 'A' ? 0.300 : level === 'AA' ? 0.290 : 0.280;
  const eraRequired   = level === 'A' ? 3.00 : level === 'AA' ? 3.20 : 3.50;
  const gsRequired    = Math.ceil(gamesRequired / 5);

  if (player.position === 'P') {
    return s.gs >= gsRequired && s.era < eraRequired;
  } else {
    return s.g >= gamesRequired && s.avg >= avgRequired;
  }
}

/** Apply training plan bonuses to offseason development. */
export function applyTrainingBonus(player: Player, plan: TrainingPlan, rng: RandomProvider): Player {
  const bonus = (base: number, match: boolean) => base + (match ? rng.nextFloat(1, 3) : 0);

  const b = player.batting;
  const p = player.pitching;
  const isPrim = (t: TrainingFocus) => plan.primary === t;
  const isSec  = (t: TrainingFocus) => plan.secondary === t;

  const newBatting = {
    ...b,
    contact_L: Math.round(clamp(b.contact_L + bonus(0, isPrim('Contact') || isSec('Contact')), 1, 99)),
    contact_R: Math.round(clamp(b.contact_R + bonus(0, isPrim('Contact') || isSec('Contact')), 1, 99)),
    power_L:   Math.round(clamp(b.power_L   + bonus(0, isPrim('Power')   || isSec('Power')),   1, 99)),
    power_R:   Math.round(clamp(b.power_R   + bonus(0, isPrim('Power')   || isSec('Power')),   1, 99)),
    speed:     Math.round(clamp(b.speed     + bonus(0, isPrim('Speed')   || isSec('Speed')),   1, 99)),
    steal:     Math.round(clamp(b.steal     + bonus(0, isPrim('Speed')   || isSec('Speed')),   1, 99)),
    eye:       Math.round(clamp(b.eye       + bonus(0, isPrim('Eye')     || isSec('Eye')),     1, 99)),
    avoid_k:   Math.round(clamp(b.avoid_k   + bonus(0, isPrim('Eye')     || isSec('Eye')),     1, 99)),
  };

  const newPitching = {
    ...p,
    stuff:    Math.round(clamp(p.stuff    + bonus(0, isPrim('Stuff')    || isSec('Stuff')),    1, 99)),
    control:  Math.round(clamp(p.control  + bonus(0, isPrim('Control')  || isSec('Control')),  1, 99)),
    stamina:  Math.round(clamp(p.stamina  + bonus(0, isPrim('Stamina')  || isSec('Stamina')),  1, 99)),
    velocity: Math.round(clamp(p.velocity + bonus(0, isPrim('Velocity') || isSec('Velocity')), 78, 102)),
  };

  const newFielding = player.fielding.map(f => ({
    ...f,
    range:        Math.round(clamp(f.range        + bonus(0, isPrim('Fielding') || isSec('Fielding')), 1, 99)),
    arm_strength: Math.round(clamp(f.arm_strength + bonus(0, isPrim('Fielding') || isSec('Fielding')), 1, 99)),
  }));

  return { ...player, batting: newBatting, pitching: newPitching, fielding: newFielding };
}

/** Apply offseason development: ratings change ±1-5 based on age, work ethic, potential. */
export function developPlayer(player: Player, rng: RandomProvider): Player {
  const age = player.age;
  const ethic = player.mental.work_ethic;
  const potential = 75;

  const growthFactor = age < 24
    ? (age - 18) / 6
    : age < 30
      ? 1.0 - (age - 24) * 0.08
      : Math.max(0, 1.0 - (age - 24) * 0.15);

  const ethicBonus = (ethic - 50) / 100;

  function develop(current: number, baseGain: number): number {
    const maxGain = baseGain * (potential / 75) * growthFactor * (1 + ethicBonus);
    const change = rng.nextGaussian(maxGain * 0.6, Math.abs(maxGain) * 0.4);
    return clamp(Math.round(current + change), 1, 99);
  }

  const b = player.batting;
  const p = player.pitching;

  const newBatting = {
    ...b,
    contact_L: develop(b.contact_L, 3),
    contact_R: develop(b.contact_R, 3),
    power_L:   develop(b.power_L, 2.5),
    power_R:   develop(b.power_R, 2.5),
    eye:       develop(b.eye, 2),
    avoid_k:   develop(b.avoid_k, 2),
    gap_power: develop(b.gap_power, 2),
    speed:     age > 30 ? clamp(b.speed - rng.nextInt(1, 2), 20, 99) : develop(b.speed, 1),
    steal:     age > 30 ? clamp(b.steal - rng.nextInt(1, 2), 10, 99) : develop(b.steal, 1),
    bunt:      develop(b.bunt, 1),
    clutch:    develop(b.clutch, 1.5),
  };

  const newPitching = {
    ...p,
    stuff:    develop(p.stuff, 3),
    movement: develop(p.movement, 2.5),
    control:  develop(p.control, 2.5),
    stamina:  develop(p.stamina, 1.5),
    velocity: age > 32
      ? clamp(p.velocity - rng.nextInt(0, 1), 78, 102)
      : clamp(p.velocity + (growthFactor > 0.5 ? rng.nextInt(0, 1) : 0), 78, 102),
  };

  const newMental = {
    ...player.mental,
    intelligence: develop(player.mental.intelligence, 2),
    composure:    develop(player.mental.composure, 2),
    leadership:   develop(player.mental.leadership, 1.5),
    work_ethic:   player.mental.work_ethic,
    durability:   age > 35 ? clamp(player.mental.durability - rng.nextInt(1, 3), 20, 99) : player.mental.durability,
  };

  return { ...player, batting: newBatting, pitching: newPitching, mental: newMental };
}

/** Age the player one year. */
export function agePlayer(player: Player): Player {
  return { ...player, age: player.age + 1 };
}

/** Promote player to next level. */
export function promotePlayer(state: CareerState, rng: RandomProvider): CareerState {
  const idx = LEVEL_ORDER.indexOf(state.level);
  if (idx >= LEVEL_ORDER.length - 1) return state;
  const newLevel = LEVEL_ORDER[idx + 1];
  const newTeam  = getTeamForLevel(newLevel, rng);
  const levelLabel = newLevel === 'MLB' ? 'CALLED UP TO THE MAJORS' : `Promoted to ${newLevel}`;

  // Manager relationship improves on promotion
  const dynamics = { ...state.teamDynamics, managerRelationship: 65, teamChemistry: 55 };

  return {
    ...state,
    level: newLevel,
    currentTeam: newTeam,
    seasonStats: emptySeasonStats(),
    dayOfSeason: 0,
    promotionPending: true,
    promotionMessage: `${levelLabel} — ${newTeam}!`,
    recentEvents: [`PROMOTED: ${levelLabel}!`],
    teamDynamics: dynamics,
  };
}

/** Determine end-of-season awards. */
export function determineSeasonAwards(state: CareerState, rng: RandomProvider): string[] {
  const awards = [...state.currentSeasonAwards];
  const { seasonStats: ss, level } = state;
  const isPitcher = state.player.position === 'P';

  if (level === 'MLB') {
    if (isPitcher) {
      if (ss.era < 2.50 && ss.gs >= 25 && rng.chance(0.4)) awards.push('Cy Young Nominee');
      if (ss.wins >= 20 && rng.chance(0.3)) awards.push('Cy Young Nominee');
      if (ss.era < 2.00 && ss.gs >= 25 && rng.chance(0.3)) awards.push('Cy Young Award');
    } else {
      if (ss.avg > 0.330 && ss.ab >= 400 && rng.chance(0.4)) awards.push('Batting Champion');
      if (ss.hr >= 40 && rng.chance(0.5)) awards.push('HR Champion');
      if (ss.rbi >= 110 && rng.chance(0.4)) awards.push('RBI Champion');
      if (ss.avg > 0.320 && ss.hr >= 35 && ss.rbi >= 110 && rng.chance(0.35)) awards.push('MVP Nominee');
      if (ss.avg > 0.340 && ss.hr >= 45 && ss.rbi >= 130 && rng.chance(0.4)) awards.push('MVP Award');
    }
    if (!isPitcher && state.careerStats.seasons <= 1 && ss.avg > 0.280 && rng.chance(0.4)) {
      awards.push('Rookie of the Year');
    }
  }

  return [...new Set(awards)];
}

/** Advance the offseason: develop player, age them, reset season stats. */
export function advanceOffseason(state: CareerState, rng: RandomProvider): CareerState {
  // Apply training first, then normal development
  const trained   = applyTrainingBonus(state.player, state.trainingPlan, rng);
  const developed = developPlayer(trained, rng);
  const aged      = agePlayer(developed);

  // Accumulate career stats
  const cs = { ...state.careerStats };
  const ss = state.seasonStats;
  cs.seasons++;
  cs.batting.g       += ss.g;
  cs.batting.ab      += ss.ab;
  cs.batting.r       += ss.r;
  cs.batting.h       += ss.h;
  cs.batting.doubles += ss.doubles;
  cs.batting.triples += ss.triples;
  cs.batting.hr      += ss.hr;
  cs.batting.rbi     += ss.rbi;
  cs.batting.bb      += ss.bb;
  cs.batting.so      += ss.so;
  cs.batting.sb      += ss.sb;
  cs.pitching.gs     += ss.gs;
  cs.pitching.ip     += ss.ip;
  cs.pitching.hits_allowed += ss.hits_allowed;
  cs.pitching.er     += ss.er;
  cs.pitching.bb_p   += ss.bb_p;
  cs.pitching.so_p   += ss.so_p;
  cs.pitching.wins   += ss.wins;
  cs.pitching.losses += ss.losses;
  cs.pitching.saves  += ss.saves;

  // Determine awards
  const awards = determineSeasonAwards(state, rng);

  // Save season to log
  const seasonRecord: SeasonRecord = {
    year: state.year,
    level: state.level,
    team: state.currentTeam,
    stats: { ...ss },
    awards,
  };

  // Update milestones with end-of-season check
  const { milestones: updatedMilestones, newlyAchieved } = checkMilestones(
    state.milestones, cs, ss, state.level, state.year,
  );

  // Update contract
  let contract = { ...state.contract };
  if (contract.yearsRemaining > 0) contract.yearsRemaining--;

  // Manager relationship drift toward neutral
  const dyn = { ...state.teamDynamics };
  const mlbPerf = aged.position === 'P' ? ss.era < 3.5 : ss.avg > 0.270;
  dyn.managerRelationship = clamp(
    dyn.managerRelationship + (mlbPerf ? rng.nextInt(1, 5) : rng.nextInt(-4, -1)),
    20, 95
  );
  dyn.teamChemistry = clamp(dyn.teamChemistry + rng.nextInt(-3, 5), 20, 95);
  dyn.mediaAttention = clamp(dyn.mediaAttention + (awards.length > 0 ? 5 : -2), 5, 100);
  dyn.morale = 70; // reset for new season
  dyn.fanFavorite = dyn.mediaAttention > 70 && dyn.managerRelationship > 60;

  // HOF tracking
  const hofScore = calcHofScore(cs, aged.position === 'P');
  const hofStatus = { ...state.hofStatus, hofScore };

  return {
    ...state,
    player: aged,
    careerStats: cs,
    seasonStats: emptySeasonStats(),
    dayOfSeason: 0,
    year: state.year + 1,
    recentEvents: [
      `Offseason complete. Year ${state.year + 1} begins. Age: ${aged.age}`,
      ...awards.map(a => `Award: ${a}`),
    ],
    promotionPending: false,
    promotionMessage: null,
    milestones: updatedMilestones,
    pendingMilestones: [...state.pendingMilestones, ...newlyAchieved],
    seasonLog: [...state.seasonLog, seasonRecord],
    teamDynamics: dyn,
    contract,
    hofStatus,
    currentSeasonAwards: [],
  };
}

/** Generate contract offers for free agency. */
export function generateContractOffers(
  state: CareerState,
  rng: RandomProvider,
): { teamName: string; years: number; salary: number }[] {
  const { careerStats: cs, player } = state;
  const isPitcher = player.position === 'P';
  const age = player.age;

  // Base salary on career stats and age
  let baseSalary = 1000; // $1M
  if (isPitcher) {
    baseSalary += cs.pitching.wins * 200;
    baseSalary += cs.pitching.so_p * 5;
    if (cs.pitching.ip > 0) {
      const era = (cs.pitching.er / cs.pitching.ip) * 9;
      baseSalary += era < 3.0 ? 5000 : era < 3.5 ? 3000 : 1000;
    }
  } else {
    baseSalary += cs.batting.hr * 150;
    baseSalary += cs.batting.h * 20;
    baseSalary += cs.batting.rbi * 30;
  }

  // Age penalty
  if (age > 33) baseSalary = Math.round(baseSalary * (1 - (age - 33) * 0.07));
  if (age > 38) baseSalary = Math.round(baseSalary * 0.3);

  baseSalary = Math.max(750, baseSalary);

  const MLB_TEAMS = LEVEL_TEAMS['MLB'];
  const allTeams = [
    ...MLB_TEAMS,
    'Boston Red Sox', 'St. Louis Cardinals', 'Atlanta Braves', 'San Francisco Giants',
    'San Diego Padres', 'Philadelphia Phillies', 'Toronto Blue Jays', 'Seattle Mariners',
  ];

  const numOffers = rng.nextInt(2, 4);
  const offers: { teamName: string; years: number; salary: number }[] = [];
  const usedTeams = new Set<string>();

  // Current team always offers first (retain)
  offers.push({
    teamName: state.currentTeam,
    years: rng.nextInt(2, 4),
    salary: Math.round(baseSalary * rng.nextFloat(0.95, 1.05)),
  });
  usedTeams.add(state.currentTeam);

  for (let i = 1; i < numOffers; i++) {
    let team: string;
    do { team = rng.pick(allTeams); } while (usedTeams.has(team));
    usedTeams.add(team);
    const yearVariance = rng.nextInt(1, 5);
    const salVariance = rng.nextFloat(0.85, 1.15);
    offers.push({
      teamName: team,
      years: Math.min(7, yearVariance),
      salary: Math.round(baseSalary * salVariance),
    });
  }

  return offers;
}

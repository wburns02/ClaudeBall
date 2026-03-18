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

export interface CareerState {
  player: Player;
  currentTeam: string;   // team name
  year: number;
  level: CareerLevel;
  seasonStats: SeasonStats;
  careerStats: CareerStats;
  dayOfSeason: number;    // 0-162
  promotionPending: boolean;
  promotionMessage: string | null;
  recentEvents: string[];
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

// ─── Core simulation ─────────────────────────────────────────────────────────

/** Simulate one game day in the minor leagues. Returns event descriptions. */
export function simulateMinorLeagueDay(state: CareerState, rng: RandomProvider): CareerState {
  if (state.dayOfSeason >= 140) return state; // Season over

  const player = state.player;
  const isPitcher = player.position === 'P';
  const events: string[] = [];
  const stats = { ...state.seasonStats };

  if (isPitcher) {
    // Pitcher starts every 5 days
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

    // IP: 4-7 based on stamina
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

    // Recalculate ERA / WHIP
    stats.era  = stats.ip > 0 ? (stats.er / stats.ip) * 9 : 0;
    stats.whip = stats.ip > 0 ? (stats.hits_allowed + stats.bb_p) / stats.ip : 0;

    events.push(
      `Day ${state.dayOfSeason + 1}: ${win ? 'W' : save ? 'SV' : 'L'} — ${ipRounded.toFixed(1)} IP, ${Math.max(0, h)}H, ${Math.max(0, er)}ER, ${Math.max(0, ks)}K, ${Math.max(0, bb)}BB`
    );
  } else {
    // Position player — play every day
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
        // else groundout/flyout
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

    // Recalculate averages
    stats.avg = stats.ab > 0 ? stats.h / stats.ab : 0;
    stats.obp = (stats.ab + stats.bb) > 0 ? (stats.h + stats.bb) / (stats.ab + stats.bb) : 0;
    const tb  = (stats.h - stats.doubles - stats.triples - stats.hr) + stats.doubles * 2 + stats.triples * 3 + stats.hr * 4;
    stats.slg = stats.ab > 0 ? tb / stats.ab : 0;
    stats.ops = stats.obp + stats.slg;

    const hitDesc = dayH > 0 ? `${dayH}-for-${dayAB}` : `0-for-${dayAB}`;
    const extras = [dayHR > 0 ? `${dayHR}HR` : '', dayRBI > 0 ? `${dayRBI}RBI` : '', dayBB > 0 ? `${dayBB}BB` : ''].filter(Boolean).join(', ');
    events.push(`Day ${state.dayOfSeason + 1}: ${hitDesc}${extras ? ` (${extras})` : ''}`);
  }

  return {
    ...state,
    seasonStats: stats,
    dayOfSeason: state.dayOfSeason + 1,
    recentEvents: events,
    promotionPending: false,
    promotionMessage: null,
  };
}

/** Check if the player qualifies for a call-up based on performance. */
export function checkPromotion(state: CareerState): boolean {
  if (state.level === 'MLB') return false;
  const { seasonStats: s, player } = state;
  const gamesRequired = 30;

  if (player.position === 'P') {
    return s.gs >= gamesRequired / 5 && s.era < 3.00;
  } else {
    return s.g >= gamesRequired && s.avg >= 0.300;
  }
}

/** Apply offseason development: ratings change ±1-5 based on age, work ethic, potential. */
export function developPlayer(player: Player, rng: RandomProvider): Player {
  const age = player.age;
  const ethic = player.mental.work_ethic;
  const potential = 75; // fixed for user player

  // Growth factor: peaks around age 24, starts declining at 30
  const growthFactor = age < 24
    ? (age - 18) / 6       // ramp up: 0.0 → 1.0
    : age < 30
      ? 1.0 - (age - 24) * 0.08   // slow decline
      : Math.max(0, 1.0 - (age - 24) * 0.15); // faster decline

  const ethicBonus = (ethic - 50) / 100; // -0.5 to +0.5

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
    work_ethic:   player.mental.work_ethic, // fixed trait
    durability:   age > 35 ? clamp(player.mental.durability - rng.nextInt(1, 3), 20, 99) : player.mental.durability,
  };

  return { ...player, batting: newBatting, pitching: newPitching, mental: newMental };
}

/** Age the player one year. Physical decline after 32, wisdom growth until 35. */
export function agePlayer(player: Player): Player {
  return { ...player, age: player.age + 1 };
}

/** Promote player to next level. */
export function promotePlayer(state: CareerState, rng: RandomProvider): CareerState {
  const idx = LEVEL_ORDER.indexOf(state.level);
  if (idx >= LEVEL_ORDER.length - 1) return state;
  const newLevel = LEVEL_ORDER[idx + 1];
  const newTeam  = getTeamForLevel(newLevel, rng);
  const levelLabel = newLevel === 'MLB' ? '🎉 CALLED UP TO THE MAJORS' : `Promoted to ${newLevel}`;

  return {
    ...state,
    level: newLevel,
    currentTeam: newTeam,
    seasonStats: emptySeasonStats(),
    dayOfSeason: 0,
    promotionPending: true,
    promotionMessage: `${levelLabel} — ${newTeam}!`,
    recentEvents: [`⬆️ ${levelLabel}!`],
  };
}

/** Advance the offseason: develop player, age them, reset season stats. */
export function advanceOffseason(state: CareerState, rng: RandomProvider): CareerState {
  const developed = developPlayer(state.player, rng);
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

  return {
    ...state,
    player: aged,
    careerStats: cs,
    seasonStats: emptySeasonStats(),
    dayOfSeason: 0,
    year: state.year + 1,
    recentEvents: [`Offseason complete. Year ${state.year + 1} begins. Age: ${aged.age}`],
    promotionPending: false,
    promotionMessage: null,
  };
}

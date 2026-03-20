import type { Player } from '../types/player.ts';
import type { Position, Hand, PitchType } from '../types/enums.ts';
import type { RandomProvider } from '../core/RandomProvider.ts';
import { getPlayerName } from '../types/player.ts';
import { evaluatePlayer } from '../gm/TradeEngine.ts';

export interface MinorLeagueRoster {
  teamId: string;
  players: Player[];
}

export interface MiLBBatterStats {
  g: number; ab: number; r: number; h: number; doubles: number;
  triples: number; hr: number; rbi: number; bb: number; k: number; sb: number;
  avg: number; obp: number; slg: number; ops: number;
}

export interface MiLBPitcherStats {
  g: number; gs: number; w: number; l: number; sv: number;
  ip: number; h: number; er: number; bb: number; k: number;
  era: number; whip: number;
}

export type MiLBStats = MiLBBatterStats | MiLBPitcherStats;

export interface CallupEvent {
  type: 'callup' | 'senddown';
  teamId: string;
  player: Player;
  message: string;
}

export interface ProspectDevelopmentEvent {
  type: 'breakout' | 'improvement' | 'regression' | 'bust';
  teamId: string;
  playerId: string;
  playerName: string;
  position: string;
  age: number;
  ovrBefore: number;
  ovrAfter: number;
  ovrDelta: number;
  day: number;
  /** Which attribute gained/lost the most */
  keyAttribute: string;
  keyDelta: number;
}

const SEPTEMBER_CALLUP_DAY = 150;
const MAX_AAA_ROSTER = 25;
const MAX_EXPANDED_ROSTER = 40;

const FIRST_NAMES = [
  'Marcus', 'Andre', 'Devon', 'Elias', 'Tomas', 'Luis', 'Carlos', 'Malik',
  'Jamal', 'Connor', 'Diego', 'Ryu', 'Dante', 'Orlando', 'Caleb', 'Nolan',
  'Tyler', 'Chase', 'Hunter', 'Bryce', 'Yoshi', 'Miguel', 'Raul', 'Felix',
  'Cesar', 'Kenji', 'Darius', 'Cole', 'Austin', 'Brent', 'Pedro', 'Hiro',
];

const LAST_NAMES = [
  'Johnson', 'Williams', 'Garcia', 'Martinez', 'Rodriguez', 'Davis', 'Wilson',
  'Anderson', 'Taylor', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin',
  'Thompson', 'Moore', 'Young', 'Allen', 'King', 'Wright', 'Lopez', 'Hill',
  'Scott', 'Green', 'Adams', 'Baker', 'Nelson', 'Carter', 'Mitchell', 'Perez',
  'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards',
];

const POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'P'];
const PITCH_TYPES: PitchType[] = ['fastball', 'slider', 'curveball', 'changeup', 'sinker', 'cutter'];

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/**
 * Generate a minor league player (lower ratings, younger).
 */
function generateMinorLeaguer(id: string, rng: RandomProvider): Player {
  const pos = rng.pick(POSITIONS);
  const isPitcher = pos === 'P';
  const age = rng.nextInt(18, 26);
  const hands: Hand[] = ['L', 'R', 'S'];
  const bats = rng.pick(hands);
  const throws: Hand = rng.chance(0.3) ? 'L' : 'R';

  // Minor leaguers are generally lower tier
  const tier = rng.weightedPick([0, 1, 2, 3], [15, 35, 35, 15]);
  const baseMean = [42, 52, 60, 70][tier];
  const spread = 10;
  const r = () => clamp(rng.nextGaussian(baseMean, spread), 25, 85);

  const repertoire: PitchType[] = ['fastball'];
  const pitchCount = rng.nextInt(1, 3);
  const shuffled = [...PITCH_TYPES.slice(1)].sort(() => rng.next() - 0.5);
  for (let i = 0; i < pitchCount && i < shuffled.length; i++) {
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
      : { contact_L: r(), contact_R: r(), power_L: r(), power_R: r(), eye: r(), avoid_k: r(), gap_power: r(), speed: r(), steal: clamp(rng.nextGaussian(35, 18), 5, 85), bunt: clamp(rng.nextGaussian(32, 14), 5, 75), clutch: r() },
    pitching: isPitcher
      ? { stuff: r(), movement: r(), control: r(), stamina: r(), velocity: clamp(rng.nextGaussian(89, 4), 82, 99), hold_runners: r(), groundball_pct: rng.nextInt(30, 70), repertoire }
      : { stuff: 30, movement: 30, control: 30, stamina: 28, velocity: 84, hold_runners: 28, groundball_pct: 50, repertoire: ['fastball'] },
    fielding: [{
      position: pos,
      range: r(),
      arm_strength: r(),
      arm_accuracy: r(),
      turn_dp: r(),
      error_rate: clamp(rng.nextGaussian(42, 14), 10, 70),
    }],
    mental: { intelligence: r(), work_ethic: r(), durability: r(), consistency: r(), composure: r(), leadership: r() },
    state: { fatigue: 0, morale: rng.nextInt(55, 90), pitchCount: 0, isInjured: false },
  };
}

/**
 * MinorLeagues — each team has an AAA affiliate of 25 players.
 */
export class MinorLeagues {
  private affiliates: Map<string, MinorLeagueRoster> = new Map();

  /**
   * Initialize AAA rosters for all teams.
   */
  initializeAffiliates(teamIds: string[], rng: RandomProvider): void {
    for (const teamId of teamIds) {
      const players = this.generateMinorLeaguers(teamId, MAX_AAA_ROSTER, rng);
      this.affiliates.set(teamId, { teamId, players });
    }
  }

  /**
   * Generate minor league players for a team.
   */
  generateMinorLeaguers(teamId: string, count: number, rng: RandomProvider): Player[] {
    const players: Player[] = [];
    for (let i = 0; i < count; i++) {
      const id = `aaa-${teamId}-${Date.now()}-${i}`;
      players.push(generateMinorLeaguer(id, rng));
    }
    return players;
  }

  getAffiliate(teamId: string): MinorLeagueRoster | undefined {
    return this.affiliates.get(teamId);
  }

  getAllAffiliates(): MinorLeagueRoster[] {
    return Array.from(this.affiliates.values());
  }

  /**
   * Call up the top prospect to the MLB roster.
   * Returns a CallupEvent if successful.
   */
  callUp(
    teamId: string,
    mlbRoster: Player[],
    currentDay: number,
  ): CallupEvent | null {
    const affiliate = this.affiliates.get(teamId);
    if (!affiliate || affiliate.players.length === 0) return null;

    const maxRoster = currentDay >= SEPTEMBER_CALLUP_DAY ? MAX_EXPANDED_ROSTER : 26;
    if (mlbRoster.length >= maxRoster) return null;

    // Pick the highest-value prospect
    const sorted = [...affiliate.players]
      .map(p => ({ p, v: evaluatePlayer(p) }))
      .sort((a, b) => b.v - a.v);

    const best = sorted[0];
    if (!best) return null;

    // Remove from AAA
    const idx = affiliate.players.findIndex(p => p.id === best.p.id);
    affiliate.players.splice(idx, 1);

    // Add to MLB roster
    mlbRoster.push(best.p);

    return {
      type: 'callup',
      teamId,
      player: best.p,
      message: `${getPlayerName(best.p)} called up from AAA.`,
    };
  }

  /**
   * Call up a specific prospect by player ID.
   * Returns a CallupEvent if successful.
   */
  callUpSpecific(
    teamId: string,
    mlbRoster: Player[],
    playerId: string,
    currentDay: number,
  ): CallupEvent | null {
    const affiliate = this.affiliates.get(teamId);
    if (!affiliate) return null;

    const maxRoster = currentDay >= SEPTEMBER_CALLUP_DAY ? MAX_EXPANDED_ROSTER : 26;
    if (mlbRoster.length >= maxRoster) return null;

    const idx = affiliate.players.findIndex(p => p.id === playerId);
    if (idx === -1) return null;

    const [player] = affiliate.players.splice(idx, 1);
    mlbRoster.push(player);

    return {
      type: 'callup',
      teamId,
      player,
      message: `${getPlayerName(player)} called up from AAA.`,
    };
  }

  /**
   * Send a struggling MLB player to the minors.
   */
  sendDown(
    teamId: string,
    mlbRoster: Player[],
    playerId: string,
  ): CallupEvent | null {
    const affiliate = this.affiliates.get(teamId);
    if (!affiliate) return null;

    const idx = mlbRoster.findIndex(p => p.id === playerId);
    if (idx === -1) return null;

    const [player] = mlbRoster.splice(idx, 1);
    affiliate.players.push(player);

    return {
      type: 'senddown',
      teamId,
      player,
      message: `${getPlayerName(player)} optioned to AAA.`,
    };
  }

  /**
   * Run weekly prospect development for all affiliates.
   * Called every 7 simmed days. Young players with high work ethic
   * improve; older ones may plateau or regress slightly.
   */
  weeklyProspectDevelopment(
    currentDay: number,
    rng: RandomProvider,
  ): ProspectDevelopmentEvent[] {
    const events: ProspectDevelopmentEvent[] = [];

    for (const [teamId, roster] of this.affiliates) {
      for (const player of roster.players) {
        const age = player.age;
        const workEthic = player.mental.work_ethic;
        const ovrBefore = Math.round(evaluatePlayer(player));

        // Age-based development window: peak at 19-22, tapering to 26
        const ageFactor = age <= 19 ? 1.0
          : age <= 22 ? 0.85
          : age <= 24 ? 0.6
          : age <= 26 ? 0.3
          : -0.1; // 27+ start to plateau/regress

        // Work ethic bonus (0-80 scale → 0–0.4 bonus multiplier)
        const ethicBonus = (workEthic / 80) * 0.4;

        // Base development chance per week: ~25% for top prospects, ~8% for older ones
        const devChance = Math.max(0, (ageFactor + ethicBonus) * 0.35);

        // Regression chance for old prospects
        const regChance = age > 26 ? 0.08 : age > 24 ? 0.03 : 0;

        // Breakout chance (rare big jump): ~4% for young with high work ethic
        const breakoutChance = age <= 22 && workEthic >= 65 ? 0.04 : 0;

        const roll = rng.next();

        let ovrDelta = 0;
        let eventType: ProspectDevelopmentEvent['type'] = 'improvement';
        let keyAttribute = '';
        let keyDelta = 0;

        if (roll < breakoutChance) {
          // Breakout: big multi-attribute jump (+3 to +6 OVR)
          eventType = 'breakout';
          if (player.position === 'P') {
            const gain = rng.nextInt(2, 4);
            player.pitching.stuff = clamp(player.pitching.stuff + gain, 20, 85);
            player.pitching.control = clamp(player.pitching.control + rng.nextInt(1, 3), 20, 85);
            keyAttribute = 'Stuff'; keyDelta = gain;
          } else {
            const gain = rng.nextInt(2, 4);
            player.batting.contact_R = clamp(player.batting.contact_R + gain, 20, 85);
            player.batting.contact_L = clamp(player.batting.contact_L + gain, 20, 85);
            player.batting.power_R = clamp(player.batting.power_R + rng.nextInt(1, 3), 20, 85);
            keyAttribute = 'Contact'; keyDelta = gain;
          }
          ovrDelta = Math.round(evaluatePlayer(player)) - ovrBefore;
        } else if (roll < breakoutChance + devChance) {
          // Normal improvement: +1 to +2 OVR
          eventType = 'improvement';
          if (player.position === 'P') {
            const keys: (keyof Player['pitching'])[] = ['stuff', 'movement', 'control', 'stamina'];
            const k = rng.pick(keys) as keyof Player['pitching'];
            const gain = rng.nextInt(1, 3);
            (player.pitching as unknown as Record<string, number>)[k as string] = clamp(
              (player.pitching as unknown as Record<string, number>)[k as string] + gain, 20, 85
            );
            keyAttribute = String(k).charAt(0).toUpperCase() + String(k).slice(1);
            keyDelta = gain;
          } else {
            const keys: (keyof Player['batting'])[] = ['contact_R', 'contact_L', 'power_R', 'eye', 'speed'];
            const k = rng.pick(keys) as keyof Player['batting'];
            const gain = rng.nextInt(1, 3);
            (player.batting as unknown as Record<string, number>)[k as string] = clamp(
              (player.batting as unknown as Record<string, number>)[k as string] + gain, 20, 85
            );
            const labels: Record<string, string> = { contact_R: 'Contact', contact_L: 'Contact', power_R: 'Power', eye: 'Eye', speed: 'Speed' };
            keyAttribute = labels[k as string] ?? String(k);
            keyDelta = gain;
          }
          ovrDelta = Math.round(evaluatePlayer(player)) - ovrBefore;
          // Only emit event if OVR actually changed
          if (ovrDelta === 0) continue;
        } else if (roll < breakoutChance + devChance + regChance) {
          // Regression
          eventType = ovrBefore <= 40 ? 'bust' : 'regression';
          if (player.position === 'P') {
            const loss = rng.nextInt(1, 2);
            player.pitching.control = clamp(player.pitching.control - loss, 20, 85);
            keyAttribute = 'Control'; keyDelta = -loss;
          } else {
            const loss = rng.nextInt(1, 2);
            player.batting.contact_R = clamp(player.batting.contact_R - loss, 20, 85);
            keyAttribute = 'Contact'; keyDelta = -loss;
          }
          ovrDelta = Math.round(evaluatePlayer(player)) - ovrBefore;
          if (ovrDelta === 0) continue;
        } else {
          continue; // No change this week
        }

        if (ovrDelta === 0 && eventType !== 'breakout') continue;

        events.push({
          type: eventType,
          teamId,
          playerId: player.id,
          playerName: getPlayerName(player),
          position: player.position,
          age,
          ovrBefore,
          ovrAfter: ovrBefore + ovrDelta,
          ovrDelta,
          day: currentDay,
          keyAttribute,
          keyDelta,
        });
      }
    }

    return events;
  }

  /**
   * Simulate AAA statistics for `days` days, accumulating into `existing`.
   * Returns a new record with updated counting + rate stats for every player.
   */
  simulateDayStats(
    days: number,
    rng: RandomProvider,
    existing: Record<string, MiLBStats>,
  ): Record<string, MiLBStats> {
    const result: Record<string, MiLBStats> = { ...existing };

    for (const roster of this.affiliates.values()) {
      for (const player of roster.players) {
        const isPitcher = player.position === 'P';

        if (isPitcher) {
          const prev = result[player.id] as MiLBPitcherStats | undefined;
          const stats: MiLBPitcherStats = prev
            ? { ...prev }
            : { g: 0, gs: 0, w: 0, l: 0, sv: 0, ip: 0, h: 0, er: 0, bb: 0, k: 0, era: 0, whip: 0 };

          const isStarter = player.pitching.stamina >= 52;
          const appearChance = isStarter ? 0.20 : 0.33;

          for (let d = 0; d < days; d++) {
            if (rng.next() > appearChance) continue;

            stats.g++;
            if (isStarter) stats.gs++;

            const baseIP = isStarter
              ? 3.0 + (player.pitching.stamina / 85) * 4.0
              : 0.3 + (player.pitching.stamina / 85) * 1.2;
            const ip = Math.max(0.1, baseIP + rng.nextGaussian(0, 0.5));
            stats.ip += ip;

            const kPerIP = 0.6 + (player.pitching.stuff / 85) * 0.8;
            stats.k += Math.max(0, Math.round(ip * kPerIP + rng.nextGaussian(0, 1)));

            const bbPerIP = 0.8 - (player.pitching.control / 85) * 0.6;
            stats.bb += Math.max(0, Math.round(ip * bbPerIP + rng.nextGaussian(0, 0.5)));

            const quality = (player.pitching.stuff + player.pitching.movement + player.pitching.control) / 255;
            const hPerIP = 1.4 - quality * 0.6;
            stats.h += Math.max(0, Math.round(ip * hPerIP + rng.nextGaussian(0, 1)));

            const erPerIP = Math.max(0, (1.1 - quality) * 0.9);
            stats.er += Math.max(0, Math.round(ip * erPerIP + rng.nextGaussian(0, 0.4)));

            if (isStarter && ip >= 5) {
              const winChance = quality * 0.5 + 0.25;
              if (rng.next() < winChance) stats.w++; else stats.l++;
            }
            if (!isStarter && ip >= 1 && rng.next() < 0.15) stats.sv++;
          }

          stats.era = stats.ip > 0 ? (stats.er / stats.ip) * 9 : 0;
          stats.whip = stats.ip > 0 ? (stats.bb + stats.h) / stats.ip : 0;
          result[player.id] = stats;

        } else {
          const prev = result[player.id] as MiLBBatterStats | undefined;
          const stats: MiLBBatterStats = prev
            ? { ...prev }
            : { g: 0, ab: 0, r: 0, h: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, bb: 0, k: 0, sb: 0, avg: 0, obp: 0, slg: 0, ops: 0 };

          const contact = (player.batting.contact_L + player.batting.contact_R) / 2;
          const power = (player.batting.power_L + player.batting.power_R) / 2;
          const bbRate = 0.04 + (player.batting.eye / 85) * 0.14;
          const kRate = 0.28 - (player.batting.avoid_k / 85) * 0.18;
          const hitRate = 0.190 + (contact / 85) * 0.145;
          const hrChancePerAB = Math.max(0, (power - 30) / 55) * 0.075;
          const sbRate = (player.batting.steal / 85) * 0.14;

          for (let d = 0; d < days; d++) {
            if (rng.next() > 0.65) continue;

            stats.g++;
            const pa = 3 + Math.round(rng.next() * 2);

            for (let i = 0; i < pa; i++) {
              const roll = rng.next();
              if (roll < bbRate) {
                stats.bb++;
              } else if (roll < bbRate + kRate) {
                stats.ab++;
                stats.k++;
              } else {
                stats.ab++;
                if (rng.next() < hitRate) {
                  stats.h++;
                  if (rng.next() < hrChancePerAB) {
                    stats.hr++;
                    stats.r++;
                    stats.rbi++;
                  } else if (rng.next() < 0.22) {
                    stats.doubles++;
                  } else if (rng.next() < 0.03) {
                    stats.triples++;
                  }
                  if (rng.next() < 0.28) stats.rbi++;
                  if (rng.next() < 0.22) stats.r++;
                }
              }
            }
            if (stats.h > 0 && rng.next() < sbRate) stats.sb++;
          }

          const pa = stats.ab + stats.bb;
          stats.avg = stats.ab > 0 ? stats.h / stats.ab : 0;
          stats.obp = pa > 0 ? (stats.h + stats.bb) / pa : 0;
          const singles = stats.h - stats.doubles - stats.triples - stats.hr;
          stats.slg = stats.ab > 0
            ? (singles + 2 * stats.doubles + 3 * stats.triples + 4 * stats.hr) / stats.ab
            : 0;
          stats.ops = stats.obp + stats.slg;
          result[player.id] = stats;
        }
      }
    }

    return result;
  }

  /**
   * September callups: automatically call up top prospects after day 150.
   */
  runSeptemberCallups(
    teams: Map<string, { id: string; roster: { players: Player[] } }>,
    currentDay: number,
  ): CallupEvent[] {
    if (currentDay < SEPTEMBER_CALLUP_DAY) return [];

    const events: CallupEvent[] = [];

    for (const [teamId, team] of teams) {
      const affiliate = this.affiliates.get(teamId);
      if (!affiliate) continue;

      // Expand to 40-man: call up until roster hits 40
      while (team.roster.players.length < MAX_EXPANDED_ROSTER && affiliate.players.length > 0) {
        const event = this.callUp(teamId, team.roster.players, currentDay);
        if (!event) break;
        events.push(event);
      }
    }

    return events;
  }
}

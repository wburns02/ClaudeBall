import type { Player } from '../types/player.ts';
import type { Position, Hand, PitchType } from '../types/enums.ts';
import type { RandomProvider } from '../core/RandomProvider.ts';
import { getPlayerName } from '../types/player.ts';
import { evaluatePlayer } from '../gm/TradeEngine.ts';

export interface MinorLeagueRoster {
  teamId: string;
  players: Player[];
}

export interface CallupEvent {
  type: 'callup' | 'senddown';
  teamId: string;
  player: Player;
  message: string;
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

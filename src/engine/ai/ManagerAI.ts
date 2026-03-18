import type { Team, Player, PitchType } from '../types/index.ts';
import type { GameState, BaseState } from '../types/game.ts';
import type { DefensiveAlignment } from '../types/manager.ts';
import { getPlayer, getBenchPlayers, getAvailableRelievers } from '../types/team.ts';
import { getPlayerName } from '../types/player.ts';
import type { RandomProvider } from '../core/RandomProvider.ts';
import { clamp } from '../util/helpers.ts';

export interface PitchingChangeDecision {
  shouldChange: boolean;
  reason?: string;
}

export interface RelieverSelection {
  pitcher: Player;
  role: 'long_relief' | 'setup' | 'closer';
}

export interface PinchHitDecision {
  shouldPinchHit: boolean;
  pinchHitter?: Player;
  forPlayerId?: string;
  battingSpot?: number;
}

/**
 * AI manager decisions: pitching changes with roles, pinch hitting, defensive subs, steal attempts.
 */
export class ManagerAI {

  // ─── Pitching Change Logic ─────────────────────────────────────────────────

  /**
   * Evaluate whether to pull the current pitcher. Returns decision with reason.
   * Called after each at-bat resolves.
   */
  static shouldChangePitcher(
    team: Team,
    state: GameState,
    /** Runs allowed by current pitcher in the current inning */
    runsThisInning: number,
  ): PitchingChangeDecision {
    const pitcher = getPlayer(team, team.pitcherId);
    if (!pitcher) return { shouldChange: false };

    const available = getAvailableRelievers(team);
    if (available.length === 0) return { shouldChange: false }; // Nobody left

    const pc = pitcher.state.pitchCount;
    const fatigue = pitcher.state.fatigue;

    // Hard pull: over 100 pitches AND fatigue > 60%
    if (pc >= 100 && fatigue > 60) {
      return { shouldChange: true, reason: `${getPlayerName(pitcher)} has thrown ${pc} pitches with ${Math.round(fatigue)}% fatigue` };
    }

    // Early pull: over 85 pitches AND fatigue > 75%
    if (pc >= 85 && fatigue > 75) {
      return { shouldChange: true, reason: `${getPlayerName(pitcher)} is tiring fast (${pc} pitches, ${Math.round(fatigue)}% fatigue)` };
    }

    // Getting shelled: gave up 4+ runs in current inning
    if (runsThisInning >= 4) {
      return { shouldChange: true, reason: `${getPlayerName(pitcher)} has allowed ${runsThisInning} runs this inning` };
    }

    // Getting shelled: 70+ pitches and lots of runs allowed overall
    const isHome = team.id === state.home.id;
    const opponentRuns = isHome
      ? state.score.away.reduce((a, b) => a + b, 0)
      : state.score.home.reduce((a, b) => a + b, 0);
    if (pc > 70 && opponentRuns >= 7) {
      return { shouldChange: true, reason: `${getPlayerName(pitcher)} has allowed ${opponentRuns} total runs` };
    }

    return { shouldChange: false };
  }

  /**
   * Select the best available reliever for the given game situation.
   * Closer role: 9th inning, save situation (leading by 1-3).
   * Setup role: 8th inning.
   * Long/middle relief: innings 5-7.
   */
  static selectReliever(team: Team, state: GameState): RelieverSelection | null {
    const available = getAvailableRelievers(team);
    if (available.length === 0) return null;

    const inning = state.inning.inning;
    const isHome = team.id === state.home.id;
    const ourRuns = isHome
      ? state.score.home.reduce((a, b) => a + b, 0)
      : state.score.away.reduce((a, b) => a + b, 0);
    const theirRuns = isHome
      ? state.score.away.reduce((a, b) => a + b, 0)
      : state.score.home.reduce((a, b) => a + b, 0);
    const lead = ourRuns - theirRuns;

    // The last reliever in the original bullpen array (still available) is the closer.
    // Second-to-last is the setup man.
    // All others are middle/long relievers.
    //
    // We look up positions in the original bullpen array for role designation.
    const bullpenIds = team.bullpen;
    const usedSet = new Set(team.usedPitchers ?? []);
    const availableIds = bullpenIds.filter(id => !usedSet.has(id) && id !== team.pitcherId);

    if (availableIds.length === 0) return null;

    const closerId = availableIds[availableIds.length - 1];
    const setupId = availableIds.length >= 2 ? availableIds[availableIds.length - 2] : null;

    // 9th inning save situation → use closer
    if (inning >= 9 && lead >= 1 && lead <= 3) {
      const closer = getPlayer(team, closerId);
      if (closer && closer.state.fatigue < 80) {
        return { pitcher: closer, role: 'closer' };
      }
    }

    // 8th inning → prefer setup man
    if (inning === 8 && setupId) {
      const setup = getPlayer(team, setupId);
      if (setup && setup.state.fatigue < 75) {
        return { pitcher: setup, role: 'setup' };
      }
    }

    // Otherwise pick the freshest available middle reliever (not closer/setup in late innings)
    // In late innings (8-9) we still protect closer/setup if they haven't been used
    const middleIds = inning >= 8
      ? availableIds.slice(0, Math.max(0, availableIds.length - 2))
      : availableIds.slice(0, availableIds.length - 1); // protect closer until 9th

    let bestMid: Player | null = null;
    let bestFatigue = Infinity;
    for (const id of middleIds) {
      const p = getPlayer(team, id);
      if (p && p.state.fatigue < bestFatigue) {
        bestMid = p;
        bestFatigue = p.state.fatigue;
      }
    }
    if (bestMid) return { pitcher: bestMid, role: 'long_relief' };

    // Fallback: take anyone available (even closer/setup if we need them)
    let fallback: Player | null = null;
    let fallbackFatigue = Infinity;
    for (const id of availableIds) {
      const p = getPlayer(team, id);
      if (p && p.state.fatigue < fallbackFatigue) {
        fallback = p;
        fallbackFatigue = p.state.fatigue;
      }
    }
    if (fallback) {
      const role = fallback.id === closerId ? 'closer' : fallback.id === setupId ? 'setup' : 'long_relief';
      return { pitcher: fallback, role };
    }

    return null;
  }

  // ─── Pinch Hit Logic ───────────────────────────────────────────────────────

  /**
   * Decide whether to pinch hit for the current batter.
   * - Always PH for pitcher batting in 7th inning or later
   * - PH for weak hitters in 8th+ when trailing by 1-2 with RISP
   */
  static shouldPinchHit(
    team: Team,
    state: GameState,
    currentBatterIndex: number,
  ): PinchHitDecision {
    const battingSpot = currentBatterIndex % 9;
    const spot = team.lineup[battingSpot];
    if (!spot) return { shouldPinchHit: false };

    const batter = getPlayer(team, spot.playerId);
    if (!batter) return { shouldPinchHit: false };

    const bench = getBenchPlayers(team);
    if (bench.length === 0) return { shouldPinchHit: false };

    const inning = state.inning.inning;
    const bases = state.inning.bases;
    const isHome = team.id === state.home.id;
    const ourRuns = isHome
      ? state.score.home.reduce((a, b) => a + b, 0)
      : state.score.away.reduce((a, b) => a + b, 0);
    const theirRuns = isHome
      ? state.score.away.reduce((a, b) => a + b, 0)
      : state.score.home.reduce((a, b) => a + b, 0);
    const runDiff = ourRuns - theirRuns;
    const risp = bases.second !== null || bases.third !== null;

    // PH for pitcher batting in 7th+
    if (batter.position === 'P' && inning >= 7) {
      const ph = this.bestPinchHitter(bench);
      if (ph) {
        return { shouldPinchHit: true, pinchHitter: ph, forPlayerId: spot.playerId, battingSpot };
      }
    }

    // PH for weak hitter late in game when trailing with RISP
    if (inning >= 8 && runDiff >= -2 && runDiff <= -1 && risp) {
      const batterContact = (batter.batting.contact_L + batter.batting.contact_R) / 2;
      const batterPower = (batter.batting.power_L + batter.batting.power_R) / 2;
      const batterRating = batterContact * 0.5 + batterPower * 0.3 + batter.batting.eye * 0.2;

      // Only PH if batter is significantly below average
      if (batterRating < 48) {
        const ph = this.bestPinchHitterVs(bench, batter, runDiff);
        if (ph && this.pinchHitterIsUpgrade(ph, batter)) {
          return { shouldPinchHit: true, pinchHitter: ph, forPlayerId: spot.playerId, battingSpot };
        }
      }
    }

    return { shouldPinchHit: false };
  }

  /** Find the best available bench bat overall */
  private static bestPinchHitter(bench: Player[]): Player | null {
    let best: Player | null = null;
    let bestScore = -1;
    for (const p of bench) {
      const contact = (p.batting.contact_L + p.batting.contact_R) / 2;
      const power = (p.batting.power_L + p.batting.power_R) / 2;
      const score = contact * 0.5 + power * 0.3 + p.batting.eye * 0.2;
      if (score > bestScore && p.state.fatigue < 80) {
        best = p;
        bestScore = score;
      }
    }
    return best;
  }

  /** Find best pinch hitter given game situation (trailing = prefer contact/eye) */
  private static bestPinchHitterVs(bench: Player[], _starter: Player, runDiff: number): Player | null {
    let best: Player | null = null;
    let bestScore = -1;
    // When trailing, favor contact + eye; if tied, also consider power
    const contactWeight = runDiff < 0 ? 0.5 : 0.4;
    const powerWeight = runDiff < 0 ? 0.2 : 0.35;
    const eyeWeight = 1 - contactWeight - powerWeight;
    for (const p of bench) {
      const contact = (p.batting.contact_L + p.batting.contact_R) / 2;
      const power = (p.batting.power_L + p.batting.power_R) / 2;
      const score = contact * contactWeight + power * powerWeight + p.batting.eye * eyeWeight;
      if (score > bestScore && p.state.fatigue < 80) {
        best = p;
        bestScore = score;
      }
    }
    return best;
  }

  /** Returns true if the pinch hitter is a clear upgrade over the starter */
  private static pinchHitterIsUpgrade(ph: Player, starter: Player): boolean {
    const phScore = (ph.batting.contact_L + ph.batting.contact_R) / 2 * 0.5
      + (ph.batting.power_L + ph.batting.power_R) / 2 * 0.3
      + ph.batting.eye * 0.2;
    const starterScore = (starter.batting.contact_L + starter.batting.contact_R) / 2 * 0.5
      + (starter.batting.power_L + starter.batting.power_R) / 2 * 0.3
      + starter.batting.eye * 0.2;
    return phScore >= starterScore + 5; // Require at least 5-point improvement
  }

  /**
   * After a pinch hit, select a defensive replacement for the pinch hitter's
   * fielding position. Returns the best available bench player for that position,
   * or the pinch hitter themselves if no one else is available.
   */
  static selectDefensiveSub(
    team: Team,
    positionNeeded: string,
    excludeIds: Set<string>,
  ): Player | null {
    const bench = getBenchPlayers(team).filter(p => !excludeIds.has(p.id));

    // Prefer players with a fielding entry for the needed position
    let best: Player | null = null;
    let bestScore = -1;
    for (const p of bench) {
      const fld = p.fielding.find(f => f.position === positionNeeded);
      if (fld) {
        const score = fld.range * 0.4 + fld.arm_strength * 0.3 + (100 - fld.error_rate) * 0.3;
        if (score > bestScore) {
          best = p;
          bestScore = score;
        }
      }
    }

    // Fallback: any bench player
    if (!best && bench.length > 0) {
      best = bench[0] ?? null;
    }

    return best;
  }

  // ─── Legacy/unchanged methods ──────────────────────────────────────────────

  /** Should we attempt a steal? */
  static shouldSteal(runner: Player, _pitcher: Player, inning: number, _outs: number, runDiff: number): boolean {
    if (runner.batting.steal < 60) return false;
    if (runDiff > 3 || runDiff < -3) return false;
    if (inning >= 8 && runDiff < 0) return runner.batting.steal >= 75;
    return runner.batting.steal >= 70 && Math.random() < 0.15;
  }

  /**
   * Recommend defensive alignment based on batter tendencies.
   */
  static getDefensiveAlignment(
    batter: Player,
    situation: { bases: BaseState; outs: number },
  ): DefensiveAlignment {
    const { bases, outs } = situation;

    let infieldShift: DefensiveAlignment['infieldShift'] = 'normal';
    const pullPower = batter.bats === 'L' ? batter.batting.power_L : batter.batting.power_R;
    const oppPower  = batter.bats === 'L' ? batter.batting.power_R : batter.batting.power_L;

    if (pullPower >= 75 && oppPower < 55) {
      infieldShift = batter.bats === 'L' ? 'shift_right' : 'shift_left';
    }

    let infieldDepth: DefensiveAlignment['infieldDepth'] = 'normal';
    if (bases.third !== null && outs < 2) {
      infieldDepth = 'in';
    } else if (bases.first === null && bases.second === null && bases.third === null && outs < 2) {
      infieldDepth = 'back';
    }

    let outfieldDepth: DefensiveAlignment['outfieldDepth'] = 'normal';
    const avgPower = (batter.batting.power_L + batter.batting.power_R) / 2;
    if (avgPower >= 80) {
      outfieldDepth = 'deep';
    } else if (batter.batting.speed >= 80 && avgPower < 45) {
      outfieldDepth = 'shallow';
    }

    return { infieldShift, infieldDepth, outfieldDepth };
  }

  /**
   * Detect likely steal attempt to trigger a pitchout.
   */
  static shouldPitchOut(
    bases: BaseState,
    outs: number,
    runner: Player | null,
  ): boolean {
    if (!runner) return false;
    if (outs >= 2) return false;
    if (!bases.first && !bases.second) return false;

    const stealRating = runner.batting.steal;
    if (stealRating < 70) return false;

    if (bases.first && stealRating >= 80 && Math.random() < 0.20) return true;
    if (bases.first && stealRating >= 70 && Math.random() < 0.10) return true;

    return false;
  }

  /**
   * Decide whether to intentionally walk this batter.
   */
  static shouldIntentionalWalk(
    batter: Player,
    bases: BaseState,
    outs: number,
    scoreDiff: number,
  ): boolean {
    if (bases.first !== null && bases.second !== null && bases.third !== null) return false;
    if (bases.first !== null) return false;
    if (Math.abs(scoreDiff) > 2) return false;

    const avgPower = (batter.batting.power_L + batter.batting.power_R) / 2;
    const danger = clamp((avgPower + batter.batting.clutch) / 200, 0, 1);

    if (outs === 2) return danger >= 0.85;

    const runnersInScoring = bases.second !== null || bases.third !== null;
    if (!runnersInScoring) return false;

    return danger >= 0.80;
  }

  /**
   * AI pitch type selection.
   */
  static selectPitchType(
    pitcher: Player,
    _batter: Player,
    balls: number,
    strikes: number,
    rng: RandomProvider,
  ): PitchType {
    const rep = pitcher.pitching.repertoire;
    if (rep.length === 0) return 'fastball';
    if (rep.length === 1) return rep[0];

    const isBehind = balls > strikes;
    const isAhead  = strikes > balls;

    const weights = rep.map(p => {
      const isHeat = p === 'fastball' || p === 'sinker' || p === 'cutter';
      if (isHeat) return isBehind ? 5 : isAhead ? 2 : 3;
      return isBehind ? 1 : isAhead ? 4 : 3;
    });

    return rng.weightedPick(rep, weights);
  }

  /**
   * AI pitch location selection.
   */
  static selectPitchLocation(
    pitcher: Player,
    count: { balls: number; strikes: number },
    rng: RandomProvider,
  ): { row: number; col: number } {
    const { balls, strikes } = count;
    const control = pitcher.pitching.control;

    const aimForZone = balls > strikes
      ? 0.75
      : strikes > balls
        ? 0.40
        : 0.55;

    const adjustedZone = clamp(aimForZone + (control - 50) / 200, 0.25, 0.85);

    if (rng.chance(adjustedZone)) {
      return {
        row: 1 + Math.floor(rng.next() * 3),
        col: 1 + Math.floor(rng.next() * 3),
      };
    }

    const outerCells: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (r === 0 || r === 4 || c === 0 || c === 4) {
          outerCells.push({ row: r, col: c });
        }
      }
    }

    const idx = Math.floor(rng.next() * outerCells.length);
    return outerCells[idx] ?? { row: 0, col: 0 };
  }
}

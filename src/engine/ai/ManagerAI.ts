import type { Team, Player, PitchType } from '../types/index.ts';
import type { GameState, BaseState } from '../types/game.ts';
import type { DefensiveAlignment } from '../types/manager.ts';
import { getPlayer } from '../types/team.ts';
import type { RandomProvider } from '../core/RandomProvider.ts';
import { clamp } from '../util/helpers.ts';

/**
 * Basic AI manager decisions: pitching changes, steal attempts, bunt calls.
 */
export class ManagerAI {
  /** Should we pull the pitcher? */
  static shouldChangePitcher(team: Team, state: GameState): boolean {
    const pitcher = getPlayer(team, team.pitcherId);
    if (!pitcher) return false;

    // Pull after 100+ pitches
    if (pitcher.state.pitchCount >= 100) return true;

    // Pull if fatigue is high
    if (pitcher.state.fatigue >= 80) return true;

    // Pull if getting shelled (high runs in current inning)
    const isHome = team.id === state.home.id;
    const opponentRuns = isHome
      ? state.score.away.reduce((a, b) => a + b, 0)
      : state.score.home.reduce((a, b) => a + b, 0);

    if (pitcher.state.pitchCount > 70 && opponentRuns >= 6) return true;

    return false;
  }

  /** Select the best available reliever. */
  static selectReliever(team: Team): Player | null {
    for (const id of team.bullpen) {
      const p = getPlayer(team, id);
      if (p && p.state.fatigue < 30) return p;
    }
    // If everyone is tired, pick the freshest
    let best: Player | null = null;
    let bestFatigue = Infinity;
    for (const id of team.bullpen) {
      const p = getPlayer(team, id);
      if (p && p.state.fatigue < bestFatigue) {
        best = p;
        bestFatigue = p.state.fatigue;
      }
    }
    return best;
  }

  /** Should we attempt a steal? */
  static shouldSteal(runner: Player, _pitcher: Player, inning: number, _outs: number, runDiff: number): boolean {
    if (runner.batting.steal < 60) return false;
    if (runDiff > 3 || runDiff < -3) return false; // Don't steal in blowouts
    if (inning >= 8 && runDiff < 0) return runner.batting.steal >= 75; // Late game trailing
    return runner.batting.steal >= 70 && Math.random() < 0.15;
  }

  // ─── New methods added in Sprint C ────────────────────────────────────────

  /**
   * Recommend defensive alignment based on batter tendencies.
   * Pull hitters (high power_L / low spray tendency) get shifted right.
   * High-speed batters bring infield in if runner on 3B.
   */
  static getDefensiveAlignment(
    batter: Player,
    situation: { bases: BaseState; outs: number },
  ): DefensiveAlignment {
    const { bases, outs } = situation;

    // Shift logic: shift away from pull side
    let infieldShift: DefensiveAlignment['infieldShift'] = 'normal';
    const pullPower = batter.bats === 'L' ? batter.batting.power_L : batter.batting.power_R;
    const oppPower  = batter.bats === 'L' ? batter.batting.power_R : batter.batting.power_L;

    if (pullPower >= 75 && oppPower < 55) {
      // Strong pull hitter
      infieldShift = batter.bats === 'L' ? 'shift_right' : 'shift_left';
    }

    // Infield depth: bring in if runner on 3rd with < 2 outs (need to cut run at plate)
    let infieldDepth: DefensiveAlignment['infieldDepth'] = 'normal';
    if (bases.third !== null && outs < 2) {
      infieldDepth = 'in';
    } else if (bases.first === null && bases.second === null && bases.third === null && outs < 2) {
      infieldDepth = 'back'; // No runners, no need to crash
    }

    // Outfield depth: play shallow for fast, slap hitters; deep for sluggers
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
   * Returns true when conditions favor an opponent steal.
   */
  static shouldPitchOut(
    bases: BaseState,
    outs: number,
    runner: Player | null,
  ): boolean {
    if (!runner) return false;
    if (outs >= 2) return false; // Rare to pitchout with 2 outs
    if (!bases.first && !bases.second) return false; // Nobody on

    const stealRating = runner.batting.steal;
    if (stealRating < 70) return false; // Slow runner — don't bother

    // Only pitchout if runner has high steal and is on first (setup for 2B)
    if (bases.first && stealRating >= 80 && Math.random() < 0.20) return true;
    if (bases.first && stealRating >= 70 && Math.random() < 0.10) return true;

    return false;
  }

  /**
   * Decide whether to intentionally walk this batter.
   * Classic strategy: dangerous hitter, first base open, close game.
   */
  static shouldIntentionalWalk(
    batter: Player,
    bases: BaseState,
    outs: number,
    /** Positive = we're leading, negative = trailing */
    scoreDiff: number,
  ): boolean {
    // Never walk with bases loaded
    if (bases.first !== null && bases.second !== null && bases.third !== null) return false;

    // First base must be open (IBB puts runner on 1B)
    if (bases.first !== null) return false;

    // Only worth it in close games
    if (Math.abs(scoreDiff) > 2) return false;

    // Never IBB with 2 outs if it loads the bases unnecessarily (unless really dangerous)
    const avgPower = (batter.batting.power_L + batter.batting.power_R) / 2;
    const danger = clamp((avgPower + batter.batting.clutch) / 200, 0, 1);

    if (outs === 2) return danger >= 0.85;

    // With runner on 2B or 3B in late AB, walk the big bat
    const runnersInScoring = bases.second !== null || bases.third !== null;
    if (!runnersInScoring) return false;

    return danger >= 0.80;
  }

  /**
   * AI pitch type selection. Extracted from PitchEngine for reuse in
   * interactive mode where the human pitcher overrides.
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

    // Fastball family: go to it when behind (need strikes); break stuff when ahead
    const weights = rep.map(p => {
      const isHeat = p === 'fastball' || p === 'sinker' || p === 'cutter';
      if (isHeat) return isBehind ? 5 : isAhead ? 2 : 3;
      return isBehind ? 1 : isAhead ? 4 : 3;
    });

    return rng.weightedPick(rep, weights);
  }

  /**
   * AI pitch location selection. Returns a 0-4 row/col pair representing
   * a cell in the 5×5 grid (inner 3×3 = strike zone).
   */
  static selectPitchLocation(
    pitcher: Player,
    count: { balls: number; strikes: number },
    rng: RandomProvider,
  ): { row: number; col: number } {
    const { balls, strikes } = count;
    const control = pitcher.pitching.control;

    // Aim for the zone more when behind in count (need a strike)
    // Aim for edges/waste when ahead (try to get chase)
    const aimForZone = balls > strikes
      ? 0.75
      : strikes > balls
        ? 0.40
        : 0.55;

    // Add control factor: poor control sprays more
    const adjustedZone = clamp(aimForZone + (control - 50) / 200, 0.25, 0.85);

    if (rng.chance(adjustedZone)) {
      // Inner 3×3 strike zone (rows/cols 1-3)
      return {
        row: 1 + Math.floor(rng.next() * 3),
        col: 1 + Math.floor(rng.next() * 3),
      };
    }

    // Outside: pick an outer cell (row 0 or 4, or col 0 or 4)
    // Build list of outer cells and pick one
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

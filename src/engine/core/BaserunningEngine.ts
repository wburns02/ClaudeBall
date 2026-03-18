import type { Player, HitResult } from '../types/index.ts';
import type { BaseState } from '../types/game.ts';
import type { FieldingOutcome } from './FieldingEngine.ts';
import type { RandomProvider } from './RandomProvider.ts';
import { clamp, ratingToProb } from '../util/helpers.ts';

export interface BaserunningResult {
  newBases: BaseState;
  runsScored: number;
  scoringRunners: string[]; // player IDs who scored
  batterEndsAt: 1 | 2 | 3 | 4 | 0; // 4 = scored, 0 = out
  outsOnBases: number;
}

/**
 * Determines runner advancement on hits, outs, sac flies, etc.
 */
export class BaserunningEngine {
  static advanceRunners(
    bases: BaseState,
    batterId: string,
    fieldingResult: FieldingOutcome,
    outs: number,
    _rng: RandomProvider
  ): BaserunningResult {
    if (fieldingResult.hitResult === 'home_run') {
      return this.homeRun(bases, batterId);
    }

    if (fieldingResult.isError) {
      return this.onError(bases, batterId);
    }

    if (fieldingResult.hitResult) {
      return this.onHit(bases, batterId, fieldingResult.hitResult, fieldingResult.runnersAdvanceExtra);
    }

    if (fieldingResult.isDoublePlay) {
      return this.onDoublePlay(bases, outs);
    }

    if (fieldingResult.outType === 'sacrifice_fly') {
      return this.onSacFly(bases);
    }

    if (fieldingResult.outType === 'fielders_choice') {
      return this.onFieldersChoice(bases, batterId);
    }

    // Regular out — runners stay
    return { newBases: { ...bases }, runsScored: 0, scoringRunners: [], batterEndsAt: 0, outsOnBases: 0 };
  }

  private static homeRun(bases: BaseState, batterId: string): BaserunningResult {
    const scorers: string[] = [];
    if (bases.third) scorers.push(bases.third);
    if (bases.second) scorers.push(bases.second);
    if (bases.first) scorers.push(bases.first);
    scorers.push(batterId);

    return {
      newBases: { first: null, second: null, third: null },
      runsScored: scorers.length,
      scoringRunners: scorers,
      batterEndsAt: 4,
      outsOnBases: 0,
    };
  }

  private static onHit(bases: BaseState, batterId: string, hitType: HitResult, extraAdvance: boolean): BaserunningResult {
    const scorers: string[] = [];
    const newBases: BaseState = { first: null, second: null, third: null };

    if (hitType === 'single') {
      // Runner from 3rd scores
      if (bases.third) scorers.push(bases.third);
      // Runner from 2nd: scores on single if extra advance, otherwise to 3rd
      if (bases.second) {
        if (extraAdvance) {
          scorers.push(bases.second);
        } else {
          newBases.third = bases.second;
        }
      }
      // Runner from 1st: to 3rd if extra advance, otherwise to 2nd
      if (bases.first) {
        if (extraAdvance && !newBases.third) {
          newBases.third = bases.first;
        } else {
          newBases.second = bases.first;
        }
      }
      newBases.first = batterId;
    } else if (hitType === 'double') {
      if (bases.third) scorers.push(bases.third);
      if (bases.second) scorers.push(bases.second);
      if (bases.first) {
        if (extraAdvance) {
          scorers.push(bases.first);
        } else {
          newBases.third = bases.first;
        }
      }
      newBases.second = batterId;
    } else if (hitType === 'triple') {
      if (bases.third) scorers.push(bases.third);
      if (bases.second) scorers.push(bases.second);
      if (bases.first) scorers.push(bases.first);
      newBases.third = batterId;
    }

    return {
      newBases,
      runsScored: scorers.length,
      scoringRunners: scorers,
      batterEndsAt: hitType === 'single' ? 1 : hitType === 'double' ? 2 : 3,
      outsOnBases: 0,
    };
  }

  private static onError(bases: BaseState, batterId: string): BaserunningResult {
    const scorers: string[] = [];
    const newBases: BaseState = { first: null, second: null, third: null };

    if (bases.third) scorers.push(bases.third);
    if (bases.second) newBases.third = bases.second;
    if (bases.first) newBases.second = bases.first;
    newBases.first = batterId;

    return { newBases, runsScored: scorers.length, scoringRunners: scorers, batterEndsAt: 1, outsOnBases: 0 };
  }

  private static onDoublePlay(bases: BaseState, _outs: number): BaserunningResult {
    const newBases: BaseState = { first: null, second: null, third: null };
    const scorers: string[] = [];

    // Lead runner is out, batter is out
    if (bases.third) {
      // Runner on third stays or scores if less than 2 outs before DP
      newBases.third = bases.third;
    }
    if (bases.second && !bases.first) {
      newBases.second = bases.second;
    }
    // First is out on DP, batter out at first

    return { newBases, runsScored: scorers.length, scoringRunners: scorers, batterEndsAt: 0, outsOnBases: 1 };
  }

  private static onSacFly(bases: BaseState): BaserunningResult {
    const scorers: string[] = [];
    const newBases: BaseState = { ...bases };

    if (bases.third) {
      scorers.push(bases.third);
      newBases.third = null;
    }

    return { newBases, runsScored: scorers.length, scoringRunners: scorers, batterEndsAt: 0, outsOnBases: 0 };
  }

  private static onFieldersChoice(bases: BaseState, batterId: string): BaserunningResult {
    const newBases: BaseState = { first: null, second: null, third: null };
    const scorers: string[] = [];

    // Lead runner is out, batter reaches first
    if (bases.third) {
      // Runner on third might score
      if (bases.second) {
        newBases.third = bases.second;
      }
    } else if (bases.second) {
      // Runner on second is out
    }
    // Runner on first is forced out, batter takes first
    newBases.first = batterId;

    return { newBases, runsScored: scorers.length, scoringRunners: scorers, batterEndsAt: 1, outsOnBases: 1 };
  }

  /**
   * Attempt a stolen base.
   */
  static attemptSteal(
    runner: Player,
    pitcher: Player,
    catcher: Player | undefined,
    base: 2 | 3,
    rng: RandomProvider
  ): boolean {
    const stealRating = ratingToProb(runner.batting.steal);
    const holdRating = ratingToProb(pitcher.pitching.hold_runners);
    const armRating = catcher ? ratingToProb(catcher.fielding[0]?.arm_strength ?? 50) : 0.5;

    let successRate = 0.55 + stealRating * 0.25 - holdRating * 0.12 - armRating * 0.10;
    if (base === 3) successRate -= 0.08; // Harder to steal third

    return rng.chance(clamp(successRate, 0.35, 0.92));
  }
}

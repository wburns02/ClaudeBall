import type { Player, ContactType, OutType, HitResult, Position } from '../types/index.ts';
import type { BaseState } from '../types/game.ts';
import type { RandomProvider } from './RandomProvider.ts';
import type { ContactOutcome } from './ContactEngine.ts';
import { clamp, ratingToProb } from '../util/helpers.ts';

export interface FieldingOutcome {
  isOut: boolean;
  isError: boolean;
  outType?: OutType;
  hitResult?: HitResult;
  fieldedBy: Position;
  isDoublePlay: boolean;
  runnersAdvanceExtra: boolean; // runners advance extra base on throw
}

/**
 * Determines whether a batted ball is caught, falls for a hit, or results in an error.
 */
export class FieldingEngine {
  static resolve(
    contact: ContactOutcome,
    fielders: Map<Position, Player>,
    bases: BaseState,
    outs: number,
    rng: RandomProvider
  ): FieldingOutcome {
    const { type, distance, sprayAngle } = contact;

    // Home runs — no fielding needed
    if (type === 'fly_ball' && distance >= 340) {
      const wallDistance = this.getWallDistance(sprayAngle);
      if (distance >= wallDistance) {
        return { isOut: false, isError: false, hitResult: 'home_run', fieldedBy: this.getFielder(sprayAngle, type), isDoublePlay: false, runnersAdvanceExtra: false };
      }
    }

    const fieldPos = this.getFielder(sprayAngle, type);
    const fielder = fielders.get(fieldPos);
    const fieldingRating = fielder ? this.getFielderRange(fielder, fieldPos) : 50;

    if (type === 'popup') {
      // Popups are almost always caught
      const catchChance = 0.95 + ratingToProb(fieldingRating) * 0.04;
      if (rng.chance(catchChance)) {
        return { isOut: true, isError: false, outType: 'popout', fieldedBy: fieldPos, isDoublePlay: false, runnersAdvanceExtra: false };
      }
      return this.errorResult(fieldPos);
    }

    if (type === 'fly_ball') {
      return this.resolveFlyBall(contact, fieldPos, fielder, bases, outs, rng);
    }

    if (type === 'line_drive') {
      return this.resolveLineDrive(contact, fieldPos, fielder, bases, outs, rng);
    }

    // Ground ball
    return this.resolveGroundBall(contact, fieldPos, fielder, bases, outs, rng);
  }

  private static resolveFlyBall(
    contact: ContactOutcome,
    fieldPos: Position,
    fielder: Player | undefined,
    bases: BaseState,
    outs: number,
    rng: RandomProvider
  ): FieldingOutcome {
    const range = fielder ? this.getFielderRange(fielder, fieldPos) : 50;
    const difficulty = clamp((contact.distance - 200) / 200, 0, 1);

    let catchChance = 0.90 - difficulty * 0.4 + ratingToProb(range) * 0.25;
    catchChance = clamp(catchChance, 0.25, 0.98);

    if (rng.chance(catchChance)) {
      // Sac fly possibility
      const isSacFly = bases.third !== null && outs < 2 && contact.distance > 220;
      return {
        isOut: true,
        isError: false,
        outType: isSacFly ? 'sacrifice_fly' : 'flyout',
        fieldedBy: fieldPos,
        isDoublePlay: false,
        runnersAdvanceExtra: isSacFly,
      };
    }

    // Not caught — hit
    const hitType = contact.distance >= 300 ? 'double' as const : 'single' as const;
    return { isOut: false, isError: false, hitResult: hitType, fieldedBy: fieldPos, isDoublePlay: false, runnersAdvanceExtra: contact.distance > 280 };
  }

  private static resolveLineDrive(
    contact: ContactOutcome,
    fieldPos: Position,
    fielder: Player | undefined,
    bases: BaseState,
    outs: number,
    rng: RandomProvider
  ): FieldingOutcome {
    const range = fielder ? this.getFielderRange(fielder, fieldPos) : 50;
    const isInfield = ['P', 'C', '1B', '2B', '3B', 'SS'].includes(fieldPos);

    let catchChance: number;
    if (isInfield) {
      catchChance = 0.20 + ratingToProb(range) * 0.15;
      if (contact.isHard) catchChance -= 0.08;
    } else {
      catchChance = 0.65 + ratingToProb(range) * 0.18;
    }

    catchChance = clamp(catchChance, 0.10, 0.85);

    if (rng.chance(catchChance)) {
      // Check for line drive DP
      let dp = false;
      if (isInfield && bases.first !== null && outs < 2 && rng.chance(0.3)) {
        dp = true;
      }
      return { isOut: true, isError: false, outType: dp ? 'double_play' : 'lineout', fieldedBy: fieldPos, isDoublePlay: dp, runnersAdvanceExtra: false };
    }

    // Hit — line drives often go for extra bases
    const hitType = contact.distance >= 280 || (contact.isHard && rng.chance(0.25)) ? 'double' as const : 'single' as const;
    return { isOut: false, isError: false, hitResult: hitType, fieldedBy: fieldPos, isDoublePlay: false, runnersAdvanceExtra: contact.isHard };
  }

  private static resolveGroundBall(
    contact: ContactOutcome,
    fieldPos: Position,
    fielder: Player | undefined,
    bases: BaseState,
    outs: number,
    rng: RandomProvider
  ): FieldingOutcome {
    const range = fielder ? this.getFielderRange(fielder, fieldPos) : 50;
    const errorRate = fielder ? this.getFielderError(fielder, fieldPos) : 50;

    // Difficulty based on exit velo and position
    const difficulty = clamp((contact.exitVelo - 70) / 40, 0, 1);
    let fieldChance = 0.65 + ratingToProb(range) * 0.25 - difficulty * 0.15;
    fieldChance = clamp(fieldChance, 0.40, 0.92);

    if (!rng.chance(fieldChance)) {
      // Through the infield — hit
      return { isOut: false, isError: false, hitResult: 'single', fieldedBy: fieldPos, isDoublePlay: false, runnersAdvanceExtra: false };
    }

    // Fielded — check for error
    const errorChance = clamp(ratingToProb(errorRate) * 0.08 + difficulty * 0.03, 0.005, 0.06);
    if (rng.chance(errorChance)) {
      return this.errorResult(fieldPos);
    }

    // Check for double play
    if (bases.first !== null && outs < 2) {
      const dpChance = this.getDPChance(fielder, fieldPos, contact.exitVelo, rng);
      if (rng.chance(dpChance)) {
        return { isOut: true, isError: false, outType: 'double_play', fieldedBy: fieldPos, isDoublePlay: true, runnersAdvanceExtra: false };
      }
    }

    // Check for fielder's choice
    if (bases.first !== null && outs < 2 && rng.chance(0.25)) {
      return { isOut: true, isError: false, outType: 'fielders_choice', fieldedBy: fieldPos, isDoublePlay: false, runnersAdvanceExtra: false };
    }

    return { isOut: true, isError: false, outType: 'groundout', fieldedBy: fieldPos, isDoublePlay: false, runnersAdvanceExtra: false };
  }

  private static getDPChance(fielder: Player | undefined, _pos: Position, exitVelo: number, _rng: RandomProvider): number {
    const dpSkill = fielder ? ratingToProb(fielder.fielding[0]?.turn_dp ?? 50) : 0.5;
    const veloFactor = exitVelo > 100 ? 0.05 : exitVelo < 80 ? -0.05 : 0;
    return clamp(0.30 + dpSkill * 0.15 + veloFactor, 0.15, 0.50);
  }

  private static errorResult(fieldPos: Position): FieldingOutcome {
    return { isOut: false, isError: true, fieldedBy: fieldPos, isDoublePlay: false, runnersAdvanceExtra: true };
  }

  private static getFielder(sprayAngle: number, type: ContactType): Position {
    if (type === 'ground_ball' || (type === 'line_drive' && Math.abs(sprayAngle) < 20)) {
      if (sprayAngle < -20) return '3B';
      if (sprayAngle < -5) return 'SS';
      if (sprayAngle < 5) return 'P';
      if (sprayAngle < 20) return '2B';
      return '1B';
    }
    // Fly balls / deeper line drives
    if (sprayAngle < -25) return 'LF';
    if (sprayAngle < -8) return 'LF';
    if (sprayAngle < 8) return 'CF';
    if (sprayAngle < 25) return 'RF';
    return 'RF';
  }

  private static getWallDistance(sprayAngle: number): number {
    // Approximate wall distances by spray angle
    if (sprayAngle < -30) return 330;
    if (sprayAngle < -15) return 365;
    if (sprayAngle < 0) return 395;
    if (sprayAngle < 15) return 400;
    if (sprayAngle < 30) return 370;
    return 335;
  }

  private static getFielderRange(player: Player, pos: Position): number {
    const f = player.fielding.find(f => f.position === pos);
    return f?.range ?? 50;
  }

  private static getFielderError(player: Player, pos: Position): number {
    const f = player.fielding.find(f => f.position === pos);
    return f?.error_rate ?? 50;
  }
}

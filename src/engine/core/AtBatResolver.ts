import type { Player, Position, GameEvent } from '../types/index.ts';
import type { BaseState } from '../types/game.ts';
import type { BallparkFactors } from '../types/ballpark.ts';
import type { RandomProvider } from './RandomProvider.ts';
import { PitchEngine } from './PitchEngine.ts';
import { ContactEngine } from './ContactEngine.ts';
import { FieldingEngine } from './FieldingEngine.ts';
import { BaserunningEngine } from './BaserunningEngine.ts';
import type { BaserunningResult } from './BaserunningEngine.ts';
import { getPlayerName } from '../types/player.ts';

export interface AtBatResult {
  events: GameEvent[];
  newBases: BaseState;
  runsScored: number;
  scoringRunners: string[];
  outsRecorded: number;
  isHit: boolean;
  isWalk: boolean;
  isHBP: boolean;
  isStrikeout: boolean;
  isHomeRun: boolean;
  isSacFly: boolean;
  isDoublePlay: boolean;
  isError: boolean;
  hitType?: string;
  totalPitches: number;
}

/**
 * Composes PitchEngine → ContactEngine → FieldingEngine → BaserunningEngine
 * to resolve a complete at-bat.
 */
export class AtBatResolver {
  static resolve(
    batter: Player,
    pitcher: Player,
    fielders: Map<Position, Player>,
    bases: BaseState,
    outs: number,
    ballpark: BallparkFactors,
    rng: RandomProvider
  ): AtBatResult {
    const events: GameEvent[] = [];
    let balls = 0;
    let strikes = 0;
    let totalPitches = 0;
    const batterName = getPlayerName(batter);
    const pitcherName = getPlayerName(pitcher);

    // Pitch-by-pitch loop
    while (true) {
      totalPitches++;
      const pitch = PitchEngine.throw(pitcher, batter, balls, strikes, rng);

      if (pitch.result === 'ball') {
        balls++;
        events.push({ type: 'pitch', description: `Ball ${balls}`, balls, strikes, result: 'ball' });

        if (balls >= 4) {
          // Walk
          const brResult = this.walkAdvance(bases, batter.id);
          events.push({
            type: 'at_bat_result',
            description: `${batterName} walks`,
            batter: batterName,
            pitcher: pitcherName,
            result: 'walk',
            rbiCount: brResult.runsScored,
          });
          return {
            events, newBases: brResult.newBases, runsScored: brResult.runsScored,
            scoringRunners: brResult.scoringRunners, outsRecorded: 0,
            isHit: false, isWalk: true, isHBP: false, isStrikeout: false,
            isHomeRun: false, isSacFly: false, isDoublePlay: false, isError: false,
            totalPitches,
          };
        }
        continue;
      }

      if (pitch.result === 'called_strike' || pitch.result === 'swinging_strike') {
        strikes++;
        const desc = pitch.result === 'called_strike'
          ? `Called strike ${strikes}`
          : `Swinging strike ${strikes}`;
        events.push({ type: 'pitch', description: desc, balls, strikes, result: pitch.result });

        if (strikes >= 3) {
          const soType = pitch.result === 'called_strike' ? 'strikeout_looking' : 'strikeout_swinging';
          events.push({
            type: 'at_bat_result',
            description: pitch.result === 'called_strike'
              ? `${batterName} called out on strikes`
              : `${batterName} strikes out swinging`,
            batter: batterName, pitcher: pitcherName,
            result: soType, rbiCount: 0,
          });
          return {
            events, newBases: { ...bases }, runsScored: 0, scoringRunners: [],
            outsRecorded: 1, isHit: false, isWalk: false, isHBP: false,
            isStrikeout: true, isHomeRun: false, isSacFly: false,
            isDoublePlay: false, isError: false, totalPitches,
          };
        }
        continue;
      }

      if (pitch.result === 'foul') {
        if (strikes < 2) strikes++;
        events.push({ type: 'pitch', description: `Foul ball (${balls}-${strikes})`, balls, strikes, result: 'foul' });
        continue;
      }

      // Contact!
      events.push({ type: 'pitch', description: `${batterName} puts it in play`, balls, strikes, result: 'contact' });

      const contact = ContactEngine.resolve(batter, pitcher, pitch.pitchType, ballpark, rng);
      const fieldingResult = FieldingEngine.resolve(contact, fielders, bases, outs, rng);

      if (fieldingResult.isError) {
        const fielderName = this.getFielderName(fielders, fieldingResult.fieldedBy);
        events.push({ type: 'error', description: `Error by ${fielderName} (${fieldingResult.fieldedBy})`, fielder: fielderName });
      }

      const brResult = BaserunningEngine.advanceRunners(bases, batter.id, fieldingResult, outs, rng);
      const outsRecorded = (fieldingResult.isOut ? 1 : 0) + brResult.outsOnBases;

      // Build description
      const desc = this.buildPlayDescription(batterName, contact, fieldingResult, brResult, fielders);
      events.push({
        type: 'at_bat_result',
        description: desc,
        batter: batterName,
        pitcher: pitcherName,
        result: fieldingResult.hitResult ?? fieldingResult.outType ?? 'out',
        rbiCount: brResult.runsScored,
      });

      return {
        events,
        newBases: brResult.newBases,
        runsScored: brResult.runsScored,
        scoringRunners: brResult.scoringRunners,
        outsRecorded,
        isHit: !!fieldingResult.hitResult,
        isWalk: false,
        isHBP: false,
        isStrikeout: false,
        isHomeRun: fieldingResult.hitResult === 'home_run',
        isSacFly: fieldingResult.outType === 'sacrifice_fly',
        isDoublePlay: fieldingResult.isDoublePlay,
        isError: fieldingResult.isError,
        hitType: fieldingResult.hitResult,
        totalPitches,
      };
    }
  }

  private static walkAdvance(bases: BaseState, batterId: string): BaserunningResult {
    const newBases: BaseState = { first: null, second: null, third: null };
    const scorers: string[] = [];

    if (bases.first && bases.second && bases.third) {
      // Bases loaded walk
      scorers.push(bases.third);
      newBases.third = bases.second;
      newBases.second = bases.first;
      newBases.first = batterId;
    } else if (bases.first && bases.second) {
      newBases.third = bases.second;
      newBases.second = bases.first;
      newBases.first = batterId;
    } else if (bases.first) {
      newBases.second = bases.first;
      newBases.first = batterId;
    } else {
      newBases.first = batterId;
      newBases.second = bases.second;
      newBases.third = bases.third;
    }

    return { newBases, runsScored: scorers.length, scoringRunners: scorers, batterEndsAt: 1, outsOnBases: 0 };
  }

  private static buildPlayDescription(
    batterName: string,
    contact: { type: string; distance: number; exitVelo: number },
    fielding: { isOut: boolean; hitResult?: string; outType?: string; fieldedBy: string; isDoublePlay: boolean; isError: boolean },
    br: BaserunningResult,
    _fielders: Map<Position, Player>
  ): string {
    if (fielding.isError) {
      return `${batterName} reaches on error by ${fielding.fieldedBy}`;
    }
    if (fielding.hitResult === 'home_run') {
      const prefix = br.runsScored > 1 ? `${br.runsScored}-run` : 'solo';
      return `${batterName} hits a ${prefix} home run! (${contact.distance} ft)`;
    }
    if (fielding.hitResult === 'triple') {
      return `${batterName} triples to ${fielding.fieldedBy}`;
    }
    if (fielding.hitResult === 'double') {
      return `${batterName} doubles to ${fielding.fieldedBy}`;
    }
    if (fielding.hitResult === 'single') {
      return `${batterName} singles to ${fielding.fieldedBy}`;
    }
    if (fielding.isDoublePlay) {
      return `${batterName} grounds into a double play`;
    }
    if (fielding.outType === 'sacrifice_fly') {
      return `${batterName} hits a sacrifice fly to ${fielding.fieldedBy}`;
    }
    if (fielding.outType === 'flyout') {
      return `${batterName} flies out to ${fielding.fieldedBy}`;
    }
    if (fielding.outType === 'lineout') {
      return `${batterName} lines out to ${fielding.fieldedBy}`;
    }
    if (fielding.outType === 'popout') {
      return `${batterName} pops out to ${fielding.fieldedBy}`;
    }
    if (fielding.outType === 'groundout') {
      return `${batterName} grounds out to ${fielding.fieldedBy}`;
    }
    if (fielding.outType === 'fielders_choice') {
      return `${batterName} reaches on a fielder's choice`;
    }
    return `${batterName} is out`;
  }

  private static getFielderName(fielders: Map<Position, Player>, pos: Position | string): string {
    const p = fielders.get(pos as Position);
    return p ? getPlayerName(p) : pos;
  }
}

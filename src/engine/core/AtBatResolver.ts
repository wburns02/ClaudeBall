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
  /**
   * Execute an intentional walk — 4 automatic balls.
   */
  static resolveIntentionalWalk(
    batter: Player,
    pitcher: Player,
    bases: BaseState,
    _rng: RandomProvider
  ): AtBatResult {
    const batterName = getPlayerName(batter);
    const pitcherName = getPlayerName(pitcher);
    const brResult = this.walkAdvance(bases, batter.id);
    const ev: GameEvent = {
      type: 'at_bat_result',
      description: `${batterName} is intentionally walked`,
      batter: batterName,
      pitcher: pitcherName,
      result: 'walk',
      rbiCount: brResult.runsScored,
    };
    return {
      events: [ev], newBases: brResult.newBases, runsScored: brResult.runsScored,
      scoringRunners: brResult.scoringRunners, outsRecorded: 0,
      isHit: false, isWalk: true, isHBP: false, isStrikeout: false,
      isHomeRun: false, isSacFly: false, isDoublePlay: false, isError: false,
      totalPitches: 4, // 4 pitches counted for intentional walk
    };
  }

  /**
   * Execute a sacrifice bunt. The batter makes contact, runner(s) advance.
   * Batter is out at first unless fielding error. Count as SH (sacrifice hit).
   */
  static resolveSacBunt(
    batter: Player,
    pitcher: Player,
    bases: BaseState,
    outs: number,
    rng: RandomProvider
  ): AtBatResult {
    const batterName = getPlayerName(batter);
    const pitcherName = getPlayerName(pitcher);
    // Bunt skill: higher bunt rating = higher success rate
    const buntSkill = batter.batting.bunt / 100;
    // Base 85% success + bunt skill modifier
    const successChance = 0.78 + buntSkill * 0.18;
    const success = rng.chance(successChance);

    const newBases: BaseState = { first: null, second: null, third: null };
    const scorers: string[] = [];

    if (success) {
      // Standard sac bunt: runner from 2nd to 3rd, runner from 1st to 2nd
      if (bases.third) scorers.push(bases.third); // runner on 3rd scores
      if (bases.second) newBases.third = bases.second;
      if (bases.first) newBases.second = bases.first;
      // Batter is out at first (no base reached)
      const ev: GameEvent = {
        type: 'at_bat_result',
        description: `${batterName} sacrifice bunt — runners advance`,
        batter: batterName,
        pitcher: pitcherName,
        result: 'sacrifice_bunt',
        rbiCount: scorers.length,
      };
      return {
        events: [ev], newBases, runsScored: scorers.length,
        scoringRunners: scorers, outsRecorded: 1,
        isHit: false, isWalk: false, isHBP: false, isStrikeout: false,
        isHomeRun: false, isSacFly: false, isDoublePlay: false, isError: false,
        totalPitches: 2,
      };
    } else {
      // Failed bunt — treated as a foul ball / pop-up out
      if (bases.second) newBases.second = bases.second; // runners don't advance on popout
      if (bases.first) newBases.first = bases.first;
      if (bases.third) newBases.third = bases.third;
      const ev: GameEvent = {
        type: 'at_bat_result',
        description: `${batterName} pops up the bunt — out`,
        batter: batterName,
        pitcher: pitcherName,
        result: 'popout',
        rbiCount: 0,
      };
      return {
        events: [ev], newBases, runsScored: 0,
        scoringRunners: [], outsRecorded: 1,
        isHit: false, isWalk: false, isHBP: false, isStrikeout: false,
        isHomeRun: false, isSacFly: false, isDoublePlay: false, isError: false,
        totalPitches: 2,
      };
    }
    // suppress TS no-return: all paths above return
  }

  static resolve(
    batter: Player,
    pitcher: Player,
    fielders: Map<Position, Player>,
    bases: BaseState,
    outs: number,
    ballpark: BallparkFactors,
    rng: RandomProvider,
    /** If true, batter will attempt a sacrifice bunt */
    isBuntMode: boolean = false,
    /** If true, pitcher will issue an intentional walk */
    isIntentionalWalk: boolean = false,
    /** Team chemistry modifier from dynasty ECS (-10 to +10). Applied in clutch situations. */
    clutchModifier: number = 0
  ): AtBatResult {
    // ── Intentional Walk ──────────────────────────────────────────────────
    if (isIntentionalWalk) {
      return this.resolveIntentionalWalk(batter, pitcher, bases, rng);
    }

    // ── Sacrifice Bunt ────────────────────────────────────────────────────
    if (isBuntMode && outs < 2) {
      return this.resolveSacBunt(batter, pitcher, bases, outs, rng);
    }

    const events: GameEvent[] = [];
    let balls = 0;
    let strikes = 0;
    let totalPitches = 0;
    const batterName = getPlayerName(batter);
    const pitcherName = getPlayerName(pitcher);
    // Mutable copy so wild pitches can advance runners during the at-bat
    let currentBases: BaseState = { ...bases };

    // Pitch-by-pitch loop
    while (true) {
      totalPitches++;
      const pitch = PitchEngine.throw(pitcher, batter, balls, strikes, rng);

      // ── Hit By Pitch ──────────────────────────────────────────────────────
      if (pitch.isHBP) {
        const brResult = this.walkAdvance(currentBases, batter.id); // HBP advances runners same as walk
        events.push({
          type: 'at_bat_result',
          description: `${batterName} hit by pitch`,
          batter: batterName,
          pitcher: pitcherName,
          result: 'hit_by_pitch',
          rbiCount: brResult.runsScored,
        });
        return {
          events, newBases: brResult.newBases, runsScored: brResult.runsScored,
          scoringRunners: brResult.scoringRunners, outsRecorded: 0,
          isHit: false, isWalk: false, isHBP: true, isStrikeout: false,
          isHomeRun: false, isSacFly: false, isDoublePlay: false, isError: false,
          totalPitches,
        };
      }

      if (pitch.result === 'ball') {
        balls++;

        // ── Wild Pitch / Passed Ball (~2% of in-the-dirt pitches) ─────────
        // Runners advance one base on a wild pitch. At-bat continues.
        if (pitch.isInDirt && (currentBases.first !== null || currentBases.second !== null || currentBases.third !== null)) {
          const catcher = fielders.get('C');
          const catcherBlock = catcher ? (catcher.fielding.find(f => f.position === 'C')?.range ?? 50) / 100 : 0.5;
          // ~2% chance of wild pitch, reduced by catcher's blocking ability
          if (rng.chance(0.02) && !rng.chance(catcherBlock * 0.60)) {
            // Advance all runners one base (batter stays at bat)
            let wpRuns = 0;
            const afterWP: BaseState = { first: null, second: null, third: null };
            if (currentBases.third) wpRuns++;                // runner on 3rd scores
            if (currentBases.second) afterWP.third = currentBases.second;
            if (currentBases.first) afterWP.second = currentBases.first;
            // batter's base slot (first) stays vacant since batter is still at bat
            currentBases = afterWP;
            events.push({
              type: 'baserunning',
              description: `Wild pitch — runners advance${wpRuns > 0 ? ', run scores' : ''}`,
              runner: 'all',
            });
          }
        }

        events.push({ type: 'pitch', description: `Ball ${balls}`, balls, strikes, result: 'ball' });

        if (balls >= 4) {
          // Walk
          const brResult = this.walkAdvance(currentBases, batter.id);
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
            events, newBases: { ...currentBases }, runsScored: 0, scoringRunners: [],
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

      // Apply chemistry modifier in clutch situations (runners on base)
      const isClutchSituation = currentBases.first || currentBases.second || currentBases.third;
      let contactBatter = batter;
      if (isClutchSituation && clutchModifier !== 0) {
        // Temporarily boost/reduce effective morale to influence contact quality
        contactBatter = {
          ...batter,
          state: { ...batter.state, morale: Math.max(0, Math.min(100, batter.state.morale + clutchModifier * 3)) },
        };
      }

      const contact = ContactEngine.resolve(contactBatter, pitcher, pitch.pitchType, ballpark, rng);
      const fieldingResult = FieldingEngine.resolve(contact, fielders, currentBases, outs, rng);

      if (fieldingResult.isError) {
        const fielderName = this.getFielderName(fielders, fieldingResult.fieldedBy);
        events.push({ type: 'error', description: `Error by ${fielderName} (${fieldingResult.fieldedBy})`, fielder: fielderName });
      }

      const brResult = BaserunningEngine.advanceRunners(currentBases, batter.id, fieldingResult, outs, rng);
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

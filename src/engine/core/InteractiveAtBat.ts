import type { Player, Position } from '../types/index.ts';
import type { BaseState, GameEvent } from '../types/game.ts';
import type { BallparkFactors } from '../types/ballpark.ts';
import type { RandomProvider } from './RandomProvider.ts';
import type {
  UserSwingInput,
  UserPitchInput,
  PitchStepResult,
  PitchAnimationData,
  SwingTiming,
  SwingType,
} from '../types/interactive.ts';
import { PitchEngine } from './PitchEngine.ts';
import type { PitchOutcome } from './PitchEngine.ts';
import { ContactEngine } from './ContactEngine.ts';
import { FieldingEngine } from './FieldingEngine.ts';
import { BaserunningEngine } from './BaserunningEngine.ts';
import type { AtBatResult } from './AtBatResolver.ts';
import { getPlayerName } from '../types/player.ts';
import { clamp, ratingToProb } from '../util/helpers.ts';
import type { PitchType } from '../types/enums.ts';

/**
 * State machine for a single at-bat that resolves ONE pitch at a time.
 * Accepts optional user input (swing/take or pitch selection) per pitch.
 */
export class InteractiveAtBat {
  private batter: Player;
  private pitcher: Player;
  private fielders: Map<Position, Player>;
  private bases: BaseState;
  private outs: number;
  private ballpark: BallparkFactors;
  private rng: RandomProvider;

  private balls = 0;
  private strikes = 0;
  private totalPitches = 0;
  private done = false;
  private abResult: AtBatResult | null = null;

  constructor(
    batter: Player,
    pitcher: Player,
    fielders: Map<Position, Player>,
    bases: BaseState,
    outs: number,
    ballpark: BallparkFactors,
    rng: RandomProvider
  ) {
    this.batter = batter;
    this.pitcher = pitcher;
    this.fielders = fielders;
    this.bases = bases;
    this.outs = outs;
    this.ballpark = ballpark;
    this.rng = rng;
  }

  getCount(): { balls: number; strikes: number } {
    return { balls: this.balls, strikes: this.strikes };
  }

  isComplete(): boolean {
    return this.done;
  }

  getResult(): AtBatResult | null {
    return this.abResult;
  }

  /**
   * Resolve exactly ONE pitch.
   * - If UserPitchInput: user chose the pitch type and target zone.
   * - If UserSwingInput: user chose swing/take and timing.
   * - If undefined: full CPU resolution (existing logic).
   */
  resolvePitch(userInput?: UserSwingInput | UserPitchInput): PitchStepResult {
    if (this.done) {
      throw new Error('InteractiveAtBat: at-bat is already complete');
    }

    this.totalPitches++;
    const events: GameEvent[] = [];
    const batterName = getPlayerName(this.batter);
    const pitcherName = getPlayerName(this.pitcher);

    // ── Determine pitch (type, velocity, location, swing) ───────────────────
    let pitchOutcome: PitchOutcome;

    if (userInput && 'pitchType' in userInput) {
      // User is PITCHING — override pitch type and location
      pitchOutcome = this.buildUserPitch(userInput);
    } else if (userInput && 'action' in userInput) {
      // User is BATTING — override swing/take decision
      pitchOutcome = this.buildUserSwing(userInput);
    } else {
      // Full CPU
      pitchOutcome = PitchEngine.throw(
        this.pitcher, this.batter,
        this.balls, this.strikes, this.rng
      );
    }

    const { result, pitchType, velocity, inZone, swung } = pitchOutcome;

    // ── Process result ───────────────────────────────────────────────────────
    let atBatOver = false;
    let atBatResult: AtBatResult | undefined;

    if (result === 'ball') {
      this.balls++;
      events.push({
        type: 'pitch',
        description: `Ball ${this.balls}`,
        balls: this.balls,
        strikes: this.strikes,
        result: 'ball',
        pitchType,
        velocity,
      });

      if (this.balls >= 4) {
        // Walk
        const brResult = this.walkAdvance();
        events.push({
          type: 'at_bat_result',
          description: `${batterName} walks`,
          batter: batterName,
          pitcher: pitcherName,
          result: 'walk',
          rbiCount: brResult.runsScored,
        });
        atBatResult = this.buildWalkResult(events, brResult);
        atBatOver = true;
      }
    } else if (result === 'called_strike' || result === 'swinging_strike') {
      this.strikes++;
      const desc = result === 'called_strike'
        ? `Called strike ${this.strikes}`
        : `Swinging strike ${this.strikes}`;
      events.push({
        type: 'pitch',
        description: desc,
        balls: this.balls,
        strikes: this.strikes,
        result,
        pitchType,
        velocity,
      });

      if (this.strikes >= 3) {
        const soType = result === 'called_strike' ? 'strikeout_looking' : 'strikeout_swinging';
        events.push({
          type: 'at_bat_result',
          description: result === 'called_strike'
            ? `${batterName} called out on strikes`
            : `${batterName} strikes out swinging`,
          batter: batterName,
          pitcher: pitcherName,
          result: soType,
          rbiCount: 0,
        });
        atBatResult = this.buildStrikeoutResult(events);
        atBatOver = true;
      }
    } else if (result === 'foul') {
      if (this.strikes < 2) this.strikes++;
      events.push({
        type: 'pitch',
        description: `Foul ball (${this.balls}-${this.strikes})`,
        balls: this.balls,
        strikes: this.strikes,
        result: 'foul',
        pitchType,
        velocity,
      });
    } else if (result === 'contact') {
      // Contact — apply swing-type modifiers if batting input was provided
      events.push({
        type: 'pitch',
        description: `${batterName} puts it in play`,
        balls: this.balls,
        strikes: this.strikes,
        result: 'contact',
        pitchType,
        velocity,
      });

      const timingMod = userInput && 'action' in userInput && userInput.action === 'swing'
        ? this.getTimingModifiers(userInput.timing)
        : { contactMod: 0, exitVeloMod: 0, launchMod: 0 };

      const swingTypeMod = userInput && 'action' in userInput && userInput.swingType
        ? this.getSwingTypeModifiers(userInput.swingType)
        : { contactMod: 0, exitVeloMod: 0, launchMod: 0 };

      const isBunt = userInput && 'action' in userInput && userInput.swingType === 'bunt';

      const contact = isBunt
        ? this.resolveBunt()
        : ContactEngine.resolve(
            this.batter, this.pitcher, pitchType, this.ballpark, this.rng
          );

      if (!isBunt) {
        // Apply modifiers by tweaking the contact result
        const totalContactMod = timingMod.contactMod + swingTypeMod.contactMod;
        const totalExitVeloMod = timingMod.exitVeloMod + swingTypeMod.exitVeloMod;
        const totalLaunchMod = timingMod.launchMod + swingTypeMod.launchMod;

        // Re-roll contact probability with modifier applied
        if (totalContactMod !== 0) {
          // If the modifier is negative enough, turn contact into a foul/miss
          const penalty = -totalContactMod; // positive = bad
          if (penalty > 0 && this.rng.chance(penalty)) {
            // Miss — swinging strike or foul
            const isFoul = this.rng.chance(0.55);
            const missResult = isFoul ? 'foul' : 'swinging_strike';
            if (isFoul) {
              if (this.strikes < 2) this.strikes++;
              events.splice(-1, 1); // remove the "puts it in play" event
              events.push({
                type: 'pitch',
                description: `Foul ball (${this.balls}-${this.strikes})`,
                balls: this.balls,
                strikes: this.strikes,
                result: missResult,
        pitchType,
        velocity,
              });
            } else {
              this.strikes++;
              events.splice(-1, 1);
              events.push({
                type: 'pitch',
                description: `Swinging strike ${this.strikes}`,
                balls: this.balls,
                strikes: this.strikes,
                result: missResult,
        pitchType,
        velocity,
              });
              if (this.strikes >= 3) {
                events.push({
                  type: 'at_bat_result',
                  description: `${batterName} strikes out swinging`,
                  batter: batterName,
                  pitcher: pitcherName,
                  result: 'strikeout_swinging',
                  rbiCount: 0,
                });
                atBatResult = this.buildStrikeoutResult(events);
                atBatOver = true;
              }
            }

            const animData: PitchAnimationData = this.buildAnimData(
              pitchType, velocity, inZone, swung, null, null
            );
            if (atBatOver && atBatResult) {
              this.done = true;
              this.abResult = atBatResult;
            }
            return {
              pitchOutcome,
              count: { balls: this.balls, strikes: this.strikes },
              atBatOver,
              atBatResult,
              animationData: animData,
              events,
            };
          }
        }

        // Apply numeric modifiers to contact outcome
        const modifiedContact = {
          ...contact,
          exitVelo: clamp(contact.exitVelo + totalExitVeloMod, 55, 115),
          launchAngle: clamp(contact.launchAngle + totalLaunchMod, -30, 75),
        };

        const fieldingResult = FieldingEngine.resolve(
          modifiedContact, this.fielders, this.bases, this.outs, this.rng
        );

        if (fieldingResult.isError) {
          const fielderName = this.getFielderName(fieldingResult.fieldedBy as Position);
          events.push({
            type: 'error',
            description: `Error by ${fielderName} (${fieldingResult.fieldedBy})`,
            fielder: fielderName,
          });
        }

        const brResult = BaserunningEngine.advanceRunners(
          this.bases, this.batter.id, fieldingResult, this.outs, this.rng
        );
        const outsRecorded = (fieldingResult.isOut ? 1 : 0) + brResult.outsOnBases;
        const desc = this.buildPlayDescription(batterName, modifiedContact, fieldingResult, brResult);

        events.push({
          type: 'at_bat_result',
          description: desc,
          batter: batterName,
          pitcher: pitcherName,
          result: fieldingResult.hitResult ?? fieldingResult.outType ?? 'out',
          rbiCount: brResult.runsScored,
        });

        atBatResult = {
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
          totalPitches: this.totalPitches,
        };
        atBatOver = true;

        const animData: PitchAnimationData = this.buildAnimData(
          pitchType, velocity, inZone, swung, modifiedContact, fieldingResult
        );

        this.done = true;
        this.abResult = atBatResult;

        return {
          pitchOutcome,
          count: { balls: this.balls, strikes: this.strikes },
          atBatOver: true,
          atBatResult,
          animationData: animData,
          events,
        };
      } else {
        // Bunt resolution
        const fieldingResult = FieldingEngine.resolve(
          contact, this.fielders, this.bases, this.outs, this.rng
        );

        const brResult = BaserunningEngine.advanceRunners(
          this.bases, this.batter.id, fieldingResult, this.outs, this.rng
        );
        const outsRecorded = (fieldingResult.isOut ? 1 : 0) + brResult.outsOnBases;
        const desc = this.buildPlayDescription(batterName, contact, fieldingResult, brResult);

        events.push({
          type: 'at_bat_result',
          description: desc,
          batter: batterName,
          pitcher: pitcherName,
          result: fieldingResult.hitResult ?? fieldingResult.outType ?? 'out',
          rbiCount: brResult.runsScored,
        });

        atBatResult = {
          events,
          newBases: brResult.newBases,
          runsScored: brResult.runsScored,
          scoringRunners: brResult.scoringRunners,
          outsRecorded,
          isHit: !!fieldingResult.hitResult,
          isWalk: false,
          isHBP: false,
          isStrikeout: false,
          isHomeRun: false,
          isSacFly: false,
          isDoublePlay: fieldingResult.isDoublePlay,
          isError: fieldingResult.isError,
          hitType: fieldingResult.hitResult,
          totalPitches: this.totalPitches,
        };
        atBatOver = true;

        const animData: PitchAnimationData = this.buildAnimData(
          pitchType, velocity, inZone, swung, contact, fieldingResult
        );

        this.done = true;
        this.abResult = atBatResult;

        return {
          pitchOutcome,
          count: { balls: this.balls, strikes: this.strikes },
          atBatOver: true,
          atBatResult,
          animationData: animData,
          events,
        };
      }
    }

    if (atBatOver && atBatResult) {
      this.done = true;
      this.abResult = atBatResult;
    }

    const animData: PitchAnimationData = this.buildAnimData(
      pitchType, velocity, inZone, swung, null, null
    );

    return {
      pitchOutcome,
      count: { balls: this.balls, strikes: this.strikes },
      atBatOver,
      atBatResult,
      animationData: animData,
      events,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Build pitch outcome from user pitcher input.
   * Maps 5×5 grid to in-zone status and applies control-based scatter.
   */
  private buildUserPitch(input: UserPitchInput): PitchOutcome {
    const { pitchType, targetZone, meterAccuracy = 0.7 } = input;

    // Inner 3×3 (rows 1-3, cols 1-3) = in zone on a 0-4 grid
    const isTargetingZone = targetZone.row >= 1 && targetZone.row <= 3
      && targetZone.col >= 1 && targetZone.col <= 3;

    // Control scatter: good control + good meter = lands near target
    const control = ratingToProb(this.pitcher.pitching.control);
    const accuracy = control * 0.5 + meterAccuracy * 0.5;
    const scatterChance = clamp(1 - accuracy, 0.05, 0.60);

    // Whether the ball actually ends up in zone
    let inZone: boolean;
    if (isTargetingZone) {
      // Pitcher aimed inside zone; might scatter out
      inZone = !this.rng.chance(scatterChance * 0.7);
    } else {
      // Pitcher aimed outside zone; might accidentally come in
      inZone = this.rng.chance(scatterChance * 0.3);
    }

    const velocity = this.calculateVelocity(pitchType);
    const fatiguePenalty = (this.pitcher.state.fatigue / 100) * 4;
    const adjVelocity = Math.round(clamp(velocity - fatiguePenalty, 60, 105));

    // Determine batter swing/take using existing PitchEngine logic
    const swung = this.determineBatterSwing(inZone);

    let resultStr: 'ball' | 'called_strike' | 'swinging_strike' | 'foul' | 'contact';
    if (!swung) {
      resultStr = inZone ? 'called_strike' : 'ball';
    } else if (!inZone) {
      const chaseContact = clamp(0.48 + ratingToProb(this.getBatterContactRating()) * 0.18 - ratingToProb(this.pitcher.pitching.stuff) * 0.08, 0.38, 0.72);
      if (this.rng.chance(chaseContact)) {
        resultStr = this.rng.chance(0.65) ? 'foul' : 'contact';
      } else {
        resultStr = 'swinging_strike';
      }
    } else {
      const contactRating = this.getBatterContactRating();
      const stuffPenalty = ratingToProb(this.pitcher.pitching.stuff) * 0.06;
      const contactChance = clamp(ratingToProb(contactRating) * 0.15 + 0.78 - stuffPenalty, 0.72, 0.95);
      if (this.rng.chance(contactChance)) {
        const foulChance = this.strikes === 2 ? 0.45 : 0.38;
        resultStr = this.rng.chance(foulChance) ? 'foul' : 'contact';
      } else {
        resultStr = 'swinging_strike';
      }
    }

    return {
      pitchType,
      result: resultStr,
      velocity: adjVelocity,
      inZone,
      swung,
      isInDirt: false,
      isHBP: false,
    };
  }

  /**
   * Build pitch outcome from user batter input (swing/take + timing).
   * Uses PitchEngine for pitch selection but overrides the swing decision.
   */
  private buildUserSwing(input: UserSwingInput): PitchOutcome {
    const cpuPitch = PitchEngine.throw(
      this.pitcher, this.batter,
      this.balls, this.strikes, this.rng
    );

    if (input.action === 'take') {
      // User takes — result is based purely on whether pitch is in zone
      return {
        ...cpuPitch,
        swung: false,
        result: cpuPitch.inZone ? 'called_strike' : 'ball',
      };
    }

    // User swings — determine contact based on pitch + timing
    const timingMod = this.getTimingModifiers(input.timing);
    const swingTypeMod = this.getSwingTypeModifiers(input.swingType ?? 'normal');
    const totalContactMod = timingMod.contactMod + swingTypeMod.contactMod;

    let contactChance: number;
    if (!cpuPitch.inZone) {
      // Chase swing
      const base = clamp(0.48 + ratingToProb(this.getBatterContactRating()) * 0.18 - ratingToProb(this.pitcher.pitching.stuff) * 0.08, 0.38, 0.72);
      contactChance = clamp(base + totalContactMod, 0.20, 0.85);
    } else {
      const stuffPenalty = ratingToProb(this.pitcher.pitching.stuff) * 0.06;
      const base = clamp(ratingToProb(this.getBatterContactRating()) * 0.15 + 0.78 - stuffPenalty, 0.72, 0.95);
      contactChance = clamp(base + totalContactMod, 0.30, 0.98);
    }

    let resultStr: 'swinging_strike' | 'foul' | 'contact';
    if (this.rng.chance(contactChance)) {
      // Made contact — bunt always produces contact
      if (input.swingType === 'bunt') {
        resultStr = 'contact';
      } else {
        const foulChance = this.strikes === 2 ? 0.45 : 0.38;
        resultStr = this.rng.chance(foulChance) ? 'foul' : 'contact';
      }
    } else {
      resultStr = 'swinging_strike';
    }

    return {
      ...cpuPitch,
      swung: true,
      result: resultStr,
    };
  }

  /** Timing effect on contact probability and ball flight */
  private getTimingModifiers(timing?: SwingTiming): { contactMod: number; exitVeloMod: number; launchMod: number } {
    switch (timing) {
      case 'perfect':     return { contactMod: +0.05,  exitVeloMod: +3, launchMod: 0 };
      case 'early':       return { contactMod: -0.02,  exitVeloMod: -2, launchMod: -3 };
      case 'late':        return { contactMod: -0.02,  exitVeloMod: -2, launchMod: +3 };
      case 'very_early':  return { contactMod: -0.08,  exitVeloMod: -5, launchMod: -6 };
      case 'very_late':   return { contactMod: -0.08,  exitVeloMod: -5, launchMod: +6 };
      default:            return { contactMod: 0,      exitVeloMod: 0,  launchMod: 0 };
    }
  }

  /** Swing type effect on ball flight */
  private getSwingTypeModifiers(swingType: SwingType): { contactMod: number; exitVeloMod: number; launchMod: number } {
    switch (swingType) {
      case 'power':   return { contactMod: -0.06, exitVeloMod: +4,  launchMod: +8 };
      case 'contact': return { contactMod: +0.05, exitVeloMod: -3,  launchMod: -4 };
      case 'bunt':    return { contactMod: +0.10, exitVeloMod: -15, launchMod: -15 };
      default:        return { contactMod: 0,     exitVeloMod: 0,   launchMod: 0 };
    }
  }

  /** Produce a bunt-style contact outcome (ground ball, short distance) */
  private resolveBunt(): import('./ContactEngine.ts').ContactOutcome {
    return {
      type: 'ground_ball',
      exitVelo: this.rng.nextInt(45, 65),
      launchAngle: this.rng.nextInt(-10, 5),
      sprayAngle: this.rng.nextFloat(-15, 15),
      distance: this.rng.nextInt(20, 60),
      isHard: false,
    };
  }

  private determineBatterSwing(inZone: boolean): boolean {
    const eye = ratingToProb(this.batter.batting.eye);
    const deception = ratingToProb(this.pitcher.pitching.movement) * 0.08;
    if (inZone) {
      let swingRate = 0.60 + eye * 0.08 - deception;
      if (this.strikes === 2) swingRate += 0.12;
      if (this.balls === 3) swingRate += 0.10;
      return this.rng.chance(clamp(swingRate, 0.52, 0.85));
    } else {
      let chaseRate = 0.30 - eye * 0.12 + deception;
      if (this.strikes === 2) chaseRate += 0.08;
      if (this.balls === 3 && this.strikes < 2) chaseRate -= 0.10;
      return this.rng.chance(clamp(chaseRate, 0.14, 0.40));
    }
  }

  private getBatterContactRating(): number {
    return this.pitcher.throws === 'L'
      ? this.batter.batting.contact_L
      : this.batter.batting.contact_R;
  }

  private calculateVelocity(pitchType: PitchType): number {
    const base = this.pitcher.pitching.velocity;
    const variance = this.rng.nextGaussian(0, 1.2);
    const typeAdjust: Record<PitchType, number> = {
      fastball: 0, sinker: -2, cutter: -3, slider: -7,
      curveball: -12, changeup: -10, splitter: -6, knuckleball: -18,
    };
    return Math.round(clamp(base + (typeAdjust[pitchType] ?? 0) + variance, 60, 105));
  }

  private buildAnimData(
    pitchType: PitchType,
    velocity: number,
    inZone: boolean,
    swung: boolean,
    contact: import('./ContactEngine.ts').ContactOutcome | null,
    fielding: import('./FieldingEngine.ts').FieldingOutcome | null
  ): PitchAnimationData {
    const startPos = { x: 0.5, y: 0.85 }; // pitcher's mound (normalized 0-1)
    const endPos = { x: 0.5, y: 0.15 };   // home plate

    return {
      pitchType,
      velocity,
      startPos,
      endPos,
      inZone,
      swung,
      contactData: contact && fielding ? {
        type: contact.type,
        exitVelo: contact.exitVelo,
        launchAngle: contact.launchAngle,
        sprayAngle: contact.sprayAngle,
        distance: contact.distance,
        fieldedBy: fielding.fieldedBy as Position,
        isOut: fielding.isOut,
        hitResult: fielding.hitResult,
      } : undefined,
    };
  }

  private walkAdvance(): import('./BaserunningEngine.ts').BaserunningResult {
    const newBases = { first: null as string | null, second: null as string | null, third: null as string | null };
    const scorers: string[] = [];

    if (this.bases.first && this.bases.second && this.bases.third) {
      scorers.push(this.bases.third);
      newBases.third = this.bases.second;
      newBases.second = this.bases.first;
      newBases.first = this.batter.id;
    } else if (this.bases.first && this.bases.second) {
      newBases.third = this.bases.second;
      newBases.second = this.bases.first;
      newBases.first = this.batter.id;
    } else if (this.bases.first) {
      newBases.second = this.bases.first;
      newBases.first = this.batter.id;
      newBases.third = this.bases.third;
    } else {
      newBases.first = this.batter.id;
      newBases.second = this.bases.second;
      newBases.third = this.bases.third;
    }

    return { newBases, runsScored: scorers.length, scoringRunners: scorers, batterEndsAt: 1, outsOnBases: 0 };
  }

  private buildWalkResult(
    events: GameEvent[],
    brResult: import('./BaserunningEngine.ts').BaserunningResult
  ): AtBatResult {
    return {
      events,
      newBases: brResult.newBases,
      runsScored: brResult.runsScored,
      scoringRunners: brResult.scoringRunners,
      outsRecorded: 0,
      isHit: false, isWalk: true, isHBP: false, isStrikeout: false,
      isHomeRun: false, isSacFly: false, isDoublePlay: false, isError: false,
      totalPitches: this.totalPitches,
    };
  }

  private buildStrikeoutResult(events: GameEvent[]): AtBatResult {
    return {
      events,
      newBases: { ...this.bases },
      runsScored: 0,
      scoringRunners: [],
      outsRecorded: 1,
      isHit: false, isWalk: false, isHBP: false, isStrikeout: true,
      isHomeRun: false, isSacFly: false, isDoublePlay: false, isError: false,
      totalPitches: this.totalPitches,
    };
  }

  private buildPlayDescription(
    batterName: string,
    contact: { type: string; distance: number; exitVelo: number },
    fielding: { isOut: boolean; hitResult?: string; outType?: string; fieldedBy: string; isDoublePlay: boolean; isError: boolean },
    br: import('./BaserunningEngine.ts').BaserunningResult
  ): string {
    if (fielding.isError) return `${batterName} reaches on error by ${fielding.fieldedBy}`;
    if (fielding.hitResult === 'home_run') {
      const prefix = br.runsScored > 1 ? `${br.runsScored}-run` : 'solo';
      return `${batterName} hits a ${prefix} home run! (${contact.distance} ft)`;
    }
    if (fielding.hitResult === 'triple') return `${batterName} triples to ${fielding.fieldedBy}`;
    if (fielding.hitResult === 'double') return `${batterName} doubles to ${fielding.fieldedBy}`;
    if (fielding.hitResult === 'single') return `${batterName} singles to ${fielding.fieldedBy}`;
    if (fielding.isDoublePlay) return `${batterName} grounds into a double play`;
    if (fielding.outType === 'sacrifice_fly') return `${batterName} hits a sacrifice fly to ${fielding.fieldedBy}`;
    if (fielding.outType === 'flyout') return `${batterName} flies out to ${fielding.fieldedBy}`;
    if (fielding.outType === 'lineout') return `${batterName} lines out to ${fielding.fieldedBy}`;
    if (fielding.outType === 'popout') return `${batterName} pops out to ${fielding.fieldedBy}`;
    if (fielding.outType === 'groundout') return `${batterName} grounds out to ${fielding.fieldedBy}`;
    if (fielding.outType === 'fielders_choice') return `${batterName} reaches on a fielder's choice`;
    return `${batterName} is out`;
  }

  private getFielderName(pos: Position): string {
    const p = this.fielders.get(pos);
    return p ? getPlayerName(p) : pos;
  }
}

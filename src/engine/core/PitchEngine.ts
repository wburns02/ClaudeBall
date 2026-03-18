import type { Player, PitchType, PitchResult } from '../types/index.ts';
import type { RandomProvider } from './RandomProvider.ts';
import { clamp, ratingToProb } from '../util/helpers.ts';

export interface PitchOutcome {
  pitchType: PitchType;
  result: PitchResult;
  velocity: number;
  inZone: boolean;
  swung: boolean;
}

/**
 * Determines pitch selection and outcome (ball/strike/contact/foul).
 *
 * Key factors: pitcher control/stuff, batter eye/contact, count leverage.
 */
export class PitchEngine {
  /**
   * Simulate a single pitch.
   */
  static throw(
    pitcher: Player,
    batter: Player,
    balls: number,
    strikes: number,
    rng: RandomProvider
  ): PitchOutcome {
    const pitchType = this.selectPitch(pitcher, balls, strikes, rng);
    const velocity = this.calculateVelocity(pitcher, pitchType, rng);
    const inZone = this.determineLocation(pitcher, balls, strikes, rng);
    const swung = this.determineSwing(batter, pitcher, inZone, pitchType, balls, strikes, rng);

    let result: PitchResult;

    if (!swung) {
      result = inZone ? 'called_strike' : 'ball';
    } else if (!inZone) {
      // Swung at ball outside zone — stuff and eye determine contact chance
      const chaseContactChance = 0.25 * ratingToProb(this.getBatterContact(batter, pitcher));
      if (rng.chance(chaseContactChance)) {
        result = rng.chance(0.55) ? 'foul' : 'contact';
      } else {
        result = 'swinging_strike';
      }
    } else {
      // Swung at strike — contact vs whiff
      const contactRating = this.getBatterContact(batter, pitcher);
      const stuffPenalty = ratingToProb(pitcher.pitching.stuff) * 0.2;
      const contactChance = clamp(ratingToProb(contactRating) * 0.85 + 0.10 - stuffPenalty, 0.30, 0.95);

      if (rng.chance(contactChance)) {
        // Contact — foul or in play
        const foulChance = strikes === 2 ? 0.40 : 0.32;
        result = rng.chance(foulChance) ? 'foul' : 'contact';
      } else {
        result = 'swinging_strike';
      }
    }

    return { pitchType, result, velocity, inZone, swung };
  }

  private static selectPitch(pitcher: Player, balls: number, strikes: number, rng: RandomProvider): PitchType {
    const rep = pitcher.pitching.repertoire;
    if (rep.length === 0) return 'fastball';
    if (rep.length === 1) return rep[0];

    // Behind in count → more fastballs; ahead → more offspeed
    const isBehind = balls > strikes;
    const isAhead = strikes > balls;

    const weights = rep.map(p => {
      if (p === 'fastball' || p === 'sinker' || p === 'cutter') {
        return isBehind ? 5 : isAhead ? 2 : 3;
      }
      return isBehind ? 1 : isAhead ? 4 : 3;
    });

    return rng.weightedPick(rep, weights);
  }

  private static calculateVelocity(pitcher: Player, pitchType: PitchType, rng: RandomProvider): number {
    const base = pitcher.pitching.velocity;
    const fatiguePenalty = (pitcher.state.fatigue / 100) * 4;
    const variance = rng.nextGaussian(0, 1.2);

    const typeAdjust: Record<PitchType, number> = {
      fastball: 0, sinker: -2, cutter: -3, slider: -7,
      curveball: -12, changeup: -10, splitter: -6, knuckleball: -18,
    };

    return Math.round(clamp(base + (typeAdjust[pitchType] || 0) - fatiguePenalty + variance, 60, 105));
  }

  private static determineLocation(pitcher: Player, balls: number, strikes: number, rng: RandomProvider): boolean {
    const control = ratingToProb(pitcher.pitching.control);
    const fatiguePenalty = (pitcher.state.fatigue / 100) * 0.15;

    // Pitchers aim for zone ~55% of time on average, control modifies
    let zoneRate = 0.42 + control * 0.22 - fatiguePenalty;

    // Count adjustments: behind → throw strikes, ahead → nibble
    if (balls >= 3 && strikes < 2) zoneRate += 0.12;
    else if (strikes === 2 && balls <= 1) zoneRate -= 0.08;

    return rng.chance(clamp(zoneRate, 0.30, 0.72));
  }

  private static determineSwing(
    batter: Player,
    pitcher: Player,
    inZone: boolean,
    _pitchType: PitchType,
    balls: number,
    strikes: number,
    rng: RandomProvider
  ): boolean {
    const eye = ratingToProb(batter.batting.eye);
    const deception = ratingToProb(pitcher.pitching.movement) * 0.15;

    if (inZone) {
      // Swing at strikes
      let swingRate = 0.60 + eye * 0.12 - deception;
      if (strikes === 2) swingRate += 0.15; // Protect
      if (balls === 3) swingRate += 0.08;
      return rng.chance(clamp(swingRate, 0.45, 0.90));
    } else {
      // Chase rate
      let chaseRate = 0.32 - eye * 0.18 + deception;
      if (strikes === 2) chaseRate += 0.08;
      if (balls === 3 && strikes < 2) chaseRate -= 0.10;
      return rng.chance(clamp(chaseRate, 0.10, 0.45));
    }
  }

  private static getBatterContact(batter: Player, pitcher: Player): number {
    const contactVsHand = pitcher.throws === 'L' ? batter.batting.contact_L : batter.batting.contact_R;
    return contactVsHand;
  }
}

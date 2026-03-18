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
 * Calibrated to MLB baselines:
 * - Zone rate: ~46%
 * - In-zone swing rate: ~67%
 * - Chase rate: ~30%
 * - In-zone contact rate: ~83%
 * - Chase contact rate: ~58%
 * - K%: ~22%, BB%: ~8%
 */
export class PitchEngine {
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
      // Chase contact: MLB ~58%, mostly fouls
      const contactRating = this.getBatterContact(batter, pitcher);
      const chaseContact = clamp(0.48 + ratingToProb(contactRating) * 0.18 - ratingToProb(pitcher.pitching.stuff) * 0.08, 0.38, 0.72);
      if (rng.chance(chaseContact)) {
        result = rng.chance(0.65) ? 'foul' : 'contact'; // chase contact is usually foul
      } else {
        result = 'swinging_strike';
      }
    } else {
      // In-zone contact: MLB ~83%
      const contactRating = this.getBatterContact(batter, pitcher);
      const stuffPenalty = ratingToProb(pitcher.pitching.stuff) * 0.06;
      const contactChance = clamp(
        ratingToProb(contactRating) * 0.15 + 0.78 - stuffPenalty,
        0.72, 0.95
      );

      if (rng.chance(contactChance)) {
        const foulChance = strikes === 2 ? 0.45 : 0.38;
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
    const fatiguePenalty = (pitcher.state.fatigue / 100) * 0.10;

    // Tuned for ~8% BB rate (slightly above MLB zone rate)
    let zoneRate = 0.46 + control * 0.12 - fatiguePenalty;

    // Count adjustments
    if (balls >= 3 && strikes < 2) zoneRate += 0.14;
    else if (balls >= 2 && strikes === 0) zoneRate += 0.06;
    else if (strikes === 2 && balls <= 1) zoneRate -= 0.05;

    return rng.chance(clamp(zoneRate, 0.32, 0.62));
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
    const deception = ratingToProb(pitcher.pitching.movement) * 0.08;

    if (inZone) {
      // MLB in-zone swing rate ~67%
      let swingRate = 0.60 + eye * 0.08 - deception;
      if (strikes === 2) swingRate += 0.12;
      if (balls === 3) swingRate += 0.10;
      return rng.chance(clamp(swingRate, 0.52, 0.85));
    } else {
      // MLB chase rate ~30%
      let chaseRate = 0.30 - eye * 0.12 + deception;
      if (strikes === 2) chaseRate += 0.08;
      if (balls === 3 && strikes < 2) chaseRate -= 0.10;
      return rng.chance(clamp(chaseRate, 0.14, 0.40));
    }
  }

  private static getBatterContact(batter: Player, pitcher: Player): number {
    return pitcher.throws === 'L' ? batter.batting.contact_L : batter.batting.contact_R;
  }
}

import type { Player, ContactType, PitchType } from '../types/index.ts';
import type { RandomProvider } from './RandomProvider.ts';
import type { BallparkFactors } from '../types/ballpark.ts';
import { clamp, ratingToRange } from '../util/helpers.ts';

export interface ContactOutcome {
  type: ContactType;
  exitVelo: number;        // mph
  launchAngle: number;     // degrees
  sprayAngle: number;      // degrees (-45 = left line, 0 = center, 45 = right line)
  distance: number;        // feet
  isHard: boolean;         // exit velo >= 95mph
}

/**
 * Determines what happens when bat meets ball.
 * Launch angle, exit velocity, spray angle, and distance.
 */
export class ContactEngine {
  static resolve(
    batter: Player,
    pitcher: Player,
    pitchType: PitchType,
    ballpark: BallparkFactors,
    rng: RandomProvider
  ): ContactOutcome {
    const powerVsHand = pitcher.throws === 'L' ? batter.batting.power_L : batter.batting.power_R;

    // Exit velocity: MLB average ~87 mph, leaders ~93-95
    const basePower = ratingToRange(powerVsHand, 74, 100);
    const variance = rng.nextGaussian(0, 7);
    const exitVelo = clamp(basePower + variance, 55, 115);
    const isHard = exitVelo >= 95;

    // Launch angle: power hitters elevate more
    const laTarget = ratingToRange(powerVsHand, 4, 20);
    const laVariance = rng.nextGaussian(0, 13);
    const launchAngle = clamp(laTarget + laVariance + this.pitchTypeAngleAdjust(pitchType), -30, 75);

    // Spray angle: platoon splits, randomness
    const sprayAngle = this.calculateSpray(batter, pitcher, rng);

    // Distance: function of exit velo and launch angle (simplified trajectory)
    const rawDistance = this.calculateDistance(exitVelo, launchAngle);
    const parkFactor = launchAngle > 20 ? ballpark.hr : ballpark.doubles;
    const distance = Math.round(rawDistance * parkFactor);

    // Classify contact type
    const type = this.classifyContact(launchAngle);

    return { type, exitVelo: Math.round(exitVelo), launchAngle: Math.round(launchAngle), sprayAngle: Math.round(sprayAngle), distance, isHard };
  }

  private static pitchTypeAngleAdjust(pitchType: PitchType): number {
    const adjusts: Record<PitchType, number> = {
      fastball: 0, sinker: -4, cutter: -1, slider: -2,
      curveball: 3, changeup: 2, splitter: -3, knuckleball: 0,
    };
    return adjusts[pitchType] || 0;
  }

  private static calculateSpray(batter: Player, pitcher: Player, rng: RandomProvider): number {
    // Pull tendency based on handedness matchup
    const isPullSide = batter.bats === pitcher.throws;
    const pullBias = isPullSide ? -5 : 5; // negative = pull for RHB
    const base = batter.bats === 'R' ? -8 : batter.bats === 'L' ? 8 : 0;
    return clamp(rng.nextGaussian(base + pullBias, 22), -45, 45);
  }

  private static calculateDistance(exitVelo: number, launchAngle: number): number {
    // Simplified trajectory model
    const laRad = (launchAngle * Math.PI) / 180;
    const v = exitVelo * 1.467; // mph to ft/s

    if (launchAngle < -10) return 20 + exitVelo * 0.3; // Choppers
    if (launchAngle > 65) return 60 + exitVelo * 0.5;  // Popups

    // Roughly: d = v^2 * sin(2*angle) / g, with drag approximation
    const rawD = (v * v * Math.sin(2 * laRad)) / 32.17;
    const dragFactor = 0.64; // drag reduces distance significantly
    return clamp(rawD * dragFactor, 30, 470);
  }

  private static classifyContact(launchAngle: number): ContactType {
    if (launchAngle < 10) return 'ground_ball';
    if (launchAngle < 22) return 'line_drive';
    if (launchAngle < 50) return 'fly_ball';
    return 'popup';
  }
}

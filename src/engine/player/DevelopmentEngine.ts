import type { Player } from '@/engine/types/player.ts';
import type { RandomProvider } from '@/engine/core/RandomProvider.ts';
import { clamp } from '@/engine/util/helpers.ts';

// ---- Injury types --------------------------------------------------------

export type InjurySeverity = 'minor' | 'moderate' | 'severe';

export interface InjuryResult {
  injured: boolean;
  severity?: InjurySeverity;
  daysOut?: number;
  description?: string;
}

export interface DevelopmentResult {
  player: Player;
  changes: Record<string, number>; // ratingKey -> delta
  retirementChance: number;
  shouldRetire: boolean;
}

// ---- Training types -------------------------------------------------------

export type TrainingFocus =
  | 'contact' | 'power' | 'eye' | 'speed' | 'mental'  // hitter focuses
  | 'stuff' | 'movement' | 'control' | 'stamina';       // pitcher focuses

export type TrainingIntensity = 'rest' | 'light' | 'normal' | 'intense';

export interface TrainingAssignment {
  focus: TrainingFocus | 'none';
  intensity: TrainingIntensity;
}

// ---- Constants -----------------------------------------------------------

const BATTING_KEYS: (keyof Player['batting'])[] = [
  'contact_L', 'contact_R', 'power_L', 'power_R',
  'eye', 'avoid_k', 'gap_power', 'speed', 'steal',
];

const PITCHING_KEYS: (keyof Player['pitching'])[] = [
  'stuff', 'movement', 'control', 'stamina',
];

/** Which raw rating keys each training focus targets */
const TRAINING_KEYS: Record<TrainingFocus, string[]> = {
  contact:  ['contact_L', 'contact_R'],
  power:    ['power_L', 'power_R'],
  eye:      ['eye', 'avoid_k'],
  speed:    ['speed', 'steal'],
  mental:   [], // handled separately via work_ethic bonus
  stuff:    ['stuff'],
  movement: ['movement'],
  control:  ['control'],
  stamina:  ['stamina'],
};

// Base injury probability per game appearance (modified by durability)
const BASE_INJURY_CHANCE_PER_GAME = 0.02;

// ---- Development Engine --------------------------------------------------

export class DevelopmentEngine {
  /**
   * Apply offseason rating changes based on age curve.
   * Returns a new Player object with updated ratings and the changelog.
   */
  static developPlayer(
    player: Player,
    rng: RandomProvider,
    training?: TrainingAssignment,
  ): DevelopmentResult {
    const age = player.age;
    // Training intensity boosts effective work ethic for the development roll
    const intensityBonus =
      !training || training.intensity === 'rest' ? -0.1 :
      training.intensity === 'light' ? 0 :
      training.intensity === 'normal' ? 0 :
      0.15; // 'intense'
    const workEthic = Math.min(1, player.mental.work_ethic / 100 + intensityBonus);

    // Clone ratings
    const newBatting = { ...player.batting };
    const newPitching = { ...player.pitching };

    const changes: Record<string, number> = {};

    function applyChange(
      obj: Record<string, number>,
      key: string,
      delta: number,
    ): void {
      const prev = obj[key] as number;
      const next = clamp(prev + delta, 1, 100);
      const actual = next - prev;
      obj[key] = next;
      if (actual !== 0) changes[key] = actual;
    }

    // Determine phase & deltas
    if (age >= 20 && age <= 26) {
      // Growth phase
      const growthBase = 6 - (age - 20) * 0.5; // peaks at 20, tapers to ~3 at 26
      for (const key of BATTING_KEYS) {
        if (rng.chance(0.7 + workEthic * 0.3)) {
          const delta = Math.round(rng.nextFloat(0.5, growthBase) * workEthic + rng.nextFloat(0, 1.5));
          applyChange(newBatting as unknown as Record<string, number>, key, delta);
        }
      }
      for (const key of PITCHING_KEYS) {
        if (rng.chance(0.7 + workEthic * 0.3)) {
          const delta = Math.round(rng.nextFloat(0.5, growthBase) * workEthic + rng.nextFloat(0, 1.5));
          applyChange(newPitching as unknown as Record<string, number>, key, delta);
        }
      }
    } else if (age >= 27 && age <= 31) {
      // Peak — small fluctuations
      for (const key of BATTING_KEYS) {
        if (rng.chance(0.4)) {
          const delta = rng.chance(0.5 + workEthic * 0.2) ? 1 : -1;
          applyChange(newBatting as unknown as Record<string, number>, key, delta);
        }
      }
      for (const key of PITCHING_KEYS) {
        if (rng.chance(0.4)) {
          const delta = rng.chance(0.5 + workEthic * 0.2) ? 1 : -1;
          applyChange(newPitching as unknown as Record<string, number>, key, delta);
        }
      }
    } else if (age >= 32 && age <= 36) {
      // Decline phase
      const declineBase = 1 + (age - 31) * 0.3;
      for (const key of BATTING_KEYS) {
        if (rng.chance(0.6)) {
          const rawDecline = rng.nextFloat(1, declineBase + 1);
          // Work ethic can slow decline slightly
          const delta = -Math.round(rawDecline * (1 - workEthic * 0.25));
          applyChange(newBatting as unknown as Record<string, number>, key, Math.min(delta, -1));
        }
      }
      for (const key of PITCHING_KEYS) {
        if (rng.chance(0.6)) {
          const rawDecline = rng.nextFloat(1, declineBase + 1);
          const delta = -Math.round(rawDecline * (1 - workEthic * 0.25));
          applyChange(newPitching as unknown as Record<string, number>, key, Math.min(delta, -1));
        }
      }
    } else if (age >= 37) {
      // Steep decline
      const steepDecline = 2 + (age - 36) * 0.5;
      for (const key of BATTING_KEYS) {
        if (rng.chance(0.8)) {
          const delta = -Math.round(rng.nextFloat(2, steepDecline + 2));
          applyChange(newBatting as unknown as Record<string, number>, key, Math.min(delta, -2));
        }
      }
      for (const key of PITCHING_KEYS) {
        if (rng.chance(0.8)) {
          const delta = -Math.round(rng.nextFloat(2, steepDecline + 2));
          applyChange(newPitching as unknown as Record<string, number>, key, Math.min(delta, -2));
        }
      }
    }

    // Apply training focus bonus (extra improvement to targeted attributes)
    if (training && training.focus !== 'none' && training.intensity !== 'rest') {
      const intensityMult =
        training.intensity === 'light' ? 0.6 :
        training.intensity === 'normal' ? 1.0 : 1.8; // intense
      const focusKeys = TRAINING_KEYS[training.focus];
      const isPitcher = player.position === 'P';

      for (const key of focusKeys) {
        const obj = isPitcher
          ? (newPitching as unknown as Record<string, number>)
          : (newBatting as unknown as Record<string, number>);

        // Skip if wrong type for position
        if (isPitcher && BATTING_KEYS.includes(key as keyof Player['batting'])) continue;
        if (!isPitcher && PITCHING_KEYS.includes(key as keyof Player['pitching'])) continue;

        const bonus = Math.round(rng.nextFloat(0.5, 2.5) * intensityMult);
        if (bonus > 0) applyChange(obj, key, bonus);
      }

      // Mental focus: boost next offseason's work ethic itself slightly
      if (training.focus === 'mental') {
        const mentalBoost = Math.round(rng.nextFloat(0.5, 2) * intensityMult);
        if (mentalBoost > 0) {
          const prev = player.mental.work_ethic;
          const next = clamp(prev + mentalBoost, 1, 100);
          if (next !== prev) changes['mental.work_ethic'] = next - prev;
        }
      }
    }

    // Retirement chance (37+ increases rapidly)
    const retirementChance =
      age < 37 ? 0 :
      age === 37 ? 0.10 :
      age === 38 ? 0.25 :
      age === 39 ? 0.40 :
      age === 40 ? 0.60 :
      Math.min(0.90, 0.60 + (age - 40) * 0.15);

    const shouldRetire = rng.chance(retirementChance * (1 - workEthic * 0.3));

    const updated: Player = {
      ...player,
      age: player.age + 1,
      batting: newBatting,
      pitching: newPitching,
    };

    return { player: updated, changes, retirementChance, shouldRetire };
  }

  /**
   * Roll an injury check for a single game appearance.
   * Returns an InjuryResult — if injured, updates player.state.isInjured.
   * Returns a NEW player object (immutable).
   */
  static checkInjury(player: Player, rng: RandomProvider): { result: InjuryResult; player: Player } {
    const durability = player.mental.durability / 100; // 0-1
    // Lower durability → higher injury chance
    const injuryChance = BASE_INJURY_CHANCE_PER_GAME * (1.8 - durability);

    if (!rng.chance(injuryChance)) {
      return { result: { injured: false }, player };
    }

    // Determine severity — weighted by durability (high durability → more likely minor)
    type SeverityOption = { severity: InjurySeverity; weight: number; minDays: number; maxDays: number; label: string };
    const severityOptions: SeverityOption[] = [
      { severity: 'minor',    weight: 50 + Math.round(durability * 20), minDays: 1,  maxDays: 3,   label: 'Minor strain' },
      { severity: 'moderate', weight: 35,                               minDays: 15, maxDays: 30,  label: 'Moderate injury' },
      { severity: 'severe',   weight: 15 - Math.round(durability * 10), minDays: 60, maxDays: 120, label: 'Severe injury' },
    ];

    const weights = severityOptions.map((o) => Math.max(1, o.weight));
    const picked = rng.weightedPick(severityOptions, weights);
    const daysOut = rng.nextInt(picked.minDays, picked.maxDays);

    const updatedPlayer: Player = {
      ...player,
      state: {
        ...player.state,
        isInjured: true,
        // Store daysOut in fatigue temporarily (convention for this engine)
        // In a full implementation we'd add an injuryDaysRemaining field
        fatigue: daysOut,
      },
    };

    return {
      result: {
        injured: true,
        severity: picked.severity,
        daysOut,
        description: picked.label,
      },
      player: updatedPlayer,
    };
  }

  /**
   * Reduce a player's injury timer by the given number of days.
   * When timer reaches 0, marks the player as healthy.
   */
  static healPlayer(player: Player, days: number): Player {
    if (!player.state.isInjured) return player;

    const remaining = Math.max(0, player.state.fatigue - days);
    return {
      ...player,
      state: {
        ...player.state,
        fatigue: remaining,
        isInjured: remaining > 0,
      },
    };
  }
}

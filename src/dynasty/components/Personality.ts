import type { Component } from '../ecs/types.ts';
import type { MentalRatings } from '@/engine/types/player.ts';

export interface PersonalityComponent extends Component {
  type: 'Personality';
  workEthic: number;     // 20-80
  ego: number;
  loyalty: number;
  charisma: number;
  baseballIQ: number;
  composure: number;
  leadership: number;
  aggression: number;
  coachability: number;
  integrity: number;
  wildcard: number;    // 20-80, hidden volatility — drives scandal generation
}

/** Map from existing MentalRatings (0-100) to Personality (20-80). */
export function ratingTo2080(value: number): number {
  return Math.round(value * 0.6 + 20);
}

/** Random trait in 20-80 range. */
function randomTrait(rng: () => number): number {
  return Math.round(rng() * 60 + 20);
}

/** Generate a Personality from existing MentalRatings + random for new traits. */
export function personalityFromMental(mental: MentalRatings, rng: () => number): PersonalityComponent {
  return {
    type: 'Personality',
    workEthic: ratingTo2080(mental.work_ethic),
    ego: randomTrait(rng),
    loyalty: randomTrait(rng),
    charisma: randomTrait(rng),
    baseballIQ: ratingTo2080(mental.intelligence),
    composure: ratingTo2080(mental.composure),
    leadership: ratingTo2080(mental.leadership),
    aggression: randomTrait(rng),
    coachability: randomTrait(rng),
    integrity: randomTrait(rng),
    // Wildcard: inverse of composure + randomness. Low composure = high volatility.
    wildcard: Math.max(20, Math.min(80, Math.round(100 - ratingTo2080(mental.composure) + (randomTrait(rng) - 50) * 0.3))),
  };
}

/** Generate a fully random Personality (for NPCs like owners, agents). */
export function randomPersonality(rng: () => number): PersonalityComponent {
  return {
    type: 'Personality',
    workEthic: randomTrait(rng),
    ego: randomTrait(rng),
    loyalty: randomTrait(rng),
    charisma: randomTrait(rng),
    baseballIQ: randomTrait(rng),
    composure: randomTrait(rng),
    leadership: randomTrait(rng),
    aggression: randomTrait(rng),
    coachability: randomTrait(rng),
    integrity: randomTrait(rng),
    wildcard: randomTrait(rng),
  };
}

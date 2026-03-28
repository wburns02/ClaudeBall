/**
 * Training Impact System — off-field work that affects POTENTIAL ratings.
 *
 * Regular training develops current → potential.
 * Hard training (gym, yoga, flexibility, sports science) can RAISE potential itself.
 * The grind matters. A player who invests in their body can break through ceilings.
 */

export type TrainingType =
  | 'batting_cage'      // Current: contact/eye
  | 'power_lifting'     // Current: power, Potential: +1-2 power
  | 'speed_agility'     // Current: speed, Potential: +1 speed
  | 'fielding_drills'   // Current: fielding/arm
  | 'pitch_lab'         // Current: stuff/control (pitchers)
  | 'yoga_flexibility'  // Potential: +1-3 to ALL tools, extends career
  | 'sports_science'    // Potential: +2-4 to one random tool
  | 'mental_coaching'   // Current: eye/composure, Potential: +1-2 eye
  | 'nutrition_plan'    // Potential: +1 to power/stamina, reduces injury risk
  | 'film_study'        // Current: eye/baseball IQ, Potential: +1-2 contact
  | 'long_toss'         // Pitchers: Potential: +1-3 velocity
  | 'mechanics_overhaul'; // Pitchers: Potential: +2-4 control, risk of stuff drop

export interface TrainingProgram {
  type: TrainingType;
  label: string;
  description: string;
  cost: number;           // thousands per offseason
  currentEffects: Record<string, number>;   // attribute → delta
  potentialEffects: Record<string, number>; // attribute → potential delta
  personalityBonus?: Record<string, number>; // personality trait → delta
  careerExtension?: number; // years added to career longevity (0-2)
  injuryRiskMod?: number;   // negative = reduces risk
}

export const TRAINING_PROGRAMS: TrainingProgram[] = [
  {
    type: 'batting_cage',
    label: 'Batting Cage Work',
    description: 'Extra reps refining your swing mechanics and timing.',
    cost: 50,
    currentEffects: { contact: 2, eye: 1 },
    potentialEffects: {},
  },
  {
    type: 'power_lifting',
    label: 'Power Lifting Program',
    description: 'Heavy compound lifts to build raw strength. Adds power but can reduce flexibility.',
    cost: 80,
    currentEffects: { power: 2 },
    potentialEffects: { power: 2 },
    injuryRiskMod: 1,  // Slightly increased injury risk
  },
  {
    type: 'speed_agility',
    label: 'Speed & Agility Training',
    description: 'Sprint work, cone drills, and plyometrics. Get faster and more explosive.',
    cost: 70,
    currentEffects: { speed: 2 },
    potentialEffects: { speed: 1 },
  },
  {
    type: 'fielding_drills',
    label: 'Fielding Drills',
    description: 'Grounders, fly balls, double play turns. Sharpen your glove work.',
    cost: 50,
    currentEffects: { fielding: 2, arm: 1 },
    potentialEffects: {},
  },
  {
    type: 'pitch_lab',
    label: 'Pitching Lab',
    description: 'High-speed cameras, Rapsodo data, and grip experiments. Refine your arsenal.',
    cost: 100,
    currentEffects: { stuff: 1, control: 2 },
    potentialEffects: { stuff: 1 },
  },
  {
    type: 'yoga_flexibility',
    label: 'Yoga & Flexibility',
    description: 'Full-body flexibility program. Prevents injuries, extends career, and raises ALL ceilings slightly.',
    cost: 60,
    currentEffects: {},
    potentialEffects: { contact: 1, power: 1, speed: 1, fielding: 1, arm: 1, eye: 1 },
    careerExtension: 1,
    injuryRiskMod: -3,
  },
  {
    type: 'sports_science',
    label: 'Sports Science Program',
    description: 'Cutting-edge biomechanics, sleep optimization, recovery protocols. Significant ceiling boost to one random tool.',
    cost: 200,
    currentEffects: {},
    potentialEffects: { _random: 3 }, // Picks one random attribute and adds 3
    careerExtension: 1,
    injuryRiskMod: -2,
  },
  {
    type: 'mental_coaching',
    label: 'Mental Performance Coach',
    description: 'Visualization, pressure management, plate discipline. Sharpen the mental game.',
    cost: 120,
    currentEffects: { eye: 2 },
    potentialEffects: { eye: 2, contact: 1 },
    personalityBonus: { composure: 3, coachability: 2 },
  },
  {
    type: 'nutrition_plan',
    label: 'Elite Nutrition Plan',
    description: 'Personal chef, supplements, body composition optimization. Protects your body long-term.',
    cost: 150,
    currentEffects: {},
    potentialEffects: { power: 1, stamina: 1 },
    careerExtension: 2,
    injuryRiskMod: -4,
  },
  {
    type: 'film_study',
    label: 'Film Study Sessions',
    description: 'Break down pitcher tendencies and your own swing from every angle.',
    cost: 40,
    currentEffects: { eye: 1 },
    potentialEffects: { contact: 2 },
    personalityBonus: { baseballIQ: 2 },
  },
  {
    type: 'long_toss',
    label: 'Long Toss Program',
    description: 'Jaeger long-toss to build arm strength and potential velocity. Pitchers only.',
    cost: 60,
    currentEffects: {},
    potentialEffects: { velocity: 2 },
    injuryRiskMod: 2, // Some risk to arm
  },
  {
    type: 'mechanics_overhaul',
    label: 'Mechanics Overhaul',
    description: 'Complete delivery rebuild with a pitching guru. High risk, high reward — could unlock elite command or temporarily lose feel.',
    cost: 180,
    currentEffects: { control: -1 }, // Short-term regression
    potentialEffects: { control: 4 }, // But massive ceiling raise
    injuryRiskMod: -1,
  },
];

export interface TrainingResult {
  program: TrainingProgram;
  currentChanges: Record<string, number>;
  potentialChanges: Record<string, number>;
  personalityChanges: Record<string, number>;
  description: string;
}

/**
 * Apply a training program to a player's attributes.
 * Returns the changes made for display.
 */
export function applyTraining(
  program: TrainingProgram,
  currentAttrs: Record<string, number>,
  potentialAttrs: Record<string, number>,
  rng: () => number = Math.random,
): TrainingResult {
  const currentChanges: Record<string, number> = {};
  const potentialChanges: Record<string, number> = {};
  const personalityChanges: Record<string, number> = {};

  // Apply current effects
  for (const [attr, delta] of Object.entries(program.currentEffects)) {
    const effective = delta + Math.round((rng() - 0.5) * 2); // ±1 randomness
    currentAttrs[attr] = Math.max(20, Math.min(80, (currentAttrs[attr] ?? 50) + effective));
    currentChanges[attr] = effective;
  }

  // Apply potential effects
  for (const [attr, delta] of Object.entries(program.potentialEffects)) {
    if (attr === '_random') {
      // Pick a random attribute and boost it
      const attrs = Object.keys(currentAttrs).filter(k => k !== 'velocity');
      const pick = attrs[Math.floor(rng() * attrs.length)];
      const effective = delta + Math.round((rng() - 0.5) * 2);
      potentialAttrs[pick] = Math.max(20, Math.min(80, (potentialAttrs[pick] ?? 60) + effective));
      potentialChanges[pick] = effective;
    } else {
      const effective = delta + Math.round((rng() - 0.3) * 1); // Slightly positive bias
      potentialAttrs[attr] = Math.max(20, Math.min(80, (potentialAttrs[attr] ?? 60) + effective));
      potentialChanges[attr] = effective;
    }
  }

  // Personality effects
  if (program.personalityBonus) {
    for (const [trait, delta] of Object.entries(program.personalityBonus)) {
      personalityChanges[trait] = delta;
    }
  }

  // Build description
  const parts: string[] = [];
  for (const [attr, delta] of Object.entries(currentChanges)) {
    if (delta !== 0) parts.push(`${attr} ${delta > 0 ? '+' : ''}${delta}`);
  }
  for (const [attr, delta] of Object.entries(potentialChanges)) {
    if (delta !== 0) parts.push(`${attr} ceiling ${delta > 0 ? '+' : ''}${delta}`);
  }
  if (program.careerExtension) parts.push(`career +${program.careerExtension} years`);
  if (program.injuryRiskMod && program.injuryRiskMod < 0) parts.push(`injury risk reduced`);

  return {
    program,
    currentChanges,
    potentialChanges,
    personalityChanges,
    description: parts.join(', ') || 'No measurable changes this offseason.',
  };
}

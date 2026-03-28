import { describe, it, expect } from 'vitest';
import { TRAINING_PROGRAMS, applyTraining } from './TrainingImpact.ts';
import type { TrainingProgram } from './TrainingImpact.ts';

describe('TrainingImpact', () => {
  const getProgram = (type: string) => TRAINING_PROGRAMS.find(p => p.type === type)!;

  it('has 12 training programs', () => {
    expect(TRAINING_PROGRAMS).toHaveLength(12);
    expect(TRAINING_PROGRAMS.every(p => p.label && p.description && p.cost > 0)).toBe(true);
  });

  it('yoga raises ALL potential ratings', () => {
    const yoga = getProgram('yoga_flexibility');
    expect(Object.keys(yoga.potentialEffects).length).toBeGreaterThanOrEqual(5);
    expect(yoga.careerExtension).toBeGreaterThan(0);
    expect(yoga.injuryRiskMod).toBeLessThan(0);
  });

  it('power lifting raises current AND potential power', () => {
    const pl = getProgram('power_lifting');
    expect(pl.currentEffects.power).toBeGreaterThan(0);
    expect(pl.potentialEffects.power).toBeGreaterThan(0);
  });

  it('mechanics overhaul: short-term regression, long-term ceiling boost', () => {
    const mech = getProgram('mechanics_overhaul');
    expect(mech.currentEffects.control).toBeLessThan(0); // Regression
    expect(mech.potentialEffects.control).toBeGreaterThan(3); // But huge ceiling
  });

  it('sports science boosts one random attribute potential', () => {
    const ss = getProgram('sports_science');
    expect(ss.potentialEffects._random).toBeDefined();
    expect(ss.potentialEffects._random).toBeGreaterThan(0);
  });

  it('applyTraining changes attributes', () => {
    const current = { contact: 50, power: 45, speed: 55, fielding: 50, arm: 50, eye: 50 };
    const potential = { contact: 65, power: 60, speed: 65, fielding: 60, arm: 60, eye: 60 };

    const yoga = getProgram('yoga_flexibility');
    let seed = 42;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    const result = applyTraining(yoga, current, potential, rng);

    // Yoga should raise potentials
    const totalPotentialChange = Object.values(result.potentialChanges).reduce((a, b) => a + b, 0);
    expect(totalPotentialChange).toBeGreaterThan(0);
    expect(result.description).toContain('ceiling');
  });

  it('applyTraining respects 20-80 bounds', () => {
    const current = { contact: 79, power: 79, speed: 79 };
    const potential = { contact: 80, power: 80, speed: 80 };

    const pl = getProgram('power_lifting');
    const result = applyTraining(pl, current, potential);

    expect(current.power).toBeLessThanOrEqual(80);
    expect(potential.power).toBeLessThanOrEqual(80);
  });

  it('sports science picks random attribute', () => {
    const current = { contact: 50, power: 50, speed: 50, fielding: 50, arm: 50, eye: 50 };
    const potential = { contact: 60, power: 60, speed: 60, fielding: 60, arm: 60, eye: 60 };

    const ss = getProgram('sports_science');
    let seed = 42;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    const result = applyTraining(ss, current, potential, rng);

    // Exactly one potential attribute should change
    const changed = Object.entries(result.potentialChanges).filter(([, v]) => v !== 0);
    expect(changed.length).toBe(1);
    expect(changed[0][1]).toBeGreaterThan(0);
  });

  it('nutrition plan extends career', () => {
    const np = getProgram('nutrition_plan');
    expect(np.careerExtension).toBeGreaterThanOrEqual(2);
    expect(np.injuryRiskMod).toBeLessThan(0);
  });

  it('each program has unique type', () => {
    const types = TRAINING_PROGRAMS.map(p => p.type);
    expect(new Set(types).size).toBe(types.length);
  });
});

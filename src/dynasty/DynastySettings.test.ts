import { describe, it, expect } from 'vitest';
import { createSettings, PRESETS, CHARACTER_ARCHETYPES } from './DynastySettings.ts';

describe('DynastySettings', () => {
  it('creates realistic settings by default', () => {
    const settings = createSettings('classic');
    expect(settings.mode).toBe('classic');
    expect(settings.seasonLength).toBe(162);
    expect(settings.tradeAIDifficulty).toBe('realistic');
    expect(settings.fireRisk).toBe(true);
  });

  it('casual preset overrides key values', () => {
    const settings = createSettings('classic', 'casual');
    expect(settings.seasonLength).toBe(56);
    expect(settings.teamCount).toBe(16);
    expect(settings.injuryFrequency).toBe('rare');
    expect(settings.fireRisk).toBe(false);
  });

  it('hardcore preset is punishing', () => {
    const settings = createSettings('classic', 'hardcore');
    expect(settings.salarySystem).toBe('hard_cap');
    expect(settings.prospectBustRate).toBe(50);
    expect(settings.tradeAIDifficulty).toBe('shark');
    expect(settings.ownerPatience).toBe('win_now');
  });

  it('sandbox preset removes constraints', () => {
    const settings = createSettings('living', 'sandbox');
    expect(settings.salarySystem).toBe('no_cap');
    expect(settings.fireRisk).toBe(false);
    expect(settings.prospectBustRate).toBe(0);
    expect(settings.scoutingAccuracy).toBe('perfect');
  });

  it('overrides take precedence over preset', () => {
    const settings = createSettings('classic', 'casual', { seasonLength: 82, teamCount: 24 });
    expect(settings.seasonLength).toBe(82);
    expect(settings.teamCount).toBe(24);
    // Other casual defaults still apply
    expect(settings.injuryFrequency).toBe('rare');
  });

  it('living mode settings include RPG options', () => {
    const settings = createSettings('living');
    expect(settings.personalFinanceComplexity).toBe('full');
    expect(settings.relationshipDepth).toBe('deep');
    expect(settings.notificationStyle).toBe('inbox_texts');
  });

  it('character archetypes have 10 options', () => {
    expect(CHARACTER_ARCHETYPES).toHaveLength(10);
    expect(CHARACTER_ARCHETYPES.every(a => a.id && a.label && a.traitEffects)).toBe(true);
  });

  it('each archetype has at least one trait effect', () => {
    for (const arch of CHARACTER_ARCHETYPES) {
      const keys = Object.keys(arch.traitEffects);
      expect(keys.length).toBeGreaterThanOrEqual(1);
    }
  });
});

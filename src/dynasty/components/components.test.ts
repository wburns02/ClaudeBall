import { describe, it, expect } from 'vitest';
import { personalityFromMental, randomPersonality, ratingTo2080 } from './Personality.ts';
import { createRelationships, getAffinity, adjustAffinity, addTag } from './Relationships.ts';
import { createReputation, adjustReputation, getReputationLabel } from './Reputation.ts';
import type { MentalRatings } from '@/engine/types/player.ts';

describe('Personality', () => {
  const mental: MentalRatings = {
    intelligence: 100, work_ethic: 0, durability: 50,
    consistency: 50, composure: 50, leadership: 50,
  };
  let seed = 42;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  it('ratingTo2080 maps 0 → 20 and 100 → 80', () => {
    expect(ratingTo2080(0)).toBe(20);
    expect(ratingTo2080(100)).toBe(80);
    expect(ratingTo2080(50)).toBe(50);
  });

  it('maps mental ratings correctly', () => {
    seed = 42;
    const p = personalityFromMental(mental, rng);
    expect(p.baseballIQ).toBe(80); // 100 * 0.6 + 20 = 80
    expect(p.workEthic).toBe(20);  // 0 * 0.6 + 20 = 20
  });

  it('all random traits are in 20-80 range', () => {
    seed = 1;
    const p = randomPersonality(rng);
    for (const key of Object.keys(p) as (keyof typeof p)[]) {
      if (key === 'type') continue;
      expect(p[key]).toBeGreaterThanOrEqual(20);
      expect(p[key]).toBeLessThanOrEqual(80);
    }
  });
});

describe('Relationships', () => {
  it('getAffinity returns 0 for unknown target', () => {
    const rel = createRelationships();
    expect(getAffinity(rel, 'unknown')).toBe(0);
  });

  it('adjustAffinity clamps to -100..+100', () => {
    const rel = createRelationships();
    adjustAffinity(rel, 'x', 200, 'test', 1);
    expect(getAffinity(rel, 'x')).toBe(100);
    adjustAffinity(rel, 'x', -300, 'test', 1);
    expect(getAffinity(rel, 'x')).toBe(-100);
  });

  it('addTag does not duplicate', () => {
    const rel = createRelationships();
    adjustAffinity(rel, 'x', 10, 'test', 1);
    addTag(rel, 'x', 'friend');
    addTag(rel, 'x', 'friend');
    expect(rel.bonds['x'].tags).toEqual(['professional', 'friend']);
  });

  it('records history entries', () => {
    const rel = createRelationships();
    adjustAffinity(rel, 'x', 10, 'helped', 1);
    adjustAffinity(rel, 'x', -5, 'argued', 2);
    expect(rel.bonds['x'].history).toHaveLength(2);
    expect(rel.bonds['x'].history[0].event).toBe('helped');
  });
});

describe('Reputation', () => {
  it('adjustReputation clamps to -100..+100', () => {
    const rep = createReputation();
    adjustReputation(rep, 'fan', 150);
    expect(rep.fan).toBe(100);
    adjustReputation(rep, 'fan', -250);
    expect(rep.fan).toBe(-100);
  });

  it('getReputationLabel boundary values', () => {
    expect(getReputationLabel(60)).toBe('Beloved');
    expect(getReputationLabel(59)).toBe('Liked');
    expect(getReputationLabel(20)).toBe('Liked');
    expect(getReputationLabel(19)).toBe('Neutral');
    expect(getReputationLabel(-20)).toBe('Neutral');
    expect(getReputationLabel(-21)).toBe('Disliked');
    expect(getReputationLabel(-60)).toBe('Disliked');
    expect(getReputationLabel(-61)).toBe('Hated');
  });

  it('starts at zero for all meters', () => {
    const rep = createReputation();
    expect(rep.clubhouse).toBe(0);
    expect(rep.media).toBe(0);
    expect(rep.fan).toBe(0);
  });
});

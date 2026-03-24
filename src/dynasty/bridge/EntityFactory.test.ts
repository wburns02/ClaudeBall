import { describe, it, expect } from 'vitest';
import { EntityFactory } from './EntityFactory.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { SkillsComponent } from '../components/Skills.ts';
import type { CareerComponent } from '../components/Career.ts';
import type { Player } from '@/engine/types/player.ts';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1', firstName: 'Mike', lastName: 'Trout', number: 27,
    position: 'CF' as any, bats: 'R' as any, throws: 'R' as any, age: 28,
    batting: { contact_L: 70, contact_R: 80, power_L: 85, power_R: 90, eye: 75, avoid_k: 60, gap_power: 70, speed: 65, steal: 50, bunt: 30, clutch: 70 },
    pitching: { stuff: 30, movement: 25, control: 30, stamina: 20, velocity: 80, hold_runners: 40, groundball_pct: 50, repertoire: ['fastball' as any] },
    fielding: [{ position: 'CF' as any, range: 75, arm_strength: 70, arm_accuracy: 65, turn_dp: 40, error_rate: 15 }],
    mental: { intelligence: 70, work_ethic: 80, durability: 75, consistency: 65, composure: 60, leadership: 55 },
    state: { fatigue: 0, morale: 80, pitchCount: 0, isInjured: false },
    ...overrides,
  } as Player;
}

describe('EntityFactory', () => {
  it('creates a player entity with all 5 components', () => {
    const em = new EntityManager();
    const factory = new EntityFactory(em);
    const entityId = factory.createPlayerEntity(makePlayer(), 'team1');

    expect(em.entityExists(entityId)).toBe(true);
    expect(em.getComponent(entityId, 'Personality')).toBeDefined();
    expect(em.getComponent(entityId, 'Relationships')).toBeDefined();
    expect(em.getComponent(entityId, 'Reputation')).toBeDefined();
    expect(em.getComponent(entityId, 'Skills')).toBeDefined();
    expect(em.getComponent(entityId, 'Career')).toBeDefined();
  });

  it('maps player ID to entity ID bidirectionally', () => {
    const em = new EntityManager();
    const factory = new EntityFactory(em);
    const entityId = factory.createPlayerEntity(makePlayer({ id: 'player-abc' }), 'team1');

    expect(factory.getEntityId('player-abc')).toBe(entityId);
    expect(factory.getPlayerId(entityId)).toBe('player-abc');
  });

  it('personality wraps mental ratings correctly', () => {
    const em = new EntityManager();
    const factory = new EntityFactory(em);
    const entityId = factory.createPlayerEntity(makePlayer(), 'team1');
    const p = em.getComponent<PersonalityComponent>(entityId, 'Personality')!;

    expect(p.workEthic).toBe(68); // ratingTo2080(80)
    expect(p.baseballIQ).toBe(62); // ratingTo2080(70)
  });

  it('career component has correct role and team', () => {
    const em = new EntityManager();
    const factory = new EntityFactory(em);
    const entityId = factory.createPlayerEntity(makePlayer(), 'team-xyz');
    const c = em.getComponent<CareerComponent>(entityId, 'Career')!;

    expect(c.currentRole).toBe('player');
    expect(c.currentTeamId).toBe('team-xyz');
  });

  it('does not create duplicate entities for same player ID', () => {
    const em = new EntityManager();
    const factory = new EntityFactory(em);
    const id1 = factory.createPlayerEntity(makePlayer({ id: 'p1' }), 'team1');
    const id2 = factory.createPlayerEntity(makePlayer({ id: 'p1' }), 'team1');
    expect(id1).toBe(id2);
  });

  it('creates NPC entity with personality but no skills', () => {
    const em = new EntityManager();
    const factory = new EntityFactory(em);
    const entityId = factory.createNPCEntity('owner-1', 'owner');

    expect(em.getComponent(entityId, 'Personality')).toBeDefined();
    expect(em.getComponent(entityId, 'Reputation')).toBeDefined();
    expect(em.getComponent(entityId, 'Skills')).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import { EventBus } from './EventBus.ts';
import { EntityManager } from './EntityManager.ts';
import { SystemRunner } from './SystemRunner.ts';
import { PersonalitySystem } from '../systems/PersonalitySystem.ts';
import { RelationshipSystem } from '../systems/RelationshipSystem.ts';
import { ReputationSystem } from '../systems/ReputationSystem.ts';
import { personalityFromMental } from '../components/Personality.ts';
import { createRelationships, getAffinity, adjustAffinity } from '../components/Relationships.ts';
import { createReputation, getReputationLabel } from '../components/Reputation.ts';
import { createCareer } from '../components/Career.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { ReputationComponent } from '../components/Reputation.ts';
import type { RelationshipsComponent } from '../components/Relationships.ts';
import type { MentalRatings } from '@/engine/types/player.ts';
import type { PlayerTradedEvent, AwardWonEvent } from './types.ts';

describe('ECS Integration', () => {
  function buildWorld() {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'classic');

    runner.addSystem(new PersonalitySystem(em, bus));
    runner.addSystem(new RelationshipSystem(em, bus));
    runner.addSystem(new ReputationSystem(em, bus));

    return { bus, em, runner };
  }

  it('creates a player entity with all core components', () => {
    const { em } = buildWorld();

    const id = em.createEntity();
    const mental: MentalRatings = {
      intelligence: 70, work_ethic: 80, durability: 60,
      consistency: 55, composure: 65, leadership: 75,
    };
    let seed = 42;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    em.addComponent(id, personalityFromMental(mental, rng));
    em.addComponent(id, createRelationships());
    em.addComponent(id, createReputation());
    em.addComponent(id, createCareer('player', 'team1'));

    const p = em.getComponent<PersonalityComponent>(id, 'Personality')!;
    expect(p.workEthic).toBe(68); // ratingTo2080(80) = 68
    expect(p.baseballIQ).toBe(62); // ratingTo2080(70) = 62
    expect(p.leadership).toBe(65); // ratingTo2080(75) = 65
  });

  it('fires PlayerTraded and all systems react', () => {
    const { bus, em } = buildWorld();

    const playerId = em.createEntity();
    em.addComponent(playerId, {
      type: 'Personality', workEthic: 50, ego: 50, loyalty: 70, charisma: 50,
      baseballIQ: 50, composure: 60, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    } as PersonalityComponent);
    em.addComponent(playerId, createRelationships());
    em.addComponent(playerId, createReputation());

    const gmId = em.createEntity();
    em.addComponent(gmId, {
      type: 'Personality', workEthic: 50, ego: 50, loyalty: 50, charisma: 50,
      baseballIQ: 70, composure: 60, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    } as PersonalityComponent);
    em.addComponent(gmId, createRelationships());
    em.addComponent(gmId, createReputation());

    const event: PlayerTradedEvent = {
      type: 'PlayerTraded', timestamp: Date.now(),
      data: { playerId, fromTeamId: 't1', toTeamId: 't2', gmEntityId: gmId },
    };
    bus.emit(event);

    // PersonalitySystem: composure reduced for loyal player
    const playerPers = em.getComponent<PersonalityComponent>(playerId, 'Personality')!;
    expect(playerPers.composure).toBeLessThan(60);

    // RelationshipSystem: negative bond player→GM
    const playerRel = em.getComponent<RelationshipsComponent>(playerId, 'Relationships')!;
    expect(getAffinity(playerRel, gmId)).toBeLessThan(0);

    // EventBus: history recorded
    expect(bus.getHistory('PlayerTraded')).toHaveLength(1);
  });

  it('MVP award boosts reputation across all meters', () => {
    const { bus, em } = buildWorld();

    const id = em.createEntity();
    em.addComponent(id, {
      type: 'Personality', workEthic: 50, ego: 50, loyalty: 50, charisma: 50,
      baseballIQ: 50, composure: 50, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    } as PersonalityComponent);
    em.addComponent(id, createReputation());

    bus.emit({
      type: 'AwardWon', timestamp: 1,
      data: { playerId: id, award: 'MVP', league: 'AL' },
    } as AwardWonEvent);

    const rep = em.getComponent<ReputationComponent>(id, 'Reputation')!;
    expect(rep.clubhouse).toBe(5);
    expect(rep.media).toBe(10);
    expect(rep.fan).toBe(8);
    expect(getReputationLabel(rep.fan)).toBe('Neutral');
  });

  it('serializes and restores full world state including relationships', () => {
    const { em } = buildWorld();

    const id1 = em.createEntity();
    const id2 = em.createEntity();
    em.addComponent(id1, {
      type: 'Personality', workEthic: 65, ego: 45, loyalty: 70, charisma: 50,
      baseballIQ: 55, composure: 60, leadership: 70, aggression: 30, coachability: 60, integrity: 75,
    } as PersonalityComponent);
    em.addComponent(id1, createReputation());
    const rel = createRelationships();
    adjustAffinity(rel, id2, 42, 'test_bond', 1);
    em.addComponent(id1, rel);

    const snapshot = em.serialize();
    const restored = EntityManager.deserialize(snapshot);

    const p = restored.getComponent<PersonalityComponent>(id1, 'Personality')!;
    expect(p.workEthic).toBe(65);
    expect(p.integrity).toBe(75);

    const r = restored.getComponent<ReputationComponent>(id1, 'Reputation')!;
    expect(r.clubhouse).toBe(0);

    // Relationships with Record (not Map) survive JSON serialization
    const restoredRel = restored.getComponent<RelationshipsComponent>(id1, 'Relationships')!;
    expect(restoredRel.bonds[id2].affinity).toBe(42);
    expect(restoredRel.bonds[id2].history).toHaveLength(1);
  });

  it('living mode enables all systems, classic skips living-only', () => {
    const bus = new EventBus();
    const em = new EntityManager();

    let livingTicked = false;
    const livingSystem = {
      name: 'MockLivingSystem',
      modes: ['living' as const],
      tick: () => { livingTicked = true; },
    };

    const classicRunner = new SystemRunner(bus, em, 'classic');
    classicRunner.addSystem(livingSystem);
    classicRunner.tick(1);
    expect(livingTicked).toBe(false);

    const livingRunner = new SystemRunner(bus, em, 'living');
    livingRunner.addSystem(livingSystem);
    livingRunner.tick(1);
    expect(livingTicked).toBe(true);
  });
});

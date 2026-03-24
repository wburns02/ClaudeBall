import { describe, it, expect } from 'vitest';
import { PersonalitySystem } from './PersonalitySystem.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import { EventBus } from '../ecs/EventBus.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { PlayerTradedEvent, AwardWonEvent } from '../ecs/types.ts';

describe('PersonalitySystem', () => {
  function setup() {
    const bus = new EventBus();
    const em = new EntityManager();
    const sys = new PersonalitySystem(em, bus);
    return { bus, em, sys };
  }

  it('does not crash on tick with no entities', () => {
    const { sys } = setup();
    expect(() => sys.tick(1)).not.toThrow();
  });

  it('nudges composure down on trade event for traded player', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, {
      type: 'Personality', workEthic: 50, ego: 60, loyalty: 70, charisma: 50,
      baseballIQ: 50, composure: 50, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    } as PersonalityComponent);

    sys.handleEvent!({
      type: 'PlayerTraded', timestamp: 1,
      data: { playerId: id, fromTeamId: 't1', toTeamId: 't2' },
    } as PlayerTradedEvent);

    const updated = em.getComponent<PersonalityComponent>(id, 'Personality')!;
    expect(updated.composure).toBeLessThan(50);
  });

  it('boosts ego slightly on award win', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, {
      type: 'Personality', workEthic: 50, ego: 50, loyalty: 50, charisma: 50,
      baseballIQ: 50, composure: 50, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    } as PersonalityComponent);

    sys.handleEvent!({
      type: 'AwardWon', timestamp: 1,
      data: { playerId: id, award: 'MVP', league: 'AL' },
    } as AwardWonEvent);

    const updated = em.getComponent<PersonalityComponent>(id, 'Personality')!;
    expect(updated.ego).toBeGreaterThan(50);
  });

  it('clamps trait values to 20-80', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, {
      type: 'Personality', workEthic: 50, ego: 79, loyalty: 50, charisma: 50,
      baseballIQ: 50, composure: 50, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    } as PersonalityComponent);

    for (let i = 0; i < 10; i++) {
      sys.handleEvent!({
        type: 'AwardWon', timestamp: i,
        data: { playerId: id, award: 'MVP', league: 'AL' },
      } as AwardWonEvent);
    }

    const updated = em.getComponent<PersonalityComponent>(id, 'Personality')!;
    expect(updated.ego).toBeLessThanOrEqual(80);
  });
});

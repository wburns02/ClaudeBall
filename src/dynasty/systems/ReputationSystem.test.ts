import { describe, it, expect } from 'vitest';
import { ReputationSystem } from './ReputationSystem.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import { EventBus } from '../ecs/EventBus.ts';
import { createReputation, getReputationLabel } from '../components/Reputation.ts';
import type { ReputationComponent } from '../components/Reputation.ts';
import type { ReputationShiftEvent, AwardWonEvent } from '../ecs/types.ts';

describe('ReputationSystem', () => {
  function setup() {
    const bus = new EventBus();
    const em = new EntityManager();
    const sys = new ReputationSystem(em, bus);
    return { bus, em, sys };
  }

  it('applies direct reputation shift events', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, createReputation());

    sys.handleEvent!({
      type: 'ReputationShift', timestamp: 1,
      data: { entityId: id, meter: 'fan', delta: 15, reason: 'walkoff_homer' },
    } as ReputationShiftEvent);

    const rep = em.getComponent<ReputationComponent>(id, 'Reputation')!;
    expect(rep.fan).toBe(15);
  });

  it('boosts all three meters on award win', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, createReputation());

    sys.handleEvent!({
      type: 'AwardWon', timestamp: 1,
      data: { playerId: id, award: 'MVP', league: 'AL' },
    } as AwardWonEvent);

    const rep = em.getComponent<ReputationComponent>(id, 'Reputation')!;
    expect(rep.clubhouse).toBeGreaterThan(0);
    expect(rep.media).toBeGreaterThan(0);
    expect(rep.fan).toBeGreaterThan(0);
  });

  it('clamps reputation to -100..+100', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    const rep = createReputation();
    rep.fan = 95;
    em.addComponent(id, rep);

    sys.handleEvent!({
      type: 'ReputationShift', timestamp: 1,
      data: { entityId: id, meter: 'fan', delta: 50, reason: 'test' },
    } as ReputationShiftEvent);

    const updated = em.getComponent<ReputationComponent>(id, 'Reputation')!;
    expect(updated.fan).toBe(100);
  });

  it('reputation labels map correctly', () => {
    expect(getReputationLabel(80)).toBe('Beloved');
    expect(getReputationLabel(30)).toBe('Liked');
    expect(getReputationLabel(0)).toBe('Neutral');
    expect(getReputationLabel(-40)).toBe('Disliked');
    expect(getReputationLabel(-80)).toBe('Hated');
  });
});

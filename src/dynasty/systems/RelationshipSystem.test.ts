import { describe, it, expect } from 'vitest';
import { RelationshipSystem } from './RelationshipSystem.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import { EventBus } from '../ecs/EventBus.ts';
import { createRelationships, getAffinity } from '../components/Relationships.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { PlayerTradedEvent } from '../ecs/types.ts';

function makePersonality(overrides: Partial<PersonalityComponent> = {}): PersonalityComponent {
  return {
    type: 'Personality', workEthic: 50, ego: 50, loyalty: 50, charisma: 50,
    baseballIQ: 50, composure: 50, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    ...overrides,
  };
}

describe('RelationshipSystem', () => {
  function setup() {
    const bus = new EventBus();
    const em = new EntityManager();
    const sys = new RelationshipSystem(em, bus);
    return { bus, em, sys };
  }

  it('creates negative bond when loyal player is traded', () => {
    const { em, sys } = setup();

    const playerId = em.createEntity();
    em.addComponent(playerId, makePersonality({ loyalty: 70 }));
    em.addComponent(playerId, createRelationships());

    const gmId = em.createEntity();
    em.addComponent(gmId, makePersonality());
    em.addComponent(gmId, createRelationships());

    sys.handleEvent!({
      type: 'PlayerTraded', timestamp: 1,
      data: { playerId, fromTeamId: 't1', toTeamId: 't2', gmEntityId: gmId },
    } as PlayerTradedEvent);

    const playerRel = em.getComponent(playerId, 'Relationships')!;
    expect(getAffinity(playerRel as any, gmId)).toBeLessThan(0);
  });

  it('computes positive team chemistry from friendly relationships', () => {
    const { em, sys } = setup();

    const ids = [em.createEntity(), em.createEntity(), em.createEntity()];
    for (const id of ids) {
      em.addComponent(id, makePersonality({ leadership: 70 }));
      const rel = createRelationships();
      for (const otherId of ids) {
        if (otherId !== id) {
          rel.bonds[otherId] = { targetId: otherId, affinity: 50, history: [], tags: ['friend'] };
        }
      }
      em.addComponent(id, rel);
    }

    const chemistry = sys.computeTeamChemistry(ids);
    expect(chemistry).toBeGreaterThan(0);
    expect(chemistry).toBeLessThanOrEqual(10);
  });

  it('returns negative chemistry for feuding players', () => {
    const { em, sys } = setup();

    const ids = [em.createEntity(), em.createEntity()];
    for (const id of ids) {
      em.addComponent(id, makePersonality({ leadership: 30 }));
      const rel = createRelationships();
      for (const otherId of ids) {
        if (otherId !== id) {
          rel.bonds[otherId] = { targetId: otherId, affinity: -70, history: [], tags: ['adversarial'] };
        }
      }
      em.addComponent(id, rel);
    }

    const chemistry = sys.computeTeamChemistry(ids);
    expect(chemistry).toBeLessThan(0);
  });

  it('applies extra feuding penalty for affinity < -50', () => {
    const { em, sys } = setup();

    // Two players: one pair at -49 (no feud penalty), one at -51 (feud penalty)
    const ids1 = [em.createEntity(), em.createEntity()];
    for (const id of ids1) {
      em.addComponent(id, makePersonality({ leadership: 50 }));
      const rel = createRelationships();
      for (const otherId of ids1) {
        if (otherId !== id) rel.bonds[otherId] = { targetId: otherId, affinity: -49, history: [], tags: ['tense'] };
      }
      em.addComponent(id, rel);
    }

    const ids2 = [em.createEntity(), em.createEntity()];
    for (const id of ids2) {
      em.addComponent(id, makePersonality({ leadership: 50 }));
      const rel = createRelationships();
      for (const otherId of ids2) {
        if (otherId !== id) rel.bonds[otherId] = { targetId: otherId, affinity: -51, history: [], tags: ['adversarial'] };
      }
      em.addComponent(id, rel);
    }

    const chem1 = sys.computeTeamChemistry(ids1);
    const chem2 = sys.computeTeamChemistry(ids2);
    // -51 should be worse than -49 by more than just the 2-point affinity diff (feuding penalty)
    expect(chem2).toBeLessThan(chem1);
  });
});

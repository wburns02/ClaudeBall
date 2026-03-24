import { describe, it, expect } from 'vitest';
import { EntityManager } from './EntityManager.ts';
import type { Component } from './types.ts';

interface TestPersonality extends Component {
  type: 'Personality';
  workEthic: number;
  ego: number;
}

interface TestReputation extends Component {
  type: 'Reputation';
  clubhouse: number;
  media: number;
  fan: number;
}

describe('EntityManager', () => {
  it('creates entities with unique IDs', () => {
    const em = new EntityManager();
    const id1 = em.createEntity();
    const id2 = em.createEntity();
    expect(id1).not.toBe(id2);
    expect(em.entityExists(id1)).toBe(true);
  });

  it('attaches and retrieves components', () => {
    const em = new EntityManager();
    const id = em.createEntity();
    const personality: TestPersonality = { type: 'Personality', workEthic: 70, ego: 40 };

    em.addComponent(id, personality);
    const result = em.getComponent<TestPersonality>(id, 'Personality');
    expect(result).toEqual(personality);
  });

  it('returns undefined for missing components', () => {
    const em = new EntityManager();
    const id = em.createEntity();
    expect(em.getComponent(id, 'Personality')).toBeUndefined();
  });

  it('removes components', () => {
    const em = new EntityManager();
    const id = em.createEntity();
    em.addComponent(id, { type: 'Personality', workEthic: 70, ego: 40 } as TestPersonality);
    em.removeComponent(id, 'Personality');
    expect(em.getComponent(id, 'Personality')).toBeUndefined();
  });

  it('destroys entities and all their components', () => {
    const em = new EntityManager();
    const id = em.createEntity();
    em.addComponent(id, { type: 'Personality', workEthic: 70, ego: 40 } as TestPersonality);
    em.destroyEntity(id);
    expect(em.entityExists(id)).toBe(false);
    expect(em.getComponent(id, 'Personality')).toBeUndefined();
  });

  it('queries entities by component type', () => {
    const em = new EntityManager();
    const id1 = em.createEntity();
    const id2 = em.createEntity();
    const id3 = em.createEntity();

    em.addComponent(id1, { type: 'Personality', workEthic: 70, ego: 40 } as TestPersonality);
    em.addComponent(id2, { type: 'Personality', workEthic: 50, ego: 80 } as TestPersonality);
    em.addComponent(id2, { type: 'Reputation', clubhouse: 10, media: 20, fan: 30 } as TestReputation);

    const withPersonality = em.getEntitiesWith('Personality');
    expect(withPersonality).toHaveLength(2);
    expect(withPersonality).toContain(id1);
    expect(withPersonality).toContain(id2);
    expect(withPersonality).not.toContain(id3);
  });

  it('queries entities with multiple component types', () => {
    const em = new EntityManager();
    const id1 = em.createEntity();
    const id2 = em.createEntity();

    em.addComponent(id1, { type: 'Personality', workEthic: 70, ego: 40 } as TestPersonality);
    em.addComponent(id2, { type: 'Personality', workEthic: 50, ego: 80 } as TestPersonality);
    em.addComponent(id2, { type: 'Reputation', clubhouse: 10, media: 20, fan: 30 } as TestReputation);

    const withBoth = em.getEntitiesWith('Personality', 'Reputation');
    expect(withBoth).toHaveLength(1);
    expect(withBoth[0]).toBe(id2);
  });

  it('serializes and deserializes all state', () => {
    const em = new EntityManager();
    const id = em.createEntity();
    em.addComponent(id, { type: 'Personality', workEthic: 70, ego: 40 } as TestPersonality);

    const snapshot = em.serialize();
    const em2 = EntityManager.deserialize(snapshot);
    const restored = em2.getComponent<TestPersonality>(id, 'Personality');
    expect(restored?.workEthic).toBe(70);
  });
});

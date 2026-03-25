import { describe, it, expect } from 'vitest';
import { DynastySaveManager } from './DynastySaveManager.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { PhaseState } from '../phases/PhaseRunner.ts';

describe('DynastySaveManager', () => {
  const mockPhaseState: PhaseState = {
    currentPhase: 'regular_season',
    offseasonWeek: 0,
    offseasonMonth: 0,
    seasonDay: 45,
    year: 2026,
  };

  describe('createSaveData', () => {
    it('creates save data from current state', () => {
      const em = new EntityManager();
      const id = em.createEntity();
      em.addComponent(id, {
        type: 'Personality', workEthic: 70, ego: 50, loyalty: 60, charisma: 55,
        baseballIQ: 65, composure: 50, leadership: 60, aggression: 40, coachability: 55, integrity: 70,
      } as PersonalityComponent);

      const save = DynastySaveManager.createSaveData('classic', em, mockPhaseState, [], [], {}, 3);

      expect(save.version).toBe(1);
      expect(save.mode).toBe('classic');
      expect(save.dynastyYear).toBe(3);
      expect(save.phaseState.currentPhase).toBe('regular_season');
      expect(save.entityManagerSnapshot.entities).toBeDefined();
    });
  });

  describe('exportToJSON / importFromJSON', () => {
    it('round-trips save data through JSON', () => {
      const em = new EntityManager();
      const id = em.createEntity();
      em.addComponent(id, {
        type: 'Personality', workEthic: 70, ego: 50, loyalty: 60, charisma: 55,
        baseballIQ: 65, composure: 50, leadership: 60, aggression: 40, coachability: 55, integrity: 70,
      } as PersonalityComponent);

      const save = DynastySaveManager.createSaveData('living', em, mockPhaseState);
      const json = DynastySaveManager.exportToJSON(save);
      const restored = DynastySaveManager.importFromJSON(json);

      expect(restored).not.toBeNull();
      expect(restored!.mode).toBe('living');
      expect(restored!.phaseState.year).toBe(2026);

      // Verify entity data survived
      const restoredEm = EntityManager.deserialize(restored!.entityManagerSnapshot);
      const p = restoredEm.getComponent<PersonalityComponent>(id, 'Personality');
      expect(p?.workEthic).toBe(70);
    });

    it('returns null for invalid JSON', () => {
      expect(DynastySaveManager.importFromJSON('not json')).toBeNull();
      expect(DynastySaveManager.importFromJSON('{}')).toBeNull();
      expect(DynastySaveManager.importFromJSON('{"version":1}')).toBeNull();
    });

    it('preserves conversation log through serialization', () => {
      const em = new EntityManager();
      const log = [{
        templateId: 'test-001',
        situation: 'trade_call' as const,
        nodePathIds: ['n1', 'n2'],
        effects: { affinity: 5 },
        timestamp: 1234567890,
      }];

      const save = DynastySaveManager.createSaveData('classic', em, mockPhaseState, [], log);
      const json = DynastySaveManager.exportToJSON(save);
      const restored = DynastySaveManager.importFromJSON(json);

      expect(restored!.conversationLog).toHaveLength(1);
      expect(restored!.conversationLog[0].templateId).toBe('test-001');
    });

    it('preserves inbox items through serialization', () => {
      const em = new EntityManager();
      const items = [{
        id: 'inbox_1', type: 'actionable' as const, priority: 'high' as const,
        title: 'Trade Offer', description: 'Yankees want your closer',
        isRead: false, isActedOn: false, week: 3, timestamp: Date.now(),
      }];

      const save = DynastySaveManager.createSaveData('classic', em, mockPhaseState, items);
      const json = DynastySaveManager.exportToJSON(save);
      const restored = DynastySaveManager.importFromJSON(json);

      expect(restored!.inboxItems).toHaveLength(1);
      expect(restored!.inboxItems[0].title).toBe('Trade Offer');
    });
  });
});

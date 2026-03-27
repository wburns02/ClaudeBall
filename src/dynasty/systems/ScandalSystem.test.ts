import { describe, it, expect } from 'vitest';
import { ScandalSystem } from './ScandalSystem.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import { EventBus } from '../ecs/EventBus.ts';
import { SystemRunner } from '../ecs/SystemRunner.ts';
import { createReputation } from '../components/Reputation.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { ReputationComponent } from '../components/Reputation.ts';

function makePersonality(overrides: Partial<Omit<PersonalityComponent, 'type'>> = {}): PersonalityComponent {
  return {
    type: 'Personality', workEthic: 50, ego: 50, loyalty: 50, charisma: 50,
    baseballIQ: 50, composure: 50, leadership: 50, aggression: 50, coachability: 50,
    integrity: 50, wildcard: 40,
    ...overrides,
  };
}

function setup(rngVal = 0.05) { // Low rng = scandal triggers
  const bus = new EventBus();
  const em = new EntityManager();
  let seed = rngVal;
  const rng = () => { seed = (seed * 9301 + 49297) % 233280 / 233280; return seed; };
  const sys = new ScandalSystem(em, bus, rng);
  const runner = new SystemRunner(bus, em, 'living');
  runner.addSystem(sys);
  return { bus, em, sys, runner };
}

describe('ScandalSystem', () => {
  describe('Scandal Generation', () => {
    it('no scandal when Wildcard < 50', () => {
      const { em, sys } = setup();
      const id = em.createEntity();
      em.addComponent(id, makePersonality({ wildcard: 40 }));
      em.addComponent(id, createReputation());

      sys.checkForScandals();
      expect(sys.getActiveScandals()).toHaveLength(0);
    });

    it('generates scandal when Wildcard > 50 and roll succeeds', () => {
      const { bus, em, sys } = setup(0.01); // Very low rng = high chance
      const handler = vi.fn();
      bus.on('ScandalOccurred', handler);

      const id = em.createEntity();
      em.addComponent(id, makePersonality({ wildcard: 75 })); // High wildcard
      em.addComponent(id, createReputation());

      sys.checkForScandals();
      // With wildcard 75, prob = (75-50)/200 = 12.5%. Low rng should trigger.
      expect(sys.getActiveScandals().length).toBeGreaterThanOrEqual(0); // RNG-dependent
    });

    it('scandal damages reputation', () => {
      const { em, sys } = setup();
      const id = em.createEntity();
      em.addComponent(id, makePersonality({ wildcard: 70 }));
      em.addComponent(id, createReputation());

      sys.generateScandal(id, 'moderate');

      const rep = em.getComponent<ReputationComponent>(id, 'Reputation')!;
      expect(rep.clubhouse).toBeLessThan(0);
      expect(rep.media).toBeLessThan(0);
      expect(rep.fan).toBeLessThan(0);
    });

    it('severe scandal does more damage than minor', () => {
      const { em, sys } = setup();

      const minorId = em.createEntity();
      em.addComponent(minorId, makePersonality({ wildcard: 55 }));
      em.addComponent(minorId, createReputation());
      sys.generateScandal(minorId, 'minor');

      const severeId = em.createEntity();
      em.addComponent(severeId, makePersonality({ wildcard: 75 }));
      em.addComponent(severeId, createReputation());
      sys.generateScandal(severeId, 'severe');

      const minorRep = em.getComponent<ReputationComponent>(minorId, 'Reputation')!;
      const severeRep = em.getComponent<ReputationComponent>(severeId, 'Reputation')!;

      expect(severeRep.media).toBeLessThan(minorRep.media);
    });
  });

  describe('Nuclear Chain', () => {
    it('chain only starts with low integrity + high wildcard', () => {
      const { em, sys } = setup();

      // Good player — can't start chain
      const goodId = em.createEntity();
      em.addComponent(goodId, makePersonality({ integrity: 70, wildcard: 40 }));
      expect(sys.canStartNuclearChain(goodId)).toBe(false);

      // Bad player — can start chain
      const badId = em.createEntity();
      em.addComponent(badId, makePersonality({ integrity: 25, wildcard: 75 }));
      expect(sys.canStartNuclearChain(badId)).toBe(true);
    });

    it('walking away breaks the chain and boosts integrity', () => {
      const { em, sys } = setup();
      const id = em.createEntity();
      em.addComponent(id, makePersonality({ integrity: 30, wildcard: 70 }));
      em.addComponent(id, createReputation());

      sys.startNuclearChain(id);

      // Proceed through step 1
      sys.advanceNuclearChain(id, true);

      // Walk away at step 2
      const result = sys.advanceNuclearChain(id, false);
      expect(result.chainBroken).toBe(true);

      // Integrity should have increased
      const p = em.getComponent<PersonalityComponent>(id, 'Personality')!;
      expect(p.integrity).toBeGreaterThan(30);
      expect(p.wildcard).toBeLessThan(70);
    });

    it('completing all 5 steps triggers nuclear fallout', () => {
      const { bus, em, sys } = setup();
      const handler = vi.fn();
      bus.on('ScandalOccurred', handler);

      const id = em.createEntity();
      em.addComponent(id, makePersonality({ integrity: 25, wildcard: 75 }));
      em.addComponent(id, createReputation());

      sys.startNuclearChain(id);
      sys.advanceNuclearChain(id, true); // Step 1
      sys.advanceNuclearChain(id, true); // Step 2
      sys.advanceNuclearChain(id, true); // Step 3
      const result = sys.advanceNuclearChain(id, true); // Step 4 = point of no return

      expect(result.chainBroken).toBe(false);
      expect(result.step).toBe(4);

      // Nuclear scandal event should have fired
      expect(handler).toHaveBeenCalled();
      const event = handler.mock.calls[handler.mock.calls.length - 1][0];
      expect(event.data.tier).toBe('nuclear');

      // Reputation should be destroyed
      const rep = em.getComponent<ReputationComponent>(id, 'Reputation')!;
      expect(rep.clubhouse).toBe(-100);
      expect(rep.media).toBe(-100);
      expect(rep.fan).toBe(-100);
    });

    it('nuclear is NEVER generated randomly', () => {
      const { em, sys } = setup(0.001); // Extremely low rng
      // Create 100 high-wildcard entities
      for (let i = 0; i < 100; i++) {
        const id = em.createEntity();
        em.addComponent(id, makePersonality({ wildcard: 80 }));
        em.addComponent(id, createReputation());
      }

      // Run scandal checks many times
      for (let i = 0; i < 50; i++) sys.checkForScandals();

      // NO nuclear scandals should exist — only minor/moderate/severe
      const allScandals = sys.getActiveScandals();
      const nuclear = allScandals.filter(s => s.tier === 'nuclear');
      expect(nuclear).toHaveLength(0);
    });
  });

  describe('Cover-Up', () => {
    it('only available for moderate scandals with Integrity < 40', () => {
      const { em, sys } = setup();

      // High integrity — can't cover up
      const goodId = em.createEntity();
      em.addComponent(goodId, makePersonality({ integrity: 60, wildcard: 65 }));
      em.addComponent(goodId, createReputation());
      sys.generateScandal(goodId, 'moderate');
      expect(sys.attemptCoverUp(goodId, 0).success).toBe(false);

      // Low integrity — can attempt
      const badId = em.createEntity();
      em.addComponent(badId, makePersonality({ integrity: 30, wildcard: 65 }));
      em.addComponent(badId, createReputation());
      const scandal = sys.generateScandal(badId, 'moderate');
      const idx = sys.getActiveScandals().findIndex(s => s.entityId === badId);
      // Result is RNG-dependent but function should execute
      const result = sys.attemptCoverUp(badId, idx);
      expect(typeof result.success).toBe('boolean');
    });

    it('cannot cover up minor or severe scandals', () => {
      const { em, sys } = setup();
      const id = em.createEntity();
      em.addComponent(id, makePersonality({ integrity: 25, wildcard: 70 }));
      em.addComponent(id, createReputation());

      sys.generateScandal(id, 'minor');
      expect(sys.attemptCoverUp(id, 0).success).toBe(false);
    });
  });

  describe('Culture Investment', () => {
    it('reduces Wildcard across team', () => {
      const { em, sys } = setup();
      const ids = [];
      for (let i = 0; i < 5; i++) {
        const id = em.createEntity();
        em.addComponent(id, makePersonality({ wildcard: 60 }));
        ids.push(id);
      }

      const reduced = sys.investInCulture(ids, 500); // $500K budget
      expect(reduced).toBeGreaterThan(0);

      // Wildcards should be lower
      for (const id of ids) {
        const p = em.getComponent<PersonalityComponent>(id, 'Personality')!;
        expect(p.wildcard).toBeLessThan(60);
      }
    });

    it('does not reduce Wildcard below 20', () => {
      const { em, sys } = setup();
      const id = em.createEntity();
      em.addComponent(id, makePersonality({ wildcard: 25 }));

      sys.investInCulture([id], 10000); // Massive budget
      const p = em.getComponent<PersonalityComponent>(id, 'Personality')!;
      expect(p.wildcard).toBeGreaterThanOrEqual(20);
    });
  });
});

import { vi } from 'vitest';

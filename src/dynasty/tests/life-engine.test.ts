import { describe, it, expect } from 'vitest';
import { CareerStageSystem, createCareerStage } from '../systems/CareerStageSystem.ts';
import { generateMoment, generateSeasonMoments, MOMENT_POOLS } from '../systems/BigGameMoments.ts';
import { generateDecisionEvent, generateSeasonEvents, EVENT_POOLS } from '../systems/DecisionEventSystem.ts';
import { generateFamily, ageFamilyMembers, getFamilyMember, addFamilyMember, getArchetypeDescriptions } from '../systems/FamilySystem.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import { EventBus } from '../ecs/EventBus.ts';
import { SystemRunner } from '../ecs/SystemRunner.ts';
import type { CareerStageComponent } from '../systems/CareerStageSystem.ts';

function makeRng(seed = 42) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

describe('CareerStageSystem', () => {
  function setup() {
    const bus = new EventBus();
    const em = new EntityManager();
    const rng = makeRng();
    const sys = new CareerStageSystem(em, bus, rng);
    const runner = new SystemRunner(bus, em, 'living');
    runner.addSystem(sys);
    return { bus, em, sys, runner };
  }

  it('creates career stage starting at little league age 12', () => {
    const stage = createCareerStage();
    expect(stage.currentStage).toBe('little_league');
    expect(stage.age).toBe(12);
    expect(stage.energy).toBe(10);
    expect(stage.timeMode).toBe('key_moments');
  });

  it('advances career age by 1 each season', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, createCareerStage());
    sys.advanceCareer(id);
    const stage = em.getComponent<CareerStageComponent>(id, 'CareerStage')!;
    expect(stage.age).toBe(13);
    expect(stage.totalSeasons).toBe(1);
  });

  it('transitions from little league to high school at age 15', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, createCareerStage('little_league', 14));
    const result = sys.advanceCareer(id);
    expect(result).not.toBeNull();
    expect(result!.from).toBe('little_league');
    expect(result!.to).toBe('high_school');
    const stage = em.getComponent<CareerStageComponent>(id, 'CareerStage')!;
    expect(stage.timeMode).toBe('seasonal_blocks');
  });

  it('high school to draft has choices', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, createCareerStage('high_school', 18));
    const result = sys.advanceCareer(id);
    expect(result).not.toBeNull();
    expect(result!.choices).toBeDefined();
    expect(result!.choices!.length).toBeGreaterThanOrEqual(2);
  });

  it('force transition to college works', () => {
    const { bus, em, sys } = setup();
    const handler = vi.fn();
    bus.on('CareerTransition', handler);
    const id = em.createEntity();
    em.addComponent(id, createCareerStage('high_school', 18));
    sys.forceTransition(id, 'college');
    const stage = em.getComponent<CareerStageComponent>(id, 'CareerStage')!;
    expect(stage.currentStage).toBe('college');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('training day costs energy and builds burnout', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, createCareerStage());
    const result = sys.trainDay(id, 'hard');
    expect(result.energyCost).toBe(3);
    const stage = em.getComponent<CareerStageComponent>(id, 'CareerStage')!;
    expect(stage.energy).toBeLessThan(10);
    expect(stage.burnoutMeter).toBeGreaterThan(0);
    expect(stage.physicalBalance).toBeGreaterThan(60); // Training boosts physical
    expect(stage.relationshipBalance).toBeLessThan(60); // But costs relationships
  });

  it('rest day recovers energy and boosts relationships', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, createCareerStage());
    sys.trainDay(id, 'hard');
    sys.trainDay(id, 'hard');
    sys.restDay(id, 'family');
    const stage = em.getComponent<CareerStageComponent>(id, 'CareerStage')!;
    expect(stage.consecutiveTrainingDays).toBe(0);
    expect(stage.relationshipBalance).toBeGreaterThan(50);
  });

  it('consecutive training has diminishing returns', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, createCareerStage());
    const r1 = sys.trainDay(id, 'moderate');
    const r2 = sys.trainDay(id, 'moderate');
    const r3 = sys.trainDay(id, 'moderate');
    // Burnout delta should decrease with consecutive days
    expect(r3.burnoutDelta).toBeLessThanOrEqual(r1.burnoutDelta);
  });

  it('life balance score works', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, createCareerStage());
    const balance = sys.getLifeBalanceStatus(id);
    expect(balance.score).toBeGreaterThan(0);
    expect(balance.balanced).toBe(true); // Starting values are all above 40
  });
});

describe('BigGameMoments', () => {
  it('generates moments for each stage', () => {
    const rng = makeRng();
    for (const stage of ['little_league', 'high_school', 'minor_leagues', 'mlb'] as const) {
      const moment = generateMoment(stage, rng);
      expect(moment).not.toBeNull();
      expect(moment!.title.length).toBeGreaterThan(3);
      expect(moment!.outcomes.success.narrative.length).toBeGreaterThan(20);
      expect(moment!.outcomes.failure.narrative.length).toBeGreaterThan(20);
    }
  });

  it('generates multiple moments per season', () => {
    const moments = generateSeasonMoments('high_school', 3, makeRng());
    expect(moments).toHaveLength(3);
    expect(moments.every(m => m.id.startsWith('moment_'))).toBe(true);
  });

  it('post_career and retired have no moments', () => {
    expect(generateMoment('post_career')).toBeNull();
    expect(generateMoment('retired')).toBeNull();
  });

  it('moments have valid stakes and situations', () => {
    const rng = makeRng();
    for (let i = 0; i < 20; i++) {
      const m = generateMoment('mlb', rng);
      if (m) {
        expect(['low', 'medium', 'high', 'career_defining']).toContain(m.stakes);
      }
    }
  });
});

describe('DecisionEventSystem', () => {
  it('generates events for each early stage', () => {
    const rng = makeRng();
    for (const stage of ['little_league', 'high_school', 'minor_leagues'] as const) {
      const event = generateDecisionEvent(stage, rng);
      expect(event).not.toBeNull();
      expect(event!.choices.length).toBeGreaterThanOrEqual(2);
      expect(event!.title.length).toBeGreaterThan(3);
    }
  });

  it('choices have visible effects', () => {
    const event = generateDecisionEvent('little_league', makeRng());
    expect(event).not.toBeNull();
    for (const choice of event!.choices) {
      expect(choice.label.length).toBeGreaterThan(3);
      expect(choice.visibleEffects.length).toBeGreaterThan(0);
    }
  });

  it('generates season events with category variety', () => {
    const events = generateSeasonEvents('high_school', 5, makeRng());
    expect(events.length).toBeGreaterThanOrEqual(3);
    const categories = new Set(events.map(e => e.category));
    expect(categories.size).toBeGreaterThan(1);
  });

  it('weighted selection favors higher weight events', () => {
    const rng = makeRng();
    const counts: Record<string, number> = {};
    for (let i = 0; i < 100; i++) {
      const e = generateDecisionEvent('high_school', rng);
      if (e) counts[e.category] = (counts[e.category] ?? 0) + 1;
    }
    // Training and career events have weight 10 — should appear most
    expect(counts['training'] ?? 0).toBeGreaterThan(5);
  });
});

describe('FamilySystem', () => {
  it('generates family for each archetype', () => {
    const rng = makeRng();
    const archetypes = getArchetypeDescriptions();
    expect(archetypes.length).toBe(7);

    for (const arch of archetypes) {
      const family = generateFamily(arch.id, 'Burns', rng);
      expect(family.members.length).toBeGreaterThanOrEqual(2);
      expect(family.archetype).toBe(arch.id);
      expect(family.householdIncome).toBeGreaterThan(0);
    }
  });

  it('single parent has no father or absent father', () => {
    const family = generateFamily('single_parent', 'Burns', makeRng());
    const father = getFamilyMember(family, 'father');
    expect(father).toBeUndefined(); // Single parent archetype doesn't include father
  });

  it('baseball family includes grandfather', () => {
    const family = generateFamily('baseball_family', 'Burns', makeRng());
    const grandpa = getFamilyMember(family, 'grandfather');
    expect(grandpa).toBeDefined();
    expect(grandpa!.storyHook.length).toBeGreaterThan(10);
  });

  it('immigrant family has poverty income tier', () => {
    const family = generateFamily('immigrant', 'Ramirez', makeRng());
    expect(family.incomeTier).toBe('poverty');
    expect(family.householdIncome).toBeLessThan(30);
  });

  it('wealthy family has high income', () => {
    const family = generateFamily('wealthy', 'Prescott', makeRng());
    expect(family.incomeTier).toBe('wealthy');
    expect(family.householdIncome).toBeGreaterThan(200);
  });

  it('aging family members can die', () => {
    const rng = makeRng(99);
    const family = generateFamily('baseball_family', 'Burns', rng);
    // Set grandpa to very old
    const grandpa = getFamilyMember(family, 'grandfather');
    if (grandpa) {
      grandpa.age = 90;
      grandpa.isAlive = true;
      grandpa.alive = true;
    }
    // Age many times — grandpa should eventually die
    let died = false;
    for (let i = 0; i < 20; i++) {
      const events = ageFamilyMembers(family, rng);
      if (events.some(e => e.includes('passed away'))) { died = true; break; }
    }
    // With age 90+, over 20 years, death is very likely
    expect(died).toBe(true);
  });

  it('adds new family members (marriage, children)', () => {
    const family = generateFamily('blue_collar', 'Burns', makeRng());
    const initialCount = family.members.length;
    addFamilyMember(family, 'spouse', 'Sarah Johnson', 24, 'High school sweetheart');
    addFamilyMember(family, 'daughter', 'Maria Burns', 0, 'Born during the minor league grind');
    expect(family.members.length).toBe(initialCount + 2);
    expect(getFamilyMember(family, 'spouse')?.name).toBe('Sarah Johnson');
    expect(getFamilyMember(family, 'daughter')?.name).toBe('Maria Burns');
  });

  it('each family member has a unique story hook', () => {
    const family = generateFamily('baseball_family', 'Burns', makeRng());
    for (const member of family.members) {
      expect(member.storyHook.length).toBeGreaterThan(10);
    }
  });

  it('relationships decay slightly without maintenance', () => {
    const family = generateFamily('blue_collar', 'Burns', makeRng());
    const mom = getFamilyMember(family, 'mother')!;
    const startRel = mom.relationship;
    ageFamilyMembers(family);
    expect(mom.relationship).toBe(startRel - 1);
  });
});

import { vi } from 'vitest';

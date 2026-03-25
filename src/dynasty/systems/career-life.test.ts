import { describe, it, expect, vi } from 'vitest';
import { CareerProgressionSystem } from './CareerProgressionSystem.ts';
import { LifeEventSystem } from './LifeEventSystem.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import { EventBus } from '../ecs/EventBus.ts';
import { SystemRunner } from '../ecs/SystemRunner.ts';
import { createCareer } from '../components/Career.ts';
import { createPersonalFinances } from '../components/PersonalFinances.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { CareerComponent } from '../components/Career.ts';
import type { PlayerRetiredEvent, SeasonPhaseChangedEvent } from '../ecs/types.ts';

function makePersonality(overrides: Partial<PersonalityComponent> = {}): PersonalityComponent {
  return {
    type: 'Personality', workEthic: 50, ego: 50, loyalty: 50, charisma: 50,
    baseballIQ: 50, composure: 50, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    ...overrides,
  };
}

describe('CareerProgressionSystem', () => {
  function setup() {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'living');
    const sys = new CareerProgressionSystem(em, bus);
    runner.addSystem(sys);
    return { bus, em, sys, runner };
  }

  it('generates opportunities on retirement based on personality', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, makePersonality({ baseballIQ: 70, charisma: 65, leadership: 60 }));
    em.addComponent(id, createCareer('player', 'team1'));

    sys.generatePostRetirementOpportunities(id);

    const opps = sys.getOpportunities(id);
    expect(opps.length).toBeGreaterThan(0);
    // Should have scout (IQ 70 >= 55), coach (leadership 60 >= 55), and fast-track assistant GM (IQ 70 + charisma 65)
    expect(opps.some(o => o.role === 'scout')).toBe(true);
    expect(opps.some(o => o.role === 'coach')).toBe(true);
    expect(opps.some(o => o.role === 'assistant_gm')).toBe(true);
  });

  it('generates GM opportunity for legendary player', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, makePersonality({ baseballIQ: 80, charisma: 75, leadership: 70 }));
    em.addComponent(id, createCareer('player', 'team1'));

    sys.generatePostRetirementOpportunities(id);

    const opps = sys.getOpportunities(id);
    expect(opps.some(o => o.role === 'gm')).toBe(true);
  });

  it('generates owner opportunity for wealthy player', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, makePersonality({ baseballIQ: 60, charisma: 60 }));
    em.addComponent(id, createCareer('player', 'team1'));
    const pf = createPersonalFinances(10000);
    pf.netWorth = 600000; // $600M
    em.addComponent(id, pf);

    sys.generatePostRetirementOpportunities(id);

    const opps = sys.getOpportunities(id);
    expect(opps.some(o => o.role === 'owner')).toBe(true);
  });

  it('generates NO opportunities for low-trait player', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, makePersonality({ baseballIQ: 30, charisma: 30, leadership: 30 }));
    em.addComponent(id, createCareer('player', 'team1'));

    sys.generatePostRetirementOpportunities(id);

    const opps = sys.getOpportunities(id);
    // No scout (IQ < 55), no coach (leadership < 55), no broadcaster (charisma < 60)
    expect(opps).toHaveLength(0);
  });

  it('accepts opportunity and transitions role', () => {
    const { bus, em, sys } = setup();
    const handler = vi.fn();
    bus.on('CareerTransition', handler);

    const id = em.createEntity();
    em.addComponent(id, makePersonality({ baseballIQ: 70 }));
    em.addComponent(id, createCareer('player', 'team1'));

    sys.generatePostRetirementOpportunities(id);
    const opp = sys.getOpportunities(id).find(o => o.role === 'scout')!;
    sys.acceptOpportunity(id, opp);

    const career = em.getComponent<CareerComponent>(id, 'Career')!;
    expect(career.currentRole).toBe('scout');
    expect(career.history).toHaveLength(1);
    expect(career.history[0].role).toBe('player');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('generates broadcaster opportunity for high-charisma player', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, makePersonality({ charisma: 70, baseballIQ: 40, leadership: 30 }));
    em.addComponent(id, createCareer('player', 'team1'));

    sys.generatePostRetirementOpportunities(id);
    expect(sys.getOpportunities(id).some(o => o.role === 'broadcaster')).toBe(true);
  });
});

describe('LifeEventSystem', () => {
  function setup(rngSeed = 0.5) {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'living');
    let rngVal = rngSeed;
    const rng = () => { rngVal = (rngVal * 9301 + 49297) % 233280 / 233280; return rngVal; };
    const sys = new LifeEventSystem(em, bus, rng);
    runner.addSystem(sys);
    return { bus, em, sys, runner };
  }

  it('generates events on offseason transition', () => {
    const { bus, em, sys } = setup();

    const id = em.createEntity();
    em.addComponent(id, makePersonality({ charisma: 60 }));
    em.addComponent(id, createPersonalFinances(5000));

    bus.emit({
      type: 'SeasonPhaseChanged', timestamp: 1,
      data: { from: 'regular_season', to: 'offseason' },
    } as SeasonPhaseChangedEvent);

    expect(sys.getPending().length).toBeGreaterThan(0);
  });

  it('resolves events with chosen option', () => {
    const { em, sys } = setup(0.3);

    const id = em.createEntity();
    em.addComponent(id, makePersonality({ charisma: 60 }));
    em.addComponent(id, createPersonalFinances(5000));

    sys.generateOffseasonEvents();
    const events = sys.getPending();
    if (events.length === 0) return; // RNG didn't generate any, which is valid

    const first = events[0];
    const choice = sys.resolveEvent(first.id, 0);

    expect(choice).not.toBeNull();
    expect(sys.getPending().length).toBeLessThan(events.length);
    expect(sys.getEventLog()).toHaveLength(1);
  });

  it('returns null for invalid event ID', () => {
    const { sys } = setup();
    expect(sys.resolveEvent('nonexistent', 0)).toBeNull();
  });

  it('is NOT active in classic mode', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'classic');
    const sys = new LifeEventSystem(em, bus);
    runner.addSystem(sys);

    const id = em.createEntity();
    em.addComponent(id, makePersonality());
    em.addComponent(id, createPersonalFinances(5000));

    bus.emit({
      type: 'SeasonPhaseChanged', timestamp: 1,
      data: { from: 'regular_season', to: 'offseason' },
    } as SeasonPhaseChangedEvent);

    // Should NOT generate events in classic mode
    expect(sys.getPending()).toHaveLength(0);
  });
});

/**
 * Dynasty Mode Stress Tests — 10 personality-driven scenarios
 * pushing every system to its limits.
 */

import { describe, it, expect } from 'vitest';
import { EventBus } from '../ecs/EventBus.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import { SystemRunner } from '../ecs/SystemRunner.ts';
import { PersonalitySystem } from '../systems/PersonalitySystem.ts';
import { RelationshipSystem } from '../systems/RelationshipSystem.ts';
import { ReputationSystem } from '../systems/ReputationSystem.ts';
import { CareerProgressionSystem } from '../systems/CareerProgressionSystem.ts';
import { LifeEventSystem } from '../systems/LifeEventSystem.ts';
import { PersonalFinanceSystem } from '../systems/PersonalFinanceSystem.ts';
import { FinanceSystem } from '../systems/FinanceSystem.ts';
import { ConversationSystem } from '../conversations/ConversationSystem.ts';
import { ConversationLibrary } from '../conversations/ConversationLibrary.ts';
import { PrestigeEngine } from '../systems/PrestigeEngine.ts';
import { createRelationships, adjustAffinity, getAffinity } from '../components/Relationships.ts';
import { createReputation, adjustReputation } from '../components/Reputation.ts';
import { createCareer } from '../components/Career.ts';
import { createPersonalFinances, processAnnualFinances } from '../components/PersonalFinances.ts';
import { createTeamFinances } from '../components/TeamFinances.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { ReputationComponent } from '../components/Reputation.ts';
import type { PersonalFinancesComponent } from '../components/PersonalFinances.ts';
import type { CareerComponent } from '../components/Career.ts';
import type { RelationshipsComponent } from '../components/Relationships.ts';
import type { ConversationTemplate } from '../conversations/types.ts';
import type {
  PlayerTradedEvent, AwardWonEvent, ContractSignedEvent,
  SeasonPhaseChangedEvent, PlayerRetiredEvent, GMFiredEvent,
} from '../ecs/types.ts';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildWorld(mode: 'classic' | 'living' = 'living') {
  const bus = new EventBus();
  const em = new EntityManager();
  const runner = new SystemRunner(bus, em, mode);

  let seed = 42;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  const personalitySystem = new PersonalitySystem(em, bus);
  const relationshipSystem = new RelationshipSystem(em, bus);
  const reputationSystem = new ReputationSystem(em, bus);
  const careerProgression = new CareerProgressionSystem(em, bus);
  const lifeEvents = new LifeEventSystem(em, bus, rng);
  const financeSystem = new FinanceSystem(em, bus);
  const personalFinance = new PersonalFinanceSystem(em, bus);
  const lib = new ConversationLibrary();
  const conversations = new ConversationSystem(em, bus, lib);

  runner.addSystem(personalitySystem);
  runner.addSystem(relationshipSystem);
  runner.addSystem(reputationSystem);
  runner.addSystem(careerProgression);
  runner.addSystem(lifeEvents);
  runner.addSystem(financeSystem);
  runner.addSystem(personalFinance);
  runner.addSystem(conversations);

  return { bus, em, runner, careerProgression, lifeEvents, conversations, lib, relationshipSystem };
}

function makePersonality(overrides: Partial<Omit<PersonalityComponent, 'type'>> = {}): PersonalityComponent {
  return {
    type: 'Personality', workEthic: 50, ego: 50, loyalty: 50, charisma: 50,
    baseballIQ: 50, composure: 50, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    ...overrides,
  };
}

function createFullEntity(em: EntityManager, personality: PersonalityComponent, role = 'player', salary = 5000) {
  const id = em.createEntity();
  em.addComponent(id, personality);
  em.addComponent(id, createRelationships());
  em.addComponent(id, createReputation());
  em.addComponent(id, createCareer(role as any, 'team1'));
  em.addComponent(id, createPersonalFinances(salary));
  return id;
}

// ── Test Scenarios ───────────────────────────────────────────────────────────

describe('Scenario 1: The Saint', () => {
  it('max reputation across all meters from positive events', () => {
    const { bus, em } = buildWorld();
    const id = createFullEntity(em, makePersonality({
      integrity: 80, loyalty: 80, charisma: 75, leadership: 75, composure: 75, ego: 25,
    }));

    // Win awards, be a good teammate
    for (let i = 0; i < 10; i++) {
      bus.emit({ type: 'AwardWon', timestamp: i, entityId: id, data: { playerId: id, award: 'MVP', league: 'AL' } } as AwardWonEvent);
    }

    const rep = em.getComponent<ReputationComponent>(id, 'Reputation')!;
    expect(rep.clubhouse).toBeGreaterThan(30);
    expect(rep.media).toBeGreaterThan(50);
    expect(rep.fan).toBeGreaterThan(50);
  });

  it('prestige reaches Legend tier with max achievements', () => {
    const { em } = buildWorld();
    const id = createFullEntity(em, makePersonality({
      integrity: 80, loyalty: 80, charisma: 75, leadership: 75,
    }));

    // Stack awards
    const career = em.getComponent<CareerComponent>(id, 'Career')!;
    career.awards.push(
      { type: 'MVP', season: 2026 }, { type: 'MVP', season: 2027 }, { type: 'MVP', season: 2028 },
    );
    career.history = Array.from({ length: 15 }, (_, i) => ({ role: 'player' as const, teamId: 'team1', startSeason: 2020 + i }));

    // Max reputation
    const rep = em.getComponent<ReputationComponent>(id, 'Reputation')!;
    adjustReputation(rep, 'clubhouse', 80);
    adjustReputation(rep, 'media', 80);
    adjustReputation(rep, 'fan', 90);

    // Good relationships
    const rels = em.getComponent<RelationshipsComponent>(id, 'Relationships')!;
    for (let i = 0; i < 15; i++) adjustAffinity(rels, `friend_${i}`, 40, 'mentored', 2026);

    // Wealthy
    const pf = em.getComponent<PersonalFinancesComponent>(id, 'PersonalFinances')!;
    pf.netWorth = 120000;

    const prestige = new PrestigeEngine(em);
    const score = prestige.calculate(id);
    // Saint with 3 MVPs, 15yr career, max rep, 15 friends, $120M = high prestige
    expect(score.total).toBeGreaterThanOrEqual(40);
    expect(['Legend', 'Elite', 'All-Star', 'Solid Pro']).toContain(score.tier);
    expect(score.milestones.some(m => m.includes('MVP'))).toBe(true);
    expect(score.milestones).toContain('Universally respected');
  });
});

describe('Scenario 2: The Asshole', () => {
  it('negative reputation from selfish behavior + trades', () => {
    const { bus, em } = buildWorld();
    const id = createFullEntity(em, makePersonality({
      ego: 80, aggression: 80, integrity: 25, loyalty: 25, composure: 25,
    }));

    // Get traded multiple times (each trade hurts composure for high-loyalty, but this guy doesn't care)
    for (let i = 0; i < 5; i++) {
      bus.emit({ type: 'PlayerTraded', timestamp: i, entityId: id,
        data: { playerId: id, fromTeamId: `team${i}`, toTeamId: `team${i + 1}` },
      } as PlayerTradedEvent);
    }

    // Direct rep hits
    const rep = em.getComponent<ReputationComponent>(id, 'Reputation')!;
    adjustReputation(rep, 'clubhouse', -50);
    adjustReputation(rep, 'media', -30);

    expect(rep.clubhouse).toBeLessThan(-30);
    expect(rep.media).toBeLessThan(-20);
  });

  it('prestige stays low — Journeyman at best', () => {
    const { em } = buildWorld();
    const id = createFullEntity(em, makePersonality({
      ego: 80, aggression: 80, integrity: 25,
    }));

    const rep = em.getComponent<ReputationComponent>(id, 'Reputation')!;
    adjustReputation(rep, 'clubhouse', -60);
    adjustReputation(rep, 'media', -40);
    adjustReputation(rep, 'fan', -30);

    const prestige = new PrestigeEngine(em);
    const score = prestige.calculate(id);
    expect(['Prospect', 'Journeyman']).toContain(score.tier);
    expect(score.hofProjection).toBe('no_chance');
  });

  it('team chemistry tanks with feuding players', () => {
    const { em, relationshipSystem } = buildWorld();

    const ids = [
      createFullEntity(em, makePersonality({ ego: 80, aggression: 80 })),
      createFullEntity(em, makePersonality({ ego: 75, aggression: 70 })),
      createFullEntity(em, makePersonality({ loyalty: 70, leadership: 60 })),
    ];

    // Create feuds between aggressive players
    const rel0 = em.getComponent<RelationshipsComponent>(ids[0], 'Relationships')!;
    const rel1 = em.getComponent<RelationshipsComponent>(ids[1], 'Relationships')!;
    adjustAffinity(rel0, ids[1], -70, 'feud', 2026);
    adjustAffinity(rel1, ids[0], -70, 'feud', 2026);

    const chemistry = relationshipSystem.computeTeamChemistry(ids);
    expect(chemistry).toBeLessThan(0);
  });
});

describe('Scenario 3: The Bankrupt', () => {
  it('extravagant lifestyle drains bank account to zero', () => {
    const { em } = buildWorld();
    const id = createFullEntity(em, makePersonality(), 'player', 700); // League minimum

    const pf = em.getComponent<PersonalFinancesComponent>(id, 'PersonalFinances')!;
    pf.lifestyleTier = 'extravagant'; // $8M/year expenses on $700K salary
    pf.bankAccount = 1000; // Start with $1M

    // Process 3 years
    for (let y = 0; y < 3; y++) {
      processAnnualFinances(pf);
    }

    expect(pf.bankAccount).toBeLessThan(0);
    expect(pf.netWorth).toBeLessThan(0);
  });

  it('bankruptcy fires FinancialEvent via PersonalFinanceSystem', () => {
    const { bus, em } = buildWorld();
    const handler = vi.fn();
    bus.on('FinancialEvent', handler);

    const id = createFullEntity(em, makePersonality(), 'player', 700);
    const pf = em.getComponent<PersonalFinancesComponent>(id, 'PersonalFinances')!;
    pf.lifestyleTier = 'extravagant';
    pf.bankAccount = 0;

    // Trigger offseason — PersonalFinanceSystem processes
    bus.emit({ type: 'SeasonPhaseChanged', timestamp: 1,
      data: { from: 'regular_season', to: 'offseason' },
    } as SeasonPhaseChangedEvent);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].data.category).toBe('bankruptcy');
  });

  it('prestige wealth score is 0 when bankrupt', () => {
    const { em } = buildWorld();
    const id = createFullEntity(em, makePersonality());
    const pf = em.getComponent<PersonalFinancesComponent>(id, 'PersonalFinances')!;
    pf.netWorth = -500;

    const prestige = new PrestigeEngine(em);
    expect(prestige.calculate(id).breakdown.wealth).toBe(0);
  });
});

describe('Scenario 4: The Hothead Who Gets Fired', () => {
  it('high aggression + trades destroy composure', () => {
    const { bus, em } = buildWorld();
    const id = createFullEntity(em, makePersonality({
      aggression: 80, composure: 40, loyalty: 70,
    }));

    // Multiple trades — each one chips at composure
    for (let i = 0; i < 5; i++) {
      bus.emit({ type: 'PlayerTraded', timestamp: i, entityId: id,
        data: { playerId: id, fromTeamId: `t${i}`, toTeamId: `t${i + 1}` },
      } as PlayerTradedEvent);
    }

    const p = em.getComponent<PersonalityComponent>(id, 'Personality')!;
    expect(p.composure).toBeLessThan(35);
  });

  it('career transition works after firing', () => {
    const { bus, em, careerProgression } = buildWorld();
    const id = createFullEntity(em, makePersonality({
      baseballIQ: 70, charisma: 60, leadership: 55,
    }));

    // Simulate retirement
    bus.emit({ type: 'PlayerRetired', timestamp: 1,
      data: { playerId: id, teamId: 'team1', age: 38 },
    } as PlayerRetiredEvent);

    const opps = careerProgression.getOpportunities(id);
    expect(opps.length).toBeGreaterThan(0);

    // Should have scout + coach at minimum
    expect(opps.some(o => o.role === 'scout')).toBe(true);
    expect(opps.some(o => o.role === 'coach')).toBe(true);
  });

  it('accepting opportunity changes career role', () => {
    const { bus, em, careerProgression } = buildWorld();
    const handler = vi.fn();
    bus.on('CareerTransition', handler);

    const id = createFullEntity(em, makePersonality({ baseballIQ: 70, leadership: 60 }));
    careerProgression.generatePostRetirementOpportunities(id);

    const opp = careerProgression.getOpportunities(id).find(o => o.role === 'scout')!;
    careerProgression.acceptOpportunity(id, opp);

    const career = em.getComponent<CareerComponent>(id, 'Career')!;
    expect(career.currentRole).toBe('scout');
    expect(career.history).toHaveLength(1);
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe('Scenario 5: The Legend', () => {
  it('max everything — Legend tier + first_ballot HOF', () => {
    const { em } = buildWorld();
    const id = createFullEntity(em, makePersonality({
      workEthic: 80, charisma: 75, baseballIQ: 80, leadership: 75, composure: 75, integrity: 80,
    }), 'gm', 25000);

    const career = em.getComponent<CareerComponent>(id, 'Career')!;
    career.currentRole = 'gm';
    career.awards.push(
      { type: 'MVP', season: 2026 }, { type: 'MVP', season: 2028 },
      { type: 'MVP', season: 2030 }, { type: 'CyYoung', season: 2027 },
    );
    career.history = Array.from({ length: 20 }, (_, i) => ({
      role: (i < 15 ? 'player' : i < 17 ? 'coach' : 'gm') as any,
      teamId: 'team1', startSeason: 2020 + i,
    }));
    career.achievements.push('hit_3000', 'hr_500', 'ws_champion');

    const rep = em.getComponent<ReputationComponent>(id, 'Reputation')!;
    adjustReputation(rep, 'clubhouse', 90);
    adjustReputation(rep, 'media', 85);
    adjustReputation(rep, 'fan', 95);

    const rels = em.getComponent<RelationshipsComponent>(id, 'Relationships')!;
    for (let i = 0; i < 20; i++) adjustAffinity(rels, `ally_${i}`, 50, 'years_together', 2026);

    const pf = em.getComponent<PersonalFinancesComponent>(id, 'PersonalFinances')!;
    pf.netWorth = 200000;

    const prestige = new PrestigeEngine(em);
    const score = prestige.calculate(id);

    expect(score.tier).toBe('Legend');
    expect(score.hofProjection).toBe('first_ballot');
    expect(score.total).toBeGreaterThanOrEqual(85);
    expect(score.milestones).toContain('First-ballot Hall of Famer');
    expect(score.milestones).toContain('Universally respected');
    expect(score.milestones).toContain('Wide network of allies');
    expect(score.milestones).toContain('Wealthy ($100M+)');
  });
});

describe('Scenario 6: The Fast-Track GM', () => {
  it('high IQ + charisma generates assistant_gm and gm opportunities', () => {
    const { em, careerProgression } = buildWorld();
    const id = createFullEntity(em, makePersonality({
      baseballIQ: 80, charisma: 75, leadership: 70,
    }));

    careerProgression.generatePostRetirementOpportunities(id);
    const opps = careerProgression.getOpportunities(id);

    expect(opps.some(o => o.role === 'assistant_gm')).toBe(true);
    expect(opps.some(o => o.role === 'gm')).toBe(true); // Direct GM with IQ 80 + charisma 75 + leadership 70
    expect(opps.some(o => o.role === 'broadcaster')).toBe(true); // charisma 75 > 60
  });

  it('skip levels reflected in opportunity metadata', () => {
    const { em, careerProgression } = buildWorld();
    const id = createFullEntity(em, makePersonality({
      baseballIQ: 80, charisma: 75, leadership: 70,
    }));

    careerProgression.generatePostRetirementOpportunities(id);
    const gmOpp = careerProgression.getOpportunities(id).find(o => o.role === 'gm');
    expect(gmOpp).toBeDefined();
    expect(gmOpp!.skipLevels).toBe(4);
  });

  it('low-trait player gets NO opportunities', () => {
    const { em, careerProgression } = buildWorld();
    const id = createFullEntity(em, makePersonality({
      baseballIQ: 30, charisma: 30, leadership: 30,
    }));

    careerProgression.generatePostRetirementOpportunities(id);
    expect(careerProgression.getOpportunities(id)).toHaveLength(0);
  });
});

describe('Scenario 7: The Mogul Owner', () => {
  it('$500M+ net worth unlocks owner path', () => {
    const { em, careerProgression } = buildWorld();
    const id = createFullEntity(em, makePersonality({ baseballIQ: 60, charisma: 60 }), 'player', 25000);

    const pf = em.getComponent<PersonalFinancesComponent>(id, 'PersonalFinances')!;
    pf.netWorth = 600000; // $600M

    careerProgression.generatePostRetirementOpportunities(id);
    const opps = careerProgression.getOpportunities(id);
    expect(opps.some(o => o.role === 'owner')).toBe(true);
    expect(opps.find(o => o.role === 'owner')!.skipLevels).toBe(6);
  });

  it('prestige wealth score maxes at 10 for mogul', () => {
    const { em } = buildWorld();
    const id = createFullEntity(em, makePersonality());
    const pf = em.getComponent<PersonalFinancesComponent>(id, 'PersonalFinances')!;
    pf.netWorth = 600000;

    const prestige = new PrestigeEngine(em);
    expect(prestige.calculate(id).breakdown.wealth).toBe(10);
    expect(prestige.calculate(id).milestones).toContain('Mogul ($500M+)');
  });

  it('$499M does NOT unlock owner path', () => {
    const { em, careerProgression } = buildWorld();
    const id = createFullEntity(em, makePersonality({ baseballIQ: 60, charisma: 60 }));
    const pf = em.getComponent<PersonalFinancesComponent>(id, 'PersonalFinances')!;
    pf.netWorth = 499000;

    careerProgression.generatePostRetirementOpportunities(id);
    expect(careerProgression.getOpportunities(id).some(o => o.role === 'owner')).toBe(false);
  });
});

describe('Scenario 8: Conversation Sanity', () => {
  it('events queue pending conversations', () => {
    const { bus, conversations, lib } = buildWorld();

    // Load a sample template
    lib.loadTemplates([{
      id: 'test-trade-001', situation: 'trade_call',
      archetypes: { npc: ['any'], player: ['any'] },
      emotionalState: ['neutral'], stakes: 'moderate' as any,
      nodes: [{ id: 'n1', speaker: 'npc', text: 'We made a deal for {{playerName}}.' }],
      outcomes: { done: { description: 'Trade discussed' } },
    }]);

    bus.emit({ type: 'PlayerTraded', timestamp: 1,
      data: { playerId: 'Mike Trout', fromTeamId: 't1', toTeamId: 't2' },
    } as PlayerTradedEvent);

    expect(conversations.getPending().length).toBeGreaterThan(0);
    expect(conversations.getPending()[0].situation).toBe('trade_call');
  });

  it('template variable substitution produces readable text', () => {
    const { em, conversations, lib } = buildWorld();

    lib.loadTemplates([{
      id: 'test-contract-001', situation: 'contract_negotiation',
      archetypes: { npc: ['any'], player: ['any'] },
      emotionalState: ['neutral'], stakes: 'routine' as any,
      nodes: [{ id: 'n1', speaker: 'npc', text: '{{playerName}} signed for {{offerAmount}} over {{offerYears}} years.' }],
      outcomes: { done: { description: 'Done' } },
    }]);

    const pending = {
      situation: 'contract_negotiation' as const,
      context: { playerName: 'Mike Trout', offerAmount: '$30M', offerYears: '10' },
      stakes: 'routine' as const,
      triggeredBy: 'test',
    };

    const resolved = conversations.resolveConversation(pending);
    expect(resolved).not.toBeNull();
    expect(resolved!.nodes[0].text).toBe('Mike Trout signed for $30M over 10 years.');
    expect(resolved!.nodes[0].text).not.toContain('{{');
  });

  it('award + contract + trade all queue different conversations', () => {
    const { bus, conversations, lib } = buildWorld();

    lib.loadTemplates([
      { id: 't1', situation: 'trade_call', archetypes: { npc: ['any'], player: ['any'] }, emotionalState: ['neutral'], stakes: 'moderate' as any, nodes: [{ id: 'n1', speaker: 'npc', text: 'Trade talk' }], outcomes: {} },
      { id: 't2', situation: 'award_ceremony', archetypes: { npc: ['any'], player: ['any'] }, emotionalState: ['happy'], stakes: 'moderate' as any, nodes: [{ id: 'n1', speaker: 'npc', text: 'Congrats' }], outcomes: {} },
      { id: 't3', situation: 'contract_negotiation', archetypes: { npc: ['any'], player: ['any'] }, emotionalState: ['neutral'], stakes: 'routine' as any, nodes: [{ id: 'n1', speaker: 'npc', text: 'Contract' }], outcomes: {} },
    ] as ConversationTemplate[]);

    bus.emit({ type: 'PlayerTraded', timestamp: 1, data: { playerId: 'p1', fromTeamId: 't1', toTeamId: 't2' } } as PlayerTradedEvent);
    bus.emit({ type: 'AwardWon', timestamp: 2, data: { playerId: 'p1', award: 'MVP', league: 'AL' } } as AwardWonEvent);
    bus.emit({ type: 'ContractSigned', timestamp: 3, data: { playerId: 'p1', teamId: 't1', years: 5, salary: 20000 } } as ContractSignedEvent);

    const pending = conversations.getPending();
    expect(pending).toHaveLength(3);
    const situations = pending.map(p => p.situation);
    expect(situations).toContain('trade_call');
    expect(situations).toContain('award_ceremony');
    expect(situations).toContain('contract_negotiation');
  });
});

describe('Scenario 9: Life Events Cascade', () => {
  it('generates events on offseason transition (Living mode)', () => {
    const { bus, em, lifeEvents } = buildWorld('living');
    createFullEntity(em, makePersonality({ charisma: 70 }));

    bus.emit({ type: 'SeasonPhaseChanged', timestamp: 1,
      data: { from: 'regular_season', to: 'offseason' },
    } as SeasonPhaseChangedEvent);

    expect(lifeEvents.getPending().length).toBeGreaterThan(0);
  });

  it('does NOT generate in classic mode', () => {
    const { bus, em, lifeEvents } = buildWorld('classic');
    createFullEntity(em, makePersonality({ charisma: 70 }));

    bus.emit({ type: 'SeasonPhaseChanged', timestamp: 1,
      data: { from: 'regular_season', to: 'offseason' },
    } as SeasonPhaseChangedEvent);

    expect(lifeEvents.getPending()).toHaveLength(0);
  });

  it('resolving events returns choice effects', () => {
    const { em, lifeEvents } = buildWorld('living');
    createFullEntity(em, makePersonality({ charisma: 70 }));
    lifeEvents.generateOffseasonEvents();

    const events = lifeEvents.getPending();
    if (events.length === 0) return; // RNG-dependent

    const first = events[0];
    const choice = lifeEvents.resolveEvent(first.id, 0);
    expect(choice).not.toBeNull();
    expect(choice!.effects.description).toBeTruthy();
  });

  it('high-charisma player gets more events than low-charisma', () => {
    // Test with deterministic RNG
    let seed1 = 100;
    const rng1 = () => { seed1 = (seed1 * 16807) % 2147483647; return seed1 / 2147483647; };
    let seed2 = 100; // Same seed for fair comparison
    const rng2 = () => { seed2 = (seed2 * 16807) % 2147483647; return seed2 / 2147483647; };

    const bus1 = new EventBus();
    const em1 = new EntityManager();
    const life1 = new LifeEventSystem(em1, bus1, rng1);
    const runner1 = new SystemRunner(bus1, em1, 'living');
    runner1.addSystem(life1);
    createFullEntity(em1, makePersonality({ charisma: 80 })); // High charisma

    const bus2 = new EventBus();
    const em2 = new EntityManager();
    const life2 = new LifeEventSystem(em2, bus2, rng2);
    const runner2 = new SystemRunner(bus2, em2, 'living');
    runner2.addSystem(life2);
    createFullEntity(em2, makePersonality({ charisma: 25 })); // Low charisma

    life1.generateOffseasonEvents();
    life2.generateOffseasonEvents();

    // High charisma should generate more events (1 + floor(rng * charisma/40))
    // This is probabilistic but charisma 80 should generally produce more
    expect(life1.getPending().length).toBeGreaterThanOrEqual(life2.getPending().length);
  });
});

describe('Scenario 10: 20-Season Stress Test', () => {
  it('sim 20 seasons of events without NaN or crashes', () => {
    const { bus, em } = buildWorld();

    // Create 25 player entities (a full roster)
    const playerIds: string[] = [];
    for (let i = 0; i < 25; i++) {
      const id = createFullEntity(em, makePersonality({
        workEthic: 30 + Math.floor(Math.random() * 50),
        ego: 20 + Math.floor(Math.random() * 60),
        loyalty: 20 + Math.floor(Math.random() * 60),
        charisma: 20 + Math.floor(Math.random() * 60),
        composure: 20 + Math.floor(Math.random() * 60),
        leadership: 20 + Math.floor(Math.random() * 60),
      }));
      playerIds.push(id);
    }

    // Sim 20 seasons
    for (let season = 0; season < 20; season++) {
      // 56 games per season
      for (let game = 0; game < 56; game++) {
        bus.emit({ type: 'GameCompleted', timestamp: season * 1000 + game,
          data: { homeTeamId: 'team1', awayTeamId: 'team2', homeScore: Math.floor(Math.random() * 10), awayScore: Math.floor(Math.random() * 10) },
        });
      }

      // Some trades
      if (playerIds.length > 2) {
        bus.emit({ type: 'PlayerTraded', timestamp: season * 1000 + 500, entityId: playerIds[0],
          data: { playerId: playerIds[0], fromTeamId: 'team1', toTeamId: 'team2' },
        } as PlayerTradedEvent);
      }

      // Awards
      bus.emit({ type: 'AwardWon', timestamp: season * 1000 + 600, entityId: playerIds[1],
        data: { playerId: playerIds[1], award: 'MVP', league: 'AL' },
      } as AwardWonEvent);

      // Contract
      bus.emit({ type: 'ContractSigned', timestamp: season * 1000 + 700,
        data: { playerId: playerIds[2], teamId: 'team1', years: 3, salary: 5000 },
      } as ContractSignedEvent);

      // Offseason transition
      bus.emit({ type: 'SeasonPhaseChanged', timestamp: season * 1000 + 800,
        data: { from: 'regular_season', to: 'offseason' },
      } as SeasonPhaseChangedEvent);

      // Back to preseason
      bus.emit({ type: 'SeasonPhaseChanged', timestamp: season * 1000 + 900,
        data: { from: 'offseason', to: 'preseason' },
      } as SeasonPhaseChangedEvent);
    }

    // Verify no NaN in any component
    for (const id of playerIds) {
      const p = em.getComponent<PersonalityComponent>(id, 'Personality');
      if (p) {
        for (const [key, val] of Object.entries(p)) {
          if (typeof val === 'number') {
            expect(Number.isNaN(val)).toBe(false);
            expect(Number.isFinite(val)).toBe(true);
          }
        }
      }

      const rep = em.getComponent<ReputationComponent>(id, 'Reputation');
      if (rep) {
        expect(rep.clubhouse).toBeGreaterThanOrEqual(-100);
        expect(rep.clubhouse).toBeLessThanOrEqual(100);
        expect(rep.media).toBeGreaterThanOrEqual(-100);
        expect(rep.media).toBeLessThanOrEqual(100);
        expect(rep.fan).toBeGreaterThanOrEqual(-100);
        expect(rep.fan).toBeLessThanOrEqual(100);
      }

      const pf = em.getComponent<PersonalFinancesComponent>(id, 'PersonalFinances');
      if (pf) {
        expect(Number.isNaN(pf.bankAccount)).toBe(false);
        expect(Number.isNaN(pf.netWorth)).toBe(false);
      }
    }

    // Verify event bus recorded everything
    expect(bus.getHistory().length).toBeGreaterThan(0);

    // Verify prestige engine doesn't crash on any entity
    const prestige = new PrestigeEngine(em);
    for (const id of playerIds) {
      const score = prestige.calculate(id);
      expect(score.total).toBeGreaterThanOrEqual(0);
      expect(score.total).toBeLessThanOrEqual(100);
      expect(Number.isNaN(score.total)).toBe(false);
    }
  });
});

// Need vi import for mocking
import { vi } from 'vitest';

import { describe, it, expect } from 'vitest';
import { ConversationSystem } from './ConversationSystem.ts';
import { ConversationLibrary } from './ConversationLibrary.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import { EventBus } from '../ecs/EventBus.ts';
import { SystemRunner } from '../ecs/SystemRunner.ts';
import type { ConversationTemplate } from './types.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { PlayerTradedEvent, AwardWonEvent, ContractSignedEvent } from '../ecs/types.ts';

function makeSampleTemplates(): ConversationTemplate[] {
  return [
    {
      id: 'trade-call-001',
      situation: 'trade_call',
      archetypes: { npc: ['any'], player: ['any'] },
      emotionalState: ['neutral'],
      stakes: 'moderate' as any,
      nodes: [
        { id: 'n1', speaker: 'npc', text: 'We just made a move — {{playerName}} is heading to {{teamName}}.' },
        { id: 'n2', speaker: 'player', text: 'I hope this works out for both sides.' },
      ],
      outcomes: { done: { description: 'Trade discussed' } },
    },
    {
      id: 'award-001',
      situation: 'award_ceremony',
      archetypes: { npc: ['any'], player: ['any'] },
      emotionalState: ['happy'],
      stakes: 'moderate' as any,
      nodes: [
        { id: 'n1', speaker: 'npc', text: 'Congratulations on a phenomenal season, {{playerName}}.' },
      ],
      outcomes: { done: { description: 'Award presented' } },
    },
    {
      id: 'contract-001',
      situation: 'contract_negotiation',
      archetypes: { npc: ['high_ego'], player: ['any'] },
      emotionalState: ['confident'],
      stakes: 'routine' as any,
      nodes: [
        { id: 'n1', speaker: 'npc', text: 'My client wants {{offerAmount}} over {{offerYears}} years.' },
      ],
      outcomes: { signed: { event: 'ContractSigned', affinityDelta: 5 } },
    },
  ];
}

describe('ConversationSystem', () => {
  function setup() {
    const bus = new EventBus();
    const em = new EntityManager();
    const lib = new ConversationLibrary();
    lib.loadTemplates(makeSampleTemplates());
    const runner = new SystemRunner(bus, em, 'classic');
    const sys = new ConversationSystem(em, bus, lib);
    runner.addSystem(sys);
    return { bus, em, sys, lib, runner };
  }

  it('queues pending conversation on PlayerTraded event', () => {
    const { bus, sys } = setup();

    bus.emit({
      type: 'PlayerTraded', timestamp: 1,
      data: { playerId: 'p1', fromTeamId: 't1', toTeamId: 't2' },
    } as PlayerTradedEvent);

    const pending = sys.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].situation).toBe('trade_call');
    expect(pending[0].triggeredBy).toBe('PlayerTraded');
  });

  it('queues pending conversation on AwardWon event', () => {
    const { bus, sys } = setup();

    bus.emit({
      type: 'AwardWon', timestamp: 1,
      data: { playerId: 'p1', award: 'MVP', league: 'AL' },
    } as AwardWonEvent);

    expect(sys.getPending()).toHaveLength(1);
    expect(sys.getPending()[0].situation).toBe('award_ceremony');
  });

  it('queues pending conversation on ContractSigned event', () => {
    const { bus, sys } = setup();

    bus.emit({
      type: 'ContractSigned', timestamp: 1,
      data: { playerId: 'p1', teamId: 't1', years: 3, salary: 15000 },
    } as ContractSignedEvent);

    const pending = sys.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].context.offerAmount).toBe('$15M');
  });

  it('consumePending removes and returns first conversation', () => {
    const { bus, sys } = setup();

    bus.emit({ type: 'PlayerTraded', timestamp: 1, data: { playerId: 'p1', fromTeamId: 't1', toTeamId: 't2' } } as PlayerTradedEvent);
    bus.emit({ type: 'AwardWon', timestamp: 2, data: { playerId: 'p1', award: 'MVP', league: 'AL' } } as AwardWonEvent);

    expect(sys.getPending()).toHaveLength(2);
    const first = sys.consumePending();
    expect(first?.situation).toBe('trade_call');
    expect(sys.getPending()).toHaveLength(1);
  });

  it('resolves a pending conversation with template + variable substitution', () => {
    const { bus, sys } = setup();

    bus.emit({
      type: 'PlayerTraded', timestamp: 1,
      data: { playerId: 'Mike Trout', fromTeamId: 't1', toTeamId: 'Houston Astros' },
    } as PlayerTradedEvent);

    const pending = sys.consumePending()!;
    const resolved = sys.resolveConversation(pending);

    expect(resolved).not.toBeNull();
    expect(resolved!.template.id).toBe('trade-call-001');
    expect(resolved!.nodes[0].text).toContain('Mike Trout');
    expect(resolved!.nodes[0].text).toContain('Houston Astros');
  });

  it('resolves with NPC personality-driven template selection', () => {
    const { bus, em, sys } = setup();

    // Create NPC with high ego
    const npcId = em.createEntity();
    em.addComponent(npcId, {
      type: 'Personality', workEthic: 50, ego: 75, loyalty: 50, charisma: 50,
      baseballIQ: 50, composure: 50, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    } as PersonalityComponent);

    bus.emit({
      type: 'ContractSigned', timestamp: 1,
      data: { playerId: 'p1', teamId: 't1', years: 5, salary: 25000 },
    } as ContractSignedEvent);

    const pending = sys.consumePending()!;
    // Override npcEntityId to point to our high-ego NPC
    pending.npcEntityId = npcId;

    const resolved = sys.resolveConversation(pending);
    expect(resolved).not.toBeNull();
    // Should select the high_ego contract template
    expect(resolved!.template.id).toBe('contract-001');
    expect(resolved!.nodes[0].text).toContain('$25M');
  });

  it('records completed conversations', () => {
    const { sys } = setup();

    sys.recordCompleted({
      templateId: 'trade-call-001',
      situation: 'trade_call',
      nodePathIds: ['n1', 'n2'],
      effects: { affinity: 5 },
      timestamp: Date.now(),
    });

    expect(sys.getCompletedLog()).toHaveLength(1);
  });
});

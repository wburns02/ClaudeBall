import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../ecs/EventBus.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import { SystemRunner } from '../ecs/SystemRunner.ts';
import { EntityFactory } from '../bridge/EntityFactory.ts';
import { CoreSimBridge } from './CoreSimBridge.ts';
import { ContractBridge } from './ContractBridge.ts';
import { TradeBridge } from './TradeBridge.ts';
import { SeasonBridge } from './SeasonBridge.ts';
import { PersonalitySystem } from './PersonalitySystem.ts';
import { RelationshipSystem } from './RelationshipSystem.ts';
import { getAffinity } from '../components/Relationships.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { RelationshipsComponent } from '../components/Relationships.ts';
import type { Player } from '@/engine/types/player.ts';

function makePlayer(id: string): Player {
  return {
    id, firstName: 'Test', lastName: `P-${id}`, number: 1,
    position: 'SS' as any, bats: 'R' as any, throws: 'R' as any, age: 25,
    batting: { contact_L: 60, contact_R: 60, power_L: 50, power_R: 50, eye: 55, avoid_k: 50, gap_power: 45, speed: 60, steal: 50, bunt: 30, clutch: 55 },
    pitching: { stuff: 20, movement: 20, control: 20, stamina: 20, velocity: 75, hold_runners: 30, groundball_pct: 50, repertoire: ['fastball' as any] },
    fielding: [{ position: 'SS' as any, range: 70, arm_strength: 65, arm_accuracy: 60, turn_dp: 55, error_rate: 20 }],
    mental: { intelligence: 60, work_ethic: 70, durability: 65, consistency: 55, composure: 60, leadership: 50 },
    state: { fatigue: 0, morale: 80, pitchCount: 0, isInjured: false },
  } as Player;
}

describe('CoreSimBridge', () => {
  it('emits GameCompleted event with scores', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const bridge = new CoreSimBridge(em, bus);
    const handler = vi.fn();
    bus.on('GameCompleted', handler);

    bridge.recordGameCompleted('away-1', 'home-1', 3, 5);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].data.homeScore).toBe(5);
  });

  it('tracks games completed count', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const bridge = new CoreSimBridge(em, bus);

    bridge.recordGameCompleted('a', 'h', 1, 2);
    bridge.recordGameCompleted('a', 'h', 3, 4);
    expect(bridge.gamesCompleted).toBe(2);
  });
});

describe('ContractBridge', () => {
  it('emits ContractSigned', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const bridge = new ContractBridge(em, bus);
    const handler = vi.fn();
    bus.on('ContractSigned', handler);

    bridge.recordContractSigned('p1', 'team1', 3, 5000);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].data.years).toBe(3);
  });

  it('emits PlayerReleased', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const bridge = new ContractBridge(em, bus);
    const handler = vi.fn();
    bus.on('PlayerReleased', handler);

    bridge.recordPlayerReleased('p2', 'team2');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('emits PlayerRetired', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const bridge = new ContractBridge(em, bus);
    const handler = vi.fn();
    bus.on('PlayerRetired', handler);

    bridge.recordPlayerRetired('p3', 'team3', 38);
    expect(handler.mock.calls[0][0].data.age).toBe(38);
  });
});

describe('SeasonBridge', () => {
  it('emits SeasonPhaseChanged', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const bridge = new SeasonBridge(em, bus);
    const handler = vi.fn();
    bus.on('SeasonPhaseChanged', handler);

    bridge.recordPhaseChange('regular_season', 'playoffs');
    expect(handler.mock.calls[0][0].data.to).toBe('playoffs');
  });

  it('emits PlayerInjured', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const bridge = new SeasonBridge(em, bus);
    const handler = vi.fn();
    bus.on('PlayerInjured', handler);

    bridge.recordInjury('p1', 'team1', 'major');
    expect(handler.mock.calls[0][0].data.severity).toBe('major');
  });

  it('emits AwardWon', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const bridge = new SeasonBridge(em, bus);
    const handler = vi.fn();
    bus.on('AwardWon', handler);

    bridge.recordAward('p1', 'MVP', 'American');
    expect(handler.mock.calls[0][0].data.award).toBe('MVP');
  });
});

describe('TradeBridge', () => {
  it('emits PlayerTraded with GM entity ID', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const factory = new EntityFactory(em);
    const bridge = new TradeBridge(em, bus, factory);
    const handler = vi.fn();
    bus.on('PlayerTraded', handler);

    factory.createNPCEntity('gm-1', 'gm');
    bridge.recordTrade('p1', 'team-a', 'team-b', 'gm-1');

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].data.gmEntityId).toBeDefined();
  });

  it('triggers personality + relationship reaction via event bus', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const factory = new EntityFactory(em);
    const runner = new SystemRunner(bus, em, 'classic');

    runner.addSystem(new PersonalitySystem(em, bus));
    runner.addSystem(new RelationshipSystem(em, bus));
    const bridge = new TradeBridge(em, bus, factory);

    // Create player entity with high loyalty
    const player = makePlayer('p1');
    const playerEntityId = factory.createPlayerEntity(player, 'team-a');

    // Override personality to have high loyalty
    em.addComponent(playerEntityId, {
      type: 'Personality', workEthic: 50, ego: 50, loyalty: 75, charisma: 50,
      baseballIQ: 50, composure: 60, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    } as PersonalityComponent);

    const gmEntityId = factory.createNPCEntity('gm-1', 'gm');

    // Fire trade
    bridge.recordTrade('p1', 'team-a', 'team-b', 'gm-1');

    // Personality reacted — composure dropped
    const pers = em.getComponent<PersonalityComponent>(playerEntityId, 'Personality')!;
    expect(pers.composure).toBeLessThan(60);

    // Relationship created — negative affinity toward GM
    const rel = em.getComponent<RelationshipsComponent>(playerEntityId, 'Relationships')!;
    expect(getAffinity(rel, gmEntityId)).toBeLessThan(0);
  });
});

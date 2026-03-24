import { describe, it, expect } from 'vitest';
import { DynastyBridge } from './DynastyBridge.ts';
import type { Player } from '@/engine/types/player.ts';
import type { Team } from '@/engine/types/team.ts';

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

function makeTeam(id: string, players: Player[]): Team {
  return {
    id, name: `Team-${id}`, abbreviation: id.toUpperCase().slice(0, 3),
    city: 'Test City', primaryColor: '#000', secondaryColor: '#fff',
    roster: { players }, lineup: [], pitcherId: players[0]?.id ?? '', bullpen: [],
  };
}

describe('DynastyBridge', () => {
  it('initializes ECS world from team rosters', () => {
    const bridge = DynastyBridge.create('classic');
    const players = [makePlayer('p1'), makePlayer('p2'), makePlayer('p3')];
    const teams = [makeTeam('t1', players)];

    bridge.initializeFromTeams(teams, 'gm-user');

    expect(bridge.factory.getEntityId('p1')).toBeDefined();
    expect(bridge.factory.getEntityId('p2')).toBeDefined();
    expect(bridge.factory.getEntityId('p3')).toBeDefined();
  });

  it('provides access to all bridge systems', () => {
    const bridge = DynastyBridge.create('classic');
    expect(bridge.coreSim).toBeDefined();
    expect(bridge.contracts).toBeDefined();
    expect(bridge.trades).toBeDefined();
    expect(bridge.season).toBeDefined();
  });

  it('computes team chemistry', () => {
    const bridge = DynastyBridge.create('classic');
    const players = [makePlayer('p1'), makePlayer('p2')];
    const teams = [makeTeam('t1', players)];
    bridge.initializeFromTeams(teams, 'gm-user');

    const chemistry = bridge.getTeamChemistry('t1', teams[0]);
    expect(typeof chemistry).toBe('number');
    expect(chemistry).toBeGreaterThanOrEqual(-10);
    expect(chemistry).toBeLessThanOrEqual(10);
  });

  it('ticks without error', () => {
    const bridge = DynastyBridge.create('classic');
    expect(() => bridge.tick(1)).not.toThrow();
  });

  it('end-to-end: trade triggers personality + relationship reactions', () => {
    const bridge = DynastyBridge.create('classic');
    const players = [makePlayer('p1')];
    const teams = [makeTeam('t1', players)];
    bridge.initializeFromTeams(teams, 'gm-1');

    // Override personality with high loyalty
    const entityId = bridge.factory.getEntityId('p1')!;
    bridge.entities.addComponent(entityId, {
      type: 'Personality', workEthic: 50, ego: 50, loyalty: 75, charisma: 50,
      baseballIQ: 50, composure: 60, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    });

    // Trade the player
    bridge.trades.recordTrade('p1', 't1', 't2', 'gm-1');

    // Verify composure dropped
    const pers = bridge.entities.getComponent<any>(entityId, 'Personality');
    expect(pers.composure).toBeLessThan(60);

    // Verify event history
    expect(bridge.bus.getHistory('PlayerTraded')).toHaveLength(1);
  });
});

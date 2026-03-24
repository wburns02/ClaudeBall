import { describe, it, expect, vi } from 'vitest';
import { SystemRunner } from './SystemRunner.ts';
import { EventBus } from './EventBus.ts';
import { EntityManager } from './EntityManager.ts';
import type { System, DynastyMode } from './types.ts';

function makeSystem(name: string, modes: DynastyMode[] = ['classic', 'living']): System & { tick: ReturnType<typeof vi.fn> } {
  return {
    name,
    modes,
    tick: vi.fn(),
  };
}

describe('SystemRunner', () => {
  it('ticks all systems in order', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'classic');

    const order: string[] = [];
    const sys1 = makeSystem('A');
    sys1.tick.mockImplementation(() => order.push('A'));
    const sys2 = makeSystem('B');
    sys2.tick.mockImplementation(() => order.push('B'));

    runner.addSystem(sys1);
    runner.addSystem(sys2);
    runner.tick(1);

    expect(order).toEqual(['A', 'B']);
  });

  it('skips systems not active in current mode', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'classic');

    const livingOnly = makeSystem('LivingOnly', ['living']);
    const both = makeSystem('Both', ['classic', 'living']);

    runner.addSystem(livingOnly);
    runner.addSystem(both);
    runner.tick(1);

    expect(livingOnly.tick).not.toHaveBeenCalled();
    expect(both.tick).toHaveBeenCalledOnce();
  });

  it('routes events to systems with handleEvent', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'classic');

    const handler = vi.fn();
    const sys: System = {
      name: 'Test',
      modes: ['classic', 'living'],
      tick: vi.fn(),
      handleEvent: handler,
    };

    runner.addSystem(sys);
    bus.emit({ type: 'PlayerTraded', timestamp: 1, data: { playerId: 'p1', fromTeamId: 't1', toTeamId: 't2' } });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('allows changing mode at runtime', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'classic');

    const livingOnly = makeSystem('LivingOnly', ['living']);
    runner.addSystem(livingOnly);

    runner.tick(1);
    expect(livingOnly.tick).not.toHaveBeenCalled();

    runner.setMode('living');
    runner.tick(1);
    expect(livingOnly.tick).toHaveBeenCalledOnce();
  });
});

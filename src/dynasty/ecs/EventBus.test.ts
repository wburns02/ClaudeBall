import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './EventBus.ts';
import type { PlayerTradedEvent } from './types.ts';

describe('EventBus', () => {
  it('delivers events to subscribers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('PlayerTraded', handler);

    const event: PlayerTradedEvent = {
      type: 'PlayerTraded',
      timestamp: Date.now(),
      data: { playerId: 'p1', fromTeamId: 't1', toTeamId: 't2' },
    };
    bus.emit(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('does not deliver to unsubscribed handlers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on('PlayerTraded', handler);
    unsub();

    bus.emit({ type: 'PlayerTraded', timestamp: Date.now(), data: { playerId: 'p1', fromTeamId: 't1', toTeamId: 't2' } } as PlayerTradedEvent);
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports wildcard subscribers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.onAny(handler);

    bus.emit({ type: 'PlayerTraded', timestamp: Date.now(), data: { playerId: 'p1', fromTeamId: 't1', toTeamId: 't2' } } as PlayerTradedEvent);
    bus.emit({ type: 'AwardWon', timestamp: Date.now(), data: { playerId: 'p1', award: 'MVP', league: 'AL' } });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('returns event history', () => {
    const bus = new EventBus();
    bus.emit({ type: 'PlayerTraded', timestamp: 1, data: { playerId: 'p1', fromTeamId: 't1', toTeamId: 't2' } } as PlayerTradedEvent);
    bus.emit({ type: 'AwardWon', timestamp: 2, data: { playerId: 'p1', award: 'MVP', league: 'AL' } });

    expect(bus.getHistory()).toHaveLength(2);
    expect(bus.getHistory('PlayerTraded')).toHaveLength(1);
  });

  it('clears history', () => {
    const bus = new EventBus();
    bus.emit({ type: 'PlayerTraded', timestamp: 1, data: { playerId: 'p1', fromTeamId: 't1', toTeamId: 't2' } } as PlayerTradedEvent);
    bus.clearHistory();
    expect(bus.getHistory()).toHaveLength(0);
  });

  it('caps history at maxHistory', () => {
    const bus = new EventBus(3);
    for (let i = 0; i < 5; i++) {
      bus.emit({ type: 'AwardWon', timestamp: i, data: { playerId: `p${i}`, award: 'MVP', league: 'AL' } });
    }
    expect(bus.getHistory()).toHaveLength(3);
  });
});

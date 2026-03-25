import { describe, it, expect, vi } from 'vitest';
import { PhaseRunner, OFFSEASON_TIMELINE } from './PhaseRunner.ts';
import { OffseasonInbox } from './OffseasonInbox.ts';
import { EventBus } from '../ecs/EventBus.ts';
import type { PlayerTradedEvent, AwardWonEvent, ContractSignedEvent } from '../ecs/types.ts';

describe('PhaseRunner', () => {
  it('starts in preseason', () => {
    const bus = new EventBus();
    const runner = new PhaseRunner(bus);
    expect(runner.getCurrentPhase()).toBe('preseason');
  });

  it('transitions to new phase and emits event', () => {
    const bus = new EventBus();
    const runner = new PhaseRunner(bus);
    const handler = vi.fn();
    bus.on('SeasonPhaseChanged', handler);

    runner.transitionTo('regular_season');

    expect(runner.getCurrentPhase()).toBe('regular_season');
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].data.from).toBe('preseason');
    expect(handler.mock.calls[0][0].data.to).toBe('regular_season');
  });

  it('does not emit event for same-phase transition', () => {
    const bus = new EventBus();
    const runner = new PhaseRunner(bus);
    const handler = vi.fn();
    runner.transitionTo('regular_season');
    bus.on('SeasonPhaseChanged', handler);

    runner.transitionTo('regular_season');
    expect(handler).not.toHaveBeenCalled();
  });

  it('advances offseason weeks and tracks month', () => {
    const bus = new EventBus();
    const runner = new PhaseRunner(bus);
    runner.transitionTo('offseason');

    // First 4 weeks = October
    for (let i = 0; i < 4; i++) runner.advanceOffseasonWeek();
    expect(runner.getState().offseasonMonth).toBe(1); // November

    // 8 more weeks
    for (let i = 0; i < 8; i++) runner.advanceOffseasonWeek();
    expect(runner.getState().offseasonMonth).toBe(3); // January
  });

  it('offseason completes after 24 weeks', () => {
    const bus = new EventBus();
    const runner = new PhaseRunner(bus);
    runner.transitionTo('offseason');

    for (let i = 0; i < 23; i++) runner.advanceOffseasonWeek();
    expect(runner.isOffseasonComplete()).toBe(false);

    runner.advanceOffseasonWeek();
    expect(runner.isOffseasonComplete()).toBe(true);
  });

  it('advances year and resets to spring training', () => {
    const bus = new EventBus();
    const runner = new PhaseRunner(bus, 2026);
    runner.transitionTo('offseason');
    runner.advanceYear();

    expect(runner.getState().year).toBe(2027);
    expect(runner.getCurrentPhase()).toBe('spring_training');
  });

  it('serializes and deserializes', () => {
    const bus = new EventBus();
    const runner = new PhaseRunner(bus, 2026);
    runner.transitionTo('playoffs');

    const state = runner.serialize();
    const restored = PhaseRunner.deserialize(bus, state);

    expect(restored.getCurrentPhase()).toBe('playoffs');
    expect(restored.getState().year).toBe(2026);
  });

  it('offseason timeline has 6 months', () => {
    expect(OFFSEASON_TIMELINE).toHaveLength(6);
    expect(OFFSEASON_TIMELINE[0].name).toBe('October');
    expect(OFFSEASON_TIMELINE[5].name).toBe('March');
  });
});

describe('OffseasonInbox', () => {
  it('adds and retrieves items', () => {
    const inbox = new OffseasonInbox();
    inbox.addItem({ type: 'actionable', priority: 'high', week: 1, title: 'Test', description: 'Test desc' });

    expect(inbox.getAll()).toHaveLength(1);
    expect(inbox.unreadCount).toBe(1);
  });

  it('marks items as read', () => {
    const inbox = new OffseasonInbox();
    const item = inbox.addItem({ type: 'actionable', priority: 'high', week: 1, title: 'Test', description: 'Test' });

    inbox.markRead(item.id);
    expect(inbox.unreadCount).toBe(0);
  });

  it('marks items as acted on', () => {
    const inbox = new OffseasonInbox();
    const item = inbox.addItem({ type: 'actionable', priority: 'high', week: 1, title: 'Test', description: 'Test' });

    inbox.markActedOn(item.id);
    expect(inbox.actionCount).toBe(0);
    expect(inbox.unreadCount).toBe(0); // acted on also marks as read
  });

  it('generates items from dynasty events', () => {
    const inbox = new OffseasonInbox();

    inbox.generateFromEvent({
      type: 'PlayerTraded', timestamp: 1,
      data: { playerId: 'Mike Trout', fromTeamId: 'LAA', toTeamId: 'NYY' },
    } as PlayerTradedEvent, 3);

    inbox.generateFromEvent({
      type: 'AwardWon', timestamp: 2,
      data: { playerId: 'Shohei Ohtani', award: 'MVP', league: 'American' },
    } as AwardWonEvent, 1);

    expect(inbox.getAll()).toHaveLength(2);
    expect(inbox.getAll()[0].title).toContain('MVP'); // newest first
  });

  it('returns null for unhandled events', () => {
    const inbox = new OffseasonInbox();
    const result = inbox.generateFromEvent({
      type: 'GameCompleted', timestamp: 1,
      data: { homeTeamId: 'h', awayTeamId: 'a', homeScore: 1, awayScore: 2 },
    }, 1);
    expect(result).toBeNull();
  });

  it('clears all items', () => {
    const inbox = new OffseasonInbox();
    inbox.addItem({ type: 'informational', priority: 'low', week: 1, title: 'Test', description: 'Test' });
    inbox.clear();
    expect(inbox.getAll()).toHaveLength(0);
  });

  it('serializes and restores', () => {
    const inbox = new OffseasonInbox();
    inbox.addItem({ type: 'actionable', priority: 'urgent', week: 2, title: 'Big Signing', description: 'FA offer' });

    const saved = inbox.serialize();
    const restored = new OffseasonInbox();
    restored.restore(saved);

    expect(restored.getAll()).toHaveLength(1);
    expect(restored.getAll()[0].title).toBe('Big Signing');
  });
});

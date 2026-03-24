import type { System, DynastyMode, GameCompletedEvent } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { EventBus } from '../ecs/EventBus.ts';

export class CoreSimBridge implements System {
  readonly name = 'CoreSimBridge';
  readonly modes: DynastyMode[] = ['classic', 'living'];
  gamesCompleted = 0;

  private entities: EntityManager;
  private bus: EventBus;

  constructor(entities: EntityManager, bus: EventBus) {
    this.entities = entities;
    this.bus = bus;
  }

  tick(_dt: number): void {}

  recordGameCompleted(awayTeamId: string, homeTeamId: string, awayScore: number, homeScore: number): void {
    this.gamesCompleted++;
    const event: GameCompletedEvent = {
      type: 'GameCompleted',
      timestamp: Date.now(),
      data: { awayTeamId, homeTeamId, awayScore, homeScore },
    };
    this.bus.emit(event);
  }
}

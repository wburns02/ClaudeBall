import type { System, DynastyMode, SeasonPhaseChangedEvent, PlayerInjuredEvent, AwardWonEvent } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { EventBus } from '../ecs/EventBus.ts';

export class SeasonBridge implements System {
  readonly name = 'SeasonBridge';
  readonly modes: DynastyMode[] = ['classic', 'living'];

  private entities: EntityManager;
  private bus: EventBus;

  constructor(entities: EntityManager, bus: EventBus) {
    this.entities = entities;
    this.bus = bus;
  }

  tick(_dt: number): void {}

  recordPhaseChange(from: string, to: string): void {
    const event: SeasonPhaseChangedEvent = {
      type: 'SeasonPhaseChanged', timestamp: Date.now(),
      data: { from, to },
    };
    this.bus.emit(event);
  }

  recordInjury(playerId: string, teamId: string, severity: 'minor' | 'major' | 'career_ending'): void {
    const event: PlayerInjuredEvent = {
      type: 'PlayerInjured', timestamp: Date.now(),
      data: { playerId, teamId, severity },
    };
    this.bus.emit(event);
  }

  recordAward(playerId: string, award: string, league: string): void {
    const event: AwardWonEvent = {
      type: 'AwardWon', timestamp: Date.now(),
      data: { playerId, award, league },
    };
    this.bus.emit(event);
  }
}

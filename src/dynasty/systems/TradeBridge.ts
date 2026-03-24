import type { System, DynastyMode, PlayerTradedEvent } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { EventBus } from '../ecs/EventBus.ts';
import type { EntityFactory } from '../bridge/EntityFactory.ts';

export class TradeBridge implements System {
  readonly name = 'TradeBridge';
  readonly modes: DynastyMode[] = ['classic', 'living'];

  private entities: EntityManager;
  private bus: EventBus;
  private factory: EntityFactory;

  constructor(entities: EntityManager, bus: EventBus, factory: EntityFactory) {
    this.entities = entities;
    this.bus = bus;
    this.factory = factory;
  }

  tick(_dt: number): void {}

  recordTrade(playerId: string, fromTeamId: string, toTeamId: string, gmNpcId?: string): void {
    const gmEntityId = gmNpcId ? this.factory.getNPCEntityId(gmNpcId) : undefined;
    // Set entityId to the ECS entity ID so systems can find the player's components
    const playerEntityId = this.factory.getEntityId(playerId);
    const event: PlayerTradedEvent = {
      type: 'PlayerTraded', timestamp: Date.now(),
      entityId: playerEntityId,
      data: { playerId, fromTeamId, toTeamId, gmEntityId },
    };
    this.bus.emit(event);
  }
}

import type { System, DynastyMode, ContractSignedEvent, PlayerReleasedEvent, PlayerRetiredEvent } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { EventBus } from '../ecs/EventBus.ts';

export class ContractBridge implements System {
  readonly name = 'ContractBridge';
  readonly modes: DynastyMode[] = ['classic', 'living'];

  private entities: EntityManager;
  private bus: EventBus;

  constructor(entities: EntityManager, bus: EventBus) {
    this.entities = entities;
    this.bus = bus;
  }

  tick(_dt: number): void {}

  recordContractSigned(playerId: string, teamId: string, years: number, salary: number): void {
    const event: ContractSignedEvent = {
      type: 'ContractSigned', timestamp: Date.now(),
      data: { playerId, teamId, years, salary },
    };
    this.bus.emit(event);
  }

  recordPlayerReleased(playerId: string, teamId: string): void {
    const event: PlayerReleasedEvent = {
      type: 'PlayerReleased', timestamp: Date.now(),
      data: { playerId, teamId },
    };
    this.bus.emit(event);
  }

  recordPlayerRetired(playerId: string, teamId: string, age: number): void {
    const event: PlayerRetiredEvent = {
      type: 'PlayerRetired', timestamp: Date.now(),
      data: { playerId, teamId, age },
    };
    this.bus.emit(event);
  }
}

import type { System, DynastyMode, DynastyEvent, EntityId } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { EventBus } from '../ecs/EventBus.ts';
import type { ReputationComponent, ReputationMeter } from '../components/Reputation.ts';
import { adjustReputation } from '../components/Reputation.ts';

export class ReputationSystem implements System {
  readonly name = 'ReputationSystem';
  readonly modes: DynastyMode[] = ['classic', 'living'];

  constructor(
    private entities: EntityManager,
    private _bus: EventBus,
  ) {}

  tick(_dt: number): void {
    // Future: slow decay toward 0 for extreme values
  }

  handleEvent(event: DynastyEvent): void {
    switch (event.type) {
      case 'ReputationShift':
        this.onDirectShift(event);
        break;
      case 'AwardWon':
        this.onAwardWon(event);
        break;
    }
  }

  private onDirectShift(event: DynastyEvent): void {
    const entityId = event.data?.entityId as EntityId;
    const meter = event.data?.meter as ReputationMeter;
    const delta = event.data?.delta as number;
    if (!entityId || !meter || delta === undefined) return;

    const rep = this.entities.getComponent<ReputationComponent>(entityId, 'Reputation');
    if (rep) adjustReputation(rep, meter, delta);
  }

  private onAwardWon(event: DynastyEvent): void {
    const entityId = event.data?.playerId as string;
    if (!entityId) return;

    const rep = this.entities.getComponent<ReputationComponent>(entityId, 'Reputation');
    if (!rep) return;

    adjustReputation(rep, 'clubhouse', 5);
    adjustReputation(rep, 'media', 10);
    adjustReputation(rep, 'fan', 8);
  }
}

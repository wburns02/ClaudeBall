import type { System, DynastyMode, DynastyEvent } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { EventBus } from '../ecs/EventBus.ts';
import type { PersonalityComponent } from '../components/Personality.ts';

function clampTrait(value: number): number {
  return Math.max(20, Math.min(80, Math.round(value)));
}

export class PersonalitySystem implements System {
  readonly name = 'PersonalitySystem';
  readonly modes: DynastyMode[] = ['classic', 'living'];

  private entities: EntityManager;

  constructor(entities: EntityManager, _bus: EventBus) {
    this.entities = entities;
  }

  tick(_dt: number): void {
    // Personality is mostly event-driven, not tick-driven.
  }

  handleEvent(event: DynastyEvent): void {
    switch (event.type) {
      case 'PlayerTraded':
        this.onTraded(event);
        break;
      case 'AwardWon':
        this.onAwardWon(event);
        break;
    }
  }

  private onTraded(event: DynastyEvent): void {
    const playerId = event.data?.playerId as string;
    if (!playerId) return;
    const p = this.entities.getComponent<PersonalityComponent>(playerId, 'Personality');
    if (!p) return;

    const loyaltyFactor = (p.loyalty - 50) / 30;
    const composureDelta = -Math.max(1, Math.round(2 * (1 + loyaltyFactor)));
    p.composure = clampTrait(p.composure + composureDelta);
  }

  private onAwardWon(event: DynastyEvent): void {
    const playerId = event.data?.playerId as string;
    if (!playerId) return;
    const p = this.entities.getComponent<PersonalityComponent>(playerId, 'Personality');
    if (!p) return;

    p.ego = clampTrait(p.ego + 1 + Math.round(p.ego / 80));
    p.charisma = clampTrait(p.charisma + 1);
  }
}

import type { System, DynastyMode, DynastyEvent, EntityId } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { EventBus } from '../ecs/EventBus.ts';
import type { RelationshipsComponent } from '../components/Relationships.ts';
import { adjustAffinity, addTag } from '../components/Relationships.ts';
import type { PersonalityComponent } from '../components/Personality.ts';

export class RelationshipSystem implements System {
  readonly name = 'RelationshipSystem';
  readonly modes: DynastyMode[] = ['classic', 'living'];

  private entities: EntityManager;

  constructor(entities: EntityManager, _bus: EventBus) {
    this.entities = entities;
  }

  tick(_dt: number): void {
    // Relationships are primarily event-driven.
  }

  handleEvent(event: DynastyEvent): void {
    switch (event.type) {
      case 'PlayerTraded':
        this.onTraded(event);
        break;
    }
  }

  private onTraded(event: DynastyEvent): void {
    const playerId = event.data?.playerId as string;
    const gmId = event.data?.gmEntityId as string | undefined;
    if (!playerId) return;

    const playerRel = this.entities.getComponent<RelationshipsComponent>(playerId, 'Relationships');
    const playerPers = this.entities.getComponent<PersonalityComponent>(playerId, 'Personality');
    if (!playerRel || !playerPers) return;

    if (gmId) {
      const loyaltyPenalty = -Math.round(5 + (playerPers.loyalty - 50) / 5);
      adjustAffinity(playerRel, gmId, loyaltyPenalty, 'traded_away', 0);
      addTag(playerRel, gmId, 'adversarial');
    }
  }

  /**
   * Compute team chemistry from the relationship web of a set of entity IDs.
   * Returns a modifier from -10 to +10.
   */
  computeTeamChemistry(rosterEntityIds: EntityId[]): number {
    if (rosterEntityIds.length < 2) return 0;

    let totalScore = 0;
    let pairCount = 0;
    let feudCount = 0;

    for (let i = 0; i < rosterEntityIds.length; i++) {
      const rel = this.entities.getComponent<RelationshipsComponent>(rosterEntityIds[i], 'Relationships');
      const pers = this.entities.getComponent<PersonalityComponent>(rosterEntityIds[i], 'Personality');
      if (!rel) continue;

      const leadershipWeight = pers ? pers.leadership / 50 : 1;

      for (let j = i + 1; j < rosterEntityIds.length; j++) {
        const bond = rel.bonds[rosterEntityIds[j]];
        if (bond) {
          totalScore += bond.affinity * leadershipWeight;
          pairCount++;

          if (bond.affinity < -50) {
            feudCount++;
          }
        }
      }
    }

    if (pairCount === 0) return 0;

    const avg = totalScore / pairCount;
    let chemistry = Math.round(avg / 10);

    // Extra penalty for feuding pairs (-2 per feud, stacks)
    chemistry -= feudCount * 2;

    return Math.max(-10, Math.min(10, chemistry));
  }
}

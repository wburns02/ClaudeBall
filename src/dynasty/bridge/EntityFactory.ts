import type { EntityId } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { Player } from '@/engine/types/player.ts';
import { personalityFromMental, randomPersonality } from '../components/Personality.ts';
import { createRelationships } from '../components/Relationships.ts';
import { createReputation } from '../components/Reputation.ts';
import { skillsFromRatings } from '../components/Skills.ts';
import { createCareer } from '../components/Career.ts';
import type { CareerRole } from '../components/Career.ts';

export class EntityFactory {
  private playerToEntity = new Map<string, EntityId>();
  private entityToPlayer = new Map<EntityId, string>();
  private npcToEntity = new Map<string, EntityId>();
  private seedCounter = 1;
  private em: EntityManager;

  constructor(em: EntityManager) {
    this.em = em;
  }

  private rng(): number {
    this.seedCounter = (this.seedCounter * 16807) % 2147483647;
    return this.seedCounter / 2147483647;
  }

  createPlayerEntity(player: Player, teamId: string): EntityId {
    const existing = this.playerToEntity.get(player.id);
    if (existing) return existing;

    const entityId = this.em.createEntity();
    this.playerToEntity.set(player.id, entityId);
    this.entityToPlayer.set(entityId, player.id);

    const rng = () => this.rng();
    this.em.addComponent(entityId, personalityFromMental(player.mental, rng));
    this.em.addComponent(entityId, createRelationships());
    this.em.addComponent(entityId, createReputation());
    this.em.addComponent(entityId, skillsFromRatings(player.batting, player.pitching, player.fielding, rng));
    this.em.addComponent(entityId, createCareer('player', teamId));

    return entityId;
  }

  createNPCEntity(npcId: string, role: CareerRole): EntityId {
    const existing = this.npcToEntity.get(npcId);
    if (existing) return existing;

    const entityId = this.em.createEntity();
    this.npcToEntity.set(npcId, entityId);

    const rng = () => this.rng();
    this.em.addComponent(entityId, randomPersonality(rng));
    this.em.addComponent(entityId, createRelationships());
    this.em.addComponent(entityId, createReputation());
    this.em.addComponent(entityId, createCareer(role, ''));

    return entityId;
  }

  getEntityId(playerId: string): EntityId | undefined {
    return this.playerToEntity.get(playerId);
  }

  getPlayerId(entityId: EntityId): string | undefined {
    return this.entityToPlayer.get(entityId);
  }

  getNPCEntityId(npcId: string): EntityId | undefined {
    return this.npcToEntity.get(npcId);
  }
}

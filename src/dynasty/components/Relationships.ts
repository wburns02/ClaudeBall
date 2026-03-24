import type { Component, EntityId } from '../ecs/types.ts';

export type RelationshipTag = 'mentor' | 'rival' | 'friend' | 'tense' | 'romantic' | 'professional' | 'adversarial';

export interface RelationshipEntry {
  targetId: EntityId;
  affinity: number;        // -100 to +100
  history: { event: string; season: number; delta: number }[];
  tags: RelationshipTag[];
}

export interface RelationshipsComponent extends Component {
  type: 'Relationships';
  bonds: Record<EntityId, RelationshipEntry>;
}

export function createRelationships(): RelationshipsComponent {
  return { type: 'Relationships', bonds: {} };
}

export function getAffinity(rel: RelationshipsComponent, targetId: EntityId): number {
  return rel.bonds[targetId]?.affinity ?? 0;
}

export function adjustAffinity(
  rel: RelationshipsComponent,
  targetId: EntityId,
  delta: number,
  event: string,
  season: number,
): void {
  let entry = rel.bonds[targetId];
  if (!entry) {
    entry = { targetId, affinity: 0, history: [], tags: ['professional'] };
    rel.bonds[targetId] = entry;
  }
  entry.affinity = Math.max(-100, Math.min(100, entry.affinity + delta));
  entry.history.push({ event, season, delta });
}

export function addTag(rel: RelationshipsComponent, targetId: EntityId, tag: RelationshipTag): void {
  const entry = rel.bonds[targetId];
  if (entry && !entry.tags.includes(tag)) {
    entry.tags.push(tag);
  }
}

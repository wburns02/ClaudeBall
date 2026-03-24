import type { Component, EntityId } from './types.ts';

interface EntityManagerSnapshot {
  nextId: number;
  entities: Record<EntityId, Record<string, Component>>;
}

export class EntityManager {
  private nextId = 1;
  private entities = new Map<EntityId, Map<string, Component>>();

  createEntity(): EntityId {
    const id = `e_${this.nextId++}`;
    this.entities.set(id, new Map());
    return id;
  }

  entityExists(id: EntityId): boolean {
    return this.entities.has(id);
  }

  destroyEntity(id: EntityId): void {
    this.entities.delete(id);
  }

  addComponent<T extends Component>(entityId: EntityId, component: T): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;
    entity.set(component.type, component);
  }

  getComponent<T extends Component>(entityId: EntityId, type: string): T | undefined {
    return this.entities.get(entityId)?.get(type) as T | undefined;
  }

  removeComponent(entityId: EntityId, type: string): void {
    this.entities.get(entityId)?.delete(type);
  }

  /** Get all entity IDs that have ALL of the specified component types. */
  getEntitiesWith(...types: string[]): EntityId[] {
    const result: EntityId[] = [];
    for (const [id, components] of this.entities) {
      if (types.every(t => components.has(t))) {
        result.push(id);
      }
    }
    return result;
  }

  /** Get all entities (for iteration). */
  getAllEntityIds(): EntityId[] {
    return [...this.entities.keys()];
  }

  serialize(): EntityManagerSnapshot {
    const entities: Record<EntityId, Record<string, Component>> = {};
    for (const [id, components] of this.entities) {
      entities[id] = Object.fromEntries(components);
    }
    return { nextId: this.nextId, entities };
  }

  static deserialize(snapshot: EntityManagerSnapshot): EntityManager {
    const em = new EntityManager();
    em.nextId = snapshot.nextId;
    for (const [id, components] of Object.entries(snapshot.entities)) {
      const map = new Map<string, Component>();
      for (const [type, comp] of Object.entries(components)) {
        map.set(type, comp);
      }
      em.entities.set(id, map);
    }
    return em;
  }
}

# Dynasty Mode Plan 1: ECS Foundation + Core Systems

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Entity-Component-System foundation and the first three systems (Personality, Relationships, Reputation) that all subsequent dynasty features depend on.

**Architecture:** Pure TypeScript ECS with typed components, an event bus for inter-system communication, and a system runner that ticks active systems. Components are thin wrappers over existing engine types where overlap exists (Skills wraps BattingRatings/PitchingRatings, Personality wraps MentalRatings). New directory: `src/dynasty/`.

**Tech Stack:** TypeScript 5.9, Vitest (new — added for unit testing ECS), existing Mulberry32 PRNG (`RandomProvider`)

**Spec:** `docs/superpowers/specs/2026-03-23-dynasty-mode-design.md` — Sections 2, 5, 9, 12

---

## Plan Roadmap (9 Plans Total)

This is **Plan 1 of 9**. Subsequent plans build on this foundation:

| Plan | Name | Status |
|------|------|--------|
| **1** | **ECS Core + Personality + Relationships** | **This plan** |
| 2 | Engine Bridges + Season Integration | Pending |
| 3 | Conversation System | Pending |
| 4 | Hot Stove Offseason + PhaseRunner | Pending |
| 5 | Finance Systems | Pending |
| 6 | Career Progression + Life Events | Pending |
| 7 | Persistence (IndexedDB + Migration) | Pending |
| 8 | Franchise Creation + Dynasty UI | Pending |
| 9 | Notification + Voice UI | Pending |

---

## File Structure

```
src/dynasty/
  ecs/
    EventBus.ts          — Typed pub/sub event system
    EventBus.test.ts     — Unit tests
    EntityManager.ts     — Create/destroy entities, attach/detach components
    EntityManager.test.ts
    SystemRunner.ts      — Tick active systems in order, respects mode (Classic/Living)
    SystemRunner.test.ts
    types.ts             — EntityId, Component interface, System interface, Event types
  components/
    Personality.ts       — 10-trait personality data + factory from Player.mental
    Relationships.ts     — Entity-to-entity bonds with affinity, history, tags
    Reputation.ts        — Three-meter reputation (clubhouse, media, fan)
    Skills.ts            — 20-80 tool wrapper over existing ratings
    Career.ts            — Role, career history, achievements
    components.test.ts   — Unit tests for component factories and helpers
  systems/
    PersonalitySystem.ts      — Generate traits for new entities, minor evolution
    PersonalitySystem.test.ts
    RelationshipSystem.ts     — Update affinity, manage dynamics, chemistry calc
    RelationshipSystem.test.ts
    ReputationSystem.ts       — Update rep meters from events
    ReputationSystem.test.ts
```

**Note:** The spec lists `ecs/ComponentRegistry.ts` in the directory structure. This is intentionally omitted — the `EntityManager` handles component storage directly via typed maps. Components self-identify through their `type` field, making a separate registry unnecessary. Later plans should reference `EntityManager` for all component operations.

Vitest config:
```
vitest.config.ts  — (project root, new file)
```

---

### Task 1: Add Vitest + Create Dynasty Directory

**Files:**
- Modify: `package.json` (add vitest devDependency)
- Create: `vitest.config.ts`
- Create: `src/dynasty/ecs/types.ts`

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: Add test script to package.json**

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create ECS type definitions**

Create `src/dynasty/ecs/types.ts`:

```typescript
/** Unique entity identifier */
export type EntityId = string;

/** Dynasty mode — determines which systems are active */
export type DynastyMode = 'classic' | 'living';

/** Base interface for all components */
export interface Component {
  readonly type: string;
}

/** Base interface for all ECS systems */
export interface System {
  readonly name: string;
  /** Which dynasty modes this system is active in */
  readonly modes: DynastyMode[];
  /** Process a tick — called by SystemRunner */
  tick(dt: number): void;
  /** Handle a specific event */
  handleEvent?(event: DynastyEvent): void;
}

/** Base dynasty event */
export interface DynastyEvent {
  readonly type: string;
  readonly timestamp: number;
  readonly entityId?: EntityId;
  readonly data?: Record<string, unknown>;
}

// ---- Core Event Types ----

export interface GameCompletedEvent extends DynastyEvent {
  type: 'GameCompleted';
  data: { homeTeamId: string; awayTeamId: string; homeScore: number; awayScore: number };
}

export interface PlayerTradedEvent extends DynastyEvent {
  type: 'PlayerTraded';
  data: { playerId: string; fromTeamId: string; toTeamId: string; gmEntityId?: EntityId };
}

export interface PlayerSignedEvent extends DynastyEvent {
  type: 'PlayerSigned';
  data: { playerId: string; teamId: string; years: number; salary: number };
}

export interface PlayerReleasedEvent extends DynastyEvent {
  type: 'PlayerReleased';
  data: { playerId: string; teamId: string };
}

export interface PlayerRetiredEvent extends DynastyEvent {
  type: 'PlayerRetired';
  data: { playerId: string; teamId: string; age: number };
}

export interface PlayerInjuredEvent extends DynastyEvent {
  type: 'PlayerInjured';
  data: { playerId: string; teamId: string; severity: 'minor' | 'major' | 'career_ending' };
}

export interface SeasonPhaseChangedEvent extends DynastyEvent {
  type: 'SeasonPhaseChanged';
  data: { from: string; to: string };
}

export interface AwardWonEvent extends DynastyEvent {
  type: 'AwardWon';
  data: { playerId: string; award: string; league: string };
}

export interface ReputationShiftEvent extends DynastyEvent {
  type: 'ReputationShift';
  data: { entityId: EntityId; meter: 'clubhouse' | 'media' | 'fan'; delta: number; reason: string };
}

export interface RelationshipChangedEvent extends DynastyEvent {
  type: 'RelationshipChanged';
  data: { fromId: EntityId; toId: EntityId; affinityDelta: number; reason: string };
}

export interface ConversationTriggeredEvent extends DynastyEvent {
  type: 'ConversationTriggered';
  data: { situation: string; npcId: EntityId; stakes: 'routine' | 'moderate' | 'career_defining' };
}

export interface ContractOfferedEvent extends DynastyEvent {
  type: 'ContractOffered';
  data: { playerId: string; teamId: string; years: number; salary: number };
}

export interface ContractSignedEvent extends DynastyEvent {
  type: 'ContractSigned';
  data: { playerId: string; teamId: string; years: number; salary: number };
}

export interface DraftPickMadeEvent extends DynastyEvent {
  type: 'DraftPickMade';
  data: { playerId: string; teamId: string; round: number; pick: number };
}

export interface OwnerMeetingEvent extends DynastyEvent {
  type: 'OwnerMeeting';
  data: { ownerId: EntityId; gmId: EntityId; agenda: string };
}

export interface ManagerFiredEvent extends DynastyEvent {
  type: 'ManagerFired';
  data: { managerId: EntityId; teamId: string; reason: string };
}

export interface GMHiredEvent extends DynastyEvent {
  type: 'GMHired';
  data: { gmId: EntityId; teamId: string };
}

export interface GMFiredEvent extends DynastyEvent {
  type: 'GMFired';
  data: { gmId: EntityId; teamId: string; reason: string };
}

export interface FinancialEvent extends DynastyEvent {
  type: 'FinancialEvent';
  data: { entityId: EntityId; category: string; amount: number; description: string };
}

export interface LifeEventDynastyEvent extends DynastyEvent {
  type: 'LifeEvent';
  data: { entityId: EntityId; category: string; description: string };
}

export interface CareerTransitionEvent extends DynastyEvent {
  type: 'CareerTransition';
  data: { entityId: EntityId; fromRole: string; toRole: string };
}

/** Union of all event types for type-safe handlers */
export type DynastyEventMap = {
  GameCompleted: GameCompletedEvent;
  PlayerTraded: PlayerTradedEvent;
  PlayerSigned: PlayerSignedEvent;
  PlayerReleased: PlayerReleasedEvent;
  PlayerRetired: PlayerRetiredEvent;
  PlayerInjured: PlayerInjuredEvent;
  SeasonPhaseChanged: SeasonPhaseChangedEvent;
  AwardWon: AwardWonEvent;
  ReputationShift: ReputationShiftEvent;
  RelationshipChanged: RelationshipChangedEvent;
  ConversationTriggered: ConversationTriggeredEvent;
  ContractOffered: ContractOfferedEvent;
  ContractSigned: ContractSignedEvent;
  DraftPickMade: DraftPickMadeEvent;
  OwnerMeeting: OwnerMeetingEvent;
  ManagerFired: ManagerFiredEvent;
  GMHired: GMHiredEvent;
  GMFired: GMFiredEvent;
  FinancialEvent: FinancialEvent;
  LifeEvent: LifeEventDynastyEvent;
  CareerTransition: CareerTransitionEvent;
};
```

- [ ] **Step 5: Verify vitest runs (no tests yet, should exit clean)**

```bash
npx vitest run
```

Expected: "No test files found" or similar clean exit.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/dynasty/
git commit -m "feat(dynasty): add vitest + ECS type definitions"
git push
```

---

### Task 2: EventBus

**Files:**
- Create: `src/dynasty/ecs/EventBus.ts`
- Create: `src/dynasty/ecs/EventBus.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/dynasty/ecs/EventBus.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './EventBus.ts';
import type { PlayerTradedEvent } from './types.ts';

describe('EventBus', () => {
  it('delivers events to subscribers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('PlayerTraded', handler);

    const event: PlayerTradedEvent = {
      type: 'PlayerTraded',
      timestamp: Date.now(),
      data: { playerId: 'p1', fromTeamId: 't1', toTeamId: 't2' },
    };
    bus.emit(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('does not deliver to unsubscribed handlers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on('PlayerTraded', handler);
    unsub();

    bus.emit({ type: 'PlayerTraded', timestamp: Date.now(), data: { playerId: 'p1', fromTeamId: 't1', toTeamId: 't2' } } as PlayerTradedEvent);
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports wildcard subscribers', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.onAny(handler);

    bus.emit({ type: 'PlayerTraded', timestamp: Date.now(), data: { playerId: 'p1', fromTeamId: 't1', toTeamId: 't2' } } as PlayerTradedEvent);
    bus.emit({ type: 'AwardWon', timestamp: Date.now(), data: { playerId: 'p1', award: 'MVP', league: 'AL' } });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('returns event history', () => {
    const bus = new EventBus();
    bus.emit({ type: 'PlayerTraded', timestamp: 1, data: { playerId: 'p1', fromTeamId: 't1', toTeamId: 't2' } } as PlayerTradedEvent);
    bus.emit({ type: 'AwardWon', timestamp: 2, data: { playerId: 'p1', award: 'MVP', league: 'AL' } });

    expect(bus.getHistory()).toHaveLength(2);
    expect(bus.getHistory('PlayerTraded')).toHaveLength(1);
  });

  it('clears history', () => {
    const bus = new EventBus();
    bus.emit({ type: 'PlayerTraded', timestamp: 1, data: { playerId: 'p1', fromTeamId: 't1', toTeamId: 't2' } } as PlayerTradedEvent);
    bus.clearHistory();
    expect(bus.getHistory()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/dynasty/ecs/EventBus.test.ts
```

Expected: FAIL — `EventBus` not found.

- [ ] **Step 3: Implement EventBus**

Create `src/dynasty/ecs/EventBus.ts`:

```typescript
import type { DynastyEvent } from './types.ts';

type EventHandler = (event: DynastyEvent) => void;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private wildcardHandlers = new Set<EventHandler>();
  private history: DynastyEvent[] = [];
  private maxHistory: number;

  constructor(maxHistory = 5000) {
    this.maxHistory = maxHistory;
  }

  /** Subscribe to a specific event type. Returns unsubscribe function. */
  on(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    return () => { this.handlers.get(eventType)?.delete(handler); };
  }

  /** Subscribe to all events. Returns unsubscribe function. */
  onAny(handler: EventHandler): () => void {
    this.wildcardHandlers.add(handler);
    return () => { this.wildcardHandlers.delete(handler); };
  }

  /** Emit an event to all matching subscribers. */
  emit(event: DynastyEvent): void {
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const h of handlers) h(event);
    }
    for (const h of this.wildcardHandlers) h(event);
  }

  /** Get event history, optionally filtered by type. */
  getHistory(eventType?: string): DynastyEvent[] {
    if (eventType) return this.history.filter(e => e.type === eventType);
    return [...this.history];
  }

  /** Clear event history. */
  clearHistory(): void {
    this.history = [];
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/dynasty/ecs/EventBus.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dynasty/ecs/EventBus.ts src/dynasty/ecs/EventBus.test.ts
git commit -m "feat(dynasty): implement EventBus with typed pub/sub"
git push
```

---

### Task 3: EntityManager + ComponentRegistry

**Files:**
- Create: `src/dynasty/ecs/EntityManager.ts`
- Create: `src/dynasty/ecs/EntityManager.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/dynasty/ecs/EntityManager.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EntityManager } from './EntityManager.ts';
import type { Component, EntityId } from './types.ts';

interface TestPersonality extends Component {
  type: 'Personality';
  workEthic: number;
  ego: number;
}

interface TestReputation extends Component {
  type: 'Reputation';
  clubhouse: number;
  media: number;
  fan: number;
}

describe('EntityManager', () => {
  it('creates entities with unique IDs', () => {
    const em = new EntityManager();
    const id1 = em.createEntity();
    const id2 = em.createEntity();
    expect(id1).not.toBe(id2);
    expect(em.entityExists(id1)).toBe(true);
  });

  it('attaches and retrieves components', () => {
    const em = new EntityManager();
    const id = em.createEntity();
    const personality: TestPersonality = { type: 'Personality', workEthic: 70, ego: 40 };

    em.addComponent(id, personality);
    const result = em.getComponent<TestPersonality>(id, 'Personality');
    expect(result).toEqual(personality);
  });

  it('returns undefined for missing components', () => {
    const em = new EntityManager();
    const id = em.createEntity();
    expect(em.getComponent(id, 'Personality')).toBeUndefined();
  });

  it('removes components', () => {
    const em = new EntityManager();
    const id = em.createEntity();
    em.addComponent(id, { type: 'Personality', workEthic: 70, ego: 40 } as TestPersonality);
    em.removeComponent(id, 'Personality');
    expect(em.getComponent(id, 'Personality')).toBeUndefined();
  });

  it('destroys entities and all their components', () => {
    const em = new EntityManager();
    const id = em.createEntity();
    em.addComponent(id, { type: 'Personality', workEthic: 70, ego: 40 } as TestPersonality);
    em.destroyEntity(id);
    expect(em.entityExists(id)).toBe(false);
    expect(em.getComponent(id, 'Personality')).toBeUndefined();
  });

  it('queries entities by component type', () => {
    const em = new EntityManager();
    const id1 = em.createEntity();
    const id2 = em.createEntity();
    const id3 = em.createEntity();

    em.addComponent(id1, { type: 'Personality', workEthic: 70, ego: 40 } as TestPersonality);
    em.addComponent(id2, { type: 'Personality', workEthic: 50, ego: 80 } as TestPersonality);
    em.addComponent(id2, { type: 'Reputation', clubhouse: 10, media: 20, fan: 30 } as TestReputation);

    const withPersonality = em.getEntitiesWith('Personality');
    expect(withPersonality).toHaveLength(2);
    expect(withPersonality).toContain(id1);
    expect(withPersonality).toContain(id2);
    expect(withPersonality).not.toContain(id3);
  });

  it('queries entities with multiple component types', () => {
    const em = new EntityManager();
    const id1 = em.createEntity();
    const id2 = em.createEntity();

    em.addComponent(id1, { type: 'Personality', workEthic: 70, ego: 40 } as TestPersonality);
    em.addComponent(id2, { type: 'Personality', workEthic: 50, ego: 80 } as TestPersonality);
    em.addComponent(id2, { type: 'Reputation', clubhouse: 10, media: 20, fan: 30 } as TestReputation);

    const withBoth = em.getEntitiesWith('Personality', 'Reputation');
    expect(withBoth).toHaveLength(1);
    expect(withBoth[0]).toBe(id2);
  });

  it('serializes and deserializes all state', () => {
    const em = new EntityManager();
    const id = em.createEntity();
    em.addComponent(id, { type: 'Personality', workEthic: 70, ego: 40 } as TestPersonality);

    const snapshot = em.serialize();
    const em2 = EntityManager.deserialize(snapshot);
    const restored = em2.getComponent<TestPersonality>(id, 'Personality');
    expect(restored?.workEthic).toBe(70);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/dynasty/ecs/EntityManager.test.ts
```

Expected: FAIL — `EntityManager` not found.

- [ ] **Step 3: Implement EntityManager**

Create `src/dynasty/ecs/EntityManager.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/dynasty/ecs/EntityManager.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dynasty/ecs/EntityManager.ts src/dynasty/ecs/EntityManager.test.ts
git commit -m "feat(dynasty): implement EntityManager with component queries + serialization"
git push
```

---

### Task 4: SystemRunner

**Files:**
- Create: `src/dynasty/ecs/SystemRunner.ts`
- Create: `src/dynasty/ecs/SystemRunner.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/dynasty/ecs/SystemRunner.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { SystemRunner } from './SystemRunner.ts';
import { EventBus } from './EventBus.ts';
import { EntityManager } from './EntityManager.ts';
import type { System, DynastyMode } from './types.ts';

function makeSystem(name: string, modes: DynastyMode[] = ['classic', 'living']): System & { tick: ReturnType<typeof vi.fn> } {
  return {
    name,
    modes,
    tick: vi.fn(),
  };
}

describe('SystemRunner', () => {
  it('ticks all systems in order', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'classic');

    const order: string[] = [];
    const sys1 = makeSystem('A');
    sys1.tick.mockImplementation(() => order.push('A'));
    const sys2 = makeSystem('B');
    sys2.tick.mockImplementation(() => order.push('B'));

    runner.addSystem(sys1);
    runner.addSystem(sys2);
    runner.tick(1);

    expect(order).toEqual(['A', 'B']);
  });

  it('skips systems not active in current mode', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'classic');

    const livingOnly = makeSystem('LivingOnly', ['living']);
    const both = makeSystem('Both', ['classic', 'living']);

    runner.addSystem(livingOnly);
    runner.addSystem(both);
    runner.tick(1);

    expect(livingOnly.tick).not.toHaveBeenCalled();
    expect(both.tick).toHaveBeenCalledOnce();
  });

  it('routes events to systems with handleEvent', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'classic');

    const handler = vi.fn();
    const sys: System = {
      name: 'Test',
      modes: ['classic', 'living'],
      tick: vi.fn(),
      handleEvent: handler,
    };

    runner.addSystem(sys);
    bus.emit({ type: 'PlayerTraded', timestamp: 1, data: { playerId: 'p1', fromTeamId: 't1', toTeamId: 't2' } });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('allows changing mode at runtime', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'classic');

    const livingOnly = makeSystem('LivingOnly', ['living']);
    runner.addSystem(livingOnly);

    runner.tick(1);
    expect(livingOnly.tick).not.toHaveBeenCalled();

    runner.setMode('living');
    runner.tick(1);
    expect(livingOnly.tick).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/dynasty/ecs/SystemRunner.test.ts
```

Expected: FAIL — `SystemRunner` not found.

- [ ] **Step 3: Implement SystemRunner**

Create `src/dynasty/ecs/SystemRunner.ts`:

```typescript
import type { System, DynastyMode, DynastyEvent } from './types.ts';
import type { EventBus } from './EventBus.ts';
import type { EntityManager } from './EntityManager.ts';

export class SystemRunner {
  private systems: System[] = [];
  private mode: DynastyMode;
  readonly bus: EventBus;
  readonly entities: EntityManager;

  constructor(bus: EventBus, entities: EntityManager, mode: DynastyMode) {
    this.bus = bus;
    this.entities = entities;
    this.mode = mode;

    // Route all bus events to systems with handleEvent
    this.bus.onAny((event: DynastyEvent) => {
      for (const sys of this.systems) {
        if (sys.handleEvent && sys.modes.includes(this.mode)) {
          sys.handleEvent(event);
        }
      }
    });
  }

  addSystem(system: System): void {
    this.systems.push(system);
  }

  setMode(mode: DynastyMode): void {
    this.mode = mode;
  }

  getMode(): DynastyMode {
    return this.mode;
  }

  /** Tick all active systems in registration order. */
  tick(dt: number): void {
    for (const sys of this.systems) {
      if (sys.modes.includes(this.mode)) {
        sys.tick(dt);
      }
    }
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/dynasty/ecs/SystemRunner.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dynasty/ecs/SystemRunner.ts src/dynasty/ecs/SystemRunner.test.ts
git commit -m "feat(dynasty): implement SystemRunner with mode-aware ticking + event routing"
git push
```

---

### Task 5: Core Components (Personality, Relationships, Reputation, Skills, Career)

**Files:**
- Create: `src/dynasty/components/Personality.ts`
- Create: `src/dynasty/components/Relationships.ts`
- Create: `src/dynasty/components/Reputation.ts`
- Create: `src/dynasty/components/Skills.ts`
- Create: `src/dynasty/components/Career.ts`
- Create: `src/dynasty/components/index.ts`

- [ ] **Step 1: Create Personality component**

Create `src/dynasty/components/Personality.ts`:

```typescript
import type { Component } from '../ecs/types.ts';
import type { MentalRatings } from '@/engine/types/player.ts';

export interface PersonalityComponent extends Component {
  type: 'Personality';
  workEthic: number;     // 20-80
  ego: number;
  loyalty: number;
  charisma: number;
  baseballIQ: number;
  composure: number;
  leadership: number;
  aggression: number;
  coachability: number;
  integrity: number;
}

/** Map from existing MentalRatings (0-100) to Personality (20-80). */
function ratingTo2080(value: number): number {
  return Math.round(value * 0.6 + 20);
}

/** Random trait in 20-80 range. */
function randomTrait(rng: () => number): number {
  return Math.round(rng() * 60 + 20);
}

/** Generate a Personality from existing MentalRatings + random for new traits. */
export function personalityFromMental(mental: MentalRatings, rng: () => number): PersonalityComponent {
  return {
    type: 'Personality',
    workEthic: ratingTo2080(mental.work_ethic),
    ego: randomTrait(rng),
    loyalty: randomTrait(rng),
    charisma: randomTrait(rng),
    baseballIQ: ratingTo2080(mental.intelligence),
    composure: ratingTo2080(mental.composure),
    leadership: ratingTo2080(mental.leadership),
    aggression: randomTrait(rng),
    coachability: randomTrait(rng),
    integrity: randomTrait(rng),
  };
}

/** Generate a fully random Personality (for NPCs like owners, agents). */
export function randomPersonality(rng: () => number): PersonalityComponent {
  return {
    type: 'Personality',
    workEthic: randomTrait(rng),
    ego: randomTrait(rng),
    loyalty: randomTrait(rng),
    charisma: randomTrait(rng),
    baseballIQ: randomTrait(rng),
    composure: randomTrait(rng),
    leadership: randomTrait(rng),
    aggression: randomTrait(rng),
    coachability: randomTrait(rng),
    integrity: randomTrait(rng),
  };
}
```

- [ ] **Step 2: Create Relationships component**

Create `src/dynasty/components/Relationships.ts`:

```typescript
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
```

- [ ] **Step 3: Create Reputation component**

Create `src/dynasty/components/Reputation.ts`:

```typescript
import type { Component } from '../ecs/types.ts';

export type ReputationMeter = 'clubhouse' | 'media' | 'fan';

export type ReputationLabel = 'Beloved' | 'Liked' | 'Neutral' | 'Disliked' | 'Hated';

export interface ReputationComponent extends Component {
  type: 'Reputation';
  clubhouse: number;  // -100 to +100
  media: number;
  fan: number;
}

export function createReputation(): ReputationComponent {
  return { type: 'Reputation', clubhouse: 0, media: 0, fan: 0 };
}

export function adjustReputation(rep: ReputationComponent, meter: ReputationMeter, delta: number): void {
  rep[meter] = Math.max(-100, Math.min(100, rep[meter] + delta));
}

export function getReputationLabel(value: number): ReputationLabel {
  if (value >= 60) return 'Beloved';
  if (value >= 20) return 'Liked';
  if (value >= -20) return 'Neutral';
  if (value >= -60) return 'Disliked';
  return 'Hated';
}
```

- [ ] **Step 4: Create Skills component**

Create `src/dynasty/components/Skills.ts`:

```typescript
import type { Component } from '../ecs/types.ts';
import type { BattingRatings, PitchingRatings, FieldingRatings } from '@/engine/types/player.ts';

export interface ToolGrade {
  current: number;   // 20-80
  potential: number;  // 20-80
}

export interface SkillsComponent extends Component {
  type: 'Skills';
  // Hitters
  hitL: ToolGrade;
  hitR: ToolGrade;
  powerL: ToolGrade;
  powerR: ToolGrade;
  eye: ToolGrade;
  speed: ToolGrade;
  arm: ToolGrade;
  field: ToolGrade;
  // Pitchers
  fastball: ToolGrade;
  breaking: ToolGrade;
  changeup: ToolGrade;
  command: ToolGrade;
}

function to2080(val: number): number {
  return Math.round(val * 0.6 + 20);
}

function grade(current100: number, potentialBonus: number, rng: () => number): ToolGrade {
  const current = to2080(current100);
  const potential = Math.min(80, current + Math.round(rng() * potentialBonus));
  return { current, potential };
}

export function skillsFromRatings(
  batting: BattingRatings,
  pitching: PitchingRatings,
  fielding: FieldingRatings[],
  rng: () => number,
): SkillsComponent {
  const primaryFielding = fielding[0];
  const potBonus = 15; // max potential above current

  return {
    type: 'Skills',
    hitL: grade(batting.contact_L, potBonus, rng),
    hitR: grade(batting.contact_R, potBonus, rng),
    powerL: grade(batting.power_L, potBonus, rng),
    powerR: grade(batting.power_R, potBonus, rng),
    eye: grade(batting.eye, potBonus, rng),
    speed: grade(batting.speed, potBonus, rng),
    arm: grade(primaryFielding?.arm_strength ?? 50, potBonus, rng),
    field: grade(primaryFielding?.range ?? 50, potBonus, rng),
    fastball: grade(pitching.stuff, potBonus, rng),
    breaking: grade(pitching.movement, potBonus, rng),
    changeup: grade(Math.round(pitching.stuff * 0.5 + pitching.control * 0.5), potBonus, rng),
    command: grade(pitching.control, potBonus, rng),
  };
}
```

- [ ] **Step 5: Create Career component**

Create `src/dynasty/components/Career.ts`:

```typescript
import type { Component } from '../ecs/types.ts';

export type CareerRole = 'player' | 'scout' | 'coach' | 'manager' | 'assistant_gm' | 'gm' | 'president' | 'owner' | 'broadcaster' | 'retired';

export interface CareerEntry {
  role: CareerRole;
  teamId: string;
  startSeason: number;
  endSeason?: number;
}

export interface CareerComponent extends Component {
  type: 'Career';
  currentRole: CareerRole;
  currentTeamId: string;
  history: CareerEntry[];
  achievements: string[];
  awards: { type: string; season: number }[];
}

export function createCareer(role: CareerRole, teamId: string): CareerComponent {
  return {
    type: 'Career',
    currentRole: role,
    currentTeamId: teamId,
    history: [],
    achievements: [],
    awards: [],
  };
}
```

- [ ] **Step 6: Create barrel export**

Create `src/dynasty/components/index.ts`:

```typescript
export * from './Personality.ts';
export * from './Relationships.ts';
export * from './Reputation.ts';
export * from './Skills.ts';
export * from './Career.ts';
```

- [ ] **Step 7: Write component unit tests**

Create `src/dynasty/components/components.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { personalityFromMental, randomPersonality } from './Personality.ts';
import { createRelationships, getAffinity, adjustAffinity, addTag } from './Relationships.ts';
import { createReputation, adjustReputation, getReputationLabel } from './Reputation.ts';
import type { MentalRatings } from '@/engine/types/player.ts';

describe('Personality', () => {
  const mental: MentalRatings = {
    intelligence: 100, work_ethic: 0, durability: 50,
    consistency: 50, composure: 50, leadership: 50,
  };
  let seed = 42;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  it('maps 0 → 20 and 100 → 80 via ratingTo2080', () => {
    seed = 42;
    const p = personalityFromMental(mental, rng);
    expect(p.baseballIQ).toBe(80); // 100 * 0.6 + 20 = 80
    expect(p.workEthic).toBe(20);  // 0 * 0.6 + 20 = 20
  });

  it('all random traits are in 20-80 range', () => {
    seed = 1;
    const p = randomPersonality(rng);
    for (const key of Object.keys(p) as (keyof typeof p)[]) {
      if (key === 'type') continue;
      expect(p[key]).toBeGreaterThanOrEqual(20);
      expect(p[key]).toBeLessThanOrEqual(80);
    }
  });
});

describe('Relationships', () => {
  it('getAffinity returns 0 for unknown target', () => {
    const rel = createRelationships();
    expect(getAffinity(rel, 'unknown')).toBe(0);
  });

  it('adjustAffinity clamps to -100..+100', () => {
    const rel = createRelationships();
    adjustAffinity(rel, 'x', 200, 'test', 1);
    expect(getAffinity(rel, 'x')).toBe(100);
    adjustAffinity(rel, 'x', -300, 'test', 1);
    expect(getAffinity(rel, 'x')).toBe(-100);
  });

  it('addTag does not duplicate', () => {
    const rel = createRelationships();
    adjustAffinity(rel, 'x', 10, 'test', 1);
    addTag(rel, 'x', 'friend');
    addTag(rel, 'x', 'friend');
    expect(rel.bonds['x'].tags).toEqual(['professional', 'friend']);
  });
});

describe('Reputation', () => {
  it('adjustReputation clamps to -100..+100', () => {
    const rep = createReputation();
    adjustReputation(rep, 'fan', 150);
    expect(rep.fan).toBe(100);
    adjustReputation(rep, 'fan', -250);
    expect(rep.fan).toBe(-100);
  });

  it('getReputationLabel boundary values', () => {
    expect(getReputationLabel(60)).toBe('Beloved');
    expect(getReputationLabel(59)).toBe('Liked');
    expect(getReputationLabel(20)).toBe('Liked');
    expect(getReputationLabel(19)).toBe('Neutral');
    expect(getReputationLabel(-20)).toBe('Neutral');
    expect(getReputationLabel(-21)).toBe('Disliked');
    expect(getReputationLabel(-60)).toBe('Disliked');
    expect(getReputationLabel(-61)).toBe('Hated');
  });
});
```

- [ ] **Step 8: Run component tests**

```bash
npx vitest run src/dynasty/components/components.test.ts
```

Expected: All tests PASS.

- [ ] **Step 9: Verify build compiles**

```bash
npx tsc --project tsconfig.app.json --noEmit
```

Expected: Clean compile, no errors.

- [ ] **Step 10: Commit and push**

```bash
git add src/dynasty/components/
git commit -m "feat(dynasty): add core components — Personality, Relationships, Reputation, Skills, Career"
git push
```

---

### Task 6: PersonalitySystem

**Files:**
- Create: `src/dynasty/systems/PersonalitySystem.ts`
- Create: `src/dynasty/systems/PersonalitySystem.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/dynasty/systems/PersonalitySystem.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PersonalitySystem } from './PersonalitySystem.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import { EventBus } from '../ecs/EventBus.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { PlayerTradedEvent, AwardWonEvent } from '../ecs/types.ts';

describe('PersonalitySystem', () => {
  function setup() {
    const bus = new EventBus();
    const em = new EntityManager();
    const sys = new PersonalitySystem(em, bus);
    return { bus, em, sys };
  }

  it('does not crash on tick with no entities', () => {
    const { sys } = setup();
    expect(() => sys.tick(1)).not.toThrow();
  });

  it('nudges composure down on trade event for traded player', () => {
    const { bus, em, sys } = setup();
    const id = em.createEntity();
    const personality: PersonalityComponent = {
      type: 'Personality', workEthic: 50, ego: 60, loyalty: 70, charisma: 50,
      baseballIQ: 50, composure: 50, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    };
    em.addComponent(id, personality);

    const event: PlayerTradedEvent = {
      type: 'PlayerTraded', timestamp: 1,
      data: { playerId: id, fromTeamId: 't1', toTeamId: 't2' },
    };
    sys.handleEvent!(event);

    const updated = em.getComponent<PersonalityComponent>(id, 'Personality')!;
    // High loyalty player should lose composure when traded
    expect(updated.composure).toBeLessThan(50);
  });

  it('boosts ego slightly on award win', () => {
    const { bus, em, sys } = setup();
    const id = em.createEntity();
    const personality: PersonalityComponent = {
      type: 'Personality', workEthic: 50, ego: 50, loyalty: 50, charisma: 50,
      baseballIQ: 50, composure: 50, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    };
    em.addComponent(id, personality);

    const event: AwardWonEvent = {
      type: 'AwardWon', timestamp: 1,
      data: { playerId: id, award: 'MVP', league: 'AL' },
    };
    sys.handleEvent!(event);

    const updated = em.getComponent<PersonalityComponent>(id, 'Personality')!;
    expect(updated.ego).toBeGreaterThan(50);
  });

  it('clamps trait values to 20-80', () => {
    const { bus, em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, {
      type: 'Personality', workEthic: 50, ego: 79, loyalty: 50, charisma: 50,
      baseballIQ: 50, composure: 50, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    } as PersonalityComponent);

    // Multiple award wins shouldn't push ego past 80
    for (let i = 0; i < 10; i++) {
      sys.handleEvent!({
        type: 'AwardWon', timestamp: i,
        data: { playerId: id, award: 'MVP', league: 'AL' },
      } as AwardWonEvent);
    }

    const updated = em.getComponent<PersonalityComponent>(id, 'Personality')!;
    expect(updated.ego).toBeLessThanOrEqual(80);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/dynasty/systems/PersonalitySystem.test.ts
```

Expected: FAIL — `PersonalitySystem` not found.

- [ ] **Step 3: Implement PersonalitySystem**

Create `src/dynasty/systems/PersonalitySystem.ts`:

```typescript
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

  constructor(
    private entities: EntityManager,
    private bus: EventBus,
  ) {}

  tick(_dt: number): void {
    // Personality is mostly event-driven, not tick-driven.
    // Future: slow seasonal drift could happen here.
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

    // High loyalty players take trades harder
    const loyaltyFactor = (p.loyalty - 50) / 30; // 0 at 50, ~1 at 80
    const composureDelta = -Math.max(1, Math.round(2 * (1 + loyaltyFactor)));
    p.composure = clampTrait(p.composure + composureDelta);
  }

  private onAwardWon(event: DynastyEvent): void {
    const playerId = event.data?.playerId as string;
    if (!playerId) return;
    const p = this.entities.getComponent<PersonalityComponent>(playerId, 'Personality');
    if (!p) return;

    // Awards slightly boost ego (+1 to +2)
    p.ego = clampTrait(p.ego + 1 + Math.round(p.ego / 80));
    // And charisma via media exposure
    p.charisma = clampTrait(p.charisma + 1);
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/dynasty/systems/PersonalitySystem.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dynasty/systems/PersonalitySystem.ts src/dynasty/systems/PersonalitySystem.test.ts
git commit -m "feat(dynasty): implement PersonalitySystem — event-driven trait evolution"
git push
```

---

### Task 7: RelationshipSystem + Chemistry Engine

**Files:**
- Create: `src/dynasty/systems/RelationshipSystem.ts`
- Create: `src/dynasty/systems/RelationshipSystem.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/dynasty/systems/RelationshipSystem.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { RelationshipSystem } from './RelationshipSystem.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import { EventBus } from '../ecs/EventBus.ts';
import { createRelationships, getAffinity } from '../components/Relationships.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { RelationshipsComponent } from '../components/Relationships.ts';
import type { PlayerTradedEvent } from '../ecs/types.ts';

function makePersonality(overrides: Partial<PersonalityComponent> = {}): PersonalityComponent {
  return {
    type: 'Personality', workEthic: 50, ego: 50, loyalty: 50, charisma: 50,
    baseballIQ: 50, composure: 50, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    ...overrides,
  };
}

describe('RelationshipSystem', () => {
  function setup() {
    const bus = new EventBus();
    const em = new EntityManager();
    const sys = new RelationshipSystem(em, bus);
    return { bus, em, sys };
  }

  it('creates relationship on trade event between traded player and GM', () => {
    const { em, sys } = setup();

    const playerId = em.createEntity();
    em.addComponent(playerId, makePersonality({ loyalty: 70 }));
    em.addComponent(playerId, createRelationships());

    const gmId = em.createEntity();
    em.addComponent(gmId, makePersonality());
    em.addComponent(gmId, createRelationships());

    const event: PlayerTradedEvent = {
      type: 'PlayerTraded', timestamp: 1,
      data: { playerId, fromTeamId: 't1', toTeamId: 't2', gmEntityId: gmId },
    };

    sys.handleEvent!(event);

    const playerRel = em.getComponent<RelationshipsComponent>(playerId, 'Relationships')!;
    // Loyal player resents being traded
    expect(getAffinity(playerRel, gmId)).toBeLessThan(0);
  });

  it('computes team chemistry from relationship web', () => {
    const { em, sys } = setup();

    // Create 3 players with mutual positive relationships
    const ids = [em.createEntity(), em.createEntity(), em.createEntity()];
    for (const id of ids) {
      em.addComponent(id, makePersonality({ leadership: 70 }));
      const rel = createRelationships();
      for (const otherId of ids) {
        if (otherId !== id) {
          rel.bonds[otherId] = { targetId: otherId, affinity: 50, history: [], tags: ['friend'] };
        }
      }
      em.addComponent(id, rel);
    }

    const chemistry = sys.computeTeamChemistry(ids);
    expect(chemistry).toBeGreaterThan(0);
    expect(chemistry).toBeLessThanOrEqual(10);
  });

  it('returns negative chemistry for feuding players', () => {
    const { em, sys } = setup();

    const ids = [em.createEntity(), em.createEntity()];
    for (const id of ids) {
      em.addComponent(id, makePersonality({ leadership: 30 }));
      const rel = createRelationships();
      for (const otherId of ids) {
        if (otherId !== id) {
          rel.bonds[otherId] = { targetId: otherId, affinity: -70, history: [], tags: ['adversarial'] };
        }
      }
      em.addComponent(id, rel);
    }

    const chemistry = sys.computeTeamChemistry(ids);
    expect(chemistry).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/dynasty/systems/RelationshipSystem.test.ts
```

Expected: FAIL — `RelationshipSystem` not found.

- [ ] **Step 3: Implement RelationshipSystem**

Create `src/dynasty/systems/RelationshipSystem.ts`:

```typescript
import type { System, DynastyMode, DynastyEvent, EntityId } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { EventBus } from '../ecs/EventBus.ts';
import type { RelationshipsComponent } from '../components/Relationships.ts';
import { adjustAffinity, addTag } from '../components/Relationships.ts';
import type { PersonalityComponent } from '../components/Personality.ts';

export class RelationshipSystem implements System {
  readonly name = 'RelationshipSystem';
  readonly modes: DynastyMode[] = ['classic', 'living'];

  constructor(
    private entities: EntityManager,
    private bus: EventBus,
  ) {}

  tick(_dt: number): void {
    // Relationships are primarily event-driven.
    // Future: slow natural decay of extreme affinity values toward 0.
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
    const gmId = event.data?.gmEntityId as string | undefined;
    if (!playerId) return;

    const playerRel = this.entities.getComponent<RelationshipsComponent>(playerId, 'Relationships');
    const playerPers = this.entities.getComponent<PersonalityComponent>(playerId, 'Personality');
    if (!playerRel || !playerPers) return;

    // Player resents the GM who traded them (scaled by loyalty)
    if (gmId) {
      const loyaltyPenalty = -Math.round(5 + (playerPers.loyalty - 50) / 5);
      adjustAffinity(playerRel, gmId, loyaltyPenalty, 'traded_away', 0);
      addTag(playerRel, gmId, 'adversarial');
    }
  }

  private onAwardWon(event: DynastyEvent): void {
    // Teammates gain slight affinity toward award winner (reflected glory)
    // Implementation deferred until team roster entities are bridged (Plan 2)
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

      const leadershipWeight = pers ? pers.leadership / 50 : 1; // >1 for leaders, <1 for non-leaders

      for (let j = i + 1; j < rosterEntityIds.length; j++) {
        const bond = rel.bonds[rosterEntityIds[j]];
        if (bond) {
          totalScore += bond.affinity * leadershipWeight;
          pairCount++;

          // Feuding penalty: affinity < -50 gets extra weight (spec Section 5)
          if (bond.affinity < -50) {
            feudCount++;
          }
        }
      }
    }

    if (pairCount === 0) return 0;

    // Normalize to -10..+10 range
    const avg = totalScore / pairCount;
    let chemistry = Math.round(avg / 10);

    // Extra penalty for feuding pairs (-2 per feud, stacks)
    chemistry -= feudCount * 2;

    // TODO (Plan 2): Bonus for high-Leadership + high-Loyalty clusters

    return Math.max(-10, Math.min(10, chemistry));
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/dynasty/systems/RelationshipSystem.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dynasty/systems/RelationshipSystem.ts src/dynasty/systems/RelationshipSystem.test.ts
git commit -m "feat(dynasty): implement RelationshipSystem + Chemistry Engine"
git push
```

---

### Task 8: ReputationSystem

**Files:**
- Create: `src/dynasty/systems/ReputationSystem.ts`
- Create: `src/dynasty/systems/ReputationSystem.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/dynasty/systems/ReputationSystem.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ReputationSystem } from './ReputationSystem.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import { EventBus } from '../ecs/EventBus.ts';
import { createReputation, getReputationLabel } from '../components/Reputation.ts';
import type { ReputationComponent } from '../components/Reputation.ts';
import type { ReputationShiftEvent, AwardWonEvent, PlayerTradedEvent } from '../ecs/types.ts';

describe('ReputationSystem', () => {
  function setup() {
    const bus = new EventBus();
    const em = new EntityManager();
    const sys = new ReputationSystem(em, bus);
    return { bus, em, sys };
  }

  it('applies direct reputation shift events', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, createReputation());

    const event: ReputationShiftEvent = {
      type: 'ReputationShift', timestamp: 1,
      data: { entityId: id, meter: 'fan', delta: 15, reason: 'walkoff_homer' },
    };
    sys.handleEvent!(event);

    const rep = em.getComponent<ReputationComponent>(id, 'Reputation')!;
    expect(rep.fan).toBe(15);
  });

  it('boosts all three meters on award win', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    em.addComponent(id, createReputation());

    const event: AwardWonEvent = {
      type: 'AwardWon', timestamp: 1,
      entityId: id,
      data: { playerId: id, award: 'MVP', league: 'AL' },
    };
    sys.handleEvent!(event);

    const rep = em.getComponent<ReputationComponent>(id, 'Reputation')!;
    expect(rep.clubhouse).toBeGreaterThan(0);
    expect(rep.media).toBeGreaterThan(0);
    expect(rep.fan).toBeGreaterThan(0);
  });

  it('clamps reputation to -100..+100', () => {
    const { em, sys } = setup();
    const id = em.createEntity();
    const rep = createReputation();
    rep.fan = 95;
    em.addComponent(id, rep);

    sys.handleEvent!({
      type: 'ReputationShift', timestamp: 1,
      data: { entityId: id, meter: 'fan', delta: 50, reason: 'test' },
    } as ReputationShiftEvent);

    const updated = em.getComponent<ReputationComponent>(id, 'Reputation')!;
    expect(updated.fan).toBe(100);
  });

  it('reputation labels map correctly', () => {
    expect(getReputationLabel(80)).toBe('Beloved');
    expect(getReputationLabel(30)).toBe('Liked');
    expect(getReputationLabel(0)).toBe('Neutral');
    expect(getReputationLabel(-40)).toBe('Disliked');
    expect(getReputationLabel(-80)).toBe('Hated');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/dynasty/systems/ReputationSystem.test.ts
```

Expected: FAIL — `ReputationSystem` not found.

- [ ] **Step 3: Implement ReputationSystem**

Create `src/dynasty/systems/ReputationSystem.ts`:

```typescript
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
    private bus: EventBus,
  ) {}

  tick(_dt: number): void {
    // Future: slow decay toward 0 for extreme values (compounding erosion)
  }

  handleEvent(event: DynastyEvent): void {
    switch (event.type) {
      case 'ReputationShift':
        this.onDirectShift(event);
        break;
      case 'AwardWon':
        this.onAwardWon(event);
        break;
      case 'PlayerTraded':
        this.onPlayerTraded(event);
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
    const entityId = event.entityId ?? (event.data?.playerId as string);
    if (!entityId) return;

    const rep = this.entities.getComponent<ReputationComponent>(entityId, 'Reputation');
    if (!rep) return;

    // Awards boost all three meters
    adjustReputation(rep, 'clubhouse', 5);   // teammates respect winners
    adjustReputation(rep, 'media', 10);      // media loves award winners
    adjustReputation(rep, 'fan', 8);         // fans love stars
  }

  private onPlayerTraded(event: DynastyEvent): void {
    // GM who traded a popular player takes a fan rep hit
    // Deferred until GM entity is available (Plan 2)
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/dynasty/systems/ReputationSystem.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dynasty/systems/ReputationSystem.ts src/dynasty/systems/ReputationSystem.test.ts
git commit -m "feat(dynasty): implement ReputationSystem — three-meter reputation tracking"
git push
```

---

### Task 9: Integration Test — Full ECS Round Trip

**Files:**
- Create: `src/dynasty/ecs/integration.test.ts`

- [ ] **Step 1: Write integration test**

Create `src/dynasty/ecs/integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EventBus } from './EventBus.ts';
import { EntityManager } from './EntityManager.ts';
import { SystemRunner } from './SystemRunner.ts';
import { PersonalitySystem } from '../systems/PersonalitySystem.ts';
import { RelationshipSystem } from '../systems/RelationshipSystem.ts';
import { ReputationSystem } from '../systems/ReputationSystem.ts';
import { personalityFromMental } from '../components/Personality.ts';
import { createRelationships, getAffinity, adjustAffinity } from '../components/Relationships.ts';
import { createReputation, getReputationLabel } from '../components/Reputation.ts';
import { createCareer } from '../components/Career.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { ReputationComponent } from '../components/Reputation.ts';
import type { RelationshipsComponent } from '../components/Relationships.ts';
import type { MentalRatings } from '@/engine/types/player.ts';
import type { PlayerTradedEvent, AwardWonEvent } from './types.ts';

describe('ECS Integration', () => {
  function buildWorld() {
    const bus = new EventBus();
    const em = new EntityManager();
    const runner = new SystemRunner(bus, em, 'classic');

    runner.addSystem(new PersonalitySystem(em, bus));
    runner.addSystem(new RelationshipSystem(em, bus));
    runner.addSystem(new ReputationSystem(em, bus));

    return { bus, em, runner };
  }

  it('creates a player entity with all core components', () => {
    const { em } = buildWorld();

    const id = em.createEntity();
    const mental: MentalRatings = {
      intelligence: 70, work_ethic: 80, durability: 60,
      consistency: 55, composure: 65, leadership: 75,
    };
    let seed = 42;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

    em.addComponent(id, personalityFromMental(mental, rng));
    em.addComponent(id, createRelationships());
    em.addComponent(id, createReputation());
    em.addComponent(id, createCareer('player', 'team1'));

    const p = em.getComponent<PersonalityComponent>(id, 'Personality')!;
    expect(p.workEthic).toBe(68); // ratingTo2080(80) = 68
    expect(p.baseballIQ).toBe(62); // ratingTo2080(70) = 62
    expect(p.leadership).toBe(65); // ratingTo2080(75) = 65
  });

  it('fires PlayerTraded and all systems react', () => {
    const { bus, em, runner } = buildWorld();

    // Create player
    const playerId = em.createEntity();
    em.addComponent(playerId, {
      type: 'Personality', workEthic: 50, ego: 50, loyalty: 70, charisma: 50,
      baseballIQ: 50, composure: 60, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    } as PersonalityComponent);
    em.addComponent(playerId, createRelationships());
    em.addComponent(playerId, createReputation());

    // Create GM
    const gmId = em.createEntity();
    em.addComponent(gmId, {
      type: 'Personality', workEthic: 50, ego: 50, loyalty: 50, charisma: 50,
      baseballIQ: 70, composure: 60, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    } as PersonalityComponent);
    em.addComponent(gmId, createRelationships());
    em.addComponent(gmId, createReputation());

    // Fire trade event
    const event: PlayerTradedEvent = {
      type: 'PlayerTraded', timestamp: Date.now(),
      data: { playerId, fromTeamId: 't1', toTeamId: 't2', gmEntityId: gmId },
    };
    bus.emit(event);

    // PersonalitySystem should have reduced player composure
    const playerPers = em.getComponent<PersonalityComponent>(playerId, 'Personality')!;
    expect(playerPers.composure).toBeLessThan(60);

    // RelationshipSystem should have created negative bond player→GM
    const playerRel = em.getComponent(playerId, 'Relationships')!;
    expect(getAffinity(playerRel as any, gmId)).toBeLessThan(0);

    // EventBus should have recorded the event
    expect(bus.getHistory('PlayerTraded')).toHaveLength(1);
  });

  it('MVP award boosts reputation across all meters', () => {
    const { bus, em } = buildWorld();

    const id = em.createEntity();
    em.addComponent(id, {
      type: 'Personality', workEthic: 50, ego: 50, loyalty: 50, charisma: 50,
      baseballIQ: 50, composure: 50, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    } as PersonalityComponent);
    em.addComponent(id, createReputation());

    bus.emit({
      type: 'AwardWon', timestamp: 1,
      data: { playerId: id, award: 'MVP', league: 'AL' },
    } as AwardWonEvent);

    const rep = em.getComponent<ReputationComponent>(id, 'Reputation')!;
    expect(rep.clubhouse).toBe(5);
    expect(rep.media).toBe(10);
    expect(rep.fan).toBe(8);
    expect(getReputationLabel(rep.fan)).toBe('Neutral'); // 8 is still neutral range
  });

  it('serializes and restores full world state including relationships', () => {
    const { em } = buildWorld();

    const id1 = em.createEntity();
    const id2 = em.createEntity();
    em.addComponent(id1, {
      type: 'Personality', workEthic: 65, ego: 45, loyalty: 70, charisma: 50,
      baseballIQ: 55, composure: 60, leadership: 70, aggression: 30, coachability: 60, integrity: 75,
    } as PersonalityComponent);
    em.addComponent(id1, createReputation());
    const rel = createRelationships();
    adjustAffinity(rel, id2, 42, 'test_bond', 1);
    em.addComponent(id1, rel);

    const snapshot = em.serialize();
    const restored = EntityManager.deserialize(snapshot);

    const p = restored.getComponent<PersonalityComponent>(id1, 'Personality')!;
    expect(p.workEthic).toBe(65);
    expect(p.integrity).toBe(75);

    const r = restored.getComponent<ReputationComponent>(id1, 'Reputation')!;
    expect(r.clubhouse).toBe(0);

    // Relationships with Record (not Map) survive JSON serialization
    const restoredRel = restored.getComponent<RelationshipsComponent>(id1, 'Relationships')!;
    expect(restoredRel.bonds[id2].affinity).toBe(42);
    expect(restoredRel.bonds[id2].history).toHaveLength(1);
  });

  it('living mode enables all systems, classic skips living-only', () => {
    const bus = new EventBus();
    const em = new EntityManager();

    // Create a mock living-only system
    let livingTicked = false;
    const livingSystem = {
      name: 'MockLivingSystem',
      modes: ['living' as const],
      tick: () => { livingTicked = true; },
    };

    const classicRunner = new SystemRunner(bus, em, 'classic');
    classicRunner.addSystem(livingSystem);
    classicRunner.tick(1);
    expect(livingTicked).toBe(false);

    const livingRunner = new SystemRunner(bus, em, 'living');
    livingRunner.addSystem(livingSystem);
    livingRunner.tick(1);
    expect(livingTicked).toBe(true);
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All tests across all files PASS. This validates the full ECS foundation works end-to-end.

- [ ] **Step 3: Run build to verify no TypeScript errors**

```bash
npx tsc --project tsconfig.app.json --noEmit
```

Expected: Clean compile.

- [ ] **Step 4: Commit**

```bash
git add src/dynasty/ecs/integration.test.ts
git commit -m "feat(dynasty): add integration tests — full ECS round trip verified"
```

- [ ] **Step 5: Push to GitHub**

```bash
git push
```

---

## Summary

After completing all 9 tasks, the following is in place:

- **Vitest** configured for unit testing
- **EventBus** — typed pub/sub with history
- **EntityManager** — create/destroy entities, attach/query components, serialize/deserialize
- **SystemRunner** — mode-aware system ticking, event routing to systems
- **5 Components** — Personality, Relationships, Reputation, Skills, Career
- **3 Systems** — PersonalitySystem, RelationshipSystem (with Chemistry Engine), ReputationSystem
- **Integration tests** proving the full event-driven loop works
- **27+ unit tests** covering all functionality

This is the foundation for Plans 2-9. The next plan (Engine Bridges) will wrap the existing game engines into ECS systems that emit events onto this bus.

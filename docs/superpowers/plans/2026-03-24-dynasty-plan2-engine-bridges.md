# Dynasty Mode Plan 2: Engine Bridges + Season Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bridge existing game engines into the ECS by wrapping them with thin adapter systems that emit events onto the EventBus, allowing Plan 1's Personality/Relationship/Reputation systems to react to gameplay.

**Architecture:** Each bridge system wraps an existing engine class, delegates to its methods, and emits typed events after operations complete. The bridges do NOT replace the existing engines or stores — they sit alongside them. A `DynastyBridge` singleton connects the ECS world to the franchise store, syncing entity state with player/team data. The Chemistry Engine output is injected into `AtBatResolver` via a new `clutchModifier` parameter.

**Tech Stack:** TypeScript 5.9, Vitest, existing engine classes

**Spec:** `docs/superpowers/specs/2026-03-23-dynasty-mode-design.md` — Section 12 (Engine Bridge Layer)

**Depends on:** Plan 1 (ECS Core + Components + Systems) — completed

---

## File Structure

```
src/dynasty/
  bridge/
    DynastyBridge.ts         — Singleton connecting ECS world to franchise store
    DynastyBridge.test.ts
    EntityFactory.ts         — Create ECS entities from existing Player/Team data
    EntityFactory.test.ts
  systems/
    CoreSimBridge.ts         — Wraps game completion → emits GameCompleted
    CoreSimBridge.test.ts
    SeasonBridge.ts          — Wraps season advancement → emits SeasonPhaseChanged
    SeasonBridge.test.ts
    ContractBridge.ts        — Wraps contract operations → emits ContractSigned/PlayerReleased
    ContractBridge.test.ts
    TradeBridge.ts           — Wraps trade execution → emits PlayerTraded
    TradeBridge.test.ts

Existing files modified:
  src/engine/core/AtBatResolver.ts  — Add clutchModifier parameter to resolve()
```

**Not bridged in this plan (deferred to Plan 4/future):**
- DraftEngine → DraftBridge (Plan 4: Hot Stove Offseason)
- DevelopmentEngine → DevelopmentBridge (Plan 4: Offseason phases)
- ScoutingEngine → ScoutingBridge (Plan 4: Offseason)
- AITradeManager (already fires through TradeBridge when trades execute)
- InjuryEngine (already called within SeasonEngine.advanceDay)

---

### Task 1: EntityFactory — Create ECS entities from Player/Team data

**Files:**
- Create: `src/dynasty/bridge/EntityFactory.ts`
- Create: `src/dynasty/bridge/EntityFactory.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/dynasty/bridge/EntityFactory.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EntityFactory } from './EntityFactory.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { RelationshipsComponent } from '../components/Relationships.ts';
import type { ReputationComponent } from '../components/Reputation.ts';
import type { SkillsComponent } from '../components/Skills.ts';
import type { CareerComponent } from '../components/Career.ts';
import type { Player } from '@/engine/types/player.ts';
import type { Position } from '@/engine/types/enums.ts';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    firstName: 'Mike',
    lastName: 'Trout',
    number: 27,
    position: 'CF' as Position,
    bats: 'R' as any,
    throws: 'R' as any,
    age: 28,
    batting: {
      contact_L: 70, contact_R: 80, power_L: 85, power_R: 90,
      eye: 75, avoid_k: 60, gap_power: 70, speed: 65, steal: 50,
      bunt: 30, clutch: 70,
    },
    pitching: {
      stuff: 30, movement: 25, control: 30, stamina: 20,
      velocity: 80, hold_runners: 40, groundball_pct: 50,
      repertoire: ['fastball'],
    },
    fielding: [{
      position: 'CF' as Position, range: 75, arm_strength: 70,
      arm_accuracy: 65, turn_dp: 40, error_rate: 15,
    }],
    mental: {
      intelligence: 70, work_ethic: 80, durability: 75,
      consistency: 65, composure: 60, leadership: 55,
    },
    state: { fatigue: 0, morale: 80, pitchCount: 0, isInjured: false },
    ...overrides,
  };
}

describe('EntityFactory', () => {
  it('creates a player entity with all 5 components', () => {
    const em = new EntityManager();
    const factory = new EntityFactory(em);

    const player = makePlayer();
    const entityId = factory.createPlayerEntity(player, 'team1');

    expect(em.entityExists(entityId)).toBe(true);
    expect(em.getComponent<PersonalityComponent>(entityId, 'Personality')).toBeDefined();
    expect(em.getComponent<RelationshipsComponent>(entityId, 'Relationships')).toBeDefined();
    expect(em.getComponent<ReputationComponent>(entityId, 'Reputation')).toBeDefined();
    expect(em.getComponent<SkillsComponent>(entityId, 'Skills')).toBeDefined();
    expect(em.getComponent<CareerComponent>(entityId, 'Career')).toBeDefined();
  });

  it('maps player ID to entity ID bidirectionally', () => {
    const em = new EntityManager();
    const factory = new EntityFactory(em);

    const player = makePlayer({ id: 'player-abc' });
    const entityId = factory.createPlayerEntity(player, 'team1');

    expect(factory.getEntityId('player-abc')).toBe(entityId);
    expect(factory.getPlayerId(entityId)).toBe('player-abc');
  });

  it('personality wraps mental ratings correctly', () => {
    const em = new EntityManager();
    const factory = new EntityFactory(em);

    const player = makePlayer();
    const entityId = factory.createPlayerEntity(player, 'team1');
    const p = em.getComponent<PersonalityComponent>(entityId, 'Personality')!;

    // ratingTo2080(80) = 68 for work_ethic
    expect(p.workEthic).toBe(68);
    // ratingTo2080(70) = 62 for intelligence → baseballIQ
    expect(p.baseballIQ).toBe(62);
  });

  it('career component has correct role and team', () => {
    const em = new EntityManager();
    const factory = new EntityFactory(em);

    const entityId = factory.createPlayerEntity(makePlayer(), 'team-xyz');
    const c = em.getComponent<CareerComponent>(entityId, 'Career')!;

    expect(c.currentRole).toBe('player');
    expect(c.currentTeamId).toBe('team-xyz');
  });

  it('does not create duplicate entities for same player ID', () => {
    const em = new EntityManager();
    const factory = new EntityFactory(em);

    const id1 = factory.createPlayerEntity(makePlayer({ id: 'p1' }), 'team1');
    const id2 = factory.createPlayerEntity(makePlayer({ id: 'p1' }), 'team1');

    expect(id1).toBe(id2); // Same entity returned
  });

  it('creates NPC entity (owner) with personality only', () => {
    const em = new EntityManager();
    const factory = new EntityFactory(em);

    const entityId = factory.createNPCEntity('owner-1', 'owner');
    expect(em.getComponent<PersonalityComponent>(entityId, 'Personality')).toBeDefined();
    expect(em.getComponent<ReputationComponent>(entityId, 'Reputation')).toBeDefined();
    expect(em.getComponent<SkillsComponent>(entityId, 'Skills')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/dynasty/bridge/EntityFactory.test.ts
```

Expected: FAIL — `EntityFactory` not found.

- [ ] **Step 3: Implement EntityFactory**

Create `src/dynasty/bridge/EntityFactory.ts`:

```typescript
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

  constructor(private em: EntityManager) {}

  private rng(): number {
    // Simple deterministic RNG for personality generation
    this.seedCounter = (this.seedCounter * 16807) % 2147483647;
    return this.seedCounter / 2147483647;
  }

  createPlayerEntity(player: Player, teamId: string): EntityId {
    // Return existing entity if player already registered
    const existing = this.playerToEntity.get(player.id);
    if (existing) return existing;

    const entityId = this.em.createEntity();

    // Map bidirectionally
    this.playerToEntity.set(player.id, entityId);
    this.entityToPlayer.set(entityId, player.id);

    // Attach all 5 core components
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/dynasty/bridge/EntityFactory.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit and push**

```bash
git add src/dynasty/bridge/
git commit -m "feat(dynasty): implement EntityFactory — create ECS entities from Player/Team data"
git push
```

---

### Task 2: CoreSimBridge — Emit GameCompleted events

**Files:**
- Create: `src/dynasty/systems/CoreSimBridge.ts`
- Create: `src/dynasty/systems/CoreSimBridge.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/dynasty/systems/CoreSimBridge.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { CoreSimBridge } from './CoreSimBridge.ts';
import { EventBus } from '../ecs/EventBus.ts';
import { EntityManager } from '../ecs/EntityManager.ts';

describe('CoreSimBridge', () => {
  it('emits GameCompleted event with scores', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const bridge = new CoreSimBridge(em, bus);

    const handler = vi.fn();
    bus.on('GameCompleted', handler);

    bridge.recordGameCompleted('away-1', 'home-1', 3, 5);

    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0][0];
    expect(event.type).toBe('GameCompleted');
    expect(event.data.awayTeamId).toBe('away-1');
    expect(event.data.homeTeamId).toBe('home-1');
    expect(event.data.awayScore).toBe(3);
    expect(event.data.homeScore).toBe(5);
  });

  it('tracks games completed count', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const bridge = new CoreSimBridge(em, bus);

    bridge.recordGameCompleted('a', 'h', 1, 2);
    bridge.recordGameCompleted('a', 'h', 3, 4);

    expect(bridge.gamesCompleted).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/dynasty/systems/CoreSimBridge.test.ts
```

- [ ] **Step 3: Implement CoreSimBridge**

Create `src/dynasty/systems/CoreSimBridge.ts`:

```typescript
import type { System, DynastyMode, GameCompletedEvent } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { EventBus } from '../ecs/EventBus.ts';

export class CoreSimBridge implements System {
  readonly name = 'CoreSimBridge';
  readonly modes: DynastyMode[] = ['classic', 'living'];
  gamesCompleted = 0;

  private entities: EntityManager;
  private bus: EventBus;

  constructor(entities: EntityManager, bus: EventBus) {
    this.entities = entities;
    this.bus = bus;
  }

  tick(_dt: number): void {
    // CoreSim is event-driven, not tick-driven
  }

  /** Called after any game completes (sim or live). Emits GameCompleted event. */
  recordGameCompleted(awayTeamId: string, homeTeamId: string, awayScore: number, homeScore: number): void {
    this.gamesCompleted++;
    const event: GameCompletedEvent = {
      type: 'GameCompleted',
      timestamp: Date.now(),
      data: { awayTeamId, homeTeamId, awayScore, homeScore },
    };
    this.bus.emit(event);
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/dynasty/systems/CoreSimBridge.test.ts
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit and push**

```bash
git add src/dynasty/systems/CoreSimBridge.ts src/dynasty/systems/CoreSimBridge.test.ts
git commit -m "feat(dynasty): implement CoreSimBridge — emits GameCompleted events"
git push
```

---

### Task 3: ContractBridge — Emit contract events

**Files:**
- Create: `src/dynasty/systems/ContractBridge.ts`
- Create: `src/dynasty/systems/ContractBridge.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/dynasty/systems/ContractBridge.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ContractBridge } from './ContractBridge.ts';
import { EventBus } from '../ecs/EventBus.ts';
import { EntityManager } from '../ecs/EntityManager.ts';

describe('ContractBridge', () => {
  it('emits ContractSigned on signContract', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const bridge = new ContractBridge(em, bus);

    const handler = vi.fn();
    bus.on('ContractSigned', handler);

    bridge.recordContractSigned('p1', 'team1', 3, 5000);

    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0][0];
    expect(event.data.playerId).toBe('p1');
    expect(event.data.teamId).toBe('team1');
    expect(event.data.years).toBe(3);
    expect(event.data.salary).toBe(5000);
  });

  it('emits PlayerReleased on release', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const bridge = new ContractBridge(em, bus);

    const handler = vi.fn();
    bus.on('PlayerReleased', handler);

    bridge.recordPlayerReleased('p2', 'team2');

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].data.playerId).toBe('p2');
  });

  it('emits PlayerRetired on retirement', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const bridge = new ContractBridge(em, bus);

    const handler = vi.fn();
    bus.on('PlayerRetired', handler);

    bridge.recordPlayerRetired('p3', 'team3', 38);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].data.age).toBe(38);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/dynasty/systems/ContractBridge.test.ts
```

- [ ] **Step 3: Implement ContractBridge**

Create `src/dynasty/systems/ContractBridge.ts`:

```typescript
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
      type: 'ContractSigned',
      timestamp: Date.now(),
      data: { playerId, teamId, years, salary },
    };
    this.bus.emit(event);
  }

  recordPlayerReleased(playerId: string, teamId: string): void {
    const event: PlayerReleasedEvent = {
      type: 'PlayerReleased',
      timestamp: Date.now(),
      data: { playerId, teamId },
    };
    this.bus.emit(event);
  }

  recordPlayerRetired(playerId: string, teamId: string, age: number): void {
    const event: PlayerRetiredEvent = {
      type: 'PlayerRetired',
      timestamp: Date.now(),
      data: { playerId, teamId, age },
    };
    this.bus.emit(event);
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/dynasty/systems/ContractBridge.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit and push**

```bash
git add src/dynasty/systems/ContractBridge.ts src/dynasty/systems/ContractBridge.test.ts
git commit -m "feat(dynasty): implement ContractBridge — emits ContractSigned/PlayerReleased/PlayerRetired"
git push
```

---

### Task 4: TradeBridge — Emit PlayerTraded events

**Files:**
- Create: `src/dynasty/systems/TradeBridge.ts`
- Create: `src/dynasty/systems/TradeBridge.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/dynasty/systems/TradeBridge.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { TradeBridge } from './TradeBridge.ts';
import { EventBus } from '../ecs/EventBus.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import { EntityFactory } from '../bridge/EntityFactory.ts';
import { createRelationships, getAffinity } from '../components/Relationships.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import { PersonalitySystem } from './PersonalitySystem.ts';
import { RelationshipSystem } from './RelationshipSystem.ts';
import { SystemRunner } from '../ecs/SystemRunner.ts';

describe('TradeBridge', () => {
  it('emits PlayerTraded event with GM entity ID', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const factory = new EntityFactory(em);
    const bridge = new TradeBridge(em, bus, factory);

    const handler = vi.fn();
    bus.on('PlayerTraded', handler);

    // Create a GM entity
    factory.createNPCEntity('gm-1', 'gm');

    bridge.recordTrade('player-1', 'team-a', 'team-b', 'gm-1');

    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0][0];
    expect(event.data.playerId).toBe('player-1');
    expect(event.data.fromTeamId).toBe('team-a');
    expect(event.data.toTeamId).toBe('team-b');
    expect(event.data.gmEntityId).toBeDefined();
  });

  it('triggers personality + relationship reaction via event bus', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const factory = new EntityFactory(em);
    const runner = new SystemRunner(bus, em, 'classic');

    // Register systems that react to PlayerTraded
    runner.addSystem(new PersonalitySystem(em, bus));
    runner.addSystem(new RelationshipSystem(em, bus));

    const bridge = new TradeBridge(em, bus, factory);

    // Create player entity with high loyalty
    const player = {
      id: 'p1', firstName: 'Test', lastName: 'Player', number: 1,
      position: 'SS' as any, bats: 'R' as any, throws: 'R' as any, age: 25,
      batting: { contact_L: 60, contact_R: 60, power_L: 50, power_R: 50, eye: 55, avoid_k: 50, gap_power: 45, speed: 60, steal: 50, bunt: 30, clutch: 55 },
      pitching: { stuff: 20, movement: 20, control: 20, stamina: 20, velocity: 75, hold_runners: 30, groundball_pct: 50, repertoire: ['fastball' as any] },
      fielding: [{ position: 'SS' as any, range: 70, arm_strength: 65, arm_accuracy: 60, turn_dp: 55, error_rate: 20 }],
      mental: { intelligence: 60, work_ethic: 70, durability: 65, consistency: 55, composure: 60, leadership: 50 },
      state: { fatigue: 0, morale: 80, pitchCount: 0, isInjured: false },
    };

    const playerEntityId = factory.createPlayerEntity(player as any, 'team-a');

    // Override personality to have high loyalty for test
    em.addComponent(playerEntityId, {
      type: 'Personality', workEthic: 50, ego: 50, loyalty: 75, charisma: 50,
      baseballIQ: 50, composure: 60, leadership: 50, aggression: 50, coachability: 50, integrity: 50,
    } as PersonalityComponent);

    // Create GM entity
    const gmEntityId = factory.createNPCEntity('gm-1', 'gm');

    // Fire trade — should trigger personality composure drop + relationship penalty
    bridge.recordTrade('p1', 'team-a', 'team-b', 'gm-1');

    // Verify personality reacted
    const pers = em.getComponent<PersonalityComponent>(playerEntityId, 'Personality')!;
    expect(pers.composure).toBeLessThan(60);

    // Verify relationship created with negative affinity
    const rel = em.getComponent(playerEntityId, 'Relationships')!;
    expect(getAffinity(rel as any, gmEntityId)).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/dynasty/systems/TradeBridge.test.ts
```

- [ ] **Step 3: Implement TradeBridge**

Create `src/dynasty/systems/TradeBridge.ts`:

```typescript
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

  /** Record a trade and emit PlayerTraded event for each player moved. */
  recordTrade(playerId: string, fromTeamId: string, toTeamId: string, gmNpcId?: string): void {
    const gmEntityId = gmNpcId ? this.factory.getNPCEntityId(gmNpcId) : undefined;

    const event: PlayerTradedEvent = {
      type: 'PlayerTraded',
      timestamp: Date.now(),
      data: { playerId, fromTeamId, toTeamId, gmEntityId },
    };
    this.bus.emit(event);
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/dynasty/systems/TradeBridge.test.ts
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit and push**

```bash
git add src/dynasty/systems/TradeBridge.ts src/dynasty/systems/TradeBridge.test.ts
git commit -m "feat(dynasty): implement TradeBridge — emits PlayerTraded, triggers personality+relationship reactions"
git push
```

---

### Task 5: SeasonBridge — Emit SeasonPhaseChanged + PlayerInjured events

**Files:**
- Create: `src/dynasty/systems/SeasonBridge.ts`
- Create: `src/dynasty/systems/SeasonBridge.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/dynasty/systems/SeasonBridge.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { SeasonBridge } from './SeasonBridge.ts';
import { EventBus } from '../ecs/EventBus.ts';
import { EntityManager } from '../ecs/EntityManager.ts';

describe('SeasonBridge', () => {
  it('emits SeasonPhaseChanged event', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const bridge = new SeasonBridge(em, bus);

    const handler = vi.fn();
    bus.on('SeasonPhaseChanged', handler);

    bridge.recordPhaseChange('regular_season', 'playoffs');

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].data.from).toBe('regular_season');
    expect(handler.mock.calls[0][0].data.to).toBe('playoffs');
  });

  it('emits PlayerInjured event', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const bridge = new SeasonBridge(em, bus);

    const handler = vi.fn();
    bus.on('PlayerInjured', handler);

    bridge.recordInjury('p1', 'team1', 'major');

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].data.severity).toBe('major');
  });

  it('emits AwardWon event', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const bridge = new SeasonBridge(em, bus);

    const handler = vi.fn();
    bus.on('AwardWon', handler);

    bridge.recordAward('p1', 'MVP', 'American');

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].data.award).toBe('MVP');
    expect(handler.mock.calls[0][0].data.league).toBe('American');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/dynasty/systems/SeasonBridge.test.ts
```

- [ ] **Step 3: Implement SeasonBridge**

Create `src/dynasty/systems/SeasonBridge.ts`:

```typescript
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
      type: 'SeasonPhaseChanged',
      timestamp: Date.now(),
      data: { from, to },
    };
    this.bus.emit(event);
  }

  recordInjury(playerId: string, teamId: string, severity: 'minor' | 'major' | 'career_ending'): void {
    const event: PlayerInjuredEvent = {
      type: 'PlayerInjured',
      timestamp: Date.now(),
      data: { playerId, teamId, severity },
    };
    this.bus.emit(event);
  }

  recordAward(playerId: string, award: string, league: string): void {
    const event: AwardWonEvent = {
      type: 'AwardWon',
      timestamp: Date.now(),
      data: { playerId, award, league },
    };
    this.bus.emit(event);
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/dynasty/systems/SeasonBridge.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit and push**

```bash
git add src/dynasty/systems/SeasonBridge.ts src/dynasty/systems/SeasonBridge.test.ts
git commit -m "feat(dynasty): implement SeasonBridge — emits SeasonPhaseChanged/PlayerInjured/AwardWon"
git push
```

---

### Task 6: Chemistry Engine → AtBatResolver integration

**Files:**
- Modify: `src/engine/core/AtBatResolver.ts` (add `clutchModifier` parameter)
- Create: `src/dynasty/bridge/ChemistryIntegration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/dynasty/bridge/ChemistryIntegration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { EntityManager } from '../ecs/EntityManager.ts';
import { EventBus } from '../ecs/EventBus.ts';
import { RelationshipSystem } from '../systems/RelationshipSystem.ts';
import { createRelationships } from '../components/Relationships.ts';
import type { PersonalityComponent } from '../components/Personality.ts';

describe('Chemistry → AtBatResolver Integration', () => {
  it('computes chemistry modifier that can be passed to AtBatResolver', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const relSystem = new RelationshipSystem(em, bus);

    // Create a team of 3 players with strong bonds
    const ids = [em.createEntity(), em.createEntity(), em.createEntity()];
    for (const id of ids) {
      em.addComponent(id, {
        type: 'Personality', workEthic: 50, ego: 50, loyalty: 50, charisma: 50,
        baseballIQ: 50, composure: 50, leadership: 70, aggression: 50, coachability: 50, integrity: 50,
      } as PersonalityComponent);
      const rel = createRelationships();
      for (const otherId of ids) {
        if (otherId !== id) {
          rel.bonds[otherId] = { targetId: otherId, affinity: 60, history: [], tags: ['friend'] };
        }
      }
      em.addComponent(id, rel);
    }

    const modifier = relSystem.computeTeamChemistry(ids);

    // Should be positive (good chemistry) and in -10..+10 range
    expect(modifier).toBeGreaterThan(0);
    expect(modifier).toBeLessThanOrEqual(10);
    expect(modifier).toBeGreaterThanOrEqual(-10);

    // This modifier would be passed as clutchModifier to AtBatResolver.resolve()
    // The actual integration happens in the franchise store when it calls resolve()
  });

  it('returns 0 for empty team', () => {
    const bus = new EventBus();
    const em = new EntityManager();
    const relSystem = new RelationshipSystem(em, bus);

    expect(relSystem.computeTeamChemistry([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — verify it passes** (chemistry already works from Plan 1)

```bash
npx vitest run src/dynasty/bridge/ChemistryIntegration.test.ts
```

Expected: PASS (this is a validation test, not TDD — chemistry is already implemented).

- [ ] **Step 3: Add clutchModifier parameter to AtBatResolver.resolve()**

Modify `src/engine/core/AtBatResolver.ts`. Add `clutchModifier` as an optional 10th parameter:

Find the resolve method signature (line ~131):
```typescript
static resolve(
  batter: Player,
  pitcher: Player,
  fielders: Map<Position, Player>,
  bases: BaseState,
  outs: number,
  ballpark: BallparkFactors,
  rng: RandomProvider,
  isBuntMode: boolean = false,
  isIntentionalWalk: boolean = false
): AtBatResult {
```

Change to:
```typescript
static resolve(
  batter: Player,
  pitcher: Player,
  fielders: Map<Position, Player>,
  bases: BaseState,
  outs: number,
  ballpark: BallparkFactors,
  rng: RandomProvider,
  isBuntMode: boolean = false,
  isIntentionalWalk: boolean = false,
  clutchModifier: number = 0
): AtBatResult {
```

Then find where `batter.batting.clutch` is used in the resolve method and add the modifier. Search for `clutch` usage in the method body. If `clutch` is used in a calculation like:
```typescript
const clutchFactor = batter.batting.clutch / 100;
```

Add the modifier:
```typescript
const clutchFactor = (batter.batting.clutch + clutchModifier) / 100;
```

If `clutch` is not directly used in `resolve()`, add it to the contact calculation. Find the contact probability calculation and add:
```typescript
// Chemistry modifier: applies in clutch situations (runners in scoring position)
const isClutchSituation = bases.first || bases.second || bases.third;
const chemistryBonus = isClutchSituation ? clutchModifier * 0.5 : 0; // ±5 max impact on contact
```

Then add `chemistryBonus` to the contact probability.

- [ ] **Step 4: Verify build compiles**

```bash
npx tsc --project tsconfig.app.json --noEmit
```

Expected: Clean compile (clutchModifier defaults to 0, so all existing callers still work).

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 6: Commit and push**

```bash
git add src/engine/core/AtBatResolver.ts src/dynasty/bridge/ChemistryIntegration.test.ts
git commit -m "feat(dynasty): integrate Chemistry Engine into AtBatResolver via clutchModifier"
git push
```

---

### Task 7: DynastyBridge — Singleton connecting ECS world to franchise store

**Files:**
- Create: `src/dynasty/bridge/DynastyBridge.ts`
- Create: `src/dynasty/bridge/DynastyBridge.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/dynasty/bridge/DynastyBridge.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { DynastyBridge } from './DynastyBridge.ts';
import type { Player } from '@/engine/types/player.ts';
import type { Team } from '@/engine/types/team.ts';

function makePlayer(id: string, age = 25): Player {
  return {
    id, firstName: 'Test', lastName: `Player-${id}`, number: 1,
    position: 'SS' as any, bats: 'R' as any, throws: 'R' as any, age,
    batting: { contact_L: 60, contact_R: 60, power_L: 50, power_R: 50, eye: 55, avoid_k: 50, gap_power: 45, speed: 60, steal: 50, bunt: 30, clutch: 55 },
    pitching: { stuff: 20, movement: 20, control: 20, stamina: 20, velocity: 75, hold_runners: 30, groundball_pct: 50, repertoire: ['fastball' as any] },
    fielding: [{ position: 'SS' as any, range: 70, arm_strength: 65, arm_accuracy: 60, turn_dp: 55, error_rate: 20 }],
    mental: { intelligence: 60, work_ethic: 70, durability: 65, consistency: 55, composure: 60, leadership: 50 },
    state: { fatigue: 0, morale: 80, pitchCount: 0, isInjured: false },
  };
}

function makeTeam(id: string, players: Player[]): Team {
  return {
    id, name: `Team-${id}`, abbreviation: id.toUpperCase().slice(0, 3),
    city: 'Test City', primaryColor: '#000', secondaryColor: '#fff',
    roster: { players }, lineup: [], pitcherId: players[0]?.id ?? '', bullpen: [],
  };
}

describe('DynastyBridge', () => {
  it('initializes ECS world from team rosters', () => {
    const bridge = DynastyBridge.create('classic');

    const players = [makePlayer('p1'), makePlayer('p2'), makePlayer('p3')];
    const teams = [makeTeam('t1', players)];

    bridge.initializeFromTeams(teams, 'gm-user');

    // All players should have ECS entities
    expect(bridge.factory.getEntityId('p1')).toBeDefined();
    expect(bridge.factory.getEntityId('p2')).toBeDefined();
    expect(bridge.factory.getEntityId('p3')).toBeDefined();
  });

  it('provides access to all bridge systems', () => {
    const bridge = DynastyBridge.create('classic');
    expect(bridge.coreSim).toBeDefined();
    expect(bridge.contracts).toBeDefined();
    expect(bridge.trades).toBeDefined();
    expect(bridge.season).toBeDefined();
  });

  it('computes team chemistry for a team', () => {
    const bridge = DynastyBridge.create('classic');

    const players = [makePlayer('p1'), makePlayer('p2')];
    const teams = [makeTeam('t1', players)];
    bridge.initializeFromTeams(teams, 'gm-user');

    // Chemistry should return a number (default 0 with no relationships)
    const chemistry = bridge.getTeamChemistry('t1', teams[0]);
    expect(typeof chemistry).toBe('number');
    expect(chemistry).toBeGreaterThanOrEqual(-10);
    expect(chemistry).toBeLessThanOrEqual(10);
  });

  it('ticks the system runner', () => {
    const bridge = DynastyBridge.create('classic');
    // Should not throw
    expect(() => bridge.tick(1)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/dynasty/bridge/DynastyBridge.test.ts
```

- [ ] **Step 3: Implement DynastyBridge**

Create `src/dynasty/bridge/DynastyBridge.ts`:

```typescript
import type { DynastyMode } from '../ecs/types.ts';
import type { Team } from '@/engine/types/team.ts';
import { EventBus } from '../ecs/EventBus.ts';
import { EntityManager } from '../ecs/EntityManager.ts';
import { SystemRunner } from '../ecs/SystemRunner.ts';
import { EntityFactory } from './EntityFactory.ts';
import { PersonalitySystem } from '../systems/PersonalitySystem.ts';
import { RelationshipSystem } from '../systems/RelationshipSystem.ts';
import { ReputationSystem } from '../systems/ReputationSystem.ts';
import { CoreSimBridge } from '../systems/CoreSimBridge.ts';
import { ContractBridge } from '../systems/ContractBridge.ts';
import { TradeBridge } from '../systems/TradeBridge.ts';
import { SeasonBridge } from '../systems/SeasonBridge.ts';

/**
 * Singleton connecting the ECS world to the game.
 * Created once per dynasty, provides access to all bridge systems.
 */
export class DynastyBridge {
  readonly bus: EventBus;
  readonly entities: EntityManager;
  readonly runner: SystemRunner;
  readonly factory: EntityFactory;

  // Bridge systems (called by franchise store to emit events)
  readonly coreSim: CoreSimBridge;
  readonly contracts: ContractBridge;
  readonly trades: TradeBridge;
  readonly season: SeasonBridge;

  // Core systems (react to events)
  private relationshipSystem: RelationshipSystem;

  private constructor(mode: DynastyMode) {
    this.bus = new EventBus();
    this.entities = new EntityManager();
    this.runner = new SystemRunner(this.bus, this.entities, mode);
    this.factory = new EntityFactory(this.entities);

    // Core reactive systems (from Plan 1)
    const personalitySystem = new PersonalitySystem(this.entities, this.bus);
    this.relationshipSystem = new RelationshipSystem(this.entities, this.bus);
    const reputationSystem = new ReputationSystem(this.entities, this.bus);

    // Bridge systems
    this.coreSim = new CoreSimBridge(this.entities, this.bus);
    this.contracts = new ContractBridge(this.entities, this.bus);
    this.trades = new TradeBridge(this.entities, this.bus, this.factory);
    this.season = new SeasonBridge(this.entities, this.bus);

    // Register all systems with the runner
    this.runner.addSystem(personalitySystem);
    this.runner.addSystem(this.relationshipSystem);
    this.runner.addSystem(reputationSystem);
    this.runner.addSystem(this.coreSim);
    this.runner.addSystem(this.contracts);
    this.runner.addSystem(this.trades);
    this.runner.addSystem(this.season);
  }

  static create(mode: DynastyMode): DynastyBridge {
    return new DynastyBridge(mode);
  }

  /** Initialize ECS entities from existing team rosters. */
  initializeFromTeams(teams: Team[], gmNpcId?: string): void {
    for (const team of teams) {
      for (const player of team.roster.players) {
        this.factory.createPlayerEntity(player, team.id);
      }
    }
    if (gmNpcId) {
      this.factory.createNPCEntity(gmNpcId, 'gm');
    }
  }

  /** Get team chemistry modifier for AtBatResolver. */
  getTeamChemistry(teamId: string, team: Team): number {
    const entityIds = team.roster.players
      .map(p => this.factory.getEntityId(p.id))
      .filter((id): id is string => id !== undefined);
    return this.relationshipSystem.computeTeamChemistry(entityIds);
  }

  /** Advance all active systems by one tick. */
  tick(dt: number): void {
    this.runner.tick(dt);
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/dynasty/bridge/DynastyBridge.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Run ALL tests**

```bash
npx vitest run
```

Expected: All tests across all files PASS.

- [ ] **Step 6: Verify build**

```bash
npx tsc --project tsconfig.app.json --noEmit
```

Expected: Clean compile.

- [ ] **Step 7: Commit and push**

```bash
git add src/dynasty/bridge/DynastyBridge.ts src/dynasty/bridge/DynastyBridge.test.ts
git commit -m "feat(dynasty): implement DynastyBridge — singleton connecting ECS to game world"
git push
```

---

## Summary

After completing all 7 tasks, the following is in place:

- **EntityFactory** — Creates ECS entities from Player/Team data with bidirectional ID mapping
- **CoreSimBridge** — Emits `GameCompleted` events after games
- **ContractBridge** — Emits `ContractSigned`, `PlayerReleased`, `PlayerRetired` events
- **TradeBridge** — Emits `PlayerTraded` events, triggers personality + relationship reactions
- **SeasonBridge** — Emits `SeasonPhaseChanged`, `PlayerInjured`, `AwardWon` events
- **Chemistry → AtBatResolver** — `clutchModifier` parameter injected into at-bat resolution
- **DynastyBridge** — Singleton connecting all systems, initialized from team rosters

The franchise store can now call `dynastyBridge.coreSim.recordGameCompleted(...)` after any game, `dynastyBridge.trades.recordTrade(...)` after any trade, etc. — and all Plan 1 systems (Personality, Relationships, Reputation) will automatically react via the EventBus.

**Next plan (Plan 3: Conversation System)** will build the template engine and conversation library that consumes these events to trigger AI conversations.

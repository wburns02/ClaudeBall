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

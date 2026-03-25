import type { System, DynastyMode, DynastyEvent } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { EventBus } from '../ecs/EventBus.ts';
import type { PersonalFinancesComponent } from '../components/PersonalFinances.ts';
import { processAnnualFinances } from '../components/PersonalFinances.ts';

/**
 * Manages personal finances for the player avatar (Living Dynasty only).
 * Processes annual income/expenses, investment returns, bankruptcy detection.
 */
export class PersonalFinanceSystem implements System {
  readonly name = 'PersonalFinanceSystem';
  readonly modes: DynastyMode[] = ['living']; // Living dynasty only

  private entities: EntityManager;
  private bus: EventBus;

  constructor(entities: EntityManager, bus: EventBus) {
    this.entities = entities;
    this.bus = bus;
  }

  tick(_dt: number): void {
    // Finances are processed on season transitions, not every tick
  }

  handleEvent(event: DynastyEvent): void {
    if (event.type === 'SeasonPhaseChanged' && (event.data?.to as string) === 'offseason') {
      this.processAnnualFinancesForAll();
    }
    if (event.type === 'ContractSigned') {
      this.updateSalary(event);
    }
  }

  private processAnnualFinancesForAll(): void {
    const entities = this.entities.getEntitiesWith('PersonalFinances');
    for (const entityId of entities) {
      const pf = this.entities.getComponent<PersonalFinancesComponent>(entityId, 'PersonalFinances');
      if (!pf) continue;

      const result = processAnnualFinances(pf);

      if (result.isBankrupt) {
        this.bus.emit({
          type: 'FinancialEvent',
          timestamp: Date.now(),
          data: { entityId, category: 'bankruptcy', amount: pf.bankAccount, description: 'Player is bankrupt' },
        });
      }
    }
  }

  private updateSalary(event: DynastyEvent): void {
    // When the player avatar signs a contract, update their salary
    // The avatar entity needs to be identified — deferred to Career system integration
  }
}

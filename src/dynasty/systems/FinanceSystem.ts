import type { System, DynastyMode, DynastyEvent, EntityId } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { EventBus } from '../ecs/EventBus.ts';
import type { TeamFinancesComponent } from '../components/TeamFinances.ts';

/**
 * Manages team-level finances: payroll tracking, luxury tax, revenue.
 * Active in both Classic and Living dynasty modes.
 */
export class FinanceSystem implements System {
  readonly name = 'FinanceSystem';
  readonly modes: DynastyMode[] = ['classic', 'living'];

  private entities: EntityManager;
  private bus: EventBus;

  constructor(entities: EntityManager, bus: EventBus) {
    this.entities = entities;
    this.bus = bus;
  }

  tick(_dt: number): void {
    // Finance updates happen on specific events, not every tick
  }

  handleEvent(event: DynastyEvent): void {
    switch (event.type) {
      case 'ContractSigned':
        this.onContractSigned(event);
        break;
      case 'PlayerReleased':
        this.onPlayerReleased(event);
        break;
      case 'SeasonPhaseChanged':
        if ((event.data?.to as string) === 'offseason') {
          this.processEndOfSeason();
        }
        break;
    }
  }

  private onContractSigned(event: DynastyEvent): void {
    const salary = event.data?.salary as number ?? 0;
    const teamEntityId = this.findTeamEntity(event.data?.teamId as string);
    if (!teamEntityId) return;

    const finances = this.entities.getComponent<TeamFinancesComponent>(teamEntityId, 'TeamFinances');
    if (finances) {
      finances.payroll += salary;
      this.checkLuxuryTax(finances);
    }
  }

  private onPlayerReleased(event: DynastyEvent): void {
    // Payroll reduction would require knowing the player's salary
    // Deferred to when contract bridge provides salary info
  }

  private processEndOfSeason(): void {
    const teamEntities = this.entities.getEntitiesWith('TeamFinances');
    for (const entityId of teamEntities) {
      const finances = this.entities.getComponent<TeamFinancesComponent>(entityId, 'TeamFinances');
      if (!finances) continue;
      this.checkLuxuryTax(finances);
    }
  }

  private checkLuxuryTax(finances: TeamFinancesComponent): void {
    if (finances.payroll > finances.luxuryTaxThreshold) {
      const overage = finances.payroll - finances.luxuryTaxThreshold;
      finances.luxuryTaxPaid = Math.round(overage * 0.20); // 20% tax rate
    } else {
      finances.luxuryTaxPaid = 0;
    }
  }

  private findTeamEntity(teamId: string): EntityId | undefined {
    // Teams are stored as entities with TeamFinances components
    // In a full implementation, we'd have a team→entity mapping
    // For now, search all entities with TeamFinances
    const candidates = this.entities.getEntitiesWith('TeamFinances');
    return candidates[0]; // Simplified — proper mapping in Plan 8
  }
}

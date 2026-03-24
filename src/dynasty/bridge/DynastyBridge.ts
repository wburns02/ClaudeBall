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

export class DynastyBridge {
  readonly bus: EventBus;
  readonly entities: EntityManager;
  readonly runner: SystemRunner;
  readonly factory: EntityFactory;

  readonly coreSim: CoreSimBridge;
  readonly contracts: ContractBridge;
  readonly trades: TradeBridge;
  readonly season: SeasonBridge;

  private relationshipSystem: RelationshipSystem;

  private constructor(mode: DynastyMode) {
    this.bus = new EventBus();
    this.entities = new EntityManager();
    this.runner = new SystemRunner(this.bus, this.entities, mode);
    this.factory = new EntityFactory(this.entities);

    const personalitySystem = new PersonalitySystem(this.entities, this.bus);
    this.relationshipSystem = new RelationshipSystem(this.entities, this.bus);
    const reputationSystem = new ReputationSystem(this.entities, this.bus);

    this.coreSim = new CoreSimBridge(this.entities, this.bus);
    this.contracts = new ContractBridge(this.entities, this.bus);
    this.trades = new TradeBridge(this.entities, this.bus, this.factory);
    this.season = new SeasonBridge(this.entities, this.bus);

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

  getTeamChemistry(teamId: string, team: Team): number {
    const entityIds = team.roster.players
      .map(p => this.factory.getEntityId(p.id))
      .filter((id): id is string => id !== undefined);
    return this.relationshipSystem.computeTeamChemistry(entityIds);
  }

  tick(dt: number): void {
    this.runner.tick(dt);
  }
}

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
import { ConversationSystem } from '../conversations/ConversationSystem.ts';
import { ConversationLibrary } from '../conversations/ConversationLibrary.ts';

export class DynastyBridge {
  readonly bus: EventBus;
  readonly entities: EntityManager;
  readonly runner: SystemRunner;
  readonly factory: EntityFactory;

  readonly coreSim: CoreSimBridge;
  readonly contracts: ContractBridge;
  readonly trades: TradeBridge;
  readonly season: SeasonBridge;
  readonly conversations: ConversationSystem;
  readonly conversationLibrary: ConversationLibrary;

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
    this.conversationLibrary = new ConversationLibrary();
    this.conversations = new ConversationSystem(this.entities, this.bus, this.conversationLibrary);

    this.runner.addSystem(personalitySystem);
    this.runner.addSystem(this.relationshipSystem);
    this.runner.addSystem(reputationSystem);
    this.runner.addSystem(this.coreSim);
    this.runner.addSystem(this.contracts);
    this.runner.addSystem(this.trades);
    this.runner.addSystem(this.season);
    this.runner.addSystem(this.conversations);
  }

  /** Load conversation templates from JSON files (call after create) */
  async loadConversationTemplates(): Promise<void> {
    const categories = ['contracts', 'owner', 'media', 'trades', 'players', 'agents', 'awards'];
    for (const cat of categories) {
      try {
        const response = await fetch(`/conversations/${cat}.json`);
        if (response.ok) {
          const templates = await response.json();
          this.conversationLibrary.loadTemplates(templates);
        }
      } catch {
        // Non-critical — library works without templates (empty)
      }
    }
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

import type { System, DynastyMode, DynastyEvent, EntityId, ScandalOccurredEvent } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { EventBus } from '../ecs/EventBus.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { ReputationComponent } from '../components/Reputation.ts';
import { adjustReputation } from '../components/Reputation.ts';

export type ScandalTier = 'minor' | 'moderate' | 'severe' | 'nuclear';

export interface ActiveScandal {
  entityId: EntityId;
  tier: ScandalTier;
  type: string;
  description: string;
  suspension: number;     // games remaining
  season: number;
  resolved: boolean;
  coveredUp: boolean;
}

export interface NuclearChainState {
  entityId: EntityId;
  step: number;  // 0-4 (5 steps total)
  active: boolean;
}

const MINOR_SCANDALS = [
  { type: 'bar_fight', desc: 'got into a bar fight', suspension: 5 },
  { type: 'twitter_rant', desc: 'went on a viral Twitter rant', suspension: 0 },
  { type: 'skipped_practice', desc: 'skipped mandatory practice', suspension: 3 },
  { type: 'nightclub', desc: 'was photographed at a nightclub at 3 AM', suspension: 0 },
  { type: 'parking_lot_incident', desc: 'had a heated confrontation in the parking lot', suspension: 5 },
];

const MODERATE_SCANDALS = [
  { type: 'dui', desc: 'was arrested for DUI', suspension: 30 },
  { type: 'substance_abuse', desc: 'tested positive for a banned substance (recreational)', suspension: 40 },
  { type: 'on_field_brawl', desc: 'started a bench-clearing brawl', suspension: 20 },
  { type: 'caught_on_camera', desc: 'was caught on camera in a compromising situation', suspension: 15 },
  { type: 'property_damage', desc: 'was charged with property destruction', suspension: 25 },
];

const SEVERE_SCANDALS = [
  { type: 'gambling', desc: 'was caught gambling on baseball games', suspension: 162 },
  { type: 'ped_positive', desc: 'tested positive for performance-enhancing drugs', suspension: 80 },
  { type: 'domestic_violence', desc: 'faces domestic violence charges', suspension: 60 },
  { type: 'fraud', desc: 'is under investigation for financial fraud', suspension: 100 },
  { type: 'assault', desc: 'was charged with aggravated assault', suspension: 120 },
];

/**
 * ScandalSystem — generates and manages scandals based on Wildcard trait.
 * Nuclear scandals require a chain of deliberate bad decisions.
 */
export class ScandalSystem implements System {
  readonly name = 'ScandalSystem';
  readonly modes: DynastyMode[] = ['classic', 'living'];

  private entities: EntityManager;
  private bus: EventBus;
  private activeScandals: ActiveScandal[] = [];
  private nuclearChains: Map<EntityId, NuclearChainState> = new Map();
  private rng: () => number;

  constructor(entities: EntityManager, bus: EventBus, rng?: () => number) {
    this.entities = entities;
    this.bus = bus;
    this.rng = rng ?? Math.random;
  }

  tick(_dt: number): void {}

  handleEvent(event: DynastyEvent): void {
    if (event.type === 'SeasonPhaseChanged') {
      const to = event.data?.to as string;
      if (to === 'offseason' || to === 'regular_season') {
        this.checkForScandals();
      }
    }
  }

  /** Check all entities with Wildcard > 50 for scandal generation */
  checkForScandals(): void {
    const entityIds = this.entities.getEntitiesWith('Personality');

    for (const entityId of entityIds) {
      const personality = this.entities.getComponent<PersonalityComponent>(entityId, 'Personality');
      if (!personality || personality.wildcard <= 50) continue;

      // Probability: (wildcard - 50) / 200
      const prob = (personality.wildcard - 50) / 200;
      if (this.rng() > prob) continue;

      // Determine tier based on wildcard level
      const tier = this.determineTier(personality.wildcard);

      // Nuclear tier NEVER generates randomly — only via chain
      if (tier === 'nuclear') continue;

      this.generateScandal(entityId, tier);
    }
  }

  private determineTier(wildcard: number): ScandalTier {
    if (wildcard >= 75) return this.rng() < 0.3 ? 'severe' : 'moderate';
    if (wildcard >= 65) return this.rng() < 0.2 ? 'severe' : 'moderate';
    if (wildcard >= 55) return this.rng() < 0.3 ? 'moderate' : 'minor';
    return 'minor';
  }

  /** Generate a scandal for an entity */
  generateScandal(entityId: EntityId, tier: ScandalTier): ActiveScandal {
    const pool = tier === 'minor' ? MINOR_SCANDALS
      : tier === 'moderate' ? MODERATE_SCANDALS
      : SEVERE_SCANDALS;

    const template = pool[Math.floor(this.rng() * pool.length)];

    const scandal: ActiveScandal = {
      entityId,
      tier,
      type: template.type,
      description: template.desc,
      suspension: template.suspension,
      season: 0,
      resolved: false,
      coveredUp: false,
    };

    this.activeScandals.push(scandal);

    // Apply reputation damage
    const rep = this.entities.getComponent<ReputationComponent>(entityId, 'Reputation');
    if (rep) {
      const repDamage = tier === 'minor' ? -5 : tier === 'moderate' ? -15 : -30;
      adjustReputation(rep, 'clubhouse', repDamage);
      adjustReputation(rep, 'media', repDamage * 1.5);
      adjustReputation(rep, 'fan', repDamage);
    }

    // Emit event
    const event: ScandalOccurredEvent = {
      type: 'ScandalOccurred',
      timestamp: Date.now(),
      data: { entityId, tier, scandalType: template.type, description: template.desc, suspension: template.suspension },
    };
    this.bus.emit(event);

    return scandal;
  }

  /** Initiate nuclear chain for an entity (only if Integrity < 35 AND Wildcard > 65) */
  canStartNuclearChain(entityId: EntityId): boolean {
    const p = this.entities.getComponent<PersonalityComponent>(entityId, 'Personality');
    if (!p) return false;
    return p.integrity < 35 && p.wildcard > 65 && !this.nuclearChains.has(entityId);
  }

  startNuclearChain(entityId: EntityId): NuclearChainState | null {
    if (!this.canStartNuclearChain(entityId)) return null;
    const state: NuclearChainState = { entityId, step: 0, active: true };
    this.nuclearChains.set(entityId, state);
    return state;
  }

  /** Advance the nuclear chain — choice: true = proceed, false = walk away */
  advanceNuclearChain(entityId: EntityId, proceed: boolean): { chainBroken: boolean; step: number } {
    const chain = this.nuclearChains.get(entityId);
    if (!chain || !chain.active) return { chainBroken: true, step: -1 };

    if (!proceed) {
      // Chain broken — integrity boost
      chain.active = false;
      const p = this.entities.getComponent<PersonalityComponent>(entityId, 'Personality');
      if (p) {
        const integrityBoost = chain.step >= 3 ? 5 : chain.step >= 1 ? 3 : 2;
        p.integrity = Math.min(80, p.integrity + integrityBoost);
        p.wildcard = Math.max(20, p.wildcard - 5);
      }
      this.nuclearChains.delete(entityId);
      return { chainBroken: true, step: chain.step };
    }

    chain.step++;

    // Step 5 = point of no return
    if (chain.step >= 4) {
      chain.active = false;
      this.triggerNuclearFallout(entityId);
      return { chainBroken: false, step: 4 };
    }

    return { chainBroken: false, step: chain.step };
  }

  /** Nuclear fallout — lifetime ban, prestige reset, all relationships destroyed */
  private triggerNuclearFallout(entityId: EntityId): void {
    // Destroy reputation
    const rep = this.entities.getComponent<ReputationComponent>(entityId, 'Reputation');
    if (rep) {
      adjustReputation(rep, 'clubhouse', -200); // Clamps to -100
      adjustReputation(rep, 'media', -200);
      adjustReputation(rep, 'fan', -200);
    }

    // Emit nuclear scandal
    this.bus.emit({
      type: 'ScandalOccurred',
      timestamp: Date.now(),
      data: {
        entityId,
        tier: 'nuclear',
        scandalType: 'the_list',
        description: 'has been implicated in a devastating scandal. Lifetime ban from baseball.',
        suspension: 99999,
      },
    } as ScandalOccurredEvent);

    this.nuclearChains.delete(entityId);
  }

  /** Attempt to cover up a moderate scandal (only if Integrity < 40) */
  attemptCoverUp(entityId: EntityId, scandalIndex: number): { success: boolean } {
    const p = this.entities.getComponent<PersonalityComponent>(entityId, 'Personality');
    if (!p || p.integrity >= 40) return { success: false };

    const scandal = this.activeScandals[scandalIndex];
    if (!scandal || scandal.tier !== 'moderate') return { success: false };

    // 60% success, 40% leak
    if (this.rng() < 0.6) {
      scandal.resolved = true;
      scandal.coveredUp = true;
      return { success: true };
    }

    // Leak — double punishment
    const rep = this.entities.getComponent<ReputationComponent>(entityId, 'Reputation');
    if (rep) {
      adjustReputation(rep, 'media', -25);
      adjustReputation(rep, 'fan', -15);
      adjustReputation(rep, 'clubhouse', -10);
    }
    return { success: false };
  }

  /** Apply culture investment — reduces Wildcard across all entities on a team */
  investInCulture(teamEntityIds: EntityId[], budget: number): number {
    let reduced = 0;
    const reductionPerPlayer = Math.min(8, Math.round(budget / 100)); // $100K per point of reduction

    for (const id of teamEntityIds) {
      const p = this.entities.getComponent<PersonalityComponent>(id, 'Personality');
      if (p && p.wildcard > 30) {
        const reduction = Math.min(reductionPerPlayer, p.wildcard - 20);
        p.wildcard -= reduction;
        reduced += reduction;
      }
    }
    return reduced;
  }

  /** Get all active (unresolved) scandals */
  getActiveScandals(): ActiveScandal[] {
    return this.activeScandals.filter(s => !s.resolved);
  }

  /** Get all scandals for an entity */
  getEntityScandals(entityId: EntityId): ActiveScandal[] {
    return this.activeScandals.filter(s => s.entityId === entityId);
  }

  /** Get nuclear chain state for an entity */
  getNuclearChain(entityId: EntityId): NuclearChainState | undefined {
    return this.nuclearChains.get(entityId);
  }
}

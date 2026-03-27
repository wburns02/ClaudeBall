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

export interface ChainReward {
  description: string;
  financialGain: number;   // thousands added to bank account
  relationshipGain?: string; // entity description of new connection
  specialAccess?: string;    // unique opportunity unlocked
}

export interface NuclearChainState {
  entityId: EntityId;
  step: number;  // 0-4 (5 steps total)
  active: boolean;
  rewardsCollected: ChainReward[];
}

// ── Randomized reward pools per chain step ──
// Each step picks randomly so no two chains feel the same

const STEP_1_REWARDS: ChainReward[] = [
  { description: 'Met a tech billionaire who wants to invest in your brand', financialGain: 500, relationshipGain: 'Tech billionaire investor' },
  { description: 'Landed a private endorsement deal with a luxury watch company', financialGain: 750, specialAccess: 'VIP endorsement network' },
  { description: 'Connected with a team owner who hinted at selling within 2 years', financialGain: 200, relationshipGain: 'Aging team owner (potential seller)' },
  { description: 'Got invited to an exclusive real estate syndicate — guaranteed 20% returns', financialGain: 400, specialAccess: 'Private real estate deals' },
  { description: 'A Hollywood producer wants to make a documentary about your career', financialGain: 600, specialAccess: 'Media production deal' },
  { description: 'Met a senator who "takes care of his friends" in the sports world', financialGain: 0, relationshipGain: 'Political connection (senator)' },
];

const STEP_2_REWARDS: ChainReward[] = [
  { description: 'Offered a stake in a Caribbean resort development — projected 3x return', financialGain: 2000, specialAccess: 'Offshore investment portfolio' },
  { description: 'Your new contact fast-tracked your application for a casino license', financialGain: 1500, specialAccess: 'Casino ownership opportunity' },
  { description: 'Got early access to a tech IPO — your shares doubled overnight', financialGain: 3000 },
  { description: 'Introduced to a "fixer" who can make any legal problem disappear', financialGain: 0, specialAccess: 'Legal immunity contact', relationshipGain: 'The Fixer' },
  { description: 'Private equity fund offered you a limited partner slot — minimum buy-in waived', financialGain: 2500, specialAccess: 'PE fund access' },
  { description: 'A foreign government wants you as a "sports ambassador" — all expenses paid', financialGain: 1000, relationshipGain: 'Foreign government liaison' },
];

const STEP_3_REWARDS: ChainReward[] = [
  { description: '$5M "consulting fee" deposited into an offshore account. No paperwork.', financialGain: 5000 },
  { description: 'Guaranteed first-right-of-refusal on the next team sale. In writing.', financialGain: 0, specialAccess: 'Team purchase guarantee' },
  { description: 'A construction magnate offers to build you a stadium — at cost. $200M savings.', financialGain: 3000, specialAccess: 'Stadium deal at cost' },
  { description: 'Your "friends" will make sure the league expansion committee picks your city', financialGain: 0, specialAccess: 'Expansion team guarantee' },
  { description: 'Wire transfer of $4M for "advisory services" you never performed', financialGain: 4000 },
  { description: 'Access to a private intelligence network — know every trade before it happens', financialGain: 2000, specialAccess: 'League insider information' },
];

const STEP_4_REWARDS: ChainReward[] = [
  { description: '$10M wired to your account. No questions asked. Ever.', financialGain: 10000 },
  { description: 'Deed to a $15M mansion in the Cayman Islands. "A gift between friends."', financialGain: 15000, specialAccess: 'Offshore property' },
  { description: 'Controlling interest in a media company — you own the narrative now', financialGain: 8000, specialAccess: 'Media empire' },
  { description: '$12M in untraceable cryptocurrency. "For your loyalty."', financialGain: 12000 },
  { description: 'Political favors that guarantee your stadium deal gets approved. Plus $7M cash.', financialGain: 7000, specialAccess: 'Political protection' },
  { description: 'A Swiss bank account with $20M. The password is hand-delivered.', financialGain: 20000 },
];

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
    const state: NuclearChainState = { entityId, step: 0, active: true, rewardsCollected: [] };
    this.nuclearChains.set(entityId, state);
    return state;
  }

  /** Get the reward for the current chain step (shown to player before they decide) */
  getChainStepReward(entityId: EntityId): ChainReward | null {
    const chain = this.nuclearChains.get(entityId);
    if (!chain || !chain.active) return null;

    const pools = [STEP_1_REWARDS, STEP_2_REWARDS, STEP_3_REWARDS, STEP_4_REWARDS];
    const pool = pools[chain.step];
    if (!pool) return null;

    return pool[Math.floor(this.rng() * pool.length)];
  }

  /** Advance the nuclear chain — choice: true = proceed (collect reward), false = walk away */
  advanceNuclearChain(entityId: EntityId, proceed: boolean): { chainBroken: boolean; step: number; reward?: ChainReward } {
    const chain = this.nuclearChains.get(entityId);
    if (!chain || !chain.active) return { chainBroken: true, step: -1 };

    if (!proceed) {
      // Chain broken — integrity boost, keep rewards already collected
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

    // Collect reward for this step
    const pools = [STEP_1_REWARDS, STEP_2_REWARDS, STEP_3_REWARDS, STEP_4_REWARDS];
    const pool = pools[chain.step];
    const reward = pool ? pool[Math.floor(this.rng() * pool.length)] : undefined;

    if (reward) {
      chain.rewardsCollected.push(reward);
      // Apply financial gain to entity
      const pf = this.entities.getComponent<import('../components/PersonalFinances.ts').PersonalFinancesComponent>(entityId, 'PersonalFinances');
      if (pf) {
        pf.bankAccount += reward.financialGain;
        pf.netWorth += reward.financialGain;
      }
    }

    chain.step++;

    // Step 5 = point of no return — all rewards get seized in the fallout
    if (chain.step >= 4) {
      chain.active = false;
      this.triggerNuclearFallout(entityId);
      return { chainBroken: false, step: 4, reward };
    }

    return { chainBroken: false, step: chain.step, reward };
  }

  /** Nuclear fallout — lifetime ban, prestige reset, all relationships destroyed, assets seized */
  private triggerNuclearFallout(entityId: EntityId): void {
    // Destroy reputation
    const rep = this.entities.getComponent<ReputationComponent>(entityId, 'Reputation');
    if (rep) {
      adjustReputation(rep, 'clubhouse', -200); // Clamps to -100
      adjustReputation(rep, 'media', -200);
      adjustReputation(rep, 'fan', -200);
    }

    // Seize ill-gotten gains — claw back chain rewards
    const chain = this.nuclearChains.get(entityId);
    const pf = this.entities.getComponent<import('../components/PersonalFinances.ts').PersonalFinancesComponent>(entityId, 'PersonalFinances');
    if (pf && chain) {
      const seized = chain.rewardsCollected.reduce((sum, r) => sum + r.financialGain, 0);
      pf.bankAccount -= seized;
      pf.netWorth -= seized;
      // Additional legal fees + fines
      pf.bankAccount -= 5000; // $5M in legal fees
      pf.netWorth -= 5000;
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

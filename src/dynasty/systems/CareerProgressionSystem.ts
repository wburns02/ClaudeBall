import type { System, DynastyMode, DynastyEvent, EntityId } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { EventBus } from '../ecs/EventBus.ts';
import type { CareerComponent, CareerRole } from '../components/Career.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { PersonalFinancesComponent } from '../components/PersonalFinances.ts';

export interface CareerOpportunity {
  role: CareerRole;
  teamId: string;
  teamName: string;
  description: string;
  requirements: string[];
  skipLevels: number;  // how many levels this skips (0 = natural next step)
}

/** Standard career ladder ordering */
const CAREER_LADDER: CareerRole[] = [
  'player', 'scout', 'coach', 'manager', 'assistant_gm', 'gm', 'president', 'owner',
];

function getRoleIndex(role: CareerRole): number {
  return CAREER_LADDER.indexOf(role);
}

/**
 * Manages career progression in Living Dynasty mode.
 * Generates opportunities based on personality, achievements, and relationships.
 */
export class CareerProgressionSystem implements System {
  readonly name = 'CareerProgressionSystem';
  readonly modes: DynastyMode[] = ['living']; // Living dynasty only

  private entities: EntityManager;
  private bus: EventBus;
  private pendingOpportunities: Map<EntityId, CareerOpportunity[]> = new Map();

  constructor(entities: EntityManager, bus: EventBus) {
    this.entities = entities;
    this.bus = bus;
  }

  tick(_dt: number): void {}

  handleEvent(event: DynastyEvent): void {
    if (event.type === 'PlayerRetired') {
      this.generatePostRetirementOpportunities(event.data?.playerId as string);
    }
  }

  /** Generate career opportunities for a retired player based on their traits */
  generatePostRetirementOpportunities(entityId: string): void {
    const career = this.entities.getComponent<CareerComponent>(entityId, 'Career');
    const personality = this.entities.getComponent<PersonalityComponent>(entityId, 'Personality');
    const finances = this.entities.getComponent<PersonalFinancesComponent>(entityId, 'PersonalFinances');
    if (!career || !personality) return;

    const opportunities: CareerOpportunity[] = [];

    // Scout path — needs Baseball IQ
    if (personality.baseballIQ >= 55) {
      opportunities.push({
        role: 'scout', teamId: career.currentTeamId, teamName: 'Your Organization',
        description: 'Join the scouting department and evaluate talent across the country.',
        requirements: ['Baseball IQ 55+'],
        skipLevels: 0,
      });
    }

    // Coaching path — needs Leadership
    if (personality.leadership >= 55) {
      opportunities.push({
        role: 'coach', teamId: career.currentTeamId, teamName: 'Your Organization',
        description: 'Work with players directly as a hitting/pitching/bench coach.',
        requirements: ['Leadership 55+'],
        skipLevels: 0,
      });
    }

    // Fast track to GM — needs high Baseball IQ + Charisma
    if (personality.baseballIQ >= 70 && personality.charisma >= 60) {
      opportunities.push({
        role: 'assistant_gm', teamId: career.currentTeamId, teamName: 'Your Organization',
        description: 'Your reputation and baseball mind earn you a front office fast track.',
        requirements: ['Baseball IQ 70+', 'Charisma 60+'],
        skipLevels: 2,
      });
    }

    // Direct to GM — legendary player with connections
    if (personality.baseballIQ >= 75 && personality.charisma >= 70 && personality.leadership >= 65) {
      opportunities.push({
        role: 'gm', teamId: '', teamName: 'Multiple Teams Interested',
        description: 'Your legendary career and leadership make you a GM candidate immediately.',
        requirements: ['Baseball IQ 75+', 'Charisma 70+', 'Leadership 65+'],
        skipLevels: 4,
      });
    }

    // Broadcasting — needs Charisma
    if (personality.charisma >= 60) {
      opportunities.push({
        role: 'broadcaster', teamId: '', teamName: 'Network',
        description: 'Your charisma and insights make you a natural for the broadcast booth.',
        requirements: ['Charisma 60+'],
        skipLevels: 0,
      });
    }

    // Owner path — needs massive wealth
    if (finances && finances.netWorth >= 500000) { // $500M+
      opportunities.push({
        role: 'owner', teamId: '', teamName: 'Expansion/Purchase Opportunity',
        description: 'Your wealth opens the door to team ownership.',
        requirements: ['Net worth $500M+'],
        skipLevels: 6,
      });
    }

    this.pendingOpportunities.set(entityId, opportunities);
  }

  /** Get pending career opportunities for an entity */
  getOpportunities(entityId: EntityId): CareerOpportunity[] {
    return this.pendingOpportunities.get(entityId) ?? [];
  }

  /** Accept a career opportunity — transitions the entity's role */
  acceptOpportunity(entityId: EntityId, opportunity: CareerOpportunity): void {
    const career = this.entities.getComponent<CareerComponent>(entityId, 'Career');
    if (!career) return;

    const oldRole = career.currentRole;
    career.history.push({
      role: oldRole,
      teamId: career.currentTeamId,
      startSeason: 0, // Would be set from PhaseRunner year
    });

    career.currentRole = opportunity.role;
    if (opportunity.teamId) career.currentTeamId = opportunity.teamId;

    this.pendingOpportunities.delete(entityId);

    this.bus.emit({
      type: 'CareerTransition',
      timestamp: Date.now(),
      data: { entityId, fromRole: oldRole, toRole: opportunity.role },
    });
  }

  /** Check if an entity can skip to a specific role based on their profile */
  canSkipTo(entityId: EntityId, targetRole: CareerRole): boolean {
    const opportunities = this.getOpportunities(entityId);
    return opportunities.some(o => o.role === targetRole);
  }
}

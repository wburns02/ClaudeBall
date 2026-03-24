import type { System, DynastyMode, DynastyEvent, EntityId } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { EventBus } from '../ecs/EventBus.ts';
import type { ConversationSituation, ConversationResult, ConversationContext } from './types.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { PersonalityArchetype } from './types.ts';
import { ConversationLibrary } from './ConversationLibrary.ts';
import { TemplateEngine } from './TemplateEngine.ts';

/** Maps personality trait values to archetype tags for template matching */
function deriveArchetypes(p: PersonalityComponent): PersonalityArchetype[] {
  const tags: PersonalityArchetype[] = [];
  if (p.ego >= 65) tags.push('high_ego');
  if (p.ego <= 35) tags.push('low_ego');
  if (p.loyalty >= 65) tags.push('high_loyalty');
  if (p.loyalty <= 35) tags.push('low_loyalty');
  if (p.charisma >= 65) tags.push('high_charisma');
  if (p.charisma <= 35) tags.push('low_charisma');
  if (p.aggression >= 65) tags.push('aggressive');
  if (p.composure >= 65) tags.push('composed');
  if (p.leadership >= 65) tags.push('leader');
  if (tags.length === 0) tags.push('any');
  return tags;
}

/** Pending conversation triggered by an event */
export interface PendingConversation {
  situation: ConversationSituation;
  npcEntityId?: EntityId;
  context: ConversationContext;
  stakes: 'routine' | 'moderate' | 'career_defining';
  triggeredBy: string; // event type that caused this
}

/**
 * ECS System that reacts to game events and queues conversations.
 * The UI polls pendingConversations to display them.
 */
export class ConversationSystem implements System {
  readonly name = 'ConversationSystem';
  readonly modes: DynastyMode[] = ['classic', 'living'];

  private entities: EntityManager;
  private bus: EventBus;
  readonly library: ConversationLibrary;
  private pending: PendingConversation[] = [];
  private completedLog: ConversationResult[] = [];

  constructor(entities: EntityManager, bus: EventBus, library: ConversationLibrary) {
    this.entities = entities;
    this.bus = bus;
    this.library = library;
  }

  tick(_dt: number): void {
    // Conversations are event-driven, not tick-driven
  }

  handleEvent(event: DynastyEvent): void {
    switch (event.type) {
      case 'PlayerTraded':
        this.onPlayerTraded(event);
        break;
      case 'AwardWon':
        this.onAwardWon(event);
        break;
      case 'ContractSigned':
        this.onContractSigned(event);
        break;
      case 'GMFired':
      case 'GMHired':
        this.onCareerEvent(event);
        break;
    }
  }

  /** Get pending conversations that haven't been presented yet */
  getPending(): PendingConversation[] {
    return [...this.pending];
  }

  /** Remove a pending conversation (after it's been displayed) */
  consumePending(): PendingConversation | undefined {
    return this.pending.shift();
  }

  /** Record a completed conversation */
  recordCompleted(result: ConversationResult): void {
    this.completedLog.push(result);
    if (result.templateId && result.npcEntityId) {
      this.library.markUsed(result.templateId, result.npcEntityId);
    }
  }

  /** Get log of completed conversations */
  getCompletedLog(): ConversationResult[] {
    return [...this.completedLog];
  }

  /**
   * Resolve a pending conversation by finding the best template and substituting variables.
   * Returns resolved dialogue nodes, or null if no template matches.
   */
  resolveConversation(pending: PendingConversation) {
    const npcPersonality = pending.npcEntityId
      ? this.entities.getComponent<PersonalityComponent>(pending.npcEntityId, 'Personality')
      : null;

    const npcArchetypes = npcPersonality ? deriveArchetypes(npcPersonality) : ['any' as const];

    const template = this.library.findBest(
      { situation: pending.situation, npcArchetypes },
      pending.npcEntityId,
    );

    if (!template) return null;

    const resolvedNodes = TemplateEngine.resolveTemplate(template, pending.context);
    return { template, nodes: resolvedNodes };
  }

  private onPlayerTraded(event: DynastyEvent): void {
    const gmEntityId = event.data?.gmEntityId as string | undefined;
    this.pending.push({
      situation: 'trade_call',
      npcEntityId: gmEntityId,
      context: {
        playerName: event.data?.playerId as string,
        teamName: event.data?.toTeamId as string,
      },
      stakes: 'moderate',
      triggeredBy: 'PlayerTraded',
    });
  }

  private onAwardWon(event: DynastyEvent): void {
    this.pending.push({
      situation: 'award_ceremony',
      context: {
        playerName: event.data?.playerId as string,
        npcName: 'Commissioner',
      },
      stakes: 'moderate',
      triggeredBy: 'AwardWon',
    });
  }

  private onContractSigned(event: DynastyEvent): void {
    this.pending.push({
      situation: 'contract_negotiation',
      context: {
        playerName: event.data?.playerId as string,
        offerAmount: `$${((event.data?.salary as number) / 1000).toFixed(0)}M`,
        offerYears: String(event.data?.years),
      },
      stakes: 'routine',
      triggeredBy: 'ContractSigned',
    });
  }

  private onCareerEvent(event: DynastyEvent): void {
    const situation: ConversationSituation = event.type === 'GMFired' ? 'fired' : 'hired';
    this.pending.push({
      situation,
      npcEntityId: event.data?.gmId as string | undefined,
      context: {},
      stakes: 'career_defining',
      triggeredBy: event.type,
    });
  }
}

import type { EntityId } from '../ecs/types.ts';

/** Situations that trigger conversations */
export type ConversationSituation =
  | 'contract_negotiation'
  | 'trade_call'
  | 'owner_meeting'
  | 'press_conference'
  | 'clubhouse_confrontation'
  | 'mentor_moment'
  | 'media_interview'
  | 'agent_checkin'
  | 'draft_war_room'
  | 'fired'
  | 'hired'
  | 'retirement'
  | 'award_ceremony'
  | 'family_dinner'
  | 'generic';

/** Personality archetype tags for template matching */
export type PersonalityArchetype =
  | 'high_ego' | 'low_ego'
  | 'high_loyalty' | 'low_loyalty'
  | 'high_charisma' | 'low_charisma'
  | 'aggressive' | 'composed'
  | 'veteran' | 'rookie'
  | 'leader' | 'loner'
  | 'any';

export type EmotionalState = 'happy' | 'frustrated' | 'desperate' | 'confident' | 'angry' | 'anxious' | 'neutral';
export type StakesLevel = 'routine' | 'moderate' | 'career_defining';

/** Effect applied when a dialogue choice is selected */
export interface DialogueEffect {
  affinity?: number;
  respect?: number;
  clubhouseRep?: number;
  mediaRep?: number;
  fanRep?: number;
}

/** Single node in a dialogue tree */
export interface DialogueNode {
  id: string;
  speaker: 'npc' | 'player';
  text: string;
  effects?: DialogueEffect;
  next?: string[];  // IDs of possible next nodes (branches)
}

/** Outcome of a completed conversation */
export interface ConversationOutcome {
  event?: string;       // Dynasty event type to emit
  affinityDelta?: number;
  description?: string;
}

/** A complete conversation template */
export interface ConversationTemplate {
  id: string;
  situation: ConversationSituation;
  archetypes: {
    npc: PersonalityArchetype[];
    player: PersonalityArchetype[];
  };
  emotionalState: EmotionalState[];
  stakes: StakesLevel;
  nodes: DialogueNode[];
  outcomes: Record<string, ConversationOutcome>;
}

/** Runtime context for variable substitution */
export interface ConversationContext {
  playerName?: string;
  npcName?: string;
  npcPlayerName?: string;
  teamName?: string;
  teamCity?: string;
  statLine?: string;
  askingPrice?: string;
  offerAmount?: string;
  offerYears?: string;
  season?: number;
  record?: string;
  [key: string]: string | number | undefined;
}

/** Result of a conversation (what the player chose + outcomes) */
export interface ConversationResult {
  templateId: string;
  situation: ConversationSituation;
  nodePathIds: string[];
  chosenOutcome?: string;
  effects: DialogueEffect;
  npcEntityId?: EntityId;
  timestamp: number;
}

/** Configuration for the conversation system */
export interface ConversationConfig {
  apiKey?: string;
  apiModel?: 'haiku' | 'sonnet';
  apiTimeoutMs?: number;
  monthlyBudgetCents?: number;
  voiceEnabled?: boolean;
}

import type {
  ConversationTemplate, ConversationContext, DialogueNode,
  ConversationSituation, PersonalityArchetype, EmotionalState,
} from './types.ts';

export interface TemplateQuery {
  situation: ConversationSituation;
  npcArchetypes: PersonalityArchetype[];
  playerArchetypes?: PersonalityArchetype[];
  emotionalState?: EmotionalState;
}

export class TemplateEngine {
  /** Replace {{variableName}} placeholders with context values. */
  static substituteVariables(text: string, ctx: ConversationContext): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = ctx[key];
      return value !== undefined ? String(value) : match;
    });
  }

  /** Resolve all nodes in a template with variable substitution. */
  static resolveTemplate(template: ConversationTemplate, ctx: ConversationContext): DialogueNode[] {
    return template.nodes.map(node => ({
      ...node,
      text: this.substituteVariables(node.text, ctx),
    }));
  }

  /**
   * Score a template against a query. Returns 0 if situation doesn't match.
   * Higher scores = better match. Used to rank templates for selection.
   */
  static scoreTemplate(template: ConversationTemplate, query: TemplateQuery): number {
    // Situation must match exactly
    if (template.situation !== query.situation) return 0;

    let score = 10; // base score for situation match

    // NPC archetype matching — +3 per match
    if (query.npcArchetypes.length > 0) {
      const npcMatches = query.npcArchetypes.filter(a =>
        template.archetypes.npc.includes(a) || template.archetypes.npc.includes('any')
      ).length;
      score += npcMatches * 3;
    }

    // Player archetype matching — +2 per match
    if (query.playerArchetypes && query.playerArchetypes.length > 0) {
      const playerMatches = query.playerArchetypes.filter(a =>
        template.archetypes.player.includes(a) || template.archetypes.player.includes('any')
      ).length;
      score += playerMatches * 2;
    }

    // Emotional state match — +5
    if (query.emotionalState && template.emotionalState.includes(query.emotionalState)) {
      score += 5;
    }

    return score;
  }

  /**
   * Select the best template from a list, avoiding recently used ones.
   * Returns null if no templates match.
   */
  static selectBest(
    templates: ConversationTemplate[],
    query: TemplateQuery,
    recentlyUsedIds: Set<string> = new Set(),
  ): ConversationTemplate | null {
    const scored = templates
      .map(t => ({ template: t, score: this.scoreTemplate(t, query) }))
      .filter(s => s.score > 0)
      .sort((a, b) => {
        // Prefer unused templates
        const aUsed = recentlyUsedIds.has(a.template.id) ? -10 : 0;
        const bUsed = recentlyUsedIds.has(b.template.id) ? -10 : 0;
        return (b.score + bUsed) - (a.score + aUsed);
      });

    return scored[0]?.template ?? null;
  }
}

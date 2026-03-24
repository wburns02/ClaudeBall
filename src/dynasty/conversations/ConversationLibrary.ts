import type { ConversationTemplate, ConversationSituation } from './types.ts';
import { TemplateEngine } from './TemplateEngine.ts';
import type { TemplateQuery } from './TemplateEngine.ts';

/**
 * Manages the pre-generated conversation template library.
 * Templates are loaded from JSON and indexed by situation for fast lookup.
 */
export class ConversationLibrary {
  private templates: ConversationTemplate[] = [];
  private bySituation = new Map<ConversationSituation, ConversationTemplate[]>();
  private recentlyUsed = new Map<string, Set<string>>(); // npcId → set of template IDs

  /** Load templates from a JSON array (e.g., fetched from public/conversations/*.json) */
  loadTemplates(templates: ConversationTemplate[]): void {
    for (const t of templates) {
      this.templates.push(t);
      const list = this.bySituation.get(t.situation) ?? [];
      list.push(t);
      this.bySituation.set(t.situation, list);
    }
  }

  /** Get total template count */
  get size(): number {
    return this.templates.length;
  }

  /** Get templates for a specific situation */
  getForSituation(situation: ConversationSituation): ConversationTemplate[] {
    return this.bySituation.get(situation) ?? [];
  }

  /**
   * Find the best matching template for a query, avoiding recently used ones for this NPC.
   * Returns null if no templates match.
   */
  findBest(query: TemplateQuery, npcId?: string): ConversationTemplate | null {
    const candidates = this.getForSituation(query.situation);
    if (candidates.length === 0) return null;

    const recentForNpc = npcId ? (this.recentlyUsed.get(npcId) ?? new Set()) : new Set<string>();
    return TemplateEngine.selectBest(candidates, query, recentForNpc);
  }

  /** Mark a template as recently used for an NPC (dedup last 5) */
  markUsed(templateId: string, npcId: string): void {
    if (!this.recentlyUsed.has(npcId)) {
      this.recentlyUsed.set(npcId, new Set());
    }
    const recent = this.recentlyUsed.get(npcId)!;
    recent.add(templateId);

    // Keep only last 5
    if (recent.size > 5) {
      const arr = [...recent];
      this.recentlyUsed.set(npcId, new Set(arr.slice(-5)));
    }
  }

  /** Clear all recently used tracking (e.g., on new season) */
  clearRecentlyUsed(): void {
    this.recentlyUsed.clear();
  }
}

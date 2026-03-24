import { describe, it, expect } from 'vitest';
import { ConversationLibrary } from './ConversationLibrary.ts';
import type { ConversationTemplate } from './types.ts';

function makeTemplate(id: string, situation: string, npcArchetypes: string[] = ['any']): ConversationTemplate {
  return {
    id,
    situation: situation as any,
    archetypes: { npc: npcArchetypes as any[], player: ['any' as any] },
    emotionalState: ['neutral'],
    stakes: 'routine' as any,
    nodes: [{ id: 'n1', speaker: 'npc', text: `Template ${id}: Hello {{playerName}}` }],
    outcomes: { done: { description: 'Conversation ended' } },
  };
}

describe('ConversationLibrary', () => {
  it('loads and indexes templates', () => {
    const lib = new ConversationLibrary();
    lib.loadTemplates([
      makeTemplate('t1', 'contract_negotiation'),
      makeTemplate('t2', 'contract_negotiation'),
      makeTemplate('t3', 'press_conference'),
    ]);

    expect(lib.size).toBe(3);
    expect(lib.getForSituation('contract_negotiation')).toHaveLength(2);
    expect(lib.getForSituation('press_conference')).toHaveLength(1);
    expect(lib.getForSituation('trade_call')).toHaveLength(0);
  });

  it('finds best template for query', () => {
    const lib = new ConversationLibrary();
    lib.loadTemplates([
      makeTemplate('t1', 'contract_negotiation', ['high_ego']),
      makeTemplate('t2', 'contract_negotiation', ['low_ego']),
    ]);

    const result = lib.findBest({
      situation: 'contract_negotiation',
      npcArchetypes: ['high_ego'],
    });

    expect(result?.id).toBe('t1');
  });

  it('avoids recently used templates for same NPC', () => {
    const lib = new ConversationLibrary();
    lib.loadTemplates([
      makeTemplate('t1', 'contract_negotiation'),
      makeTemplate('t2', 'contract_negotiation'),
    ]);

    // First query — picks t1 or t2
    const first = lib.findBest({ situation: 'contract_negotiation', npcArchetypes: ['any'] }, 'npc-1');
    expect(first).not.toBeNull();
    lib.markUsed(first!.id, 'npc-1');

    // Second query — should prefer the OTHER template
    const second = lib.findBest({ situation: 'contract_negotiation', npcArchetypes: ['any'] }, 'npc-1');
    expect(second).not.toBeNull();
    expect(second!.id).not.toBe(first!.id);
  });

  it('returns null for unmatched situation', () => {
    const lib = new ConversationLibrary();
    lib.loadTemplates([makeTemplate('t1', 'contract_negotiation')]);

    const result = lib.findBest({ situation: 'press_conference', npcArchetypes: ['any'] });
    expect(result).toBeNull();
  });

  it('clearRecentlyUsed resets dedup', () => {
    const lib = new ConversationLibrary();
    lib.loadTemplates([makeTemplate('t1', 'contract_negotiation')]);

    lib.markUsed('t1', 'npc-1');
    lib.clearRecentlyUsed();

    // t1 should be selectable again after clearing
    const result = lib.findBest({ situation: 'contract_negotiation', npcArchetypes: ['any'] }, 'npc-1');
    expect(result?.id).toBe('t1');
  });
});

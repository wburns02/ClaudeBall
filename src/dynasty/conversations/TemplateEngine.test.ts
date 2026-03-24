import { describe, it, expect } from 'vitest';
import { TemplateEngine } from './TemplateEngine.ts';
import type { ConversationTemplate, ConversationContext } from './types.ts';

const sampleTemplate: ConversationTemplate = {
  id: 'test-contract-001',
  situation: 'contract_negotiation',
  archetypes: { npc: ['high_ego', 'veteran'], player: ['any'] },
  emotionalState: ['confident', 'aggressive'],
  stakes: 'high' as any,
  nodes: [
    { id: 'open', speaker: 'npc', text: 'Look {{playerName}}, {{npcPlayerName}} put up {{statLine}} last year.', next: ['respond'] },
    { id: 'respond', speaker: 'player', text: '{{teamCity}} has budget constraints. We offer {{offerAmount}}.', effects: { affinity: -5 } },
  ],
  outcomes: {
    deal_made: { event: 'ContractSigned', affinityDelta: 10 },
    walked_away: { event: 'NegotiationFailed', affinityDelta: -15 },
  },
};

describe('TemplateEngine', () => {
  describe('substituteVariables', () => {
    it('replaces {{var}} with context values', () => {
      const ctx: ConversationContext = {
        playerName: 'Mike Trout',
        npcPlayerName: 'Marcus Webb',
        statLine: '.312/42 HR/118 RBI',
        teamCity: 'Anaheim',
        offerAmount: '$25M',
      };
      const result = TemplateEngine.substituteVariables(
        'Look {{playerName}}, {{npcPlayerName}} put up {{statLine}} last year.',
        ctx
      );
      expect(result).toBe('Look Mike Trout, Marcus Webb put up .312/42 HR/118 RBI last year.');
    });

    it('leaves unknown variables as-is', () => {
      const result = TemplateEngine.substituteVariables('Hello {{unknownVar}}!', {});
      expect(result).toBe('Hello {{unknownVar}}!');
    });

    it('handles empty context', () => {
      const result = TemplateEngine.substituteVariables('No vars here.', {});
      expect(result).toBe('No vars here.');
    });
  });

  describe('resolveTemplate', () => {
    it('returns nodes with variables substituted', () => {
      const ctx: ConversationContext = {
        playerName: 'Will',
        npcPlayerName: 'Marcus Webb',
        statLine: '.300/30/100',
        teamCity: 'Houston',
        offerAmount: '$20M',
      };
      const resolved = TemplateEngine.resolveTemplate(sampleTemplate, ctx);

      expect(resolved[0].text).toContain('Will');
      expect(resolved[0].text).toContain('Marcus Webb');
      expect(resolved[1].text).toContain('Houston');
    });
  });

  describe('scoreTemplate', () => {
    it('scores higher for matching situation', () => {
      const score = TemplateEngine.scoreTemplate(sampleTemplate, {
        situation: 'contract_negotiation',
        npcArchetypes: ['high_ego'],
        emotionalState: 'confident',
      });
      expect(score).toBeGreaterThan(0);
    });

    it('scores 0 for wrong situation', () => {
      const score = TemplateEngine.scoreTemplate(sampleTemplate, {
        situation: 'press_conference',
        npcArchetypes: ['high_ego'],
        emotionalState: 'confident',
      });
      expect(score).toBe(0);
    });

    it('scores higher for more archetype matches', () => {
      const score1 = TemplateEngine.scoreTemplate(sampleTemplate, {
        situation: 'contract_negotiation',
        npcArchetypes: ['high_ego'],
        emotionalState: 'neutral',
      });
      const score2 = TemplateEngine.scoreTemplate(sampleTemplate, {
        situation: 'contract_negotiation',
        npcArchetypes: ['high_ego', 'veteran'],
        emotionalState: 'confident',
      });
      expect(score2).toBeGreaterThan(score1);
    });
  });
});

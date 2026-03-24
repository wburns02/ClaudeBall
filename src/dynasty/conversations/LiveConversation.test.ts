import { describe, it, expect } from 'vitest';
import { LiveConversationClient } from './LiveConversation.ts';
import type { LiveConversationRequest } from './LiveConversation.ts';

const sampleRequest: LiveConversationRequest = {
  character: {
    name: 'Jim Dalton',
    role: 'owner',
    personality: { ego: 75, patience: 30, loyalty: 45 },
    emotionalState: 'frustrated',
  },
  relationship: {
    affinity: -12,
    history: ['hired you 3 years ago', 'missed playoffs twice'],
  },
  situation: {
    type: 'owner_meeting',
    context: 'Team is 58-72, 4th in division',
    agenda: 'Considering firing you',
  },
  playerPersonality: { charisma: 70, baseballIQ: 85, composure: 60 },
};

describe('LiveConversationClient', () => {
  it('returns fallback when no API key is configured', async () => {
    const client = new LiveConversationClient({ apiKey: undefined });
    const result = await client.generate(sampleRequest);

    expect(result.isFromLibrary).toBe(true);
    expect(result.costCents).toBe(0);
    expect(result.dialogue).toContain('patient');
  });

  it('returns fallback for unknown situation type', async () => {
    const client = new LiveConversationClient({ apiKey: undefined });
    const result = await client.generate({
      ...sampleRequest,
      situation: { ...sampleRequest.situation, type: 'unknown_situation' },
    });

    expect(result.isFromLibrary).toBe(true);
    expect(result.dialogue.length).toBeGreaterThan(0);
  });

  it('tracks total cost', () => {
    const client = new LiveConversationClient();
    expect(client.totalCost).toBe(0);
    expect(client.isOverBudget).toBe(false);
  });

  it('marks budget exhausted when limit reached', async () => {
    const client = new LiveConversationClient({
      apiKey: 'test-key',
      monthlyBudgetCents: 0, // $0 budget — immediately exhausted
    });

    const result = await client.generate(sampleRequest);
    expect(result.isFromLibrary).toBe(true);
    expect(client.isOverBudget).toBe(true);
  });
});

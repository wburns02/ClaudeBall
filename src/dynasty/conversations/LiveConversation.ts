import type { ConversationConfig, ConversationContext } from './types.ts';
import type { PersonalityComponent } from '../components/Personality.ts';

export interface LiveConversationRequest {
  character: {
    name: string;
    role: string;
    personality: Record<string, number>;
    emotionalState: string;
  };
  relationship: {
    affinity: number;
    history: string[];
  };
  situation: {
    type: string;
    context: string;
    agenda: string;
  };
  playerPersonality: Record<string, number>;
}

export interface LiveConversationResponse {
  dialogue: string;
  choices?: string[];
  isFromLibrary: boolean;
  costCents: number;
}

/**
 * Client for live Claude API conversations.
 * Falls back to a generic response on timeout/error.
 */
export class LiveConversationClient {
  private config: ConversationConfig;
  private totalCostCents = 0;
  private budgetExhausted = false;

  constructor(config: ConversationConfig = {}) {
    this.config = {
      apiTimeoutMs: 8000,
      apiModel: 'haiku',
      monthlyBudgetCents: 500, // $5 default
      ...config,
    };
  }

  get totalCost(): number {
    return this.totalCostCents;
  }

  get isOverBudget(): boolean {
    return this.budgetExhausted;
  }

  /**
   * Generate a live conversation via the Claude API.
   * Returns a fallback response on timeout, network failure, or budget exhaustion.
   */
  async generate(request: LiveConversationRequest): Promise<LiveConversationResponse> {
    // Budget check
    if (this.budgetExhausted || !this.config.apiKey) {
      return this.fallbackResponse(request);
    }

    const estimatedCost = this.config.apiModel === 'sonnet' ? 1 : 0.1; // cents
    if (this.totalCostCents + estimatedCost > (this.config.monthlyBudgetCents ?? 500)) {
      this.budgetExhausted = true;
      return this.fallbackResponse(request);
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.apiTimeoutMs);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.apiModel === 'sonnet' ? 'claude-sonnet-4-20250514' : 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: this.buildPrompt(request),
          }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return this.fallbackResponse(request);
      }

      const data = await response.json();
      const text = data?.content?.[0]?.text ?? '';

      if (!text) {
        return this.fallbackResponse(request);
      }

      this.totalCostCents += estimatedCost;

      return {
        dialogue: text,
        isFromLibrary: false,
        costCents: estimatedCost,
      };
    } catch {
      // Timeout, network error, or malformed response
      return this.fallbackResponse(request);
    }
  }

  private buildPrompt(request: LiveConversationRequest): string {
    return `You are ${request.character.name}, a ${request.character.role} in a baseball organization.

Your personality traits (20-80 scale): ${JSON.stringify(request.character.personality)}
Your current mood: ${request.character.emotionalState}

Your relationship with the player:
- Affinity: ${request.relationship.affinity}/100
- History: ${request.relationship.history.join('; ')}

Current situation: ${request.situation.type}
Context: ${request.situation.context}
Your agenda: ${request.situation.agenda}

The player's personality: ${JSON.stringify(request.playerPersonality)}

Write 2-4 lines of dialogue in character. Be specific to the situation and relationship history. No stage directions or narration — just what you would say.`;
  }

  private fallbackResponse(request: LiveConversationRequest): LiveConversationResponse {
    // Generic but situation-appropriate fallback
    const fallbacks: Record<string, string> = {
      owner_meeting: `"Look, I've been patient. But we need to talk about where this team is headed."`,
      contract_negotiation: `"Let's cut to the chase. My client deserves fair compensation for what he brings to this team."`,
      press_conference: `"I'll take your questions. Let's keep it focused on the game."`,
      trade_call: `"I've been thinking about a deal that could help both our clubs."`,
      fired: `"I'm sorry, but we've decided to go in a different direction."`,
      hired: `"Welcome aboard. We've got a lot of work ahead of us."`,
    };

    return {
      dialogue: fallbacks[request.situation.type] ?? `"Let's talk about what's next for the organization."`,
      isFromLibrary: true,
      costCents: 0,
    };
  }
}

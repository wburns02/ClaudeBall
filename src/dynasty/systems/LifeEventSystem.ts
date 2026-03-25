import type { System, DynastyMode, DynastyEvent, EntityId } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { EventBus } from '../ecs/EventBus.ts';
import type { PersonalityComponent } from '../components/Personality.ts';

export type LifeEventCategory =
  | 'family' | 'financial' | 'legal' | 'health'
  | 'endorsement' | 'charity' | 'education' | 'social'
  | 'drama' | 'opportunity';

export interface LifeEvent {
  id: string;
  category: LifeEventCategory;
  title: string;
  description: string;
  choices: LifeEventChoice[];
  entityId: EntityId;
  season: number;
}

export interface LifeEventChoice {
  label: string;
  effects: {
    reputationDelta?: { clubhouse?: number; media?: number; fan?: number };
    financialDelta?: number;
    personalityNudge?: Partial<Record<keyof PersonalityComponent, number>>;
    description: string;
  };
}

let nextEventId = 1;

/**
 * Generates and manages life events for the Living Dynasty RPG layer.
 * Events arrive through the inbox and present choices with consequences.
 */
export class LifeEventSystem implements System {
  readonly name = 'LifeEventSystem';
  readonly modes: DynastyMode[] = ['living']; // Living dynasty only

  private entities: EntityManager;
  private bus: EventBus;
  private pendingEvents: LifeEvent[] = [];
  private eventLog: LifeEvent[] = [];
  private rng: () => number;

  constructor(entities: EntityManager, bus: EventBus, rng?: () => number) {
    this.entities = entities;
    this.bus = bus;
    this.rng = rng ?? Math.random;
  }

  tick(_dt: number): void {
    // Life events generated on phase transitions, not ticks
  }

  handleEvent(event: DynastyEvent): void {
    if (event.type === 'SeasonPhaseChanged' && (event.data?.to as string) === 'offseason') {
      this.generateOffseasonEvents();
    }
  }

  /** Generate random life events for the offseason based on entity profiles */
  generateOffseasonEvents(): void {
    const playerEntities = this.entities.getEntitiesWith('PersonalFinances', 'Personality');

    for (const entityId of playerEntities) {
      const personality = this.entities.getComponent<PersonalityComponent>(entityId, 'Personality');
      if (!personality) continue;

      // Generate 1-3 events per offseason based on charisma (more social = more events)
      const eventCount = 1 + Math.floor(this.rng() * (personality.charisma / 40));

      for (let i = 0; i < Math.min(eventCount, 3); i++) {
        const event = this.generateRandomEvent(entityId, personality);
        if (event) this.pendingEvents.push(event);
      }
    }
  }

  private generateRandomEvent(entityId: EntityId, p: PersonalityComponent): LifeEvent | null {
    const roll = this.rng();

    // Different event pools based on personality
    if (roll < 0.15 && p.charisma >= 55) {
      return this.endorsementEvent(entityId);
    } else if (roll < 0.25 && p.integrity <= 45) {
      return this.dramaEvent(entityId);
    } else if (roll < 0.40) {
      return this.charityEvent(entityId);
    } else if (roll < 0.55) {
      return this.investmentEvent(entityId);
    } else if (roll < 0.70 && p.baseballIQ >= 55) {
      return this.educationEvent(entityId);
    } else if (roll < 0.85) {
      return this.familyEvent(entityId);
    }
    return null;
  }

  private endorsementEvent(entityId: EntityId): LifeEvent {
    return {
      id: `le_${nextEventId++}`, category: 'endorsement', entityId, season: 0,
      title: 'Endorsement Offer',
      description: 'A major brand wants you as their spokesperson.',
      choices: [
        { label: 'Accept — $500K/year', effects: { financialDelta: 500, reputationDelta: { fan: 5, media: 3 }, description: 'You signed the endorsement deal.' } },
        { label: 'Decline — focus on baseball', effects: { personalityNudge: { composure: 1 }, description: 'You kept your focus on the game.' } },
      ],
    };
  }

  private dramaEvent(entityId: EntityId): LifeEvent {
    return {
      id: `le_${nextEventId++}`, category: 'drama', entityId, season: 0,
      title: 'Nightlife Incident',
      description: 'TMZ caught you at a club at 3 AM during the offseason.',
      choices: [
        { label: 'Apologize publicly', effects: { reputationDelta: { media: -3, fan: -2 }, personalityNudge: { composure: 1 }, description: 'You owned up and moved on.' } },
        { label: 'No comment', effects: { reputationDelta: { media: -8 }, description: 'The story lingered without your side.' } },
        { label: 'Lean into it — "I had fun"', effects: { reputationDelta: { fan: 2, media: -5, clubhouse: -3 }, personalityNudge: { ego: 2 }, description: 'Fans loved the honesty. Front office didn\'t.' } },
      ],
    };
  }

  private charityEvent(entityId: EntityId): LifeEvent {
    return {
      id: `le_${nextEventId++}`, category: 'charity', entityId, season: 0,
      title: 'Charity Gala Invitation',
      description: 'The Boys & Girls Club is hosting their annual gala and wants you to headline.',
      choices: [
        { label: 'Attend and donate $50K', effects: { financialDelta: -50, reputationDelta: { fan: 8, media: 5, clubhouse: 3 }, description: 'You made a real difference in the community.' } },
        { label: 'Attend but no donation', effects: { reputationDelta: { fan: 3, media: 2 }, description: 'Your presence alone was appreciated.' } },
        { label: 'Skip it', effects: { description: 'You enjoyed a quiet evening at home.' } },
      ],
    };
  }

  private investmentEvent(entityId: EntityId): LifeEvent {
    return {
      id: `le_${nextEventId++}`, category: 'financial', entityId, season: 0,
      title: 'Investment Opportunity',
      description: 'A former teammate is opening a restaurant and wants you to invest $200K.',
      choices: [
        { label: 'Invest $200K', effects: { financialDelta: -200, description: 'You invested in the restaurant. Time will tell if it pays off.' } },
        { label: 'Politely decline', effects: { description: 'You kept your money safe.' } },
      ],
    };
  }

  private educationEvent(entityId: EntityId): LifeEvent {
    return {
      id: `le_${nextEventId++}`, category: 'education', entityId, season: 0,
      title: 'MBA Program Offer',
      description: 'A prestigious business school offered you a part-time executive MBA during the offseason.',
      choices: [
        { label: 'Enroll ($80K tuition)', effects: { financialDelta: -80, personalityNudge: { baseballIQ: 2 }, description: 'You\'re building skills for your post-playing career.' } },
        { label: 'Not this year', effects: { description: 'Maybe next offseason.' } },
      ],
    };
  }

  private familyEvent(entityId: EntityId): LifeEvent {
    return {
      id: `le_${nextEventId++}`, category: 'family', entityId, season: 0,
      title: 'Family Time',
      description: 'Your family wants to take a two-week vacation during the offseason.',
      choices: [
        { label: 'Take the vacation', effects: { personalityNudge: { composure: 1, loyalty: 1 }, description: 'Quality time with family recharged you.' } },
        { label: 'Train instead', effects: { personalityNudge: { workEthic: 1 }, reputationDelta: { clubhouse: 1 }, description: 'You showed up to optional workouts. Teammates noticed.' } },
      ],
    };
  }

  /** Get pending life events */
  getPending(): LifeEvent[] {
    return [...this.pendingEvents];
  }

  /** Consume and resolve a life event with the chosen option index */
  resolveEvent(eventId: string, choiceIndex: number): LifeEventChoice | null {
    const idx = this.pendingEvents.findIndex(e => e.id === eventId);
    if (idx === -1) return null;

    const event = this.pendingEvents[idx];
    const choice = event.choices[choiceIndex];
    if (!choice) return null;

    this.pendingEvents.splice(idx, 1);
    this.eventLog.push(event);

    return choice;
  }

  /** Get log of resolved events */
  getEventLog(): LifeEvent[] {
    return [...this.eventLog];
  }
}

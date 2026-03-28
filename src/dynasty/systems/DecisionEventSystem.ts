/**
 * Decision Event System — CK2-style popup events with branching choices.
 * The narrative engine that drives the story between Big Game Moments.
 */

import type { EntityId } from '../ecs/types.ts';
import type { CareerStage } from './CareerStageSystem.ts';

export interface DecisionChoice {
  label: string;
  description?: string;            // Tooltip or subtext
  visibleEffects: string[];        // What the player CAN see: "+Work Ethic", "-Family Time"
  hiddenEffects?: string[];        // Surprise consequences revealed later
  requirements?: {                 // Only available if met
    minAge?: number;
    maxAge?: number;
    minAttribute?: { attr: string; value: number };
    personality?: { trait: string; minValue: number };
    financial?: { minWealth: number };
  };
}

export interface DecisionEvent {
  id: string;
  stage: CareerStage;
  category: 'training' | 'social' | 'family' | 'career' | 'moral' | 'financial' | 'health' | 'rivalry' | 'politics';
  title: string;
  description: string;
  choices: DecisionChoice[];
  triggeredBy?: string;           // What caused this event (Big Game Moment ID, season event, etc.)
  recurring?: boolean;            // Can this event happen multiple times?
  weight: number;                 // Probability weight for random selection
}

// ── Event Pools by Stage ──

const LITTLE_LEAGUE_EVENTS: Omit<DecisionEvent, 'id'>[] = [
  {
    stage: 'little_league', category: 'training', weight: 10,
    title: 'After Practice',
    description: 'Practice is over. You have a few hours before dinner. What do you do?',
    choices: [
      { label: 'Extra wiffle ball reps in the backyard', visibleEffects: ['+1 Contact', '+1 Work Ethic'], hiddenEffects: ['-1 Social (not hanging with friends)'] },
      { label: 'Play video games', visibleEffects: ['+0.5 Eye (hand-eye coordination)', '-1 Work Ethic'] },
      { label: 'Hang out with friends', visibleEffects: ['+1 Charisma', '+1 Clubhouse Rep'] },
      { label: 'Study / do homework', visibleEffects: ['+1 Baseball IQ', '+1 Education'] },
    ],
    recurring: true,
  },
  {
    stage: 'little_league', category: 'social', weight: 6,
    title: 'The Bully',
    description: 'A bigger kid on the other team has been talking trash all game. After the game, he shoves you in the parking lot.',
    choices: [
      { label: 'Stand up to him', visibleEffects: ['+3 Aggression', '+2 Composure', '+3 Respect'], hiddenEffects: ['Possible fight event'] },
      { label: 'Walk away', visibleEffects: ['+2 Composure', '+1 Integrity'], hiddenEffects: ['He might keep bullying you'] },
      { label: 'Tell your dad', visibleEffects: ['+1 Family Bond'], hiddenEffects: ['Dad confronts the kid\'s dad — drama'] },
    ],
  },
  {
    stage: 'little_league', category: 'family', weight: 8,
    title: 'Travel Ball Tryout',
    description: 'The best travel ball team in the area is holding tryouts. It costs $3,000 for the summer. Your family might not be able to afford it.',
    choices: [
      { label: 'Try out (family stretches budget)', visibleEffects: ['+Development opportunity', '-Family financial stress'], requirements: { financial: { minWealth: 20 } } },
      { label: 'Skip it — too expensive', visibleEffects: ['Miss development window', '+Family stability'] },
      { label: 'Ask coach for scholarship spot', visibleEffects: ['50/50 chance — depends on coach relationship'], hiddenEffects: ['Builds connection OR embarrassment'] },
    ],
  },
  {
    stage: 'little_league', category: 'career', weight: 5,
    title: 'Two-Sport Kid',
    description: 'The football coach saw you run at field day. He wants you to play QB this fall. Baseball and football overlap in the spring.',
    choices: [
      { label: 'Play both sports', visibleEffects: ['+Speed', '+Toughness', 'Risk: injury from football'] },
      { label: 'Stick with baseball only', visibleEffects: ['+Baseball development', '+1 Contact (more reps)'] },
      { label: 'Try football, drop baseball for a season', visibleEffects: ['+Speed', '+Aggression', '-1 season of baseball dev'] },
    ],
  },
];

const HIGH_SCHOOL_EVENTS: Omit<DecisionEvent, 'id'>[] = [
  {
    stage: 'high_school', category: 'career', weight: 10,
    title: 'The Big Decision',
    description: 'Senior year is ending. You have offers on the table. The biggest decision of your life so far.',
    choices: [
      { label: 'Enter the MLB Draft', visibleEffects: ['Pro career begins', 'Signing bonus', 'Skip college'], requirements: { minAge: 18 } },
      { label: 'Accept college scholarship', visibleEffects: ['3-4 years of development', 'Education', 'College experience'] },
      { label: 'Walk on at a junior college', visibleEffects: ['Prove yourself', 'Cheaper path', 'Less visibility'] },
    ],
  },
  {
    stage: 'high_school', category: 'moral', weight: 6,
    title: 'The Party',
    description: 'Senior party tonight. Everyone\'s going. There\'s going to be drinking. You have a showcase tournament tomorrow at 8 AM.',
    choices: [
      { label: 'Go to the party, leave early', visibleEffects: ['+1 Charisma', '+1 Social'], hiddenEffects: ['Might stay later than planned...'] },
      { label: 'Skip it — showcase is more important', visibleEffects: ['+1 Work Ethic', '+1 Composure', '-1 Social'] },
      { label: 'Go, and drink', visibleEffects: ['+2 Social', '-2 Work Ethic', 'Risk: hungover at showcase'] },
      { label: 'Invite friends to your house instead', visibleEffects: ['+1 Charisma', '+1 Leadership', 'Safe alternative'] },
    ],
  },
  {
    stage: 'high_school', category: 'family', weight: 8,
    title: 'Parents Fighting About Your Future',
    description: 'Your dad wants you to go pro — "take the money." Your mom wants you to go to college — "get an education." They\'re arguing about it at dinner. They look at you.',
    choices: [
      { label: 'Side with Dad — "I want to go pro"', visibleEffects: ['+Dad relationship', '-Mom relationship', 'Pro path favored'] },
      { label: 'Side with Mom — "Education matters"', visibleEffects: ['+Mom relationship', '-Dad relationship', 'College path favored'] },
      { label: '"I haven\'t decided yet"', visibleEffects: ['Neutral — buys time', 'Both parents slightly frustrated'] },
      { label: '"This is MY decision"', visibleEffects: ['+3 Composure', '+3 Independence', 'Both parents respect it (eventually)'] },
    ],
  },
  {
    stage: 'high_school', category: 'training', weight: 10,
    title: 'Summer Training Plan',
    description: 'Summer break. Three months of free time. How do you spend it?',
    choices: [
      { label: 'Travel ball tournament circuit', visibleEffects: ['+Development', '+Scout exposure', '-Family time', '-$2,000'] },
      { label: 'Strength and conditioning focus', visibleEffects: ['+Power', '+Speed', '+Durability'] },
      { label: 'Work a summer job', visibleEffects: ['+$3,000 income', '+Work Ethic', 'Less training time'] },
      { label: 'Baseball camp + relaxation', visibleEffects: ['+Contact', '+Mental health', 'Balanced approach'] },
    ],
    recurring: true,
  },
  {
    stage: 'high_school', category: 'politics', weight: 5,
    title: 'Coach Plays Favorites',
    description: 'The coach\'s son is starting at your position. You\'re better — everyone knows it. But the coach sets the lineup.',
    choices: [
      { label: 'Work harder and make it undeniable', visibleEffects: ['+2 Work Ethic', '+2 Composure', 'Might earn the spot... eventually'] },
      { label: 'Talk to the coach directly', visibleEffects: ['50/50: he respects it OR benches you'] },
      { label: 'Ask your parents to talk to the coach', visibleEffects: ['Might work', 'Risk: labeled a "parent problem"'] },
      { label: 'Transfer schools', visibleEffects: ['Fresh start', 'Lose all connections', 'Sit out one season (transfer rules)'] },
    ],
  },
  {
    stage: 'high_school', category: 'health', weight: 4,
    title: 'Playing Through Pain',
    description: 'Your shoulder has been sore for two weeks. It hurts to throw. But playoffs start tomorrow and your team needs you.',
    choices: [
      { label: 'Play through it — team needs me', visibleEffects: ['Team stays competitive', 'Injury risk: 40% chance of aggravation'], hiddenEffects: ['Could become chronic'] },
      { label: 'Sit out and rest', visibleEffects: ['Team suffers without you', '+Recovery', 'Scouts don\'t see you play'] },
      { label: 'Take painkillers and play', visibleEffects: ['Can perform', 'Masks the problem', '-1 Integrity'], hiddenEffects: ['First step toward substance dependence'] },
      { label: 'See a doctor first', visibleEffects: ['Get real diagnosis', 'Might miss 1 game', 'Best long-term decision'] },
    ],
  },
];

const MINOR_LEAGUE_EVENTS: Omit<DecisionEvent, 'id'>[] = [
  {
    stage: 'minor_leagues', category: 'career', weight: 8,
    title: 'The Grind',
    description: 'Another 12-hour bus ride. $25 meal money. You\'re hitting .230 and wondering if this is worth it. Your college roommate just started a tech job making $90K.',
    choices: [
      { label: 'Keep grinding — this is what it takes', visibleEffects: ['+2 Work Ethic', '+1 Composure'] },
      { label: 'Call your agent — "Am I wasting my time?"', visibleEffects: ['Agent gives honest assessment of your chances'] },
      { label: 'Consider quitting', visibleEffects: ['Opens "what else?" exploration'], hiddenEffects: ['Identity crisis if you quit'] },
    ],
  },
  {
    stage: 'minor_leagues', category: 'rivalry', weight: 6,
    title: 'Teammate Gets Called Up',
    description: 'Your roommate just got called up to the majors. You\'ve been here longer. You\'re having a better season. But he was a first-round pick and you were a sixth-rounder.',
    choices: [
      { label: 'Congratulate him sincerely', visibleEffects: ['+3 Clubhouse', '+2 Integrity', '+Loyalty from teammates'] },
      { label: 'Say congrats but seethe inside', visibleEffects: ['+1 Motivation', '-2 Mental Health'] },
      { label: 'Ask the coaches what you need to do', visibleEffects: ['+2 Work Ethic', 'Get honest feedback'] },
      { label: 'Demand a trade to an organization that appreciates you', visibleEffects: ['Bold move — could work or backfire spectacularly'] },
    ],
  },
  {
    stage: 'minor_leagues', category: 'financial', weight: 5,
    title: 'Money Trouble',
    description: 'Rent is due. Your car payment is late. Minor league salary doesn\'t cover living in a city with cost of living. You\'re making $2,200/month before taxes.',
    choices: [
      { label: 'Ask your parents for help', visibleEffects: ['+Financial stability', '-Independence', 'Parent relationship tested'] },
      { label: 'Get a part-time off-season job', visibleEffects: ['+Income', '-Training time', '+Work Ethic'] },
      { label: 'Find a cheaper apartment (worse neighborhood)', visibleEffects: ['-$400/month', '-Quality of life'] },
      { label: 'Use credit cards', visibleEffects: ['Temporary relief', 'Debt accumulates'], hiddenEffects: ['Financial crisis later'] },
    ],
  },
];

/** All event pools */
export const EVENT_POOLS: Record<CareerStage, Omit<DecisionEvent, 'id'>[]> = {
  little_league: LITTLE_LEAGUE_EVENTS,
  high_school: HIGH_SCHOOL_EVENTS,
  college: HIGH_SCHOOL_EVENTS.filter(e => e.category !== 'politics'), // Reuse many HS events
  minor_leagues: MINOR_LEAGUE_EVENTS,
  mlb: [], // MLB uses the existing LifeEventSystem
  post_career: [],
  retired: [],
};

let nextEventId = 1;

/** Generate a random decision event for a stage */
export function generateDecisionEvent(stage: CareerStage, rng: () => number = Math.random): DecisionEvent | null {
  const pool = EVENT_POOLS[stage];
  if (!pool || pool.length === 0) return null;

  // Weighted random selection
  const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * totalWeight;
  for (const template of pool) {
    roll -= template.weight;
    if (roll <= 0) {
      return { ...template, id: `decision_${nextEventId++}` };
    }
  }

  // Fallback
  return { ...pool[0], id: `decision_${nextEventId++}` };
}

/** Generate multiple events for a season */
export function generateSeasonEvents(stage: CareerStage, count: number, rng: () => number = Math.random): DecisionEvent[] {
  const events: DecisionEvent[] = [];
  const usedCategories = new Set<string>();

  for (let i = 0; i < count; i++) {
    const event = generateDecisionEvent(stage, rng);
    if (event && (!usedCategories.has(event.category) || event.recurring)) {
      events.push(event);
      usedCategories.add(event.category);
    }
  }
  return events;
}

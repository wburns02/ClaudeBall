/**
 * Career Stage System — manages the full life arc from age 12 to death.
 *
 * 6 stages: Little League → High School → College → Minors → MLB → Post-Career
 * Each stage has its own development rate, event pool, and time system.
 */

import type { System, DynastyMode, DynastyEvent, EntityId } from '../ecs/types.ts';
import type { EntityManager } from '../ecs/EntityManager.ts';
import type { EventBus } from '../ecs/EventBus.ts';
import type { PersonalityComponent } from '../components/Personality.ts';
import type { Component } from '../ecs/types.ts';

export type CareerStage =
  | 'little_league'   // ages 12-14
  | 'high_school'     // ages 15-18
  | 'college'         // ages 18-22 (optional)
  | 'minor_leagues'   // ages 18-25
  | 'mlb'             // ages 21-45+
  | 'post_career'     // ages 30-80+
  | 'retired';        // story complete (or passed torch)

export interface CareerStageComponent extends Component {
  type: 'CareerStage';
  currentStage: CareerStage;
  age: number;
  seasonInStage: number;       // years spent in current stage
  totalSeasons: number;        // total career years
  milestones: StageMilestone[];
  stageHistory: { stage: CareerStage; startAge: number; endAge: number; highlights: string[] }[];

  // Time management mode (evolves with stage)
  timeMode: 'key_moments' | 'seasonal_blocks' | 'weekly_planner';

  // Energy system
  energy: number;              // 0-10, resets daily
  maxEnergy: number;           // base 10, modified by fitness
  burnoutMeter: number;        // 0-100, accumulates with overtraining
  consecutiveTrainingDays: number;

  // Life balance
  physicalBalance: number;     // 0-100
  professionalBalance: number;
  relationshipBalance: number;
  mentalBalance: number;
}

export interface StageMilestone {
  stage: CareerStage;
  age: number;
  event: string;
  description: string;
}

export interface StageTransitionResult {
  from: CareerStage;
  to: CareerStage;
  age: number;
  narrative: string;
  choices?: string[];  // branching path options
}

// Stage configuration
const STAGE_CONFIG: Record<CareerStage, {
  ageRange: [number, number];
  timeMode: 'key_moments' | 'seasonal_blocks' | 'weekly_planner';
  developmentRate: number;      // multiplier for attribute growth
  eventsPerSeason: [number, number]; // min-max events per year
  bigMomentsPerSeason: [number, number]; // min-max playable moments
}> = {
  little_league: {
    ageRange: [12, 14], timeMode: 'key_moments',
    developmentRate: 1.5, eventsPerSeason: [2, 4], bigMomentsPerSeason: [1, 2],
  },
  high_school: {
    ageRange: [15, 18], timeMode: 'seasonal_blocks',
    developmentRate: 1.3, eventsPerSeason: [4, 7], bigMomentsPerSeason: [2, 4],
  },
  college: {
    ageRange: [18, 22], timeMode: 'seasonal_blocks',
    developmentRate: 1.2, eventsPerSeason: [3, 6], bigMomentsPerSeason: [2, 3],
  },
  minor_leagues: {
    ageRange: [18, 28], timeMode: 'weekly_planner',
    developmentRate: 1.0, eventsPerSeason: [3, 5], bigMomentsPerSeason: [1, 3],
  },
  mlb: {
    ageRange: [20, 48], timeMode: 'seasonal_blocks',
    developmentRate: 0.5, eventsPerSeason: [3, 6], bigMomentsPerSeason: [2, 4],
  },
  post_career: {
    ageRange: [28, 85], timeMode: 'seasonal_blocks',
    developmentRate: 0.0, eventsPerSeason: [4, 8], bigMomentsPerSeason: [1, 2],
  },
  retired: {
    ageRange: [28, 100], timeMode: 'key_moments',
    developmentRate: 0.0, eventsPerSeason: [1, 3], bigMomentsPerSeason: [0, 1],
  },
};

export function createCareerStage(startStage: CareerStage = 'little_league', startAge = 12): CareerStageComponent {
  const config = STAGE_CONFIG[startStage];
  return {
    type: 'CareerStage',
    currentStage: startStage,
    age: startAge,
    seasonInStage: 0,
    totalSeasons: 0,
    milestones: [],
    stageHistory: [],
    timeMode: config.timeMode,
    energy: 10,
    maxEnergy: 10,
    burnoutMeter: 0,
    consecutiveTrainingDays: 0,
    physicalBalance: 60,
    professionalBalance: 50,
    relationshipBalance: 60,
    mentalBalance: 60,
  };
}

/**
 * Career Stage System — manages stage transitions, aging, and development rates.
 */
export class CareerStageSystem implements System {
  readonly name = 'CareerStageSystem';
  readonly modes: DynastyMode[] = ['living'];

  private entities: EntityManager;
  private bus: EventBus;
  private rng: () => number;

  constructor(entities: EntityManager, bus: EventBus, rng?: () => number) {
    this.entities = entities;
    this.bus = bus;
    this.rng = rng ?? Math.random;
  }

  tick(_dt: number): void {}

  handleEvent(event: DynastyEvent): void {
    if (event.type === 'SeasonPhaseChanged' && event.data?.to === 'offseason') {
      this.advanceAllCareers();
    }
  }

  /** Advance age and check for stage transitions for all entities with CareerStage */
  advanceAllCareers(): void {
    const entities = this.entities.getEntitiesWith('CareerStage');
    for (const entityId of entities) {
      this.advanceCareer(entityId);
    }
  }

  /** Advance one entity's career by one year */
  advanceCareer(entityId: EntityId): StageTransitionResult | null {
    const stage = this.entities.getComponent<CareerStageComponent>(entityId, 'CareerStage');
    if (!stage || stage.currentStage === 'retired') return null;

    // Age up
    stage.age++;
    stage.seasonInStage++;
    stage.totalSeasons++;

    // Reset energy and reduce burnout slightly
    stage.energy = stage.maxEnergy;
    stage.burnoutMeter = Math.max(0, stage.burnoutMeter - 10);
    stage.consecutiveTrainingDays = 0;

    // Check for natural stage transition
    const config = STAGE_CONFIG[stage.currentStage];
    if (stage.age > config.ageRange[1]) {
      return this.transitionToNextStage(entityId, stage);
    }

    return null;
  }

  /** Transition to the next career stage */
  transitionToNextStage(entityId: EntityId, stage: CareerStageComponent): StageTransitionResult {
    const from = stage.currentStage;
    let to: CareerStage;
    let narrative: string;
    let choices: string[] | undefined;

    // Save current stage to history
    stage.stageHistory.push({
      stage: from,
      startAge: stage.age - stage.seasonInStage,
      endAge: stage.age,
      highlights: stage.milestones.filter(m => m.stage === from).map(m => m.description),
    });

    switch (from) {
      case 'little_league':
        to = 'high_school';
        narrative = `At ${stage.age}, you enter high school. The competition gets real. Scouts will start watching soon.`;
        break;

      case 'high_school':
        // THE BIG DECISION: college or draft?
        to = 'minor_leagues'; // Default to draft path
        narrative = `Senior year is over. The draft is coming. But so are college offers.`;
        choices = ['Enter the MLB Draft', 'Go to College', 'Play another sport'];
        break;

      case 'college':
        to = 'minor_leagues';
        narrative = `College career complete. Time to go pro.`;
        choices = ['Enter the Draft', 'Stay for senior year (if eligible)'];
        break;

      case 'minor_leagues':
        to = 'mlb';
        narrative = `THE CALL. You're going to the big leagues.`;
        break;

      case 'mlb':
        to = 'post_career';
        narrative = `After ${stage.seasonInStage} seasons in the majors, the game moves on. But your story doesn't end here.`;
        break;

      case 'post_career':
        to = 'retired';
        narrative = `You step away from baseball entirely. The next chapter begins.`;
        break;

      default:
        to = 'retired';
        narrative = 'Career complete.';
    }

    // Apply transition
    stage.currentStage = to;
    stage.seasonInStage = 0;
    stage.timeMode = STAGE_CONFIG[to].timeMode;

    // Add milestone
    stage.milestones.push({
      stage: to,
      age: stage.age,
      event: 'stage_transition',
      description: `Entered ${to.replace('_', ' ')} at age ${stage.age}`,
    });

    // Emit event
    this.bus.emit({
      type: 'CareerTransition',
      timestamp: Date.now(),
      data: { entityId, fromRole: from, toRole: to },
    });

    return { from, to, age: stage.age, narrative, choices };
  }

  /** Force transition to a specific stage (for player choices like "go to college") */
  forceTransition(entityId: EntityId, targetStage: CareerStage): StageTransitionResult | null {
    const stage = this.entities.getComponent<CareerStageComponent>(entityId, 'CareerStage');
    if (!stage) return null;

    const from = stage.currentStage;
    stage.stageHistory.push({
      stage: from,
      startAge: stage.age - stage.seasonInStage,
      endAge: stage.age,
      highlights: stage.milestones.filter(m => m.stage === from).map(m => m.description),
    });

    stage.currentStage = targetStage;
    stage.seasonInStage = 0;
    stage.timeMode = STAGE_CONFIG[targetStage].timeMode;

    stage.milestones.push({
      stage: targetStage,
      age: stage.age,
      event: 'stage_transition',
      description: `Chose ${targetStage.replace('_', ' ')} at age ${stage.age}`,
    });

    this.bus.emit({
      type: 'CareerTransition',
      timestamp: Date.now(),
      data: { entityId, fromRole: from, toRole: targetStage },
    });

    return {
      from, to: targetStage, age: stage.age,
      narrative: `You chose the ${targetStage.replace('_', ' ')} path.`,
    };
  }

  /** Process a training day — costs energy, builds attributes, risks burnout */
  trainDay(entityId: EntityId, intensity: 'light' | 'moderate' | 'hard'): {
    energyCost: number; burnoutDelta: number; balanceImpact: string;
  } {
    const stage = this.entities.getComponent<CareerStageComponent>(entityId, 'CareerStage');
    if (!stage) return { energyCost: 0, burnoutDelta: 0, balanceImpact: 'none' };

    const costs = { light: 1, moderate: 2, hard: 3 };
    const burnout = { light: 1, moderate: 3, hard: 6 };
    const energyCost = costs[intensity];
    const burnoutDelta = burnout[intensity];

    // Diminishing returns: consecutive training days reduce effectiveness
    const diminishingFactor = Math.max(0.3, 1 - (stage.consecutiveTrainingDays * 0.1));

    stage.energy = Math.max(0, stage.energy - energyCost);
    stage.burnoutMeter = Math.min(100, stage.burnoutMeter + Math.round(burnoutDelta * diminishingFactor));
    stage.consecutiveTrainingDays++;

    // Balance impacts
    stage.physicalBalance = Math.min(100, stage.physicalBalance + 3);
    stage.relationshipBalance = Math.max(0, stage.relationshipBalance - 2); // Training costs relationship time

    let balanceImpact = 'none';
    if (stage.burnoutMeter > 80) balanceImpact = 'burnout_warning';
    if (stage.burnoutMeter >= 100) balanceImpact = 'burnout_critical';
    if (stage.relationshipBalance < 30) balanceImpact = 'relationship_decay';
    if (stage.energy <= 0) balanceImpact = 'exhausted';

    return { energyCost, burnoutDelta: Math.round(burnoutDelta * diminishingFactor), balanceImpact };
  }

  /** Rest day — recovers energy and reduces burnout */
  restDay(entityId: EntityId, activity: 'family' | 'friends' | 'solo' | 'sleep'): void {
    const stage = this.entities.getComponent<CareerStageComponent>(entityId, 'CareerStage');
    if (!stage) return;

    stage.consecutiveTrainingDays = 0;
    stage.burnoutMeter = Math.max(0, stage.burnoutMeter - 5);

    switch (activity) {
      case 'family':
        stage.relationshipBalance = Math.min(100, stage.relationshipBalance + 8);
        stage.mentalBalance = Math.min(100, stage.mentalBalance + 3);
        break;
      case 'friends':
        stage.relationshipBalance = Math.min(100, stage.relationshipBalance + 5);
        stage.mentalBalance = Math.min(100, stage.mentalBalance + 5);
        break;
      case 'solo':
        stage.mentalBalance = Math.min(100, stage.mentalBalance + 8);
        stage.energy = Math.min(stage.maxEnergy, stage.energy + 2);
        break;
      case 'sleep':
        stage.energy = stage.maxEnergy;
        stage.burnoutMeter = Math.max(0, stage.burnoutMeter - 8);
        stage.mentalBalance = Math.min(100, stage.mentalBalance + 3);
        break;
    }
  }

  /** Get the development rate for the current stage */
  getDevelopmentRate(entityId: EntityId): number {
    const stage = this.entities.getComponent<CareerStageComponent>(entityId, 'CareerStage');
    if (!stage) return 0;
    const config = STAGE_CONFIG[stage.currentStage];

    // Burnout reduces development
    const burnoutPenalty = stage.burnoutMeter > 50 ? (stage.burnoutMeter - 50) / 100 : 0;
    return Math.max(0, config.developmentRate - burnoutPenalty);
  }

  /** Check if all balance pillars are above threshold */
  getLifeBalanceStatus(entityId: EntityId): { balanced: boolean; weakest: string; score: number } {
    const stage = this.entities.getComponent<CareerStageComponent>(entityId, 'CareerStage');
    if (!stage) return { balanced: false, weakest: 'unknown', score: 0 };

    const pillars = {
      physical: stage.physicalBalance,
      professional: stage.professionalBalance,
      relationship: stage.relationshipBalance,
      mental: stage.mentalBalance,
    };

    const weakest = Object.entries(pillars).sort(([, a], [, b]) => a - b)[0];
    const score = Math.round(Object.values(pillars).reduce((a, b) => a + b, 0) / 4);
    const balanced = Object.values(pillars).every(v => v >= 40);

    return { balanced, weakest: weakest[0], score };
  }

  /** Get stage config for an entity */
  getStageConfig(entityId: EntityId) {
    const stage = this.entities.getComponent<CareerStageComponent>(entityId, 'CareerStage');
    if (!stage) return null;
    return { ...STAGE_CONFIG[stage.currentStage], stage: stage.currentStage };
  }
}

/**
 * Daily Grind Engine — post-baseball life management.
 * Build your week, manage energy, hold a job, compete in a second sport.
 */

export type DayActivity =
  | 'early_workout' | 'yoga' | 'run' | 'weights' | 'sport_practice'
  | 'work' | 'family_time' | 'friends' | 'networking' | 'rest'
  | 'film_study' | 'coaching' | 'mentoring' | 'therapy' | 'sleep_in';

export interface DaySlot {
  time: 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night';
  activity: DayActivity;
}

export interface WeekPlan {
  monday: DaySlot[];
  tuesday: DaySlot[];
  wednesday: DaySlot[];
  thursday: DaySlot[];
  friday: DaySlot[];
  saturday: DaySlot[];
  sunday: DaySlot[];
}

export interface DayJob {
  id: string;
  title: string;
  income: number;           // thousands/year
  energyCost: number;       // per day (1-3)
  requirements: { attr: string; min: number }[];
  perks: string[];
  description: string;
}

export const DAY_JOBS: DayJob[] = [
  { id: 'youth_coach', title: 'Youth Baseball Coach', income: 40, energyCost: 1,
    requirements: [{ attr: 'baseballIQ', min: 50 }],
    perks: ['Mentor relationships', 'Stays in the game', 'Flexible schedule'],
    description: 'Teach the next generation. Low pay but deeply rewarding.' },
  { id: 'hs_coach', title: 'High School Coach', income: 55, energyCost: 2,
    requirements: [{ attr: 'leadership', min: 55 }],
    perks: ['Prospect discovery', 'Community reputation', 'Summer off'],
    description: 'Shape young athletes. Discover the next star.' },
  { id: 'scout', title: 'Part-Time Scout', income: 60, energyCost: 2,
    requirements: [{ attr: 'baseballIQ', min: 60 }],
    perks: ['Travel', 'Scouting intelligence', 'MLB connections'],
    description: 'Evaluate talent across the country. Uses your baseball eye.' },
  { id: 'local_broadcaster', title: 'Local Broadcaster', income: 70, energyCost: 2,
    requirements: [{ attr: 'charisma', min: 60 }],
    perks: ['Media reputation', 'Stays visible', 'Game analysis'],
    description: 'Call games for the local team. Your voice becomes familiar.' },
  { id: 'national_broadcaster', title: 'National Broadcaster', income: 150, energyCost: 3,
    requirements: [{ attr: 'charisma', min: 70 }],
    perks: ['Fame', 'High income', 'National platform'],
    description: 'ESPN or Fox Sports. The whole country hears you.' },
  { id: 'personal_trainer', title: 'Personal Trainer', income: 50, energyCost: 2,
    requirements: [{ attr: 'workEthic', min: 55 }],
    perks: ['Stays fit', 'Flexible schedule', 'Client relationships'],
    description: 'Train others while training yourself.' },
  { id: 'business_owner', title: 'Business Owner', income: 100, energyCost: 3,
    requirements: [{ attr: 'charisma', min: 50 }],
    perks: ['Wealth building', 'Independence', 'Legacy'],
    description: 'Restaurant, gym, or brand. High risk, high reward.' },
  { id: 'front_office', title: 'Front Office Assistant', income: 80, energyCost: 3,
    requirements: [{ attr: 'baseballIQ', min: 65 }],
    perks: ['GM pipeline', 'Insider knowledge', 'Career advancement'],
    description: 'The first step to running a team.' },
  { id: 'figuring_it_out', title: '"Figuring It Out"', income: 0, energyCost: 0,
    requirements: [],
    perks: ['All free time for training', 'No income', 'Identity crisis risk'],
    description: 'No job. Living off savings. Searching for meaning.' },
];

export interface ActivityEffect {
  energyCost: number;
  physicalDelta: number;
  relationshipDelta: number;
  mentalDelta: number;
  professionalDelta: number;
  description: string;
}

const ACTIVITY_EFFECTS: Record<DayActivity, ActivityEffect> = {
  early_workout: { energyCost: 2, physicalDelta: 3, relationshipDelta: -1, mentalDelta: 1, professionalDelta: 0, description: '4:30 AM grind. Discipline builds.' },
  yoga: { energyCost: 1, physicalDelta: 2, relationshipDelta: 0, mentalDelta: 3, professionalDelta: 0, description: 'Flexibility, breathing, inner peace.' },
  run: { energyCost: 2, physicalDelta: 2, relationshipDelta: 0, mentalDelta: 2, professionalDelta: 0, description: 'Clear your head, build your lungs.' },
  weights: { energyCost: 2, physicalDelta: 3, relationshipDelta: 0, mentalDelta: 0, professionalDelta: 0, description: 'Iron therapy. Power maintenance.' },
  sport_practice: { energyCost: 3, physicalDelta: 3, relationshipDelta: 1, mentalDelta: 1, professionalDelta: 0, description: 'Rugby, BJJ, softball — whatever your second sport is.' },
  work: { energyCost: 2, physicalDelta: -1, relationshipDelta: 0, mentalDelta: -1, professionalDelta: 3, description: 'Earn your keep. Build your career.' },
  family_time: { energyCost: 0, physicalDelta: 0, relationshipDelta: 4, mentalDelta: 2, professionalDelta: 0, description: 'Be present. They need you.' },
  friends: { energyCost: 1, physicalDelta: 0, relationshipDelta: 3, mentalDelta: 3, professionalDelta: 0, description: 'Decompress with the people who know you.' },
  networking: { energyCost: 1, physicalDelta: 0, relationshipDelta: 1, mentalDelta: 0, professionalDelta: 3, description: 'Connections open doors.' },
  rest: { energyCost: -2, physicalDelta: 0, relationshipDelta: 0, mentalDelta: 2, professionalDelta: 0, description: 'Your body recovers. Your mind calms.' },
  film_study: { energyCost: 1, physicalDelta: 0, relationshipDelta: 0, mentalDelta: 1, professionalDelta: 2, description: 'Watch tape. Learn. Improve.' },
  coaching: { energyCost: 2, physicalDelta: 1, relationshipDelta: 2, mentalDelta: 1, professionalDelta: 2, description: 'Teach what you know. Shape the next generation.' },
  mentoring: { energyCost: 1, physicalDelta: 0, relationshipDelta: 3, mentalDelta: 2, professionalDelta: 1, description: 'A kid needs your guidance. Be there.' },
  therapy: { energyCost: 0, physicalDelta: 0, relationshipDelta: 1, mentalDelta: 5, professionalDelta: 0, description: 'Work through the hard stuff. It helps.' },
  sleep_in: { energyCost: -3, physicalDelta: 1, relationshipDelta: 0, mentalDelta: 3, professionalDelta: -1, description: 'Your body thanks you. Your boss doesn\'t.' },
};

/** Calculate the effects of a full day's activities */
export function processDayActivities(activities: DayActivity[]): {
  totalEnergyCost: number;
  balanceDeltas: { physical: number; relationship: number; mental: number; professional: number };
  isDoubleDayDay: boolean;
  isTripleDay: boolean;
  descriptions: string[];
} {
  const deltas = { physical: 0, relationship: 0, mental: 0, professional: 0 };
  let totalEnergy = 0;
  const descriptions: string[] = [];
  let trainingActivities = 0;

  for (const activity of activities) {
    const effect = ACTIVITY_EFFECTS[activity];
    totalEnergy += effect.energyCost;
    deltas.physical += effect.physicalDelta;
    deltas.relationship += effect.relationshipDelta;
    deltas.mental += effect.mentalDelta;
    deltas.professional += effect.professionalDelta;
    descriptions.push(effect.description);

    if (['early_workout', 'yoga', 'run', 'weights', 'sport_practice'].includes(activity)) {
      trainingActivities++;
    }
  }

  return {
    totalEnergyCost: totalEnergy,
    balanceDeltas: deltas,
    isDoubleDayDay: trainingActivities >= 2,
    isTripleDay: trainingActivities >= 3,
    descriptions,
  };
}

/** Get all available day jobs */
export function getAvailableJobs(personality: Record<string, number>): DayJob[] {
  return DAY_JOBS.filter(job =>
    job.requirements.every(req => (personality[req.attr] ?? 0) >= req.min)
  );
}

/**
 * Family System — generates and manages the player's family tree.
 * Family members are persistent NPCs with their own stories, personalities,
 * and relationship arcs that span the entire career.
 */

import type { EntityId, Component } from '../ecs/types.ts';

export type FamilyArchetype =
  | 'baseball_family'  // Dad played minors, brother in college ball
  | 'blue_collar'      // Hard-working, modest income, grounded
  | 'military'         // Discipline, moves every 2 years
  | 'single_parent'    // Financial pressure, deep bond
  | 'immigrant'        // Language barriers, cultural pride
  | 'wealthy'          // All access, private coaches
  | 'broken_home';     // Divorce, instability, fuels drive

export type FamilyRole = 'father' | 'mother' | 'older_brother' | 'younger_sister' | 'grandfather' | 'grandmother' | 'uncle' | 'aunt' | 'cousin' | 'spouse' | 'son' | 'daughter';

export interface FamilyMember {
  id: string;
  entityId?: EntityId;     // If they exist as an ECS entity
  name: string;
  role: FamilyRole;
  age: number;
  alive: boolean;
  personality: {
    supportiveness: number;  // 1-100 how supportive of your career
    pressure: number;        // 1-100 how much pressure they put on you
    warmth: number;          // 1-100 emotional warmth
    involvement: number;     // 1-100 how involved in your life
  };
  relationship: number;      // -100 to +100 affinity
  storyHook: string;         // Their defining characteristic
  career?: string;           // What they do for a living
  sportsBackground?: string; // Athletic history if any
  isAlive: boolean;
}

export interface FamilyComponent extends Component {
  type: 'Family';
  archetype: FamilyArchetype;
  members: FamilyMember[];
  householdIncome: number;   // thousands/year
  incomeTier: 'poverty' | 'working_class' | 'middle_class' | 'upper_middle' | 'wealthy';
}

// ── Name pools ──

const MALE_NAMES = [
  'James', 'Robert', 'Michael', 'David', 'Carlos', 'Antonio', 'Marcus', 'Daniel',
  'Tomás', 'William', 'Joseph', 'Thomas', 'Kenji', 'Omar', 'Luis', 'Rafael',
  'Danny', 'Raymond', 'Frank', 'Samuel', 'Hector', 'Victor', 'Eduardo', 'George',
];

const FEMALE_NAMES = [
  'Maria', 'Rosa', 'Jennifer', 'Patricia', 'Linda', 'Ana', 'Carmen', 'Sofia',
  'Lisa', 'Michelle', 'Angela', 'Elena', 'Yuki', 'Claudia', 'Teresa', 'Diana',
  'Alicia', 'Monica', 'Isabel', 'Laura', 'Gabriela', 'Rachel', 'Sandra', 'Nora',
];

const STORY_HOOKS: Record<FamilyRole, string[]> = {
  father: [
    'Played semi-pro ball in his 20s — still has the trophies',
    'Works two jobs to keep the family afloat',
    'Former military — runs the house like a barracks',
    'Left when you were 5 — calls on birthdays sometimes',
    'Your biggest fan — never misses a game',
    'Coaches your Little League team',
    'Doesn\'t understand baseball — but shows up anyway',
  ],
  mother: [
    'Works double shifts to pay for travel ball',
    'Was a college softball star — knows the game',
    'Worries about injuries — wants you to focus on school',
    'Your emotional anchor — always knows what to say',
    'Pushes you harder than anyone — tough love',
    'Immigrant who sacrificed everything for your opportunities',
  ],
  older_brother: [
    'Was a better athlete than you — got injured in college, career ended',
    'Played in the minors for 3 years — never got the call',
    'Doesn\'t play sports — is a software engineer making great money',
    'Your first training partner — taught you everything',
    'Jealous of your talent — complicated relationship',
  ],
  younger_sister: [
    'Draws pictures of you playing baseball — puts them on the fridge',
    'A softball prodigy — might be better than you',
    'Looks up to you more than you realize',
    'Has zero interest in sports — loves music and art',
    'Born with a health condition — family rallied around her',
  ],
  grandfather: [
    'Played in the Negro Leagues in the 1950s — has incredible stories',
    'Played in the Dominican Winter League — taught you with a broomstick',
    'Was a coal miner — hands like leather, heart like gold',
    'A quiet man who just sits and watches you play with tears in his eyes',
    'Passed before you were born — but everyone says you play like him',
    'Immigrated with nothing — built everything from scratch',
  ],
  grandmother: [
    'Makes the best food — feeds the whole team after games',
    'Doesn\'t understand baseball but knits you a new cap every season',
    'Was a track star in her day — you got your speed from her',
    'Prays for you before every game — carries a rosary to the stands',
  ],
  uncle: [
    'High school baseball coach in another state — great connection',
    'Former scout — knows everybody in baseball',
    'The family black sheep — but he believes in you',
    'Runs a training facility — gives you free access',
  ],
  aunt: [
    'A teacher who helps with your SAT prep',
    'Your mom\'s sister — mediates family arguments',
    'Married into money — could help fund travel ball',
  ],
  cousin: [
    'Your age — plays on a rival travel ball team',
    'Older, played college ball — gives you advice',
    'Not athletic but your best friend off the field',
  ],
  spouse: [
    'Met in college — supported you through the minor league grind',
    'High school sweetheart — been together since sophomore year',
    'Met at a team event — understands the baseball life',
  ],
  son: [
    'Shows early signs of athletic talent',
    'More interested in video games than sports',
    'Left-handed — you started teaching him to pitch at age 4',
  ],
  daughter: [
    'A softball star — might surpass your career',
    'Your biggest fan — wears your jersey to school',
    'Wants to be a doctor, not an athlete — and you\'re proud of that',
  ],
};

const ARCHETYPE_CONFIGS: Record<FamilyArchetype, {
  incomeTier: FamilyComponent['incomeTier'];
  income: number;
  fatherPresent: boolean;
  defaultMembers: FamilyRole[];
  description: string;
}> = {
  baseball_family: {
    incomeTier: 'middle_class', income: 75,
    fatherPresent: true,
    defaultMembers: ['father', 'mother', 'older_brother', 'grandfather'],
    description: 'Baseball runs in your blood. Dad played minors. Grandpa has stories.',
  },
  blue_collar: {
    incomeTier: 'working_class', income: 45,
    fatherPresent: true,
    defaultMembers: ['father', 'mother', 'younger_sister'],
    description: 'Hard-working family. Every dollar counts. Your dream is the family\'s dream.',
  },
  military: {
    incomeTier: 'middle_class', income: 65,
    fatherPresent: true,
    defaultMembers: ['father', 'mother', 'older_brother'],
    description: 'Discipline from day one. You\'ve lived in 5 states by age 14.',
  },
  single_parent: {
    incomeTier: 'working_class', income: 35,
    fatherPresent: false,
    defaultMembers: ['mother', 'grandmother'],
    description: 'Mom holds it all together. The bond between you is unbreakable.',
  },
  immigrant: {
    incomeTier: 'poverty', income: 25,
    fatherPresent: true,
    defaultMembers: ['father', 'mother', 'grandmother', 'uncle'],
    description: 'Your parents left everything behind for you to have this chance.',
  },
  wealthy: {
    incomeTier: 'wealthy', income: 250,
    fatherPresent: true,
    defaultMembers: ['father', 'mother', 'younger_sister', 'uncle'],
    description: 'Private coaches, elite facilities, every advantage. But expectations are sky-high.',
  },
  broken_home: {
    incomeTier: 'working_class', income: 40,
    fatherPresent: false,
    defaultMembers: ['mother', 'older_brother', 'grandmother'],
    description: 'The divorce was ugly. Baseball is your escape. The field is the only place that makes sense.',
  },
};

// Archetype-specific story hooks override the generic pool
// Ensures "wealthy" families don't get "works two jobs" hooks
const ARCHETYPE_HOOKS: Partial<Record<FamilyArchetype, Partial<Record<FamilyRole, string[]>>>> = {
  baseball_family: {
    father: ['Played semi-pro ball in his 20s — still has the trophies', 'Coaches your Little League team', 'Your biggest fan — never misses a game'],
    mother: ['Was a college softball star — knows the game', 'Your emotional anchor — always knows what to say', 'Keeps a scrapbook of every game you\'ve ever played'],
    older_brother: ['Was a better athlete than you — got injured in college, career ended', 'Your first training partner — taught you everything', 'Played in the minors for 3 years — never got the call'],
    grandfather: ['Played in the Negro Leagues in the 1950s — has incredible stories', 'Played in the Dominican Winter League — taught you with a broomstick', 'A quiet man who just sits and watches you play with tears in his eyes'],
  },
  wealthy: {
    father: ['Runs a successful business — expects the same excellence from you', 'Hired a private hitting coach when you were 8', 'Played college ball at Stanford — connections everywhere', 'Your biggest investor — literally pays for everything'],
    mother: ['Manages your travel ball schedule like a CEO', 'Former tennis player — understands elite athletics', 'Your emotional anchor — always knows what to say'],
    younger_sister: ['Has her own private tennis coach', 'Looks up to you more than you realize', 'Gets everything she wants — but you\'re the favorite'],
    uncle: ['Runs a training facility — gives you free access', 'Connected to MLB front offices through business', 'The family black sheep — but he believes in you'],
  },
  military: {
    father: ['Former military — runs the house like a barracks', 'Deployed twice — missed two of your seasons', 'Discipline is love in his language', 'Taught you that quitting is never an option'],
    mother: ['Held the family together during deployments', 'Tougher than she looks — military spouse resilience', 'Your emotional anchor — always knows what to say'],
    older_brother: ['Enlisted right out of high school — sends letters from base', 'Your first training partner — taught you everything', 'Joined ROTC — might not come to your games anymore'],
  },
  blue_collar: {
    father: ['Works two jobs to keep the family afloat', 'Your biggest fan — never misses a game', 'Coaches your Little League team', 'Doesn\'t understand the game — but shows up anyway'],
    mother: ['Works double shifts to pay for travel ball', 'Your emotional anchor — always knows what to say', 'Worries about injuries — wants you to focus on school'],
    younger_sister: ['Draws pictures of you playing baseball — puts them on the fridge', 'Looks up to you more than you realize', 'Born with a health condition — family rallied around her'],
  },
  single_parent: {
    mother: ['Works double shifts to pay for travel ball', 'Your emotional anchor — the strongest person you know', 'Sacrificed everything for your dream', 'Drives you to every practice and game — never complains'],
    grandmother: ['Makes the best food — feeds the whole team after games', 'Prays for you before every game — carries a rosary to the stands', 'Raised your mom — now helping raise you'],
  },
  immigrant: {
    father: ['Left his country with nothing — built a life for you', 'Doesn\'t understand baseball — but shows up anyway', 'Works construction — comes to games in work boots', 'Sends money home to family — every dollar counted'],
    mother: ['Immigrant who sacrificed everything for your opportunities', 'Cooks traditional food for the whole team', 'Learning English through your homework — you teach each other'],
    grandmother: ['Still lives in the old country — you call her after every game', 'Prays for you before every game', 'Tells stories about your grandfather\'s athletic days'],
    uncle: ['Came to America first — helped your family get settled', 'Runs a small business — might give you a summer job', 'The family black sheep — but he believes in you'],
  },
  broken_home: {
    mother: ['Holds it all together — tougher than anyone knows', 'Works double shifts to pay for travel ball', 'Your emotional anchor — the only stable thing in your life'],
    older_brother: ['Took on the "man of the house" role too young', 'Your protector — nobody messes with you when he\'s around', 'Jealous of your talent — complicated relationship'],
    grandmother: ['Took you in when things got bad at home', 'Makes the best food — feeds the whole team after games', 'Was a track star in her day — you got your speed from her'],
  },
};

let nextFamilyId = 1;

/** Generate a complete family from an archetype */
export function generateFamily(archetype: FamilyArchetype, playerLastName: string, rng: () => number = Math.random): FamilyComponent {
  const config = ARCHETYPE_CONFIGS[archetype];
  const members: FamilyMember[] = [];

  for (const role of config.defaultMembers) {
    const isMale = ['father', 'older_brother', 'grandfather', 'uncle', 'cousin', 'son'].includes(role);
    const namePool = isMale ? MALE_NAMES : FEMALE_NAMES;
    const name = namePool[Math.floor(rng() * namePool.length)];
    // Use archetype-specific hooks if available, fall back to generic pool
    const archetypeHooks = ARCHETYPE_HOOKS[archetype]?.[role];
    const hooks = archetypeHooks ?? STORY_HOOKS[role] ?? ['A presence in your life'];
    const hook = hooks[Math.floor(rng() * hooks.length)];

    const ageDelta: Record<string, number> = {
      father: 25 + Math.floor(rng() * 10),
      mother: 23 + Math.floor(rng() * 8),
      older_brother: 2 + Math.floor(rng() * 5),
      younger_sister: -(1 + Math.floor(rng() * 4)),
      grandfather: 50 + Math.floor(rng() * 15),
      grandmother: 48 + Math.floor(rng() * 12),
      uncle: 20 + Math.floor(rng() * 15),
      aunt: 20 + Math.floor(rng() * 12),
      cousin: -2 + Math.floor(rng() * 5),
    };

    members.push({
      id: `family_${nextFamilyId++}`,
      name: role === 'father' || role === 'older_brother' || role === 'grandfather'
        ? `${name} ${playerLastName}`
        : role === 'mother' || role === 'grandmother'
          ? `${name} ${namePool === FEMALE_NAMES ? '' : playerLastName}`.trim()
          : `${name}`,
      role,
      age: 12 + (ageDelta[role] ?? 0), // Relative to player starting at 12
      alive: role === 'grandfather' ? rng() > 0.3 : true, // 30% chance grandpa passed
      personality: {
        supportiveness: 30 + Math.floor(rng() * 60),
        pressure: archetype === 'wealthy' || archetype === 'military' ? 50 + Math.floor(rng() * 40) : 20 + Math.floor(rng() * 50),
        warmth: archetype === 'single_parent' || archetype === 'immigrant' ? 60 + Math.floor(rng() * 30) : 30 + Math.floor(rng() * 50),
        involvement: config.fatherPresent || role !== 'father' ? 40 + Math.floor(rng() * 50) : 10 + Math.floor(rng() * 20),
      },
      relationship: role === 'mother' ? 70 + Math.floor(rng() * 20) : role === 'father' && !config.fatherPresent ? -20 + Math.floor(rng() * 30) : 40 + Math.floor(rng() * 40),
      storyHook: hook,
      isAlive: role === 'grandfather' ? rng() > 0.3 : true,
    });
  }

  return {
    type: 'Family',
    archetype,
    members,
    householdIncome: config.income,
    incomeTier: config.incomeTier,
  };
}

/** Get family member by role */
export function getFamilyMember(family: FamilyComponent, role: FamilyRole): FamilyMember | undefined {
  return family.members.find(m => m.role === role);
}

/** Age all family members by one year */
export function ageFamilyMembers(family: FamilyComponent, rng: () => number = Math.random): string[] {
  const events: string[] = [];

  for (const member of family.members) {
    if (!member.isAlive) continue;
    member.age++;

    // Death chance increases with age
    if (member.age > 75) {
      const deathChance = (member.age - 75) / 100; // 1% per year over 75
      if (rng() < deathChance) {
        member.isAlive = false;
        member.alive = false;
        events.push(`${member.name} (${member.role.replace('_', ' ')}) passed away at age ${member.age}.`);
      }
    }

    // Relationship natural drift (slight decay without maintenance)
    member.relationship = Math.max(-100, member.relationship - 1);
  }

  return events;
}

/** Add a new family member (marriage, children) */
export function addFamilyMember(family: FamilyComponent, role: FamilyRole, name: string, age: number, storyHook: string, rng: () => number = Math.random): FamilyMember {
  const member: FamilyMember = {
    id: `family_${nextFamilyId++}`,
    name,
    role,
    age,
    alive: true,
    isAlive: true,
    personality: {
      supportiveness: 40 + Math.floor(rng() * 50),
      pressure: 20 + Math.floor(rng() * 40),
      warmth: 50 + Math.floor(rng() * 40),
      involvement: 60 + Math.floor(rng() * 30),
    },
    relationship: 60 + Math.floor(rng() * 30),
    storyHook,
  };
  family.members.push(member);
  return member;
}

/** Get the archetype descriptions for character creation */
export function getArchetypeDescriptions(): { id: FamilyArchetype; label: string; description: string; incomeTier: string }[] {
  return Object.entries(ARCHETYPE_CONFIGS).map(([id, config]) => ({
    id: id as FamilyArchetype,
    label: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: config.description,
    incomeTier: config.incomeTier.replace('_', ' '),
  }));
}

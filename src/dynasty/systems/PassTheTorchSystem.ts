/**
 * Pass The Torch — generational succession system.
 * When the current character retires/passes the torch, the player takes
 * control of a successor: child, protégé, coaching tree, or stranger.
 * The previous character becomes an NPC who ages, contacts you, and eventually dies.
 */

export type SuccessorTier = 'blood' | 'protege' | 'coaching_tree' | 'stranger';

export interface SuccessorCandidate {
  id: string;
  name: string;
  tier: SuccessorTier;
  age: number;
  relationship: string;          // e.g. "daughter", "nephew", "assistant coach"
  affinity: number;              // 0-100 bond with the original character
  startingStage: string;         // Which career stage they'd begin at
  backstory: string;             // Generated narrative
  attributes: Record<string, number>;
  inheritedTraits: string[];     // Traits passed down or learned
  personalitySeeds: string[];    // What kind of person they'll become
}

export interface LegacyNPC {
  id: string;
  name: string;
  originalCharacterId: string;
  age: number;
  isAlive: boolean;
  health: number;                // 1-100, decreases with age
  personality: string[];         // Drives NPC behavior
  relationship: string;          // "father", "mentor", "former boss"
  contactFrequency: number;      // How often they reach out (1-10)
  lastContactSeason: number;
  npcBehavior: NPCBehaviorStyle;
  deathAge?: number;
  deathNarrative?: string;
  memorials: string[];           // Things named after them, tributes
}

export type NPCBehaviorStyle =
  | 'supportive_parent'       // Calls before big games, always encouraging
  | 'tiger_parent'            // Pushes hard, disappointed by anything less than perfection
  | 'absent_legend'           // Famous but distant, shows up rarely
  | 'proud_mentor'            // Publicly praises you, gives tactical advice
  | 'quiet_observer'          // Watches every game but says little
  | 'meddling_owner'          // If they were an owner, still tries to influence decisions
  | 'rival_turned_friend';    // Former rival who became a mentor

export interface GenerationRecord {
  generationNumber: number;
  characterName: string;
  characterId: string;
  startYear: number;
  endYear?: number;
  careerHighlights: string[];
  passedTorchTo?: string;
  legacyScore: number;          // From PrestigeEngine
  volumes: string[];            // Narrative journal volume titles
}

export interface DynastyLegacy {
  familyName: string;
  generations: GenerationRecord[];
  currentGeneration: number;
  totalYears: number;
  worldRecords: string[];       // Records set by any generation
  legendaryMoments: string[];   // Moments that echo across generations
  familyReputation: number;     // 0-100, builds across generations
}

/** Tier requirements and descriptions */
const TIER_CONFIG: Record<SuccessorTier, {
  label: string;
  description: string;
  requirements: string;
  startingStageOverride?: string;
  affinityMinimum: number;
  seasonsRequired: number;
}> = {
  blood: {
    label: 'Blood Relative',
    description: 'Your child follows in your footsteps. The deepest connection — your original character becomes a parent NPC who calls before big games.',
    requirements: 'Affinity 50+ with child, child must be age 14+',
    affinityMinimum: 50,
    seasonsRequired: 0,
  },
  protege: {
    label: 'Protégé',
    description: 'A player you discovered and mentored. Their development reflects YOUR coaching choices — but they have their own personality.',
    requirements: 'Mentor relationship established, 3+ seasons of mentoring',
    affinityMinimum: 30,
    seasonsRequired: 3,
  },
  coaching_tree: {
    label: 'Coaching Tree',
    description: 'Your assistant who learned your system. They inherit your organizational philosophy and start at a higher career stage.',
    requirements: 'Professional relationship, 2+ seasons working together',
    startingStageOverride: 'post_career',
    affinityMinimum: 20,
    seasonsRequired: 2,
  },
  stranger: {
    label: 'The Stranger',
    description: 'A random kid who idolizes you. Fresh start in the same world — your original character exists as a legend.',
    requirements: 'None',
    affinityMinimum: 0,
    seasonsRequired: 0,
  },
};

/** NPC behavior templates for how former characters act */
const NPC_CONTACT_TEMPLATES: Record<NPCBehaviorStyle, {
  preGame: string[];
  postWin: string[];
  postLoss: string[];
  milestone: string[];
  random: string[];
}> = {
  supportive_parent: {
    preGame: [
      'Your {relationship} called: "No matter what happens out there, I\'m proud of you."',
      'Text from {name}: "Go get em today. I believe in you. 💪"',
      'Your {relationship} left a voicemail: "Just wanted you to know your mom and I are watching."',
    ],
    postWin: [
      'Text from {name}: "THAT\'S MY KID! 😭🔥"',
      '{name} called: "You reminded me of myself out there. But better."',
      'Your {relationship} posted: "Couldn\'t be prouder. {playerName} is special."',
    ],
    postLoss: [
      'Text from {name}: "Tough one. But you\'ll bounce back. Always do."',
      '{name} called: "I had games like that too. Tomorrow\'s a new day."',
    ],
    milestone: [
      '{name} was in the stands when it happened. The camera caught {pronoun} crying.',
      'Your {relationship} said: "I always knew this day would come."',
    ],
    random: [
      '{name} sent a photo of your old Little League trophy: "Found this cleaning the garage 😂"',
      'Your {relationship} called just to chat about the weekend.',
    ],
  },
  tiger_parent: {
    preGame: [
      'Text from {name}: "Don\'t embarrass yourself out there."',
      '{name} called: "Your swing looked lazy in the last game. Fix it."',
    ],
    postWin: [
      'Text from {name}: "Good. But you left 2 runners on in the 5th."',
      '{name}: "That\'s more like it. Keep it up."',
    ],
    postLoss: [
      '{name} called: "What happened? I didn\'t raise a quitter."',
      'Text from {name}: "We need to talk about your approach at the plate."',
    ],
    milestone: [
      '{name}: "Took you long enough. I did it 3 years earlier."',
      '{name} posted a photo of {pronoun}self next to a photo of you: "Like father, like {child}. But better."',
    ],
    random: [
      '{name} sent you a clip of a prospect: "This kid is doing what you should be doing."',
    ],
  },
  absent_legend: {
    preGame: [],
    postWin: [
      'Someone forwarded you {name}\'s interview: "Yeah, I\'ve been watching. {pronoun_cap} is talented."',
    ],
    postLoss: [],
    milestone: [
      '{name} showed up unannounced. First time in months. "I had to be here for this."',
    ],
    random: [
      'You saw {name} on TV doing an interview. {pronoun_cap} mentioned you briefly.',
    ],
  },
  proud_mentor: {
    preGame: [
      '{name} texted: "Remember what I taught you about high fastballs."',
      'Your mentor called: "I\'ve been watching tape. Here\'s what I see..."',
    ],
    postWin: [
      '{name}: "That\'s MY guy! Everything I taught you, you\'re using it."',
      '{name} told reporters: "I take partial credit for that performance."',
    ],
    postLoss: [
      '{name} called: "Let me show you something on video. I think I see the issue."',
    ],
    milestone: [
      '{name} was in the broadcast booth: "I remember when {playerName} was just a kid. I saw this coming."',
    ],
    random: [
      '{name} invited you to a charity golf event.',
      '{name} sent you a book: "Read chapter 7. Reminds me of your situation."',
    ],
  },
  quiet_observer: {
    preGame: [],
    postWin: [
      'You noticed {name} in the stands. A small nod. That\'s all you needed.',
    ],
    postLoss: [
      'Text from {name}: just a 👊 emoji. Nothing else.',
    ],
    milestone: [
      '{name} was in the crowd. When the moment happened, {pronoun} stood — the only standing ovation from one person that meant everything.',
    ],
    random: [
      'A teammate mentioned: "I think I saw {name} at the game last week. Didn\'t say anything, just watched."',
    ],
  },
  meddling_owner: {
    preGame: [
      '{name} called the GM: "Why isn\'t {playerName} batting cleanup?"',
      '{name} leaked to reporters that {pronoun} thinks the manager is making a mistake.',
    ],
    postWin: [
      '{name}: "See? I told them to play you more."',
    ],
    postLoss: [
      '{name} called: "I\'m going to have a word with the front office."',
    ],
    milestone: [
      '{name} held a press conference to take credit for building the organization that developed you.',
    ],
    random: [
      '{name} wants to have dinner. Probably to talk about "the direction of the franchise."',
    ],
  },
  rival_turned_friend: {
    preGame: [
      '{name} texted: "Go beat those guys. I still hate their pitching coach."',
    ],
    postWin: [
      '{name}: "Not bad. I still would\'ve done it faster though 😏"',
    ],
    postLoss: [
      '{name}: "I lost plenty of those. The good ones bounce back."',
    ],
    milestone: [
      '{name} was the first person to call: "From one competitor to another — you earned this."',
    ],
    random: [
      '{name} challenged you to a home run derby at a charity event.',
    ],
  },
};

/**
 * Generate successor candidates based on the character's relationships
 */
export function generateSuccessorCandidates(
  characterName: string,
  familyMembers: { name: string; role: string; age: number; affinity: number }[],
  mentees: { name: string; seasonsmentored: number; affinity: number }[],
  coworkers: { name: string; role: string; seasonsTogether: number; affinity: number }[],
  rng: () => number = Math.random,
): SuccessorCandidate[] {
  const candidates: SuccessorCandidate[] = [];

  // Blood relatives
  for (const member of familyMembers) {
    if (['son', 'daughter', 'nephew', 'niece'].includes(member.role) && member.age >= 14 && member.affinity >= 50) {
      candidates.push({
        id: `blood_${member.name.replace(/\s/g, '_').toLowerCase()}`,
        name: member.name,
        tier: 'blood',
        age: member.age,
        relationship: member.role,
        affinity: member.affinity,
        startingStage: member.age < 15 ? 'little_league' : member.age < 19 ? 'high_school' : 'college',
        backstory: generateBloodBackstory(member, characterName, rng),
        attributes: generateStartingAttributes(member.affinity, rng),
        inheritedTraits: pickInheritedTraits(rng),
        personalitySeeds: pickPersonalitySeeds(rng),
      });
    }
  }

  // Protégés
  for (const mentee of mentees) {
    if (mentee.seasonsmentored >= 3 && mentee.affinity >= 30) {
      candidates.push({
        id: `protege_${mentee.name.replace(/\s/g, '_').toLowerCase()}`,
        name: mentee.name,
        tier: 'protege',
        age: 18 + Math.floor(rng() * 6),
        relationship: 'protégé',
        affinity: mentee.affinity,
        startingStage: 'minor_leagues',
        backstory: generateProtegeBackstory(mentee, characterName, rng),
        attributes: generateStartingAttributes(mentee.affinity * 0.8, rng),
        inheritedTraits: ['coachability', 'work_ethic'],
        personalitySeeds: pickPersonalitySeeds(rng),
      });
    }
  }

  // Coaching tree
  for (const coworker of coworkers) {
    if (coworker.seasonsTogether >= 2 && coworker.affinity >= 20) {
      candidates.push({
        id: `coach_${coworker.name.replace(/\s/g, '_').toLowerCase()}`,
        name: coworker.name,
        tier: 'coaching_tree',
        age: 30 + Math.floor(rng() * 15),
        relationship: coworker.role,
        affinity: coworker.affinity,
        startingStage: 'post_career',
        backstory: generateCoachingBackstory(coworker, characterName, rng),
        attributes: generateStartingAttributes(50, rng),
        inheritedTraits: ['composure', 'leadership'],
        personalitySeeds: pickPersonalitySeeds(rng),
      });
    }
  }

  // Stranger (always available)
  const strangerNames = [
    'Diego Ramirez', 'Marcus Williams', 'Kenji Tanaka', 'Luis Hernandez',
    'Jake Sullivan', 'Isaiah Thompson', 'Tomás Reyes', 'Alex Park',
    'DeShawn Jackson', 'Carlos Mendez', 'Ryu Watanabe', 'Ethan Brooks',
  ];
  const strangerName = strangerNames[Math.floor(rng() * strangerNames.length)];
  candidates.push({
    id: `stranger_${strangerName.replace(/\s/g, '_').toLowerCase()}`,
    name: strangerName,
    tier: 'stranger',
    age: 12 + Math.floor(rng() * 4),
    relationship: 'fan',
    affinity: 0,
    startingStage: 'little_league',
    backstory: generateStrangerBackstory(strangerName, characterName, rng),
    attributes: generateStartingAttributes(40, rng),
    inheritedTraits: [],
    personalitySeeds: pickPersonalitySeeds(rng),
  });

  return candidates;
}

/**
 * Execute the torch passing — returns the legacy NPC and generation record
 */
export function passTheTorch(
  successor: SuccessorCandidate,
  originalCharacter: { id: string; name: string; age: number; personality: string[]; legacyScore: number },
  dynasty: DynastyLegacy,
  rng: () => number = Math.random,
): { legacyNPC: LegacyNPC; generationRecord: GenerationRecord; farewell: string } {
  // Determine NPC behavior based on tier + personality
  const behavior = determineBehavior(successor.tier, originalCharacter.personality, rng);

  const legacyNPC: LegacyNPC = {
    id: `npc_${originalCharacter.id}`,
    name: originalCharacter.name,
    originalCharacterId: originalCharacter.id,
    age: originalCharacter.age,
    isAlive: true,
    health: Math.max(30, 100 - (originalCharacter.age - 50) * 2),
    personality: originalCharacter.personality,
    relationship: successor.tier === 'blood' ? 'parent' : successor.tier === 'protege' ? 'mentor' : 'former colleague',
    contactFrequency: successor.tier === 'blood' ? 9 : successor.tier === 'protege' ? 6 : 3,
    lastContactSeason: 0,
    npcBehavior: behavior,
    memorials: [],
  };

  const gen = dynasty.currentGeneration;
  if (dynasty.generations[gen]) {
    dynasty.generations[gen].endYear = dynasty.generations[gen].startYear + dynasty.totalYears;
    dynasty.generations[gen].passedTorchTo = successor.name;
    dynasty.generations[gen].legacyScore = originalCharacter.legacyScore;
  }

  dynasty.currentGeneration++;
  dynasty.generations.push({
    generationNumber: dynasty.currentGeneration + 1,
    characterName: successor.name,
    characterId: successor.id,
    startYear: (dynasty.generations[gen]?.endYear ?? 2025),
    careerHighlights: [],
    legacyScore: 0,
    volumes: [`Volume ${dynasty.currentGeneration + 1}: ${successor.name}`],
  });

  const farewell = generateFarewellNarrative(originalCharacter, successor, dynasty);

  return { legacyNPC, generationRecord: dynasty.generations[dynasty.currentGeneration], farewell };
}

/**
 * Age legacy NPCs — they age, decline, and eventually die
 */
export function ageLegacyNPC(
  npc: LegacyNPC,
  currentSeason: number,
  rng: () => number = Math.random,
): { contact?: string; died: boolean; deathNarrative?: string } {
  if (!npc.isAlive) return { died: false };

  npc.age++;
  npc.health = Math.max(0, npc.health - Math.floor(rng() * 5) - 1);

  // Death check — probability increases dramatically after 75
  const deathChance = npc.age < 65 ? 0.005 :
    npc.age < 75 ? 0.02 :
    npc.age < 85 ? 0.08 :
    npc.age < 90 ? 0.15 :
    0.30;

  if (npc.health <= 0 || rng() < deathChance) {
    npc.isAlive = false;
    npc.deathAge = npc.age;
    const narrative = generateDeathNarrative(npc);
    npc.deathNarrative = narrative;
    return { died: true, deathNarrative: narrative };
  }

  // Contact based on frequency
  const shouldContact = rng() < npc.contactFrequency / 10;
  if (shouldContact && currentSeason > npc.lastContactSeason) {
    npc.lastContactSeason = currentSeason;
    const templates = NPC_CONTACT_TEMPLATES[npc.npcBehavior];
    const pool = templates.random;
    if (pool.length > 0) {
      const template = pool[Math.floor(rng() * pool.length)];
      return {
        contact: template
          .replace(/\{name\}/g, npc.name)
          .replace(/\{relationship\}/g, npc.relationship)
          .replace(/\{pronoun\}/g, 'they')
          .replace(/\{pronoun_cap\}/g, 'They'),
        died: false,
      };
    }
  }

  return { died: false };
}

/**
 * Get a context-appropriate NPC contact message
 */
export function getNPCContact(
  npc: LegacyNPC,
  context: 'preGame' | 'postWin' | 'postLoss' | 'milestone' | 'random',
  playerName: string,
  rng: () => number = Math.random,
): string | null {
  if (!npc.isAlive) return null;

  const templates = NPC_CONTACT_TEMPLATES[npc.npcBehavior];
  const pool = templates[context];
  if (pool.length === 0) return null;

  const template = pool[Math.floor(rng() * pool.length)];
  return template
    .replace(/\{name\}/g, npc.name)
    .replace(/\{relationship\}/g, npc.relationship)
    .replace(/\{playerName\}/g, playerName)
    .replace(/\{pronoun\}/g, 'they')
    .replace(/\{pronoun_cap\}/g, 'They')
    .replace(/\{child\}/g, 'kid');
}

/**
 * Create a new dynasty legacy tracker
 */
export function createDynastyLegacy(familyName: string, firstCharacterName: string, characterId: string, startYear: number): DynastyLegacy {
  return {
    familyName,
    generations: [{
      generationNumber: 1,
      characterName: firstCharacterName,
      characterId,
      startYear,
      careerHighlights: [],
      legacyScore: 0,
      volumes: [`Volume 1: ${firstCharacterName}`],
    }],
    currentGeneration: 0,
    totalYears: 0,
    worldRecords: [],
    legendaryMoments: [],
    familyReputation: 10,
  };
}

/** Get tier info for display */
export function getTierInfo(): { tier: SuccessorTier; label: string; description: string; requirements: string }[] {
  return Object.entries(TIER_CONFIG).map(([tier, config]) => ({
    tier: tier as SuccessorTier,
    label: config.label,
    description: config.description,
    requirements: config.requirements,
  }));
}

// --- Internal helpers ---

function generateBloodBackstory(
  member: { name: string; role: string; age: number },
  parentName: string,
  rng: () => number,
): string {
  const stories = [
    `${member.name} grew up in the shadow of ${parentName}'s legend. Every trophy in the house, every interview on TV — a constant reminder of what greatness looks like. Now it's ${member.role === 'daughter' ? 'her' : 'his'} turn.`,
    `${member.name} didn't want to play baseball at first. Too much pressure being ${parentName}'s ${member.role}. But the game was in ${member.role === 'daughter' ? 'her' : 'his'} blood, and by age ${member.age - 3}, everyone could see it.`,
    `${member.name} has ${parentName}'s eyes and ${parentName}'s swing. But the fire? That's all ${member.role === 'daughter' ? 'her' : 'his'} own.`,
  ];
  return stories[Math.floor(rng() * stories.length)];
}

function generateProtegeBackstory(
  mentee: { name: string },
  mentorName: string,
  rng: () => number,
): string {
  const stories = [
    `${mentee.name} was a raw talent when ${mentorName} found them. Three years of mentoring transformed a kid with potential into a real prospect.`,
    `${mentorName} saw something in ${mentee.name} that nobody else did. "That kid has the same hunger I had," ${mentorName} told reporters.`,
    `${mentee.name} credits ${mentorName} with everything: "Without ${mentorName}, I'd be working construction right now."`,
  ];
  return stories[Math.floor(rng() * stories.length)];
}

function generateCoachingBackstory(
  coworker: { name: string; role: string },
  bossName: string,
  rng: () => number,
): string {
  const stories = [
    `${coworker.name} spent years as ${bossName}'s ${coworker.role}, absorbing every lesson. Now it's time to build something of their own.`,
    `"Everything I know about running a team, I learned from ${bossName}," ${coworker.name} said at their introductory press conference.`,
    `${coworker.name} and ${bossName} didn't always agree. But the disagreements made them both better. Now ${coworker.name} carries that philosophy forward.`,
  ];
  return stories[Math.floor(rng() * stories.length)];
}

function generateStrangerBackstory(
  name: string,
  legendName: string,
  rng: () => number,
): string {
  const stories = [
    `${name} has a poster of ${legendName} on his bedroom wall. He watches old highlight reels on YouTube every night before bed. He's never met his hero. But he will.`,
    `${name} comes from the same neighborhood where ${legendName} grew up. Different generation, same streets, same diamond, same dream.`,
    `${name} doesn't know ${legendName} personally. But he knows every stat, every record, every moment. When he steps up to the plate, he imagines being ${legendName}.`,
  ];
  return stories[Math.floor(rng() * stories.length)];
}

function generateStartingAttributes(affinityBonus: number, rng: () => number): Record<string, number> {
  const base = 30 + Math.round(affinityBonus * 0.2);
  return {
    contact: base + Math.round(rng() * 15),
    power: base + Math.round(rng() * 15),
    speed: base + Math.round(rng() * 15),
    fielding: base + Math.round(rng() * 15),
    eye: base + Math.round(rng() * 15),
    composure: base + Math.round(rng() * 15),
  };
}

function pickInheritedTraits(rng: () => number): string[] {
  const traits = ['clutch', 'leader', 'grinder', 'showman', 'hothead', 'prankster', 'introvert', 'mentor', 'competitor'];
  const count = 1 + Math.floor(rng() * 2);
  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * traits.length);
    picked.push(traits[idx]);
  }
  return picked;
}

function pickPersonalitySeeds(rng: () => number): string[] {
  const seeds = ['ambitious', 'humble', 'rebellious', 'disciplined', 'creative', 'analytical', 'emotional', 'stoic'];
  const count = 2 + Math.floor(rng() * 2);
  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * seeds.length);
    if (!picked.includes(seeds[idx])) picked.push(seeds[idx]);
  }
  return picked;
}

function determineBehavior(tier: SuccessorTier, personality: string[], rng: () => number): NPCBehaviorStyle {
  if (tier === 'blood') {
    if (personality.includes('hothead') || personality.includes('competitor')) return 'tiger_parent';
    if (personality.includes('introvert')) return 'quiet_observer';
    return 'supportive_parent';
  }
  if (tier === 'protege') return 'proud_mentor';
  if (tier === 'coaching_tree') {
    if (personality.includes('leader')) return 'meddling_owner';
    return 'quiet_observer';
  }
  return rng() > 0.5 ? 'absent_legend' : 'rival_turned_friend';
}

function generateFarewellNarrative(
  original: { name: string; age: number },
  successor: SuccessorCandidate,
  dynasty: DynastyLegacy,
): string {
  const gen = dynasty.currentGeneration;
  if (successor.tier === 'blood') {
    return `${original.name} stepped away at ${original.age}. Not because the fire went out — but because ${original.name} saw it burning in ${successor.name}'s eyes. The same hunger. The same drive. It was ${successor.name}'s turn now. The ${dynasty.familyName} legacy continues.`;
  }
  if (successor.tier === 'protege') {
    return `${original.name} watched ${successor.name} take the field and saw the future. "I taught that kid everything I know," ${original.name} told the press. "But the talent? That's all ${successor.name}." Generation ${gen + 1} of the ${dynasty.familyName} legacy begins.`;
  }
  if (successor.tier === 'coaching_tree') {
    return `${original.name} handed the keys to ${successor.name}. ${dynasty.totalYears} years of building something — now it's time to see if it can survive without its architect. The ${dynasty.familyName} coaching tree grows another branch.`;
  }
  return `Somewhere in the same city, ${successor.name} — a ${successor.age}-year-old who'd never met ${original.name} but knew every stat by heart — picked up a bat. A new chapter of the ${dynasty.familyName} story begins with a stranger who carries the same dream.`;
}

function generateDeathNarrative(npc: LegacyNPC): string {
  const narratives = [
    `${npc.name} passed away at ${npc.age}. Peacefully, at home, surrounded by family. The baseball world mourned. Every team observed a moment of silence. The flowers came for weeks.`,
    `${npc.name}, ${npc.age}, left this world the way ${npc.name} lived — on ${npc.name}'s own terms. The funeral filled a cathedral. Former teammates, coaches, and players whose careers ${npc.name} shaped all came to say goodbye.`,
    `The news came at 6 AM. ${npc.name} was gone. ${npc.age} years old. The tributes were immediate — every network, every team, every fan who remembered. But the only tribute that mattered was the silence in the clubhouse when the team heard.`,
  ];
  return narratives[Math.floor(Math.random() * narratives.length)];
}

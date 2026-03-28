/**
 * Coaching Philosophy System — when you become a coach/manager,
 * your style defines team culture. Philosophy clashes or harmonizes
 * with player personalities, creating emergent clubhouse dynamics.
 * Your coaching tree spreads across baseball as assistants get their own jobs.
 */

export type PhilosophyId = 'players_manager' | 'disciplinarian' | 'analytics_driven' | 'old_school' | 'developer' | 'tactician';

export interface CoachingPhilosophy {
  id: PhilosophyId;
  name: string;
  description: string;
  style: string;
  playerImpact: Record<string, number>;     // Stat modifiers
  whoThrives: string[];
  whoStruggles: string[];
  moraleMod: number;                         // Base morale modifier
  developmentMod: number;                    // Prospect development multiplier (percent)
  chemistryMod: number;                      // Clubhouse chemistry modifier
}

export interface CoachProfile {
  philosophyId: PhilosophyId;
  experience: number;                         // Seasons as coach/manager
  wins: number;
  losses: number;
  playoffAppearances: number;
  worldSeriesWins: number;
  coachingTreeSize: number;                   // How many assistants got their own jobs
  adaptability: number;                       // 0-100, how willing to adjust approach
  reputation: number;                         // 0-100, coaching reputation
  specialties: string[];                      // "bullpen management", "player development", etc.
}

export interface CoachingTreeMember {
  name: string;
  originalRole: string;                       // What they were under you
  currentRole: string;                        // What they are now
  currentTeam: string;
  philosophyVariant: PhilosophyId;            // What they took from your system
  seasonsUnderYou: number;
  record: { wins: number; losses: number };
  achievements: string[];
}

export interface ClubhouseInteraction {
  playerName: string;
  playerPersonality: string[];
  reaction: 'thriving' | 'neutral' | 'struggling' | 'rebellious';
  narrative: string;
  moraleDelta: number;
  developmentDelta: number;
}

const PHILOSOPHY_CONFIGS: Record<PhilosophyId, CoachingPhilosophy> = {
  players_manager: {
    id: 'players_manager',
    name: "Player's Manager",
    description: 'Supportive, trusting, player-first. The clubhouse loves you.',
    style: 'Supportive',
    playerImpact: { morale: 10, workEthic: -2 },
    whoThrives: ['ego', 'veteran', 'showman'],
    whoStruggles: ['lazy', 'low_work_ethic'],
    moraleMod: 10,
    developmentMod: 0,
    chemistryMod: 8,
  },
  disciplinarian: {
    id: 'disciplinarian',
    name: 'Disciplinarian',
    description: 'Strict rules, accountability, structure. Results through discipline.',
    style: 'Strict',
    playerImpact: { workEthic: 5, morale: -3 },
    whoThrives: ['coachable', 'young', 'grinder'],
    whoStruggles: ['ego', 'rebel', 'veteran'],
    moraleMod: -3,
    developmentMod: 5,
    chemistryMod: -2,
  },
  analytics_driven: {
    id: 'analytics_driven',
    name: 'Analytics-Driven',
    description: 'Data-first. Platoons, matchups, launch angles. Optimal decisions.',
    style: 'Analytical',
    playerImpact: { eye: 3, composure: 2 },
    whoThrives: ['smart', 'versatile', 'analytical'],
    whoStruggles: ['old_school', 'traditional'],
    moraleMod: 0,
    developmentMod: 3,
    chemistryMod: -1,
  },
  old_school: {
    id: 'old_school',
    name: 'Old School',
    description: 'Gut instinct, loyalty to veterans, "the right way to play."',
    style: 'Traditional',
    playerImpact: { composure: 3, loyalty: 5 },
    whoThrives: ['grinder', 'loyal', 'veteran'],
    whoStruggles: ['analytical', 'tech_savvy'],
    moraleMod: 3,
    developmentMod: -2,
    chemistryMod: 8,
  },
  developer: {
    id: 'developer',
    name: 'Developer',
    description: 'Focus on growth, patient with young players. Build for the future.',
    style: 'Patient',
    playerImpact: { potential: 3 },
    whoThrives: ['young', 'project', 'coachable'],
    whoStruggles: ['veteran', 'win_now'],
    moraleMod: 2,
    developmentMod: 15,
    chemistryMod: 3,
  },
  tactician: {
    id: 'tactician',
    name: 'Tactician',
    description: 'Aggressive baserunning, defensive shifts, small ball. Win close games.',
    style: 'Aggressive',
    playerImpact: { speed: 2, fielding: 3 },
    whoThrives: ['speed', 'defensive', 'smart'],
    whoStruggles: ['power', 'slugger'],
    moraleMod: 1,
    developmentMod: 0,
    chemistryMod: 4,
  },
};

/** Get all philosophies for selection screen */
export function getPhilosophies(): CoachingPhilosophy[] {
  return Object.values(PHILOSOPHY_CONFIGS);
}

/** Get a specific philosophy */
export function getPhilosophy(id: PhilosophyId): CoachingPhilosophy {
  return PHILOSOPHY_CONFIGS[id];
}

/** Create a new coach profile */
export function createCoachProfile(philosophyId: PhilosophyId): CoachProfile {
  return {
    philosophyId,
    experience: 0,
    wins: 0,
    losses: 0,
    playoffAppearances: 0,
    worldSeriesWins: 0,
    coachingTreeSize: 0,
    adaptability: 50,
    reputation: 20,
    specialties: [],
  };
}

/**
 * Evaluate how a player reacts to the coaching philosophy
 */
export function evaluatePlayerFit(
  philosophy: CoachingPhilosophy,
  playerTraits: string[],
  playerName: string,
  rng: () => number = Math.random,
): ClubhouseInteraction {
  const thrivesMatch = playerTraits.some(t => philosophy.whoThrives.includes(t));
  const strugglesMatch = playerTraits.some(t => philosophy.whoStruggles.includes(t));

  if (thrivesMatch && !strugglesMatch) {
    const narratives = [
      `${playerName} is thriving under the ${philosophy.style.toLowerCase()} approach. "This is exactly what I needed," he told reporters.`,
      `${playerName} has been a perfect fit for this coaching style. Performance is up across the board.`,
      `${playerName} credits the coaching staff: "They believe in me. That changes everything."`,
    ];
    return {
      playerName,
      playerPersonality: playerTraits,
      reaction: 'thriving',
      narrative: narratives[Math.floor(rng() * narratives.length)],
      moraleDelta: 5 + Math.floor(rng() * 5),
      developmentDelta: 3 + Math.floor(rng() * 3),
    };
  }

  if (strugglesMatch && !thrivesMatch) {
    const isRebel = playerTraits.includes('ego') || playerTraits.includes('rebel');
    if (isRebel && rng() > 0.5) {
      const narratives = [
        `${playerName} publicly criticized the coaching approach. "I didn't sign up for this," he told reporters.`,
        `Sources say ${playerName} has requested a trade, citing "philosophical differences" with the coaching staff.`,
        `${playerName} was benched after a heated exchange with the manager in the dugout.`,
      ];
      return {
        playerName,
        playerPersonality: playerTraits,
        reaction: 'rebellious',
        narrative: narratives[Math.floor(rng() * narratives.length)],
        moraleDelta: -8 - Math.floor(rng() * 5),
        developmentDelta: -3,
      };
    }
    const narratives = [
      `${playerName} is struggling to adapt to the ${philosophy.style.toLowerCase()} system. Numbers are down.`,
      `${playerName} seems uncomfortable with the coaching approach but hasn't said anything publicly.`,
    ];
    return {
      playerName,
      playerPersonality: playerTraits,
      reaction: 'struggling',
      narrative: narratives[Math.floor(rng() * narratives.length)],
      moraleDelta: -3 - Math.floor(rng() * 3),
      developmentDelta: -1,
    };
  }

  return {
    playerName,
    playerPersonality: playerTraits,
    reaction: 'neutral',
    narrative: `${playerName} is performing as expected under the current system.`,
    moraleDelta: 0,
    developmentDelta: 0,
  };
}

/**
 * Advance a coaching season — update record, reputation, coaching tree
 */
export function advanceCoachingSeason(
  profile: CoachProfile,
  seasonWins: number,
  seasonLosses: number,
  madePlayoffs: boolean,
  wonWorldSeries: boolean,
  assistants: { name: string; role: string; seasonsWithYou: number }[],
  rng: () => number = Math.random,
): { newTreeMembers: CoachingTreeMember[]; repDelta: number; narrative: string } {
  profile.experience++;
  profile.wins += seasonWins;
  profile.losses += seasonLosses;
  if (madePlayoffs) profile.playoffAppearances++;
  if (wonWorldSeries) profile.worldSeriesWins++;

  // Reputation changes
  const winPct = seasonWins / Math.max(1, seasonWins + seasonLosses);
  let repDelta = 0;
  if (winPct > 0.580) repDelta += 5;
  else if (winPct > 0.530) repDelta += 2;
  else if (winPct < 0.430) repDelta -= 5;
  else if (winPct < 0.480) repDelta -= 2;
  if (madePlayoffs) repDelta += 3;
  if (wonWorldSeries) repDelta += 10;
  profile.reputation = Math.max(0, Math.min(100, profile.reputation + repDelta));

  // Coaching tree growth — assistants may get hired away
  const newTreeMembers: CoachingTreeMember[] = [];
  for (const asst of assistants) {
    if (asst.seasonsWithYou >= 2 && rng() < 0.15) {
      const teams = ['Austin Thunderhawks', 'Portland Pioneers', 'Nashville Stars', 'Charlotte Knights', 'San Juan Coquís'];
      const member: CoachingTreeMember = {
        name: asst.name,
        originalRole: asst.role,
        currentRole: rng() > 0.3 ? 'Manager' : 'Bench Coach',
        currentTeam: teams[Math.floor(rng() * teams.length)],
        philosophyVariant: profile.philosophyId,
        seasonsUnderYou: asst.seasonsWithYou,
        record: { wins: 0, losses: 0 },
        achievements: [],
      };
      newTreeMembers.push(member);
      profile.coachingTreeSize++;
    }
  }

  let narrative = `Season ${profile.experience}: ${seasonWins}-${seasonLosses}`;
  if (wonWorldSeries) narrative += '. WORLD CHAMPIONS. The coaching staff celebrates.';
  else if (madePlayoffs) narrative += '. Playoff appearance. Building something here.';
  else if (winPct < 0.430) narrative += '. Disappointing season. Hot seat whispers begin.';
  else narrative += '. Solid season.';

  if (newTreeMembers.length > 0) {
    narrative += ` ${newTreeMembers.map(m => m.name).join(' and ')} left to take ${newTreeMembers.length > 1 ? 'their own jobs' : 'a new role'}. The coaching tree grows.`;
  }

  return { newTreeMembers, repDelta, narrative };
}

/**
 * Simulate coaching tree members' seasons (they have their own careers)
 */
export function simCoachingTreeSeason(
  members: CoachingTreeMember[],
  rng: () => number = Math.random,
): { updates: string[] } {
  const updates: string[] = [];
  for (const member of members) {
    const wins = 60 + Math.floor(rng() * 42);
    const losses = 162 - wins;
    member.record.wins += wins;
    member.record.losses += losses;

    if (wins >= 95 && rng() > 0.5) {
      member.achievements.push(`${member.currentTeam} won the division`);
      updates.push(`${member.name} (your former ${member.originalRole}) led ${member.currentTeam} to the division title!`);
    }
    if (wins >= 100 && rng() > 0.7) {
      member.achievements.push('World Series Champions');
      updates.push(`${member.name} won the World Series with ${member.currentTeam}! Your coaching tree bears fruit.`);
    }
    if (wins <= 62) {
      updates.push(`${member.name} was fired by ${member.currentTeam} after a ${wins}-${losses} season.`);
      member.currentRole = 'Unemployed';
    }
  }
  return { updates };
}

/** Get philosophy compatibility score for a player */
export function getCompatibilityScore(philosophyId: PhilosophyId, playerTraits: string[]): number {
  const philosophy = PHILOSOPHY_CONFIGS[philosophyId];
  let score = 50; // Neutral base
  for (const trait of playerTraits) {
    if (philosophy.whoThrives.includes(trait)) score += 15;
    if (philosophy.whoStruggles.includes(trait)) score -= 15;
  }
  return Math.max(0, Math.min(100, score));
}

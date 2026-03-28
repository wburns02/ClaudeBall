/**
 * Big Game Moments — the playable at-bats/pitches that punctuate each career stage.
 * You don't play every game. You play the MOMENTS.
 */

import type { EntityId } from '../ecs/types.ts';
import type { CareerStage } from './CareerStageSystem.ts';

export type MomentType =
  | 'championship_atbat'     // Win or lose the big game
  | 'showcase_performance'   // Scouts watching
  | 'rivalry_confrontation'  // Personal stakes
  | 'mlb_debut'              // First big league at-bat
  | 'walkoff_opportunity'    // Bottom 9, tie game
  | 'must_win_pitch'         // Bases loaded, season on the line
  | 'comeback_atbat'         // First at-bat after injury rehab
  | 'record_chase'           // One HR from a milestone
  | 'allstar_moment'         // All-Star game appearance
  | 'world_series_moment'    // The biggest stage
  | 'farewell_game'          // Last game before retirement
  | 'second_sport_moment';   // Rugby try, BJJ tournament, etc.

export interface BigGameMoment {
  id: string;
  type: MomentType;
  stage: CareerStage;
  title: string;
  description: string;
  situation: {
    inning?: number;
    outs?: number;
    count?: { balls: number; strikes: number };
    runnersOn?: ('first' | 'second' | 'third')[];
    score?: { you: number; them: number };
    context?: string;   // "State Championship", "Perfect Game Showcase", etc.
  };
  stakes: 'low' | 'medium' | 'high' | 'career_defining';
  // After the moment resolves:
  outcomes: {
    success: MomentOutcome;
    failure: MomentOutcome;
    neutral?: MomentOutcome;
  };
}

export interface MomentOutcome {
  narrative: string;
  reputationDelta?: { clubhouse?: number; media?: number; fan?: number };
  confidenceDelta?: number;
  scoutInterestDelta?: number;
  relationshipEffects?: { entityId: string; affinityDelta: number }[];
  milestoneUnlocked?: string;
  triggerDecisionEvent?: string;  // ID of decision event to trigger after
}

// ── Moment Generators by Stage ──

const LITTLE_LEAGUE_MOMENTS: Omit<BigGameMoment, 'id'>[] = [
  {
    type: 'championship_atbat', stage: 'little_league',
    title: 'Little League Championship',
    description: 'Bottom of the last inning. Your team is down by one. Runner on second. The whole neighborhood is watching.',
    situation: { inning: 6, outs: 2, count: { balls: 1, strikes: 2 }, runnersOn: ['second'], score: { you: 3, them: 4 }, context: 'District Championship' },
    stakes: 'high',
    outcomes: {
      success: { narrative: 'You drove the ball into the gap! Runner scores! Tie game — and the runner behind him comes around too! You win the championship! Your mom is screaming.', reputationDelta: { fan: 10 }, confidenceDelta: 10, milestoneUnlocked: 'first_championship' },
      failure: { narrative: 'You swung hard but topped it — weak grounder to short. Game over. Your team lost. You cried in the dugout. Dad put his arm around you. "There\'s always next year, buddy."', confidenceDelta: -5 },
    },
  },
  {
    type: 'showcase_performance', stage: 'little_league',
    title: 'AAU Tournament Showcase',
    description: 'Travel ball tournament. Coaches from the best high school programs are watching. Three at-bats to make an impression.',
    situation: { context: 'AAU Regional Tournament', count: { balls: 0, strikes: 0 } },
    stakes: 'medium',
    outcomes: {
      success: { narrative: 'Three at-bats, three hits — including a bomb over the left field fence. The coaches are scribbling notes. Your phone is going to ring.', scoutInterestDelta: 15, confidenceDelta: 5 },
      failure: { narrative: 'Rough day. 0-for-3 with two strikeouts. The coaches moved on to watch the next kid. "One bad day," your dad says. He\'s right. But it stings.', scoutInterestDelta: -5, confidenceDelta: -3 },
    },
  },
];

const HIGH_SCHOOL_MOMENTS: Omit<BigGameMoment, 'id'>[] = [
  {
    type: 'championship_atbat', stage: 'high_school',
    title: 'State Championship',
    description: 'Under the lights. Packed stands. Your whole school is here. The scout behind home plate has a radar gun. This is the biggest game of your life — so far.',
    situation: { inning: 7, outs: 1, count: { balls: 2, strikes: 1 }, runnersOn: ['first', 'third'], score: { you: 2, them: 3 }, context: 'State Championship' },
    stakes: 'career_defining',
    outcomes: {
      success: { narrative: 'You jumped on the 2-1 fastball and drove it deep to right-center. The ball one-hopped the wall. Two runs score! Your team leads! The stands erupt. The scout put down his radar gun and picked up his phone.', reputationDelta: { fan: 15, media: 10 }, scoutInterestDelta: 20, confidenceDelta: 15, milestoneUnlocked: 'state_champion' },
      failure: { narrative: 'You popped up to shallow right. The runners held. The next batter grounded out. Season over. You sat in the dugout staring at your hands. The scout left in the 3rd inning.', confidenceDelta: -10, scoutInterestDelta: -5 },
    },
  },
  {
    type: 'showcase_performance', stage: 'high_school',
    title: 'Perfect Game Showcase',
    description: '47 MLB scouts. 200 of the best high school players in the country. You have 3 at-bats to prove you belong. Your whole draft future is on the line.',
    situation: { context: 'Perfect Game All-American Classic', count: { balls: 0, strikes: 0 } },
    stakes: 'career_defining',
    outcomes: {
      success: { narrative: 'Three at-bats: double, home run, walk. The radar gun showed your exit velocity at 103 mph. Your phone rang that night — three teams want to set up pre-draft visits. You\'re a first-rounder.', scoutInterestDelta: 30, reputationDelta: { media: 15 }, milestoneUnlocked: 'showcase_star' },
      failure: { narrative: 'The pitching was better than anything you\'ve seen. 0-for-3 with two Ks on breaking balls. The scouts wrote "swing and miss concerns" in their reports. You dropped from round 1 projections to round 3.', scoutInterestDelta: -15, confidenceDelta: -8 },
      neutral: { narrative: '1-for-3 with a single. Solid defense. Nothing spectacular, nothing terrible. You\'re still on the board, but you didn\'t separate yourself. "Steady but unspectacular" — the scout\'s note.', scoutInterestDelta: 0 },
    },
  },
  {
    type: 'rivalry_confrontation', stage: 'high_school',
    title: 'Rivalry Game',
    description: 'Your rival from travel ball is on the mound. You haven\'t faced him since he struck you out in the AAU tournament three years ago. Both of you remember.',
    situation: { inning: 5, outs: 0, count: { balls: 0, strikes: 0 }, runnersOn: ['second'], context: 'District Rivalry Game' },
    stakes: 'high',
    outcomes: {
      success: { narrative: 'He threw his best fastball. You were waiting. Line drive to the gap — runner scores, you\'re standing on second. You stared at him on the mound. He looked away first. Three years of waiting for this moment. It was worth it.', confidenceDelta: 10, relationshipEffects: [{ entityId: 'rival', affinityDelta: -5 }] },
      failure: { narrative: 'Curveball in the dirt. You chased it. Strike three. He pumped his fist. Your rival owns you — again. "I\'ll get him next time," you told yourself. But there might not be a next time.', confidenceDelta: -8, relationshipEffects: [{ entityId: 'rival', affinityDelta: 5 }] },
    },
  },
];

const MINOR_LEAGUE_MOMENTS: Omit<BigGameMoment, 'id'>[] = [
  {
    type: 'mlb_debut', stage: 'minor_leagues',
    title: 'THE CALL',
    description: 'The manager pulls you aside before the game. "Pack your bags, kid. You\'re going to the show." Your hands are shaking as you call your mom.',
    situation: { context: 'Called up to MLB' },
    stakes: 'career_defining',
    outcomes: {
      success: { narrative: 'Your first MLB at-bat. 40,000 people. Your legs are shaking. The pitcher winds up — fastball, inside. You turn on it. The ball rockets into the left field seats. HOME RUN. In your first at-bat. The dugout mobs you. The crowd is chanting your name. Your mom is watching on TV, crying.', reputationDelta: { fan: 25, media: 20, clubhouse: 10 }, confidenceDelta: 20, milestoneUnlocked: 'mlb_debut_hr' },
      failure: { narrative: 'Your first MLB at-bat. The pitcher throws three sliders. You swing at all three. Strikeout. You walk back to the dugout, head down. A veteran puts his hand on your shoulder: "Welcome to the show, kid. It gets easier."', confidenceDelta: -5, reputationDelta: { clubhouse: 5 } },
    },
  },
];

const MLB_MOMENTS: Omit<BigGameMoment, 'id'>[] = [
  {
    type: 'walkoff_opportunity', stage: 'mlb',
    title: 'Walkoff Opportunity',
    description: 'Bottom of the 9th. Tie game. Runner on second with two outs. 40,000 people on their feet. The whole season comes down to this at-bat.',
    situation: { inning: 9, outs: 2, count: { balls: 3, strikes: 2 }, runnersOn: ['second'], score: { you: 4, them: 4 }, context: 'September pennant race' },
    stakes: 'career_defining',
    outcomes: {
      success: { narrative: 'Full count. The crowd is deafening. He throws the slider — and leaves it up. You drove it into the gap. The runner rounds third. He scores! WALKOFF! You\'re mobbed at first base. The Gatorade shower. The interview. The headline tomorrow: YOUR NAME.', reputationDelta: { fan: 20, media: 15, clubhouse: 10 }, confidenceDelta: 15, milestoneUnlocked: 'walkoff_hero', triggerDecisionEvent: 'post_walkoff_media' },
      failure: { narrative: 'Full count. He throws the slider. You swung through it. Strike three. The crowd goes silent. You stand at the plate for a long moment before walking back to the dugout. Tomorrow the headline reads: "Burns comes up empty in the clutch."', reputationDelta: { fan: -5, media: -8 }, confidenceDelta: -10 },
    },
  },
  {
    type: 'world_series_moment', stage: 'mlb',
    title: 'World Series At-Bat',
    description: 'Game 7. World Series. The entire baseball world is watching. Your family is in the stands. Your childhood rival is on the mound. This is what every bottle cap in the backyard was preparing you for.',
    situation: { inning: 8, outs: 1, count: { balls: 1, strikes: 0 }, runnersOn: ['first', 'second'], score: { you: 3, them: 4 }, context: 'World Series Game 7' },
    stakes: 'career_defining',
    outcomes: {
      success: { narrative: 'You looked at your rival on the mound. He looked back. Twenty years of history in one moment. He threw the fastball — his best pitch. You knew it was coming. The sound off the bat was unlike anything you\'d ever heard. The ball sailed over the center field wall. Three runs score. You round the bases in a daze. World Champions. The narrative journal writes itself tonight.', reputationDelta: { fan: 50, media: 40, clubhouse: 25 }, confidenceDelta: 30, milestoneUnlocked: 'world_series_hero' },
      failure: { narrative: 'He threw the slider. The same pitch that got you in high school. You swung and missed. The series went on without your moment. Your team won anyway — but the camera wasn\'t on you. "Next time," you whispered. Except in the World Series, there might not be a next time.', confidenceDelta: -15, reputationDelta: { fan: -3 } },
    },
  },
  {
    type: 'comeback_atbat', stage: 'mlb',
    title: 'The Comeback',
    description: 'Two years since the injury. International ball. Independent league. AAA. And now — back in the bigs. The crowd gives you a standing ovation just for walking to the plate.',
    situation: { inning: 1, outs: 0, count: { balls: 0, strikes: 0 }, context: 'First game back from injury' },
    stakes: 'career_defining',
    outcomes: {
      success: { narrative: 'The ovation lasted 45 seconds. You stepped into the box with tears in your eyes. First pitch — fastball. You lined it into center field for a clean single. The dugout erupted. You stood on first base and looked up at the sky. Two years of rehab. Two years of doubt. Two years of people saying you were done. You\'re back.', reputationDelta: { fan: 30, media: 25, clubhouse: 15 }, confidenceDelta: 25, milestoneUnlocked: 'the_comeback' },
      failure: { narrative: 'The ovation was beautiful. But the at-bat wasn\'t. Three pitches, three swings, three misses. Strikeout. But as you walked back to the dugout, the crowd stood again. They weren\'t cheering the result. They were cheering that you were HERE. That mattered more than any hit.', confidenceDelta: 5, reputationDelta: { fan: 15, clubhouse: 10 } },
    },
  },
  {
    type: 'farewell_game', stage: 'mlb',
    title: 'The Last Game',
    description: 'You announced your retirement last week. This is it. The final game. The crowd has signs. Your teammates are wearing your number. Your family is in the front row.',
    situation: { inning: 8, outs: 0, count: { balls: 0, strikes: 0 }, context: 'Final career game' },
    stakes: 'career_defining',
    outcomes: {
      success: { narrative: 'Your last at-bat. The pitcher grooved one — everyone knew it. You swung and connected. The ball arced into the left field seats. Curtain call home run. The teammates lined up at home plate. You touched the plate one last time, looked into the stands, and found your mom. She was crying. So were you. The perfect ending.', reputationDelta: { fan: 30, media: 20 }, confidenceDelta: 20, milestoneUnlocked: 'farewell_homer' },
      failure: { narrative: 'Your last at-bat. Ground ball to short. You jogged to first, knowing it wasn\'t enough. Out by a step. But as you turned to walk off the field for the last time, both teams came out of the dugout. Standing ovation from everyone — opponents included. You tipped your cap, and walked into the tunnel. The lights were bright behind you. Ahead, everything was dark and new.', confidenceDelta: 0, reputationDelta: { fan: 15 }, triggerDecisionEvent: 'post_retirement_void' },
    },
  },
];

/** All moment pools indexed by stage */
export const MOMENT_POOLS: Record<CareerStage, Omit<BigGameMoment, 'id'>[]> = {
  little_league: LITTLE_LEAGUE_MOMENTS,
  high_school: HIGH_SCHOOL_MOMENTS,
  college: HIGH_SCHOOL_MOMENTS.map(m => ({ ...m, stage: 'college' as CareerStage })), // Reuse with stage override
  minor_leagues: MINOR_LEAGUE_MOMENTS,
  mlb: MLB_MOMENTS,
  post_career: [],
  retired: [],
};

let nextMomentId = 1;

/** Generate a Big Game Moment for a given stage */
export function generateMoment(stage: CareerStage, rng: () => number = Math.random): BigGameMoment | null {
  const pool = MOMENT_POOLS[stage];
  if (!pool || pool.length === 0) return null;

  const template = pool[Math.floor(rng() * pool.length)];
  return {
    ...template,
    id: `moment_${nextMomentId++}`,
  };
}

/** Generate multiple moments for a season */
export function generateSeasonMoments(stage: CareerStage, count: number, rng: () => number = Math.random): BigGameMoment[] {
  const moments: BigGameMoment[] = [];
  for (let i = 0; i < count; i++) {
    const m = generateMoment(stage, rng);
    if (m) moments.push(m);
  }
  return moments;
}

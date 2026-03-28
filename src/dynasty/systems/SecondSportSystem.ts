/**
 * Second Sport Competition — competitive outlets after baseball.
 * Each sport has its own progression, NPCs, and Big Game Moments.
 */

export type SportId = 'rugby' | 'softball' | 'boxing' | 'golf' | 'bjj' | 'marathon' | 'crossfit';

export interface SecondSport {
  id: SportId;
  name: string;
  description: string;
  keyAttributes: string[];       // Which baseball attrs transfer
  progression: string[];         // Ranking/level names
  currentLevel: number;          // 0-based index into progression
  skillRating: number;           // 1-100 in this sport
  seasonsPlayed: number;
  achievements: string[];
  teamName?: string;             // Club/team name if applicable
}

export interface SportMoment {
  sportId: SportId;
  title: string;
  description: string;
  successNarrative: string;
  failureNarrative: string;
}

const SPORT_CONFIGS: Record<SportId, {
  name: string;
  description: string;
  keyAttributes: string[];
  progression: string[];
  baseSkillFromBaseball: (attrs: Record<string, number>) => number;
  moments: SportMoment[];
}> = {
  rugby: {
    name: 'Rugby',
    description: 'Full-contact, fast-paced. Your baseball speed and toughness translate.',
    keyAttributes: ['speed', 'power', 'composure'],
    progression: ['Social Club', 'Division 3', 'Division 2', 'Division 1', 'Premier League', 'National Team Pool', 'National Team'],
    baseSkillFromBaseball: (a) => Math.round((a.speed ?? 50) * 0.4 + (a.power ?? 50) * 0.3 + (a.composure ?? 50) * 0.2),
    moments: [
      { sportId: 'rugby', title: 'Championship Final', description: 'Your club is in the championship. Packed stands. 5 minutes left, down by 3.',
        successNarrative: 'You broke through two tackles and dove for the try line. The referee\'s arm went up. TRY! Your teammates mobbed you. Championship winners. At your age. Against kids half your age.',
        failureNarrative: 'You had the ball 5 meters out. The tackle was low and hard. You went down. Turnover. The final whistle blew. Runner-up. "Next year," your captain said. But at your age, next year isn\'t guaranteed.' },
      { sportId: 'rugby', title: 'Scoring Against College Kids', description: 'You\'re 42. The kid defending you is 21. He\'s faster. But you\'re smarter.',
        successNarrative: 'He had 3 steps on you. Everyone saw it. But you read his angle, planted your foot, and somehow got there first. The try went to the old man. Your teammates went crazy. Your daughter texted: "Mom showed me the video. You\'re insane. 😂💪"',
        failureNarrative: 'He blew past you. Pure speed. Nothing you could do. Your hamstring twinged as you tried to keep up. Father Time is undefeated. But you\'ll be back next week.' },
    ],
  },
  bjj: {
    name: 'Brazilian Jiu-Jitsu',
    description: 'The gentle art. Chess with your body. Humbling and addictive.',
    keyAttributes: ['composure', 'eye', 'coachability'],
    progression: ['White Belt', 'Blue Belt', 'Purple Belt', 'Brown Belt', 'Black Belt'],
    baseSkillFromBaseball: (a) => Math.round((a.composure ?? 50) * 0.3 + (a.eye ?? 50) * 0.3 + (a.coachability ?? 50) * 0.2),
    moments: [
      { sportId: 'bjj', title: 'First Day Humbling', description: 'Your first day on the mats. A 22-year-old purple belt is your partner.',
        successNarrative: 'He submitted you. Twice. Then three more times. But on the sixth roll, you defended his arm bar for 30 seconds before he switched to a choke. "Not bad for day one," he said. You were hooked.',
        failureNarrative: 'He submitted you in 15 seconds. Then 10. Then 8. You couldn\'t understand how someone smaller could be so dominant. You drove home questioning everything you thought you knew about being an athlete.' },
      { sportId: 'bjj', title: 'Belt Promotion', description: 'The professor calls your name at the end of class. The room goes quiet.',
        successNarrative: 'He tied the new belt around your waist. The room applauded. You\'d earned this through hundreds of hours on the mats. Different sport, same grind. The belt changed color, but the work ethic was the same one that got you to the big leagues.',
        failureNarrative: 'He promoted your training partner instead. Not you. "Keep working," he said. You nodded. But it stung. You thought you were ready.' },
    ],
  },
  softball: {
    name: 'Competitive Softball',
    description: 'Beer league to tournament ball. Your baseball skills directly transfer.',
    keyAttributes: ['contact', 'power', 'fielding'],
    progression: ['Beer League', 'Competitive Rec', 'Tournament Team', 'Senior National Team'],
    baseSkillFromBaseball: (a) => Math.round((a.contact ?? 50) * 0.4 + (a.power ?? 50) * 0.3 + (a.fielding ?? 50) * 0.2),
    moments: [
      { sportId: 'softball', title: 'Tournament Championship', description: 'Double-elimination tournament. You\'re in the finals. Former college and minor league guys everywhere.',
        successNarrative: 'You went 4-for-4 with 2 home runs. The last one cleared the parking lot. "Show-off," your teammate laughed. You won the MVP trophy. It sits next to your MLB memorabilia now. Different trophy. Same feeling.',
        failureNarrative: 'You popped up with the bases loaded in the championship game. The same mistake you made in the minors — chasing the high pitch. Some things never change.' },
    ],
  },
  boxing: {
    name: 'Boxing',
    description: 'The sweet science. Just you and another person. No team to hide behind.',
    keyAttributes: ['speed', 'power', 'composure'],
    progression: ['Training', 'Amateur Debut', 'Regional Circuit', 'Masters Division', 'Golden Gloves Masters'],
    baseSkillFromBaseball: (a) => Math.round((a.speed ?? 50) * 0.3 + (a.power ?? 50) * 0.3 + (a.composure ?? 50) * 0.3),
    moments: [
      { sportId: 'boxing', title: 'First Fight', description: 'Three rounds. Amateur rules. Your corner man is a retired middleweight who smells like cigar smoke.',
        successNarrative: 'You won by unanimous decision. Your jab was sharp — hand-eye coordination from 20 years of hitting fastballs. Turns out reading pitches and reading punches aren\'t that different.',
        failureNarrative: 'You got caught with a right hook in the second round. Your legs went. You survived, but lost the decision. "At least you didn\'t quit," your trainer said. The baseball player in you wouldn\'t let you.' },
    ],
  },
  golf: {
    name: 'Golf',
    description: 'The mental game. Where baseball composure becomes an unfair advantage.',
    keyAttributes: ['eye', 'composure', 'power'],
    progression: ['Casual', 'Club Player', 'Club Champion', 'Amateur Circuit', 'Senior Amateur'],
    baseSkillFromBaseball: (a) => Math.round((a.eye ?? 50) * 0.4 + (a.composure ?? 50) * 0.3 + (a.power ?? 50) * 0.2),
    moments: [
      { sportId: 'golf', title: 'Club Championship', description: '18 holes. Your playing partner is a retired surgeon who\'s been a member for 30 years.',
        successNarrative: 'You sank a 15-foot putt on 18 to win by one stroke. The surgeon shook your hand: "Clutch under pressure. I hear you were a baseball player." You smiled. Some things transfer.',
        failureNarrative: 'You three-putted 18 to lose by one. The surgeon patted your back: "That\'s golf." You stared at the flag for a long time before walking off the green.' },
    ],
  },
  marathon: {
    name: 'Marathon / Triathlon',
    description: 'The ultimate test of will. No one cares about your batting average out here.',
    keyAttributes: ['stamina', 'workEthic', 'composure'],
    progression: ['5K Runner', '10K Runner', 'Half Marathon', 'Full Marathon', 'Triathlete', 'Ironman Finisher'],
    baseSkillFromBaseball: (a) => Math.round((a.speed ?? 50) * 0.2 + (a.composure ?? 50) * 0.3 + 30),
    moments: [
      { sportId: 'marathon', title: 'First Marathon', description: '26.2 miles. Mile 20 is where it gets real. Your body is screaming.',
        successNarrative: 'You crossed the finish line in 3:42. You cried. Not from pain — from the realization that you could still push your body to places it didn\'t want to go. Different arena. Same willpower.',
        failureNarrative: 'Mile 22. Your legs stopped working. You walked the last 4 miles. Finished in 4:45. But you FINISHED. The medal around your neck felt heavier than any championship ring.' },
    ],
  },
  crossfit: {
    name: 'CrossFit',
    description: 'Constantly varied functional fitness. The community becomes family.',
    keyAttributes: ['power', 'speed', 'stamina'],
    progression: ['Member', 'Regular', 'Competitor', 'Regional Qualifier', 'Masters Division'],
    baseSkillFromBaseball: (a) => Math.round((a.power ?? 50) * 0.3 + (a.speed ?? 50) * 0.3 + 20),
    moments: [
      { sportId: 'crossfit', title: 'Local Competition', description: 'You signed up for the Masters division. You\'re the only former MLB player.',
        successNarrative: 'You podiumed. Third place in Masters 40+. The guy who won was a former Marine. The guy in second was a firefighter. You — a baseball player who found a new way to compete. The community cheered for all three of you equally.',
        failureNarrative: 'You DNF\'d the final workout. Your shoulders gave out on the overhead squats. You sat on the floor catching your breath while everyone else finished. A 23-year-old offered you water. Humbling. But you\'ll be back.' },
    ],
  },
};

/** Create a new second sport for a player */
export function startSecondSport(sportId: SportId, baseballAttrs: Record<string, number>): SecondSport {
  const config = SPORT_CONFIGS[sportId];
  return {
    id: sportId,
    name: config.name,
    description: config.description,
    keyAttributes: config.keyAttributes,
    progression: config.progression,
    currentLevel: 0,
    skillRating: config.baseSkillFromBaseball(baseballAttrs),
    seasonsPlayed: 0,
    achievements: [],
  };
}

/** Advance a season in the second sport */
export function advanceSportSeason(sport: SecondSport, trainingHours: number, rng: () => number = Math.random): {
  skillDelta: number; leveledUp: boolean; moment?: SportMoment;
} {
  sport.seasonsPlayed++;
  const skillGain = Math.round(trainingHours * 0.1 + rng() * 3);
  sport.skillRating = Math.min(100, sport.skillRating + skillGain);

  // Check for level up
  let leveledUp = false;
  const levelThreshold = (sport.currentLevel + 1) * 15 + 30; // 45, 60, 75, 90
  if (sport.skillRating >= levelThreshold && sport.currentLevel < sport.progression.length - 1) {
    sport.currentLevel++;
    leveledUp = true;
    sport.achievements.push(`Reached ${sport.progression[sport.currentLevel]}`);
  }

  // Chance of Big Game Moment
  const config = SPORT_CONFIGS[sport.id];
  let moment: SportMoment | undefined;
  if (config.moments.length > 0 && rng() < 0.4) {
    moment = config.moments[Math.floor(rng() * config.moments.length)];
  }

  return { skillDelta: skillGain, leveledUp, moment };
}

/** Get all available sports */
export function getAvailableSports(): { id: SportId; name: string; description: string; keyAttributes: string[] }[] {
  return Object.entries(SPORT_CONFIGS).map(([id, config]) => ({
    id: id as SportId,
    name: config.name,
    description: config.description,
    keyAttributes: config.keyAttributes,
  }));
}

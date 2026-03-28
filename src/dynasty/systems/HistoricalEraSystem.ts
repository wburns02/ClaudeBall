/**
 * Historical Era System — start your career in ANY era.
 * Rules, culture, money, media, and social landscape change everything.
 * 9 eras from Dead Ball (1900) to Future (2030+).
 */

export type EraId =
  | 'dead_ball'
  | 'golden_age'
  | 'integration'
  | 'expansion'
  | 'free_agency'
  | 'steroid'
  | 'analytics'
  | 'modern'
  | 'future';

export interface HistoricalEra {
  id: EraId;
  name: string;
  startYear: number;
  endYear: number;
  description: string;
  definingFeatures: string[];
  leagueMinSalary: number;             // In thousands
  averageSalary: number;               // In thousands
  topSalary: number;                   // In thousands (max contract)
  mediaFormat: 'newspaper' | 'radio' | 'tv' | 'cable' | 'internet' | 'social_media';
  travelMode: 'train' | 'propeller' | 'jet' | 'charter';
  pedLandscape: PEDLandscape;
  socialClimate: SocialClimate;
  gameRules: GameRuleModifiers;
  culturalEvents: CulturalEvent[];     // Era-specific world events
  uniqueDecisions: EraDecision[];      // Decisions only available in this era
}

export interface PEDLandscape {
  prevalence: number;          // 0-100, how common PEDs are
  testingFrequency: number;    // 0-100, how often testing occurs
  substanceType: string;       // What's available
  penaltyIfCaught: string;     // What happens
  culturalAttitude: string;    // How society views it
}

export interface SocialClimate {
  segregation: boolean;
  integrationLevel: number;    // 0-100
  womenInBaseball: string;     // Status of women in the sport
  internationalAccess: number; // 0-100, how global the talent pool is
  fanCulture: string;          // Description of fan behavior
  mediaScrutiny: number;       // 0-100, how much media watches players
}

export interface GameRuleModifiers {
  dhRule: boolean;
  pitchClock: boolean;
  shiftRestrictions: boolean;
  replayReview: boolean;
  seasonLength: number;        // Games per season
  playoffTeams: number;
  ballJuiciness: number;       // -10 to +10 (affects HR rate)
  moundHeight: number;         // inches, affects pitching dominance
  specialRules: string[];      // Any unique rules
}

export interface CulturalEvent {
  year: number;
  title: string;
  description: string;
  effect: string;              // How it affects gameplay
}

export interface EraDecision {
  id: string;
  title: string;
  description: string;
  choices: { label: string; effects: string[] }[];
  minAge?: number;
  maxAge?: number;
}

const ERA_CONFIGS: Record<EraId, HistoricalEra> = {
  dead_ball: {
    id: 'dead_ball',
    name: 'Dead Ball Era',
    startYear: 1900,
    endYear: 1919,
    description: 'Low scoring, small ball, and the beginnings of professional baseball. The ball is dead, bunting is king, and baseball is America\'s pastime.',
    definingFeatures: ['Low scoring games', 'Small ball strategy', 'Segregation', 'WWI service'],
    leagueMinSalary: 1, // $1,000
    averageSalary: 3,
    topSalary: 12,
    mediaFormat: 'newspaper',
    travelMode: 'train',
    pedLandscape: {
      prevalence: 5, testingFrequency: 0, substanceType: 'Cocaine tonics',
      penaltyIfCaught: 'Social stigma only', culturalAttitude: 'Largely ignored',
    },
    socialClimate: {
      segregation: true, integrationLevel: 0, womenInBaseball: 'Spectators only',
      internationalAccess: 5, fanCulture: 'Gentlemanly crowds, straw hats, standing room',
      mediaScrutiny: 10,
    },
    gameRules: {
      dhRule: false, pitchClock: false, shiftRestrictions: false, replayReview: false,
      seasonLength: 154, playoffTeams: 2, ballJuiciness: -8, moundHeight: 15,
      specialRules: ['Spitball legal', 'Foul balls don\'t count as strikes after 2'],
    },
    culturalEvents: [
      { year: 1903, title: 'First World Series', description: 'Boston vs Pittsburgh in the first modern World Series.', effect: 'Increased national interest' },
      { year: 1914, title: 'World War I Begins', description: 'War in Europe. Some players enlist.', effect: 'Players may be drafted for military service' },
      { year: 1919, title: 'Black Sox Scandal', description: 'Eight White Sox players accused of throwing the World Series.', effect: 'Gambling decision events become available' },
    ],
    uniqueDecisions: [
      { id: 'dead_ball_gambling', title: 'The Fix Is In', description: 'A gambler approaches you before a big game.', choices: [
        { label: 'Report him to the authorities', effects: ['reputation +10', 'lose potential payout'] },
        { label: 'Play along for the money', effects: ['earn $5,000', 'risk permanent ban'] },
        { label: 'Ignore it', effects: ['no effect, but guilt lingers'] },
      ]},
    ],
  },
  golden_age: {
    id: 'golden_age',
    name: 'Golden Age',
    startYear: 1920,
    endYear: 1945,
    description: 'Babe Ruth changes everything. Home runs, larger-than-life personalities, and the looming shadow of WWII.',
    definingFeatures: ['Babe Ruth revolution', 'Home run era begins', 'WWII service', 'Negro Leagues flourish'],
    leagueMinSalary: 3,
    averageSalary: 7,
    topSalary: 80, // Ruth made $80K
    mediaFormat: 'radio',
    travelMode: 'train',
    pedLandscape: {
      prevalence: 10, testingFrequency: 0, substanceType: 'Amphetamines (greenies)',
      penaltyIfCaught: 'None', culturalAttitude: 'Nobody cares',
    },
    socialClimate: {
      segregation: true, integrationLevel: 0, womenInBaseball: 'AAGPBL during WWII',
      internationalAccess: 10, fanCulture: 'Radio fans, barnstorming tours, hero worship',
      mediaScrutiny: 20,
    },
    gameRules: {
      dhRule: false, pitchClock: false, shiftRestrictions: false, replayReview: false,
      seasonLength: 154, playoffTeams: 2, ballJuiciness: 2, moundHeight: 15,
      specialRules: ['Spitball banned (1920)', 'Livelier ball introduced'],
    },
    culturalEvents: [
      { year: 1927, title: 'Ruth Hits 60', description: 'Babe Ruth hits 60 home runs. The record that may never be broken.', effect: 'Home run culture intensifies' },
      { year: 1941, title: 'Pearl Harbor', description: 'America enters WWII. Players enlist en masse.', effect: 'Military service decision' },
      { year: 1944, title: 'War-Depleted Rosters', description: 'With stars overseas, rosters are thin.', effect: 'Easier path to the majors but weaker competition' },
    ],
    uniqueDecisions: [
      { id: 'wwii_service', title: 'Your Country Calls', description: 'WWII rages. Will you enlist or stay to play?', choices: [
        { label: 'Enlist immediately', effects: ['miss 2-4 seasons', 'reputation +20', 'possible injury'] },
        { label: 'Wait for the draft', effects: ['play until called', 'reputation neutral'] },
        { label: 'Seek deferment', effects: ['keep playing', 'reputation -15', 'public backlash'] },
      ], minAge: 18, maxAge: 40 },
    ],
  },
  integration: {
    id: 'integration',
    name: 'Integration Era',
    startYear: 1946,
    endYear: 1960,
    description: 'Jackie Robinson breaks the color barrier. The Negro League talent floods in. Cold War America watches.',
    definingFeatures: ['Jackie Robinson', 'Negro League integration', 'Cold War', 'Suburban expansion'],
    leagueMinSalary: 5,
    averageSalary: 12,
    topSalary: 100,
    mediaFormat: 'tv',
    travelMode: 'propeller',
    pedLandscape: {
      prevalence: 30, testingFrequency: 0, substanceType: 'Amphetamines widely used',
      penaltyIfCaught: 'None', culturalAttitude: 'Part of the game',
    },
    socialClimate: {
      segregation: false, integrationLevel: 30, womenInBaseball: 'AAGPBL folds (1954)',
      internationalAccess: 20, fanCulture: 'Television brings the game home, suburban boom',
      mediaScrutiny: 30,
    },
    gameRules: {
      dhRule: false, pitchClock: false, shiftRestrictions: false, replayReview: false,
      seasonLength: 154, playoffTeams: 2, ballJuiciness: 0, moundHeight: 15,
      specialRules: ['Integration begins (1947)', 'Relocation era (Dodgers/Giants move west)'],
    },
    culturalEvents: [
      { year: 1947, title: 'Jackie Robinson Debuts', description: 'The color barrier is broken. Everything changes.', effect: 'Integration events become available' },
      { year: 1951, title: 'Shot Heard Round the World', description: 'Bobby Thomson\'s home run. The most famous moment in baseball history.', effect: 'Dramatic moments have higher stakes' },
      { year: 1958, title: 'Dodgers and Giants Move West', description: 'New York loses two teams. California gets baseball.', effect: 'Relocation events available' },
    ],
    uniqueDecisions: [
      { id: 'integration_stand', title: 'Taking a Stand', description: 'A Black teammate faces abuse from opponents. The crowd is hostile.', choices: [
        { label: 'Stand beside him publicly', effects: ['relationship +20 with teammate', 'some fans turn on you', 'reputation +15 long-term'] },
        { label: 'Say nothing', effects: ['no immediate effect', 'guilt accumulates', 'missed opportunity for leadership'] },
        { label: 'Speak to the press about it', effects: ['media firestorm', 'reputation +10 or -10 depending on era'] },
      ]},
    ],
  },
  expansion: {
    id: 'expansion',
    name: 'Expansion Era',
    startYear: 1961,
    endYear: 1975,
    description: 'New teams, dominant pitching, counterculture, and Vietnam. The game grows while America changes.',
    definingFeatures: ['Expansion teams', 'Dominant pitching', 'Counterculture', 'Vietnam War'],
    leagueMinSalary: 7,
    averageSalary: 25,
    topSalary: 200,
    mediaFormat: 'tv',
    travelMode: 'jet',
    pedLandscape: {
      prevalence: 40, testingFrequency: 0, substanceType: 'Amphetamines standard, some steroids appear',
      penaltyIfCaught: 'None officially', culturalAttitude: 'Greenies are normal, steroids are fringe',
    },
    socialClimate: {
      segregation: false, integrationLevel: 60, womenInBaseball: 'Wives and families visible',
      internationalAccess: 30, fanCulture: 'Counterculture meets tradition, growing Latino fanbase',
      mediaScrutiny: 40,
    },
    gameRules: {
      dhRule: false, pitchClock: false, shiftRestrictions: false, replayReview: false,
      seasonLength: 162, playoffTeams: 4, ballJuiciness: -3, moundHeight: 15,
      specialRules: ['Mound lowered (1969)', 'DH introduced AL only (1973)', 'Free agency coming'],
    },
    culturalEvents: [
      { year: 1961, title: 'Maris Chases Ruth', description: '61 home runs. The asterisk debate.', effect: 'Record chases carry extra narrative weight' },
      { year: 1968, title: 'Year of the Pitcher', description: 'Bob Gibson\'s 1.12 ERA. Batting averages plummet.', effect: 'Pitchers dominate' },
      { year: 1969, title: 'Miracle Mets', description: 'The impossible happens.', effect: 'Underdog narratives amplified' },
    ],
    uniqueDecisions: [
      { id: 'vietnam_draft', title: 'Vietnam Draft', description: 'Your draft number is called.', choices: [
        { label: 'Serve honorably', effects: ['miss 1-2 seasons', 'reputation +10', 'possible PTSD events'] },
        { label: 'Join the National Guard', effects: ['limited impact on career', 'public debate'] },
        { label: 'Seek exemption', effects: ['keep playing', 'public backlash varies by era'] },
      ], minAge: 18, maxAge: 26 },
    ],
  },
  free_agency: {
    id: 'free_agency',
    name: 'Free Agency Era',
    startYear: 1976,
    endYear: 1990,
    description: 'Money changes everything. The cocaine crisis. Labor wars. The business of baseball.',
    definingFeatures: ['Free agency revolution', 'Cocaine crisis', 'Labor strikes', 'Big money contracts'],
    leagueMinSalary: 20,
    averageSalary: 300,
    topSalary: 3000,
    mediaFormat: 'cable',
    travelMode: 'charter',
    pedLandscape: {
      prevalence: 50, testingFrequency: 5, substanceType: 'Cocaine epidemic, amphetamines, early steroids',
      penaltyIfCaught: 'Suspension, rehab', culturalAttitude: 'Cocaine is the crisis, steroids are invisible',
    },
    socialClimate: {
      segregation: false, integrationLevel: 80, womenInBaseball: 'First women sportswriters in locker rooms',
      internationalAccess: 40, fanCulture: 'Cable TV explosion, growing commercialism',
      mediaScrutiny: 55,
    },
    gameRules: {
      dhRule: true, pitchClock: false, shiftRestrictions: false, replayReview: false,
      seasonLength: 162, playoffTeams: 4, ballJuiciness: 0, moundHeight: 10,
      specialRules: ['Free agency established', 'Collusion scandals', 'Strikes (1981, 1985)'],
    },
    culturalEvents: [
      { year: 1981, title: 'Players Strike', description: '50 games lost. The first modern strike.', effect: 'Union decision events' },
      { year: 1985, title: 'Pittsburgh Drug Trials', description: 'Cocaine use in baseball exposed publicly.', effect: 'Drug temptation events more common' },
      { year: 1989, title: 'Pete Rose Banned', description: 'Lifetime ban for gambling.', effect: 'Gambling decisions carry permanent consequences' },
    ],
    uniqueDecisions: [
      { id: 'cocaine_pressure', title: 'The Party Scene', description: 'After a big win, teammates invite you out. The cocaine is everywhere.', choices: [
        { label: 'Join the party', effects: ['short-term energy boost', 'addiction risk', 'relationships form'] },
        { label: 'Decline politely', effects: ['some teammates distance', 'clean record'] },
        { label: 'Report what you saw', effects: ['teammates ostracize you', 'reputation +5 with management'] },
      ]},
    ],
  },
  steroid: {
    id: 'steroid',
    name: 'Steroid Era',
    startYear: 1991,
    endYear: 2005,
    description: 'Home run explosion. PEDs everywhere. "Everybody knew." The most controversial era in baseball history.',
    definingFeatures: ['Home run explosion', 'PEDs everywhere', '1994 strike cancels World Series', 'Sosa/McGwire race'],
    leagueMinSalary: 109,
    averageSalary: 2500,
    topSalary: 25000,
    mediaFormat: 'internet',
    travelMode: 'charter',
    pedLandscape: {
      prevalence: 80, testingFrequency: 10, substanceType: 'Anabolic steroids, HGH, designer substances',
      penaltyIfCaught: 'Nothing until 2003 testing begins', culturalAttitude: '"Everybody\'s doing it"',
    },
    socialClimate: {
      segregation: false, integrationLevel: 90, womenInBaseball: 'Women reporters normalized',
      internationalAccess: 70, fanCulture: 'Home run chase mania, internet fan culture begins',
      mediaScrutiny: 65,
    },
    gameRules: {
      dhRule: true, pitchClock: false, shiftRestrictions: false, replayReview: false,
      seasonLength: 162, playoffTeams: 8, ballJuiciness: 5, moundHeight: 10,
      specialRules: ['1994 strike cancels World Series', 'Wild card introduced (1995)', 'Interleague play (1997)'],
    },
    culturalEvents: [
      { year: 1994, title: 'The Strike', description: 'No World Series. Fans are furious.', effect: 'Fan trust at all-time low' },
      { year: 1998, title: 'McGwire/Sosa HR Race', description: '70 home runs! The game is "saved."', effect: 'Home run culture at its peak' },
      { year: 2003, title: 'Testing Begins', description: 'Anonymous testing reveals widespread PED use.', effect: 'PED decisions become much riskier' },
    ],
    uniqueDecisions: [
      { id: 'steroid_pressure', title: 'The Needle', description: 'Your trainer pulls you aside. "Everyone else is doing it. You\'re falling behind."', choices: [
        { label: 'Use PEDs', effects: ['power +15, speed +5', 'risk of testing positive after 2003', 'Hall of Fame at risk'] },
        { label: 'Stay clean', effects: ['harder to compete', 'clear conscience', 'legacy intact'] },
        { label: 'Try "supplements" (grey area)', effects: ['minor boost +5', 'plausible deniability', 'still risky'] },
      ]},
    ],
  },
  analytics: {
    id: 'analytics',
    name: 'Analytics Revolution',
    startYear: 2006,
    endYear: 2020,
    description: 'Moneyball changes front offices. Shifts, launch angle, and social media emerge. Data is king.',
    definingFeatures: ['Moneyball revolution', 'Defensive shifts', 'Launch angle', 'Social media era'],
    leagueMinSalary: 400,
    averageSalary: 4000,
    topSalary: 35000,
    mediaFormat: 'social_media',
    travelMode: 'charter',
    pedLandscape: {
      prevalence: 30, testingFrequency: 80, substanceType: 'HGH, peptides, designer substances',
      penaltyIfCaught: '80 game suspension first offense, lifetime third', culturalAttitude: 'Zero tolerance publicly',
    },
    socialClimate: {
      segregation: false, integrationLevel: 95, womenInBaseball: 'First women coaches, front office leaders',
      internationalAccess: 85, fanCulture: 'Social media debates, advanced stats culture, streaming',
      mediaScrutiny: 85,
    },
    gameRules: {
      dhRule: true, pitchClock: false, shiftRestrictions: false, replayReview: true,
      seasonLength: 162, playoffTeams: 10, ballJuiciness: 2, moundHeight: 10,
      specialRules: ['Replay review (2014)', 'Qualifying offer system', 'Second wild card (2012)'],
    },
    culturalEvents: [
      { year: 2011, title: 'Moneyball Movie', description: 'Analytics goes mainstream. Every front office hires data scientists.', effect: 'Analytics-driven decisions valued more' },
      { year: 2017, title: 'Astros Sign-Stealing', description: 'Technology-aided cheating exposed.', effect: 'Cheating decision events available' },
      { year: 2020, title: 'COVID Season', description: '60-game season. Empty stadiums. Uncertainty.', effect: 'Shortened season, health events' },
    ],
    uniqueDecisions: [
      { id: 'analytics_adapt', title: 'The Data Says...', description: 'The analytics department wants you to change your approach.', choices: [
        { label: 'Embrace the data', effects: ['new skills develop', 'might lose what made you special'] },
        { label: 'Trust your instincts', effects: ['might miss optimization', 'authenticity preserved'] },
        { label: 'Find a balance', effects: ['moderate improvement', 'respected by both sides'] },
      ]},
    ],
  },
  modern: {
    id: 'modern',
    name: 'Modern Era',
    startYear: 2021,
    endYear: 2029,
    description: 'Universal DH, pitch clock, NIL deals, and the global expansion of baseball.',
    definingFeatures: ['Universal DH', 'Pitch clock', 'NIL in college', 'International expansion'],
    leagueMinSalary: 740,
    averageSalary: 5000,
    topSalary: 50000,
    mediaFormat: 'social_media',
    travelMode: 'charter',
    pedLandscape: {
      prevalence: 20, testingFrequency: 90, substanceType: 'Gene therapy, peptides, stem cells',
      penaltyIfCaught: '80 game suspension, lifetime third offense', culturalAttitude: 'Career-ending stigma',
    },
    socialClimate: {
      segregation: false, integrationLevel: 98, womenInBaseball: 'Women managers and GMs emerging',
      internationalAccess: 95, fanCulture: 'Short attention spans, highlights culture, betting integration',
      mediaScrutiny: 95,
    },
    gameRules: {
      dhRule: true, pitchClock: true, shiftRestrictions: true, replayReview: true,
      seasonLength: 162, playoffTeams: 12, ballJuiciness: 0, moundHeight: 10,
      specialRules: ['Pitch clock (2023)', 'Shift restrictions (2023)', 'Bigger bases (2023)', 'Ghost runner in extras'],
    },
    culturalEvents: [
      { year: 2023, title: 'Rule Changes', description: 'Pitch clock, shift ban, bigger bases. The game speeds up.', effect: 'Pace of play events' },
      { year: 2025, title: 'Shohei Effect', description: 'International stars reshape the game\'s global appeal.', effect: 'International opportunities expand' },
    ],
    uniqueDecisions: [
      { id: 'nil_deal', title: 'NIL Opportunity', description: 'A major brand wants you for a college NIL deal worth $500K.', choices: [
        { label: 'Take the money', effects: ['$500K income', 'some see you as mercenary'] },
        { label: 'Decline — focus on baseball', effects: ['respected by scouts', 'broke in college'] },
        { label: 'Negotiate for more', effects: ['might get $1M', 'might lose the deal'] },
      ], minAge: 18, maxAge: 22 },
    ],
  },
  future: {
    id: 'future',
    name: 'Future Era',
    startYear: 2030,
    endYear: 2099,
    description: 'AI scouting, robot umpires, expansion to 32+ teams, and the global league.',
    definingFeatures: ['AI scouting', 'Robot umpires', 'Global expansion', 'Gene therapy debates'],
    leagueMinSalary: 1200,
    averageSalary: 8000,
    topSalary: 80000,
    mediaFormat: 'social_media',
    travelMode: 'charter',
    pedLandscape: {
      prevalence: 15, testingFrequency: 95, substanceType: 'Gene therapy, neural enhancement, bio-optimization',
      penaltyIfCaught: 'Lifetime ban', culturalAttitude: 'Philosophical debate: what counts as enhancement?',
    },
    socialClimate: {
      segregation: false, integrationLevel: 100, womenInBaseball: 'Women play in MLB',
      internationalAccess: 100, fanCulture: 'Holographic replays, AR experience, global streaming',
      mediaScrutiny: 100,
    },
    gameRules: {
      dhRule: true, pitchClock: true, shiftRestrictions: true, replayReview: true,
      seasonLength: 162, playoffTeams: 14, ballJuiciness: 0, moundHeight: 10,
      specialRules: ['Robot umpires', 'Global draft', 'London/Tokyo/Mexico City franchises', 'AI coaching assistants'],
    },
    culturalEvents: [
      { year: 2032, title: 'Robot Umpires', description: 'Automated strike zone. The human element debate.', effect: 'Perfect strike zone, no more ump shows' },
      { year: 2035, title: 'Global Expansion', description: 'MLB expands to 36 teams including international cities.', effect: 'More roster spots, international events' },
      { year: 2040, title: 'Gene Therapy Debate', description: 'Can you edit your DNA to be a better athlete? The ethics are unclear.', effect: 'Enhancement decisions more complex' },
    ],
    uniqueDecisions: [
      { id: 'gene_therapy', title: 'The Future of Performance', description: 'A cutting-edge clinic offers gene therapy to optimize your fast-twitch muscle fibers.', choices: [
        { label: 'Go for it — this is the future', effects: ['significant physical boost', 'ethical grey area', 'may be banned retroactively'] },
        { label: 'No — I earned everything naturally', effects: ['respected by purists', 'may fall behind'] },
        { label: 'Research it first', effects: ['delay decision', 'better informed choice later'] },
      ]},
    ],
  },
};

/** Get all eras for selection */
export function getAvailableEras(): { id: EraId; name: string; startYear: number; endYear: number; description: string; definingFeatures: string[] }[] {
  return Object.values(ERA_CONFIGS).map(e => ({
    id: e.id, name: e.name, startYear: e.startYear, endYear: e.endYear,
    description: e.description, definingFeatures: e.definingFeatures,
  }));
}

/** Get full era config */
export function getEra(id: EraId): HistoricalEra {
  return ERA_CONFIGS[id];
}

/** Determine which era a given year falls into */
export function getEraForYear(year: number): HistoricalEra {
  for (const era of Object.values(ERA_CONFIGS)) {
    if (year >= era.startYear && year <= era.endYear) return era;
  }
  return ERA_CONFIGS.modern; // Default
}

/** Get salary range for an era */
export function getEraSalaryRange(eraId: EraId): { min: number; avg: number; max: number } {
  const era = ERA_CONFIGS[eraId];
  return { min: era.leagueMinSalary, avg: era.averageSalary, max: era.topSalary };
}

/** Get era-specific decisions available for a given age */
export function getEraDecisions(eraId: EraId, playerAge: number): EraDecision[] {
  const era = ERA_CONFIGS[eraId];
  return era.uniqueDecisions.filter(d => {
    if (d.minAge && playerAge < d.minAge) return false;
    if (d.maxAge && playerAge > d.maxAge) return false;
    return true;
  });
}

/** Get cultural events happening in a specific year */
export function getCulturalEvents(eraId: EraId, year: number): CulturalEvent[] {
  const era = ERA_CONFIGS[eraId];
  return era.culturalEvents.filter(e => e.year === year);
}

/** Apply era game rule modifiers to simulation */
export function getGameRuleModifiers(eraId: EraId): GameRuleModifiers {
  return ERA_CONFIGS[eraId].gameRules;
}

/** Get PED landscape for decision context */
export function getPEDLandscape(eraId: EraId): PEDLandscape {
  return ERA_CONFIGS[eraId].pedLandscape;
}

/** Get media format description for UI */
export function getMediaDescription(eraId: EraId): string {
  const era = ERA_CONFIGS[eraId];
  const descriptions: Record<string, string> = {
    newspaper: 'News travels by newspaper. Headlines take a day. Rumors spread slowly.',
    radio: 'Radio broadcasts bring the game to millions. Voices paint the picture.',
    tv: 'Television changes everything. Now they can see your face when you fail.',
    cable: 'ESPN and 24-hour sports coverage. There\'s no escape from the spotlight.',
    internet: 'The internet never forgets. Blogs, forums, and early social media watch every move.',
    social_media: 'Social media amplifies everything instantly. One bad tweet can end a career.',
  };
  return descriptions[era.mediaFormat] ?? 'The media is always watching.';
}

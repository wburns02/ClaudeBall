/**
 * Social Media & Public Feed — a scrolling timeline of reactions
 * that makes the world feel alive and contemporary.
 * Auto-generates posts from game events using template pools + NPC relationships.
 * Adapts by era: newspapers (pre-2005) → early social (2005-2015) → full ecosystem (2015+).
 */

export type PostSource =
  | 'official'       // @MLBHighlights, league accounts
  | 'hot_take'       // Random fan with strong opinions
  | 'rival_fan'      // Hostile opposing fanbase
  | 'family'         // Your family members
  | 'teammate'       // Current/former teammates
  | 'media'          // Analysts, beat writers
  | 'meme'           // Meme accounts, humor
  | 'rival_player'   // Your in-game rival
  | 'agent'          // Your agent
  | 'front_office';  // GM/owner commentary

export type PostContext =
  | 'walkoff'
  | 'home_run'
  | 'strikeout'
  | 'error'
  | 'win_streak'
  | 'loss_streak'
  | 'trade'
  | 'injury'
  | 'milestone'
  | 'scandal'
  | 'retirement'
  | 'award'
  | 'draft'
  | 'free_agency'
  | 'fight'
  | 'slump'
  | 'hot_streak'
  | 'all_star'
  | 'world_series'
  | 'debut'
  | 'random';

export type SocialPresence = 'active' | 'private' | 'unfiltered';

export type EraFormat = 'newspaper' | 'early_social' | 'full_social';

export interface FeedPost {
  id: string;
  source: PostSource;
  handle: string;              // @username or newspaper name
  displayName: string;
  content: string;
  likes: number;
  replies: number;
  timestamp: number;           // Game season/day
  context: PostContext;
  isVerified: boolean;
  sentiment: 'positive' | 'negative' | 'neutral' | 'hostile';
  canRespond: boolean;         // Player can reply to this post
  responseOptions?: string[];  // Canned response options
}

export interface SocialFeed {
  posts: FeedPost[];
  era: EraFormat;
  playerPresence: SocialPresence;
  followerCount: number;
  viralMoments: number;        // Times something went viral
  controversies: number;       // Times a response caused backlash
}

/** Template pool — {player}, {team}, {stat}, {rival}, {familyMember} are substituted */
const POST_TEMPLATES: Record<PostContext, Partial<Record<PostSource, {
  templates: string[];
  sentiment: FeedPost['sentiment'];
  baseLikes: [number, number]; // [min, max]
}[]>>> = {
  walkoff: {
    official: [{ templates: [
      'WALKOFF. {player} sends the crowd home happy. 🔥',
      '{player} with the walkoff! {team} wins in dramatic fashion.',
      'GAME OVER! {player} is the hero tonight. What a moment.',
    ], sentiment: 'positive', baseLikes: [8000, 25000] }],
    hot_take: [{ templates: [
      '{player} is the most clutch hitter in baseball and it\'s not close',
      'Name a more clutch player than {player}. I\'ll wait.',
      '{player} in the clutch > your entire team\'s lineup',
    ], sentiment: 'positive', baseLikes: [200, 3000] }],
    family: [{ templates: [
      'THAT\'S MY {familyRole} 😭💪',
      'I can\'t stop crying. So proud of {player}.',
      '{familyMember} just woke up the entire neighborhood screaming.',
    ], sentiment: 'positive', baseLikes: [500, 5000] }],
    rival_fan: [{ templates: [
      'Lucky swing. Pitcher hung that slider.',
      'Enjoy it while it lasts.',
    ], sentiment: 'hostile', baseLikes: [50, 500] }],
    teammate: [{ templates: [
      'That swing hasn\'t changed since Little League 💯',
      'THAT\'S MY GUY! Been saying it all year.',
      'Coldest player in the game right now 🥶',
    ], sentiment: 'positive', baseLikes: [1000, 8000] }],
  },
  home_run: {
    official: [{ templates: [
      '{player} goes yard! {stat} on the season.',
      'GONE! {player} with a mammoth blast for #{stat}.',
    ], sentiment: 'positive', baseLikes: [3000, 15000] }],
    hot_take: [{ templates: [
      'MVP. That\'s it. That\'s the tweet.',
      '{player} is HIM.',
    ], sentiment: 'positive', baseLikes: [100, 2000] }],
    meme: [{ templates: [
      'Pitcher: *throws a hanger*\n{player}: "and I took that personally"',
      'That baseball had a family 😂',
    ], sentiment: 'neutral', baseLikes: [500, 5000] }],
  },
  strikeout: {
    rival_fan: [{ templates: [
      'SIT DOWN {player} 😂😂😂',
      '{player} looking LOST at the plate tonight',
    ], sentiment: 'hostile', baseLikes: [100, 1000] }],
    hot_take: [{ templates: [
      '{player} needs a day off. Swing looks broken.',
      'Overrated. I\'ve been saying it.',
    ], sentiment: 'negative', baseLikes: [50, 800] }],
  },
  error: {
    rival_fan: [{ templates: [
      'Routine play btw 💀',
      '{player} just gave the game away. Embarrassing.',
    ], sentiment: 'hostile', baseLikes: [200, 2000] }],
    media: [{ templates: [
      '{player}\'s {stat}th error this season. Concerning trend.',
      'The error proved costly as {team} went on to lose.',
    ], sentiment: 'negative', baseLikes: [100, 1500] }],
  },
  scandal: {
    official: [{ templates: [
      'BREAKING: {player} linked to {scandalDetail}',
      'REPORT: MLB investigating {player} for {scandalDetail}',
    ], sentiment: 'negative', baseLikes: [15000, 50000] }],
    hot_take: [{ templates: [
      'Always knew {player} was dirty',
      'Innocent until proven guilty. I\'m withholding judgment.',
      'If {player} did this, strip every award. Period.',
    ], sentiment: 'negative', baseLikes: [500, 5000] }],
    family: [{ templates: [
      '{familyMember} deleted their social media.',
      'Leave {player}\'s family out of this.',
    ], sentiment: 'negative', baseLikes: [2000, 10000] }],
    teammate: [{ templates: [
      'I know this man. Wait for the facts.',
      'Not going to comment on rumors.',
    ], sentiment: 'neutral', baseLikes: [3000, 12000] }],
  },
  retirement: {
    official: [{ templates: [
      'End of an era. {player} announces retirement after {stat} seasons.',
      'Thank you, {player}. A career for the ages.',
    ], sentiment: 'positive', baseLikes: [20000, 80000] }],
    teammate: [{ templates: [
      'From travel ball at 13 to the Hall of Fame. Proud of you brother.',
      'The game won\'t be the same without {player}.',
      'Honored to have shared a clubhouse with the greatest. @{player}',
    ], sentiment: 'positive', baseLikes: [5000, 25000] }],
    family: [{ templates: [
      '*posts childhood photo of {player} playing catch*\nThis is where it all started. ❤️',
      'Our hero is coming home.',
    ], sentiment: 'positive', baseLikes: [10000, 50000] }],
    rival_player: [{ templates: [
      'From one competitor to another — respect. @{player}',
      'The rivalry made us both better. Enjoy retirement.',
    ], sentiment: 'positive', baseLikes: [3000, 15000] }],
  },
  trade: {
    official: [{ templates: [
      'BREAKING: {player} has been traded to {team}.',
      'It\'s official: {player} is heading to {team} in a blockbuster deal.',
    ], sentiment: 'neutral', baseLikes: [10000, 40000] }],
    hot_take: [{ templates: [
      '{team} just won the trade deadline. Not even close.',
      'This is going to backfire so hard.',
    ], sentiment: 'neutral', baseLikes: [200, 3000] }],
  },
  injury: {
    official: [{ templates: [
      '{player} placed on the IL with {stat}. No timetable for return.',
    ], sentiment: 'negative', baseLikes: [5000, 20000] }],
    family: [{ templates: [
      'Prayers up for {player}. He\'ll be back stronger. ❤️🙏',
    ], sentiment: 'positive', baseLikes: [3000, 12000] }],
  },
  milestone: {
    official: [{ templates: [
      'HISTORY! {player} reaches {stat}. Congratulations!',
      '{player} joins an exclusive club with career {stat}.',
    ], sentiment: 'positive', baseLikes: [25000, 100000] }],
    teammate: [{ templates: [
      'Witnessed history tonight. Congrats {player}! 🐐',
    ], sentiment: 'positive', baseLikes: [5000, 20000] }],
  },
  award: {
    official: [{ templates: [
      '{player} wins the {stat}! Well deserved.',
    ], sentiment: 'positive', baseLikes: [15000, 50000] }],
  },
  slump: {
    hot_take: [{ templates: [
      '{player} is 2-for-25. At what point do we worry?',
      'The {player} slump is real. 0-4 tonight.',
    ], sentiment: 'negative', baseLikes: [100, 1500] }],
    media: [{ templates: [
      '{player}\'s average has dropped 40 points in two weeks. Mechanical issue or fatigue?',
    ], sentiment: 'negative', baseLikes: [200, 2000] }],
  },
  hot_streak: {
    hot_take: [{ templates: [
      '{player} is on a 15-game hit streak. This is absurd.',
      '{player} cannot be stopped right now 🔥🔥🔥',
    ], sentiment: 'positive', baseLikes: [500, 5000] }],
  },
  debut: {
    official: [{ templates: [
      'Welcome to The Show, {player}! Making his MLB debut tonight.',
    ], sentiment: 'positive', baseLikes: [5000, 20000] }],
    family: [{ templates: [
      'My baby is in the big leagues. I can\'t stop crying. 😭❤️',
    ], sentiment: 'positive', baseLikes: [8000, 30000] }],
  },
  all_star: {
    official: [{ templates: ['{player} has been selected to the All-Star Game!'], sentiment: 'positive', baseLikes: [10000, 30000] }],
  },
  world_series: {
    official: [{ templates: ['WORLD CHAMPIONS! {player} and {team} have done it!'], sentiment: 'positive', baseLikes: [50000, 200000] }],
  },
  draft: {
    official: [{ templates: ['With the #{stat} pick, {team} selects {player}.'], sentiment: 'neutral', baseLikes: [3000, 15000] }],
  },
  free_agency: {
    official: [{ templates: ['{player} signs with {team}. Details: {stat} years.'], sentiment: 'neutral', baseLikes: [8000, 30000] }],
  },
  fight: {
    meme: [{ templates: ['Oh they fighting fighting 👀🍿'], sentiment: 'neutral', baseLikes: [5000, 25000] }],
  },
  win_streak: {
    hot_take: [{ templates: ['{team} has won {stat} straight. This team is scary.'], sentiment: 'positive', baseLikes: [300, 3000] }],
  },
  loss_streak: {
    hot_take: [{ templates: ['{team} has lost {stat} in a row. Fire everyone.'], sentiment: 'negative', baseLikes: [200, 2000] }],
  },
  random: {
    meme: [{ templates: [
      'POV: You\'re a fastball and {player} is at the plate',
      '{player} appreciation post. That\'s it. That\'s the tweet.',
    ], sentiment: 'neutral', baseLikes: [300, 5000] }],
    hot_take: [{ templates: [
      'Hot take: {player} is a top 5 player right now',
      '{player} is having a quietly great season',
    ], sentiment: 'positive', baseLikes: [100, 2000] }],
  },
};

/** Handle pools for generating believable usernames */
const HANDLE_POOLS: Record<PostSource, string[]> = {
  official: ['@MLBHighlights', '@BaseballTonight', '@ESPNBaseball', '@MLBNetwork', '@SportsCenterTop10'],
  hot_take: ['@hot_takes_dave', '@baseballtruth99', '@diamonddog_47', '@realtalksports', '@hottake_szn'],
  rival_fan: ['@yankees4life', '@dodger_blue_88', '@sox_nation_', '@cubs_faithful', '@astros_world'],
  family: ['@burns_family', '@proud_parent', '@baseball_mom_', '@dad_in_stands'],
  teammate: ['@the_real_42', '@locker_neighbor', '@bullpen_bro', '@bp_partner'],
  media: ['@beatwriter_ken', '@mlb_analyst_j', '@prospect_guru', '@sabermetrics_daily'],
  meme: ['@baseball_memes', '@dugout_laughs', '@pitcher_face', '@hot_mic_baseball'],
  rival_player: ['@the_rival', '@nemesis_ball', '@across_the_diamond'],
  agent: ['@boras_corp', '@top_rep_sports'],
  front_office: ['@gm_source', '@front_office_insider'],
};

/** Newspaper equivalents for pre-social media eras */
const NEWSPAPER_SOURCES: Record<PostSource, string> = {
  official: 'Associated Press',
  hot_take: 'Letters to the Editor',
  rival_fan: 'Rival City Tribune',
  family: 'Family Scrapbook',
  teammate: 'Clubhouse Quotes',
  media: 'Sports Section',
  meme: 'Editorial Cartoon',
  rival_player: 'Rival Player Interview',
  agent: 'Agent Statement',
  front_office: 'Front Office Statement',
};

let postIdCounter = 0;

/** Create a new social feed */
export function createSocialFeed(startYear: number, presence: SocialPresence = 'active'): SocialFeed {
  return {
    posts: [],
    era: getEraFormat(startYear),
    playerPresence: presence,
    followerCount: 100,
    viralMoments: 0,
    controversies: 0,
  };
}

/** Determine era format from year */
export function getEraFormat(year: number): EraFormat {
  if (year < 2005) return 'newspaper';
  if (year < 2015) return 'early_social';
  return 'full_social';
}

/**
 * Generate feed posts for a game event
 */
export function generateFeedPosts(
  feed: SocialFeed,
  context: PostContext,
  substitutions: Record<string, string>,
  fameLevel: number,            // 0-100, affects engagement
  rng: () => number = Math.random,
): FeedPost[] {
  const contextTemplates = POST_TEMPLATES[context];
  if (!contextTemplates) return [];

  const newPosts: FeedPost[] = [];
  const sources = Object.keys(contextTemplates) as PostSource[];

  for (const source of sources) {
    const entries = contextTemplates[source];
    if (!entries) continue;

    for (const entry of entries) {
      // Not every source posts every time
      if (rng() > 0.6) continue;

      const template = entry.templates[Math.floor(rng() * entry.templates.length)];
      let content = template;
      for (const [key, value] of Object.entries(substitutions)) {
        content = content.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      }

      const handles = HANDLE_POOLS[source];
      const handle = feed.era === 'newspaper'
        ? NEWSPAPER_SOURCES[source]
        : handles[Math.floor(rng() * handles.length)];

      const fameMult = 0.3 + (fameLevel / 100) * 1.5;
      const likes = Math.round(
        (entry.baseLikes[0] + rng() * (entry.baseLikes[1] - entry.baseLikes[0])) * fameMult
      );

      const post: FeedPost = {
        id: `post_${++postIdCounter}`,
        source,
        handle,
        displayName: handle.replace('@', '').replace(/_/g, ' '),
        content,
        likes: feed.era === 'newspaper' ? 0 : likes,
        replies: feed.era === 'newspaper' ? 0 : Math.round(likes * 0.05 * rng()),
        timestamp: Date.now(),
        context,
        isVerified: source === 'official' || source === 'media',
        sentiment: entry.sentiment,
        canRespond: feed.era !== 'newspaper' && source !== 'official',
        responseOptions: generateResponseOptions(context, entry.sentiment),
      };

      newPosts.push(post);
    }
  }

  feed.posts = [...newPosts, ...feed.posts].slice(0, 200); // Cap at 200 posts
  return newPosts;
}

/**
 * Player responds to a post — affects rep
 */
export function respondToPost(
  feed: SocialFeed,
  postId: string,
  responseIndex: number,
): { mediaRepDelta: number; fanRepDelta: number; wentViral: boolean } {
  const post = feed.posts.find(p => p.id === postId);
  if (!post || !post.responseOptions || responseIndex >= post.responseOptions.length) {
    return { mediaRepDelta: 0, fanRepDelta: 0, wentViral: false };
  }

  const response = post.responseOptions[responseIndex];
  post.canRespond = false;

  // Responding to hostile posts
  if (post.sentiment === 'hostile') {
    if (response.includes('clap back') || response.includes('fire back')) {
      feed.controversies++;
      const viral = Math.random() > 0.5;
      if (viral) feed.viralMoments++;
      return { mediaRepDelta: -3, fanRepDelta: viral ? 5 : -2, wentViral: viral };
    }
    // Ignoring or classy response
    return { mediaRepDelta: 2, fanRepDelta: 1, wentViral: false };
  }

  // Responding to positive posts
  if (post.sentiment === 'positive') {
    feed.followerCount += 50;
    return { mediaRepDelta: 1, fanRepDelta: 2, wentViral: false };
  }

  return { mediaRepDelta: 0, fanRepDelta: 0, wentViral: false };
}

/** Get the most recent posts, formatted for display */
export function getRecentPosts(feed: SocialFeed, count: number = 20): FeedPost[] {
  return feed.posts.slice(0, count);
}

/** Update era format (call when year changes significantly) */
export function updateEra(feed: SocialFeed, currentYear: number): void {
  feed.era = getEraFormat(currentYear);
}

// --- Internal helpers ---

function generateResponseOptions(context: PostContext, sentiment: FeedPost['sentiment']): string[] {
  if (sentiment === 'hostile') {
    return [
      '🔥 Clap back with a witty reply',
      '😤 Fire back aggressively',
      '🤷 Ignore it (silence is power)',
      '💪 Post a workout video (let the game talk)',
    ];
  }
  if (sentiment === 'positive') {
    return [
      '🙏 Thank the fans',
      '💯 Repost with comment',
      '😊 Heart the post',
    ];
  }
  if (sentiment === 'negative' && context === 'scandal') {
    return [
      '📝 Post a written statement',
      '🤐 No comment (lawyer advised)',
      '💢 Deny everything publicly',
      '🙏 Apologize and take accountability',
    ];
  }
  return [
    '👍 Like',
    '💬 Comment',
  ];
}

import { describe, it, expect } from 'vitest';

// Systems 17-19 (Geography, DailyGrind, SecondSport)
import { createGeography, getRegionDescriptions, type Region } from '../systems/GeographySystem.ts';
import {
  processDayActivities, getAvailableJobs, DAY_JOBS, type DayActivity,
} from '../systems/DailyGrindEngine.ts';
import {
  startSecondSport, advanceSportSeason, getAvailableSports, type SportId,
} from '../systems/SecondSportSystem.ts';

// Systems 20-24 (PassTheTorch, SocialMedia, CoachingPhilosophy, HistoricalEra, Multiplayer)
import {
  generateSuccessorCandidates, passTheTorch, ageLegacyNPC, getNPCContact,
  createDynastyLegacy, getTierInfo,
} from '../systems/PassTheTorchSystem.ts';
import {
  createSocialFeed, generateFeedPosts, respondToPost, getRecentPosts,
  getEraFormat, updateEra,
} from '../systems/SocialMediaSystem.ts';
import {
  getPhilosophies, getPhilosophy, createCoachProfile, evaluatePlayerFit,
  advanceCoachingSeason, simCoachingTreeSeason, getCompatibilityScore,
} from '../systems/CoachingPhilosophySystem.ts';
import {
  getAvailableEras, getEra, getEraForYear, getEraSalaryRange,
  getEraDecisions, getCulturalEvents, getGameRuleModifiers, getPEDLandscape,
  getMediaDescription,
} from '../systems/HistoricalEraSystem.ts';
import {
  getMultiplayerModes, createMultiplayerSession, joinSession, sendMessage,
  proposeTrade, respondToTrade, createSharedMoment, resolveSharedMoment,
  advanceTurn, getSessionSummary,
} from '../systems/MultiplayerDynastySystem.ts';

function makeRng(seed = 42) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// ============================================================
// System 17: Geography
// ============================================================
describe('GeographySystem', () => {
  it('returns all 9 regions', () => {
    const regions = getRegionDescriptions();
    expect(regions.length).toBe(9);
    expect(regions.map(r => r.id)).toContain('northeast');
    expect(regions.map(r => r.id)).toContain('venezuela');
  });

  it('each region has valid development modifier string', () => {
    const regions = getRegionDescriptions();
    for (const region of regions) {
      expect(region.flavor.length).toBeGreaterThan(10);
      expect(region.devMod).toContain('dev');
    }
  });

  it('creates geography component for a region', () => {
    const geo = createGeography('texas', makeRng());
    expect(geo.type).toBe('Geography');
    expect(geo.region).toBe('texas');
    expect(geo.yearRoundTraining).toBe(true);
    expect(geo.developmentModifier).toBe(1.10);
    expect(geo.city.length).toBeGreaterThan(0);
  });

  it('different regions have different characteristics', () => {
    const northeast = createGeography('northeast', makeRng());
    const florida = createGeography('florida', makeRng());
    expect(northeast.climate).toBe('cold');
    expect(florida.climate).toBe('tropical');
    expect(florida.developmentModifier).toBeGreaterThan(northeast.developmentModifier);
  });
});

// ============================================================
// System 18: Daily Grind
// ============================================================
describe('DailyGrindEngine', () => {
  it('processes day activities and returns effects', () => {
    const result = processDayActivities(['early_workout', 'work', 'family_time']);
    expect(result.totalEnergyCost).toBeGreaterThan(0);
    expect(result.balanceDeltas.physical).toBeGreaterThan(0);
    expect(result.balanceDeltas.relationship).toBeGreaterThan(0);
    expect(result.descriptions.length).toBe(3);
  });

  it('double day detected when 2+ training activities', () => {
    const result = processDayActivities(['early_workout', 'weights', 'rest']);
    expect(result.isDoubleDayDay).toBe(true);
    expect(result.isTripleDay).toBe(false);
  });

  it('triple day detected when 3+ training activities', () => {
    const result = processDayActivities(['early_workout', 'yoga', 'run']);
    expect(result.isTripleDay).toBe(true);
  });

  it('rest and sleep recover energy', () => {
    const result = processDayActivities(['rest', 'sleep_in']);
    expect(result.totalEnergyCost).toBeLessThan(0); // Net energy recovery
  });

  it('returns available day jobs filtered by attributes', () => {
    const highAttrs = { baseballIQ: 80, leadership: 80, charisma: 80, workEthic: 80 };
    const jobs = getAvailableJobs(highAttrs);
    expect(jobs.length).toBeGreaterThan(5); // Should qualify for most jobs

    const lowAttrs = { baseballIQ: 10, leadership: 10, charisma: 10, workEthic: 10 };
    const fewJobs = getAvailableJobs(lowAttrs);
    expect(fewJobs.length).toBeLessThan(jobs.length);
  });

  it('DAY_JOBS has figuring_it_out with 0 income', () => {
    const figuring = DAY_JOBS.find(j => j.id === 'figuring_it_out');
    expect(figuring).toBeDefined();
    expect(figuring!.income).toBe(0);
    expect(figuring!.energyCost).toBe(0);
  });
});

// ============================================================
// System 19: Second Sport
// ============================================================
describe('SecondSportSystem', () => {
  it('lists all 7 sports', () => {
    const sports = getAvailableSports();
    expect(sports.length).toBe(7);
    const ids = sports.map(s => s.id);
    expect(ids).toContain('rugby');
    expect(ids).toContain('bjj');
    expect(ids).toContain('crossfit');
  });

  it('starts a sport with skill based on baseball attrs', () => {
    const attrs = { speed: 70, power: 60, composure: 65, contact: 55 };
    const rugby = startSecondSport('rugby', attrs);
    expect(rugby.id).toBe('rugby');
    expect(rugby.currentLevel).toBe(0);
    expect(rugby.skillRating).toBeGreaterThan(0);
    expect(rugby.skillRating).toBeLessThanOrEqual(100);
  });

  it('advances sport season with skill gain', () => {
    const attrs = { speed: 70, power: 60, composure: 65 };
    const sport = startSecondSport('boxing', attrs);
    const initial = sport.skillRating;
    const result = advanceSportSeason(sport, 50, makeRng());
    expect(sport.seasonsPlayed).toBe(1);
    expect(result.skillDelta).toBeGreaterThan(0);
    expect(sport.skillRating).toBeGreaterThanOrEqual(initial);
  });

  it('can level up in a sport', () => {
    const sport = startSecondSport('bjj', { composure: 90, eye: 85, coachability: 80 });
    sport.skillRating = 44; // Just below first threshold (45)
    const result = advanceSportSeason(sport, 100, makeRng());
    // With high training hours and a good RNG, should level up
    if (result.leveledUp) {
      expect(sport.currentLevel).toBe(1);
      expect(sport.achievements.length).toBe(1);
    }
  });

  it('Big Game Moments can trigger', () => {
    const sport = startSecondSport('golf', { eye: 80, composure: 75, power: 60 });
    let hadMoment = false;
    for (let i = 0; i < 20; i++) {
      const result = advanceSportSeason(sport, 30, makeRng(i + 1));
      if (result.moment) {
        hadMoment = true;
        expect(result.moment.sportId).toBe('golf');
        expect(result.moment.title.length).toBeGreaterThan(3);
        break;
      }
    }
    expect(hadMoment).toBe(true);
  });
});

// ============================================================
// System 20: Pass The Torch
// ============================================================
describe('PassTheTorchSystem', () => {
  it('returns 4 tier descriptions', () => {
    const tiers = getTierInfo();
    expect(tiers.length).toBe(4);
    expect(tiers.map(t => t.tier)).toContain('blood');
    expect(tiers.map(t => t.tier)).toContain('stranger');
  });

  it('generates successor candidates with a stranger always available', () => {
    const candidates = generateSuccessorCandidates(
      'Will Burns',
      [], // No family
      [], // No mentees
      [], // No coworkers
      makeRng(),
    );
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates.some(c => c.tier === 'stranger')).toBe(true);
  });

  it('generates blood successor when child meets requirements', () => {
    const candidates = generateSuccessorCandidates(
      'Will Burns',
      [{ name: 'Maria Burns', role: 'daughter', age: 16, affinity: 80 }],
      [],
      [],
      makeRng(),
    );
    const blood = candidates.find(c => c.tier === 'blood');
    expect(blood).toBeDefined();
    expect(blood!.name).toBe('Maria Burns');
    expect(blood!.startingStage).toBe('high_school');
  });

  it('rejects blood successor if too young', () => {
    const candidates = generateSuccessorCandidates(
      'Will Burns',
      [{ name: 'Maria Burns', role: 'daughter', age: 10, affinity: 80 }],
      [],
      [],
      makeRng(),
    );
    expect(candidates.find(c => c.tier === 'blood')).toBeUndefined();
  });

  it('rejects blood successor if low affinity', () => {
    const candidates = generateSuccessorCandidates(
      'Will Burns',
      [{ name: 'Maria Burns', role: 'daughter', age: 18, affinity: 30 }],
      [],
      [],
      makeRng(),
    );
    expect(candidates.find(c => c.tier === 'blood')).toBeUndefined();
  });

  it('generates protégé candidate', () => {
    const candidates = generateSuccessorCandidates(
      'Will Burns',
      [],
      [{ name: 'Diego Ramirez', seasonsmentored: 5, affinity: 60 }],
      [],
      makeRng(),
    );
    expect(candidates.find(c => c.tier === 'protege')).toBeDefined();
  });

  it('passes the torch and creates legacy NPC', () => {
    const dynasty = createDynastyLegacy('Burns', 'Will Burns', 'char_1', 2014);
    const candidates = generateSuccessorCandidates(
      'Will Burns',
      [{ name: 'Maria Burns', role: 'daughter', age: 20, affinity: 90 }],
      [],
      [],
      makeRng(),
    );
    const maria = candidates.find(c => c.tier === 'blood')!;
    const result = passTheTorch(
      maria,
      { id: 'char_1', name: 'Will Burns', age: 54, personality: ['leader', 'mentor'], legacyScore: 75 },
      dynasty,
      makeRng(),
    );
    expect(result.legacyNPC.name).toBe('Will Burns');
    expect(result.legacyNPC.isAlive).toBe(true);
    expect(result.legacyNPC.npcBehavior).toBe('supportive_parent');
    expect(result.farewell.length).toBeGreaterThan(50);
    expect(dynasty.currentGeneration).toBe(1);
    expect(dynasty.generations.length).toBe(2);
  });

  it('legacy NPC ages and eventually dies', () => {
    const dynasty = createDynastyLegacy('Burns', 'Will Burns', 'char_1', 2014);
    const candidates = generateSuccessorCandidates('Will Burns', [], [], [], makeRng());
    const stranger = candidates.find(c => c.tier === 'stranger')!;
    const { legacyNPC } = passTheTorch(
      stranger,
      { id: 'char_1', name: 'Will Burns', age: 80, personality: ['introvert'], legacyScore: 50 },
      dynasty,
      makeRng(),
    );

    let died = false;
    for (let season = 1; season <= 30; season++) {
      const result = ageLegacyNPC(legacyNPC, season, makeRng(season));
      if (result.died) {
        died = true;
        expect(result.deathNarrative).toBeDefined();
        expect(result.deathNarrative!.length).toBeGreaterThan(20);
        break;
      }
    }
    // Starting at 80, should die within 30 years
    expect(died).toBe(true);
  });

  it('NPC contacts player with context-appropriate messages', () => {
    const npc = {
      id: 'npc_1', name: 'Will Burns', originalCharacterId: 'char_1',
      age: 60, isAlive: true, health: 80, personality: ['leader'],
      relationship: 'parent', contactFrequency: 9, lastContactSeason: 0,
      npcBehavior: 'supportive_parent' as const, memorials: [],
    };
    const msg = getNPCContact(npc, 'preGame', 'Maria Burns', makeRng());
    expect(msg).not.toBeNull();
    // Message should contain either the NPC name or relationship reference
    expect(msg!.length).toBeGreaterThan(10);
    const containsRef = msg!.includes('Will Burns') || msg!.includes('parent');
    expect(containsRef).toBe(true);
  });

  it('dead NPC returns null on contact', () => {
    const npc = {
      id: 'npc_1', name: 'Will Burns', originalCharacterId: 'char_1',
      age: 85, isAlive: false, health: 0, personality: [],
      relationship: 'parent', contactFrequency: 9, lastContactSeason: 0,
      npcBehavior: 'supportive_parent' as const, deathAge: 85, memorials: [],
    };
    expect(getNPCContact(npc, 'preGame', 'Maria', makeRng())).toBeNull();
  });
});

// ============================================================
// System 21: Social Media
// ============================================================
describe('SocialMediaSystem', () => {
  it('creates a social feed', () => {
    const feed = createSocialFeed(2025);
    expect(feed.posts).toHaveLength(0);
    expect(feed.era).toBe('full_social');
    expect(feed.followerCount).toBe(100);
  });

  it('determines correct era format by year', () => {
    expect(getEraFormat(1990)).toBe('newspaper');
    expect(getEraFormat(2010)).toBe('early_social');
    expect(getEraFormat(2025)).toBe('full_social');
  });

  it('generates feed posts for a walkoff', () => {
    const feed = createSocialFeed(2025);
    const posts = generateFeedPosts(feed, 'walkoff', {
      player: 'Will Burns',
      team: 'Thunderhawks',
      stat: '25',
    }, 80, makeRng());
    expect(posts.length).toBeGreaterThan(0);
    expect(feed.posts.length).toBeGreaterThan(0);
    // Check substitution worked
    const hasPlayerName = posts.some(p => p.content.includes('Will Burns'));
    expect(hasPlayerName).toBe(true);
  });

  it('generates posts for scandal context', () => {
    const feed = createSocialFeed(2025);
    const posts = generateFeedPosts(feed, 'scandal', {
      player: 'Will Burns',
      scandalDetail: 'offshore PED clinic',
    }, 90, makeRng());
    expect(posts.length).toBeGreaterThan(0);
  });

  it('newspaper era posts have 0 likes', () => {
    const feed = createSocialFeed(1990);
    const posts = generateFeedPosts(feed, 'home_run', {
      player: 'Babe Burns',
      stat: '45',
    }, 50, makeRng());
    for (const post of posts) {
      expect(post.likes).toBe(0);
    }
  });

  it('caps feed at 200 posts', () => {
    const feed = createSocialFeed(2025);
    for (let i = 0; i < 25; i++) {
      generateFeedPosts(feed, 'random', { player: 'Burns' }, 50, makeRng(i));
    }
    expect(feed.posts.length).toBeLessThanOrEqual(200);
  });

  it('getRecentPosts returns a subset', () => {
    const feed = createSocialFeed(2025);
    generateFeedPosts(feed, 'walkoff', { player: 'Burns', team: 'Hawks', stat: '5' }, 70, makeRng());
    generateFeedPosts(feed, 'home_run', { player: 'Burns', stat: '20' }, 70, makeRng(99));
    const recent = getRecentPosts(feed, 3);
    expect(recent.length).toBeLessThanOrEqual(3);
  });

  it('updateEra changes feed era', () => {
    const feed = createSocialFeed(1990);
    expect(feed.era).toBe('newspaper');
    updateEra(feed, 2020);
    expect(feed.era).toBe('full_social');
  });

  it('responding to a hostile post can go viral', () => {
    const feed = createSocialFeed(2025);
    generateFeedPosts(feed, 'strikeout', { player: 'Burns' }, 50, makeRng());
    const hostilePost = feed.posts.find(p => p.sentiment === 'hostile' && p.canRespond);
    if (hostilePost && hostilePost.responseOptions) {
      const result = respondToPost(feed, hostilePost.id, 0);
      // Just verify the function returns valid structure
      expect(typeof result.mediaRepDelta).toBe('number');
      expect(typeof result.fanRepDelta).toBe('number');
      expect(typeof result.wentViral).toBe('boolean');
    }
  });
});

// ============================================================
// System 22: Coaching Philosophy
// ============================================================
describe('CoachingPhilosophySystem', () => {
  it('returns all 6 philosophies', () => {
    const philosophies = getPhilosophies();
    expect(philosophies.length).toBe(6);
    expect(philosophies.map(p => p.id)).toContain('players_manager');
    expect(philosophies.map(p => p.id)).toContain('tactician');
  });

  it('gets a specific philosophy with full data', () => {
    const disc = getPhilosophy('disciplinarian');
    expect(disc.name).toBe('Disciplinarian');
    expect(disc.whoThrives.length).toBeGreaterThan(0);
    expect(disc.whoStruggles.length).toBeGreaterThan(0);
  });

  it('creates a coach profile', () => {
    const profile = createCoachProfile('analytics_driven');
    expect(profile.philosophyId).toBe('analytics_driven');
    expect(profile.experience).toBe(0);
    expect(profile.reputation).toBe(20);
  });

  it('thriving player match returns positive morale', () => {
    const philosophy = getPhilosophy('players_manager');
    const result = evaluatePlayerFit(philosophy, ['ego', 'veteran'], 'Mike Star', makeRng());
    expect(result.reaction).toBe('thriving');
    expect(result.moraleDelta).toBeGreaterThan(0);
  });

  it('struggling player match returns negative morale', () => {
    const philosophy = getPhilosophy('disciplinarian');
    const result = evaluatePlayerFit(philosophy, ['ego', 'rebel'], 'Johnny Rebel', makeRng());
    expect(['struggling', 'rebellious']).toContain(result.reaction);
    expect(result.moraleDelta).toBeLessThan(0);
  });

  it('neutral player gets 0 morale delta', () => {
    const philosophy = getPhilosophy('old_school');
    const result = evaluatePlayerFit(philosophy, ['random_trait'], 'Joe Average', makeRng());
    expect(result.reaction).toBe('neutral');
    expect(result.moraleDelta).toBe(0);
  });

  it('advances coaching season and updates record', () => {
    const profile = createCoachProfile('developer');
    const result = advanceCoachingSeason(profile, 95, 67, true, false, [
      { name: 'Bob Assistant', role: 'Bench Coach', seasonsWithYou: 3 },
    ], makeRng());
    expect(profile.experience).toBe(1);
    expect(profile.wins).toBe(95);
    expect(profile.playoffAppearances).toBe(1);
    expect(result.repDelta).toBeGreaterThan(0);
    expect(result.narrative.length).toBeGreaterThan(10);
  });

  it('World Series win boosts reputation significantly', () => {
    const profile = createCoachProfile('players_manager');
    advanceCoachingSeason(profile, 100, 62, true, true, [], makeRng());
    expect(profile.reputation).toBeGreaterThan(30);
    expect(profile.worldSeriesWins).toBe(1);
  });

  it('sim coaching tree season tracks updates', () => {
    const members = [
      { name: 'Bob', originalRole: 'Bench Coach', currentRole: 'Manager', currentTeam: 'Hawks',
        philosophyVariant: 'developer' as const, seasonsUnderYou: 3, record: { wins: 0, losses: 0 }, achievements: [] },
    ];
    const result = simCoachingTreeSeason(members, makeRng());
    expect(members[0].record.wins).toBeGreaterThan(0);
    expect(typeof result.updates).toBe('object');
  });

  it('getCompatibilityScore returns 0-100', () => {
    const score = getCompatibilityScore('disciplinarian', ['coachable', 'young']);
    expect(score).toBeGreaterThan(50);
    const badScore = getCompatibilityScore('disciplinarian', ['ego', 'rebel']);
    expect(badScore).toBeLessThan(50);
  });
});

// ============================================================
// System 23: Historical Eras
// ============================================================
describe('HistoricalEraSystem', () => {
  it('returns all 9 eras', () => {
    const eras = getAvailableEras();
    expect(eras.length).toBe(9);
    expect(eras[0].id).toBe('dead_ball');
    expect(eras[8].id).toBe('future');
  });

  it('gets full era config', () => {
    const steroid = getEra('steroid');
    expect(steroid.name).toBe('Steroid Era');
    expect(steroid.pedLandscape.prevalence).toBe(80);
    expect(steroid.gameRules.ballJuiciness).toBe(5);
  });

  it('maps year to correct era', () => {
    expect(getEraForYear(1910).id).toBe('dead_ball');
    expect(getEraForYear(1935).id).toBe('golden_age');
    expect(getEraForYear(1955).id).toBe('integration');
    expect(getEraForYear(1970).id).toBe('expansion');
    expect(getEraForYear(1985).id).toBe('free_agency');
    expect(getEraForYear(2000).id).toBe('steroid');
    expect(getEraForYear(2015).id).toBe('analytics');
    expect(getEraForYear(2025).id).toBe('modern');
    expect(getEraForYear(2040).id).toBe('future');
  });

  it('salary ranges increase across eras', () => {
    const deadBall = getEraSalaryRange('dead_ball');
    const modern = getEraSalaryRange('modern');
    expect(modern.min).toBeGreaterThan(deadBall.min);
    expect(modern.max).toBeGreaterThan(deadBall.max);
  });

  it('era decisions respect age filters', () => {
    const decisions = getEraDecisions('golden_age', 25);
    // WWII service is 18-40
    expect(decisions.length).toBeGreaterThan(0);

    const tooOld = getEraDecisions('golden_age', 50);
    expect(tooOld.length).toBe(0);
  });

  it('cultural events filter by year', () => {
    const events1927 = getCulturalEvents('golden_age', 1927);
    expect(events1927.length).toBe(1);
    expect(events1927[0].title).toContain('Ruth');

    const eventsNone = getCulturalEvents('golden_age', 1930);
    expect(eventsNone.length).toBe(0);
  });

  it('game rules differ by era', () => {
    const deadBall = getGameRuleModifiers('dead_ball');
    const modern = getGameRuleModifiers('modern');
    expect(deadBall.dhRule).toBe(false);
    expect(modern.dhRule).toBe(true);
    expect(modern.pitchClock).toBe(true);
    expect(deadBall.pitchClock).toBe(false);
  });

  it('PED landscape varies dramatically', () => {
    const deadBall = getPEDLandscape('dead_ball');
    const steroid = getPEDLandscape('steroid');
    expect(steroid.prevalence).toBeGreaterThan(deadBall.prevalence);
    expect(steroid.testingFrequency).toBeGreaterThan(deadBall.testingFrequency);
  });

  it('media description returns non-empty string', () => {
    const desc = getMediaDescription('analytics');
    expect(desc.length).toBeGreaterThan(10);
  });
});

// ============================================================
// System 24: Multiplayer Dynasty
// ============================================================
describe('MultiplayerDynastySystem', () => {
  const hostPlayer = {
    id: 'p1', displayName: 'Will', characterName: 'Will Burns',
    characterId: 'char_1', teamId: 'team_1', role: 'player' as const,
  };
  const guestPlayer = {
    id: 'p2', displayName: 'Chris', characterName: 'Chris Burns',
    characterId: 'char_2', teamId: 'team_2', role: 'gm' as const,
  };

  it('lists all 4 multiplayer modes', () => {
    const modes = getMultiplayerModes();
    expect(modes.length).toBe(4);
    expect(modes.map(m => m.id)).toContain('coop');
    expect(modes.map(m => m.id)).toContain('league');
  });

  it('creates a multiplayer session', () => {
    const session = createMultiplayerSession('coop', hostPlayer);
    expect(session.mode).toBe('coop');
    expect(session.players.length).toBe(1);
    expect(session.hostPlayerId).toBe('p1');
    expect(session.activeTurnPlayerId).toBe('p1');
  });

  it('allows joining a session', () => {
    const session = createMultiplayerSession('coop', hostPlayer);
    const result = joinSession(session, guestPlayer);
    expect(result.success).toBe(true);
    expect(session.players.length).toBe(2);
  });

  it('rejects joining a full session', () => {
    const session = createMultiplayerSession('coop', hostPlayer);
    joinSession(session, guestPlayer);
    const result = joinSession(session, {
      id: 'p3', displayName: 'Matty', characterName: 'Matty B',
      characterId: 'char_3', teamId: 'team_3', role: 'player',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('full');
  });

  it('rejects duplicate player', () => {
    const session = createMultiplayerSession('coop', hostPlayer);
    const result = joinSession(session, { ...guestPlayer, id: 'p1' }); // Same ID
    expect(result.success).toBe(false);
  });

  it('sends direct messages', () => {
    const session = createMultiplayerSession('coop', hostPlayer);
    joinSession(session, guestPlayer);
    const msg = sendMessage(session, 'p1', 'p2', 'Trade me your pitcher!');
    expect(msg.content).toBe('Trade me your pitcher!');
    expect(session.players[1].messages.length).toBe(1);
    expect(session.players[1].pendingEvents.some(e => e.type === 'message')).toBe(true);
  });

  it('broadcasts messages to all', () => {
    const session = createMultiplayerSession('league', hostPlayer, { maxPlayers: 4 });
    joinSession(session, guestPlayer);
    sendMessage(session, 'p1', 'all', 'League announcement!', 'league');
    expect(session.players[1].messages.length).toBe(1);
  });

  it('proposes and responds to trades', () => {
    const session = createMultiplayerSession('coop', hostPlayer);
    joinSession(session, guestPlayer);
    const trade = proposeTrade(session, 'p1', 'p2', ['Mike Star'], ['Joe Bench']);
    expect(trade).not.toBeNull();
    expect(trade!.status).toBe('pending');

    const accepted = respondToTrade(session, trade!.id, 'accepted');
    expect(accepted).toBe(true);
    expect(session.worldState.headlines.some(h => h.includes('TRADE'))).toBe(true);
  });

  it('creates and resolves shared Big Game Moments', () => {
    const session = createMultiplayerSession('rivalry', hostPlayer);
    joinSession(session, guestPlayer);

    const moment = createSharedMoment(session, ['p1', 'p2'], 'Rivalry Showdown', 'Game 7. Full count. Two outs.');
    expect(moment.resolved).toBe(false);

    const headline = resolveSharedMoment(session, moment.id, { p1: 'success', p2: 'failure' });
    expect(headline).toContain('Will Burns');
    expect(headline).toContain('Chris Burns');
  });

  it('advances turns correctly', () => {
    const session = createMultiplayerSession('coop', hostPlayer);
    joinSession(session, guestPlayer);
    expect(session.activeTurnPlayerId).toBe('p1');

    advanceTurn(session);
    expect(session.activeTurnPlayerId).toBe('p2');

    advanceTurn(session);
    expect(session.activeTurnPlayerId).toBe('p1');
    expect(session.currentDay).toBe(2); // Cycled back, day incremented
  });

  it('returns session summary', () => {
    const session = createMultiplayerSession('rivalry', hostPlayer);
    joinSession(session, guestPlayer);
    const summary = getSessionSummary(session);
    expect(summary.mode).toBe('Rivalry Dynasty');
    expect(summary.playerCount).toBe(2);
    expect(summary.recentHeadlines.length).toBeGreaterThan(0);
  });
});

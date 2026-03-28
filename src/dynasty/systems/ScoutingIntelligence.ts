/**
 * Scouting Intelligence System
 *
 * Named NPC scouts with personalities that COLOR their reports.
 * Scout quality determines accuracy. Bad scouts overhype or undersell.
 * AI-powered reports via Haiku generate unique prose for each evaluation.
 */

import type { EntityId } from '../ecs/types.ts';

export type ScoutSpecialty = 'domestic' | 'international' | 'analytics' | 'tools';
export type ScoutBias = 'hype' | 'conservative' | 'balanced' | 'tools_first' | 'stats_first';

export interface Scout {
  id: string;
  name: string;
  specialty: ScoutSpecialty;
  bias: ScoutBias;
  accuracy: number;     // 1-100 — how close to true ratings their reports are
  experience: number;   // years
  salary: number;       // thousands/year
  personality: string;  // brief description for AI prompt
}

export interface ScoutReport {
  scoutId: string;
  scoutName: string;
  playerId: string;
  playerName: string;
  reportDate: number;    // season
  // Scouted ratings (may differ from true ratings based on scout accuracy + bias)
  scoutedOverall: number;
  scoutedHit: number;
  scoutedPower: number;
  scoutedSpeed: number;
  scoutedArm: number;
  scoutedField: number;
  scoutedStuff?: number;    // pitchers
  scoutedControl?: number;
  // The prose report (AI-generated or template)
  narrative: string;
  recommendation: 'must_sign' | 'strong_interest' | 'worth_a_look' | 'pass' | 'avoid';
  comparablePlayer: string;  // "Comparable: Mike Trout" or "Comparable: Chris Davis"
  redFlags: string[];
  strengths: string[];
}

export interface InternationalHeadline {
  id: string;
  playerName: string;
  league: string;         // "NPB", "KBO", "Cuban National Series", "Mexican League"
  headline: string;       // "Japanese HR King hitting .380 with 45 HR"
  trueOverall: number;    // hidden — the real rating
  askingPrice: number;    // thousands — what it costs to sign
  available: boolean;
  scouted: boolean;       // has user sent a scout?
  reports: ScoutReport[]; // reports from scouts sent
}

export interface ProspectFamily {
  prospectId: string;
  prospectName: string;
  familyInfluence: 'baseball' | 'football' | 'basketball' | 'education' | 'neutral';
  familyDemand: number;    // signing bonus minimum (thousands)
  convincible: boolean;     // can the family be persuaded?
  persuasionRequired: number; // 0-100 difficulty
}

// ── Scout name generator pools ──

const FIRST_NAMES = [
  'Rico', 'Janet', 'Buck', 'Hideo', 'Carlos', 'Tommy', 'Mack', 'Delilah',
  'Ozzie', 'Kenji', 'Fernando', 'Dusty', 'Pat', 'Yuki', 'Red', 'Marge',
  'Koji', 'Satch', 'Lefty', 'Pepper', 'Dixie', 'Rube', 'Smokey', 'Birdie',
];

const LAST_NAMES = [
  'Valentino', 'Park', 'Hawkins', 'Tanaka', 'Mendoza', 'Whitfield', 'Reeves',
  'Chen', 'O\'Brien', 'Nakamura', 'Silva', 'Baker', 'Rhodes', 'Kimura',
  'McGee', 'Fontaine', 'Cruz', 'Yamamoto', 'Kowalski', 'Washington',
];

const BIAS_PERSONALITIES: Record<ScoutBias, string> = {
  hype: 'Enthusiastic, sees the best in every player, uses exciting comparisons, overhypes tools and potential. Uses words like "electric", "special", "can\'t-miss".',
  conservative: 'Cautious, focuses on risks and weaknesses, undersells flashy players, trusts track record over tools. Uses words like "concerning", "needs work", "limited ceiling".',
  balanced: 'Even-handed, gives honest assessments with both positives and negatives. Professional tone.',
  tools_first: 'Old school, evaluates based on physical tools over stats. Loves raw athleticism and "the look". Uses baseball jargon heavily.',
  stats_first: 'Analytics-minded, trusts numbers over eye test. Cites specific stats, percentages, and comparable data points.',
};

const INTERNATIONAL_LEAGUES = [
  { name: 'NPB (Japan)', weight: 0.85 },        // Talent translates well
  { name: 'KBO (Korea)', weight: 0.80 },         // Slightly less translation
  { name: 'Cuban National Series', weight: 0.75 },
  { name: 'Mexican League', weight: 0.70 },
  { name: 'Australian Baseball League', weight: 0.65 },
  { name: 'Italian Baseball League', weight: 0.55 },
];

const HEADLINE_TEMPLATES = [
  '{{name}} crushing it in {{league}} — {{stat}} this season',
  '{{league}} star {{name}} drawing MLB interest after {{stat}}',
  'International sensation {{name}} dominates {{league}}: {{stat}}',
  '{{name}} named {{league}} MVP — {{stat}} with Gold Glove defense',
  'Sources: Multiple MLB teams scouting {{league}}\'s {{name}} ({{stat}})',
];

const STAT_TEMPLATES = [
  '.380 AVG with 45 HR', '.340 AVG, 38 HR, 110 RBI', '22-4 record, 1.89 ERA',
  '52 HR, leading the league', '.360/.440/.720 slash line', '2.05 ERA with 245 K',
  '40 HR and 30 SB', '.355 AVG as a 22-year-old', '18-2 with a 1.65 ERA',
];

const COMPARABLE_PLAYERS_HYPE = [
  'Mike Trout', 'Shohei Ohtani', 'Vladimir Guerrero Jr.', 'Juan Soto',
  'Ronald Acuna Jr.', 'Mookie Betts', 'Ichiro Suzuki', 'Albert Pujols (prime)',
];

const COMPARABLE_PLAYERS_CONSERVATIVE = [
  'Chris Davis', 'Adam Dunn', 'Mark Reynolds', 'Rob Deer',
  'Rougned Odor', 'Javier Baez (late career)', 'Yulieski Gurriel',
];

/**
 * Scouting Intelligence Engine
 */
export class ScoutingIntelligence {
  private scouts: Scout[] = [];
  private reports: Map<string, ScoutReport[]> = new Map(); // playerId → reports
  private headlines: InternationalHeadline[] = [];
  private prospectFamilies: ProspectFamily[] = [];
  private rng: () => number;

  constructor(rng?: () => number) {
    this.rng = rng ?? Math.random;
  }

  // ── Scout Management ──

  generateScout(): Scout {
    const firstName = FIRST_NAMES[Math.floor(this.rng() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(this.rng() * LAST_NAMES.length)];
    const biases: ScoutBias[] = ['hype', 'conservative', 'balanced', 'tools_first', 'stats_first'];
    const specialties: ScoutSpecialty[] = ['domestic', 'international', 'analytics', 'tools'];
    const bias = biases[Math.floor(this.rng() * biases.length)];
    const accuracy = 40 + Math.floor(this.rng() * 50); // 40-90
    const experience = 1 + Math.floor(this.rng() * 25);
    const salary = 100 + Math.floor(accuracy * 3 + experience * 10); // $100K-$500K+

    return {
      id: `scout_${firstName.toLowerCase()}_${lastName.toLowerCase().replace("'", '')}`,
      name: `${firstName} ${lastName}`,
      specialty: specialties[Math.floor(this.rng() * specialties.length)],
      bias,
      accuracy,
      experience,
      salary,
      personality: BIAS_PERSONALITIES[bias],
    };
  }

  hireScout(scout: Scout): void {
    this.scouts.push(scout);
  }

  fireScout(scoutId: string): void {
    this.scouts = this.scouts.filter(s => s.id !== scoutId);
  }

  getScouts(): Scout[] {
    return [...this.scouts];
  }

  // ── Report Generation ──

  /**
   * Generate a scouted report. The report's ratings DEVIATE from true ratings
   * based on scout accuracy and bias.
   */
  generateReport(
    scout: Scout,
    playerId: string,
    playerName: string,
    trueRatings: { overall: number; hit: number; power: number; speed: number; arm: number; field: number; stuff?: number; control?: number },
    season: number,
  ): ScoutReport {
    const deviation = Math.round((100 - scout.accuracy) / 3); // max ±17 for worst scouts

    const bias = (trueVal: number): number => {
      let noise = Math.round((this.rng() - 0.5) * deviation * 2);
      // Apply bias
      if (scout.bias === 'hype') noise += Math.round(deviation * 0.6); // overhype
      if (scout.bias === 'conservative') noise -= Math.round(deviation * 0.5); // undersell
      if (scout.bias === 'tools_first' && trueVal >= 60) noise += 3; // loves tools
      if (scout.bias === 'stats_first' && trueVal < 50) noise -= 2; // punishes low stats
      return Math.max(20, Math.min(80, trueVal + noise));
    };

    const scoutedOverall = bias(trueRatings.overall);
    const scoutedHit = bias(trueRatings.hit);
    const scoutedPower = bias(trueRatings.power);
    const scoutedSpeed = bias(trueRatings.speed);
    const scoutedArm = bias(trueRatings.arm);
    const scoutedField = bias(trueRatings.field);
    const scoutedStuff = trueRatings.stuff !== undefined ? bias(trueRatings.stuff) : undefined;
    const scoutedControl = trueRatings.control !== undefined ? bias(trueRatings.control) : undefined;

    // Determine recommendation based on scouted (not true) ratings
    const rec = scoutedOverall >= 70 ? 'must_sign'
      : scoutedOverall >= 60 ? 'strong_interest'
      : scoutedOverall >= 50 ? 'worth_a_look'
      : scoutedOverall >= 40 ? 'pass'
      : 'avoid';

    // Comparable player based on bias
    const comparables = scout.bias === 'hype' || scoutedOverall >= 65
      ? COMPARABLE_PLAYERS_HYPE
      : COMPARABLE_PLAYERS_CONSERVATIVE;
    const comparablePlayer = comparables[Math.floor(this.rng() * comparables.length)];

    // Strengths and red flags
    const strengths: string[] = [];
    const redFlags: string[] = [];
    if (scoutedHit >= 60) strengths.push('Plus hit tool');
    if (scoutedPower >= 65) strengths.push('Impact power');
    if (scoutedSpeed >= 65) strengths.push('Elite speed');
    if (scoutedArm >= 65) strengths.push('Strong arm');
    if (scoutedField >= 65) strengths.push('Gold Glove potential');
    if (scoutedStuff && scoutedStuff >= 65) strengths.push('Swing-and-miss stuff');

    if (scoutedHit < 40) redFlags.push('Significant contact concerns');
    if (scoutedPower < 35) redFlags.push('Below-average power');
    if (scoutedSpeed < 35) redFlags.push('Limited mobility');
    if (scoutedStuff && scoutedStuff < 40) redFlags.push('Stuff may not play at MLB level');
    if (scoutedControl && scoutedControl < 40) redFlags.push('Command needs major work');

    // Generate narrative (template-based — AI version below)
    const narrative = this.generateNarrative(scout, playerName, scoutedOverall, rec, strengths, redFlags, comparablePlayer);

    const report: ScoutReport = {
      scoutId: scout.id,
      scoutName: scout.name,
      playerId,
      playerName,
      reportDate: season,
      scoutedOverall, scoutedHit, scoutedPower, scoutedSpeed, scoutedArm, scoutedField,
      scoutedStuff, scoutedControl,
      narrative,
      recommendation: rec,
      comparablePlayer: `Comparable: ${comparablePlayer}`,
      redFlags,
      strengths,
    };

    // Store report
    const existing = this.reports.get(playerId) ?? [];
    existing.push(report);
    this.reports.set(playerId, existing);

    return report;
  }

  private generateNarrative(
    scout: Scout, playerName: string, overall: number,
    rec: string, strengths: string[], redFlags: string[], comp: string
  ): string {
    // Template narrative colored by scout bias
    if (scout.bias === 'hype') {
      if (overall >= 60) return `This kid is SPECIAL. ${playerName} has the kind of tools you dream on — ${strengths.join(', ') || 'raw athleticism that jumps off the page'}. I\'m telling you, he reminds me of ${comp}. Sign him NOW before someone else does. ${redFlags.length > 0 ? `Yeah, there are minor concerns (${redFlags[0]}), but you can coach that.` : 'No red flags. This is a can\'t-miss talent.'}`;
      return `${playerName} has some intriguing tools. ${strengths.length > 0 ? strengths[0] + ' stands out.' : 'The raw ability is there.'} He needs development but the upside is real. Comparable: ${comp} (optimistic).`;
    }
    if (scout.bias === 'conservative') {
      if (overall >= 65) return `${playerName} is a solid prospect with legitimate MLB tools. ${strengths.join(', ')}. ${redFlags.length > 0 ? `However, I have concerns: ${redFlags.join('. ')}.` : 'I don\'t see major red flags, which is rare.'} Comparable: ${comp}. Recommendation: proceed with caution.`;
      return `I\'m not sold on ${playerName}. ${redFlags.length > 0 ? redFlags.join('. ') + '.' : 'The tools are underwhelming.'} ${strengths.length > 0 ? `There\'s ${strengths[0]}, but` : 'And'} I don\'t think it translates to the big leagues. Comparable: ${comp}. My recommendation: pass.`;
    }
    if (scout.bias === 'tools_first') {
      return `Saw ${playerName} work out today. ${strengths.length > 0 ? 'The ' + strengths[0] + ' is legit — you can see it from the parking lot.' : 'The physical tools are average.'} ${redFlags.length > 0 ? 'But ' + redFlags[0] + '.' : ''} This is a ${overall >= 60 ? 'baseball player' : 'project'}. Comparable: ${comp}.`;
    }
    if (scout.bias === 'stats_first') {
      return `${playerName} — the numbers tell the story. Scouted grade: ${overall}. ${strengths.length > 0 ? 'Key metrics: ' + strengths.join(', ') + '.' : 'No standout metrics.'} ${redFlags.length > 0 ? 'Areas of concern: ' + redFlags.join(', ') + '.' : 'No statistical red flags.'} Comparable: ${comp}. Expected WAR contribution: ${overall >= 60 ? '2.0-4.0' : '0.5-1.5'}.`;
    }
    // Balanced
    return `${playerName} profiles as a ${overall >= 60 ? 'legitimate MLB contributor' : 'fringe prospect'}. Strengths: ${strengths.join(', ') || 'nothing elite'}. Concerns: ${redFlags.join(', ') || 'none major'}. Comparable: ${comp}. Overall grade: ${overall}/80.`;
  }

  /**
   * Generate an AI-powered report using Claude Haiku.
   * Falls back to template if API unavailable.
   */
  async generateAIReport(
    scout: Scout,
    playerName: string,
    trueRatings: { overall: number; hit: number; power: number; speed: number; arm: number; field: number; stuff?: number; control?: number },
    apiKey?: string,
  ): Promise<string> {
    if (!apiKey) return ''; // Will use template narrative

    const prompt = `You are ${scout.name}, a baseball scout with ${scout.experience} years of experience.
Your personality: ${scout.personality}
Your specialty: ${scout.specialty} scouting

Write a 3-4 sentence scouting report on prospect "${playerName}".
Their TRUE ratings (which you DON'T know perfectly — your accuracy is ${scout.accuracy}/100):
Overall: ${trueRatings.overall}, Hit: ${trueRatings.hit}, Power: ${trueRatings.power}, Speed: ${trueRatings.speed}

Write IN CHARACTER. Your bias should color the report. Be specific about baseball tools.
Don't mention ratings numbers — describe the tools like a real scout would.`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!response.ok) return '';
      const data = await response.json();
      return data?.content?.[0]?.text ?? '';
    } catch {
      return ''; // Fallback to template
    }
  }

  // ── International Headlines ──

  generateInternationalHeadlines(count = 5): InternationalHeadline[] {
    const headlines: InternationalHeadline[] = [];

    for (let i = 0; i < count; i++) {
      const league = INTERNATIONAL_LEAGUES[Math.floor(this.rng() * INTERNATIONAL_LEAGUES.length)];
      const firstName = FIRST_NAMES[Math.floor(this.rng() * FIRST_NAMES.length)];
      const lastName = LAST_NAMES[Math.floor(this.rng() * LAST_NAMES.length)];
      const name = `${firstName} ${lastName}`;
      const stat = STAT_TEMPLATES[Math.floor(this.rng() * STAT_TEMPLATES.length)];
      const template = HEADLINE_TEMPLATES[Math.floor(this.rng() * HEADLINE_TEMPLATES.length)];

      const trueOverall = 35 + Math.floor(this.rng() * 45); // 35-80 — some are busts, some are stars
      const askingPrice = Math.round(trueOverall * trueOverall * 0.5 + this.rng() * 10000); // Higher overall = pricier

      const headline = template
        .replace('{{name}}', name)
        .replace('{{league}}', league.name)
        .replace('{{stat}}', stat);

      headlines.push({
        id: `intl_${i}_${name.replace(/\s/g, '_').toLowerCase()}`,
        playerName: name,
        league: league.name,
        headline,
        trueOverall,
        askingPrice,
        available: true,
        scouted: false,
        reports: [],
      });
    }

    this.headlines = headlines;
    return headlines;
  }

  getHeadlines(): InternationalHeadline[] {
    return [...this.headlines];
  }

  scoutInternationalPlayer(headlineId: string, scout: Scout, season: number): ScoutReport | null {
    const headline = this.headlines.find(h => h.id === headlineId);
    if (!headline || !headline.available) return null;

    // The league weight affects how well the scout can evaluate
    const leagueInfo = INTERNATIONAL_LEAGUES.find(l => l.name === headline.league);
    const translationFactor = leagueInfo?.weight ?? 0.7;

    // True ratings derived from overall + randomness
    const trueRatings = {
      overall: headline.trueOverall,
      hit: Math.round(headline.trueOverall * (0.8 + this.rng() * 0.4)),
      power: Math.round(headline.trueOverall * (0.7 + this.rng() * 0.6)),
      speed: Math.round(headline.trueOverall * (0.6 + this.rng() * 0.5)),
      arm: Math.round(headline.trueOverall * (0.7 + this.rng() * 0.4)),
      field: Math.round(headline.trueOverall * (0.8 + this.rng() * 0.3)),
    };

    // Reduce scout accuracy for international evaluations
    const adjustedScout = {
      ...scout,
      accuracy: Math.round(scout.accuracy * translationFactor),
    };

    const report = this.generateReport(adjustedScout, headline.id, headline.playerName, trueRatings, season);
    headline.scouted = true;
    headline.reports.push(report);

    return report;
  }

  // ── Prospect Families ──

  generateProspectFamily(prospectId: string, prospectName: string, trueOverall: number): ProspectFamily {
    const influences: ProspectFamily['familyInfluence'][] = ['baseball', 'football', 'basketball', 'education', 'neutral'];
    const influence = influences[Math.floor(this.rng() * influences.length)];

    // Higher overall = more money demanded
    const baseDemand = trueOverall * 50; // $2.5M for a 50 OVR, $4M for 80 OVR
    const familyDemand = influence === 'football'
      ? Math.round(baseDemand * 1.5) // Football families demand more (guaranteed money argument)
      : influence === 'education'
        ? Math.round(baseDemand * 0.8) // Education families are cheaper but harder to convince
        : baseDemand;

    const persuasionRequired = influence === 'baseball' ? 20 // Easy — family loves baseball
      : influence === 'football' ? 70 // Hard — family wants football money
      : influence === 'basketball' ? 65
      : influence === 'education' ? 50 // Moderate — wants college guarantee
      : 35; // Neutral

    const family: ProspectFamily = {
      prospectId,
      prospectName,
      familyInfluence: influence,
      familyDemand,
      convincible: persuasionRequired < 80,
      persuasionRequired,
    };

    this.prospectFamilies.push(family);
    return family;
  }

  getProspectFamilies(): ProspectFamily[] {
    return [...this.prospectFamilies];
  }

  getReportsForPlayer(playerId: string): ScoutReport[] {
    return this.reports.get(playerId) ?? [];
  }
}

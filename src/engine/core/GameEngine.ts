import type { Team, Position, GameEvent, GameState, BoxScore, BoxScorePlayer, BoxScorePitcher } from '../types/index.ts';
import type { BallparkFactors } from '../types/ballpark.ts';
import { createEmptyBaseState } from '../types/game.ts';
import { getPlayer, getLineupPlayer, getBenchPlayers } from '../types/team.ts';
import { getPlayerName } from '../types/player.ts';
import { formatIP } from '../types/stats.ts';
import { RandomProvider } from './RandomProvider.ts';
import { AtBatResolver } from './AtBatResolver.ts';
import { ManagerAI } from '../ai/ManagerAI.ts';
import { uuid } from '../util/helpers.ts';

export interface GameConfig {
  away: Team;
  home: Team;
  ballpark: BallparkFactors;
  seed?: number;
}

/**
 * Full game loop: runs a complete 9+ inning game pitch-by-pitch.
 */
export class GameEngine {
  private state: GameState;
  private rng: RandomProvider;
  private ballpark: BallparkFactors;
  private pitcherStats: Map<string, { ip: number; h: number; r: number; er: number; bb: number; so: number; hr: number; pitchCount: number }>;
  /** Runs allowed by the current pitcher in the current inning (reset on pitching change or inning change) */
  private runsThisInning: { away: number; home: number };

  constructor(config: GameConfig) {
    const seed = config.seed ?? Date.now();
    this.rng = new RandomProvider(seed);
    this.ballpark = config.ballpark;
    this.pitcherStats = new Map();
    this.runsThisInning = { away: 0, home: 0 };

    // Deep-copy teams to avoid mutation between games
    const away: Team = JSON.parse(JSON.stringify(config.away));
    const home: Team = JSON.parse(JSON.stringify(config.home));

    // Initialize tracking structures if missing
    away.usedPitchers = [away.pitcherId];
    home.usedPitchers = [home.pitcherId];
    if (!away.bench) away.bench = this.detectBench(away);
    if (!home.bench) home.bench = this.detectBench(home);

    this.state = {
      id: uuid(),
      phase: 'pregame',
      away,
      home,
      inning: {
        inning: 1,
        half: 'top',
        outs: 0,
        balls: 0,
        strikes: 0,
        bases: createEmptyBaseState(),
      },
      score: { away: [], home: [] },
      boxScore: { awayBatters: [], homeBatters: [], awayPitchers: [], homePitchers: [] },
      events: [],
      currentBatterIndex: { away: 0, home: 0 },
      seed,
    };

    this.initPitcherStats(away.pitcherId);
    this.initPitcherStats(home.pitcherId);
    // Pre-init stats for all bullpen members
    for (const id of away.bullpen) this.initPitcherStats(id);
    for (const id of home.bullpen) this.initPitcherStats(id);
  }

  /**
   * Detect bench players: roster members who are position players but not in the lineup.
   */
  private detectBench(team: Team): string[] {
    const lineupIds = new Set(team.lineup.map(s => s.playerId));
    const pitcherIds = new Set([team.pitcherId, ...team.bullpen]);
    return team.roster.players
      .filter(p => !lineupIds.has(p.id) && !pitcherIds.has(p.id) && p.position !== 'P')
      .map(p => p.id);
  }

  private initPitcherStats(pitcherId: string): void {
    if (!this.pitcherStats.has(pitcherId)) {
      this.pitcherStats.set(pitcherId, { ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, hr: 0, pitchCount: 0 });
    }
  }

  /** Run the entire game and return the final state. */
  simulateGame(): GameState {
    this.state.phase = 'in_progress';

    while (!this.isGameOver()) {
      this.simulateHalfInning();
    }

    this.state.phase = 'final';
    this.buildBoxScore();

    const awayTotal = this.totalRuns('away');
    const homeTotal = this.totalRuns('home');
    this.state.events.push({
      type: 'game_end',
      description: `Final: ${this.state.away.abbreviation} ${awayTotal}, ${this.state.home.abbreviation} ${homeTotal}`,
      awayScore: awayTotal,
      homeScore: homeTotal,
    });

    return this.state;
  }

  /** Simulate one at-bat and return events (for pitch-by-pitch UI mode). */
  simulateNextAtBat(): { events: GameEvent[]; gameOver: boolean } {
    if (this.state.phase === 'pregame') {
      this.state.phase = 'in_progress';
      this.ensureCurrentInningScoreEntry();
      this.state.events.push({
        type: 'inning_change',
        description: 'Top of inning 1',
        inning: 1,
        half: 'top',
      });
    }

    if (this.isGameOver()) {
      this.finalizeGame();
      return { events: [], gameOver: true };
    }

    const events = this.resolveOneAtBat();

    // Check if half-inning is over
    if (this.state.inning.outs >= 3) {
      this.advanceToNextHalf();

      if (this.isGameOver()) {
        this.finalizeGame();
        return { events, gameOver: true };
      }

      // Emit inning change
      const { inning } = this.state;
      const changeEvent: GameEvent = {
        type: 'inning_change',
        description: `${inning.half === 'top' ? 'Top' : 'Bottom'} of inning ${inning.inning}`,
        inning: inning.inning,
        half: inning.half,
      };
      this.state.events.push(changeEvent);
      events.push(changeEvent);
      this.ensureCurrentInningScoreEntry();
    }

    // Check walkoff
    if (this.isGameOver()) {
      this.finalizeGame();
      const awayTotal = this.totalRuns('away');
      const homeTotal = this.totalRuns('home');
      const endEvent: GameEvent = {
        type: 'game_end',
        description: `Final: ${this.state.away.abbreviation} ${awayTotal}, ${this.state.home.abbreviation} ${homeTotal}`,
        awayScore: awayTotal,
        homeScore: homeTotal,
      };
      this.state.events.push(endEvent);
      events.push(endEvent);
      return { events, gameOver: true };
    }

    return { events, gameOver: false };
  }

  private finalizeGame(): void {
    this.state.phase = 'final';
    this.buildBoxScore();
  }

  getState(): GameState {
    return this.state;
  }

  private totalRuns(side: 'away' | 'home'): number {
    return this.state.score[side].reduce((a, b) => a + b, 0);
  }

  private simulateHalfInning(): void {
    const { inning } = this.state;
    const isTop = inning.half === 'top';

    // Skip bottom of 9th+ if home is already ahead
    if (!isTop && inning.inning >= 9 && this.totalRuns('home') > this.totalRuns('away')) {
      this.advanceToNextHalf();
      return;
    }

    this.state.events.push({
      type: 'inning_change',
      description: `${isTop ? 'Top' : 'Bottom'} of inning ${inning.inning}`,
      inning: inning.inning,
      half: inning.half,
    });

    // Initialize score entry for this half-inning
    this.ensureCurrentInningScoreEntry();

    inning.outs = 0;
    inning.bases = createEmptyBaseState();

    // Reset runs-this-inning counter for the pitching team
    this.runsThisInning[isTop ? 'away' : 'home'] = 0;

    while (inning.outs < 3) {
      this.resolveOneAtBat();

      // Check for walkoff
      if (!isTop && inning.inning >= 9 && this.totalRuns('home') > this.totalRuns('away')) {
        break;
      }
    }

    // Reset runs-this-inning at end of half-inning
    this.runsThisInning[isTop ? 'away' : 'home'] = 0;

    this.advanceToNextHalf();
  }

  private advanceToNextHalf(): void {
    const { inning } = this.state;
    if (inning.half === 'top') {
      inning.half = 'bottom';
    } else {
      inning.half = 'top';
      inning.inning++;
    }
    inning.outs = 0;
    inning.balls = 0;
    inning.strikes = 0;
    inning.bases = createEmptyBaseState();
    // Reset both inning run counters on half-inning change
    this.runsThisInning.away = 0;
    this.runsThisInning.home = 0;
  }

  private ensureCurrentInningScoreEntry(): void {
    const idx = this.state.inning.inning - 1;
    const isTop = this.state.inning.half === 'top';
    const arr = isTop ? this.state.score.away : this.state.score.home;
    while (arr.length <= idx) arr.push(0);
  }

  private resolveOneAtBat(): GameEvent[] {
    const { inning } = this.state;
    const isTop = inning.half === 'top';
    const battingTeam = isTop ? this.state.away : this.state.home;
    const pitchingTeam = isTop ? this.state.home : this.state.away;

    // ── Pinch hit check (before at-bat) ──────────────────────────────────────
    const batterIdx = isTop ? this.state.currentBatterIndex.away : this.state.currentBatterIndex.home;
    const phDecision = ManagerAI.shouldPinchHit(battingTeam, this.state, batterIdx);
    const phEvents: GameEvent[] = [];

    if (phDecision.shouldPinchHit && phDecision.pinchHitter && phDecision.forPlayerId !== undefined && phDecision.battingSpot !== undefined) {
      const ph = phDecision.pinchHitter;
      const outgoingId = phDecision.forPlayerId;
      const spot = phDecision.battingSpot;
      const outgoing = getPlayer(battingTeam, outgoingId);
      const outgoingName = outgoing ? getPlayerName(outgoing) : outgoingId;
      const phName = getPlayerName(ph);

      // Swap the lineup spot
      battingTeam.lineup[spot] = { playerId: ph.id, position: battingTeam.lineup[spot]?.position ?? 'DH' };

      // Remove from bench
      if (battingTeam.bench) {
        battingTeam.bench = battingTeam.bench.filter(id => id !== ph.id);
      }

      const phEvent: GameEvent = {
        type: 'pinch_hit',
        description: `${phName} pinch hits for ${outgoingName}`,
        pinchHitter: phName,
        forPlayer: outgoingName,
        battingSpot: spot,
      };
      phEvents.push(phEvent);
      this.state.events.push(phEvent);

      // If we PHed for the pitcher, we'll need a defensive sub next inning.
      // For now, track that the outgoing player was replaced.
      // Defensive sub is handled at inning end if needed.
    }

    // ── Pitching change check (before at-bat) ────────────────────────────────
    const pcSide = isTop ? 'home' : 'away';
    const pitcherChangeEvents = this.checkAndExecutePitchingChange(pitchingTeam, pcSide);

    const currentBatterSpot = (isTop ? this.state.currentBatterIndex.away : this.state.currentBatterIndex.home) % 9;
    const batter = getLineupPlayer(battingTeam, currentBatterSpot);
    if (!batter) return [...phEvents, ...pitcherChangeEvents];

    const pitcher = getPlayer(pitchingTeam, pitchingTeam.pitcherId);
    if (!pitcher) return [...phEvents, ...pitcherChangeEvents];

    const fielders = this.buildFieldersMap(pitchingTeam);

    const result = AtBatResolver.resolve(
      batter, pitcher, fielders,
      inning.bases, inning.outs,
      this.ballpark, this.rng
    );

    // Update game state
    inning.bases = result.newBases;
    inning.outs += result.outsRecorded;

    // Add runs to score
    if (result.runsScored > 0) {
      const scoreArr = isTop ? this.state.score.away : this.state.score.home;
      const idx = inning.inning - 1;
      while (scoreArr.length <= idx) scoreArr.push(0);
      scoreArr[idx] += result.runsScored;

      // Track runs in current inning for pitching change logic
      // The batting team scored = pitching team allowed
      if (isTop) {
        this.runsThisInning.away += result.runsScored;
      } else {
        this.runsThisInning.home += result.runsScored;
      }
    }

    // Update pitcher stats
    const pStats = this.pitcherStats.get(pitchingTeam.pitcherId);
    if (pStats) {
      pStats.pitchCount += result.totalPitches;
      if (result.isStrikeout) { pStats.so++; pStats.ip += 1; }
      else if (result.isWalk) pStats.bb++;
      else if (result.isHit) {
        pStats.h++;
        if (result.isHomeRun) pStats.hr++;
        pStats.ip += result.outsRecorded;
      } else {
        pStats.ip += result.outsRecorded;
      }
      pStats.r += result.runsScored;
      pStats.er += result.runsScored;
      if (result.isError) {
        pStats.er = Math.max(0, pStats.er - result.runsScored);
      }
    }

    // Update pitcher fatigue
    pitcher.state.pitchCount += result.totalPitches;
    pitcher.state.fatigue = Math.min(100, pitcher.state.fatigue + result.totalPitches * 0.8);

    // Advance lineup
    if (isTop) {
      this.state.currentBatterIndex.away++;
    } else {
      this.state.currentBatterIndex.home++;
    }

    this.state.events.push(...result.events);
    return [...phEvents, ...pitcherChangeEvents, ...result.events];
  }

  /**
   * Check if the pitching team's starter should be pulled, and execute the change.
   * Returns any events emitted.
   */
  private checkAndExecutePitchingChange(pitchingTeam: Team, side: 'away' | 'home'): GameEvent[] {
    const runsAllowed = this.runsThisInning[side];
    const decision = ManagerAI.shouldChangePitcher(pitchingTeam, this.state, runsAllowed);
    if (!decision.shouldChange) return [];

    const selection = ManagerAI.selectReliever(pitchingTeam, this.state);
    if (!selection) return [];

    const outgoingPitcher = getPlayer(pitchingTeam, pitchingTeam.pitcherId);
    const outgoingName = outgoingPitcher ? getPlayerName(outgoingPitcher) : pitchingTeam.pitcherId;
    const incomingName = getPlayerName(selection.pitcher);

    // Mark the outgoing pitcher as used
    if (!pitchingTeam.usedPitchers) pitchingTeam.usedPitchers = [];
    if (!pitchingTeam.usedPitchers.includes(pitchingTeam.pitcherId)) {
      pitchingTeam.usedPitchers.push(pitchingTeam.pitcherId);
    }

    // Switch to the new pitcher
    pitchingTeam.pitcherId = selection.pitcher.id;
    pitchingTeam.usedPitchers.push(selection.pitcher.id);

    // Initialize stats for new pitcher if needed
    this.initPitcherStats(selection.pitcher.id);

    // Reset inning run counter (new pitcher starts fresh for pull logic)
    this.runsThisInning[side] = 0;

    const roleLabel = selection.role === 'closer' ? 'closer' : selection.role === 'setup' ? 'setup man' : 'reliever';
    const reason = decision.reason ? ` (${decision.reason})` : '';
    const ev: GameEvent = {
      type: 'pitching_change',
      description: `Pitching change: ${incomingName} (${roleLabel}) replaces ${outgoingName}${reason}`,
      outgoing: outgoingName,
      incoming: incomingName,
    };
    this.state.events.push(ev);
    return [ev];
  }

  private buildFieldersMap(team: Team): Map<Position, import('../types/index.ts').Player> {
    const map = new Map<Position, import('../types/index.ts').Player>();
    for (const spot of team.lineup) {
      const player = getPlayer(team, spot.playerId);
      if (player) map.set(spot.position, player);
    }
    return map;
  }

  private isGameOver(): boolean {
    const { inning } = this.state;
    const awayTotal = this.totalRuns('away');
    const homeTotal = this.totalRuns('home');

    if (inning.half === 'bottom' && inning.inning >= 9 && homeTotal > awayTotal && inning.outs === 0) {
      return true;
    }

    if (inning.half === 'top' && inning.inning >= 10) {
      if (awayTotal !== homeTotal) return true;
    }

    if (inning.half === 'bottom' && inning.inning >= 9 && homeTotal > awayTotal) {
      return true;
    }

    return false;
  }

  private buildBoxScore(): void {
    const box: BoxScore = {
      awayBatters: this.buildBatterLines(this.state.away),
      homeBatters: this.buildBatterLines(this.state.home),
      awayPitchers: this.buildAllPitcherLines(this.state.away),
      homePitchers: this.buildAllPitcherLines(this.state.home),
    };
    this.state.boxScore = box;
  }

  private buildBatterLines(team: Team): BoxScorePlayer[] {
    const events = this.state.events;
    const lines: BoxScorePlayer[] = [];

    for (const spot of team.lineup) {
      const player = getPlayer(team, spot.playerId);
      if (!player) continue;
      const name = getPlayerName(player);

      let ab = 0, r = 0, h = 0, rbi = 0, bb = 0, so = 0, hr = 0, doubles = 0, triples = 0;

      for (const ev of events) {
        if (ev.type !== 'at_bat_result' || ev.batter !== name) continue;

        const res = ev.result;
        rbi += ev.rbiCount;

        if (res === 'walk') { bb++; continue; }
        if (res === 'sacrifice_fly') { continue; }

        ab++;
        if (res === 'strikeout_swinging' || res === 'strikeout_looking') so++;
        if (res === 'single') h++;
        if (res === 'double') { h++; doubles++; }
        if (res === 'triple') { h++; triples++; }
        if (res === 'home_run') { h++; hr++; r++; }
      }

      const avg = ab === 0 ? '.000' : (h / ab).toFixed(3).replace(/^0/, '');

      lines.push({
        playerId: spot.playerId, name, position: spot.position,
        ab, r, h, rbi, bb, so, hr, doubles, triples, sb: 0, avg,
      });
    }

    return lines;
  }

  /** Build pitcher lines for all pitchers who appeared (box score shows each pitcher separately). */
  private buildAllPitcherLines(team: Team): BoxScorePitcher[] {
    const lines: BoxScorePitcher[] = [];
    const awayTotal = this.totalRuns('away');
    const homeTotal = this.totalRuns('home');
    const isHome = team.id === this.state.home.id;
    const teamWon = isHome ? homeTotal > awayTotal : awayTotal > homeTotal;

    const usedIds = team.usedPitchers ?? [team.pitcherId];
    // Ensure current pitcher is included
    const allIds = [...new Set([...usedIds, team.pitcherId])];

    for (let i = 0; i < allIds.length; i++) {
      const id = allIds[i];
      const stats = this.pitcherStats.get(id);
      const pitcher = getPlayer(team, id);
      if (!pitcher || !stats) continue;

      let decision: BoxScorePitcher['decision'] = '';
      if (i === allIds.length - 1) {
        // Last pitcher gets the decision
        decision = teamWon ? (allIds.length === 1 ? 'W' : 'S') : 'L';
        if (allIds.length === 1) decision = teamWon ? 'W' : 'L';
      } else if (i === 0 && teamWon && allIds.length > 1) {
        // Starting pitcher gets W if team won and they pitched enough
        if (stats.ip >= 15) decision = 'W'; // 5 IP (stored as 15 in thirds)
      }

      lines.push({
        playerId: id,
        name: getPlayerName(pitcher),
        ip: formatIP(stats.ip),
        h: stats.h,
        r: stats.r,
        er: stats.er,
        bb: stats.bb,
        so: stats.so,
        hr: stats.hr,
        pitchCount: stats.pitchCount,
        decision,
      });
    }

    return lines;
  }
}

import type { Team, Position, GameEvent, GameState, BoxScore, BoxScorePlayer, BoxScorePitcher } from '../types/index.ts';
import type { BallparkFactors } from '../types/ballpark.ts';
import { createEmptyBaseState } from '../types/game.ts';
import { getPlayer, getLineupPlayer } from '../types/team.ts';
import { getPlayerName } from '../types/player.ts';
import { formatIP } from '../types/stats.ts';
import { RandomProvider } from './RandomProvider.ts';
import { AtBatResolver } from './AtBatResolver.ts';
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

  constructor(config: GameConfig) {
    const seed = config.seed ?? Date.now();
    this.rng = new RandomProvider(seed);
    this.ballpark = config.ballpark;
    this.pitcherStats = new Map();

    this.state = {
      id: uuid(),
      phase: 'pregame',
      away: config.away,
      home: config.home,
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

    this.initPitcherStats(config.away.pitcherId);
    this.initPitcherStats(config.home.pitcherId);
  }

  private initPitcherStats(pitcherId: string): void {
    this.pitcherStats.set(pitcherId, { ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, hr: 0, pitchCount: 0 });
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
      // Initialize first half-inning
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

    while (inning.outs < 3) {
      this.resolveOneAtBat();

      // Check for walkoff
      if (!isTop && inning.inning >= 9 && this.totalRuns('home') > this.totalRuns('away')) {
        break;
      }
    }

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

    const batterIdx = isTop ? this.state.currentBatterIndex.away : this.state.currentBatterIndex.home;
    const batter = getLineupPlayer(battingTeam, batterIdx % 9);
    if (!batter) return [];

    const pitcher = getPlayer(pitchingTeam, pitchingTeam.pitcherId);
    if (!pitcher) return [];

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
    return result.events;
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

    // Can't end before 9 full half-innings have been played
    // We check based on the current state after the half-inning has advanced

    // After top of 9th+, about to play bottom:
    // If home is already ahead, game is over (skip bottom)
    if (inning.half === 'bottom' && inning.inning >= 9 && homeTotal > awayTotal && inning.outs === 0) {
      return true;
    }

    // After bottom of 9th+ completes:
    if (inning.half === 'top' && inning.inning >= 10) {
      // Previous bottom completed, check if not tied
      if (awayTotal !== homeTotal) return true;
    }

    // Walkoff: during bottom of 9th+, home takes lead mid-inning
    if (inning.half === 'bottom' && inning.inning >= 9 && homeTotal > awayTotal) {
      return true;
    }

    return false;
  }

  private buildBoxScore(): void {
    const box: BoxScore = {
      awayBatters: this.buildBatterLines(this.state.away),
      homeBatters: this.buildBatterLines(this.state.home),
      awayPitchers: this.buildPitcherLines(this.state.away),
      homePitchers: this.buildPitcherLines(this.state.home),
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

  private buildPitcherLines(team: Team): BoxScorePitcher[] {
    const lines: BoxScorePitcher[] = [];
    const stats = this.pitcherStats.get(team.pitcherId);
    const pitcher = getPlayer(team, team.pitcherId);
    if (!pitcher || !stats) return lines;

    const awayTotal = this.totalRuns('away');
    const homeTotal = this.totalRuns('home');
    const isHome = team.id === this.state.home.id;
    const won = isHome ? homeTotal > awayTotal : awayTotal > homeTotal;

    lines.push({
      playerId: team.pitcherId,
      name: getPlayerName(pitcher),
      ip: formatIP(stats.ip),
      h: stats.h,
      r: stats.r,
      er: stats.er,
      bb: stats.bb,
      so: stats.so,
      hr: stats.hr,
      pitchCount: stats.pitchCount,
      decision: won ? 'W' : 'L',
    });

    return lines;
  }
}

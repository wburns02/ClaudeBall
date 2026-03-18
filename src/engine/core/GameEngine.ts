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

    const awayTotal = this.state.score.away.reduce((a, b) => a + b, 0);
    const homeTotal = this.state.score.home.reduce((a, b) => a + b, 0);
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
    if (this.state.phase === 'pregame') this.state.phase = 'in_progress';
    if (this.isGameOver()) return { events: [], gameOver: true };

    const events = this.resolveOneAtBat();
    const gameOver = this.isGameOver();

    if (gameOver) {
      this.state.phase = 'final';
      this.buildBoxScore();
      const awayTotal = this.state.score.away.reduce((a, b) => a + b, 0);
      const homeTotal = this.state.score.home.reduce((a, b) => a + b, 0);
      const endEvent: GameEvent = {
        type: 'game_end',
        description: `Final: ${this.state.away.abbreviation} ${awayTotal}, ${this.state.home.abbreviation} ${homeTotal}`,
        awayScore: awayTotal,
        homeScore: homeTotal,
      };
      this.state.events.push(endEvent);
      events.push(endEvent);
    }

    return { events, gameOver };
  }

  getState(): GameState {
    return this.state;
  }

  private simulateHalfInning(): void {
    const { inning } = this.state;
    const isTop = inning.half === 'top';

    // Check walkoff
    if (!isTop && inning.inning >= 9) {
      const homeTotal = this.state.score.home.reduce((a, b) => a + b, 0);
      const awayTotal = this.state.score.away.reduce((a, b) => a + b, 0);
      if (homeTotal > awayTotal) return;
    }

    // Skip bottom of 9th+ if home is ahead
    if (!isTop && inning.inning >= 9) {
      const awayTotal = this.state.score.away.reduce((a, b) => a + b, 0);
      const homeTotal = this.state.score.home.reduce((a, b) => a + b, 0);
      if (homeTotal > awayTotal) return;
    }

    this.state.events.push({
      type: 'inning_change',
      description: `${isTop ? 'Top' : 'Bottom'} of inning ${inning.inning}`,
      inning: inning.inning,
      half: inning.half,
    });

    let runsThisInning = 0;
    inning.outs = 0;
    inning.bases = createEmptyBaseState();

    while (inning.outs < 3) {
      const abEvents = this.resolveOneAtBat();

      // Check for walkoff
      if (!isTop && inning.inning >= 9) {
        const homeTotal = this.state.score.home.reduce((a, b) => a + b, 0) + runsThisInning;
        const awayTotal = this.state.score.away.reduce((a, b) => a + b, 0);
        if (homeTotal > awayTotal) {
          if (isTop) {
            this.state.score.away.push(runsThisInning);
          } else {
            this.state.score.home.push(runsThisInning);
          }
          this.advanceInning();
          return;
        }
      }

      // Count runs from the last at-bat result event
      for (const ev of abEvents) {
        if (ev.type === 'at_bat_result') {
          runsThisInning += ev.rbiCount;
        }
      }

      if (inning.outs >= 3) break;
    }

    if (isTop) {
      this.state.score.away.push(runsThisInning);
    } else {
      this.state.score.home.push(runsThisInning);
    }

    this.advanceInning();
  }

  private resolveOneAtBat(): GameEvent[] {
    const { inning } = this.state;
    const isTop = inning.half === 'top';
    const battingTeam = isTop ? this.state.away : this.state.home;
    const pitchingTeam = isTop ? this.state.home : this.state.away;

    // Get current batter
    const batterIdx = isTop ? this.state.currentBatterIndex.away : this.state.currentBatterIndex.home;
    const batter = getLineupPlayer(battingTeam, batterIdx % 9);
    if (!batter) return [];

    // Get pitcher
    const pitcher = getPlayer(pitchingTeam, pitchingTeam.pitcherId);
    if (!pitcher) return [];

    // Build fielders map
    const fielders = this.buildFieldersMap(pitchingTeam);

    // Resolve at-bat
    const result = AtBatResolver.resolve(
      batter, pitcher, fielders,
      inning.bases, inning.outs,
      this.ballpark, this.rng
    );

    // Update game state
    inning.bases = result.newBases;
    inning.outs += result.outsRecorded;

    // Update pitcher stats
    const pStats = this.pitcherStats.get(pitchingTeam.pitcherId);
    if (pStats) {
      pStats.pitchCount += result.totalPitches;
      if (result.isStrikeout) { pStats.so++; pStats.ip += 3; }
      else if (result.isWalk) pStats.bb++;
      else if (result.isHit) {
        pStats.h++;
        if (result.isHomeRun) pStats.hr++;
        // Outs recorded on fielding
        pStats.ip += result.outsRecorded * 3;
      } else {
        pStats.ip += result.outsRecorded * 3;
      }
      pStats.r += result.runsScored;
      pStats.er += result.runsScored; // Simplified: all runs are earned unless error
      if (result.isError) {
        pStats.er = Math.max(0, pStats.er - result.runsScored); // Unearned on error
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

    // Add runs to score for current inning tracking
    if (result.runsScored > 0) {
      const scoreArr = isTop ? this.state.score.away : this.state.score.home;
      const currentInningIdx = this.state.inning.inning - 1;
      while (scoreArr.length <= currentInningIdx) scoreArr.push(0);
      scoreArr[currentInningIdx] += result.runsScored;
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

  private advanceInning(): void {
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

  private isGameOver(): boolean {
    const { inning } = this.state;
    const awayTotal = this.state.score.away.reduce((a, b) => a + b, 0);
    const homeTotal = this.state.score.home.reduce((a, b) => a + b, 0);

    // Game can't end before 9 innings
    if (inning.inning < 9) return false;

    // Bottom of 9th+: home team ahead after top half
    if (inning.half === 'bottom' && inning.outs >= 3 && homeTotal > awayTotal) return true;

    // Top just finished in 9th+, check if home is ahead (walkoff handled inline)
    if (inning.half === 'top' && inning.inning > 9 && inning.outs >= 3 && homeTotal > awayTotal) return true;

    // End of full inning 9+
    if (inning.inning > 9 && inning.half === 'top' && awayTotal !== homeTotal) return true;

    // After bottom of 9th+, if scores not tied
    if (inning.inning >= 9 && inning.half === 'top' && inning.outs >= 3) {
      // Top of next inning: game over if not tied after full 9
      if (awayTotal !== homeTotal && this.state.score.home.length >= 9) return true;
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

      let ab = 0, r = 0, h = 0, rbi = 0, bb = 0, so = 0, hr = 0, doubles = 0, triples = 0, sb = 0;

      for (const ev of events) {
        if (ev.type !== 'at_bat_result' || ev.batter !== name) continue;

        const res = ev.result;
        if (res === 'walk') { bb++; rbi += ev.rbiCount; continue; }
        if (res === 'sacrifice_fly') { rbi += ev.rbiCount; continue; }

        ab++;
        rbi += ev.rbiCount;

        if (res === 'strikeout_swinging' || res === 'strikeout_looking') so++;
        if (res === 'single') h++;
        if (res === 'double') { h++; doubles++; }
        if (res === 'triple') { h++; triples++; }
        if (res === 'home_run') { h++; hr++; }
      }

      // Count runs
      for (const ev of events) {
        if (ev.type === 'at_bat_result') {
          // Check if this player scored (simplified — count RBIs as proxy for now)
        }
      }

      // Count runs scored from scoring runners in at_bat events
      for (const ev of events) {
        if (ev.type === 'at_bat_result' && ev.result === 'home_run' && ev.batter === name) {
          r++;
        }
      }

      const avg = ab === 0 ? '.000' : (h / ab).toFixed(3).replace(/^0/, '');

      lines.push({
        playerId: spot.playerId, name, position: spot.position,
        ab, r, h, rbi, bb, so, hr, doubles, triples, sb, avg,
      });
    }

    return lines;
  }

  private buildPitcherLines(team: Team): BoxScorePitcher[] {
    const lines: BoxScorePitcher[] = [];
    const stats = this.pitcherStats.get(team.pitcherId);
    const pitcher = getPlayer(team, team.pitcherId);
    if (!pitcher || !stats) return lines;

    const awayTotal = this.state.score.away.reduce((a, b) => a + b, 0);
    const homeTotal = this.state.score.home.reduce((a, b) => a + b, 0);
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

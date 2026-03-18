import type { Position, Player, Team } from '../types/index.ts';
import type { BallparkFactors } from '../types/ballpark.ts';
import type { GameState, GameEvent, BoxScorePlayer, BoxScorePitcher } from '../types/game.ts';
import type { UserSwingInput, UserPitchInput, PitchStepResult } from '../types/interactive.ts';
import { GameEngine } from './GameEngine.ts';
import type { GameConfig } from './GameEngine.ts';
import { InteractiveAtBat } from './InteractiveAtBat.ts';
import { RandomProvider } from './RandomProvider.ts';
import { getLineupPlayer, getPlayer } from '../types/team.ts';
import { createEmptyBaseState } from '../types/game.ts';
import { getPlayerName } from '../types/player.ts';
import { formatIP } from '../types/stats.ts';

/**
 * Wraps GameEngine to expose a pitch-by-pitch interactive interface.
 * The internal GameEngine handles full-sim. The Interactive layer
 * manages game state directly for pitch-by-pitch play.
 */
export class InteractiveGameEngine {
  private engine: GameEngine;
  private ballpark: BallparkFactors;
  private rng: RandomProvider;
  private activeAtBat: InteractiveAtBat | null = null;
  private pitcherStats: Map<string, {
    ip: number; h: number; r: number; er: number; bb: number; so: number; hr: number; pitchCount: number;
  }>;

  constructor(config: GameConfig) {
    this.engine = new GameEngine(config);
    this.ballpark = config.ballpark;
    this.rng = new RandomProvider(config.seed ?? Date.now());
    this.pitcherStats = new Map();
    const state = this.engine.getState();
    this.initPitcherStats(state.away.pitcherId);
    this.initPitcherStats(state.home.pitcherId);
    for (const id of state.away.bullpen) this.initPitcherStats(id);
    for (const id of state.home.bullpen) this.initPitcherStats(id);
  }

  private initPitcherStats(pitcherId: string): void {
    if (!this.pitcherStats.has(pitcherId)) {
      this.pitcherStats.set(pitcherId, { ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, hr: 0, pitchCount: 0 });
    }
  }

  getState(): GameState {
    return this.engine.getState();
  }

  getActiveAtBat(): InteractiveAtBat | null {
    return this.activeAtBat;
  }

  /**
   * Returns whether the user's team is currently up to bat or pitching.
   */
  isUserTurn(userTeam: 'home' | 'away'): 'batting' | 'pitching' | 'none' {
    const state = this.engine.getState();
    if (state.phase === 'final') return 'none';
    const { half } = state.inning;
    if (userTeam === 'away') {
      return half === 'top' ? 'batting' : 'pitching';
    } else {
      return half === 'bottom' ? 'batting' : 'pitching';
    }
  }

  /**
   * Set up an InteractiveAtBat for the current batter/pitcher.
   * Returns null if game is over or half-inning is over (need to advance).
   */
  startNextAtBat(): InteractiveAtBat | null {
    const state = this.engine.getState();

    if (state.phase === 'pregame') {
      state.phase = 'in_progress';
      this.ensureCurrentInningScoreEntry(state);
      state.events.push({
        type: 'inning_change',
        description: 'Top of inning 1',
        inning: 1,
        half: 'top',
      });
    }

    if (this.isGameOver()) return null;

    const { inning } = state;
    if (inning.outs >= 3) return null;

    const isTop = inning.half === 'top';
    const battingTeam = isTop ? state.away : state.home;
    const pitchingTeam = isTop ? state.home : state.away;

    const batterIdx = isTop
      ? state.currentBatterIndex.away
      : state.currentBatterIndex.home;
    const batter = getLineupPlayer(battingTeam, batterIdx % 9);
    if (!batter) return null;

    const pitcher = getPlayer(pitchingTeam, pitchingTeam.pitcherId);
    if (!pitcher) return null;

    const fielders = this.buildFieldersMap(pitchingTeam);

    this.activeAtBat = new InteractiveAtBat(
      batter, pitcher, fielders,
      { ...inning.bases }, inning.outs,
      this.ballpark,
      this.rng
    );

    return this.activeAtBat;
  }

  /**
   * Submit user input for the current pitch.
   * Returns PitchStepResult; if at-bat completes, game state is updated.
   */
  submitInput(input: UserSwingInput | UserPitchInput): PitchStepResult {
    if (!this.activeAtBat) {
      throw new Error('InteractiveGameEngine: no active at-bat');
    }
    const result = this.activeAtBat.resolvePitch(input);
    if (result.atBatOver && result.atBatResult) {
      this.applyAtBatResult(result.atBatResult, result.events);
      this.activeAtBat = null;
    }
    return result;
  }

  /**
   * CPU-only: auto-resolve one pitch (no user input).
   */
  advanceCPUPitch(): PitchStepResult {
    if (!this.activeAtBat) {
      throw new Error('InteractiveGameEngine: no active at-bat');
    }
    const result = this.activeAtBat.resolvePitch();
    if (result.atBatOver && result.atBatResult) {
      this.applyAtBatResult(result.atBatResult, result.events);
      this.activeAtBat = null;
    }
    return result;
  }

  isGameOver(): boolean {
    const state = this.engine.getState();
    if (state.phase === 'final') return true;

    const { inning } = state;
    const awayTotal = state.score.away.reduce((a, b) => a + b, 0);
    const homeTotal = state.score.home.reduce((a, b) => a + b, 0);

    if (inning.half === 'bottom' && inning.inning >= 9 && homeTotal > awayTotal && inning.outs === 0) return true;
    if (inning.half === 'top' && inning.inning >= 10 && awayTotal !== homeTotal) return true;
    if (inning.half === 'bottom' && inning.inning >= 9 && homeTotal > awayTotal) return true;
    return false;
  }

  /**
   * Sim the rest of the game instantly.
   * Any active at-bat is flushed via CPU first.
   */
  simToEnd(): GameState {
    if (this.activeAtBat && !this.activeAtBat.isComplete()) {
      while (!this.activeAtBat.isComplete()) {
        const result = this.activeAtBat.resolvePitch();
        if (result.atBatOver && result.atBatResult) {
          this.applyAtBatResult(result.atBatResult, result.events);
          this.activeAtBat = null;
          break;
        }
      }
    }

    let over = this.isGameOver();
    while (!over) {
      const result = this.engine.simulateNextAtBat();
      over = result.gameOver;
    }
    return this.engine.getState();
  }

  // ── Private: apply completed at-bat to game state ─────────────────────────

  private applyAtBatResult(result: import('./AtBatResolver.ts').AtBatResult, events: GameEvent[]): void {
    const state = this.engine.getState();
    const { inning } = state;
    const isTop = inning.half === 'top';
    const pitchingTeam = isTop ? state.home : state.away;

    inning.bases = result.newBases;
    inning.outs += result.outsRecorded;

    if (result.runsScored > 0) {
      const scoreArr = isTop ? state.score.away : state.score.home;
      const idx = inning.inning - 1;
      while (scoreArr.length <= idx) scoreArr.push(0);
      scoreArr[idx] += result.runsScored;
    }

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
      if (result.isError) pStats.er = Math.max(0, pStats.er - result.runsScored);
    }

    const pitcher = getPlayer(pitchingTeam, pitchingTeam.pitcherId);
    if (pitcher) {
      pitcher.state.pitchCount += result.totalPitches;
      pitcher.state.fatigue = Math.min(100, pitcher.state.fatigue + result.totalPitches * 0.8);
    }

    if (isTop) state.currentBatterIndex.away++;
    else state.currentBatterIndex.home++;

    state.events.push(...events);

    if (inning.outs >= 3) {
      this.advanceToNextHalf(state);
      if (this.isGameOver()) {
        this.finalizeGame(state);
      } else {
        const changeEvent: GameEvent = {
          type: 'inning_change',
          description: `${inning.half === 'top' ? 'Top' : 'Bottom'} of inning ${inning.inning}`,
          inning: inning.inning,
          half: inning.half,
        };
        state.events.push(changeEvent);
        this.ensureCurrentInningScoreEntry(state);
      }
    }

    if (this.isGameOver() && state.phase !== 'final') {
      this.finalizeGame(state);
    }
  }

  private finalizeGame(state: GameState): void {
    state.phase = 'final';
    this.buildBoxScore(state);
    const awayTotal = state.score.away.reduce((a, b) => a + b, 0);
    const homeTotal = state.score.home.reduce((a, b) => a + b, 0);
    const lastEvent = state.events[state.events.length - 1];
    if (!lastEvent || lastEvent.type !== 'game_end') {
      state.events.push({
        type: 'game_end',
        description: `Final: ${state.away.abbreviation} ${awayTotal}, ${state.home.abbreviation} ${homeTotal}`,
        awayScore: awayTotal,
        homeScore: homeTotal,
      });
    }
  }

  private advanceToNextHalf(state: GameState): void {
    const { inning } = state;
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

  private ensureCurrentInningScoreEntry(state: GameState): void {
    const idx = state.inning.inning - 1;
    const isTop = state.inning.half === 'top';
    const arr = isTop ? state.score.away : state.score.home;
    while (arr.length <= idx) arr.push(0);
  }

  private buildFieldersMap(team: Team): Map<Position, Player> {
    const map = new Map<Position, Player>();
    for (const spot of team.lineup) {
      const player = getPlayer(team, spot.playerId);
      if (player) map.set(spot.position, player);
    }
    return map;
  }

  private buildBoxScore(state: GameState): void {
    state.boxScore = {
      awayBatters: this.buildBatterLines(state, state.away),
      homeBatters: this.buildBatterLines(state, state.home),
      awayPitchers: this.buildPitcherLines(state, state.away),
      homePitchers: this.buildPitcherLines(state, state.home),
    };
  }

  private buildBatterLines(state: GameState, team: Team): BoxScorePlayer[] {
    const lines: BoxScorePlayer[] = [];
    for (const spot of team.lineup) {
      const player = getPlayer(team, spot.playerId);
      if (!player) continue;
      const name = getPlayerName(player);
      let ab = 0, r = 0, h = 0, rbi = 0, bb = 0, so = 0, hr = 0, doubles = 0, triples = 0;
      for (const ev of state.events) {
        if (ev.type !== 'at_bat_result' || ev.batter !== name) continue;
        const res = ev.result;
        rbi += ev.rbiCount;
        if (res === 'walk') { bb++; continue; }
        if (res === 'sacrifice_fly') continue;
        ab++;
        if (res === 'strikeout_swinging' || res === 'strikeout_looking') so++;
        if (res === 'single') h++;
        if (res === 'double') { h++; doubles++; }
        if (res === 'triple') { h++; triples++; }
        if (res === 'home_run') { h++; hr++; r++; }
      }
      const avg = ab === 0 ? '.000' : (h / ab).toFixed(3).replace(/^0/, '');
      lines.push({ playerId: spot.playerId, name, position: spot.position, ab, r, h, rbi, bb, so, hr, doubles, triples, sb: 0, avg });
    }
    return lines;
  }

  private buildPitcherLines(state: GameState, team: Team): BoxScorePitcher[] {
    const lines: BoxScorePitcher[] = [];
    const stats = this.pitcherStats.get(team.pitcherId);
    const pitcher = getPlayer(team, team.pitcherId);
    if (!pitcher || !stats) return lines;
    const awayTotal = state.score.away.reduce((a, b) => a + b, 0);
    const homeTotal = state.score.home.reduce((a, b) => a + b, 0);
    const isHome = team.id === state.home.id;
    const won = isHome ? homeTotal > awayTotal : awayTotal > homeTotal;
    lines.push({
      playerId: team.pitcherId,
      name: getPlayerName(pitcher),
      ip: formatIP(stats.ip),
      h: stats.h, r: stats.r, er: stats.er, bb: stats.bb, so: stats.so, hr: stats.hr,
      pitchCount: stats.pitchCount,
      decision: won ? 'W' : 'L',
    });
    return lines;
  }
}

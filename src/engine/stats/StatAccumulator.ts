import type { GameState } from '../types/game.ts';
import type { BattingStats, PitchingStats } from '../types/stats.ts';
import { createEmptyBattingStats, createEmptyPitchingStats } from '../types/stats.ts';

export interface AggregateStats {
  gamesPlayed: number;
  batting: Map<string, BattingStats>;   // playerName → stats
  pitching: Map<string, PitchingStats>;
  totalRuns: number;
  totalHits: number;
  totalHR: number;
  totalBB: number;
  totalSO: number;
  totalPA: number;
  totalAB: number;
  totalErrors: number;
}

/**
 * Accumulates stats across multiple games for aggregate analysis.
 */
export class StatAccumulator {
  private stats: AggregateStats;

  constructor() {
    this.stats = {
      gamesPlayed: 0,
      batting: new Map(),
      pitching: new Map(),
      totalRuns: 0,
      totalHits: 0,
      totalHR: 0,
      totalBB: 0,
      totalSO: 0,
      totalPA: 0,
      totalAB: 0,
      totalErrors: 0,
    };
  }

  addGame(game: GameState): void {
    this.stats.gamesPlayed++;

    // Process box score batters
    for (const batter of [...game.boxScore.awayBatters, ...game.boxScore.homeBatters]) {
      const bs = this.getOrCreateBatting(batter.name);
      const ab = batter.ab;
      const pa = ab + batter.bb;
      bs.pa += pa;
      bs.ab += ab;
      bs.h += batter.h;
      bs.doubles += batter.doubles;
      bs.triples += batter.triples;
      bs.hr += batter.hr;
      bs.rbi += batter.rbi;
      bs.r += batter.r;
      bs.bb += batter.bb;
      bs.so += batter.so;

      this.stats.totalPA += pa;
      this.stats.totalAB += ab;
      this.stats.totalHits += batter.h;
      this.stats.totalHR += batter.hr;
      this.stats.totalBB += batter.bb;
      this.stats.totalSO += batter.so;
    }

    // Process pitchers
    for (const pitcher of [...game.boxScore.awayPitchers, ...game.boxScore.homePitchers]) {
      const ps = this.getOrCreatePitching(pitcher.name);
      const ipParts = pitcher.ip.split('.');
      const fullInnings = parseInt(ipParts[0]) || 0;
      const thirds = parseInt(ipParts[1]) || 0;
      ps.ip += fullInnings * 3 + thirds;
      ps.h += pitcher.h;
      ps.r += pitcher.r;
      ps.er += pitcher.er;
      ps.bb += pitcher.bb;
      ps.so += pitcher.so;
      ps.hr += pitcher.hr;
      ps.pitchCount += pitcher.pitchCount;
      ps.bf += pitcher.h + pitcher.bb + pitcher.so; // Approximation
      if (pitcher.decision === 'W') ps.wins++;
      if (pitcher.decision === 'L') ps.losses++;
    }

    // Total runs
    const awayRuns = game.score.away.reduce((a, b) => a + b, 0);
    const homeRuns = game.score.home.reduce((a, b) => a + b, 0);
    this.stats.totalRuns += awayRuns + homeRuns;

    // Count errors
    for (const ev of game.events) {
      if (ev.type === 'error') this.stats.totalErrors++;
    }
  }

  getStats(): AggregateStats {
    return this.stats;
  }

  /** Get league-wide aggregate ratios */
  getLeagueAverages(): {
    avg: number;
    kPct: number;
    bbPct: number;
    hrPct: number;
    runsPerGame: number;
    era: number;
  } {
    const s = this.stats;
    const avg = s.totalAB === 0 ? 0 : s.totalHits / s.totalAB;
    const kPct = s.totalPA === 0 ? 0 : s.totalSO / s.totalPA;
    const bbPct = s.totalPA === 0 ? 0 : s.totalBB / s.totalPA;
    const hrPct = s.totalPA === 0 ? 0 : s.totalHR / s.totalPA;
    const runsPerGame = s.gamesPlayed === 0 ? 0 : s.totalRuns / (s.gamesPlayed * 2);

    // League ERA
    let totalIP = 0;
    let totalER = 0;
    for (const ps of s.pitching.values()) {
      totalIP += ps.ip;
      totalER += ps.er;
    }
    const innings = totalIP / 3;
    const era = innings === 0 ? 0 : (totalER / innings) * 9;

    return { avg, kPct, bbPct, hrPct, runsPerGame, era };
  }

  private getOrCreateBatting(name: string): BattingStats {
    if (!this.stats.batting.has(name)) {
      this.stats.batting.set(name, createEmptyBattingStats());
    }
    return this.stats.batting.get(name)!;
  }

  private getOrCreatePitching(name: string): PitchingStats {
    if (!this.stats.pitching.has(name)) {
      this.stats.pitching.set(name, createEmptyPitchingStats());
    }
    return this.stats.pitching.get(name)!;
  }
}

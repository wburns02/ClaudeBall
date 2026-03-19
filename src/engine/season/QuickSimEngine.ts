import type { Team } from '../types/index.ts';
import { RandomProvider } from '../core/RandomProvider.ts';
import { clamp } from '../util/helpers.ts';

export interface QuickSimResult {
  awayScore: number;
  homeScore: number;
}

/**
 * Probability-table based quick sim for season-mode games.
 * Much faster than pitch-by-pitch (~0.01ms vs ~3ms per game).
 *
 * Uses team overall ratings to determine win probability and score distribution.
 */
export class QuickSimEngine {
  static simulate(away: Team, home: Team, rng: RandomProvider): QuickSimResult {
    const awayOff = this.teamOffense(away);
    const awayPit = this.teamPitching(away);
    const homeOff = this.teamOffense(home);
    const homePit = this.teamPitching(home);

    // Expected runs: offense rating vs opposing pitching
    const awayExpRuns = this.expectedRuns(awayOff, homePit);
    const homeExpRuns = this.expectedRuns(homeOff, awayPit) + 0.25; // home field advantage

    // Generate scores from Poisson-like distribution
    const awayScore = this.generateScore(awayExpRuns, rng);
    let homeScore = this.generateScore(homeExpRuns, rng);

    // No ties — if tied, play extras (simplified)
    while (homeScore === awayScore) {
      if (rng.chance(0.52)) homeScore++; // slight home edge
      else return { awayScore: awayScore + 1, homeScore };
    }

    return { awayScore, homeScore };
  }

  private static teamOffense(team: Team): number {
    let total = 0;
    let count = 0;
    for (const spot of team.lineup) {
      const player = team.roster.players.find(p => p.id === spot.playerId);
      if (!player) continue;
      const contact = (player.batting.contact_L + player.batting.contact_R) / 2;
      const power = (player.batting.power_L + player.batting.power_R) / 2;
      const base = contact * 0.4 + power * 0.35 + player.batting.eye * 0.25;
      // Morale modifier: 0–100 → -8% to +8% (neutral = 60)
      const moraleMod = 1 + ((player.state.morale - 60) / 100) * 0.16;
      total += base * moraleMod;
      count++;
    }
    return count === 0 ? 50 : total / count;
  }

  private static teamPitching(team: Team): number {
    const pitcher = team.roster.players.find(p => p.id === team.pitcherId);
    if (!pitcher) return 50;
    const base = pitcher.pitching.stuff * 0.35 + pitcher.pitching.control * 0.35 + pitcher.pitching.movement * 0.30;
    // Morale modifier: 0–100 → -8% to +8% (neutral = 60)
    const moraleMod = 1 + ((pitcher.state.morale - 60) / 100) * 0.16;
    return base * moraleMod;
  }

  private static expectedRuns(offense: number, pitching: number): number {
    // Average ~4 R/G, modified by rating difference
    const diff = (offense - pitching) / 100;
    return clamp(4.0 + diff * 6.0, 1.5, 8.0);
  }

  private static generateScore(expected: number, rng: RandomProvider): number {
    // Poisson approximation via sum of exponentials
    let runs = 0;
    let limit = Math.exp(-expected);
    let prod = 1.0;

    while (true) {
      prod *= rng.next();
      if (prod < limit) break;
      runs++;
    }

    return runs;
  }
}

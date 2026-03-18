import type { Team, Player } from '../types/index.ts';
import type { GameState } from '../types/game.ts';
import { getPlayer } from '../types/team.ts';

/**
 * Basic AI manager decisions: pitching changes, steal attempts, bunt calls.
 */
export class ManagerAI {
  /** Should we pull the pitcher? */
  static shouldChangePitcher(team: Team, state: GameState): boolean {
    const pitcher = getPlayer(team, team.pitcherId);
    if (!pitcher) return false;

    // Pull after 100+ pitches
    if (pitcher.state.pitchCount >= 100) return true;

    // Pull if fatigue is high
    if (pitcher.state.fatigue >= 80) return true;

    // Pull if getting shelled (high runs in current inning)
    const isHome = team.id === state.home.id;
    const opponentRuns = isHome
      ? state.score.away.reduce((a, b) => a + b, 0)
      : state.score.home.reduce((a, b) => a + b, 0);

    if (pitcher.state.pitchCount > 70 && opponentRuns >= 6) return true;

    return false;
  }

  /** Select the best available reliever. */
  static selectReliever(team: Team): Player | null {
    for (const id of team.bullpen) {
      const p = getPlayer(team, id);
      if (p && p.state.fatigue < 30) return p;
    }
    // If everyone is tired, pick the freshest
    let best: Player | null = null;
    let bestFatigue = Infinity;
    for (const id of team.bullpen) {
      const p = getPlayer(team, id);
      if (p && p.state.fatigue < bestFatigue) {
        best = p;
        bestFatigue = p.state.fatigue;
      }
    }
    return best;
  }

  /** Should we attempt a steal? */
  static shouldSteal(runner: Player, _pitcher: Player, inning: number, _outs: number, runDiff: number): boolean {
    if (runner.batting.steal < 60) return false;
    if (runDiff > 3 || runDiff < -3) return false; // Don't steal in blowouts
    if (inning >= 8 && runDiff < 0) return runner.batting.steal >= 75; // Late game trailing
    return runner.batting.steal >= 70 && Math.random() < 0.15;
  }
}

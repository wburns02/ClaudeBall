/**
 * Live Win Probability engine — computes home team WP% given game state.
 *
 * Based on simplified run-differential × inning leverage model.
 * Calibrated to match general baseball WP intuition:
 *   - 9th inning, up 1 run: ~80%
 *   - 3rd inning, up 2 runs: ~65%
 *   - Tied after 9: ~50%
 */

export interface WPSnapshot {
  label: string;   // e.g. "T1", "B1", "T3", "B5" …
  homeWP: number;  // 0-100
}

/**
 * Compute the home team win probability (0–100) from current game state.
 */
export function calcWinProbability(
  inning: number,
  half: 'top' | 'bottom',
  outs: number,
  scoreDiff: number,    // homeScore - awayScore
  runnersOnBase: number // 0-3 (count of occupied bases)
): number {
  // Total outs completed so far (each half-inning = 3 outs)
  const halfInningsComplete = (inning - 1) * 2 + (half === 'bottom' ? 1 : 0);
  const outsInCurrentHalf = outs;
  const totalOuts = halfInningsComplete * 3 + outsInCurrentHalf;
  const totalOutsInGame = 54; // 9 full innings

  // Fraction of game complete (0–1)
  const gameFraction = Math.min(totalOuts / totalOutsInGame, 1);

  // As game progresses, each run is worth more WP
  // At game start: ~6% per run; at end: ~15%+ per run
  const runLeverage = 5 + gameFraction * 12;

  // Score differential effect
  let wpLogit = scoreDiff * runLeverage;

  // Runners on base effect: adds slight pressure context
  // Trailing team with runners has slightly better odds
  if (scoreDiff < 0 && runnersOnBase > 0) {
    wpLogit += runnersOnBase * 1.5; // trailing team gets slight boost
  } else if (scoreDiff > 0 && runnersOnBase === 0) {
    wpLogit += 1.0; // leading with bases empty = cleaner
  }

  // Convert logit to probability via sigmoid
  const wp = 100 / (1 + Math.exp(-wpLogit / 15));

  // Clamp to 1-99 (never absolute certainty until game over)
  return Math.round(Math.max(1, Math.min(99, wp)));
}

/**
 * Compute leverage index — how much this situation matters.
 * High leverage = late, close game. Low = blowout or early.
 */
export function calcLeverage(
  inning: number,
  half: 'top' | 'bottom',
  outs: number,
  scoreDiff: number
): number {
  const halfInningsComplete = (inning - 1) * 2 + (half === 'bottom' ? 1 : 0);
  const totalOuts = halfInningsComplete * 3 + outs;
  const gameFraction = Math.min(totalOuts / 54, 1);

  // Leverage is highest late in close games
  const runCloseness = Math.max(0, 3 - Math.abs(scoreDiff));
  const leverage = (0.3 + gameFraction * 0.7) * (runCloseness / 3);
  return Math.round(leverage * 100) / 100;
}

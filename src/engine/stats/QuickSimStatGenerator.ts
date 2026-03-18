/**
 * Generates approximate player stats for quick-simmed games.
 * Used when the full pitch-by-pitch engine is NOT run (CPU vs CPU games).
 *
 * Approach: use player ratings to distribute team runs/hits among the lineup.
 */
import type { Team } from '../types/team.ts';
import type { BoxScorePlayer, BoxScorePitcher } from '../types/game.ts';
import { getPlayerName } from '../types/player.ts';
import { formatIP } from '../types/stats.ts';
import type { RandomProvider } from '../core/RandomProvider.ts';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Distributes runs/hits for a batting lineup based on ratings.
 * Returns a box score player line for each lineup spot.
 */
export function generateBatterLines(
  team: Team,
  runsScored: number,
  rng: RandomProvider
): BoxScorePlayer[] {
  const lines: BoxScorePlayer[] = [];

  const lineupPlayers = team.lineup
    .map(spot => team.roster.players.find(p => p.id === spot.playerId))
    .filter(p => p != null);

  if (lineupPlayers.length === 0) return [];

  // Estimated plate appearances per game: ~38 for the whole lineup (4.2/player)
  const totalPa = 32 + Math.floor(rng.next() * 10);

  // Weight each player by their contact+eye
  const weights = lineupPlayers.map(p => {
    const contact = (p!.batting.contact_L + p!.batting.contact_R) / 2;
    const eye = p!.batting.eye;
    return Math.max(0.1, (contact * 0.7 + eye * 0.3) / 100);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const paPerPlayer = weights.map(w => Math.round((w / totalWeight) * totalPa));

  // Distribute hits, HR, BB, SO across lineup
  let totalHitsLeft = Math.round(runsScored * 1.8 + rng.next() * 3);
  // HR: roughly 1 per 4-5 runs scored, but at least 1 per ~3 games (Poisson-like).
  // Use probability: if runs >= 2, ~40% chance of at least 1 HR.
  const hrExpected = runsScored * 0.3;
  let totalHRLeft = Math.floor(hrExpected) + (rng.next() < (hrExpected % 1) ? 1 : 0);
  let totalRunsLeft = runsScored;

  for (let i = 0; i < lineupPlayers.length; i++) {
    const p = lineupPlayers[i]!;
    const pa = paPerPlayer[i] ?? 4;
    const contact = (p.batting.contact_L + p.batting.contact_R) / 2;
    const power = (p.batting.power_L + p.batting.power_R) / 2;
    const eye = p.batting.eye;
    const speed = p.batting.speed;

    // AB = PA - BB
    const bbRate = clamp(0.04 + (eye / 100) * 0.14, 0.04, 0.18);
    const bb = Math.round(pa * bbRate * (0.8 + rng.next() * 0.4));
    const ab = Math.max(0, pa - bb);

    // Hits from contact rating
    const hitRate = clamp(0.15 + (contact / 100) * 0.20, 0.15, 0.35);
    const h = Math.min(ab, Math.min(totalHitsLeft, Math.round(ab * hitRate * (0.7 + rng.next() * 0.6))));
    totalHitsLeft = Math.max(0, totalHitsLeft - h);

    // HR from power — use probabilistic approach: each AB has hrRate chance of HR
    const hrRate = clamp(0.02 + (power / 100) * 0.10, 0.01, 0.12);
    // Poisson approximation: expected HRs = ab * hrRate, generate via CDF sampling
    const hrExpectedPerBatter = ab * hrRate;
    const hrRoll = rng.next();
    // P(HR >= 1) = 1 - e^(-lambda), P(HR >= 2) = e^(-lambda)*(1+lambda) continuation...
    // Simple approach: floor(expected) + 1 if random < fractional part (add noise)
    const hrBase = Math.floor(hrExpectedPerBatter);
    const hrBonus = hrRoll < (hrExpectedPerBatter - hrBase) ? 1 : 0;
    const hr = Math.min(h, Math.min(totalHRLeft, hrBase + hrBonus));
    totalHRLeft = Math.max(0, totalHRLeft - hr);

    // Doubles/triples — use consistent rates, not 0..1 random multiplier
    const nonHrHits = h - hr;
    const doublesRate = clamp(0.12 + (power / 100) * 0.12, 0.08, 0.25);
    const doubles = Math.min(nonHrHits, Math.round(nonHrHits * doublesRate * (0.7 + rng.next() * 0.6)));
    const triples = nonHrHits - doubles > 0 ? (speed > 65 && rng.next() > 0.65 ? 1 : 0) : 0;

    // SO from avoid_k
    const kRate = clamp(0.10 + ((100 - p.batting.avoid_k) / 100) * 0.20, 0.08, 0.32);
    const so = Math.round((ab - h) * kRate * (0.5 + rng.next()));

    // SB from steal
    const sb = speed > 60 && p.batting.steal > 50 ? Math.floor(rng.next() * 2) : 0;

    // R/RBI distribution — spread all runs across the lineup proportionally to hits
    // Use a share based on position in order + hits, rounded at the end
    const runShare = (i < 4 ? 0.15 : 0.08) + (h > 0 ? 0.05 : 0);
    const r = Math.min(totalRunsLeft, Math.round(totalRunsLeft * runShare * (0.6 + rng.next() * 0.8)));
    const rbi = hr + Math.round(rng.next() * Math.max(0, h - hr));

    const avg = ab === 0 ? '.000' : (h / ab).toFixed(3).replace(/^0/, '');

    lines.push({
      playerId: p.id,
      name: getPlayerName(p),
      position: team.lineup[i]?.position ?? p.position,
      ab: Math.max(0, ab),
      r: Math.max(0, r),
      h: Math.max(0, h),
      rbi: Math.max(0, rbi),
      bb: Math.max(0, bb),
      so: Math.max(0, so),
      hr: Math.max(0, hr),
      doubles: Math.max(0, doubles),
      triples: Math.max(0, triples),
      sb: Math.max(0, sb),
      avg,
    });

    totalRunsLeft = Math.max(0, totalRunsLeft - r);
  }

  return lines;
}

/**
 * Generate approximate pitcher line for quick sim.
 * Starting pitcher gets most of the innings; closer might get a save.
 */
export function generatePitcherLine(
  team: Team,
  runsAllowed: number,
  won: boolean,
  rng: RandomProvider
): BoxScorePitcher[] {
  const starterId = team.rotation?.[team.rotationIndex ?? 0] ?? team.pitcherId;
  const starter = team.roster.players.find(p => p.id === starterId);

  if (!starter) return [];

  const stamina = starter.pitching.stamina;
  // IP: based on stamina, 4.0–9.0 range
  const rawIp = clamp(4.0 + (stamina / 100) * 5.0 + (rng.next() - 0.5) * 2, 3.0, 9.0);
  const fullInnings = Math.floor(rawIp);
  const thirds = Math.floor(rng.next() * 3);
  const ipThirds = fullInnings * 3 + thirds;
  const innings = ipThirds / 3;

  const control = starter.pitching.control;
  const stuff = starter.pitching.stuff;

  // SO/BB/H from ratings
  const k9Rate = clamp(4 + (stuff / 100) * 9, 4, 13);
  const bb9Rate = clamp(1 + ((100 - control) / 100) * 5, 1, 6);
  const h9Rate = clamp(6 + ((100 - stuff) / 100) * 4, 5, 11);

  const so = Math.round((k9Rate / 9) * innings * (0.8 + rng.next() * 0.4));
  const bb = Math.round((bb9Rate / 9) * innings * (0.8 + rng.next() * 0.4));
  const h = Math.round((h9Rate / 9) * innings * (0.8 + rng.next() * 0.4));
  const hr = Math.floor(runsAllowed * 0.3 * rng.next());
  const er = Math.min(runsAllowed, Math.round(runsAllowed * (0.8 + rng.next() * 0.4)));
  const pitchCount = Math.round(ipThirds * 5.5 + rng.next() * 5);

  const decision: BoxScorePitcher['decision'] = won ? 'W' : 'L';

  return [{
    playerId: starterId,
    name: getPlayerName(starter),
    ip: formatIP(ipThirds),
    h: Math.max(0, h),
    r: Math.max(0, runsAllowed),
    er: Math.max(0, er),
    bb: Math.max(0, bb),
    so: Math.max(0, so),
    hr: Math.max(0, hr),
    pitchCount: Math.max(ipThirds * 4, pitchCount),
    decision,
  }];
}

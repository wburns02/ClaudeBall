import type { Player } from '../types/index.ts';
import type { RandomProvider } from '../core/RandomProvider.ts';

export type MoraleLabel = 'Miserable' | 'Unhappy' | 'Neutral' | 'Content' | 'Motivated' | 'Ecstatic';

export interface MoraleEvent {
  playerId: string;
  playerName: string;
  delta: number;
  reason: string;
  day: number;
}

export interface TeamChemistry {
  score: number;       // 0-100
  label: string;
  trend: 'up' | 'down' | 'stable';
  factors: ChemFactor[];
}

export interface ChemFactor {
  label: string;
  impact: number;  // -10 to +10
  description: string;
}

// ── Morale labels ────────────────────────────────────────────────────────────

export function getMoraleLabel(morale: number): MoraleLabel {
  if (morale < 20) return 'Miserable';
  if (morale < 35) return 'Unhappy';
  if (morale < 50) return 'Neutral';
  if (morale < 65) return 'Content';
  if (morale < 80) return 'Motivated';
  return 'Ecstatic';
}

export function getMoraleColor(morale: number): string {
  if (morale < 20) return '#ef4444';   // red-500
  if (morale < 35) return '#f97316';   // orange-500
  if (morale < 50) return '#eab308';   // yellow-500
  if (morale < 65) return '#84cc16';   // lime-500
  if (morale < 80) return '#22c55e';   // green-500
  return '#06b6d4';                     // cyan-500
}

/** Performance multiplier from morale: 0.88 to 1.08 */
export function getMoraleMultiplier(morale: number): number {
  const normalized = (morale - 50) / 50; // -1 to +1
  return 1 + normalized * 0.08;
}

// ── Initialize morale for a new franchise ────────────────────────────────────

export function initPlayerMorale(player: Player): number {
  // Base from mental attributes
  const base = 45 + (player.mental.work_ethic / 100) * 15 + (player.mental.consistency / 100) * 10;
  // Slight variation by age
  const ageFactor = player.age < 25 ? 5 : player.age > 35 ? -5 : 0;
  return Math.round(Math.min(95, Math.max(10, base + ageFactor)));
}

// ── Daily morale update ──────────────────────────────────────────────────────

export interface DailyMoraleInput {
  player: Player;
  currentMorale: number;
  teamWins: number;
  teamLosses: number;
  recentWins: number;  // last 10 games
  recentLosses: number;
  gamesPlayed: number;
  gamesInLineup: number;   // how many of those this player played
  contractYearsLeft: number;
  salaryPercDiff: number;  // how % over/under market (negative = underpaid)
  isStarter: boolean;
  day: number;
  rng: RandomProvider;
}

export function computeDailyMoraleChange(input: DailyMoraleInput): { delta: number; reason: string | null } {
  const {
    player, currentMorale, recentWins, recentLosses, gamesPlayed,
    gamesInLineup, contractYearsLeft, salaryPercDiff, isStarter, rng
  } = input;

  let delta = 0;
  const reasons: string[] = [];

  // 1. Win/loss momentum — based on last 10 games
  const recentTotal = recentWins + recentLosses;
  if (recentTotal >= 5) {
    const winRate = recentWins / recentTotal;
    if (winRate >= 0.7) { delta += 1.5; reasons.push('winning streak'); }
    else if (winRate >= 0.55) { delta += 0.5; }
    else if (winRate <= 0.3) { delta -= 1.5; reasons.push('losing streak'); }
    else if (winRate <= 0.45) { delta -= 0.5; }
  }

  // 2. Playing time — happens every 5 days to avoid noise
  if (input.day % 5 === 0 && gamesPlayed >= 5) {
    const playRate = gamesInLineup / gamesPlayed;
    if (isStarter && playRate < 0.5) {
      delta -= 2;
      reasons.push('not getting enough playing time');
    } else if (!isStarter && playRate > 0.7) {
      delta += 1;
      reasons.push('earning more playing time');
    } else if (isStarter && playRate >= 0.85) {
      delta += 0.5;
    }
  }

  // 3. Contract security — checked weekly
  if (input.day % 7 === 0) {
    if (contractYearsLeft === 0) {
      delta -= 1.5;
      reasons.push('contract uncertainty heading into free agency');
    } else if (contractYearsLeft >= 3) {
      delta += 0.5;
    }
    // Underpaid players (salaryPercDiff < -15%) feel slighted
    if (salaryPercDiff < -0.15) {
      delta -= 1;
      reasons.push('feeling underpaid');
    } else if (salaryPercDiff > 0.2) {
      delta += 0.5;
    }
  }

  // 4. Leadership contagion — high-morale leaders lift the room
  const leadership = player.mental.leadership;
  if (currentMorale > 75 && leadership > 70) {
    delta += 0.3;
  }

  // 5. Mean-reversion toward 60 (natural baseline)
  const baseline = 58 + (player.mental.work_ethic / 100) * 8;
  if (currentMorale > baseline + 20) delta -= 0.4;
  if (currentMorale < baseline - 20) delta += 0.4;

  // 6. Random noise — dampened by composure/consistency
  const noiseScale = 1 - (player.mental.composure / 100) * 0.5;
  const noise = (rng.next() - 0.5) * 2 * noiseScale;
  delta += noise;

  // Round and clamp
  const roundedDelta = Math.round(delta * 2) / 2; // nearest 0.5
  if (Math.abs(roundedDelta) < 0.5) return { delta: 0, reason: null };

  const topReason = reasons.length > 0 ? reasons[0] : null;
  return { delta: roundedDelta, reason: topReason };
}

// ── Team Chemistry ───────────────────────────────────────────────────────────

export function computeTeamChemistry(
  players: Player[],
  morales: Record<string, number>,
  teamWins: number,
  teamLosses: number,
): TeamChemistry {
  if (players.length === 0) {
    return { score: 60, label: 'Neutral', trend: 'stable', factors: [] };
  }

  // Weighted average — stars (higher OVR) count more
  let weightedSum = 0;
  let totalWeight = 0;
  for (const p of players) {
    const m = morales[p.id] ?? 60;
    const w = 1 + (p.mental.leadership / 100) * 0.5;
    weightedSum += m * w;
    totalWeight += w;
  }
  const avgMorale = totalWeight > 0 ? weightedSum / totalWeight : 60;

  // Spread penalty — high variance hurts chemistry
  const moraleValues = players.map(p => morales[p.id] ?? 60);
  const avg = moraleValues.reduce((a, b) => a + b, 0) / moraleValues.length;
  const variance = moraleValues.reduce((sum, v) => sum + (v - avg) ** 2, 0) / moraleValues.length;
  const spreadPenalty = Math.min(10, Math.sqrt(variance) * 0.3);

  const rawScore = Math.max(10, Math.min(99, avgMorale - spreadPenalty));
  const score = Math.round(rawScore);

  const label = score >= 80 ? 'Electric' :
                score >= 65 ? 'Positive' :
                score >= 50 ? 'Neutral' :
                score >= 35 ? 'Tense' : 'Toxic';

  // Win rate factor
  const gamesPlayed = teamWins + teamLosses;
  const winRate = gamesPlayed > 0 ? teamWins / gamesPlayed : 0.5;

  const factors: ChemFactor[] = [];

  if (winRate >= 0.6) factors.push({ label: 'Winning', impact: 8, description: 'Team is in playoff contention' });
  else if (winRate <= 0.4) factors.push({ label: 'Losing', impact: -8, description: 'Losses are wearing on the clubhouse' });

  const highMorale = moraleValues.filter(v => v >= 75).length;
  const lowMorale = moraleValues.filter(v => v < 35).length;
  if (highMorale >= 3) factors.push({ label: 'Veterans\' Positivity', impact: 5, description: `${highMorale} players are highly motivated` });
  if (lowMorale >= 2) factors.push({ label: 'Clubhouse Discontent', impact: -6, description: `${lowMorale} players are struggling mentally` });

  if (spreadPenalty > 7) factors.push({ label: 'Divided Clubhouse', impact: -Math.round(spreadPenalty), description: 'Big morale gaps between players' });
  else if (spreadPenalty < 3) factors.push({ label: 'Unified Roster', impact: 4, description: 'Consistent morale throughout roster' });

  const trend: TeamChemistry['trend'] =
    score >= 65 ? 'up' :
    score <= 45 ? 'down' : 'stable';

  return { score, label, trend, factors };
}

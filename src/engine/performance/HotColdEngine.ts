import type { GameLogEntry } from '@/stores/statsStore.ts';

export type FormStatus = 'hot' | 'warm' | 'neutral' | 'cool' | 'cold';

export interface FormSummary {
  playerId: string;
  formScore: number;   // -20 to +20, normalized
  status: FormStatus;
  moraleTarget: number; // 0-100 target morale for this player
  recentGames: number;
  isPitcher: boolean;
  // Batter stats (last 7 games)
  recentAB?: number;
  recentH?: number;
  recentHR?: number;
  recentRBI?: number;
  recentBA?: number;
  recentOPS?: number;
  seasonBA?: number;
  // Pitcher stats (last 3 starts)
  recentIP?: number;
  recentER?: number;
  recentERA?: number;
  recentK?: number;
  seasonERA?: number;
  // Streak display e.g. "4H" (4-game hitting streak), "0-15 slump"
  streakLabel: string;
}

/** Extract batter-only log entries (non-pitchers or DH appearances) */
function isBatterEntry(entry: GameLogEntry): boolean {
  return entry.ab > 0;
}

/** Extract pitcher entries (entries with IP > 0) */
function isPitcherEntry(entry: GameLogEntry): boolean {
  return entry.ip !== '0.0' && entry.ip !== '' && entry.ip !== '0';
}

/** Parse IP string like "6.2" to decimal innings (6.667) */
function parseIP(ip: string): number {
  if (!ip || ip === '0' || ip === '0.0') return 0;
  const parts = ip.split('.');
  const full = parseInt(parts[0] ?? '0', 10);
  const frac = parseInt(parts[1] ?? '0', 10);
  return full + frac / 3;
}

/**
 * Compute a form summary for a player from their game log.
 * Uses last 7 games for batters, last 3 pitcher appearances.
 */
export function computeFormSummary(
  playerId: string,
  gameLog: GameLogEntry[],
  position: string,
  seasonBatting?: { ab: number; h: number; bb: number; hr: number },
  seasonPitching?: { ip: number; er: number; bb: number; so: number },
): FormSummary {
  const isPitcher = position === 'P' || position === 'RP' || position === 'SP';

  const sorted = [...gameLog].sort((a, b) => b.date - a.date);

  const base: FormSummary = {
    playerId,
    formScore: 0,
    status: 'neutral',
    moraleTarget: 60,
    recentGames: 0,
    isPitcher,
    streakLabel: '—',
  };

  if (isPitcher) {
    const pitcherGames = sorted.filter(isPitcherEntry).slice(0, 3);
    if (pitcherGames.length === 0) return base;

    const totalIP = pitcherGames.reduce((s, g) => s + parseIP(g.ip), 0);
    const totalER = pitcherGames.reduce((s, g) => s + g.er, 0);
    const totalK = pitcherGames.reduce((s, g) => s + g.kPitching, 0);
    const recentERA = totalIP > 0 ? (totalER / totalIP) * 9 : 99;

    // Use season ERA as baseline; fall back to league average when sample is tiny
    const seasonERA = seasonPitching && seasonPitching.ip >= 3  // at least 1 full start
      ? (seasonPitching.er / seasonPitching.ip) * 9
      : 4.00; // league average ERA baseline for early season

    // Form score: how much better/worse than season ERA
    // -3 ERA below season = +20, +3 ERA above season = -20
    const eraDiff = seasonERA - recentERA; // positive = doing better than season
    const formScore = Math.round(Math.max(-20, Math.min(20, eraDiff * 6.67)));

    // Streak label
    const lastStart = pitcherGames[0];
    const lastERA = lastStart ? parseIP(lastStart.ip) > 0
      ? ((lastStart.er / parseIP(lastStart.ip)) * 9).toFixed(2)
      : 'ND'
      : '—';
    const streakLabel = `Last: ${lastERA === 'ND' ? 'ND' : `${lastERA} ERA`}`;

    return {
      ...base,
      formScore,
      status: formScoreToStatus(formScore),
      moraleTarget: formScoreToMorale(formScore),
      recentGames: pitcherGames.length,
      recentIP: Math.round(totalIP * 10) / 10,
      recentER: totalER,
      recentERA: Math.round(recentERA * 100) / 100,
      recentK: totalK,
      seasonERA: Math.round(seasonERA * 100) / 100,
      streakLabel,
    };
  }

  // Batter logic — last 7 games with AB > 0
  const batterGames = sorted.filter(isBatterEntry).slice(0, 7);
  if (batterGames.length === 0) return base;

  const recentAB = batterGames.reduce((s, g) => s + g.ab, 0);
  const recentH = batterGames.reduce((s, g) => s + g.h, 0);
  const recentHR = batterGames.reduce((s, g) => s + g.hr, 0);
  const recentRBI = batterGames.reduce((s, g) => s + g.rbi, 0);
  const recentBB = batterGames.reduce((s, g) => s + g.bb, 0);
  const recentBA = recentAB > 0 ? recentH / recentAB : 0;
  const recentOBP = (recentAB + recentBB) > 0 ? (recentH + recentBB) / (recentAB + recentBB) : 0;
  const recentSlg = recentAB > 0
    ? batterGames.reduce((s, g) => s + g.h + g.doubles + g.triples * 2 + g.hr * 3, 0) / recentAB
    : 0;
  const recentOPS = recentOBP + recentSlg;

  // Use season BA as baseline; fall back to league average when sample is tiny
  // (< 15 AB means last-7 ≈ whole season → baDiff would always be ~0)
  const seasonBA = seasonBatting && seasonBatting.ab >= 15
    ? seasonBatting.h / seasonBatting.ab
    : 0.265; // league average baseline for early season

  // Form score: difference from season BA, scaled
  // +0.060 BA above season = +20, -0.060 BA below = -20
  const baDiff = recentBA - seasonBA;
  const formScore = Math.round(Math.max(-20, Math.min(20, baDiff * 333)));

  // Streak detection: consecutive hitless ABS or multi-hit games
  let streakLabel = '—';
  let hitStreak = 0;
  let slumpAB = 0;
  let slumpH = 0;
  for (const g of sorted.filter(isBatterEntry)) {
    if (g.h > 0 && slumpAB === 0) hitStreak++;
    else if (g.h === 0 && hitStreak === 0) { slumpAB += g.ab; slumpH += g.h; }
    else break;
  }
  if (hitStreak >= 5) streakLabel = `${hitStreak}-Game Hit Streak`;
  else if (hitStreak >= 3) streakLabel = `${hitStreak} In A Row`;
  else if (slumpAB >= 10 && slumpH === 0) streakLabel = `0-${slumpAB} Slump`;
  else if (recentBA > 0.350 && recentAB >= 15) streakLabel = `Scorching Hot`;

  return {
    ...base,
    formScore,
    status: formScoreToStatus(formScore),
    moraleTarget: formScoreToMorale(formScore),
    recentGames: batterGames.length,
    recentAB,
    recentH,
    recentHR,
    recentRBI,
    recentBA: Math.round(recentBA * 1000) / 1000,
    recentOPS: Math.round(recentOPS * 1000) / 1000,
    seasonBA: Math.round(seasonBA * 1000) / 1000,
    streakLabel,
  };
}

function formScoreToStatus(score: number): FormStatus {
  if (score >= 12) return 'hot';
  if (score >= 4) return 'warm';
  if (score <= -12) return 'cold';
  if (score <= -4) return 'cool';
  return 'neutral';
}

function formScoreToMorale(score: number): number {
  // Map -20..+20 → 30..95
  return Math.round(30 + ((score + 20) / 40) * 65);
}

/** Status display config */
export const FORM_STATUS_CONFIG: Record<FormStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  ratingMod: number; // % modification to apply to offense/pitching ratings
}> = {
  hot:     { label: 'HOT',     color: 'text-orange-400', bgColor: 'bg-orange-500/15', borderColor: 'border-orange-500/40', icon: '🔥', ratingMod: +0.08 },
  warm:    { label: 'WARM',    color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', icon: '↑',  ratingMod: +0.03 },
  neutral: { label: 'AVERAGE', color: 'text-cream-dim',  bgColor: 'bg-navy-lighter/20', borderColor: 'border-navy-lighter', icon: '—',  ratingMod:  0.00 },
  cool:    { label: 'COOL',    color: 'text-blue',       bgColor: 'bg-blue/10',        borderColor: 'border-blue/30',        icon: '↓',  ratingMod: -0.03 },
  cold:    { label: 'COLD',    color: 'text-blue-300',   bgColor: 'bg-blue-500/15',    borderColor: 'border-blue-500/40',    icon: '❄',  ratingMod: -0.08 },
};

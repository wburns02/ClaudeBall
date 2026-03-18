import type { BattingStats, PitchingStats } from '../types/stats.ts';
import { battingAvg, onBasePct, slugging, era, whip } from '../types/stats.ts';

// wOBA weights (2024 MLB constants)
const wOBA_WEIGHTS = {
  bb: 0.690,
  hbp: 0.722,
  single: 0.888,
  double: 1.271,
  triple: 1.616,
  hr: 2.101,
};
const wOBA_SCALE = 1.157; // wOBA to runs scale factor

/** Batting Average on Balls In Play */
export function babip(s: BattingStats): number {
  const singles = s.h - s.doubles - s.triples - s.hr;
  const num = singles + s.doubles + s.triples;
  const denom = s.ab - s.so - s.hr + s.sf;
  return denom <= 0 ? 0 : num / denom;
}

/** Isolated Power: SLG - BA */
export function iso(s: BattingStats): number {
  return slugging(s) - battingAvg(s);
}

/** Weighted On-Base Average */
export function woba(s: BattingStats): number {
  const singles = s.h - s.doubles - s.triples - s.hr;
  const num =
    wOBA_WEIGHTS.bb * s.bb +
    wOBA_WEIGHTS.hbp * s.hbp +
    wOBA_WEIGHTS.single * singles +
    wOBA_WEIGHTS.double * s.doubles +
    wOBA_WEIGHTS.triple * s.triples +
    wOBA_WEIGHTS.hr * s.hr;
  const denom = s.ab + s.bb - 0 /* no IBB */ + s.sf + s.hbp;
  return denom <= 0 ? 0 : num / denom;
}

/** wRC+ — wRC normalized to league average * 100.
 *  leagueWoba: league average wOBA, leagueRppa: league runs per plate appearance.
 *  100 = league average.
 */
export function wrcPlus(s: BattingStats, leagueWoba: number, leagueRppa: number): number {
  if (s.pa === 0 || leagueWoba === 0) return 100;
  // Use a minimum leagueRppa so the formula stays stable even if run tracking is sparse.
  // MLB baseline is ~0.11 R/PA (4.5 R/G * 2 teams / ~81 PA per team per game).
  const effectiveRppa = Math.max(leagueRppa, 0.08);
  const playerWoba = woba(s);
  const wRC = ((playerWoba - leagueWoba) / wOBA_SCALE + effectiveRppa) * s.pa;
  const leagueWRC = effectiveRppa * s.pa;
  if (leagueWRC <= 0) return 100;
  const raw = Math.round((wRC / leagueWRC) * 100);
  // Clamp to reasonable range [0, 300] to prevent display issues
  return Math.max(0, Math.min(300, raw));
}

/** OPS+ — OPS normalized to league average * 100. */
export function opsPlus(s: BattingStats, leagueObp: number, leagueSlg: number): number {
  if (leagueObp === 0 || leagueSlg === 0) return 100;
  const playerOps = onBasePct(s) / leagueObp + slugging(s) / leagueSlg - 1;
  return Math.round(playerOps * 100);
}

/** ERA+ — ERA normalized to league average. 100 = average, higher is better. */
export function eraPlus(s: PitchingStats, leagueEra: number): number {
  const pEra = era(s);
  if (pEra === 0 && s.ip === 0) return 100;
  if (pEra === 0) return 200; // perfect ERA
  return Math.round((leagueEra / pEra) * 100);
}

/** FIP — Fielding Independent Pitching */
export function fip(s: PitchingStats, fipConstant = 3.10): number {
  const innings = s.ip / 3;
  if (innings === 0) return fipConstant;
  return (13 * s.hr + 3 * s.bb - 2 * s.so) / innings + fipConstant;
}

/** K/9 */
export function k9(s: PitchingStats): number {
  const innings = s.ip / 3;
  return innings === 0 ? 0 : (s.so / innings) * 9;
}

/** BB/9 */
export function bb9(s: PitchingStats): number {
  const innings = s.ip / 3;
  return innings === 0 ? 0 : (s.bb / innings) * 9;
}

/** HR/9 */
export function hr9(s: PitchingStats): number {
  const innings = s.ip / 3;
  return innings === 0 ? 0 : (s.hr / innings) * 9;
}

/** K/BB ratio */
export function kBbRatio(s: PitchingStats): number {
  return s.bb === 0 ? (s.so > 0 ? 99.0 : 0) : s.so / s.bb;
}

/** Simplified WAR for batters.
 *  Uses wRC+ to estimate batting runs, adds rough positional adjustment.
 *  Scaled to a 162-game season at league average = 2 WAR.
 */
export function battingWar(
  s: BattingStats,
  leagueWoba: number,
  leagueRppa: number,
  positionAdj = 0 // runs per 162 games (e.g. SS = +7, 1B = -9)
): number {
  if (s.pa === 0) return 0;
  const playerWoba = woba(s);
  // Batting runs above average per PA
  const battingRunsPerPa = (playerWoba - leagueWoba) / wOBA_SCALE;
  const battingRuns = battingRunsPerPa * s.pa;
  // Positional adj scaled to actual PA (rough 700 PA = full season)
  const scaledPosAdj = positionAdj * (s.pa / 700);
  // Replacement level = -20 runs per 600 PA
  const replacementRuns = -20 * (s.pa / 600);
  const totalRuns = battingRuns + scaledPosAdj - replacementRuns;
  // 10 runs = 1 WAR
  return Math.round((totalRuns / 10) * 10) / 10;
}

/** Simplified WAR for pitchers (RA9-WAR style using FIP). */
export function pitchingWar(s: PitchingStats, leagueEra: number): number {
  const innings = s.ip / 3;
  if (innings === 0) return 0;
  const playerFip = fip(s);
  // FIP - league ERA = runs saved per 9 innings
  const runsSavedPer9 = leagueEra - playerFip;
  const runsSaved = (runsSavedPer9 / 9) * innings;
  // Replacement level: ~5.0 ERA pitcher, so bonus for just pitching
  const replacementBonus = (innings / 9) * 0.2;
  return Math.round(((runsSaved + replacementBonus) / 10) * 10) / 10;
}

// Position adjustments (runs per 162 games, MLB standard)
export const POSITION_ADJ: Record<string, number> = {
  C: 12,
  SS: 7,
  CF: 2,
  '2B': 3,
  '3B': 2,
  LF: -7,
  RF: -7,
  '1B': -12,
  DH: -17,
  P: 0,
};

export interface BattingAdvanced {
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  babip: number;
  iso: number;
  woba: number;
  wrcPlus: number;
  opsPlus: number;
  war: number;
}

export interface PitchingAdvanced {
  era: number;
  whip: number;
  fip: number;
  eraPlus: number;
  k9: number;
  bb9: number;
  hr9: number;
  kBb: number;
  war: number;
}

export interface LeagueContext {
  avgWoba: number;
  avgRppa: number;
  avgObp: number;
  avgSlg: number;
  avgEra: number;
}

export function calcBattingAdvanced(s: BattingStats, ctx: LeagueContext, position = 'DH'): BattingAdvanced {
  const posAdj = POSITION_ADJ[position] ?? 0;
  return {
    avg: battingAvg(s),
    obp: onBasePct(s),
    slg: slugging(s),
    ops: onBasePct(s) + slugging(s),
    babip: babip(s),
    iso: iso(s),
    woba: woba(s),
    wrcPlus: wrcPlus(s, ctx.avgWoba, ctx.avgRppa),
    opsPlus: opsPlus(s, ctx.avgObp, ctx.avgSlg),
    war: battingWar(s, ctx.avgWoba, ctx.avgRppa, posAdj),
  };
}

export function calcPitchingAdvanced(s: PitchingStats, ctx: LeagueContext): PitchingAdvanced {
  return {
    era: era(s),
    whip: whip(s),
    fip: fip(s),
    eraPlus: eraPlus(s, ctx.avgEra),
    k9: k9(s),
    bb9: bb9(s),
    hr9: hr9(s),
    kBb: kBbRatio(s),
    war: pitchingWar(s, ctx.avgEra),
  };
}

/** Derive a LeagueContext from aggregate stats (from StatAccumulator). */
export function deriveLeagueContext(
  totalAB: number,
  totalPA: number,
  totalH: number,
  totalDoubles: number,
  totalTriples: number,
  totalHR: number,
  totalBB: number,
  totalHBP: number,
  totalSF: number,
  totalSO: number,
  totalRuns: number,
  gamesPlayed: number,
  totalER: number,
  totalIP: number, // in thirds
  totalGameRuns?: number, // actual scored runs from game results (more reliable)
): LeagueContext {
  // Build aggregate BattingStats
  const agg: BattingStats = {
    pa: totalPA, ab: totalAB, h: totalH,
    doubles: totalDoubles, triples: totalTriples, hr: totalHR,
    rbi: 0, r: totalRuns, bb: totalBB, so: totalSO,
    hbp: totalHBP, sb: 0, cs: 0, sf: totalSF, sh: 0, gidp: 0,
  };

  const avgWoba = woba(agg);
  const avgObp = onBasePct(agg);
  const avgSlg = slugging(agg);
  // Prefer game-score runs for R/PA (more reliable than batter-credited runs).
  // MLB baseline ~0.11 R/PA (4.5 R/G * 2 teams / ~82 PA/team/game).
  const runsForRppa = (totalGameRuns ?? 0) > 0 ? (totalGameRuns ?? 0) : totalRuns;
  const avgRppa = totalPA === 0 ? 0.11 : Math.max(0.08, runsForRppa / totalPA);
  const innings = totalIP / 3;
  const avgEra = innings === 0 ? 4.00 : (totalER / innings) * 9;

  return { avgWoba, avgRppa, avgObp, avgSlg, avgEra };
}

/** Default league context for when no actual data is available. */
export const DEFAULT_LEAGUE_CONTEXT: LeagueContext = {
  avgWoba: 0.320,
  avgRppa: 0.110,
  avgObp: 0.320,
  avgSlg: 0.420,
  avgEra: 4.20,
};

/** Format a stat to a fixed decimal string. */
export function fmtStat(val: number, decimals: number, forceSign = false): string {
  const fixed = val.toFixed(decimals);
  if (forceSign && val > 0) return `+${fixed}`;
  return fixed;
}

/** Format AVG/OBP/SLG style (drop leading zero). */
export function fmtAvg(val: number): string {
  if (val <= 0) return '.000';
  return val.toFixed(3).replace(/^0/, '');
}

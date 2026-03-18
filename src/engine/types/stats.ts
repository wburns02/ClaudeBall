export interface BattingStats {
  pa: number;
  ab: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  r: number;
  bb: number;
  so: number;
  hbp: number;
  sb: number;
  cs: number;
  sf: number;
  sh: number;
  gidp: number;
}

export interface PitchingStats {
  ip: number;       // in thirds (18 = 6.0 IP)
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  hr: number;
  pitchCount: number;
  bf: number;        // batters faced
  wins: number;
  losses: number;
  saves: number;
  holds: number;
}

export function battingAvg(s: BattingStats): number {
  return s.ab === 0 ? 0 : s.h / s.ab;
}

export function onBasePct(s: BattingStats): number {
  const denom = s.ab + s.bb + s.hbp + s.sf;
  return denom === 0 ? 0 : (s.h + s.bb + s.hbp) / denom;
}

export function slugging(s: BattingStats): number {
  if (s.ab === 0) return 0;
  const singles = s.h - s.doubles - s.triples - s.hr;
  return (singles + 2 * s.doubles + 3 * s.triples + 4 * s.hr) / s.ab;
}

export function ops(s: BattingStats): number {
  return onBasePct(s) + slugging(s);
}

export function formatIP(thirds: number): string {
  const full = Math.floor(thirds / 3);
  const remainder = thirds % 3;
  return `${full}.${remainder}`;
}

export function era(s: PitchingStats): number {
  const innings = s.ip / 3;
  return innings === 0 ? 0 : (s.er / innings) * 9;
}

export function whip(s: PitchingStats): number {
  const innings = s.ip / 3;
  return innings === 0 ? 0 : (s.bb + s.h) / innings;
}

export function kPer9(s: PitchingStats): number {
  const innings = s.ip / 3;
  return innings === 0 ? 0 : (s.so / innings) * 9;
}

export function strikeoutPct(s: BattingStats): number {
  return s.pa === 0 ? 0 : s.so / s.pa;
}

export function walkPct(s: BattingStats): number {
  return s.pa === 0 ? 0 : s.bb / s.pa;
}

export function hrPct(s: BattingStats): number {
  return s.pa === 0 ? 0 : s.hr / s.pa;
}

export function createEmptyBattingStats(): BattingStats {
  return { pa: 0, ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, r: 0, bb: 0, so: 0, hbp: 0, sb: 0, cs: 0, sf: 0, sh: 0, gidp: 0 };
}

export function createEmptyPitchingStats(): PitchingStats {
  return { ip: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, hr: 0, pitchCount: 0, bf: 0, wins: 0, losses: 0, saves: 0, holds: 0 };
}

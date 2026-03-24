import type { Player } from '../types/player.ts';

export interface BatterProjection {
  pa: number;
  avg: string;
  obp: string;
  slg: string;
  ops: string;
  hr: number;
  rbi: number;
  sb: number;
  so: number;
  bb: number;
  h: number;
  ab: number;
}

export interface PitcherProjection {
  era: string;
  whip: string;
  ip: string;
  so: number;
  bb: number;
  w: number;
  l: number;
  sv: number;
  h: number;
  hr: number;
}

/**
 * Project a full season of stats from a batter's ratings.
 * Based on 600 PA for a full season (scale by games if needed).
 */
export function projectBatter(player: Player, seasonGames = 162): BatterProjection {
  const b = player.batting;
  const scale = seasonGames / 162;
  const pa = Math.round(600 * scale);

  // BB rate from eye (8-14%)
  const bbRate = 0.06 + (b.eye / 100) * 0.10;
  const bb = Math.round(pa * bbRate);

  // K rate from avoid_k (12-30%)
  const kRate = 0.32 - (b.avoid_k / 100) * 0.20;
  const so = Math.round(pa * kRate);

  // AB = PA - BB (simplified, ignoring HBP/SF)
  const ab = pa - bb;

  // Contact rate → AVG (weighted L/R evenly for projection)
  const avgContact = (b.contact_L + b.contact_R) / 2;
  const avgBase = 0.180 + (avgContact / 100) * 0.140; // .180-.320 range
  const h = Math.round(ab * avgBase);
  const avg = avgBase;

  // Power → HR, SLG
  const avgPower = (b.power_L + b.power_R) / 2;
  const hrRate = (avgPower / 100) * 0.055; // 0-5.5% of AB
  const hr = Math.round(ab * hrRate);

  // Extra base hits from gap power
  const xbhRate = (b.gap_power / 100) * 0.06;
  const doubles = Math.round(ab * xbhRate);
  const triples = Math.round(ab * 0.005 * (b.speed / 100));

  // SLG = (1B + 2*2B + 3*3B + 4*HR) / AB
  const singles = Math.max(0, h - doubles - triples - hr);
  const totalBases = singles + doubles * 2 + triples * 3 + hr * 4;
  const slg = ab > 0 ? totalBases / ab : 0;

  // OBP = (H + BB) / PA
  const obp = pa > 0 ? (h + bb) / pa : 0;
  const ops = obp + slg;

  // RBI from power + clutch
  const rbi = Math.round(hr * 2.8 + (h - hr) * 0.25 * (1 + b.clutch / 200));

  // SB from speed + steal
  const sb = Math.round(((b.speed + b.steal) / 200) * 35 * scale);

  return {
    pa, ab, h, hr, rbi, sb, so, bb,
    avg: avg.toFixed(3).replace(/^0/, ''),
    obp: obp.toFixed(3).replace(/^0/, ''),
    slg: slg.toFixed(3).replace(/^0/, ''),
    ops: ops.toFixed(3).replace(/^0/, ''),
  };
}

/**
 * Project a full season of stats from a pitcher's ratings.
 * Starters: ~200 IP. Relievers: ~65 IP. Determined by stamina.
 */
export function projectPitcher(player: Player, seasonGames = 162): PitcherProjection {
  const p = player.pitching;
  const scale = seasonGames / 162;

  // IP based on stamina — starters get more
  const isStarter = p.stamina >= 55;
  const baseIP = isStarter ? 140 + (p.stamina / 100) * 70 : 50 + (p.stamina / 100) * 25;
  const ip = Math.round(baseIP * scale);

  // K/9 from stuff (5-12)
  const k9 = 5 + (p.stuff / 100) * 7;
  const so = Math.round((k9 / 9) * ip);

  // BB/9 from control (1.5-5.0)
  const bb9 = 5.0 - (p.control / 100) * 3.5;
  const bb = Math.round((bb9 / 9) * ip);

  // H/9 from stuff + movement (6.5-10)
  const h9 = 10 - ((p.stuff + p.movement) / 200) * 3.5;
  const h = Math.round((h9 / 9) * ip);

  // HR/9 from movement (0.5-1.8)
  const hr9 = 1.8 - (p.movement / 100) * 1.3;
  const hr = Math.round((hr9 / 9) * ip);

  // ERA from stuff + control + movement
  const combined = (p.stuff * 0.35 + p.control * 0.35 + p.movement * 0.30) / 100;
  const era = 5.5 - combined * 3.5; // 2.0-5.5 range

  // WHIP
  const whip = (h + bb) / Math.max(1, ip);

  // W/L based on ERA and run support (simplified)
  const winRate = isStarter ? Math.max(0.25, Math.min(0.75, 0.5 + (4.5 - era) * 0.08)) : 0;
  const starts = isStarter ? Math.round(ip / 6) : 0;
  const w = Math.round(starts * winRate);
  const l = Math.round(starts * (1 - winRate) * 0.7); // Not all non-wins are losses

  // Saves for relievers with good stuff
  const sv = !isStarter && p.stuff >= 60 ? Math.round(25 * (p.stuff / 100) * scale) : 0;

  return {
    ip: ip.toFixed(1),
    era: era.toFixed(2),
    whip: whip.toFixed(2),
    so, bb, h, hr, w, l, sv,
  };
}

/**
 * LeagueHighlights — scans season data to find dramatic moments across all 30 teams.
 * No-hitters, shutouts, blowouts, milestone wins, hot/cold streaks, close games.
 */
import type { ScheduledGame } from './ScheduleGenerator.ts';
import type { StandingsTracker } from './StandingsTracker.ts';
import type { Team } from '../types/index.ts';

export type HighlightType =
  | 'shutout'
  | 'blowout'
  | 'walk_off'
  | 'one_run'
  | 'high_scoring'
  | 'win_streak'
  | 'lose_streak'
  | 'milestone_win'
  | 'best_record'
  | 'worst_record'
  | 'pennant_race';

export interface LeagueHighlight {
  id: string;
  type: HighlightType;
  day: number;
  headline: string;
  detail: string;
  teamIds: string[];
  importance: 1 | 2 | 3; // 1=notable, 2=important, 3=historic
}

function gameId(g: ScheduledGame): string {
  return `${g.date}-${g.awayId}-${g.homeId}`;
}

export function generateHighlights(
  schedule: ScheduledGame[],
  standings: StandingsTracker,
  teams: Team[],
  currentDay: number,
): LeagueHighlight[] {
  const highlights: LeagueHighlight[] = [];
  const teamMap = new Map(teams.map(t => [t.id, t]));
  const name = (id: string) => { const t = teamMap.get(id); return t ? `${t.city} ${t.name}` : id; };
  const abbr = (id: string) => teamMap.get(id)?.abbreviation ?? id.slice(0, 3).toUpperCase();

  const played = schedule.filter(g => g.played && g.awayScore !== undefined && g.homeScore !== undefined);

  // ── Per-game highlights (recent 7 days with games) ──
  // If currentDay is past the last played game, anchor the window to the last played date
  const lastPlayedDay = played.length > 0 ? Math.max(...played.map(g => g.date)) : currentDay;
  const windowEnd = Math.min(currentDay, lastPlayedDay);
  const recentGames = played.filter(g => g.date >= windowEnd - 7 && g.date <= windowEnd);

  for (const g of recentGames) {
    const away = g.awayScore!;
    const home = g.homeScore!;
    const diff = Math.abs(away - home);
    const total = away + home;
    const winnerId = home > away ? g.homeId : g.awayId;
    const loserId = home > away ? g.awayId : g.homeId;

    // Shutout
    if ((away === 0 || home === 0) && total > 0) {
      highlights.push({
        id: `shut-${gameId(g)}`,
        type: 'shutout',
        day: g.date,
        headline: `${abbr(winnerId)} blanks ${abbr(loserId)}`,
        detail: `${name(winnerId)} pitches a shutout, winning ${Math.max(away,home)}-0 on Day ${g.date}.`,
        teamIds: [winnerId],
        importance: Math.max(away, home) >= 10 ? 3 : 2,
      });
    }

    // Blowout (10+ run differential)
    if (diff >= 10) {
      highlights.push({
        id: `blow-${gameId(g)}`,
        type: 'blowout',
        day: g.date,
        headline: `${abbr(winnerId)} demolishes ${abbr(loserId)} by ${diff}`,
        detail: `${name(winnerId)} wins ${Math.max(away,home)}-${Math.min(away,home)} in a historic blowout.`,
        teamIds: [winnerId, loserId],
        importance: diff >= 15 ? 3 : 2,
      });
    }

    // Walk-off (home team wins and scored in 9th or later)
    if (home > away && g.homeInnings && g.homeInnings.length >= 9) {
      const lastInning = g.homeInnings[g.homeInnings.length - 1];
      if (lastInning > 0) {
        highlights.push({
          id: `walkoff-${gameId(g)}`,
          type: 'walk_off',
          day: g.date,
          headline: `Walk-off! ${abbr(g.homeId)} wins in dramatic fashion`,
          detail: `${name(g.homeId)} scores ${lastInning} in the bottom of the ${g.homeInnings.length}${g.homeInnings.length===9?'th':g.homeInnings.length===1?'st':g.homeInnings.length===2?'nd':g.homeInnings.length===3?'rd':'th'} to beat ${name(g.awayId)} ${home}-${away}.`,
          teamIds: [g.homeId],
          importance: 2,
        });
      }
    }

    // One-run game
    if (diff === 1 && total >= 4) {
      highlights.push({
        id: `onerun-${gameId(g)}`,
        type: 'one_run',
        day: g.date,
        headline: `Nail-biter: ${abbr(winnerId)} edges ${abbr(loserId)}`,
        detail: `A tight ${Math.max(away,home)}-${Math.min(away,home)} contest decided by a single run.`,
        teamIds: [winnerId, loserId],
        importance: 1,
      });
    }

    // High-scoring (15+ combined runs)
    if (total >= 15) {
      highlights.push({
        id: `high-${gameId(g)}`,
        type: 'high_scoring',
        day: g.date,
        headline: `Slugfest! ${abbr(g.awayId)} vs ${abbr(g.homeId)}: ${total} total runs`,
        detail: `A combined ${total} runs in a wild ${away}-${home} affair.`,
        teamIds: [g.awayId, g.homeId],
        importance: total >= 20 ? 3 : 2,
      });
    }
  }

  // ── Streak highlights ──
  const teamGames = new Map<string, ScheduledGame[]>();
  for (const g of played) {
    for (const tid of [g.awayId, g.homeId]) {
      if (!teamGames.has(tid)) teamGames.set(tid, []);
      teamGames.get(tid)!.push(g);
    }
  }

  for (const [tid, games] of teamGames) {
    const sorted = games.sort((a, b) => a.date - b.date);

    // Track peak win/loss streaks across the entire season
    let curWin = 0, curLoss = 0, bestWin = 0, bestLoss = 0;

    for (const g of sorted) {
      const isHome = g.homeId === tid;
      const won = isHome ? (g.homeScore! > g.awayScore!) : (g.awayScore! > g.homeScore!);
      if (won) {
        curWin++;
        curLoss = 0;
        if (curWin > bestWin) bestWin = curWin;
      } else {
        curLoss++;
        curWin = 0;
        if (curLoss > bestLoss) bestLoss = curLoss;
      }
    }

    if (bestWin >= 7) {
      highlights.push({
        id: `wstreak-${tid}-${currentDay}`,
        type: 'win_streak',
        day: currentDay,
        headline: `${abbr(tid)} had a ${bestWin}-game win streak!`,
        detail: `${name(tid)} won ${bestWin} straight at their peak this season.`,
        teamIds: [tid],
        importance: bestWin >= 10 ? 3 : 2,
      });
    }

    if (bestLoss >= 7) {
      highlights.push({
        id: `lstreak-${tid}-${currentDay}`,
        type: 'lose_streak',
        day: currentDay,
        headline: `${abbr(tid)} endured a ${bestLoss}-game losing streak`,
        detail: `${name(tid)} dropped ${bestLoss} in a row at their worst this season.`,
        teamIds: [tid],
        importance: bestLoss >= 10 ? 3 : 2,
      });
    }
  }

  // ── Season milestones ──
  for (const t of teams) {
    const rec = standings.getRecord(t.id);
    if (!rec) continue;

    // Milestone wins (50, 75, 100)
    for (const milestone of [50, 75, 100]) {
      if (rec.wins === milestone) {
        highlights.push({
          id: `milestone-${t.id}-${milestone}`,
          type: 'milestone_win',
          day: currentDay,
          headline: `${abbr(t.id)} reaches ${milestone} wins!`,
          detail: `${name(t.id)} is now ${rec.wins}-${rec.losses} on the season.`,
          teamIds: [t.id],
          importance: milestone >= 100 ? 3 : 2,
        });
      }
    }
  }

  // ── Best/worst records ──
  const allRecords = teams.map(t => ({ id: t.id, ...(standings.getRecord(t.id) ?? { wins: 0, losses: 0 }) }));
  const sorted = allRecords.filter(r => r.wins + r.losses > 0).sort((a, b) => {
    const pctA = a.wins / (a.wins + a.losses);
    const pctB = b.wins / (b.wins + b.losses);
    return pctB - pctA;
  });

  if (sorted.length >= 2 && currentDay >= 30) {
    const best = sorted[0];
    highlights.push({
      id: `best-${currentDay}`,
      type: 'best_record',
      day: currentDay,
      headline: `${abbr(best.id)} leads baseball at ${best.wins}-${best.losses}`,
      detail: `${name(best.id)} has the best record in the league.`,
      teamIds: [best.id],
      importance: 2,
    });

    const worst = sorted[sorted.length - 1];
    highlights.push({
      id: `worst-${currentDay}`,
      type: 'worst_record',
      day: currentDay,
      headline: `${abbr(worst.id)} struggling at ${worst.wins}-${worst.losses}`,
      detail: `${name(worst.id)} sits at the bottom of the standings.`,
      teamIds: [worst.id],
      importance: 1,
    });

    // Pennant race — top 2 teams within 3 games
    if (sorted.length >= 2) {
      const pct1 = sorted[0].wins / (sorted[0].wins + sorted[0].losses);
      const pct2 = sorted[1].wins / (sorted[1].wins + sorted[1].losses);
      const gbDiff = Math.abs((sorted[0].wins - sorted[1].wins + sorted[1].losses - sorted[0].losses) / 2);
      if (gbDiff <= 3 && currentDay >= 90) {
        highlights.push({
          id: `pennant-${currentDay}`,
          type: 'pennant_race',
          day: currentDay,
          headline: `Pennant race! ${abbr(sorted[0].id)} and ${abbr(sorted[1].id)} separated by ${gbDiff.toFixed(1)} games`,
          detail: `The top two teams in baseball are locked in a tight race for the pennant.`,
          teamIds: [sorted[0].id, sorted[1].id],
          importance: 3,
        });
      }
    }
  }

  // Sort by importance (desc) then day (desc), deduplicate
  const seen = new Set<string>();
  return highlights
    .filter(h => { if (seen.has(h.id)) return false; seen.add(h.id); return true; })
    .sort((a, b) => b.importance - a.importance || b.day - a.day)
    .slice(0, 20);
}

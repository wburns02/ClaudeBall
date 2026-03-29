import type { RandomProvider } from '../core/RandomProvider.ts';

export interface ScheduledGame {
  id: string;
  gameNumber: number;
  awayId: string;
  homeId: string;
  date: number;       // day of season (1-183)
  played: boolean;
  awayScore?: number;
  homeScore?: number;
  awayInnings?: number[];  // runs per inning, away team
  homeInnings?: number[];  // runs per inning, home team
  awayStarterId?: string;  // pitcher who started this game (for stat recording)
  homeStarterId?: string;  // pitcher who started this game (for stat recording)
}

/**
 * Generates a 162-game schedule for a 30-team league.
 *
 * Structure: 2 leagues × 3 divisions × 5 teams.
 * - 76 games vs division rivals (19 each × 4 opponents)
 * - 66 games vs same-league non-division (6-7 each × 10 opponents)
 * - 20 games vs interleague (various opponents)
 */
export class ScheduleGenerator {
  static generate(
    leagueStructure: Record<string, Record<string, string[]>>,
    rng: RandomProvider
  ): ScheduledGame[] {
    const allTeams: string[] = [];
    const teamLeague = new Map<string, string>();
    const teamDivision = new Map<string, string>();

    for (const [league, divisions] of Object.entries(leagueStructure)) {
      for (const [division, teams] of Object.entries(divisions)) {
        for (const teamId of teams) {
          allTeams.push(teamId);
          teamLeague.set(teamId, league);
          teamDivision.set(teamId, `${league}-${division}`);
        }
      }
    }

    const matchups: Array<{ away: string; home: string }> = [];

    // Division games: 19 per opponent = 76 total
    for (const [league, divisions] of Object.entries(leagueStructure)) {
      for (const [_division, teams] of Object.entries(divisions)) {
        for (let i = 0; i < teams.length; i++) {
          for (let j = i + 1; j < teams.length; j++) {
            // 19 games: 10 home, 9 away (or vice versa, randomized)
            const aHome = rng.chance(0.5) ? 10 : 9;
            const bHome = 19 - aHome;
            for (let g = 0; g < aHome; g++) matchups.push({ away: teams[j], home: teams[i] });
            for (let g = 0; g < bHome; g++) matchups.push({ away: teams[i], home: teams[j] });
            void league; // used in outer loop
          }
        }
      }
    }

    // Same league, different division: ~66 games (6-7 per opponent)
    for (const teamId of allTeams) {
      const league = teamLeague.get(teamId)!;
      const div = teamDivision.get(teamId)!;
      const opponents = allTeams.filter(t =>
        teamLeague.get(t) === league && teamDivision.get(t) !== div
      );

      for (const opp of opponents) {
        if (teamId >= opp) continue; // avoid duplicates
        const games = rng.chance(0.5) ? 7 : 6;
        const homeGames = Math.ceil(games / 2);
        const awayGames = games - homeGames;
        for (let g = 0; g < homeGames; g++) matchups.push({ away: opp, home: teamId });
        for (let g = 0; g < awayGames; g++) matchups.push({ away: teamId, home: opp });
      }
    }

    // Interleague: fill remaining to get close to 162 per team
    const gameCounts = new Map<string, number>();
    for (const teamId of allTeams) gameCounts.set(teamId, 0);
    for (const m of matchups) {
      gameCounts.set(m.away, (gameCounts.get(m.away) || 0) + 1);
      gameCounts.set(m.home, (gameCounts.get(m.home) || 0) + 1);
    }

    // Interleague: fill to exactly 162 per team.
    // Build all possible interleague pairs, shuffle, then greedily add games.
    const TARGET = 162;
    const leagues = Object.keys(leagueStructure);
    if (leagues.length >= 2) {
      const league1Teams = allTeams.filter(t => teamLeague.get(t) === leagues[0]);
      const league2Teams = allTeams.filter(t => teamLeague.get(t) === leagues[1]);

      // Build shuffled pair list so no league/division gets systematically starved
      const ilPairs: Array<[string, string]> = [];
      for (const t1 of league1Teams) {
        for (const t2 of league2Teams) {
          ilPairs.push([t1, t2]);
        }
      }
      ilPairs.sort(() => rng.next() - 0.5);

      // Multiple passes over shuffled pairs to fill games one at a time
      let added = true;
      while (added) {
        added = false;
        for (const [t1, t2] of ilPairs) {
          if ((gameCounts.get(t1) || 0) >= TARGET || (gameCounts.get(t2) || 0) >= TARGET) continue;
          const isHome = rng.chance(0.5);
          matchups.push(isHome ? { away: t2, home: t1 } : { away: t1, home: t2 });
          gameCounts.set(t1, (gameCounts.get(t1) || 0) + 1);
          gameCounts.set(t2, (gameCounts.get(t2) || 0) + 1);
          added = true;
        }
      }
    }

    // Fill-up pass: if any teams are still under 162, pair them (same-league extra games)
    let safety = 0;
    while (safety++ < 500) {
      const underTeams = allTeams.filter(t => (gameCounts.get(t) || 0) < TARGET);
      if (underTeams.length === 0) break;
      if (underTeams.length === 1) {
        // Exactly one team under 162 — find the team closest to it in game count
        // and pair them. The partner goes to 163 briefly, so swap: find a game
        // involving the partner and an at-162 team, remove it, and add game
        // with the under-team instead.
        const solo = underTeams[0];
        const soloLeague = teamLeague.get(solo)!;
        // Find a game we can "steal" from a 162-game team and redirect to solo
        let swapped = false;
        for (let i = matchups.length - 1; i >= 0 && !swapped; i--) {
          const m = matchups[i];
          // Look for a game between two 162-game teams where one is in the opposite league from solo
          const ac = gameCounts.get(m.away) || 0;
          const hc = gameCounts.get(m.home) || 0;
          if (ac === TARGET && hc === TARGET) {
            // Replace one side with solo
            matchups.splice(i, 1);
            gameCounts.set(m.away, ac - 1);
            gameCounts.set(m.home, hc - 1);
            // Add game: solo vs whichever was removed
            // Pick the team from the opposite league if possible
            const partner = teamLeague.get(m.away) !== soloLeague ? m.away : m.home;
            const other = partner === m.away ? m.home : m.away;
            matchups.push({ away: solo, home: partner });
            gameCounts.set(solo, (gameCounts.get(solo) || 0) + 1);
            gameCounts.set(partner, (gameCounts.get(partner) || 0) + 1);
            // Re-add a game for the displaced team with another under-162 team if possible
            const otherCount = gameCounts.get(other) || 0;
            if (otherCount < TARGET) {
              // Other team also needs a game now — find another under-162 team
              const newUnder = allTeams.filter(t => t !== other && t !== solo && (gameCounts.get(t) || 0) < TARGET);
              if (newUnder.length > 0) {
                const p2 = newUnder[0];
                matchups.push({ away: other, home: p2 });
                gameCounts.set(other, otherCount + 1);
                gameCounts.set(p2, (gameCounts.get(p2) || 0) + 1);
              }
            }
            swapped = true;
          }
        }
        if (!swapped) break; // can't fix — accept 161 (extremely rare)
        continue;
      }
      const a = underTeams[0], b = underTeams[1];
      const isHome = rng.chance(0.5);
      matchups.push(isHome ? { away: b, home: a } : { away: a, home: b });
      gameCounts.set(a, (gameCounts.get(a) || 0) + 1);
      gameCounts.set(b, (gameCounts.get(b) || 0) + 1);
    }

    // Shuffle matchups randomly
    const shuffled = [...matchups].sort(() => rng.next() - 0.5);

    // Build conflict-free "rounds": each round assigns at most 1 game per team per day
    // Greedy pass: scan remaining games, add to current round if neither team is used
    const rounds: Array<Array<{ away: string; home: string }>> = [];
    let remaining = [...shuffled];
    while (remaining.length > 0) {
      const round: Array<{ away: string; home: string }> = [];
      const usedTeams = new Set<string>();
      const leftover: Array<{ away: string; home: string }> = [];
      for (const m of remaining) {
        if (!usedTeams.has(m.home) && !usedTeams.has(m.away)) {
          round.push(m);
          usedTeams.add(m.home);
          usedTeams.add(m.away);
        } else {
          leftover.push(m);
        }
      }
      rounds.push(round);
      remaining = leftover;
    }

    // Spread rounds proportionally across 183 calendar days
    // This ensures games appear across the full season with proper off-days
    const numDays = 183;
    const schedule: ScheduledGame[] = [];
    let gameIdx = 0;
    rounds.forEach((round, ri) => {
      const day = Math.min(numDays, Math.floor(ri * numDays / rounds.length) + 1);
      for (const m of round) {
        schedule.push({
          id: `game-${gameIdx}`,
          gameNumber: gameIdx + 1,
          awayId: m.away,
          homeId: m.home,
          date: day,
          played: false,
        });
        gameIdx++;
      }
    });

    return schedule;
  }
}
